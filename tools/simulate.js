// 蒙地卡羅規則模擬：用簡單機器人跑很多局，檢查回合數、任務完成率與各選項是否失衡。
// 機器人只代表「會走最短路、會把電荷花掉」的玩家，不能取代真人試玩。
// 用法：node tools/simulate.js [局數] [答對率] [basic|full]
const path = require('path');
const data = require(path.join(__dirname, '../js/game-data.js'));
const E = require(path.join(__dirname, '../js/engine.js'));
const { BOARD, CHIPS, ROLES, RULES } = data;

const games = Number(process.argv[2] || 20000);
const accuracy = Number(process.argv[3] || 0.6);
const mode = process.argv[4] || 'full';

// 固定亂數種子，調規則時才看得出是規則變了，不是運氣變了
let seed = 20261110;
const rng = () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const die = () => 1 + Math.floor(rng() * 6);
const dist = (a, b) => Math.abs(a.row - b.row) + Math.abs(a.col - b.col);

// 選分站時要把後面路線也算進去
function remaining(pos, steps) {
  if (!steps.length) return 0;
  return Math.min(...BOARD.stations.filter((s) => s.type === steps[0]).map((s) => dist(pos, s) + remaining(s, steps.slice(1))));
}
function nearestFor(pos, player) {
  const steps = E.missionOf(player).steps.slice(player.stepIndex);
  return BOARD.stations.filter((s) => s.type === steps[0])
    .sort((a, b) => dist(pos, a) + remaining(a, steps.slice(1)) - dist(pos, b) - remaining(b, steps.slice(1)))[0];
}

function moveToward(pos, target) {
  if (pos.row !== target.row) pos.row += Math.sign(target.row - pos.row);
  else if (pos.col !== target.col) pos.col += Math.sign(target.col - pos.col);
}

const tally = (map, key, won, value) => {
  const row = map[key] || (map[key] = { games: 0, wins: 0, score: 0 });
  row.games += 1; row.wins += won; row.score += value;
};

function playGame(stats) {
  const roles = E.shuffle(ROLES.map((r) => r.id), rng);
  const players = roles.map((role, i) => ({
    name: `P${i + 1}`, role,
    arch: rng() < 0.5 ? 'open' : 'closed',
    insulator: rng() < 0.5 ? 'thin' : 'thick',
  }));
  const game = E.createGame(players, rng, mode);
  const pos = BOARD.starts.map((s) => ({ ...s }));
  const firstFinish = game.players.map(() => null);
  const startMission = game.players.map((p) => p.missionId);

  for (let round = 1; round <= RULES.rounds; round += 1) {
    E.startRound(game);
    const correct = game.players.filter(() => rng() < accuracy).map((p) => p.seat);
    E.settleQuestion(game, correct);

    E.turnOrder(game).forEach(() => {
      const p = E.currentPlayer(game);
      const at = pos[p.seat];
      // 崩潰暫停：直接跳過這一輪
      if (p.skipNext) { E.endTurn(game); return; }

      // 絕緣層只剩 1 點且電荷夠時先修，否則第 5 格風險太高
      if (p.life === 1 && p.charge >= E.repairCost(p) + 2 && p.maxLife > 1) E.repair(p);

      const act = () => {
        const type = E.nextStation(p);
        if (!type) return false;
        const target = nearestFor(at, p);
        if (dist(at, target) !== 0) return false;
        if (type === 'DET') {
          if (!E.payDetect(game, p).ok) return false;
          const ok = rng() < accuracy + 0.1 || (p.role === 'bio' && p.retries-- > 0 && rng() < accuracy + 0.1);
          if (E.settleDetect(game, p, ok).done && firstFinish[p.seat] === null) firstFinish[p.seat] = round;
          return true;
        }
        return E.completeStation(game, p).ok;
      };

      act();
      for (let guard = 0; guard < 6; guard += 1) {
        const type = E.nextStation(p);
        if (!type) break;
        const target = nearestFor(at, p);
        const left = dist(at, target);
        if (left === 0) break;
        const cost = E.nextStepCost(game, p);
        if (cost === null) break;
        // 記錄想走卻付不起的次數，用來判斷電荷夠不夠緊
        if (p.charge < cost) { stats.broke += 1; break; }
        // 留下足夠的站點費；第 5 格只有快到站時才冒險
        if (E.needsBreakdownCheck(p) && left > 1) break;
        const moved = E.step(game, p, die());
        if (!moved.ok) break;
        if (moved.check) stats.checks += 1;
        if (moved.damaged) stats.damaged += 1;
        if (p.pendingSkip) stats.crashed += 1;
        moveToward(at, target);
        stats.steps += 1;
      }
      act();
      E.endTurn(game);
    });
  }

  const top = Math.max(...game.players.map((p) => p.score));
  const winners = game.players.filter((p) => p.score === top);
  game.players.forEach((p) => {
    const won = winners.includes(p) ? 1 / winners.length : 0;
    tally(stats.seat, p.seat + 1, won, p.score);
    tally(stats.role, p.role, won, p.score);
    tally(stats.chip, `${p.arch}+${p.insulator}`, won, p.score);
    tally(stats.mission, startMission[p.seat], won, p.score);
    stats.players += 1;
    stats.finished += p.missionsDone > 0 ? 1 : 0;
    stats.two += p.missionsDone > 1 ? 1 : 0;
    stats.scoreSum += p.score;
    stats.chargeLeft += p.charge;
    if (firstFinish[p.seat]) {
      stats.finishRound[firstFinish[p.seat]] = (stats.finishRound[firstFinish[p.seat]] || 0) + 1;
    }
    if (p.stationsDone === 0 && p.missionsDone === 0) stats.nothing += 1;
  });
  stats.gameHasFinisher += game.firstDetectDone ? 1 : 0;
}

