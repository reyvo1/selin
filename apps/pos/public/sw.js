const CACHE = 'toko360-pos-shell-v1';
const SHELL = ['/'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).catch(() => undefined));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))));
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // Mutasi/API tidak boleh pernah dilayani dari cache service worker.
  if (url.pathname.startsWith('/api/')) return;

  // The POS shell service worker is registered at '/', so its scope covers every other screen served
  // from public/ — including /kiosk/ and /stock-count/. Caching whatever document was navigated to
  // under the single key '/' meant that visiting /kiosk/ overwrote the cached POS shell with the kiosk
  // HTML, and the offline fallback below then served the kiosk as the till. Only the shell itself is
  // cached, and only under its own path; the device screens have their own caching rules and are left
  // alone here.
  const isDeviceScreen = url.pathname.startsWith('/kiosk') || url.pathname.startsWith('/stock-count') || url.pathname.startsWith('/customer-display');
  if (isDeviceScreen) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok && url.pathname === '/') {
            const copy = response.clone();
            void caches.open(CACHE).then((cache) => cache.put('/', copy));
          }
          return response;
        })
        .catch(async () => (await caches.match(request)) || (await caches.match('/')) || Response.error()),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request).then((response) => {
      if (response.ok) {
        const copy = response.clone();
        void caches.open(CACHE).then((cache) => cache.put(request, copy));
      }
      return response;
    })),
  );
});
