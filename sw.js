/* ============================================================
   «Наладчик» — офлайн-оболочка (service worker)
   Кэшируются только собственные статические файлы приложения.
   Запросы к api.github.com не перехватываются.
   ============================================================ */
'use strict';

const CACHE_NAME = 'naladchik-shell-v1.2.2';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './assets/css/styles.css?v=1.2.2',
  './assets/js/store.js?v=1.2.2',
  './assets/js/charts.js?v=1.2.2',
  './assets/js/github.js?v=1.2.2',
  './assets/js/core.js?v=1.2.2',
  './assets/js/views.js?v=1.2.2',
  './assets/js/modals.js?v=1.2.2',
  './assets/js/settings.js?v=1.2.2',
  './assets/icons/favicon.svg',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/icon-maskable-512.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(SHELL);
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (key) {
        return key !== CACHE_NAME;
      }).map(function (key) {
        return caches.delete(key);
      }));
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function (event) {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).then(function (response) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(function (cache) {
          cache.put(request, copy);
        });
        return response;
      }).catch(function () {
        return caches.match(request).then(function (cached) {
          return cached || caches.match('./index.html');
        });
      })
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(function (cached) {
      const network = fetch(request).then(function (response) {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(function (cache) {
            cache.put(request, copy);
          });
        }
        return response;
      }).catch(function () {
        return cached;
      });
      return cached || network;
    })
  );
});
