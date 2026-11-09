// 規則引擎測試：每條規則用一個小情境確認。
const assert = require('assert');
const path = require('path');
const data = require(path.join(__dirname, '../js/game-data.js'));
const E = require(path.join(__dirname, '../js/engine.js'));

const players = (over = {}) => ['ee', 'fab', 'fluid', 'bio', 'optic'].map((role, i) => ({
  name: `P${i}`, role, arch: 'closed', insulator: 'thick', ...over,
}));
const fixed = () => 0.42;
const setEvent = (game, id) => { game.events[0] = id; };
const tests = [];
const test = (name, fn) => tests.push([name, fn]);

test('基本版：全員葡萄糖、封閉式、厚層 4 點，沒有角色和事件', () => {
  const g = E.createGame(players(), fixed, 'basic');
  assert.strictEqual(g.events.length, 0);
  g.players.forEach((p) => {
    assert.strictEqual(p.missionId, 'glucose'); assert.strictEqual(p.arch, 'closed');
    assert.strictEqual(p.insulator, 'thick'); assert.strictEqual(p.life, 4); assert.strictEqual(p.role, 'none');
  });
  assert.deepStrictEqual(g.players.map((p) => p.charge), [6, 7, 6, 6, 7]);
});
test('基本版：每回合 +2，答對再 +2 電荷 +2 分，答錯不加', () => {
  const g = E.createGame(players(), fixed, 'basic');
  // 開局電荷依座位不同，所以用增量比較
  const start = g.players.map((p) => p.charge);
  E.startRound(g); assert.strictEqual(E.eventOf(g), null);
  assert.strictEqual(g.players[0].charge, start[0] + 2);
  E.settleQuestion(g, [0]);
  assert.strictEqual(g.players[0].charge, start[0] + 4); assert.strictEqual(g.players[0].score, 2);
  assert.strictEqual(g.players[1].charge, start[1] + 2); assert.strictEqual(g.players[1].score, 0);
});
test('基本版：移動電荷 1、1、1、2、3，第 5 格才檢定', () => {
  const g = E.createGame(players(), fixed, 'basic'); E.startRound(g);
  const p = g.players[0]; p.charge = 20; const costs = [];
  for (let i = 0; i < 5; i += 1) {
    costs.push(E.nextStepCost(g, p)); assert.strictEqual(E.needsBreakdownCheck(p), i === 4); E.step(g, p, 6);
  }
  assert.deepStrictEqual(costs, [1, 1, 1, 2, 3]); assert.strictEqual(E.nextStepCost(g, p), null);
});
test('基本版：完成檢測後重做同一張，第一名加分只發一次', () => {
  const g = E.createGame(players(), fixed, 'basic', { firstBonus: true }); E.startRound(g);
  const [a, b] = g.players; a.charge = 20; b.charge = 20;
  assert.strictEqual(E.nextStation(a), 'REA');
  E.completeStation(g, a); a.stationThisTurn = false; E.completeStation(g, a); a.stationThisTurn = false;
  assert.strictEqual(E.nextStation(a), 'DET'); E.payDetect(g, a); E.settleDetect(g, a, true);
  assert.strictEqual(a.missionId, 'glucose'); assert.strictEqual(E.nextStation(a), 'REA');
  assert.strictEqual(a.score, 2 + 2 + 4 + 1);
  b.stepIndex = 2; E.payDetect(g, b); E.settleDetect(g, b, true); assert.strictEqual(b.score, 4);
});
test('進階版卡牌完整保留', () => {
  assert.strictEqual(data.EVENTS.length, 12); assert.strictEqual(data.ROLES.length, 5); assert.strictEqual(data.MISSIONS.length, 6);
  assert.strictEqual(data.CHIPS.insulator.thin.life, 2); assert.strictEqual(E.createGame(players(), fixed).mode, 'full');
});

