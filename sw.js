// Service worker: deixa o app abrir sem internet e buscar atualizações quando há conexão.
const VERSION = 'planner-v1.3.0';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/styles.css',
  './js/app.js',
  './js/db.js',
  './js/ui.js',
  './js/views.js',
  './js/core.js',
  './js/agenda.js',
  './js/estudos.js',
  './js/config.js',
  './js/sync.js',
  './js/notif.js',
  './js/cloud.js',
  './js/vendor/supabase.js',
  './icons/badge-96.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION && k !== 'fonts').map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Fontes do Google: guarda depois da primeira vez.
  if (url.hostname.endsWith('fonts.googleapis.com') || url.hostname.endsWith('fonts.gstatic.com')) {
    event.respondWith(
      caches.open('fonts').then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
        return res;
      })
    );
    return;
  }

  // Arquivos do app: tenta a versão mais nova; sem internet, usa a guardada.
  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(VERSION).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match(req, { ignoreSearch: true }).then((hit) => hit || caches.match('./index.html')))
    );
  }
});

// ---------- Notificações push ----------
self.addEventListener('push', (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch (e) { d = { title: 'Planner', body: event.data ? event.data.text() : '' }; }
  const opts = {
    body: d.body || '',
    icon: './icons/icon-192.png',
    badge: './icons/badge-96.png',
    tag: d.tag || undefined,
    renotify: !!d.tag,
    vibrate: Array.isArray(d.vibrate) ? d.vibrate : [200],
    silent: !!d.silent,
    requireInteraction: !!d.requireInteraction,
    data: { url: d.url || './#/hoje' }
  };
  event.waitUntil(self.registration.showNotification(d.title || 'Planner', opts));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL(event.notification.data && event.notification.data.url || './#/hoje', self.registration.scope).href;
  const hash = new URL(url).hash;
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of all) {
      if (c.url.startsWith(self.registration.scope)) {
        await c.focus();
        c.postMessage({ type: 'go', hash });
        return;
      }
    }
    await self.clients.openWindow(url);
  })());
});
