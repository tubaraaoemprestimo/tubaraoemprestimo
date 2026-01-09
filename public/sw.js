
const CACHE_NAME = 'tubarao-pwa-v2';
const URLS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json'
];

// 1. Install Service Worker & Precache App Shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Opened cache');
        return cache.addAll(URLS_TO_CACHE);
      })
      .then(() => self.skipWaiting())
  );
});

// 2. Activate & Clean Old Caches
self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
    .then(() => self.clients.claim())
  );
});

// 3. Fetch Strategy
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Ignore API calls or non-GET requests
  if (request.method !== 'GET' || url.pathname.includes('/api/')) {
    return;
  }

  // Strategy A: HTML Navigation (Network First -> Cache Fallback)
  // Ensures user gets latest version online, but works offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Check if valid response
          if (!response || response.status !== 200 || response.type !== 'basic') {
             return response;
          }
          // Update Cache
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });
          return response;
        })
        .catch(() => {
          // Offline Fallback: Return index.html
          return caches.match('./index.html').then(response => {
             return response || caches.match('./');
          });
        })
    );
    return;
  }

  // Strategy B: Static Assets (Stale-While-Revalidate)
  // Images, JS, CSS, Fonts
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request).then((networkResponse) => {
         // Update Cache if valid
         if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
               cache.put(request, responseToCache);
            });
         }
         return networkResponse;
      }).catch(() => {
         // Network failed, nothing to do (we rely on cache)
      });

      // Return cached response immediately if available, otherwise wait for network
      return cachedResponse || fetchPromise;
    })
  );
});

// 4. Push Notifications (Optional)
self.addEventListener('push', (event) => {
  let data = { title: 'Tubarão Empréstimos', body: 'Nova atualização!', icon: 'https://cdn.jsdelivr.net/npm/twemoji@11.3.0/2/72x72/1f988.png' };
  
  if (event.data) {
    try {
        data = JSON.parse(event.data.text());
    } catch(e) {
        data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon,
    badge: data.icon,
    vibrate: [100, 50, 100],
    data: { url: '/' }
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow('/')
  );
});