const stats = {
  seat: {}, role: {}, chip: {}, mission: {}, finishRound: {}, players: 0, finished: 0, two: 0,
  scoreSum: 0, steps: 0, nothing: 0, gameHasFinisher: 0, broke: 0, checks: 0, damaged: 0, crashed: 0, chargeLeft: 0,
};
for (let i = 0; i < games; i += 1) playGame(stats);

const pct = (x) => `${(x * 100).toFixed(1)}%`;
const print = (title, map) => {
  console.log(`\n${title}（公平值 20%）`);
  Object.keys(map).sort().forEach((key) => {
    const r = map[key];
    console.log(`  ${String(key).padEnd(14)} 勝率 ${pct(r.wins / r.games).padStart(6)}  平均分 ${(r.score / r.games).toFixed(1)}`);
  });
};
console.log(`${games} 局，共同題答對率 ${accuracy}，模式 ${mode}`);
console.log(`至少完成 1 張任務的玩家：${pct(stats.finished / stats.players)}`);
console.log(`完成 2 張以上的玩家：${pct(stats.two / stats.players)}`);
console.log(`一站都沒完成的玩家：${pct(stats.nothing / stats.players)}`);
console.log(`有人完成檢測的局數：${pct(stats.gameHasFinisher / games)}`);
console.log(`平均分：${(stats.scoreSum / stats.players).toFixed(1)}`);
console.log(`首次完成回合：${JSON.stringify(stats.finishRound)}`);
console.log(`每人平均走格：${(stats.steps / stats.players).toFixed(1)}，結束時平均剩電荷：${(stats.chargeLeft / stats.players).toFixed(1)}`);
console.log(`每人平均付不起一步的次數：${(stats.broke / stats.players).toFixed(2)}`);
console.log(`每人平均崩潰檢定：${(stats.checks / stats.players).toFixed(2)} 次，受損 ${(stats.damaged / stats.players).toFixed(2)} 次，暫停 ${(stats.crashed / stats.players).toFixed(3)} 次`);
print('座位', stats.seat);
print('角色', stats.role);
print('晶片組合', stats.chip);
print('起始任務', stats.mission);
