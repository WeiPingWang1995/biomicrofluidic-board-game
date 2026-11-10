// 遊戲靜態資料：棋盤、站點、任務、角色、晶片設定、事件卡。
// 主持機、模擬器、列印檔都讀這一份，改規則只要改這裡。
(function (root) {
  'use strict';

  const RULES = {
    rounds: 6,            // 固定回合數，用來把總時間鎖在 40 分鐘內
    // 示範用：第 1 到 5 回合的共同題固定，第 6 回合起才隨機
    fixedQuestions: ['L8-01', 'L8-15', 'L8-07', 'L8-17', 'L8-23'],
    startCharge: 4,       // 開局電荷（2026-11-10 由 7 改成 4；改後還沒重跑平衡模擬）
    routeBase: 13,        // 起始路線超過這個格數，每多 1 格補 1 電荷；基本版不會觸發，進階版最長 14 步
    routeBonusMax: 5,     // 路線補償上限
    baseIncome: 2,        // 每回合基本收入
    correctIncome: 2,     // 共同題答對的額外電荷
    correctScore: 2,      // 共同題答對得分
    stationScore: 2,      // 完成中途站得分
    detectScore: 4,       // 完成檢測得分
    firstDetectBonus: 1,  // 全場第一個完成檢測的加分（可選規則）
    detectFailPenalty: 1, // 檢測答錯的扣分（可選規則）
    repairCost: 2,        // 修復一點絕緣層的電荷
    breakdownFaces: 2,    // 崩潰檢定：擲出 1 到 2 點就受損
    timers: { question: 30, action: 30, detect: 25 },
  };

  // 棋盤大小與座標：row、col 都從 0 開始
  const BOARD = {
    size: 9,
    // 位置由 tools/layout-search.js 搜尋。混合環在正中央，試劑站、分裂站在中央區，
    // 電泳站、介電泳站、檢測站靠近邊緣；葡萄糖任務 5 個起點路線最多差 1 格
    starts: [
      { row: 0, col: 0 },
      { row: 0, col: 7 },
      { row: 4, col: 8 },
      { row: 8, col: 2 },
      { row: 5, col: 0 },
    ],
    stations: [
      { type: 'MIX', row: 4, col: 4 },
      { type: 'REA', row: 2, col: 3 },
      { type: 'REA', row: 6, col: 5 },
      { type: 'SPL', row: 3, col: 6 },
      { type: 'SPL', row: 5, col: 2 },
      { type: 'EP', row: 3, col: 1 },
      { type: 'EP', row: 1, col: 8 },
      { type: 'DEP', row: 1, col: 5 },
      { type: 'DEP', row: 8, col: 0 },
      { type: 'DET', row: 8, col: 8 },
      { type: 'DET', row: 7, col: 3 },
      { type: 'DET', row: 5, col: 7 },
    ],
  };

  // 顯示用英文為主：name／text／why 是英文，nameZh／textZh／whyZh 是中文翻譯
  const STATIONS = {
    REA: { name: 'Reagent', nameZh: '試劑站', cost: 2, source: '1103 p26', teach: 'The droplet merges with reagent and the reaction starts', teachZh: '液滴和試劑合併，開始反應' },
    MIX: { name: 'Mixing ring', nameZh: '混合環', cost: 2, source: '1103 p25', teach: 'Folding the droplet around a loop shortens the diffusion distance', teachZh: '沿環形路徑折疊液滴，把擴散距離變短' },
    EP: { name: 'Electrophoresis', nameZh: '電泳站', cost: 2, source: '1103 p27、1006 p15', teach: 'An electric field pulls charged particles to one end of the droplet', teachZh: '用電場把帶電粒子拉到液滴一端' },
    DEP: { name: 'Dielectrophoresis', nameZh: '介電泳站', cost: 2, source: '1006 p16、1103 p38', teach: 'A non-uniform field traps polarized particles', teachZh: '用不均勻電場抓住被極化的粒子' },
    SPL: { name: 'Splitting', nameZh: '分裂站', cost: 2, source: '1103 p17–19', teach: 'Both side electrodes switch on and cut the droplet in two', teachZh: '兩側電極通電，把液滴切成兩顆' },
    DET: { name: 'Absorbance detection', nameZh: '光學檢測站', cost: 1, source: '1103 p26', teach: 'Answer the detection question correctly to finish the mission', teachZh: '答對檢測題才算完成任務' },
  };

  // 每張任務都是「兩個中途站＋檢測」
  const MISSIONS = [
    { id: 'glucose', name: 'Glucose colorimetric assay', nameZh: '葡萄糖比色檢測', steps: ['REA', 'MIX', 'DET'], source: '1103 p26' },
    { id: 'concentrate', name: 'Electrophoretic concentration', nameZh: '電泳濃縮', steps: ['EP', 'SPL', 'DET'], source: '1103 p28' },
    { id: 'separate', name: 'Charged particle separation', nameZh: '帶電粒子分離', steps: ['EP', 'MIX', 'DET'], source: '1103 p27' },
    { id: 'cellsort', name: 'DEP cell sorting', nameZh: 'DEP 細胞分選', steps: ['DEP', 'SPL', 'DET'], source: '1006 p33' },
    { id: 'labeling', name: 'Particle labeling', nameZh: '粒子標定', steps: ['DEP', 'REA', 'DET'], source: '1103 p37–39' },
    { id: 'dilution', name: 'Sample dilution', nameZh: '樣品稀釋', steps: ['REA', 'SPL', 'DET'], source: '1103 p17' },
  ];

  const ROLES = [
    { id: 'ee', name: 'Electrical engineer', nameZh: '電機工程師', power: 'No breakdown check on step 5', powerZh: '第 5 格不用做崩潰檢定', source: '1103 p8' },
    { id: 'fab', name: 'Process engineer', nameZh: '製程工程師', power: 'Repairing the insulator costs only 1 charge', powerZh: '修復絕緣層只要 1 電荷', source: '1020 p9–10' },
    { id: 'fluid', name: 'Fluid dynamicist', nameZh: '流體力學家', power: 'Mixing ring costs 1 less, and contamination surcharges do not apply', powerZh: '混合環少 1 電荷，也不受污染格加價影響', source: '1103 p25' },
    { id: 'bio', name: 'Biologist', nameZh: '生物學家', power: 'Once per game, after a wrong detection answer, try a new question', powerZh: '檢測題答錯時可換一題再答，每局 1 次', source: '1103 p26' },
    { id: 'optic', name: 'Optoelectronics expert', nameZh: '光電專家', power: 'Once per turn, move diagonally; may pass through other droplets', powerZh: '每回合可斜走 1 次，並可穿過其他液滴', source: '1103 p32' },
  ];

  // stepCost 是當回合第 1 到 5 格各要多少電荷；第 4、5 格加價代表接觸角飽和
  const CHIPS = {
    arch: {
      open: { name: 'Open', nameZh: '開放式', effect: '+2 starting charge; splitting costs 1 more; affected by evaporation', effectZh: '開局多 2 電荷；分裂站貴 1 電荷；受蒸發事件影響', extraCharge: 2, splitDelta: 1, source: '1103 p12' },
      closed: { name: 'Closed', nameZh: '封閉式', effect: 'Splitting costs 1 less; not affected by evaporation', effectZh: '分裂站便宜 1 電荷；不受蒸發事件影響', extraCharge: 0, splitDelta: -1, source: '1103 p13、p19' },
    },
    insulator: {
      thin: { name: 'Thin insulator', nameZh: '薄絕緣層', effect: 'Step 4 costs only 1; 2 insulator points; breakdown check on steps 4 and 5', effectZh: '第 4 格只要 1 電荷；絕緣層 2 點；第 4、5 格都要做崩潰檢定', life: 2, stepCost: [1, 1, 1, 1, 3], checkFrom: 4, source: '1103 p6、p8' },
      thick: { name: 'Thick insulator', nameZh: '厚絕緣層', effect: 'Step 4 costs 2; 4 insulator points; breakdown check on step 5 only', effectZh: '第 4 格要 2 電荷；絕緣層 4 點；只有第 5 格要做崩潰檢定', life: 4, stepCost: [1, 1, 1, 2, 3], checkFrom: 5, source: '1103 p6、p8' },
    },
  };

  // when：start＝翻牌立刻結算；mods＝只在本回合生效
  const EVENTS = [
    { id: 'ac', name: 'Switch to AC drive', nameZh: '換成交流驅動', text: 'Charge no longer gets stuck in the insulator. Everyone gains 1 charge.', textZh: '電荷不再卡在絕緣層。全體多得 1 電荷。', why: 'V² makes positive and negative voltage act the same, and AC reduces charge trapping.', whyZh: 'V² 讓正負電壓效果相同，交流電可以減少電荷捕捉。', source: '1103 p6', good: true, all: { charge: 1 } },
    { id: 'trap', name: 'Charge trapping', nameZh: '電荷捕捉', text: 'DC drive traps charge in the insulator. Everyone loses 1 charge.', textZh: '直流驅動讓電荷卡在絕緣層。全體少得 1 電荷。', why: 'Trapped charge cancels the applied field.', whyZh: '被捕捉的電荷會抵銷外加電場。', source: '1103 p6', all: { charge: -1 } },
    { id: 'saturation', name: 'Contact angle saturation', nameZh: '接觸角飽和', text: 'This round, each player may move at most 3 steps.', textZh: '本回合每人最多走 3 格。', why: 'Past a point, more voltage no longer lowers the contact angle.', whyZh: '電壓再高，接觸角也不再變小。', source: '1103 p9', mods: { maxSteps: 3 } },
    { id: 'discharge', name: 'Air discharge', nameZh: '空氣放電', text: 'No one may take step 5 this round.', textZh: '本回合不能走第 5 格。', why: 'At too high a voltage, air at the droplet edge ionizes and glows, suppressing electrowetting.', whyZh: '電壓太高時，液滴邊緣的空氣游離發光，壓抑電潤濕。', source: '1103 p10', mods: { maxSteps: 4 } },
    { id: 'hysteresis', name: 'Higher hysteresis', nameZh: '遲滯變大', text: 'This round, step 1 costs 1 extra charge.', textZh: '本回合第 1 格多花 1 電荷。', why: 'The gap between advancing and receding angles widens, so the droplet is harder to push.', whyZh: '前進角和後退角差距變大，液滴更難推動。', source: '1103 p11、1027 p23', mods: { firstStepExtra: 1 } },
    { id: 'contam', name: 'Surface contamination', nameZh: '表面污染', text: 'The leading player puts contamination markers on 2 cells. For the rest of the game, entering one costs 1 extra charge.', textZh: '分數最高的玩家選 2 格放上污染標記，本局之後走進去多花 1 電荷。', why: 'Contamination ruins the long-term stability of the hydrophobic surface.', whyZh: '疏水面的長期穩定性會被污染破壞。', source: '1103 p42', physical: true },
    { id: 'electrolysis', name: 'Electrolysis bubbles', nameZh: '電解氣泡', text: 'Players with only 1 insulator point left lose 2 charge.', textZh: '絕緣層只剩 1 點的玩家少得 2 電荷。', why: 'The insulator blocks current; water electrolyzes at about 2 V.', whyZh: '絕緣層擋住電流，水約 2 V 就會電解。', source: '1103 p12、p14', lowLife: { charge: -2 } },
    { id: 'oil', name: 'Silicone oil fill', nameZh: '矽油填充', text: 'This round, every station costs 1 less (minimum 1).', textZh: '本回合所有站點少花 1 電荷，最低 1。', why: 'The glucose chip operates droplets immersed in 1 cSt silicone oil.', whyZh: '葡萄糖檢測晶片讓液滴泡在 1 cSt 矽油裡操作。', source: '1103 p26', good: true, mods: { stationDelta: -1 } },
    { id: 'dispense', name: 'Dispensing jam', nameZh: '分注卡關', text: 'Players who have not finished their first station pay 1 extra at stations this round.', textZh: '還沒完成第一站的玩家，本回合站點多花 1 電荷。', why: 'Dispensing is the most critical EWOD step; the extra surface costs energy.', whyZh: '分注是 EWOD 最關鍵的一步，多出來的表面要花能量。', source: '1103 p20', mods: { firstStationExtra: 1 } },
    { id: 'evaporation', name: 'Droplet evaporation', nameZh: '液滴蒸發', text: 'Players with an open chip lose 2 charge.', textZh: '開放式晶片的玩家少得 2 電荷。', why: 'Open droplets touch the air directly; closed chips are shielded by the top plate and surrounding medium. This card is extra material, not on the slides.', whyZh: '開放式液滴直接接觸空氣，封閉式有上板和周圍介質保護。這張是課外補充，投影片沒有寫。', source: 'Extra 課外補充', extra: true, openChip: { charge: -2 } },
    { id: 'scaling', name: 'Scaling down', nameZh: '尺度縮小', text: 'This round, a correct shared answer earns 1 extra charge.', textZh: '本回合共同題答對多得 1 電荷。', why: 'As size shrinks, surface forces matter more than body forces.', whyZh: '尺度變小時，表面力比體積力更重要。', source: '1006 p50', good: true, mods: { correctBonus: 1 } },
    { id: 'cv', name: 'Droplet volume error', nameZh: '液滴體積誤差', text: 'Everyone rolls a die. On 1, lose 1 charge; on 6, gain 1 charge.', textZh: '全體擲骰。1 點少得 1 電荷，6 點多得 1 電荷。', why: 'The coefficient of variation of EWOD droplet volume is often about 20%.', whyZh: 'EWOD 的液滴體積變異係數通常約 20%。', source: '1103 p42', physical: true },
  ];

  // 基本版：固定任務與晶片，不用角色和事件卡；進階版的資料都保留在上面
  const BASIC = { mission: 'glucose', arch: 'closed', insulator: 'thick', role: 'none' };

  // 可選計分規則：開局時由主持機開關，開始後不改。
  // 基本版預設拿掉首位分、改用檢測答錯扣分；進階版維持原本規則
  const OPTIONS = {
    basic: { firstBonus: false, failPenalty: true },
    full: { firstBonus: true, failPenalty: false },
  };

  const api = { RULES, BOARD, STATIONS, MISSIONS, ROLES, CHIPS, EVENTS, BASIC, OPTIONS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.GAME_DATA = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
