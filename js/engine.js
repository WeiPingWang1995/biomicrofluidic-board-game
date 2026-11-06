// 規則引擎：只處理資料，不碰畫面。主持機和模擬器共用同一份規則。
(function (root) {
  'use strict';

  const data = root.GAME_DATA || (typeof require !== 'undefined' ? require('./game-data.js') : null);
  const { RULES, BOARD, STATIONS, MISSIONS, CHIPS, EVENTS, BASIC, OPTIONS } = data;

  // 洗牌：傳入 rng 才能在模擬時重現結果
  function shuffle(list, rng) {
    const out = list.slice();
    for (let i = out.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rng() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  const distance = (a, b) => Math.abs(a.row - b.row) + Math.abs(a.col - b.col);

  // 從某一格走完整張任務的最短格數；同類站有多個分站，所以逐站比較
  function routeLength(start, steps) {
    let reach = [{ at: start, d: 0 }];
    steps.forEach((type) => {
      reach = BOARD.stations.filter((s) => s.type === type).map((s) => ({
        at: s,
        d: Math.min(...reach.map((r) => r.d + distance(r.at, s))),
      }));
    });
    return Math.min(...reach.map((r) => r.d));
  }

  // 路線補償：抽到遠路的玩家開局多拿電荷，抵銷座位和任務的運氣差
  function routeBonus(seat, missionId) {
    const mission = MISSIONS.find((m) => m.id === missionId);
    const extra = routeLength(BOARD.starts[seat], mission.steps) - RULES.routeBase;
    return Math.min(RULES.routeBonusMax, Math.max(0, extra));
  }

  // mode 是 'basic' 時全員同任務、同晶片，沒有角色和事件；其他情況走進階版
  // options 可覆寫可選計分規則，沒給就用該版本的預設值
  function createGame(players, rng = Math.random, mode = 'full', options = {}) {
    const basic = mode === 'basic';
    const missions = basic ? players.map(() => BASIC.mission) : shuffle(MISSIONS.map((m) => m.id), rng);
    const events = basic ? [] : shuffle(EVENTS.map((e) => e.id), rng).slice(0, RULES.rounds);
    return {
      mode: basic ? 'basic' : 'full',
      options: { ...OPTIONS[basic ? 'basic' : 'full'], ...options },
      round: 0,
      phase: 'event',
      turn: 0,
      eventId: null,
      events,
      missionDeck: basic ? [] : missions.slice(players.length),
      firstDetectDone: false,
      players: players.map((raw, index) => {
        const p = basic ? { ...raw, role: BASIC.role, arch: BASIC.arch, insulator: BASIC.insulator } : raw;
        const arch = CHIPS.arch[p.arch];
        const insulator = CHIPS.insulator[p.insulator];
        return {
          name: p.name,
          seat: index,
          role: p.role,
          arch: p.arch,
          insulator: p.insulator,
          charge: RULES.startCharge + arch.extraCharge + routeBonus(index, missions[index]),
          routeBonus: routeBonus(index, missions[index]),
          life: insulator.life,
          maxLife: insulator.life,
          score: 0,
          correct: 0,
          missionId: missions[index],
          stepIndex: 0,
          missionsDone: 0,
          stationsDone: 0,
          skipNext: false,    // 這回合要暫停
          pendingSkip: false, // 崩潰了，下回合才暫停
          retries: p.role === 'bio' ? 1 : 0,
          stepsThisTurn: 0,
          stationThisTurn: false,
        };
      }),
    };
  }

  const eventOf = (game) => EVENTS.find((e) => e.id === game.eventId) || null;
  const modsOf = (game) => (eventOf(game) && eventOf(game).mods) || {};
  const missionOf = (player) => MISSIONS.find((m) => m.id === player.missionId) || null;
  const nextStation = (player) => {
    const mission = missionOf(player);
    return mission ? mission.steps[player.stepIndex] : null;
  };

  // 開始新回合：翻事件卡、結算立即效果、發基本收入
  function startRound(game) {
    game.round += 1;
    game.phase = 'event';
    game.turn = 0;
    game.eventId = game.events[game.round - 1] || null;
    const event = eventOf(game) || {}; // 基本版沒有事件
    game.players.forEach((p) => {
      p.stepsThisTurn = 0;
      p.stationThisTurn = false;
      p.skipNext = p.pendingSkip;
      p.pendingSkip = false;
      let gain = RULES.baseIncome;
      if (event.all) gain += event.all.charge;
      if (event.lowLife && p.life <= 1) gain += event.lowLife.charge;
      if (event.openChip && p.arch === 'open') gain += event.openChip.charge;
      p.charge = Math.max(0, p.charge + gain);
    });
  }

  // 共同題結算：correctSeats 是答對玩家的座位編號
  function settleQuestion(game, correctSeats) {
    const bonus = modsOf(game).correctBonus || 0;
    correctSeats.forEach((seat) => {
      const p = game.players[seat];
      p.charge += RULES.correctIncome + bonus;
      p.score += RULES.correctScore;
      p.correct += 1;
    });
  }

  function maxSteps(game) {
    return modsOf(game).maxSteps || 5;
  }

  // 下一格要多少電荷；回傳 null 代表本回合不能再走
  function nextStepCost(game, player) {
    const n = player.stepsThisTurn;
    if (n >= maxSteps(game) || player.skipNext || player.pendingSkip) return null;
    let cost = CHIPS.insulator[player.insulator].stepCost[n];
    if (n === 0) cost += modsOf(game).firstStepExtra || 0;
    return cost;
  }

  // 下一格是否要做崩潰檢定：薄絕緣層從第 4 格開始，厚絕緣層從第 5 格開始
  const needsBreakdownCheck = (player) => player.role !== 'ee'
    && player.stepsThisTurn + 1 >= CHIPS.insulator[player.insulator].checkFrom;

  // 走一格。dieRoll 只有第 5 格才會用到
  function step(game, player, dieRoll) {
    const cost = nextStepCost(game, player);
    if (cost === null) return { ok: false, reason: '本回合不能再走了' };
    if (player.charge < cost) return { ok: false, reason: '電荷不夠' };
    const check = needsBreakdownCheck(player);
    player.charge -= cost;
    player.stepsThisTurn += 1;
    let damaged = false;
    if (check && dieRoll <= RULES.breakdownFaces) {
      damaged = true;
      player.life -= 1;
      if (player.life <= 0) {
        // 絕緣層崩潰：下回合停一次，修回 1 點
        player.life = 1;
        player.pendingSkip = true;
      }
    }
    return { ok: true, cost, check, damaged };
  }

  // 走回一格：主持人按錯時用，退費但不回復崩潰檢定結果
  function undoStep(game, player) {
    if (player.stepsThisTurn === 0) return false;
    player.stepsThisTurn -= 1;
    let cost = CHIPS.insulator[player.insulator].stepCost[player.stepsThisTurn];
    if (player.stepsThisTurn === 0) cost += modsOf(game).firstStepExtra || 0;
    player.charge += cost;
    return true;
  }

  function stationCost(game, player, type = nextStation(player)) {
    if (!type) return null;
    let cost = STATIONS[type].cost;
    if (type === 'SPL') cost += CHIPS.arch[player.arch].splitDelta;
    if (type === 'MIX' && player.role === 'fluid') cost -= 1;
    const mods = modsOf(game);
    cost += mods.stationDelta || 0;
    if (player.stationsDone === 0 && player.missionsDone === 0) cost += mods.firstStationExtra || 0;
    return Math.max(1, cost);
  }

  // 完成中途站。檢測站要走 payDetect＋settleDetect，因為要先答題
  function completeStation(game, player) {
    const type = nextStation(player);
    if (!type || type === 'DET') return { ok: false, reason: '這一站要用檢測流程' };
    if (player.stationThisTurn) return { ok: false, reason: '每回合只能完成一站' };
    const cost = stationCost(game, player, type);
    if (player.charge < cost) return { ok: false, reason: '電荷不夠' };
    player.charge -= cost;
    player.stepIndex += 1;
    player.stationsDone += 1;
    player.stationThisTurn = true;
    player.score += RULES.stationScore;
    return { ok: true, cost };
  }

  function payDetect(game, player) {
    if (nextStation(player) !== 'DET') return { ok: false, reason: '還沒到檢測這一步' };
    if (player.stationThisTurn) return { ok: false, reason: '每回合只能完成一站' };
    const cost = stationCost(game, player, 'DET');
    if (player.charge < cost) return { ok: false, reason: '電荷不夠' };
    player.charge -= cost;
    player.stationThisTurn = true;
    return { ok: true, cost };
  }

  // 檢測結果：答對才算完成，並抽下一張任務；答錯留在原地，電荷不退
  function settleDetect(game, player, correct) {
    // 舊存檔沒有 options，照舊規則算
    const options = game.options || OPTIONS.full;
    if (!correct) {
      const penalty = options.failPenalty ? RULES.detectFailPenalty : 0;
      player.score -= penalty;
      return { done: false, penalty };
    }
    player.score += RULES.detectScore;
    if (!game.firstDetectDone) {
      game.firstDetectDone = true;
      if (options.firstBonus) player.score += RULES.firstDetectBonus;
    }
    player.missionsDone += 1;
    player.stepIndex = 0;
    // 基本版沒有牌堆，完成後再做一次同一張任務
    if (game.mode !== 'basic') player.missionId = game.missionDeck.shift() || null;
    return { done: true };
  }

  function repairCost(player) {
    return player.role === 'fab' ? 1 : RULES.repairCost;
  }

  function repair(player) {
    const cost = repairCost(player);
    if (player.life >= player.maxLife) return { ok: false, reason: '絕緣層是滿的' };
    if (player.charge < cost) return { ok: false, reason: '電荷不夠' };
    player.charge -= cost;
    player.life += 1;
    return { ok: true, cost };
  }

  // 每回合起手玩家往後移一位，避免同一人永遠先走
  function turnOrder(game) {
    const n = game.players.length;
    const start = (game.round - 1) % n;
    return Array.from({ length: n }, (_, i) => (start + i) % n);
  }

  function currentPlayer(game) {
    return game.players[turnOrder(game)[game.turn]];
  }

  // 換下一位；回傳 false 代表本回合所有人都行動完了
  function endTurn(game) {
    game.turn += 1;
    return game.turn < game.players.length;
  }

  // 排名：分數高者在前，答對題數多的排前面；基本版同分算並列，進階版再比答對題數
  function ranking(game) {
    return game.players.slice().sort((a, b) => b.score - a.score || b.correct - a.correct);
  }

  function sameRank(game, a, b) {
    return a.score === b.score && (game.mode === 'basic' || a.correct === b.correct);
  }

  // 結算表用：每人附上名次，並列的人名次相同
  function standings(game) {
    const sorted = ranking(game);
    const ranks = [];
    sorted.forEach((p, i) => { ranks.push(i > 0 && sameRank(game, sorted[i - 1], p) ? ranks[i - 1] : i + 1); });
    return sorted.map((player, i) => ({ player, rank: ranks[i] }));
  }

  const api = {
    shuffle, routeLength, routeBonus, createGame, startRound, settleQuestion, nextStepCost, needsBreakdownCheck, step, undoStep,
    stationCost, completeStation, payDetect, settleDetect, repairCost, repair, turnOrder, currentPlayer,
    endTurn, ranking, standings, nextStation, missionOf, eventOf, maxSteps,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.GAME_ENGINE = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
