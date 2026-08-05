const CACHE = 'duke-neon-v17';
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/src/core.js',
  '/src/events.js',
  '/manifest.webmanifest',
  '/assets/duke-icon.svg',
];

const OPTIONAL_ASSETS = [
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
];

async function cacheAssets() {
  const cache = await caches.open(CACHE);
  await Promise.allSettled([...CORE_ASSETS, ...OPTIONAL_ASSETS].map(async (url) => {
    const response = await fetch(url, { cache: 'reload' });
    if (response.ok) await cache.put(url, response);
  }));
}

self.addEventListener('install', (event) => {
  event.waitUntil(cacheAssets().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

async function networkFirst(request) {
  try {
    const response = await fetch(request, { cache: 'no-store' });
    if (response.ok) {
      const cache = await caches.open(CACHE);
      await cache.put(request, response.clone()).catch(() => {});
    }
    return response;
  } catch {
    const exact = await caches.match(request);
    if (exact) return exact;

    const url = new URL(request.url);
    const pathnameFallback = await caches.match(url.pathname);
    if (pathnameFallback) return pathnameFallback;

    return null;
  }
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  if (event.request.mode === 'navigate') {
    event.respondWith((async () => {
      const response = await networkFirst(event.request);
      if (response) return response;
      return (await caches.match('/index.html')) || new Response('Duke no está disponible sin conexión.', {
        status: 503,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    })());
    return;
  }

  event.respondWith((async () => {
    const response = await networkFirst(event.request);
    if (response) return response;

    return new Response('Recurso no disponible', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
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
