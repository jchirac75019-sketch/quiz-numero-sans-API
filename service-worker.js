const CACHE_NAME = 'quran-quiz-cache-v1';
const API_CACHE_NAME = 'versets-cache-v1';
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icônes/icon-192.png',
  './icônes/icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME, API_CACHE_NAME];
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(key => !cacheWhitelist.includes(key)).map(key => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const url = event.request.url;
  // Cache dynamique pour les requêtes verset API
  if (url.startsWith('https://api.alquran.cloud/v1/ayah/')) {
    event.respondWith(
      caches.open(API_CACHE_NAME).then(cache =>
        cache.match(event.request).then(response => {
          if (response) return response;
          return fetch(event.request).then(networkResponse => {
            if (networkResponse && networkResponse.status === 200) {
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          }).catch(() =>
            new Response(JSON.stringify({
              code: 0,
              status: "offline",
              data: { text: "Verset non disponible hors connexion." }
            }), { headers: { 'Content-Type': 'application/json' } })
          );
        })
      )
    );
    return;
  }
  // Cache statique pour tout le reste
  event.respondWith(
    caches.match(event.request).then(response => response || fetch(event.request))
  );
});
