/* Service Worker — Cryptonauts Leaderboards (PWA)
 *
 * Stratégie :
 *  - navigation / index.html  → network-first (données fraîches), repli cache hors-ligne
 *  - data.json (classement)   → network-first : DOIT rester frais (rafraîchi par
 *                               la GitHub Action), repli cache uniquement hors-ligne
 *  - autres ressources même origine → cache-first (police, images, icônes)
 *  - ressources externes (CDN crypto.com) → réseau direct, non mises en cache
 *
 * Le nom du cache est versionné : incrémentez CACHE_VERSION à chaque
 * changement de la liste précachée pour forcer la mise à jour.
 */
const CACHE_VERSION = 'v10';
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
  './assets/icon-512.png',
  './assets/nebula-poster.jpg'
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

  // Vidéo (fond de hero) : laisse le navigateur gérer le streaming natif
  // (requêtes Range / 206). Ne pas intercepter ni mettre en cache.
  if (req.headers.has('range') || /\.mp4($|\?)/i.test(req.url)) return;

  let url;
  try { url = new URL(req.url); } catch (e) { return; }

  const isNavigation = req.mode === 'navigate' ||
    url.pathname.endsWith('/') || url.pathname.endsWith('index.html');

  // data.json porte le classement rafraîchi par la GitHub Action : il NE DOIT PAS
  // être servi cache-first (sinon les visiteurs récurrents restent bloqués sur un
  // ancien classement / d'anciennes références d'images). Réseau d'abord, cache
  // seulement en repli hors-ligne — comme la navigation.
  const isData = url.origin === self.location.origin && url.pathname.endsWith('data.json');

  if (isNavigation || isData) {
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
