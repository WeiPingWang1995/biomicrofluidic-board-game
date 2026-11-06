// 基本版座位分析：拆開距離、補償、行動順序的影響，並測試液滴不能同格的規則。
// 機器人邏輯和 simulate.js 相同，先規劃路線再走，這樣才能判斷停點是否合法。
// 用法：node tools/seat-analysis.js [局數]
const path = require('path');
const data = require(path.join(__dirname, '../js/game-data.js'));
const E = require(path.join(__dirname, '../js/engine.js'));
const { BOARD, CHIPS, RULES } = data;

const games = Number(process.argv[2] || 20000);
const originalStarts = BOARD.starts.map((s) => ({ ...s }));
const stationCells = new Set(BOARD.stations.map((s) => `${s.row},${s.col}`));
const key = (c) => `${c.row},${c.col}`;
const dist = (a, b) => Math.abs(a.row - b.row) + Math.abs(a.col - b.col);

// 固定種子：每個變體用同一串亂數起點，差異才來自規則
function makeRng(start) {
  let seed = start;
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function remaining(pos, steps) {
  if (!steps.length) return 0;
  return Math.min(...BOARD.stations.filter((s) => s.type === steps[0]).map((s) => dist(pos, s) + remaining(s, steps.slice(1))));
}
function nearestFor(pos, player) {
  const steps = E.missionOf(player).steps.slice(player.stepIndex);
  return BOARD.stations.filter((s) => s.type === steps[0])
    .sort((a, b) => dist(pos, a) + remaining(a, steps.slice(1)) - dist(pos, b) - remaining(b, steps.slice(1)))[0];
}

// 不受阻擋時的路線：先走直向再走橫向，和 simulate.js 一樣
function straightPath(from, target) {
  const cells = [];
  const at = { ...from };
  while (at.row !== target.row || at.col !== target.col) {
    if (at.row !== target.row) at.row += Math.sign(target.row - at.row);
    else at.col += Math.sign(target.col - at.col);
    cells.push({ ...at });
  }
  return cells;
}

// 繞路：不能穿過別人佔住的非站點格，用廣度優先找最短路
function detourPath(from, target, blocked) {
  const queue = [{ cell: from, trail: [] }];
  const seen = new Set([key(from)]);
  while (queue.length) {
    const { cell, trail } = queue.shift();
    if (key(cell) === key(target)) return trail;
    [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dr, dc]) => {
      const next = { row: cell.row + dr, col: cell.col + dc };
      if (next.row < 0 || next.col < 0 || next.row >= BOARD.size || next.col >= BOARD.size) return;
      if (seen.has(key(next)) || blocked.has(key(next))) return;
      seen.add(key(next));
      queue.push({ cell: next, trail: [...trail, next] });
    });
  }
  return null;
}

