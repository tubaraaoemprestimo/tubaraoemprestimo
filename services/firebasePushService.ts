// 🔥 Firebase Push Notification Service
// Tubarão Empréstimos - Push Notifications via FCM

import { supabase } from './supabaseClient';

// Firebase config - Projeto tubarao-emprestimo
const FIREBASE_CONFIG = {
    apiKey: "AIzaSyA4aFPY5lU-H84KI_m6eOPv081uDqbTFeM",
    authDomain: "tubarao-emprestimo.firebaseapp.com",
    projectId: "tubarao-emprestimo",
    storageBucket: "tubarao-emprestimo.firebasestorage.app",
    messagingSenderId: "473035787766",
    appId: "1:473035787766:web:a55b95d9e94898946a0bd7",
    measurementId: "G-KETN8H75KK",
    // VAPID Key para Web Push
    vapidKey: "BOMq1Pa4W1rf_lTYyLDbXajQ5kwndPosySx5Clbn758jqUbo_EHfTK5UQAs0s__Nt76CN9wlTTnaTeSgh2RZNUU"
};

// Get config from environment or use defaults
const getFirebaseConfig = () => {
    return {
        ...FIREBASE_CONFIG,
        apiKey: (window as any).__FIREBASE_API_KEY__ || FIREBASE_CONFIG.apiKey,
        vapidKey: (window as any).__FIREBASE_VAPID_KEY__ || FIREBASE_CONFIG.vapidKey,
    };
};

// Firebase app instance (lazy loaded)
let firebaseApp: any = null;
let messaging: any = null;

// Initialize Firebase lazily
const initFirebase = async () => {
    if (firebaseApp) return { firebaseApp, messaging };

    try {
        // Dynamic import to avoid loading Firebase if not needed
        const { initializeApp } = await import('firebase/app');
        const { getMessaging, getToken, onMessage } = await import('firebase/messaging');

        const config = getFirebaseConfig();
        firebaseApp = initializeApp(config);
        messaging = getMessaging(firebaseApp);

        console.log('[FCM] Firebase initialized');
        return { firebaseApp, messaging, getToken, onMessage };
    } catch (error) {
        console.error('[FCM] Failed to initialize Firebase:', error);
        return { firebaseApp: null, messaging: null };
    }
};

// Get current user
const getCurrentUser = (): { id: string; email: string } | null => {
    try {
        const user = JSON.parse(localStorage.getItem('tubarao_user') || '{}');
        return user.id ? user : null;
    } catch {
        return null;
    }
};

