const CACHE_NAME = 'quran-quiz-cache-v1';
const API_CACHE_NAME = 'versets-cache-v1';
const BASE_PATH = '/quiz-numero-sans-API';  // ✅ Change de /quiz-num-ro-sans-API

const STATIC_ASSETS = [
  BASE_PATH + '/',
  BASE_PATH + '/index.html',
  BASE_PATH + '/manifest.json',
  BASE_PATH + '/images/icon-192.png',
  BASE_PATH + '/images/icon-512.png',
  BASE_PATH + '/images/icon-maskable-192.png',
  BASE_PATH + '/images/icon-maskable-512.png'
];

self.addEventListener('install', event => {
  console.log('Service Worker: Installation en cours...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Service Worker: Cache ouvert, ajout des assets statiques');
        return cache.addAll(STATIC_ASSETS);
      })
      .catch(error => {
        console.error('Service Worker: Erreur lors du cache des assets', error);
      })
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  console.log('Service Worker: Activation en cours...');
  const cacheWhitelist = [CACHE_NAME, API_CACHE_NAME];
  event.waitUntil(
    caches.keys()
      .then(keys => {
        return Promise.all(
          keys
            .filter(key => !cacheWhitelist.includes(key))
            .map(key => {
              console.log('Service Worker: Suppression du cache obsolète:', key);
              return caches.delete(key);
            })
        );
      })
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const url = event.request.url;
  
  // Cache dynamique pour les requêtes API verset
  if (url.startsWith('https://api.alquran.cloud/v1/ayah/')) {
    event.respondWith(
      caches.open(API_CACHE_NAME).then(cache =>
        cache.match(event.request).then(response => {
          if (response) {
            console.log('Service Worker: Réponse en cache pour API:', url);
            return response;
          }
          return fetch(event.request).then(networkResponse => {
            if (networkResponse && networkResponse.status === 200) {
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          }).catch(error => {
            console.error('Service Worker: Erreur réseau, mode hors ligne:', error);
            return new Response(JSON.stringify({
              code: 0,
              status: "offline",
              data: { text: "Verset non disponible hors connexion." }
            }), { headers: { 'Content-Type': 'application/json' } });
          });
        })
      )
    );
    return;
  }

  // Cache statique pour tout le reste (images, CSS, JS, HTML)
  event.respondWith(
    caches.match(event.request).then(response => {
      if (response) {
        console.log('Service Worker: Asset en cache:', event.request.url);
        return response;
      }
      return fetch(event.request)
        .then(networkResponse => {
          // Cache optionnel les réponses réussies
          if (networkResponse && networkResponse.status === 200 && 
              (event.request.url.includes('.js') || 
               event.request.url.includes('.css') || 
               event.request.url.includes('.png') ||
               event.request.url.includes('.jpg'))) {
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, networkResponse.clone());
            });
          }
          return networkResponse;
        })
        .catch(error => {
          console.error('Service Worker: Erreur de récupération:', error);
          return new Response('Ressource indisponible', { status: 404 });
        });
    })
  );
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});