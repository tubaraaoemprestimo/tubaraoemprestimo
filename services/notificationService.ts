// 🔔 Notification Service - Sistema de Notificações 100% Real
// Tubarão Empréstimos - Supabase em Tempo Real

import { supabase } from './supabaseClient';

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

const applyAudienceFilter = (query: any, user: { email: string; role: string }) => {
    const role = (user.role || '').toUpperCase();

    if (role === 'ADMIN') {
        // Novo modelo com for_role
        return query.or('for_role.eq.ADMIN,for_role.eq.ALL');
    }

    return query.or(`customer_email.eq.${user.email},for_role.eq.ALL`);
};

const applyLegacyAudienceFilter = (query: any, user: { email: string; role: string }) => {
    const role = (user.role || '').toUpperCase();

    if (role === 'ADMIN') {
        return query.is('customer_email', null);
    }

    return query.eq('customer_email', user.email);
};

const needsLegacyFallback = (error: any): boolean => {
    const msg = String(error?.message || '').toLowerCase();
    return msg.includes('for_role') || (msg.includes('column') && msg.includes('does not exist'));
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
            let query = supabase
                .from('notifications')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(50);

            // Filtrar por público correto (admin x cliente)
            query = applyAudienceFilter(query, user);

            let { data, error } = await query;

            if (error && needsLegacyFallback(error)) {
                let fallbackQuery = supabase
                    .from('notifications')
                    .select('*')
                    .order('created_at', { ascending: false })
                    .limit(50);

                fallbackQuery = applyLegacyAudienceFilter(fallbackQuery, user);
                const fallback = await fallbackQuery;
                data = fallback.data;
                error = fallback.error;
            }

            if (error || !data) {
                console.error('Error fetching notifications:', error);
                return [];
            }

            return data.map((n: any) => ({
                id: n.id,
                type: (n.type?.toLowerCase() || 'info') as 'success' | 'warning' | 'info' | 'error',
                title: n.title,
                message: n.message,
                timestamp: n.created_at,
                read: n.read || false,
                actionUrl: n.link,
                customerEmail: n.customer_email,
                forRole: (n.for_role || (n.customer_email ? 'CLIENT' : 'ADMIN'))
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
            let query = supabase
                .from('notifications')
                .select('id', { count: 'exact', head: true })
                .eq('read', false);

            query = applyAudienceFilter(query, user);

            let { count, error } = await query;

            if (error && needsLegacyFallback(error)) {
                let fallbackQuery = supabase
                    .from('notifications')
                    .select('id', { count: 'exact', head: true })
                    .eq('read', false);

                fallbackQuery = applyLegacyAudienceFilter(fallbackQuery, user);
                const fallback = await fallbackQuery;
                count = fallback.count;
            }

            return count || 0;
        } catch {
            return 0;
        }
    },

    // ✅ Marcar como lida (REAL)
    markAsRead: async (id: string): Promise<void> => {
        await supabase
            .from('notifications')
            .update({ read: true })
            .eq('id', id);
    },

    // ✅ Marcar todas como lidas
    markAllAsRead: async (): Promise<void> => {
        const user = getCurrentUser();
        if (!user) return;

        try {
            let scopedQuery = applyAudienceFilter(
                supabase.from('notifications').select('id').eq('read', false),
                user
            );

            let { data: list, error } = await scopedQuery;

            if (error && needsLegacyFallback(error)) {
                const fallbackQuery = applyLegacyAudienceFilter(
                    supabase.from('notifications').select('id').eq('read', false),
                    user
                );
                const fallback = await fallbackQuery;
                list = fallback.data;
            }

            const ids = (list || []).map((n: any) => n.id);
            if (ids.length === 0) return;

            const { error: updateError } = await supabase
                .from('notifications')
                .update({ read: true })
                .in('id', ids);

            if (updateError) console.error('Erro ao marcar notificações como lidas:', updateError);
        } catch (e) {
            console.error('Exceção ao marcar notificações:', e);
        }
    },

    // 🗑️ Deletar notificação
    delete: async (id: string): Promise<void> => {
        await supabase.from('notifications').delete().eq('id', id);
    },

    // 🗑️ Limpar todas
    clearAll: async (): Promise<void> => {
        const user = getCurrentUser();
        if (!user) return;

        try {
            let scopedQuery = applyAudienceFilter(
                supabase.from('notifications').select('id').limit(1000),
                user
            );

            let { data: list, error } = await scopedQuery;

            if (error && needsLegacyFallback(error)) {
                const fallbackQuery = applyLegacyAudienceFilter(
                    supabase.from('notifications').select('id').limit(1000),
                    user
                );
                const fallback = await fallbackQuery;
                list = fallback.data;
            }

            const ids = (list || []).map((n: any) => n.id);
            if (ids.length === 0) return;

            const { error: deleteError } = await supabase
                .from('notifications')
                .delete()
                .in('id', ids);

            if (deleteError) console.error('Erro ao limpar notificações:', deleteError);
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

            let { data, error } = await supabase
                .from('notifications')
                .insert(payload)
                .select('id')
                .single();

            if (error && needsLegacyFallback(error)) {
                delete payload.for_role;
                const fallback = await supabase
                    .from('notifications')
                    .insert(payload)
                    .select('id')
                    .single();
                data = fallback.data;
                error = fallback.error;
            }

            if (!error && data) {
                playNotificationSound();
                sendBrowserNotification(notification.title, notification.message);
                return data.id;
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
        return notificationService.create({
            type: 'info',
            title: isLimpaNome ? '📝 Nova Solicitação - Limpa Nome' : '📝 Nova Solicitação',
            message: isLimpaNome
                ? `${clientName} solicitou o serviço Limpa Nome.`
                : `${clientName} solicitou um empréstimo de R$ ${amount.toLocaleString()}.`,
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

    // 📡 Escutar mudanças em tempo real
    subscribeToChanges: (callback: (notifications: Notification[]) => void): (() => void) => {
        const channel = supabase
            .channel('notifications-changes')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'notifications' },
                async () => {
                    const notifications = await notificationService.getAll();
                    callback(notifications);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    },

    // Alias para compatibilidade com código legado
    subscribe: (callback: (notifications: Notification[]) => void): (() => void) => {
        notificationService.getAll().then(callback);
        return notificationService.subscribeToChanges(callback);
    }
};
