const CACHE = 'duke-neon-v16';
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
  '/src/ui-enhancements.js',
  '/src/relationship-plus.js',
  '/src/notes.js',
  '/src/activities-plus.js',
  '/src/journey.js',
  '/src/gift-story.js',
  '/src/gift-story.css',
  '/src/duke-beagle.js',
  '/src/gift-audio-natural.js',
  '/manifest.webmanifest',
  '/assets/duke-icon.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.allSettled(STATIC.map((url) => cache.add(url)));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.pathname.startsWith('/api/')) return;

  event.respondWith((async () => {
    try {
      const response = await fetch(event.request);
      if (response?.ok) {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(event.request, copy)).catch(() => {});
      }
      return response;
    } catch {
      const cached = await caches.match(event.request);
      if (cached) return cached;

      // Only navigation requests may fall back to index.html. Returning HTML
      // for JavaScript or CSS causes module parse errors and a blank app.
      if (event.request.mode === 'navigate') {
        const shell = await caches.match('/index.html');
        if (shell) return shell;
      }

      return new Response('Recurso no disponible', {
        status: 503,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }
  })());
});

async function findDukeClient() {
  const openClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  return openClients.find((client) => new URL(client.url).origin === self.location.origin) || null;
}

self.addEventListener('notificationclick', (event) => {
  const data = event.notification?.data || {};
  const action = event.action || '';
  event.notification.close();

  event.waitUntil((async () => {
    if (data.type === 'partner_note') {
      const existing = await findDukeClient();
      if (existing) {
        existing.postMessage({ type: 'DUKE_OPEN_NOTES', noteId: data.noteId });
        await existing.focus();
        return;
      }
      await self.clients.openWindow('/#duke-notes');
      return;
    }

    if (data.type === 'journey_capsule') {
      const existing = await findDukeClient();
      if (existing) {
        existing.postMessage({ type: 'DUKE_OPEN_JOURNEY', capsuleId: data.capsuleId });
        await existing.focus();
        return;
      }
      await self.clients.openWindow('/#duke-journey');
      return;
    }

    const callId = data.callId;
    if (!callId) return;

    if (action === 'reject') {
      await fetch('/api/calls?action=decline', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callId }),
      }).catch(() => {});
      return;
    }

    const existing = await findDukeClient();
    if (existing) {
      existing.postMessage({ type: 'DUKE_ANSWER_CALL', callId });
      await existing.focus();
      return;
    }
    await self.clients.openWindow(`/#duke-call=${callId}`);
  })());
});
