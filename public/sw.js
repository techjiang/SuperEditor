const CACHE = 'supereditor-v2';
const CORE = [
  './', './index.html', './favicon.svg', './favicon.ico',
  './manifest.webmanifest', './icons/app.ico',
  './icons/icon-192.png', './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(CORE))
      .catch(() => undefined)
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request).then((response) => {
        if (response.ok && response.type === 'basic') {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => undefined);
        }
        return response;
      }).catch(() => cached || (request.mode === 'navigate' ? caches.match('./index.html') : Response.error()));
      // 品牌资源优先取网络，避免 Logo 更新后旧缓存一直生效
      const path = new URL(request.url).pathname;
      if (/favicon|\/icons\//.test(path)) return network;
      return cached || network;
    })
  );
});
