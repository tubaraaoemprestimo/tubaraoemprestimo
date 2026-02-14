import { api } from './apiClient';

const urlBase64ToUint8Array = (base64String: string) => {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/-/g, '+')
        .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
};

export const webPushService = {
    async subscribe() {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
            console.log('Push messaging isn\'t supported.');
            return;
        }

        try {
            // Wait for SW to be ready
            let registration = await navigator.serviceWorker.ready;

            // Check current permission
            if (Notification.permission === 'denied') {
                console.log('Permission for notifications was denied');
                return;
            }

            // Get VAPID key from backend
            const { data: vapidData, error: vapidError } = await api.get<{ publicKey: string }>('/push/vapid-key');
            if (vapidError || !vapidData?.publicKey) {
                console.log('[WebPush] VAPID key not configured, skipping push subscription');
                return;
            }

            const convertedVapidKey = urlBase64ToUint8Array(vapidData.publicKey);

            // Subscribe
            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: convertedVapidKey
            });

            // Send to backend
            const { endpoint, keys } = subscription.toJSON();
            if (endpoint && keys) {
                await api.post('/push/register', {
                    endpoint,
                    p256dh: keys.p256dh,
                    auth: keys.auth,
                    userAgent: navigator.userAgent
                });
                console.log('Web Push subscribed!');
            }

        } catch (e) {
            console.error('Web Push subscription failed:', e);
        }
    }
};
