/**
 * ============================================
 * TUBARÃO EMPRÉSTIMOS - SERVICE WORKER COMPLETO
 * PWA 100% Offline-First com Cache Estratégico
 * ============================================
 */

const CACHE_VERSION = 'v5';
const CACHE_STATIC = `tubarao-static-${CACHE_VERSION}`;
const CACHE_DYNAMIC = `tubarao-dynamic-${CACHE_VERSION}`;
const CACHE_IMAGES = `tubarao-images-${CACHE_VERSION}`;
const CACHE_API = `tubarao-api-${CACHE_VERSION}`;

// Assets essenciais para funcionar offline
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './Logo.png'
];

// Padrões de URL para diferentes estratégias de cache
const CACHE_STRATEGIES = {
  // Assets estáticos - Cache First
  static: [
    /\.js$/,
    /\.css$/,
    /\.woff2?$/,
    /\.ttf$/,
    /\.eot$/
  ],
  // Imagens - Cache com expiração
  images: [
    /\.png$/,
    /\.jpg$/,
    /\.jpeg$/,
    /\.gif$/,
    /\.svg$/,
    /\.webp$/,
    /\.ico$/
  ],
  // APIs que podem ser cacheadas
  api: [
    /supabase\.co\/rest/,
    /fonts\.googleapis\.com/,
    /fonts\.gstatic\.com/
  ],
  // Nunca cachear
  exclude: [
    /supabase\.co\/auth/,
    /supabase\.co\/functions/,
    /firebase/,
    /hot-update/,
    /__vite/
  ]
};

// ============================================
// 1. INSTALAÇÃO - Precache de assets essenciais
// ============================================
self.addEventListener('install', (event) => {
  console.log('[SW] Installing Service Worker v' + CACHE_VERSION);

  event.waitUntil(
    caches.open(CACHE_STATIC)
      .then((cache) => {
        console.log('[SW] Precaching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('[SW] Skip waiting');
        return self.skipWaiting();
      })
      .catch((err) => {
        console.error('[SW] Precache failed:', err);
      })
  );
});

// ============================================
// 2. ATIVAÇÃO - Limpa caches antigos
// ============================================
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating Service Worker');

  const currentCaches = [CACHE_STATIC, CACHE_DYNAMIC, CACHE_IMAGES, CACHE_API];

  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name.startsWith('tubarao-') && !currentCaches.includes(name))
            .map((name) => {
              console.log('[SW] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => {
        console.log('[SW] Claiming clients');
        return self.clients.claim();
      })
  );
});

// ============================================
// 3. ESTRATÉGIAS DE CACHE
// ============================================

// Network First - Para HTML (sempre busca a versão mais recente)
async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);

    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_DYNAMIC);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    // Fallback para index.html se for navegação
    if (request.mode === 'navigate') {
      return caches.match('./index.html');
    }
    throw error;
  }
}

// Cache First - Para assets estáticos
async function cacheFirst(request, cacheName = CACHE_STATIC) {
  const cachedResponse = await caches.match(request);

  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const networkResponse = await fetch(request);

    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    console.error('[SW] Fetch failed:', error);
    throw error;
  }
}

// Stale While Revalidate - Para imagens e fontes
async function staleWhileRevalidate(request, cacheName = CACHE_IMAGES) {
  const cachedResponse = await caches.match(request);

  const fetchPromise = fetch(request)
    .then((networkResponse) => {
      if (networkResponse.ok) {
        const cache = caches.open(cacheName);
        cache.then((c) => c.put(request, networkResponse.clone()));
      }
      return networkResponse;
    })
    .catch(() => cachedResponse);

  return cachedResponse || fetchPromise;
}

// Network Only - Para APIs sensíveis
async function networkOnly(request) {
  return fetch(request);
}

