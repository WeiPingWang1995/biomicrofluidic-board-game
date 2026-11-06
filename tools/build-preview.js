// 把 CSS 和 JS 併成單一檔，給線上預覽用。正式版仍是 index.html 加各檔案。
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

const scripts = ['js/game-data.js', 'js/questions.js', 'js/engine.js', 'js/app.js']
  .map((p) => `<script>\n${read(p).replace(/<\/script/g, '<\\/script')}\n</script>`).join('\n');
const html = `<title>電極棋局</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@500;600&family=LXGW+WenKai+TC:wght@700&family=Noto+Sans+TC:wght@400;500;700&display=swap">
<style>
${read('css/style.css')}
</style>
<div id="app"></div>
${scripts}
`;
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist/preview.html'), html);
console.log('dist/preview.html', Math.round(html.length / 1024), 'KB');
