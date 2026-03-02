// Firebase Messaging Service Worker
// Tubarão Empréstimos - Recebe push notifications em background

// Import Firebase scripts
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// Firebase config - Projeto tubarao-emprestimo
const firebaseConfig = {
    apiKey: "AIzaSyA4aFPY5lU-H84KI_m6eOPv081uDqbTFeM",
    authDomain: "tubarao-emprestimo.firebaseapp.com",
    projectId: "tubarao-emprestimo",
    storageBucket: "tubarao-emprestimo.firebasestorage.app",
    messagingSenderId: "473035787766",
    appId: "1:473035787766:web:a55b95d9e94898946a0bd7"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Get messaging instance
const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
    console.log('[FCM SW] Background message received:', payload);

    const notificationTitle = payload.notification?.title || 'Tubarão Empréstimos';
    const notificationOptions = {
        body: payload.notification?.body || 'Nova notificação!',
        icon: payload.notification?.icon || '/Logo.png',
        badge: '/Logo.png',
        vibrate: [200, 100, 200],
        tag: 'tubarao-notification',
        requireInteraction: true,
        actions: [
            {
                action: 'open',
                title: 'Abrir'
            },
            {
                action: 'close',
                title: 'Fechar'
            }
        ],
        data: {
            url: payload.data?.link || '/',
            ...payload.data
        }
    };

    return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
    console.log('[FCM SW] Notification clicked:', event);

    event.notification.close();

    if (event.action === 'close') {
        return;
    }

    // Get URL from notification data
    const urlToOpen = event.notification.data?.url || '/';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
            // Check if there's already a window open
            for (let i = 0; i < windowClients.length; i++) {
                const client = windowClients[i];
                if (client.url.includes(self.location.origin) && 'focus' in client) {
                    client.focus();
                    client.navigate(urlToOpen);
                    return;
                }
            }
            // If no window is open, open a new one
            if (clients.openWindow) {
                return clients.openWindow(urlToOpen);
            }
        })
    );
});

// Handle push event (fallback for non-Firebase pushes)
self.addEventListener('push', (event) => {
    console.log('[FCM SW] Push event received');

    // If this is a Firebase message, it will be handled by onBackgroundMessage
    // This is for other push sources
    if (event.data) {
        try {
            const data = event.data.json();

            // Skip if it's a Firebase message (has notification field)
            if (data.notification) {
                return;
            }

            const title = data.title || 'Tubarão Empréstimos';
            const options = {
                body: data.body || data.message || 'Nova atualização!',
                icon: data.icon || '/Logo.png',
                badge: '/Logo.png',
                vibrate: [100, 50, 100],
                data: { url: data.link || '/' }
            };

            event.waitUntil(
                self.registration.showNotification(title, options)
            );
        } catch (e) {
            // Plain text push
            const options = {
                body: event.data.text(),
                icon: '/Logo.png',
                badge: '/Logo.png'
            };

            event.waitUntil(
                self.registration.showNotification('Tubarão Empréstimos', options)
            );
        }
    }
});

console.log('[FCM SW] Firebase Messaging Service Worker loaded');
