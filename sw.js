/* Palteca service worker — offline app shell. */
const CACHE = 'palteca-v5';
// Relative paths so the app works both at localhost root and under a
// GitHub Pages subpath (e.g. /palteca/). Resolved against the SW's scope.
const ASSETS = [
  './', './index.html', './styles.css',
  './store.js', './content.js', './dialogues.js', './morse.js', './sign.js', './app.js',
  './icon.svg', './manifest.webmanifest',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  // Network-first for navigations (fresh HTML), cache fallback offline.
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then((r) => { cachePut(req, r.clone()); return r; }).catch(() => caches.match('./index.html') || caches.match('./')));
    return;
  }
  // Cache-first for static assets, revalidate in background.
  e.respondWith(
    caches.match(req).then((cached) => {
      const net = fetch(req).then((r) => { cachePut(req, r.clone()); return r; }).catch(() => cached);
      return cached || net;
    })
  );
});

function cachePut(req, res) {
  if (res && res.ok) caches.open(CACHE).then((c) => c.put(req, res)).catch(() => {});
}
