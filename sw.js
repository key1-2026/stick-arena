/* STICK//ARENA — 安装版离线缓存 */
const CACHE_PREFIX = 'stick-arena-';
const CACHE = `${CACHE_PREFIX}v16`;
const CORE = [
  './',
  './index.html',
  './404.html',
  './manifest.webmanifest',
  './css/ui.css?v=16',
  './js/data.js?v=16',
  './js/audio.js?v=16',
  './js/render.js?v=16',
  './js/entities.js?v=16',
  './js/game.js?v=16',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(CORE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith(CACHE_PREFIX) && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// 联网时优先取最新资源并更新缓存，断网时才使用本游戏缓存。
// 即使后续发布只修改了游戏文件，也不会一直被旧缓存挡住。
async function networkFirst(req) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(req, { cache: 'no-cache' });
    if (res.ok) {
      try { await cache.put(req, res.clone()); } catch (e) { /* 缓存写入失败不影响联网游戏 */ }
    }
    return res;
  } catch (e) {
    const hit = await cache.match(req);
    if (hit) return hit;
    if (req.mode === 'navigate') {
      return (await cache.match('./index.html')) || (await cache.match('./')) || Response.error();
    }
    return Response.error();
  }
}

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(networkFirst(req));
});
