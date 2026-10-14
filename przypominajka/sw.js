const CACHE = 'przypominajka-v1';
const ASSETS = ['./', 'index.html', 'style.css', 'app.js', 'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Network first, cache as offline fallback.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});

// Notification buttons: "Zrobione" / "Za 10 min".
self.addEventListener('notificationclick', (e) => {
  const id = e.notification.data && e.notification.data.id;
  const action = e.action || 'open';
  e.notification.close();
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (all.length) {
      const client = all[0];
      client.postMessage({ type: action, id });
      if (action === 'open' && 'focus' in client) await client.focus();
      return;
    }
    const url = new URL('./', self.registration.scope);
    if (id && action !== 'open') url.searchParams.set(action, id);
    await self.clients.openWindow(url.href);
  })());
});