export const firebasePushService = {
    // ============================================
    // INITIALIZATION
    // ============================================

    /**
     * Initialize Firebase and request notification permission
     */
    init: async (): Promise<boolean> => {
        try {
            // Check if notifications are supported
            if (!('Notification' in window)) {
                console.log('[FCM] Notifications not supported');
                return false;
            }

            // Check if service worker is supported
            if (!('serviceWorker' in navigator)) {
                console.log('[FCM] Service Workers not supported');
                return false;
            }

            // Initialize Firebase
            const firebase = await initFirebase();
            if (!firebase.messaging) {
                console.log('[FCM] Firebase messaging not available');
                return false;
            }

            console.log('[FCM] Initialized successfully');
            return true;
        } catch (error) {
            console.error('[FCM] Initialization error:', error);
            return false;
        }
    },

    /**
     * Request notification permission and get FCM token
     */
    requestPermissionAndGetToken: async (): Promise<string | null> => {
        try {
            // Request permission
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') {
                console.log('[FCM] Notification permission denied');
                return null;
            }

            // Initialize Firebase
            const firebase = await initFirebase();
            if (!firebase.messaging || !firebase.getToken) {
                return null;
            }

            const config = getFirebaseConfig();

            // Register service worker first
            let swRegistration: ServiceWorkerRegistration | undefined;
            try {
                swRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
                console.log('[FCM] Service worker registered');
            } catch (err) {
                console.log('[FCM] Using existing service worker');
                swRegistration = await navigator.serviceWorker.ready;
            }

            // Get FCM token
            const token = await firebase.getToken(firebase.messaging, {
                vapidKey: config.vapidKey,
                serviceWorkerRegistration: swRegistration
            });

            if (token) {
                console.log('[FCM] Token obtained:', token.substring(0, 20) + '...');

                // Save token to database
                await firebasePushService.saveTokenToDatabase(token);

                return token;
            }

            console.log('[FCM] No token available');
            return null;
        } catch (error) {
            console.error('[FCM] Error getting token:', error);
            return null;
        }
    },

    /**
     * Save FCM token to Supabase for the current user
     */
    saveTokenToDatabase: async (token: string): Promise<boolean> => {
        try {
            const user = getCurrentUser();
            if (!user) {
                console.log('[FCM] No user logged in, skipping token save');
                return false;
            }

            // Get device info
            const deviceInfo = {
                userAgent: navigator.userAgent,
                platform: navigator.platform,
                language: navigator.language
            };

            // Upsert token in push_subscriptions table
            const { error } = await supabase.from('push_subscriptions').upsert({
                user_email: user.email,
                fcm_token: token,
                device_type: /Mobile|Android|iPhone/i.test(navigator.userAgent) ? 'mobile' : 'desktop',
                device_info: deviceInfo,
                is_active: true,
                last_used_at: new Date().toISOString()
            }, {
                onConflict: 'user_email,fcm_token'
            });

            if (error) {
                console.error('[FCM] Error saving token:', error);
                return false;
            }

            console.log('[FCM] Token saved to database');
            return true;
        } catch (error) {
            console.error('[FCM] Error saving token:', error);
            return false;
        }
    },

    /**
     * Listen for foreground messages
     */
    onForegroundMessage: (callback: (payload: any) => void): (() => void) | null => {
        try {
            initFirebase().then(({ messaging, onMessage }) => {
                if (messaging && onMessage) {
                    onMessage(messaging, (payload) => {
                        console.log('[FCM] Foreground message:', payload);
                        callback(payload);
                    });
                }
            });

            return () => {
                // Cleanup if needed
            };
        } catch (error) {
            console.error('[FCM] Error setting up foreground listener:', error);
            return null;
        }
    },

    // ============================================
    // SERVER-SIDE (via Edge Function)
    // ============================================

    /**
     * Send push notification via Supabase Edge Function
     */
    sendPush: async (options: {
        to: string | string[];  // User email(s) or 'all'
        title: string;
        body: string;
        icon?: string;
        data?: Record<string, string>;
        link?: string;
    }): Promise<{ success: boolean; sent: number; failed: number }> => {
        try {
            const session = await supabase.auth.getSession();
            const token = session.data.session?.access_token;

            if (!token) {
                console.error('[FCM] No auth token available');
                return { success: false, sent: 0, failed: 0 };
            }

            const supabaseUrl = 'https://cwhiujeragsethxjekkb.supabase.co';

            const response = await fetch(`${supabaseUrl}/functions/v1/send-push`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    to: options.to,
                    notification: {
                        title: options.title,
                        body: options.body,
                        icon: options.icon || '/Logo.png'
                    },
                    data: {
                        ...options.data,
                        link: options.link || '/'
                    }
                })
            });

            const result = await response.json();
            console.log('[FCM] Send result:', result);

            return {
                success: result.success || false,
                sent: result.sent || 0,
                failed: result.failed || 0
            };
        } catch (error) {
            console.error('[FCM] Send error:', error);
            return { success: false, sent: 0, failed: 0 };
        }
    },

    // ============================================
    // NOTIFICATION HELPERS
    // ============================================

    /**
     * Notify about new loan request (to admin)
     */
    notifyNewRequest: async (clientName: string, amount: number): Promise<void> => {
        await firebasePushService.sendPush({
            to: 'admin', // Special keyword to send to all admins
            title: '📝 Nova Solicitação',
            body: `${clientName} solicitou R$ ${amount.toLocaleString('pt-BR')}`,
            link: '/admin/requests'
        });
    },

    /**
     * Notify loan approval (to client)
     */
    notifyLoanApproved: async (clientEmail: string, amount: number): Promise<void> => {
        await firebasePushService.sendPush({
            to: clientEmail,
            title: '✅ Empréstimo Aprovado!',
            body: `Seu empréstimo de R$ ${amount.toLocaleString('pt-BR')} foi aprovado!`,
            link: '/client/contracts'
        });
    },

    /**
     * Notify loan rejection (to client)
     */
    notifyLoanRejected: async (clientEmail: string): Promise<void> => {
        await firebasePushService.sendPush({
            to: clientEmail,
            title: '❌ Solicitação Não Aprovada',
            body: 'Infelizmente sua solicitação não foi aprovada neste momento.',
            link: '/client/dashboard'
        });
    },

    /**
     * Notify installment due (to client)
     */
    notifyInstallmentDue: async (clientEmail: string, amount: number, dueDate: string): Promise<void> => {
        const date = new Date(dueDate).toLocaleDateString('pt-BR');
        await firebasePushService.sendPush({
            to: clientEmail,
            title: '⚠️ Parcela Vencendo',
            body: `Sua parcela de R$ ${amount.toLocaleString('pt-BR')} vence em ${date}`,
            link: '/client/contracts'
        });
    },

    /**
     * Notify installment overdue (to client)
     */
    notifyInstallmentOverdue: async (clientEmail: string, amount: number, daysLate: number): Promise<void> => {
        await firebasePushService.sendPush({
            to: clientEmail,
            title: '🚨 Parcela em Atraso',
            body: `Você tem uma parcela de R$ ${amount.toLocaleString('pt-BR')} atrasada há ${daysLate} dias`,
            link: '/client/contracts'
        });
    },

    /**
     * Notify payment confirmed (to client and admin)
     */
    notifyPaymentConfirmed: async (clientEmail: string, clientName: string, amount: number): Promise<void> => {
        // Notify client
        await firebasePushService.sendPush({
            to: clientEmail,
            title: '💰 Pagamento Confirmado',
            body: `Seu pagamento de R$ ${amount.toLocaleString('pt-BR')} foi confirmado!`,
            link: '/client/contracts'
        });

        // Notify admin
        await firebasePushService.sendPush({
            to: 'admin',
            title: '💰 Pagamento Recebido',
            body: `${clientName} pagou R$ ${amount.toLocaleString('pt-BR')}`,
            link: '/admin/customers'
        });
    },

    /**
     * Notify document request (to client)
     */
    notifyDocumentRequest: async (clientEmail: string, docDescription: string): Promise<void> => {
        await firebasePushService.sendPush({
            to: clientEmail,
            title: '📋 Documento Solicitado',
            body: `Por favor, envie: ${docDescription}`,
            link: '/client/dashboard'
        });
    },

    // ============================================
    // UTILITY
    // ============================================

    /**
     * Check if push notifications are supported and enabled
     */
    isSupported: (): boolean => {
        return 'Notification' in window && 'serviceWorker' in navigator;
    },

    /**
     * Get current notification permission status
     */
    getPermissionStatus: (): 'granted' | 'denied' | 'default' | 'unsupported' => {
        if (!('Notification' in window)) return 'unsupported';
        return Notification.permission;
    },

    /**
     * Remove FCM token when user logs out
     */
    removeToken: async (): Promise<void> => {
        const user = getCurrentUser();
        if (!user) return;

        try {
            await supabase
                .from('push_subscriptions')
                .update({ is_active: false })
                .eq('user_email', user.email);

            console.log('[FCM] Token deactivated');
        } catch (error) {
            console.error('[FCM] Error removing token:', error);
        }
    }
};

export default firebasePushService;