function playGame(rng, stats, options) {
  const die = () => 1 + Math.floor(rng() * 6);
  const players = [0, 1, 2, 3, 4].map((i) => ({ name: `P${i + 1}` }));
  // 這支工具自己控制首位分和扣分，所以關掉引擎的預設值，改由 RULES 和 options 決定
  const game = E.createGame(players, rng, 'basic', { firstBonus: true, failPenalty: false });
  if (options.flatCharge !== undefined) game.players.forEach((p) => { p.charge = RULES.startCharge + options.flatCharge; });
  const pos = BOARD.starts.map((s) => ({ ...s }));
  const firstFinish = game.players.map(() => null);
  let firstRoundDone = null;

  for (let round = 1; round <= RULES.rounds; round += 1) {
    E.startRound(game);
    E.settleQuestion(game, game.players.filter(() => rng() < options.accuracy).map((p) => p.seat));

    E.turnOrder(game).forEach(() => {
      const p = E.currentPlayer(game);
      const at = pos[p.seat];
      if (p.skipNext) { E.endTurn(game); return; }
      if (p.life === 1 && p.charge >= E.repairCost(p) + 2) E.repair(p);

      const act = () => {
        const type = E.nextStation(p);
        if (!type || dist(at, nearestFor(at, p)) !== 0) return;
        if (type === 'DET') {
          if (!E.payDetect(game, p).ok) return;
          const first = !game.firstDetectDone;
          const passed = E.settleDetect(game, p, rng() < options.accuracy + 0.1).done;
          // 變體：檢測答錯扣 1 分
          if (!passed && options.detectPenalty) p.score -= 1;
          if (passed) {
            if (first) stats.first[p.seat] += 1;
            // 變體：同一回合完成檢測的人都拿加分，消除行動順序的影響
            if (options.sameRoundBonus && (firstRoundDone === null || firstRoundDone === round) && firstFinish[p.seat] === null) {
              firstRoundDone = round;
              p.score += 1;
            }
            if (firstFinish[p.seat] === null) firstFinish[p.seat] = round;
          }
          return;
        }
        E.completeStation(game, p);
      };

      act();
      if (E.nextStation(p)) {
        const target = nearestFor(at, p);
        // 其他液滴佔住的非站點格；站點例外
        const blocked = new Set(pos.filter((_, seat) => seat !== p.seat).map(key).filter((c) => !stationCells.has(c)));
        let route = straightPath(at, target);
        if (options.block === 'noPass') {
          route = detourPath(at, target, blocked) || [];
          if (route.length > dist(at, target)) stats.detour += route.length - dist(at, target);
        }
        // 先算這回合願意走幾格
        const costs = CHIPS.insulator[p.insulator].stepCost;
        let plan = 0;
        let money = p.charge;
        while (plan < route.length && plan < E.maxSteps(game)) {
          const n = plan + p.stepsThisTurn;
          if (money < costs[n]) break;
          if (n + 1 >= CHIPS.insulator[p.insulator].checkFrom && route.length - plan > 1) break;
          money -= costs[n];
          plan += 1;
        }
        // 不能停在別人的格子上，就往回退到合法的停點
        if (options.block !== 'none') {
          const wanted = plan;
          while (plan > 0 && blocked.has(key(route[plan - 1]))) plan -= 1;
          if (plan < wanted) stats.blockedStops += 1;
        }
        for (let i = 0; i < plan; i += 1) {
          if (!E.step(game, p, die()).ok) break;
          at.row = route[i].row;
          at.col = route[i].col;
        }
      }
      act();
      E.endTurn(game);
    });
  }

  const top = Math.max(...game.players.map((p) => p.score));
  const winners = game.players.filter((p) => p.score === top);
  // 統計第一名同分：先看分數，再看比答對題數後還剩幾人
  stats.topTied += winners.length > 1 ? 1 : 0;
  const bestCorrect = Math.max(...winners.map((p) => p.correct));
  let finalists = winners.filter((p) => p.correct === bestCorrect);
  // 變體：比完答對題數，再比剩餘電荷
  if (options.chargeBreak) {
    const most = Math.max(...finalists.map((p) => p.charge));
    finalists = finalists.filter((p) => p.charge === most);
  }
  stats.stillTied += finalists.length > 1 ? 1 : 0;
  stats.allTied += winners.length === game.players.length ? 1 : 0;
  const sorted = game.players.map((p) => p.score).sort((a, b) => b - a);
  stats.gap += sorted[0] - sorted[4];
  stats.gameMax += sorted[0];
  game.players.forEach((p) => {
    stats.wins[p.seat] += finalists.includes(p) ? 1 / finalists.length : 0;
    stats.score[p.seat] += p.score;
    stats.stations[p.seat] += p.stationsDone;
    stats.done[p.seat] += p.missionsDone > 0 ? 1 : 0;
    stats.finishRound[p.seat] += firstFinish[p.seat] || 0;
    stats.finishCount[p.seat] += firstFinish[p.seat] ? 1 : 0;
  });
}

