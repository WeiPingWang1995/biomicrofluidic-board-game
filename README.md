# 電極棋局 Electrode Gambit

生物微流體課程期中桌遊的主持機與規則資料。5 人、6 回合、約 35 分鐘。玩家用實體棋盤與答案卡，主持機負責翻事件、出題、倒數與計分。

## 使用
- 本機：用任一靜態伺服器開 `index.html`，例如 `python -m http.server`。
- 發布：整個資料夾推到 GitHub Pages 即可，不用建置。第一次連線後可離線開啟。

## 檔案
- `js/game-data.js`：棋盤、站點、任務、角色、晶片、事件與規則數值。改規則從這裡開始。
- `js/questions.js`：題庫，`a[0]` 是正解，顯示時會打亂。
- `js/engine.js`：規則引擎。`js/app.js`：主持機畫面。
- `print/prototype.html`：試玩印刷稿，用瀏覽器列印成 PDF。
- `print/electrode-gambit-prototype.pdf`：印好的試玩稿。

## 計分開關
開局畫面可以開關兩條可選規則，遊戲開始後不能改。預設值在 `js/game-data.js` 的 `OPTIONS`。

| 規則 | 基本版預設 | 進階版預設 |
|---|---|---|
| 檢測答錯 −1 分 | 開 | 關 |
| 全場第一個完成檢測 +1 分 | 關 | 開 |

基本版同分時並列第一，要分勝負由主持人加賽一題搶答。進階版同分比答對題數。

## 檢查
- `node tools/test-engine.js`：規則測試。
- `node tools/validate-questions.js`：題庫格式檢查。
- `node tools/simulate.js 20000 0.6 basic`：機器人對局，看基本版平衡；最後改成 `full` 看進階版。
- `tools/smoke.html`：開啟後自動按完一局基本版；網址加 `?mode=full` 測進階版。
- `tools/seat-analysis.js`：比較座位公平與同分的各種規則變體。
