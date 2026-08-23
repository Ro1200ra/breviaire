/* Service worker : application utilisable hors connexion, textes AELF conservés. */
const SHELL = 'breviaire-shell-v2';
const DATA = 'aelf-data';
const SHELL_FILES = ['./', './index.html', './app.js', './chant.js', './manifest.webmanifest', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(SHELL_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('breviaire-shell-') && k !== SHELL).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;

  if (url.hostname === 'api.aelf.org') {
    // Réseau d'abord (textes à jour), cache en secours (hors connexion).
    e.respondWith(
      fetch(e.request).then(res => {
        if (res.ok) { const copy = res.clone(); caches.open(DATA).then(c => c.put(e.request, copy)); }
        return res;
      }).catch(() => caches.match(e.request).then(r => r || new Response(JSON.stringify({ error: 'offline' }), { status: 503, headers: { 'Content-Type': 'application/json' } })))
    );
    return;
  }

  if (url.origin === location.origin) {
    // Application : réseau d'abord (pour recevoir les mises à jour), cache en secours (hors connexion).
    e.respondWith(
      fetch(e.request).then(res => {
        if (res.ok) { const copy = res.clone(); caches.open(SHELL).then(c => c.put(e.request, copy)); }
        return res;
      }).catch(() => caches.match(e.request).then(r => r || caches.match('./index.html')))
    );
  }
});