function run(label, options, startsFor) {
  BOARD.starts.forEach((_, i) => { Object.assign(BOARD.starts[i], startsFor ? startsFor(i) : originalStarts[i]); });
  const zero = () => [0, 0, 0, 0, 0];
  const stats = {
    wins: zero(), score: zero(), stations: zero(), done: zero(), first: zero(),
    finishRound: zero(), finishCount: zero(), blockedStops: 0, detour: 0,
    topTied: 0, stillTied: 0, allTied: 0, gap: 0, gameMax: 0,
  };
  const rng = makeRng(20261110);
  for (let i = 0; i < games; i += 1) playGame(rng, stats, options);
  const row = (name, list, digits) => `  ${name.padEnd(12)}${list.map((v) => v.toFixed(digits).padStart(8)).join('')}`;
  const per = (list) => list.map((v) => v / games);
  console.log(`\n${label}`);
  console.log(row('勝率 %', stats.wins.map((v) => (v / games) * 100), 1));
  if (options.detail) {
    console.log(row('平均分', per(stats.score), 2));
    console.log(row('中途站數', per(stats.stations), 2));
    console.log(row('完成率 %', stats.done.map((v) => (v / games) * 100), 1));
    console.log(row('完成回合', stats.finishRound.map((v, i) => v / stats.finishCount[i]), 2));
    console.log(row('搶到首位 %', stats.first.map((v) => (v / games) * 100), 1));
  }
  console.log(`  第一名同分 ${((stats.topTied / games) * 100).toFixed(1)}%，比答對題數後仍同分 ${((stats.stillTied / games) * 100).toFixed(1)}%，五人全同分 ${((stats.allTied / games) * 100).toFixed(2)}%，第一名平均 ${(stats.gameMax / games).toFixed(1)} 分，第一到最後一名分差 ${(stats.gap / games).toFixed(1)} 分`);
  const done = (stats.done.reduce((a, b) => a + b, 0) / (games * 5)) * 100;
  const score = stats.score.reduce((a, b) => a + b, 0) / (games * 5);
  console.log(`  全體完成率 ${done.toFixed(1)}%，平均分 ${score.toFixed(2)}，每局被擋停點 ${(stats.blockedStops / games).toFixed(2)} 次，繞路 ${(stats.detour / games).toFixed(2)} 格`);
}

console.log('欄位依序是座位 1 到 5');
[0.6, 0.8].forEach((accuracy) => {
  console.log(`\n===== 共同題答對率 ${accuracy} =====`);
  run('A 現行規則', { accuracy, block: 'none', detail: true });
  run('B 拿掉補償，全員開局 3 電荷', { accuracy, block: 'none', flatCharge: 0 });
  run('C 全員開局 5 電荷（距離不同、電荷相同）', { accuracy, block: 'none', flatCharge: 2 });
  run('D 全員同一起點、沒有補償（只剩行動順序的影響）', { accuracy, block: 'none' }, () => originalStarts[4]);
  run('E 起點輪替：座位 1 用起點 5，其餘順延（看優勢跟著格子還是座位）', { accuracy, block: 'none' }, (i) => originalStarts[(i + 4) % 5]);
  // 拿掉首位加分，確認行動順序是不是透過這 1 分影響勝率
  RULES.firstDetectBonus = 0;
  run('H 拿掉首位加分', { accuracy, block: 'none' });
  run('I 全員同一起點，也拿掉首位加分', { accuracy, block: 'none' }, () => originalStarts[4]);
  RULES.firstDetectBonus = 1;
  RULES.firstDetectBonus = 0;
  run('J 拿掉首位加分，同分再比剩餘電荷', { accuracy, block: 'none', chargeBreak: true });
  run('K 同一回合完成檢測都 +1 分', { accuracy, block: 'none', sameRoundBonus: true });
  run('L 同一回合完成檢測都 +1 分，同分再比剩餘電荷', { accuracy, block: 'none', sameRoundBonus: true, chargeBreak: true });
  RULES.firstDetectBonus = 1;
  RULES.firstDetectBonus = 0;
  run('N 拿掉首位加分，檢測答錯 -1 分', { accuracy, block: 'none', detectPenalty: true });
  run('O 拿掉首位加分，檢測答錯 -1 分，同分再比剩餘電荷', { accuracy, block: 'none', detectPenalty: true, chargeBreak: true });
  RULES.firstDetectBonus = 1;
  run('M 現行首位加分，同分再比剩餘電荷', { accuracy, block: 'none', chargeBreak: true });
  run('F 不能停在別人的格子，可穿過，站點例外', { accuracy, block: 'noStop', detail: true });
  run('G 不能停也不能穿過，站點例外', { accuracy, block: 'noPass', detail: true });
});
BOARD.starts.forEach((_, i) => { Object.assign(BOARD.starts[i], originalStarts[i]); });
