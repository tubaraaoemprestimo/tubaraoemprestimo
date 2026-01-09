
// 🔔 Notification Service - Sistema de Notificações Push
// Tubarão Empréstimos - Notificações em Tempo Real

export interface Notification {
    id: string;
    type: 'success' | 'warning' | 'info' | 'error';
    title: string;
    message: string;
    timestamp: string;
    read: boolean;
    actionUrl?: string;
    actionLabel?: string;
    icon?: string;
}

export interface NotificationPreferences {
    enablePush: boolean;
    enableSound: boolean;
    enableEmail: boolean;
    paymentReminders: boolean;
    approvalAlerts: boolean;
    marketingMessages: boolean;
}

const STORAGE_KEY = 'tubarao_notifications';
const PREFS_KEY = 'tubarao_notification_prefs';
const MAX_NOTIFICATIONS = 50;

const loadNotifications = (): Notification[] => {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        return stored ? JSON.parse(stored) : [];
    } catch {
        return [];
    }
};

const saveNotifications = (notifications: Notification[]): void => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications.slice(0, MAX_NOTIFICATIONS)));
};

const loadPreferences = (): NotificationPreferences => {
    try {
        const stored = localStorage.getItem(PREFS_KEY);
        return stored ? JSON.parse(stored) : {
            enablePush: true,
            enableSound: true,
            enableEmail: false,
            paymentReminders: true,
            approvalAlerts: true,
            marketingMessages: false
        };
    } catch {
        return {
            enablePush: true,
            enableSound: true,
            enableEmail: false,
            paymentReminders: true,
            approvalAlerts: true,
            marketingMessages: false
        };
    }
};

// Som de notificação
const playNotificationSound = (): void => {
    const prefs = loadPreferences();
    if (!prefs.enableSound) return;

    try {
        // Criar um beep simples usando Web Audio API
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.frequency.value = 800;
        oscillator.type = 'sine';
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.3);
    } catch (e) {
        console.log('Audio not supported');
    }
};

// Request browser notification permission
const requestPermission = async (): Promise<boolean> => {
    if (!('Notification' in window)) return false;

    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') return false;

    const permission = await Notification.requestPermission();
    return permission === 'granted';
};

// Send browser push notification
const sendBrowserNotification = (title: string, body: string, icon?: string): void => {
    const prefs = loadPreferences();
    if (!prefs.enablePush) return;

    if (Notification.permission === 'granted') {
        new Notification(title, {
            body,
            icon: icon || '/Logo.png',
            badge: '/Logo.png',
            tag: 'tubarao-notification',
            requireInteraction: false
        });
    }
};

// Event listeners for real-time updates
type NotificationListener = (notifications: Notification[]) => void;
const listeners: Set<NotificationListener> = new Set();

const notifyListeners = () => {
    const notifications = loadNotifications();
    listeners.forEach(listener => listener(notifications));
};

