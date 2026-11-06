// 用隨機搜尋找站點位置，讓每個座位配上每張任務的最短路線長度盡量接近。
const path = require('path');
const { BOARD, MISSIONS } = require(path.join(__dirname, '../js/game-data.js'));
const counts = { REA: 2, EP: 2, DEP: 2, SPL: 2, DET: 3 };
let seed = 7;
const rng = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const dist = (a, b) => Math.abs(a.row - b.row) + Math.abs(a.col - b.col);
const center = { type: 'MIX', row: 4, col: 4 };
function randomLayout() {
  const placed = [center];
  for (const type of Object.keys(counts)) {
    for (let i = 0; i < counts[type]; i += 1) {
      for (let tries = 0; tries < 200; tries += 1) {
        const cell = { type, row: Math.floor(rng() * 9), col: Math.floor(rng() * 9) };
        const clear = placed.every((s) => dist(s, cell) >= 3) && BOARD.starts.every((s) => dist(s, cell) >= 2);
        if (clear) { placed.push(cell); break; }
      }
    }
  }
  return placed;
}
function route(start, steps, layout) {
  // 動態規劃：每一步選哪個同類站，總距離最短
  let best = [{ at: start, d: 0 }];
  for (const type of steps) {
    best = layout.filter((s) => s.type === type).map((s) => ({
      at: s, d: Math.min(...best.map((b) => b.d + dist(b.at, s))),
    }));
  }
  return Math.min(...best.map((b) => b.d));
}
function score(layout) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0) + 1;
  if (layout.length !== total) return 1e9;
  const lens = [];
  BOARD.starts.forEach((s) => MISSIONS.forEach((m) => lens.push(route(s, m.steps, layout))));
  const mean = lens.reduce((a, b) => a + b, 0) / lens.length;
  const variance = lens.reduce((a, b) => a + (b - mean) ** 2, 0) / lens.length;
  const seats = BOARD.starts.map((s) => MISSIONS.reduce((a, m) => a + route(s, m.steps, layout), 0) / MISSIONS.length);
  const missions = MISSIONS.map((m) => BOARD.starts.reduce((a, s) => a + route(s, m.steps, layout), 0) / BOARD.starts.length);
  const spread = (x) => Math.max(...x) - Math.min(...x);
  return variance + 3 * spread(seats) + 3 * spread(missions) + (mean < 10 || mean > 12 ? 10 : 0);
}
let best = null; let bestScore = Infinity;
for (let i = 0; i < 400000; i += 1) {
  const layout = randomLayout();
  const s = score(layout);
  if (s < bestScore) { bestScore = s; best = layout; }
}
const matrix = BOARD.starts.map((s) => MISSIONS.map((m) => route(s, m.steps, best)));
console.log('score', bestScore.toFixed(2));
console.log(JSON.stringify(best));
console.log(MISSIONS.map((m) => m.id).join(' '));
matrix.forEach((r) => console.log(r.join(' ')));
