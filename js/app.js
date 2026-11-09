// 主持機畫面：只有一台裝置，玩家把答題旗放到 A 到 D 答題板，主持人在這裡記錄結果。
(function () {
  'use strict';

  const { RULES, STATIONS, ROLES, CHIPS, OPTIONS } = window.GAME_DATA;
  const QUESTIONS = window.QUESTIONS;
  const E = window.GAME_ENGINE;
  const STORE_KEY = 'electrode-gambit-v1';
  const LETTERS = ['A', 'B', 'C', 'D'];
  const app = document.getElementById('app');

  const defaultSetup = () => ({
    mode: 'basic',
    options: { ...OPTIONS.basic },
    players: ROLES.map((role, i) => ({
      name: `玩家 ${i + 1}`,
      role: role.id,
      arch: i % 2 ? 'closed' : 'open',
      insulator: i < 2 ? 'thin' : 'thick',
    })),
  });

  // 整局狀態都放這裡，存進瀏覽器，重新整理不會掉資料
  let state = { screen: 'setup', setup: defaultSetup(), game: null, card: null, detect: null, log: [], note: '', noteBad: false, timerEnd: null, confirmReset: false };

  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (err) { /* 無法儲存時照常遊戲 */ }
  }
  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) state = { ...state, ...JSON.parse(raw) };
    } catch (err) { /* 舊資料壞掉就重新開始 */ }
  }

  const esc = (text) => String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const lectureLabel = (q) => `${q.lec} ${q.page}`;

  // 選題：依回合決定難度，優先挑出現次數最少的週次，讓題目涵蓋各週
  function pickQuestion(game, diffs) {
    const used = new Set(state.log.map((entry) => entry.id));
    // 固定題保留給指定回合，不讓隨機抽題先用掉
    const pool = QUESTIONS.filter((q) => !used.has(q.id) && !RULES.fixedQuestions.includes(q.id));
    const byDiff = pool.filter((q) => diffs.includes(q.diff));
    const candidates = byDiff.length ? byDiff : pool.length ? pool : QUESTIONS;
    const seen = {};
    state.log.forEach((entry) => { seen[entry.lec] = (seen[entry.lec] || 0) + 1; });
    const least = Math.min(...candidates.map((q) => seen[q.lec] || 0));
    const fresh = candidates.filter((q) => (seen[q.lec] || 0) === least);
    return fresh[Math.floor(Math.random() * fresh.length)];
  }

  const roundDiffs = (round) => (round <= 2 ? [1] : round <= 4 ? [2] : [2, 3]);

  function makeCard(question) {
    const options = E.shuffle(question.a.map((text, index) => ({ text, right: index === 0, note: index > 0 && question.wrong ? question.wrong[index - 1] : '' })), Math.random);
    return { id: question.id, options, revealed: false, correct: [], openWrong: null };
  }
  const questionOf = (card) => QUESTIONS.find((q) => q.id === card.id);

  const setupMode = () => state.setup.mode || 'basic';
  const isBasic = () => !!state.game && state.game.mode === 'basic';
  // 舊存檔的設定沒有 options，用該版本的預設值補上
  const setupOptions = () => {
    if (!state.setup.options) state.setup.options = { ...OPTIONS[setupMode()] };
    return state.setup.options;
  };

  function startTimer(seconds) { state.timerEnd = Date.now() + seconds * 1000; }

  function setNote(text, bad = false) { state.note = text; state.noteBad = bad; }

  // ===== 流程控制 =====
  const actions = {
    setMode(el) {
      state.setup.mode = el.dataset.mode;
      state.setup.options = { ...OPTIONS[el.dataset.mode] };
    },
    toggleOption(el) {
      const options = setupOptions();
      options[el.dataset.option] = !options[el.dataset.option];
    },
    setField(el) {
      const { seat, field } = el.dataset;
      state.setup.players[Number(seat)][field] = el.value;
      save();
    },
    drawSeats() {
      const names = E.shuffle(state.setup.players.map((p) => p.name), Math.random);
      state.setup.players.forEach((p, i) => { p.name = names[i]; });
    },
    start() {
      state.game = E.createGame(state.setup.players, Math.random, setupMode(), setupOptions());
      state.log = [];
      state.screen = 'game';
      E.startRound(state.game);
      setNote('');
    },
    toQuestion() {
      state.game.phase = 'question';
      const fixedId = RULES.fixedQuestions[state.game.round - 1];
      const fixed = fixedId && QUESTIONS.find((q) => q.id === fixedId);
      state.card = makeCard(fixed || pickQuestion(state.game, roundDiffs(state.game.round)));
      startTimer(RULES.timers.question);
    },
    reveal() {
      state.card.revealed = true;
      state.game.phase = 'reveal';
      state.timerEnd = null;
    },
    toggleCorrect(el) {
      const seat = Number(el.dataset.seat);
      const list = state.card.correct;
      const at = list.indexOf(seat);
      if (at >= 0) list.splice(at, 1); else list.push(seat);
    },
    // 主持人點桌上有旗子的錯誤選項，顯示那個選項的說明
    openWrong(el) {
      const card = state.detect ? state.detect.card : state.card;
      const index = Number(el.dataset.index);
      card.openWrong = card.openWrong === index ? null : index;
    },
    openVideo(el) { state.video = el.dataset.src; },
    closeVideo() { state.video = null; },
    settle() {
      const q = questionOf(state.card);
      E.settleQuestion(state.game, state.card.correct);
      state.log.push({ id: q.id, lec: q.lec, right: state.card.correct.length, total: state.game.players.length });
      state.game.phase = 'action';
      setNote('');
      startTimer(RULES.timers.action);
    },
    step() {
      const p = E.currentPlayer(state.game);
      const check = E.needsBreakdownCheck(p);
      const roll = 1 + Math.floor(Math.random() * 6);
      const result = E.step(state.game, p, roll);
      if (!result.ok) { setNote(result.reason, true); return; }
      if (!result.check) { setNote(`走了第 ${p.stepsThisTurn} 格，花 ${result.cost} 電荷`); return; }
      if (!check) return;
      if (result.damaged) {
        setNote(p.pendingSkip ? `崩潰檢定擲出 ${roll}：絕緣層崩潰，下回合暫停一次` : `崩潰檢定擲出 ${roll}：絕緣層受損 1 點`, true);
      } else {
        setNote(`崩潰檢定擲出 ${roll}：安全過關`);
      }
    },
    undoStep() {
      const p = E.currentPlayer(state.game);
      if (E.undoStep(state.game, p)) setNote('退回 1 格，電荷已退還');
    },
    station() {
      const p = E.currentPlayer(state.game);
      const name = STATIONS[E.nextStation(p)].name;
      const result = E.completeStation(state.game, p);
      setNote(result.ok ? `完成${name}，得 ${RULES.stationScore} 分` : result.reason, !result.ok);
    },
    detect() {
      const p = E.currentPlayer(state.game);
      const result = E.payDetect(state.game, p);
      if (!result.ok) { setNote(result.reason, true); return; }
      openDetect(p.seat);
    },
    detectReveal() { state.detect.card.revealed = true; state.timerEnd = null; },
    detectResult(el) {
      const correct = el.dataset.right === '1';
      const p = state.game.players[state.detect.seat];
      const q = questionOf(state.detect.card);
      state.log.push({ id: q.id, lec: q.lec, right: correct ? 1 : 0, total: 1 });
      if (!correct && p.retries > 0) {
        p.retries -= 1;
        openDetect(p.seat);
        setNote('生物學家能力：換一題再答');
        return;
      }
      const result = E.settleDetect(state.game, p, correct);
      const failText = result.penalty ? `檢測失敗，扣 ${result.penalty} 分，下回合可再付費重試` : '檢測失敗，下回合可再付費重試';
      setNote(result.done ? `檢測成功，得 ${RULES.detectScore} 分，${isBasic() ? '再做一次同一張任務' : '抽下一張任務'}` : failText, !result.done);
      state.detect = null;
      startTimer(RULES.timers.action);
    },
    repair() {
      const result = E.repair(E.currentPlayer(state.game));
      setNote(result.ok ? `修復 1 點絕緣層，花 ${result.cost} 電荷` : result.reason, !result.ok);
    },
    adjust(el) {
      const p = state.game.players[Number(el.dataset.seat)];
      p.charge = Math.max(0, p.charge + Number(el.dataset.delta));
    },
    endTurn() {
      setNote('');
      if (E.endTurn(state.game)) { startTimer(RULES.timers.action); return; }
      state.timerEnd = null;
      if (state.game.round >= RULES.rounds) { state.screen = 'end'; return; }
      E.startRound(state.game);
    },
    askReset() { state.confirmReset = true; },
    cancelReset() { state.confirmReset = false; },
    reset() {
      state = { screen: 'setup', setup: state.setup, game: null, card: null, detect: null, log: [], note: '', noteBad: false, timerEnd: null, confirmReset: false };
    },
  };

  function openDetect(seat) {
    state.detect = { seat, card: makeCard(pickQuestion(state.game, [1, 2])) };
    startTimer(RULES.timers.detect);
  }

  // ===== 畫面 =====
  const pads = (game) => Array.from({ length: RULES.rounds }, (_, i) => {
    const n = i + 1;
    const cls = n < game.round ? 'done' : n === game.round ? 'now' : '';
    return `<span class="pad ${cls}">${n}</span>`;
  }).join('');

  function topbar() {
    const game = state.game;
    const names = { event: isBasic() ? '回合開始' : '事件', question: '共同題', reveal: '對答案', action: '行動' };
    return `<header class="topbar">
      <h1>電極棋局</h1>
      ${game ? `<div class="rounds" aria-label="第 ${game.round} 回合，共 ${RULES.rounds} 回合">${pads(game)}</div>
      <div class="phase">階段 <b>${names[game.phase] || ''}</b></div>` : '<div class="phase">主持機</div>'}
    </header>`;
  }

  function playerCard(p, activeSeat, showAdjust) {
    const next = E.nextStation(p);
    const lifeText = '●'.repeat(p.life) + '○'.repeat(Math.max(0, p.maxLife - p.life));
    return `<article class="player ${p.seat === activeSeat ? 'active' : ''}">
      <span class="dot" style="--c:var(--p${p.seat})"></span>
      <span class="name">${esc(p.name)}</span>
      <span class="score">${p.score}</span>
      <div class="meta">
        <span class="mono">⚡${p.charge}</span>
        <span class="life ${p.life <= 1 ? 'low' : ''}" aria-label="絕緣層 ${p.life} 點">${lifeText}</span>
        <span>下一站 ${next ? STATIONS[next].name : '無'}</span>
        ${p.skipNext || p.pendingSkip ? '<span style="color:var(--danger)">暫停一次</span>' : ''}
      </div>
      ${showAdjust ? `<div class="adjust"><button data-act="adjust" data-seat="${p.seat}" data-delta="-1" aria-label="${esc(p.name)} 減 1 電荷">−1 ⚡</button><button data-act="adjust" data-seat="${p.seat}" data-delta="1" aria-label="${esc(p.name)} 加 1 電荷">+1 ⚡</button></div>` : ''}
    </article>`;
  }

  function sidebar() {
    const game = state.game;
    const active = game.phase === 'action' ? E.currentPlayer(game).seat : -1;
    const adjust = game.phase === 'event';
    return `<aside class="board-list" aria-label="計分板">
      ${game.players.map((p) => playerCard(p, active, adjust)).join('')}
      <div class="actions">
        ${state.confirmReset
          ? '<span class="muted">確定結束這局？</span><button class="danger" data-act="reset">結束</button><button data-act="cancelReset">繼續玩</button>'
          : '<button data-act="askReset">結束這局</button>'}
      </div>
    </aside>`;
  }

  function optionList(card) {
    return `<div class="options${card.revealed ? ' revealed' : ''}">${card.options.map((opt, i) => {
      const cls = card.revealed ? (opt.right ? 'right' : 'wrong') : '';
      const body = `<span class="letter">${LETTERS[i]}</span><span>${esc(opt.text)}</span>`;
      // 有錯誤說明的題目，公布後錯誤選項可以點開
      if (card.revealed && opt.note) {
        return `<button class="option ${cls} tap" data-act="openWrong" data-index="${i}" aria-pressed="${card.openWrong === i}">${body}</button>`;
      }
      return `<div class="option ${cls}">${body}</div>`;
    }).join('')}</div>`;
  }

  // 公布答案後的解說：正解的圖與文字；點開錯誤選項時加上說明和影片
  function explanation(card, q) {
    const opened = card.openWrong === null ? null : card.options[card.openWrong];
    const hint = q.en ? (q.wrong ? 'Tap a wrong option that has a flag on it to see why it is wrong.' : '') : '';
    return `<div class="explain">
      ${q.img ? `<img class="explain-img" src="${esc(q.img)}" alt="${esc(q.why)}">` : ''}
      <div class="explain-text">
        <p class="why">${esc(q.why)} <span class="source">${esc(lectureLabel(q))}</span></p>
        ${hint ? `<p class="muted">${esc(hint)}</p>` : ''}
        ${opened ? `<div class="wrong-note"><b>${LETTERS[card.openWrong]}. ${esc(opened.text)}</b><p>${esc(opened.note)}</p>
          ${q.video ? `<button class="primary" data-act="openVideo" data-src="${esc(q.video)}">Watch the video</button>` : ''}</div>` : ''}
      </div>
    </div>`;
  }

  function videoOverlay() {
    return `<div class="video-overlay"><video src="${esc(state.video)}" controls autoplay playsinline></video>
      <button class="primary" data-act="closeVideo">Close</button></div>`;
  }

  function eventStage() {
    const event = E.eventOf(state.game);
    // 基本版沒有事件卡，這一步只發基本收入
    if (!event) {
      return `<div class="eyebrow">第 ${state.game.round} 回合</div>
        <h2>回合開始</h2>
        <p class="lead">全體基本收入 +${RULES.baseIncome} 已自動入帳。</p>
        <div class="actions"><button class="primary" data-act="toQuestion">出題</button></div>`;
    }
    return `<div class="eyebrow">第 ${state.game.round} 回合事件${event.good ? ' · 好消息' : ''}</div>
      <h2>${esc(event.name)}</h2>
      <p class="lead">${esc(event.text)}</p>
      <p class="why muted">${esc(event.why)} <span class="source">${esc(event.source)}</span></p>
      <p class="muted">全體基本收入 +${RULES.baseIncome} 已自動入帳。${event.physical ? '這張卡要在桌上處理，電荷可用右側按鈕調整。' : ''}</p>
      <div class="actions"><button class="primary" data-act="toQuestion">出題</button></div>`;
  }

  function questionStage() {
    const card = state.card;
    const q = questionOf(card);
    return `<div class="actions" style="justify-content:space-between">
        <span class="eyebrow">共同題 · ${esc(q.topic)}</span>
        <span class="timer" data-timer>--</span>
      </div>
      <p class="question">${esc(q.q)}</p>
      ${optionList(card)}
      <p class="muted">倒數結束後，大家同時把答題旗放到答題板上。</p>
      <div class="actions"><button class="primary" data-act="reveal">公布答案</button></div>`;
  }

  function revealStage() {
    const card = state.card;
    const q = questionOf(card);
    const bonus = RULES.correctIncome + (((E.eventOf(state.game) || {}).mods || {}).correctBonus || 0);
    return `<div class="eyebrow">對答案 · 答對 +${bonus} 電荷、+${RULES.correctScore} 分</div>
      <p class="question compact">${esc(q.q)}</p>
      ${optionList(card)}
      ${explanation(card, q)}
      <div><div class="muted" style="margin-bottom:6px">點選答對的玩家</div>
      <div class="pick">${state.game.players.map((p) => `<button data-act="toggleCorrect" data-seat="${p.seat}" aria-pressed="${card.correct.includes(p.seat)}"><span class="dot" style="--c:var(--p${p.seat})"></span>${esc(p.name)}</button>`).join('')}</div></div>
      <div class="actions"><button class="primary" data-act="settle">結算，進入行動</button></div>`;
  }

  function actionStage() {
    const game = state.game;
    const p = E.currentPlayer(game);
    const mission = E.missionOf(p);
    const role = ROLES.find((r) => r.id === p.role);
    const nextCost = E.nextStepCost(game, p);
    const type = E.nextStation(p);
    const station = type ? STATIONS[type] : null;
    const cost = type ? E.stationCost(game, p, type) : 0;
    const limit = E.maxSteps(game);
    const checkFrom = CHIPS.insulator[p.insulator].checkFrom;
    const stepPads = Array.from({ length: 5 }, (_, i) => {
      const risk = i + 1 >= checkFrom && p.role !== 'ee';
      const used = i < p.stepsThisTurn;
      return `<span class="pad ${used ? 'used' : ''} ${risk ? 'risk' : ''}" style="${i >= limit ? 'opacity:.3' : ''}">${CHIPS.insulator[p.insulator].stepCost[i]}</span>`;
    }).join('');

    if (p.skipNext && p.stepsThisTurn === 0) {
      return `<div class="eyebrow">行動</div><h2>${esc(p.name)} 暫停一次</h2>
        <p class="lead">絕緣層崩潰，等待修復。下回合恢復 1 點繼續。</p>
        <div class="actions"><button class="primary" data-act="endTurn">下一位</button></div>`;
    }
    return `<div class="actions" style="justify-content:space-between">
        <span class="eyebrow">行動${role ? ` · ${esc(role.name)}` : ''}</span>
        <span class="timer" data-timer>--</span>
      </div>
      <h2><span class="dot" style="--c:var(--p${p.seat});display:inline-block;vertical-align:-2px"></span> ${esc(p.name)}</h2>
      ${mission ? `<div class="steps"><b>${esc(mission.name)}</b>${mission.steps.map((s, i) => `<span class="chip ${i < p.stepIndex ? 'done' : i === p.stepIndex ? 'next' : ''}">${STATIONS[s].name}</span>`).join('')}</div>` : '<p class="muted">任務牌已用完</p>'}
      ${role ? `<div class="muted">${esc(role.power)}</div>` : ''}
      <div><div class="muted" style="margin-bottom:6px">本回合步數，數字是該格電荷，紅框要做崩潰檢定</div><div class="stepbar">${stepPads}</div></div>
      <div class="actions">
        <button class="primary" data-act="step" ${nextCost === null || p.charge < nextCost ? 'disabled' : ''}>走 1 格${nextCost === null ? '' : `（⚡${nextCost}）`}</button>
        <button data-act="undoStep" ${p.stepsThisTurn === 0 ? 'disabled' : ''}>退 1 格</button>
        ${type === 'DET'
          ? `<button data-act="detect" ${p.stationThisTurn || p.charge < cost ? 'disabled' : ''}>開始檢測（⚡${cost}）</button>`
          : station ? `<button data-act="station" ${p.stationThisTurn || p.charge < cost ? 'disabled' : ''}>完成${station.name}（⚡${cost}）</button>` : ''}
        <button data-act="repair" ${p.life >= p.maxLife || p.charge < E.repairCost(p) ? 'disabled' : ''}>修絕緣層（⚡${E.repairCost(p)}）</button>
      </div>
      <p class="muted">液滴不能停在別人所在的格子，站點可以重疊。</p>
      <p class="note ${state.noteBad ? 'bad' : ''}" role="status">${esc(state.note)}</p>
      <div class="actions"><button data-act="endTurn">結束回合，下一位</button></div>`;
  }

  function detectStage() {
    const { seat, card } = state.detect;
    const q = questionOf(card);
    const p = state.game.players[seat];
    return `<div class="actions" style="justify-content:space-between">
        <span class="eyebrow">光學檢測 · ${esc(p.name)} 作答</span>
        <span class="timer" data-timer>--</span>
      </div>
      <p class="question">${esc(q.q)}</p>
      ${optionList(card)}
      ${card.revealed ? `${explanation(card, q)}
        <div class="actions"><button class="primary" data-act="detectResult" data-right="1">答對</button><button data-act="detectResult" data-right="0">答錯</button></div>`
        : '<div class="actions"><button class="primary" data-act="detectReveal">公布答案</button></div>'}`;
  }

  function optionRow(key, label) {
    const on = !!setupOptions()[key];
    return `<div class="option-row"><span>${label}</span><button class="${on ? 'primary' : ''}" data-act="toggleOption" data-option="${key}" aria-pressed="${on}">${on ? '開' : '關'}</button></div>`;
  }

  function setupScreen() {
    const basic = setupMode() === 'basic';
    const rows = state.setup.players.map((p, i) => `<div class="setup-row ${basic ? 'basic' : ''}">
      <span class="dot" style="--c:var(--p${i})"></span>
      <input id="name-${i}" aria-label="座位 ${i + 1} 姓名" data-change="setField" data-seat="${i}" data-field="name" value="${esc(p.name)}">
      ${basic ? '' : `<select id="role-${i}" aria-label="座位 ${i + 1} 角色" data-change="setField" data-seat="${i}" data-field="role">${ROLES.map((r) => `<option value="${r.id}" ${r.id === p.role ? 'selected' : ''}>${r.name}</option>`).join('')}</select>`}
      ${basic ? '' : `<select id="arch-${i}" aria-label="座位 ${i + 1} 架構" data-change="setField" data-seat="${i}" data-field="arch">${Object.entries(CHIPS.arch).map(([k, v]) => `<option value="${k}" ${k === p.arch ? 'selected' : ''}>${v.name}</option>`).join('')}</select>`}
      ${basic ? '' : `<select id="ins-${i}" aria-label="座位 ${i + 1} 絕緣層" data-change="setField" data-seat="${i}" data-field="insulator">${Object.entries(CHIPS.insulator).map(([k, v]) => `<option value="${k}" ${k === p.insulator ? 'selected' : ''}>${v.name}</option>`).join('')}</select>`}
    </div>`).join('');
    const duplicate = !basic && new Set(state.setup.players.map((p) => p.role)).size < state.setup.players.length;
    return `<section class="stage">
      <div class="eyebrow">開局設定 · 5 人 · ${RULES.rounds} 回合</div>
      <h2>每人經營一片 EWOD 晶片，把液滴送到檢測站</h2>
      <div class="actions">
        <button class="${basic ? 'primary' : ''}" data-act="setMode" data-mode="basic" aria-pressed="${basic}">基本版</button>
        <button class="${basic ? '' : 'primary'}" data-act="setMode" data-mode="full" aria-pressed="${!basic}">進階版</button>
      </div>
      <p class="muted">${basic ? '全員做葡萄糖比色檢測，固定封閉式、厚絕緣層，沒有角色和事件卡。' : '輸入姓名，角色每人一個。架構和絕緣層由玩家自己選，選擇本身就是工程取捨。'}</p>
      <div class="setup-table">${rows}</div>
      <h3 style="margin:0">可選計分規則</h3>
      <div class="rule-options">${optionRow('failPenalty', `檢測答錯 −${RULES.detectFailPenalty} 分`)}${optionRow('firstBonus', `全場第一個完成檢測 +${RULES.firstDetectBonus} 分`)}</div>
      <p class="muted">開局時決定，遊戲開始後不能改。</p>
      ${duplicate ? '<p class="note bad">有角色重複，每人要選不同角色。</p>' : ''}
      <div class="actions">
        <button data-act="drawSeats">抽籤換座位</button>
        <button class="primary" data-act="start" ${duplicate ? 'disabled' : ''}>開始遊戲</button>
      </div>
    </section>`;
  }

  function endScreen() {
    const game = state.game;
    const table = E.standings(game);
    const winners = table.filter((row) => row.rank === 1).map((row) => row.player.name);
    const rows = table.map(({ player: p, rank }) => `<tr><td class="num">${rank}</td><td>${esc(p.name)}</td><td class="num">${p.score}</td><td class="num">${p.correct}</td><td class="num">${p.missionsDone}</td><td class="num">${p.stationsDone}</td></tr>`).join('');
    const review = state.log.map((entry) => {
      const q = QUESTIONS.find((item) => item.id === entry.id);
      return `<tr><td>${esc(q.q)}</td><td>${esc(q.a[0])}</td><td class="num">${entry.right}/${entry.total}</td><td>${esc(lectureLabel(q))}</td></tr>`;
    }).join('');
    return `<section class="stage">
      <div class="eyebrow">遊戲結束</div>
      <h2>${winners.length > 1 ? '並列第一' : '第一名'} ${esc(winners.join('、'))}</h2>
      ${winners.length > 1 ? '<p class="muted">要分出勝負時，可由主持人加賽一題搶答。</p>' : ''}
      <div class="table-wrap"><table><thead><tr><th>名次</th><th>玩家</th><th>分數</th><th>答對</th><th>任務</th><th>中途站</th></tr></thead><tbody>${rows}</tbody></table></div>
      <h3 style="margin:0">本局題目回顧</h3>
      <div class="table-wrap"><table><thead><tr><th>題目</th><th>答案</th><th>答對</th><th>出處</th></tr></thead><tbody>${review}</tbody></table></div>
      <div class="actions"><button class="primary" data-act="reset">再開一局</button></div>
    </section>`;
  }

  function render() {
    let html = topbar();
    if (state.screen === 'setup') html = topbar() + setupScreen();
    else if (state.screen === 'end') html += endScreen();
    else {
      const stages = { event: eventStage, question: questionStage, reveal: revealStage, action: actionStage };
      const stage = state.detect ? detectStage() : stages[state.game.phase]();
      html += `<div class="layout"><section class="stage">${stage}</section>${sidebar()}</div>`;
    }
    app.innerHTML = html + (state.video ? videoOverlay() : '');
    tick();
  }

  // 倒數只更新數字，不重畫整頁
  function tick() {
    const el = document.querySelector('[data-timer]');
    if (!el || !state.timerEnd) { if (el) el.textContent = ''; return; }
    const left = Math.max(0, Math.ceil((state.timerEnd - Date.now()) / 1000));
    el.textContent = `${left}s`;
    el.classList.toggle('low', left <= 5);
  }

  app.addEventListener('click', (event) => {
    const el = event.target.closest('[data-act]');
    if (!el || el.disabled) return;
    actions[el.dataset.act](el);
    save();
    render();
  });
  app.addEventListener('change', (event) => {
    const el = event.target.closest('[data-change]');
    if (!el) return;
    actions[el.dataset.change](el);
    render();
  });

  load();
  render();
  setInterval(tick, 500);

  // 離線功能：不支援 service worker 的環境直接略過
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