// ============================================
// 4. ROTEADOR DE REQUISIÇÕES
// ============================================
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignora requisições não-GET
  if (request.method !== 'GET') {
    return;
  }

  // Ignora chrome-extension e outros protocolos
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // Verifica se deve excluir do cache
  for (const pattern of CACHE_STRATEGIES.exclude) {
    if (pattern.test(url.href)) {
      event.respondWith(networkOnly(request));
      return;
    }
  }

  // Navegação HTML - Network First
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
    return;
  }

  // Assets estáticos - Cache First
  for (const pattern of CACHE_STRATEGIES.static) {
    if (pattern.test(url.pathname)) {
      event.respondWith(cacheFirst(request, CACHE_STATIC));
      return;
    }
  }

  // Imagens - Stale While Revalidate
  for (const pattern of CACHE_STRATEGIES.images) {
    if (pattern.test(url.pathname)) {
      event.respondWith(staleWhileRevalidate(request, CACHE_IMAGES));
      return;
    }
  }

  // APIs cacheáveis - Stale While Revalidate
  for (const pattern of CACHE_STRATEGIES.api) {
    if (pattern.test(url.href)) {
      event.respondWith(staleWhileRevalidate(request, CACHE_API));
      return;
    }
  }

  // Default - Network First
  event.respondWith(networkFirst(request));
});

// ============================================
// 5. SINCRONIZAÇÃO EM BACKGROUND
// ============================================
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync:', event.tag);

  if (event.tag === 'sync-payments') {
    event.waitUntil(syncPayments());
  }

  if (event.tag === 'sync-forms') {
    event.waitUntil(syncForms());
  }
});

async function syncPayments() {
  // Sincroniza comprovantes pendentes quando volta online
  console.log('[SW] Syncing pending payments...');
}

async function syncForms() {
  // Sincroniza formulários salvos offline
  console.log('[SW] Syncing pending forms...');
}

// ============================================
// 6. PUSH NOTIFICATIONS
// ============================================
self.addEventListener('push', (event) => {
  console.log('[SW] Push received');

  let data = {
    title: 'Tubarão Empréstimos',
    body: 'Nova atualização!',
    icon: '/Logo.png',
    badge: '/Logo.png'
  };

  if (event.data) {
    try {
      const payload = event.data.json();
      data = {
        title: payload.title || payload.notification?.title || data.title,
        body: payload.body || payload.notification?.body || data.body,
        icon: payload.icon || payload.notification?.icon || data.icon,
        badge: data.badge,
        data: payload.data || {}
      };
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon,
    badge: data.badge,
    vibrate: [200, 100, 200],
    tag: 'tubarao-notification',
    renotify: true,
    requireInteraction: true,
    actions: [
      { action: 'open', title: 'Abrir' },
      { action: 'close', title: 'Fechar' }
    ],
    data: data.data
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// ============================================
// 7. CLICK EM NOTIFICAÇÃO
// ============================================
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event.action);

  event.notification.close();

  if (event.action === 'close') {
    return;
  }

  const urlToOpen = event.notification.data?.link || event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        // Verifica se já tem janela aberta
        for (const client of windowClients) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.focus();
            if (urlToOpen !== '/') {
              client.navigate(urlToOpen);
            }
            return;
          }
        }
        // Abre nova janela
        return clients.openWindow(urlToOpen);
      })
  );
});

// ============================================
// 8. MENSAGENS DO APP
// ============================================
self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data);

  if (event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }

  if (event.data.action === 'clearCache') {
    event.waitUntil(
      caches.keys().then((names) =>
        Promise.all(names.map((name) => caches.delete(name)))
      )
    );
  }

  if (event.data.action === 'getCacheStats') {
    event.waitUntil(
      getCacheStats().then((stats) => {
        event.ports[0].postMessage(stats);
      })
    );
  }
});

async function getCacheStats() {
  const cacheNames = await caches.keys();
  const stats = {};

  for (const name of cacheNames) {
    const cache = await caches.open(name);
    const keys = await cache.keys();
    stats[name] = keys.length;
  }

  return stats;
}

// ============================================
// 9. PERIODIC BACKGROUND SYNC (se suportado)
// ============================================
self.addEventListener('periodicsync', (event) => {
  console.log('[SW] Periodic sync:', event.tag);

  if (event.tag === 'check-updates') {
    event.waitUntil(checkForUpdates());
  }
});

async function checkForUpdates() {
  console.log('[SW] Checking for app updates...');
  // Verifica se há atualizações do app
}

console.log('[SW] Service Worker loaded - Version:', CACHE_VERSION);
