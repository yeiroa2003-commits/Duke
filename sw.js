const CACHE = 'duke-neon-v8';
const STATIC = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/src/core.js',
  '/src/events.js',
  '/src/space-fix.js',
  '/src/video-calls.js',
  '/src/more-games.js',
  '/src/draw-game.js',
  '/manifest.webmanifest',
  '/assets/duke-icon.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(STATIC))
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
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.pathname.startsWith('/api/')) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request).then((cached) => cached || caches.match('/index.html')))
  );
});

self.addEventListener('notificationclick', (event) => {
  const callId = event.notification?.data?.callId;
  const action = event.action || 'answer';
  event.notification.close();
  if (!callId) return;

  event.waitUntil((async () => {
    if (action === 'reject') {
      await fetch('/api/calls?action=decline', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callId }),
      }).catch(() => {});
      return;
    }

    const openClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existing = openClients.find((client) => new URL(client.url).origin === self.location.origin);
    if (existing) {
      existing.postMessage({ type: 'DUKE_ANSWER_CALL', callId });
      await existing.focus();
      return;
    }
    await self.clients.openWindow(`/#duke-call=${callId}`);
  })());
});
