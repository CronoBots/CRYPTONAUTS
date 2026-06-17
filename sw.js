/* Service Worker — Cryptonauts Leaderboards (PWA)
 *
 * Stratégie :
 *  - navigation / index.html  → network-first (données fraîches), repli cache hors-ligne
 *  - autres ressources même origine → cache-first (police, images, icônes)
 *  - ressources externes (CDN crypto.com) → réseau direct, non mises en cache
 *
 * Le nom du cache est versionné : incrémentez CACHE_VERSION à chaque
 * changement de la liste précachée pour forcer la mise à jour.
 */
const CACHE_VERSION = 'v2';
const CACHE = 'cryptonauts-' + CACHE_VERSION;

const PRECACHE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './fonts/Geomanist-Bold.woff2',
  './assets/Header.png',
  './assets/Footer.png',
  './assets/logo.png',
  './assets/icon-192.png',
  './assets/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
      .catch(() => {})
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); } catch (e) { return; }

  const isNavigation = req.mode === 'navigate' ||
    url.pathname.endsWith('/') || url.pathname.endsWith('index.html');

  if (isNavigation) {
    // Network-first : on veut le leaderboard le plus à jour quand on est en ligne.
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match('./index.html')))
    );
    return;
  }

  // Cache-first pour les ressources statiques de même origine.
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req).then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        });
      })
    );
  }
  // Les ressources externes (images CDN crypto.com) passent par le réseau normal.
});