export const notificationService = {
    // 📋 Gerenciamento de Notificações
    getAll: (): Notification[] => {
        return loadNotifications();
    },

    getUnreadCount: (): number => {
        return loadNotifications().filter(n => !n.read).length;
    },

    markAsRead: (id: string): void => {
        const notifications = loadNotifications();
        const notification = notifications.find(n => n.id === id);
        if (notification) {
            notification.read = true;
            saveNotifications(notifications);
            notifyListeners();
        }
    },

    markAllAsRead: (): void => {
        const notifications = loadNotifications();
        notifications.forEach(n => n.read = true);
        saveNotifications(notifications);
        notifyListeners();
    },

    delete: (id: string): void => {
        let notifications = loadNotifications();
        notifications = notifications.filter(n => n.id !== id);
        saveNotifications(notifications);
        notifyListeners();
    },

    clearAll: (): void => {
        saveNotifications([]);
        notifyListeners();
    },

    // 🔔 Criar Notificações
    create: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>): Notification => {
        const newNotification: Notification = {
            ...notification,
            id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            timestamp: new Date().toISOString(),
            read: false
        };

        const notifications = loadNotifications();
        notifications.unshift(newNotification);
        saveNotifications(notifications);

        // Trigger sound and browser notification
        playNotificationSound();
        sendBrowserNotification(notification.title, notification.message, notification.icon);

        notifyListeners();
        return newNotification;
    },

    // 🎯 Notificações Específicas do Sistema
    notifyLoanApproved: (clientName: string, amount: number): Notification => {
        return notificationService.create({
            type: 'success',
            title: '✅ Empréstimo Aprovado!',
            message: `O empréstimo de ${clientName} no valor de R$ ${amount.toLocaleString()} foi aprovado com sucesso.`,
            actionUrl: '/admin/requests',
            actionLabel: 'Ver Detalhes'
        });
    },

    notifyLoanRejected: (clientName: string): Notification => {
        return notificationService.create({
            type: 'error',
            title: '❌ Empréstimo Reprovado',
            message: `A solicitação de ${clientName} foi reprovada.`,
            actionUrl: '/admin/requests',
            actionLabel: 'Ver Detalhes'
        });
    },

    notifyNewRequest: (clientName: string, amount: number): Notification => {
        return notificationService.create({
            type: 'info',
            title: '📝 Nova Solicitação',
            message: `${clientName} solicitou um empréstimo de R$ ${amount.toLocaleString()}.`,
            actionUrl: '/admin/requests',
            actionLabel: 'Analisar'
        });
    },

    notifyPaymentReceived: (clientName: string, amount: number): Notification => {
        return notificationService.create({
            type: 'success',
            title: '💰 Pagamento Recebido',
            message: `Pagamento de R$ ${amount.toLocaleString()} recebido de ${clientName}.`,
            actionUrl: '/admin/customers',
            actionLabel: 'Ver Cliente'
        });
    },

    notifyPaymentDue: (clientName: string, dueDate: string, amount: number): Notification => {
        return notificationService.create({
            type: 'warning',
            title: '⚠️ Parcela a Vencer',
            message: `Parcela de ${clientName} vence em ${dueDate}. Valor: R$ ${amount.toLocaleString()}.`,
            actionUrl: '/admin/customers',
            actionLabel: 'Ver Cliente'
        });
    },

    notifyPaymentLate: (clientName: string, daysLate: number, amount: number): Notification => {
        return notificationService.create({
            type: 'error',
            title: '🚨 Parcela em Atraso',
            message: `${clientName} está com ${daysLate} dias de atraso. Valor: R$ ${amount.toLocaleString()}.`,
            actionUrl: '/admin/customers',
            actionLabel: 'Cobrar'
        });
    },

    notifyWhatsAppConnected: (): Notification => {
        return notificationService.create({
            type: 'success',
            title: '📱 WhatsApp Conectado',
            message: 'O WhatsApp foi conectado com sucesso. As mensagens automáticas estão ativas.',
            actionUrl: '/admin/settings',
            actionLabel: 'Configurações'
        });
    },

    notifyWhatsAppDisconnected: (): Notification => {
        return notificationService.create({
            type: 'error',
            title: '📱 WhatsApp Desconectado',
            message: 'A conexão com o WhatsApp foi perdida. Reconecte para continuar enviando mensagens.',
            actionUrl: '/admin/settings',
            actionLabel: 'Reconectar'
        });
    },

    // ⚙️ Preferências
    getPreferences: (): NotificationPreferences => {
        return loadPreferences();
    },

    updatePreferences: (prefs: Partial<NotificationPreferences>): void => {
        const current = loadPreferences();
        const updated = { ...current, ...prefs };
        localStorage.setItem(PREFS_KEY, JSON.stringify(updated));
    },

    // 🔐 Permissões do Navegador
    requestBrowserPermission: requestPermission,

    checkPermission: (): 'granted' | 'denied' | 'default' | 'unsupported' => {
        if (!('Notification' in window)) return 'unsupported';
        return Notification.permission;
    },

    // 📡 Real-time Listeners
    subscribe: (listener: NotificationListener): () => void => {
        listeners.add(listener);
        // Return unsubscribe function
        return () => listeners.delete(listener);
    },

    // 🔄 Simular notificações (para demo)
    simulateActivity: (): void => {
        const activities = [
            () => notificationService.notifyPaymentReceived('Ana Souza', 450),
            () => notificationService.notifyNewRequest('Pedro Santos', 5000),
            () => notificationService.notifyPaymentDue('Carlos Silva', '20/12/2024', 650),
        ];
        const random = activities[Math.floor(Math.random() * activities.length)];
        random();
    }
};
