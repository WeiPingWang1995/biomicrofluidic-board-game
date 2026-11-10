// 離線快取：第一次連上網路後，教室斷網也能開
const CACHE = 'electrode-gambit-v14';
const FILES = [
  './', 'index.html', 'css/style.css', 'js/game-data.js', 'js/questions.js', 'js/engine.js', 'js/app.js',
  'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png',
  'images/questions/L8-01.svg', 'images/questions/L8-15.svg', 'images/questions/L8-07.svg', 'images/questions/L8-17.svg', 'images/questions/L8-23.svg',
  'videos.html', 'videos/contact-angle.mp4', 'videos/dielectric-breakdown.mp4', 'videos/droplet-moving.mp4', 'videos/droplet-splitting.mp4', 'videos/folding-mixing.mp4',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FILES)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});

// 先看快取，沒有才上網；字型這類外部檔案順手存起來
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((hit) => hit || fetch(event.request).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((cache) => cache.put(event.request, copy));
      return res;
    })),
  );
});
