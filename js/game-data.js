// 遊戲靜態資料：棋盤、站點、任務、角色、晶片設定、事件卡。
// 主持機、模擬器、列印檔都讀這一份，改規則只要改這裡。
(function (root) {
  'use strict';

  const RULES = {
    rounds: 6,            // 固定回合數，用來把總時間鎖在 40 分鐘內
    startCharge: 3,       // 開局電荷
    routeBase: 9,         // 起始路線超過這個格數，每多 1 格補 1 電荷
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

  const STATIONS = {
    REA: { name: '試劑站', en: 'Reagent', cost: 2, source: '1103 p26', teach: '液滴和試劑合併，開始反應' },
    MIX: { name: '混合環', en: 'Mixing ring', cost: 2, source: '1103 p25', teach: '沿環形路徑折疊液滴，把擴散距離變短' },
    EP: { name: '電泳站', en: 'Electrophoresis', cost: 2, source: '1103 p27、1006 p15', teach: '用電場把帶電粒子拉到液滴一端' },
    DEP: { name: '介電泳站', en: 'Dielectrophoresis', cost: 2, source: '1006 p16、1103 p38', teach: '用不均勻電場抓住被極化的粒子' },
    SPL: { name: '分裂站', en: 'Splitting', cost: 2, source: '1103 p17–19', teach: '兩側電極通電，把液滴切成兩顆' },
    DET: { name: '光學檢測站', en: 'Absorbance detection', cost: 1, source: '1103 p26', teach: '答對檢測題才算完成任務' },
  };

  // 每張任務都是「兩個中途站＋檢測」
  const MISSIONS = [
    { id: 'glucose', name: '葡萄糖比色檢測', steps: ['REA', 'MIX', 'DET'], source: '1103 p26' },
    { id: 'concentrate', name: '電泳濃縮', steps: ['EP', 'SPL', 'DET'], source: '1103 p28' },
    { id: 'separate', name: '帶電粒子分離', steps: ['EP', 'MIX', 'DET'], source: '1103 p27' },
    { id: 'cellsort', name: 'DEP 細胞分選', steps: ['DEP', 'SPL', 'DET'], source: '1006 p33' },
    { id: 'labeling', name: '粒子標定', steps: ['DEP', 'REA', 'DET'], source: '1103 p37–39' },
    { id: 'dilution', name: '樣品稀釋', steps: ['REA', 'SPL', 'DET'], source: '1103 p17' },
  ];

  const ROLES = [
    { id: 'ee', name: '電機工程師', power: '第 5 格不用做崩潰檢定', source: '1103 p8' },
    { id: 'fab', name: '製程工程師', power: '修復絕緣層只要 1 電荷', source: '1020 p9–10' },
    { id: 'fluid', name: '流體力學家', power: '混合環少 1 電荷，也不受污染格加價影響', source: '1103 p25' },
    { id: 'bio', name: '生物學家', power: '檢測題答錯時可換一題再答，每局 1 次', source: '1103 p26' },
    { id: 'optic', name: '光電專家', power: '每回合可斜走 1 次，並可穿過其他液滴', source: '1103 p32' },
  ];

  // stepCost 是當回合第 1 到 5 格各要多少電荷；第 4、5 格加價代表接觸角飽和
  const CHIPS = {
    arch: {
      open: { name: '開放式', effect: '開局多 2 電荷；分裂站貴 1 電荷；受蒸發事件影響', extraCharge: 2, splitDelta: 1, source: '1103 p12' },
      closed: { name: '封閉式', effect: '分裂站便宜 1 電荷；不受蒸發事件影響', extraCharge: 0, splitDelta: -1, source: '1103 p13、p19' },
    },
    insulator: {
      thin: { name: '薄絕緣層', effect: '第 4 格只要 1 電荷；絕緣層 2 點；第 4、5 格都要做崩潰檢定', life: 2, stepCost: [1, 1, 1, 1, 3], checkFrom: 4, source: '1103 p6、p8' },
      thick: { name: '厚絕緣層', effect: '第 4 格要 2 電荷；絕緣層 4 點；只有第 5 格要做崩潰檢定', life: 4, stepCost: [1, 1, 1, 2, 3], checkFrom: 5, source: '1103 p6、p8' },
    },
  };

  // when：start＝翻牌立刻結算；mods＝只在本回合生效
  const EVENTS = [
    { id: 'ac', name: '換成交流驅動', text: '電荷不再卡在絕緣層。全體多得 1 電荷。', why: 'V² 讓正負電壓效果相同，交流電可以減少電荷捕捉。', source: '1103 p6', good: true, all: { charge: 1 } },
    { id: 'trap', name: '電荷捕捉', text: '直流驅動讓電荷卡在絕緣層。全體少得 1 電荷。', why: '被捕捉的電荷會抵銷外加電場。', source: '1103 p6', all: { charge: -1 } },
    { id: 'saturation', name: '接觸角飽和', text: '本回合每人最多走 3 格。', why: '電壓再高，接觸角也不再變小。', source: '1103 p9', mods: { maxSteps: 3 } },
    { id: 'discharge', name: '空氣放電', text: '本回合不能走第 5 格。', why: '電壓太高時，液滴邊緣的空氣游離發光，壓抑電潤濕。', source: '1103 p10', mods: { maxSteps: 4 } },
    { id: 'hysteresis', name: '遲滯變大', text: '本回合第 1 格多花 1 電荷。', why: '前進角和後退角差距變大，液滴更難推動。', source: '1103 p11、1027 p23', mods: { firstStepExtra: 1 } },
    { id: 'contam', name: '表面污染', text: '分數最高的玩家選 2 格放上污染標記，本局之後走進去多花 1 電荷。', why: '疏水面的長期穩定性會被污染破壞。', source: '1103 p42', physical: true },
    { id: 'electrolysis', name: '電解氣泡', text: '絕緣層只剩 1 點的玩家少得 2 電荷。', why: '絕緣層擋住電流，水約 2 V 就會電解。', source: '1103 p12、p14', lowLife: { charge: -2 } },
    { id: 'oil', name: '矽油填充', text: '本回合所有站點少花 1 電荷，最低 1。', why: '葡萄糖檢測晶片讓液滴泡在 1 cSt 矽油裡操作。', source: '1103 p26', good: true, mods: { stationDelta: -1 } },
    { id: 'dispense', name: '分注卡關', text: '還沒完成第一站的玩家，本回合站點多花 1 電荷。', why: '分注是 EWOD 最關鍵的一步，多出來的表面要花能量。', source: '1103 p20', mods: { firstStationExtra: 1 } },
    { id: 'evaporation', name: '液滴蒸發', text: '開放式晶片的玩家少得 2 電荷。', why: '開放式液滴直接接觸空氣，封閉式有上板和周圍介質保護。這張是課外補充，投影片沒有寫。', source: '課外補充', extra: true, openChip: { charge: -2 } },
    { id: 'scaling', name: '尺度縮小', text: '本回合共同題答對多得 1 電荷。', why: '尺度變小時，表面力比體積力更重要。', source: '1006 p50', good: true, mods: { correctBonus: 1 } },
    { id: 'cv', name: '液滴體積誤差', text: '全體擲骰。1 點少得 1 電荷，6 點多得 1 電荷。', why: 'EWOD 的液滴體積變異係數通常約 20%。', source: '1103 p42', physical: true },
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
