// ============================================================
//  sw.js — Zentry PWA Service Worker
//  Faz o app funcionar igual app nativo instalado
// ============================================================

const CACHE_NAME = 'zentry-v1';

// Arquivos principais para cachear (app funciona offline)
const ARQUIVOS_CACHE = [
  '/',
  '/index.html',
  '/home.html',
  '/login.html',
  '/manifest.json',
  '/logo-192.png',
  '/logo-512.png',
  '/zentry-core.js',
  'https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&display=swap'
];

// ── INSTALAR: cacheia os arquivos principais ──
self.addEventListener('install', (event) => {
  console.log('[SW] Instalando...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Cacheando arquivos principais');
      return cache.addAll(ARQUIVOS_CACHE).catch((err) => {
        console.warn('[SW] Erro ao cachear alguns arquivos:', err);
      });
    })
  );
  self.skipWaiting();
});

// ── ATIVAR: remove caches antigos ──
self.addEventListener('activate', (event) => {
  console.log('[SW] Ativado!');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log('[SW] Removendo cache antigo:', name);
            return caches.delete(name);
          })
      );
    })
  );
  self.clients.claim();
});

// ── FETCH: serve do cache, busca na rede se não tiver ──
self.addEventListener('fetch', (event) => {
  // Ignora requisições do Firebase e APIs externas
  if (
    event.request.url.includes('firebaseapp.com') ||
    event.request.url.includes('googleapis.com/identitytoolkit') ||
    event.request.url.includes('securetoken.googleapis.com') ||
    event.request.url.includes('asaas.com') ||
    event.request.url.includes('netlify.app/.netlify/functions') ||
    event.request.method !== 'GET'
  ) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse; // Serve do cache
      }
      // Busca na rede e cacheia
      return fetch(event.request).then((networkResponse) => {
        if (
          networkResponse &&
          networkResponse.status === 200 &&
          networkResponse.type !== 'opaque'
        ) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      }).catch(() => {
        // Offline — retorna página principal do cache
        return caches.match('/home.html') || caches.match('/index.html');
      });
    })
  );
});

// ── PUSH NOTIFICATIONS (preparado para futuro) ──
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title   = data.title   || 'Zentry';
  const options = {
    body:    data.body    || 'Você tem uma nova notificação',
    icon:    '/logo-192.png',
    badge:   '/logo-192.png',
    vibrate: [100, 50, 100],
    data:    { url: data.url || '/home.html' }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// ── CLIQUE NA NOTIFICAÇÃO ──
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data.url || '/home.html')
  );
});
               
