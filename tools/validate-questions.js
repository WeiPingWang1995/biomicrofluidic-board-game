// 題庫機械檢查：格式、重複、答案長度偏差。內容對錯仍要人工核對講義。
const path = require('path');
const QUESTIONS = require(path.join(__dirname, '../js/questions.js'));

const problems = [];
const ids = new Set();
const count = (key, map) => { map[key] = (map[key] || 0) + 1; };
const byLecture = {}; const byDiff = {};
let longestCorrect = 0;

QUESTIONS.forEach((item) => {
  if (ids.has(item.id)) problems.push(`${item.id} 重複`);
  ids.add(item.id);
  ['lec', 'page', 'topic', 'q', 'why'].forEach((key) => { if (!item[key]) problems.push(`${item.id} 缺 ${key}`); });
  if (!Array.isArray(item.a) || item.a.length !== 4) problems.push(`${item.id} 選項不是 4 個`);
  if (new Set(item.a).size !== 4) problems.push(`${item.id} 選項重複`);
  if (![1, 2, 3].includes(item.diff)) problems.push(`${item.id} 難度錯誤`);
  if (item.a.some((text) => /以上皆|皆非/.test(text))) problems.push(`${item.id} 有以上皆是類選項`);
  // 英文為主：題目、選項用英文長度上限；中文翻譯放在 zh，另用中文長度上限
  if (item.q.length > 120) problems.push(`${item.id} 題目太長（${item.q.length} 字）`);
  if (item.a.some((text) => text.length > 70)) problems.push(`${item.id} 選項太長，投影不好讀`);
  if (item.wrong && item.wrong.length !== 3) problems.push(`${item.id} 錯誤說明不是 3 段`);
  const zh = item.zh || {};
  ['topic', 'q', 'why'].forEach((key) => { if (!zh[key]) problems.push(`${item.id} 缺中文 ${key}`); });
  if (!Array.isArray(zh.a) || zh.a.length !== 4) problems.push(`${item.id} 中文選項不是 4 個`);
  else if (new Set(zh.a).size !== 4) problems.push(`${item.id} 中文選項重複`);
  if (zh.q && zh.q.length > 60) problems.push(`${item.id} 中文題目太長（${zh.q.length} 字）`);
  if (item.wrong && (!Array.isArray(zh.wrong) || zh.wrong.length !== 3)) problems.push(`${item.id} 中文錯誤說明不是 3 段`);
  if (/[\u4e00-\u9fff]/.test(item.q + item.a.join('') + item.why)) problems.push(`${item.id} 英文欄位還有中文字`);
  if (item.a[0].length === Math.max(...item.a.map((t) => t.length))) longestCorrect += 1;
  count(item.lec, byLecture);
  count(item.diff, byDiff);
});

console.log(`共 ${QUESTIONS.length} 題`);
console.log('各週：', byLecture);
console.log('難度：', byDiff);
console.log(`正解是最長選項的題數：${longestCorrect}（${Math.round(longestCorrect / QUESTIONS.length * 100)}%，亂猜基準 25%）`);
console.log(problems.length ? problems.join('\n') : '格式檢查通過');
process.exitCode = problems.length ? 1 : 0;
