// 搜尋站點位置：讓「每張任務」的 5 個起點最短路線都盡量一樣長。
// 舊版只看全部任務的平均，所以平均很平，單張任務卻可能差到 6 格。
// 基本版只用葡萄糖任務，權重最高。用法：node tools/layout-search.js [重新起跑次數] [movestarts]
const path = require('path');
const { BOARD, MISSIONS, BASIC } = require(path.join(__dirname, '../js/game-data.js'));

const restarts = Number(process.argv[2] || 300);
const moveStarts = process.argv[3] === 'movestarts';
const size = BOARD.size;
const dist = (a, b) => Math.abs(a.row - b.row) + Math.abs(a.col - b.col);

// 固定種子，結果可以重現
let seed = 20261106;
const rng = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const randInt = (n) => Math.floor(rng() * n);

function route(start, steps, stations) {
  // 動態規劃：每一步選哪個同類站，總距離最短
  let reach = [{ at: start, d: 0 }];
  for (const type of steps) {
    reach = stations.filter((s) => s.type === type).map((s) => ({
      at: s, d: Math.min(...reach.map((r) => r.d + dist(r.at, s))),
    }));
  }
  return Math.min(...reach.map((r) => r.d));
}

const spread = (list) => Math.max(...list) - Math.min(...list);
const mean = (list) => list.reduce((a, b) => a + b, 0) / list.length;

// 站點彼此至少隔 3 格、離起點至少 2 格，避免一步連完兩站
function legal(stations, starts) {
  // 起點要在棋盤邊緣，彼此至少隔 5 格，否則會全部擠在一起
  const edge = (s) => s.row === 0 || s.col === 0 || s.row === size - 1 || s.col === size - 1;
  if (!starts.every(edge)) return false;
  for (let i = 0; i < starts.length; i += 1) {
    for (let j = i + 1; j < starts.length; j += 1) if (dist(starts[i], starts[j]) < 5) return false;
  }
  for (let i = 0; i < stations.length; i += 1) {
    if (starts.some((s) => dist(s, stations[i]) < 2)) return false;
    for (let j = i + 1; j < stations.length; j += 1) if (dist(stations[i], stations[j]) < 3) return false;
  }
  return true;
}

function matrix(stations, starts) {
  return MISSIONS.map((m) => starts.map((s) => route(s, m.steps, stations)));
}

function cost(stations, starts) {
  const rows = matrix(stations, starts);
  const spreads = rows.map(spread);
  const basicRow = MISSIONS.findIndex((m) => m.id === BASIC.mission);
  const seats = starts.map((_, i) => mean(rows.map((r) => r[i])));
  const all = rows.flat();
  const missions = rows.map(mean);
  // 路線長度維持現在的節奏：全部任務和基本版都落在 11 到 12 格
  const outside = (x) => Math.max(0, 11 - x) + Math.max(0, x - 12);
  const pace = outside(mean(all)) + outside(mean(rows[basicRow]));
  // 重罰基本版的差距和單張任務的最大差距，其次才看總和
  return 100 * spreads[basicRow] + 30 * Math.max(...spreads)
    + 5 * spreads.reduce((a, b) => a + b, 0) + 10 * spread(seats) + 8 * spread(missions) + 40 * pace;
}

function randomCell() { return { row: randInt(size), col: randInt(size) }; }

function climb() {
  const starts = BOARD.starts.map((s) => ({ ...s }));
  // 隨機合法盤面很難碰到，所以從現有盤面出發，開頭用高溫打散
  const stations = BOARD.stations.map((s) => ({ ...s }));
  let current = cost(stations, starts);
  let temp = 150;
  for (let i = 0; i < 20000; i += 1) {
    const list = moveStarts && rng() < 0.15 ? starts : stations;
    const at = randInt(list.length);
    const old = { row: list[at].row, col: list[at].col };
    Object.assign(list[at], randomCell());
    const next = legal(stations, starts) ? cost(stations, starts) : Infinity;
    if (next <= current || rng() < Math.exp((current - next) / temp)) current = next;
    else Object.assign(list[at], old);
    temp = Math.max(0.5, temp * 0.9996);
  }
  return { score: current, stations, starts };
}

const results = [];
for (let i = 0; i < restarts; i += 1) {
  const r = climb();
  if (r) results.push(r);
}
results.sort((a, b) => a.score - b.score);
const seen = new Set();
results.filter((r) => { const k = JSON.stringify(r.stations) + JSON.stringify(r.starts); if (seen.has(k)) return false; seen.add(k); return true; })
  .slice(0, 3).forEach((r) => {
    console.log(`\nscore ${r.score.toFixed(1)}`);
    console.log('starts', JSON.stringify(r.starts));
    console.log('stations', JSON.stringify(r.stations));
    matrix(r.stations, r.starts).forEach((row, i) => console.log(MISSIONS[i].id.padEnd(12), row.join(' '), ' 差', spread(row)));
  });
