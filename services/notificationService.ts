// 🔔 Notification Service - Sistema de Notificações 100% Real
// Tubarão Empréstimos - API REST

import { api } from './apiClient';

export interface Notification {
    id: string;
    type: 'success' | 'warning' | 'info' | 'error';
    title: string;
    message: string;
    timestamp: string;
    read: boolean;
    actionUrl?: string;
    customerEmail?: string;
    forRole?: 'CLIENT' | 'ADMIN' | 'ALL';
}

// Get current user from localStorage
const getCurrentUser = (): { email: string; role: string } | null => {
    try {
        const user = JSON.parse(localStorage.getItem('tubarao_user') || '{}');
        return user.email ? user : null;
    } catch {
        return null;
    }
};

// Som de notificação
const playNotificationSound = (): void => {
    try {
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

// Send browser push notification
const sendBrowserNotification = (title: string, body: string): void => {
    if (Notification.permission === 'granted') {
        new Notification(title, {
            body,
            icon: '/Logo.png',
            badge: '/Logo.png',
            tag: 'tubarao-notification'
        });
    }
};

export const notificationService = {
    // 📋 Buscar notificações do banco (REAL)
    getAll: async (): Promise<Notification[]> => {
        const user = getCurrentUser();
        if (!user) return [];

        try {
            const role = (user.role || '').toUpperCase();
            const params = new URLSearchParams();
            params.set('limit', '50');
            if (role === 'ADMIN') {
                params.set('forRole', 'ADMIN');
            } else {
                params.set('email', user.email);
            }

            const { data, error } = await api.get<any[]>(`/notifications?${params.toString()}`);

            if (error || !data) {
                console.error('Error fetching notifications:', error);
                return [];
            }

            return (data as any[]).map((n: any) => ({
                id: n.id,
                type: (n.type?.toLowerCase() || 'info') as 'success' | 'warning' | 'info' | 'error',
                title: n.title,
                message: n.message,
                timestamp: n.created_at || n.createdAt,
                read: n.read || false,
                actionUrl: n.link,
                customerEmail: n.customer_email || n.customerEmail,
                forRole: (n.for_role || n.forRole || (n.customer_email || n.customerEmail ? 'CLIENT' : 'ADMIN'))
            }));
        } catch {
            return [];
        }
    },

    // 🔢 Contar não lidas
    getUnreadCount: async (): Promise<number> => {
        const user = getCurrentUser();
        if (!user) return 0;

        try {
            const role = (user.role || '').toUpperCase();
            const params = new URLSearchParams();
            params.set('unread', 'true');
            if (role === 'ADMIN') {
                params.set('forRole', 'ADMIN');
            } else {
                params.set('email', user.email);
            }

            const { data, error } = await api.get<any>(`/notifications/count?${params.toString()}`);

            if (error) return 0;

            return (data as any)?.count || 0;
        } catch {
            return 0;
        }
    },

    // ✅ Marcar como lida (REAL)
    markAsRead: async (id: string): Promise<void> => {
        await api.put(`/notifications/${id}/read`, { read: true });
    },

    // ✅ Marcar todas como lidas
    markAllAsRead: async (): Promise<void> => {
        const user = getCurrentUser();
        if (!user) return;

        try {
            const role = (user.role || '').toUpperCase();
            const params: any = {};
            if (role === 'ADMIN') {
                params.forRole = 'ADMIN';
            } else {
                params.email = user.email;
            }

            await api.put('/notifications/read-all', params);
        } catch (e) {
            console.error('Exceção ao marcar notificações:', e);
        }
    },

    // 🗑️ Deletar notificação
    delete: async (id: string): Promise<void> => {
        await api.delete(`/notifications/${id}`);
    },

    // 🗑️ Limpar todas
    clearAll: async (): Promise<void> => {
        const user = getCurrentUser();
        if (!user) return;

        try {
            const role = (user.role || '').toUpperCase();
            const params: any = {};
            if (role === 'ADMIN') {
                params.forRole = 'ADMIN';
            } else {
                params.email = user.email;
            }

            await api.delete('/notifications/clear-all');
        } catch (e) {
            console.error('Exceção ao limpar notificações:', e);
        }
    },

    // 🔔 Criar Notificação (REAL - salva no banco)
    create: async (notification: {
        type: 'success' | 'warning' | 'info' | 'error';
        title: string;
        message: string;
        customerEmail?: string | null;
        link?: string;
        forRole?: 'CLIENT' | 'ADMIN' | 'ALL';
    }): Promise<string | null> => {
        try {
            const inferredRole = notification.forRole || (notification.customerEmail ? 'CLIENT' : 'ADMIN');

            if (inferredRole === 'CLIENT' && !notification.customerEmail) {
                console.warn('[Notification] skipping CLIENT notification without customerEmail', notification.title);
                return null;
            }

            const payload: any = {
                type: notification.type.toUpperCase(),
                title: notification.title,
                message: notification.message,
                customer_email: notification.customerEmail || null,
                link: notification.link || null,
                read: false,
                for_role: inferredRole
            };

            const { data, error } = await api.post<any>('/notifications', payload);

            if (!error && data) {
                playNotificationSound();
                sendBrowserNotification(notification.title, notification.message);
                return (data as any).id || null;
            }
            return null;
        } catch {
            return null;
        }
    },

    // 🎯 Notificações Específicas do Sistema
    notifyLoanApproved: async (clientEmail: string, clientName: string, amount: number) => {
        return notificationService.create({
            type: 'success',
            title: '✅ Empréstimo Aprovado!',
            message: `Parabéns! Seu empréstimo de R$ ${amount.toLocaleString()} foi aprovado.`,
            customerEmail: clientEmail,
            link: '/client/contracts',
            forRole: 'CLIENT'
        });
    },

    notifyLoanRejected: async (clientEmail: string, clientName: string) => {
        return notificationService.create({
            type: 'error',
            title: '❌ Solicitação Não Aprovada',
            message: 'Infelizmente sua solicitação não foi aprovada desta vez.',
            customerEmail: clientEmail,
            forRole: 'CLIENT'
        });
    },

    notifyNewRequest: async (clientName: string, amount: number, profileType?: string) => {
        const isLimpaNome = profileType === 'LIMPA_NOME';
        const isMoto = profileType === 'MOTO';
        const title = isLimpaNome ? '📝 Nova Solicitação - Limpa Nome'
            : isMoto ? '🏍️ Nova Solicitação - Financiamento Moto'
            : '📝 Nova Solicitação';
        const message = isLimpaNome
            ? `${clientName} solicitou o serviço Limpa Nome.`
            : isMoto
            ? `${clientName} solicitou financiamento de motocicleta Honda Pop 110i 2026.`
            : `${clientName} solicitou um empréstimo de R$ ${amount.toLocaleString()}.`;
        return notificationService.create({
            type: 'info',
            title,
            message,
            customerEmail: null, // Para admin
            forRole: 'ADMIN'
        });
    },

    notifyPaymentReceived: async (clientEmail: string, amount: number) => {
        return notificationService.create({
            type: 'success',
            title: '💰 Pagamento Confirmado',
            message: `Seu pagamento de R$ ${amount.toLocaleString()} foi confirmado.`,
            customerEmail: clientEmail,
            forRole: 'CLIENT'
        });
    },

    notifyPaymentDue: async (clientEmail: string, dueDate: string, amount: number) => {
        return notificationService.create({
            type: 'warning',
            title: '⚠️ Parcela Vencendo',
            message: `Sua fatura de R$ ${amount.toLocaleString()} vence em ${dueDate}. Evite juros.`,
            customerEmail: clientEmail,
            link: '/client/statement',
            forRole: 'CLIENT'
        });
    },

    notifyOfferSent: async (clientEmail: string, amount: number, installments: number) => {
        return notificationService.create({
            type: 'info',
            title: '🎁 Nova Oferta de Parcelamento',
            message: `Você tem uma oferta especial de R$ ${amount.toLocaleString()} em ${installments}x!`,
            customerEmail: clientEmail,
            link: '/client/dashboard',
            forRole: 'CLIENT'
        });
    },

    notifyCouponReceived: async (clientEmail: string, code: string, discount: number) => {
        return notificationService.create({
            type: 'success',
            title: '🎫 Novo Cupom Disponível',
            message: `Use o cupom ${code} e ganhe ${discount}% de desconto!`,
            customerEmail: clientEmail,
            link: '/client/dashboard',
            forRole: 'CLIENT'
        });
    },

    // 🔐 Permissões do Navegador
    requestBrowserPermission: async (): Promise<boolean> => {
        if (!('Notification' in window)) return false;
        if (Notification.permission === 'granted') return true;
        if (Notification.permission === 'denied') return false;
        const permission = await Notification.requestPermission();
        return permission === 'granted';
    },

    checkPermission: (): 'granted' | 'denied' | 'default' | 'unsupported' => {
        if (!('Notification' in window)) return 'unsupported';
        return Notification.permission;
    },

    // 📡 Escutar mudanças em tempo real (Polling)
    subscribeToChanges: (callback: (notifications: Notification[]) => void): (() => void) => {
        // Poll every 30 seconds as a replacement for real-time channels
        const interval = setInterval(async () => {
            const notifications = await notificationService.getAll();
            callback(notifications);
        }, 30000);

        return () => {
            clearInterval(interval);
        };
    },

    // Alias para compatibilidade com código legado
    subscribe: (callback: (notifications: Notification[]) => void): (() => void) => {
        notificationService.getAll().then(callback);
        return notificationService.subscribeToChanges(callback);
    }
};
