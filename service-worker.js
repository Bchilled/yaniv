const CACHE = 'yaniv-v1';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json',
  './icon.svg'
];

self.addEventListener('install', (evt) => {
  evt.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener('activate', (evt) => {
  evt.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
});

self.addEventListener('fetch', (evt) => {
  evt.respondWith(
    caches.match(evt.request).then((cached) => cached || fetch(evt.request))
  );
});
