const CACHE = 'yaniv-v2';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json',
  './icon.svg',
  './i18n/en.json',
  './i18n/he.json',
  './i18n/es.json',
  './i18n/fr.json',
  './i18n/de.json',
  './i18n/pt.json',
  './i18n/ru.json',
  './i18n/ar.json',
  './i18n/hi.json',
  './i18n/tr.json',
  './i18n/ne.json'
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