test('開局電荷含路線補償', () => {
  const g = E.createGame(players({ arch: 'open' }), fixed);
  g.players.forEach((p) => assert.strictEqual(p.charge, data.RULES.startCharge + 2 + p.routeBonus));
});
test('基本收入與交流事件', () => {
  const g = E.createGame(players(), fixed); setEvent(g, 'ac');
  const before = g.players[0].charge; E.startRound(g);
  assert.strictEqual(g.players[0].charge, before + 3);
});
test('答對加電荷和分數，尺度事件多 1 電荷', () => {
  const g = E.createGame(players(), fixed); setEvent(g, 'scaling'); E.startRound(g);
  const before = g.players[1].charge; E.settleQuestion(g, [1]);
  assert.strictEqual(g.players[1].charge, before + 3);
  assert.strictEqual(g.players[1].score, data.RULES.correctScore);
});
test('厚絕緣層第 4 格 2 電荷、第 5 格要檢定', () => {
  const g = E.createGame(players(), fixed); setEvent(g, 'ac'); E.startRound(g);
  const p = g.players[1]; p.charge = 20;
  [1, 1, 1, 2].forEach((c) => assert.strictEqual(E.step(g, p, 6).cost, c));
  assert.strictEqual(E.needsBreakdownCheck(p), true);
  const r = E.step(g, p, 1);
  assert.ok(r.damaged); assert.strictEqual(p.life, 3);
  assert.strictEqual(E.nextStepCost(g, p), null);
});
test('薄絕緣層第 4 格就要檢定，歸零後下回合才暫停，隔回合恢復', () => {
  const g = E.createGame(players({ insulator: 'thin' }), fixed); setEvent(g, 'ac'); E.startRound(g);
  const p = g.players[1]; p.charge = 20; p.life = 1;
  E.step(g, p, 6); E.step(g, p, 6); E.step(g, p, 6);
  assert.strictEqual(E.needsBreakdownCheck(p), true);
  E.step(g, p, 1);
  assert.strictEqual(p.life, 1); assert.strictEqual(p.pendingSkip, true);
  assert.strictEqual(p.skipNext, false);
  assert.strictEqual(E.nextStepCost(g, p), null);
  E.startRound(g);
  assert.strictEqual(p.skipNext, true);
  assert.strictEqual(E.nextStepCost(g, p), null);
  E.startRound(g);
  assert.strictEqual(p.skipNext, false);
});
test('電機工程師不用檢定', () => {
  const g = E.createGame(players(), fixed); setEvent(g, 'ac'); E.startRound(g);
  const p = g.players[0]; p.charge = 20; p.stepsThisTurn = 4;
  assert.strictEqual(E.needsBreakdownCheck(p), false);
});
test('飽和事件限 3 格、遲滯事件第 1 格加價', () => {
  let g = E.createGame(players(), fixed); setEvent(g, 'saturation'); E.startRound(g);
  let p = g.players[1]; p.charge = 20;
  for (let i = 0; i < 3; i += 1) assert.ok(E.step(g, p, 6).ok);
  assert.strictEqual(E.nextStepCost(g, p), null);
  g = E.createGame(players(), fixed); setEvent(g, 'hysteresis'); E.startRound(g);
  p = g.players[1]; assert.strictEqual(E.nextStepCost(g, p), 2);
});
test('退格會退費', () => {
  const g = E.createGame(players(), fixed); setEvent(g, 'hysteresis'); E.startRound(g);
  const p = g.players[1]; p.charge = 9; E.step(g, p, 6); assert.strictEqual(p.charge, 7);
  E.undoStep(g, p); assert.strictEqual(p.charge, 9);
});
test('站點費用：分裂依架構、混合環依角色、矽油最低 1', () => {
  const g = E.createGame(players(), fixed); setEvent(g, 'ac'); E.startRound(g);
  assert.strictEqual(E.stationCost(g, g.players[0], 'SPL'), 1);
  g.players[0].arch = 'open';
  assert.strictEqual(E.stationCost(g, g.players[0], 'SPL'), 3);
  assert.strictEqual(E.stationCost(g, g.players[2], 'MIX'), 1);
  g.eventId = 'oil';
  assert.strictEqual(E.stationCost(g, g.players[2], 'MIX'), 1);
  assert.strictEqual(E.stationCost(g, g.players[1], 'DET'), 1);
});
test('任務流程：兩站加檢測，首位加分，答錯不算', () => {
  const g = E.createGame(players(), fixed); setEvent(g, 'ac'); E.startRound(g);
  const p = g.players[1]; p.charge = 30;
  assert.ok(E.completeStation(g, p).ok);
  assert.strictEqual(E.completeStation(g, p).ok, false); // 每回合一站
  p.stationThisTurn = false;
  assert.ok(E.completeStation(g, p).ok);
  p.stationThisTurn = false;
  assert.ok(E.payDetect(g, p).ok);
  assert.strictEqual(E.settleDetect(g, p, false).done, false);
  assert.strictEqual(E.nextStation(p), 'DET');
  p.stationThisTurn = false; E.payDetect(g, p);
  const score = p.score;
  assert.ok(E.settleDetect(g, p, true).done);
  assert.strictEqual(p.score, score + data.RULES.detectScore + data.RULES.firstDetectBonus);
  assert.notStrictEqual(E.nextStation(p), 'DET');
  assert.strictEqual(p.stepIndex, 0);
});
test('修復：滿血不能修，製程工程師只要 1 電荷', () => {
  const g = E.createGame(players(), fixed); setEvent(g, 'ac'); E.startRound(g);
  const p = g.players[1]; p.charge = 5;
  assert.strictEqual(E.repair(p).ok, false);
  p.life = 2; assert.strictEqual(E.repair(p).cost, 1);
  const q = g.players[0]; q.charge = 5; q.life = 2; assert.strictEqual(E.repair(q).cost, 2);
});
test('回合起手輪替', () => {
  const g = E.createGame(players(), fixed); E.startRound(g); E.startRound(g);
  assert.deepStrictEqual(E.turnOrder(g), [1, 2, 3, 4, 0]);
  assert.strictEqual(E.currentPlayer(g).seat, 1);
  E.endTurn(g);
  assert.strictEqual(E.currentPlayer(g).seat, 2);
});
test('基本版預設：首位不加分，檢測答錯扣分', () => {
  const g = E.createGame(players(), fixed, 'basic'); E.startRound(g);
  const p = g.players[0]; p.score = 6; p.stepIndex = 2;
  assert.strictEqual(E.settleDetect(g, p, false).penalty, data.RULES.detectFailPenalty);
  assert.strictEqual(p.score, 6 - data.RULES.detectFailPenalty);
  assert.ok(E.settleDetect(g, p, true).done);
  assert.strictEqual(p.score, 6 - data.RULES.detectFailPenalty + data.RULES.detectScore);
});
test('進階版預設不扣分，兩個開關都能覆寫', () => {
  const full = E.createGame(players(), fixed); E.startRound(full);
  assert.deepStrictEqual(full.options, data.OPTIONS.full);
  const a = full.players[0]; a.score = 6;
  assert.strictEqual(E.settleDetect(full, a, false).penalty, 0); assert.strictEqual(a.score, 6);
  const custom = E.createGame(players(), fixed, 'full', { firstBonus: false, failPenalty: true }); E.startRound(custom);
  const b = custom.players[0]; b.score = 6;
  assert.strictEqual(E.settleDetect(custom, b, false).penalty, data.RULES.detectFailPenalty);
  assert.ok(E.settleDetect(custom, b, true).done);
  assert.strictEqual(b.score, 6 - data.RULES.detectFailPenalty + data.RULES.detectScore);
});
test('基本版同分並列第一，下一位跳名次', () => {
  const g = E.createGame(players(), fixed, 'basic');
  g.players.forEach((p, i) => { p.score = [10, 10, 8, 4, 2][i]; p.correct = [1, 3, 2, 1, 0][i]; });
  assert.deepStrictEqual(E.standings(g).map((row) => row.rank), [1, 1, 3, 4, 5]);
});
test('舊存檔沒有 options 時照舊規則算', () => {
  const g = E.createGame(players(), fixed, 'basic'); E.startRound(g); delete g.options;
  const p = g.players[0];
  assert.strictEqual(E.settleDetect(g, p, false).penalty, 0);
  assert.ok(E.settleDetect(g, p, true).done);
  assert.strictEqual(p.score, data.RULES.detectScore + data.RULES.firstDetectBonus);
});
test('排名同分比答對題數', () => {
  const g = E.createGame(players(), fixed);
  g.players[0].score = 10; g.players[1].score = 10; g.players[1].correct = 3;
  assert.strictEqual(E.ranking(g)[0].seat, 1);
});

let failed = 0;
tests.forEach(([name, fn]) => {
  try { fn(); console.log(`通過 ${name}`); } catch (err) { failed += 1; console.log(`失敗 ${name}\n  ${err.message}`); }
});
console.log(`${tests.length - failed}/${tests.length} 通過`);
process.exitCode = failed ? 1 : 0;
