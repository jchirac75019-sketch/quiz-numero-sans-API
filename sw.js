/* ========== SERVICE WORKER - GESTION CACHE OFFLINE ET PWA ==========
   📌 RÔLE: Permettre l'app de fonctionner HORS LIGNE + Installation PWA
   💡 UTILITÉ: 
      - Cache les fichiers au 1er chargement
      - Synchronisation offline-first
      - Gestion des mises à jour
      - Support installation desktop + mobile
   ✅ VERSION: V27 - Compatible téléphone + ordinateur
   📱 APPLICATION: quiz-numero-sans-API
========== */

/**
 * 📌 NOM DU CACHE - CACHE NAME
 * 💡 À MODIFIER: Augmentez le numéro (v1→v2, etc) pour forcer mise à jour
 * ⚠️ IMPORTANT: Tous les anciens caches seront supprimés automatiquement
 */
const CACHE_NAME = 'quran-quiz-cache-v27';
const API_CACHE_NAME = 'versets-cache-v27';
const BASE_PATH = '/quiz-numero-sans-API';

/**
 * 📌 LISTE DES FICHIERS À METTRE EN CACHE - FILES TO CACHE
 * 💡 NOTE: Les icônes et screenshots sont inclus pour installation desktop
 *          Les librairies externes (CDN) sont en network-first
 */
const STATIC_ASSETS = [
  BASE_PATH + '/',
  BASE_PATH + '/index.html',
  BASE_PATH + '/manifest.json',
  BASE_PATH + '/images/icon-192.png',
  BASE_PATH + '/images/icon-512.png',
  BASE_PATH + '/images/icon-maskable-192.png',
  BASE_PATH + '/images/icon-maskable-512.png',
  BASE_PATH + '/images/screenshot-1.png',
  BASE_PATH + '/images/screenshot-2.png'
];

/* ========== ÉVÉNEMENT INSTALL - INSTALLATION EVENT ==========
   Déclenché lors de l'installation du Service Worker
   - Crée le cache
   - Pré-cache les fichiers essentiels
   - Active immédiatement le Worker
========== */
self.addEventListener('install', event => {
    console.log('✅ Service Worker: Installation en cours (V27)...');
    console.log('📦 Version du cache:', CACHE_NAME);
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('📦 Cache créé avec succès:', CACHE_NAME);
                
                /* 🎯 Cache les fichiers essentiels + icônes (desktop) */
                return cache.addAll(STATIC_ASSETS).catch(err => {
                    console.warn('⚠️ Certains fichiers non trouvés lors du cache initial');
                    console.warn('   Raison:', err.message);
                    console.log('✅ Continuant quand même - mode dégradé autorisé');
                    return Promise.resolve();
                });
            })
            .catch(error => {
                console.error('Service Worker: Erreur lors du cache des assets', error);
            })
    );
    
    /* Activation immédiate du Service Worker */
    self.skipWaiting();
});

/* ========== ÉVÉNEMENT FETCH - REQUEST INTERCEPTION ==========
   Intercepte toutes les requêtes réseau
   - Cache-first: pour les fichiers statiques locaux (performances)
   - Network-first: pour les requêtes dynamiques (données fraîches)
   - API Cache: pour les versets (avec fallback offline)
========== */
self.addEventListener('fetch', event => {
    const url = event.request.url;
    
    /* 📌 STRATÉGIE: Cache dynamique pour les requêtes API verset */
    if (url.startsWith('https://api.alquran.cloud/v1/ayah/')) {
        event.respondWith(
            caches.open(API_CACHE_NAME).then(cache =>
                cache.match(event.request).then(response => {
                    if (response) {
                        console.log('✅ Réponse en cache pour API:', url);
                        return response;
                    }
                    
                    /* Cache miss - essayer le réseau */
                    return fetch(event.request).then(networkResponse => {
                        if (networkResponse && networkResponse.status === 200) {
                            cache.put(event.request, networkResponse.clone());
                            console.log('💾 Mis en cache (API):', url);
                        }
                        return networkResponse;
                    }).catch(error => {
                        console.error('Service Worker: Erreur réseau, mode hors ligne:', error);
                        
                        /* Fallback offline pour API */
                        return new Response(JSON.stringify({
                            code: 0,
                            status: "offline",
                            data: { text: "Verset non disponible hors connexion." }
                        }), { 
                            headers: { 'Content-Type': 'application/json' } 
                        });
                    });
                })
            )
        );
        return;
    }
    
    /* 📌 STRATÉGIE: Cache statique pour tout le reste */
    event.respondWith(
        caches.match(event.request).then(response => {
            if (response) {
                console.log('✅ Asset en cache:', event.request.url);
                return response;
            }
            
            /* Cache miss - essayer le réseau */
            return fetch(event.request)
                .then(networkResponse => {
                    /* Cache optionnel les réponses réussies */
                    if (networkResponse && networkResponse.status === 200 && 
                        (event.request.url.includes('.js') || 
                         event.request.url.includes('.css') || 
                         event.request.url.includes('.png') ||
                         event.request.url.includes('.jpg'))) {
                        caches.open(CACHE_NAME).then(cache => {
                            cache.put(event.request, networkResponse.clone());
                            console.log('💾 Mis en cache (statique):', event.request.url);
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

/* ========== ÉVÉNEMENT ACTIVATE - CLEANUP AND CLAIMS ==========
   Déclenché lors de l'activation du Service Worker
   - Supprime les anciens caches (pour mise à jour propre)
   - Prend contrôle des clients existants
   - Ferme ancienne version
========== */
self.addEventListener('activate', event => {
    console.log('🔄 Service Worker: Activation en cours (V27)...');
    console.log('🧹 Nettoyage des anciens caches...');
    
    const cacheWhitelist = [CACHE_NAME, API_CACHE_NAME];
    
    event.waitUntil(
        caches.keys()
            .then(keys => {
                console.log('📋 Caches existants:', keys);
                
                return Promise.all(
                    keys
                        .filter(key => !cacheWhitelist.includes(key))
                        .map(key => {
                            console.log('🗑️  Suppression ancien cache:', key);
                            return caches.delete(key);
                        })
                );
            })
            .then(() => {
                console.log('🎯 Service Worker prend contrôle des clients');
                return self.clients.claim();
            })
    );
});

/* ========== ÉVÉNEMENT MESSAGE - COMMUNICATION CLIENT-WORKER ==========
   Permet au JavaScript de communiquer avec le Service Worker
   (Optionnel: pour des mises à jour manuelles)
========== */
self.addEventListener('message', event => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        console.log('📢 Message reçu du client: SKIP_WAITING');
        self.skipWaiting();
    }
    
    if (event.data && event.data.type === 'GET_CACHE_INFO') {
        console.log('📊 Info cache demandée par le client');
        event.ports[0].postMessage({
            cacheName: CACHE_NAME,
            apiCacheName: API_CACHE_NAME,
            version: 'V27',
            app: 'quiz-numero-sans-API'
        });
    }
});