// Service worker del panel: permite instalarlo como app y abrirlo sin conexión (los datos requieren internet).
const CACHE = 'qn-agenda-v3';
const SHELL = ['agenda.html', 'config.js', 'manifest-agenda.json', 'assets/panel.css', 'assets/qn.js', 'assets/panel-core.js',
  'assets/panel-agenda.js', 'assets/panel-inicio.js', 'assets/panel-caja.js', 'assets/panel-clientes.js', 'assets/panel-reportes.js', 'assets/panel-ajustes.js',
  'assets/panel-start.js', 'assets/logo.jpg', 'assets/icon-192.png'];

self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// Red primero (siempre la versión más nueva); si no hay conexión, usa la copia guardada.
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(fetch(e.request).then(r => {
    if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
    return r;
  }).catch(() => caches.match(e.request, { ignoreSearch: true })));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window' }).then(list => list[0] ? list[0].focus() : self.clients.openWindow('agenda.html')));
});
