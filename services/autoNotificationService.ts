// 🔔 Auto Notification Service - Notificações Automáticas
// Triggers automáticos para enviar notificações ao cliente
// Agora integrado com Firebase Push Notifications

import { supabase } from './supabaseClient';
import { scoreService } from './scoreService';
import { firebasePushService } from './firebasePushService';

export const autoNotificationService = {
    // ============================================
    // CRIAR NOTIFICAÇÃO
    // ============================================

    createNotification: async (
        customerEmail: string,
        title: string,
        message: string,
        type: 'INFO' | 'WARNING' | 'ALERT' | 'SUCCESS' = 'INFO',
        link?: string
    ): Promise<boolean> => {
        try {
            const { error } = await supabase.from('notifications').insert({
                customer_email: customerEmail,
                title,
                message,
                type,
                link: link || null,
                read: false
            });

            if (error) {
                console.error('Error creating notification:', error);
                return false;
            }

            return true;
        } catch (err) {
            console.error('Notification error:', err);
            return false;
        }
    },

    // ============================================
    // NOTIFICAÇÕES DE EMPRÉSTIMO
    // ============================================

    // Solicitação recebida
    onLoanRequested: async (customerEmail: string, amount: number, clientName?: string): Promise<void> => {
        // Notificação no banco
        await autoNotificationService.createNotification(
            customerEmail,
            'Solicitação Recebida ✓',
            `Recebemos sua solicitação de R$ ${amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}. Estamos analisando seus dados.`,
            'INFO',
            '/client/contracts'
        );

        // Push para o cliente
        firebasePushService.sendPush({
            to: customerEmail,
            title: '📝 Solicitação Recebida',
            body: `Recebemos sua solicitação de R$ ${amount.toLocaleString('pt-BR')}`,
            link: '/client/contracts'
        }).catch(() => { });

        // Push para admin
        firebasePushService.sendPush({
            to: 'admin',
            title: '📝 Nova Solicitação',
            body: `${clientName || 'Cliente'} solicitou R$ ${amount.toLocaleString('pt-BR')}`,
            link: '/admin/requests'
        }).catch(() => { });
    },

    // Empréstimo aprovado
    onLoanApproved: async (customerEmail: string, amount: number): Promise<void> => {
        await autoNotificationService.createNotification(
            customerEmail,
            'Empréstimo Aprovado! 🎉',
            `Parabéns! Seu empréstimo de R$ ${amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} foi aprovado! O valor será liberado em breve.`,
            'SUCCESS',
            '/client/contracts'
        );

        // Push para o cliente
        firebasePushService.sendPush({
            to: customerEmail,
            title: '✅ Empréstimo Aprovado!',
            body: `Parabéns! Seu empréstimo de R$ ${amount.toLocaleString('pt-BR')} foi aprovado!`,
            link: '/client/contracts'
        }).catch(() => { });
    },

    // Empréstimo rejeitado
    onLoanRejected: async (customerEmail: string, reason?: string): Promise<void> => {
        await autoNotificationService.createNotification(
            customerEmail,
            'Solicitação Não Aprovada',
            reason || 'Infelizmente sua solicitação não foi aprovada neste momento. Tente novamente em 30 dias.',
            'ALERT',
            '/client/dashboard'
        );

        // Push para o cliente
        firebasePushService.sendPush({
            to: customerEmail,
            title: '❌ Solicitação Não Aprovada',
            body: reason || 'Sua solicitação não foi aprovada neste momento.',
            link: '/client/dashboard'
        }).catch(() => { });
    },

    // ============================================
    // NOTIFICAÇÕES DE PAGAMENTO
    // ============================================

    // Parcela vencendo (3 dias antes)
    onInstallmentDueSoon: async (customerEmail: string, amount: number, dueDate: string): Promise<void> => {
        const date = new Date(dueDate).toLocaleDateString('pt-BR');
        await autoNotificationService.createNotification(
            customerEmail,
            'Parcela Vencendo',
            `Sua parcela de R$ ${amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} vence em ${date}. Evite juros!`,
            'WARNING',
            '/client/contracts'
        );
    },

    // Parcela vencendo hoje
    onInstallmentDueToday: async (customerEmail: string, amount: number): Promise<void> => {
        await autoNotificationService.createNotification(
            customerEmail,
            '⚠️ Parcela Vence Hoje!',
            `Sua parcela de R$ ${amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} vence HOJE. Pague agora para evitar multa.`,
            'ALERT',
            '/client/contracts'
        );
    },

    // Parcela atrasada
    onInstallmentOverdue: async (customerEmail: string, amount: number, daysLate: number): Promise<void> => {
        await autoNotificationService.createNotification(
            customerEmail,
            '🚨 Parcela em Atraso',
            `Você possui uma parcela de R$ ${amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} em atraso há ${daysLate} dia(s). Regularize para evitar juros adicionais.`,
            'ALERT',
            '/client/contracts'
        );

        // Atualizar score por atraso
        await scoreService.onPaymentLate(customerEmail, daysLate);
    },

    // Pagamento confirmado
    onPaymentConfirmed: async (customerEmail: string, amount: number, wasOnTime: boolean, wasEarly: boolean): Promise<void> => {
        let message: string;

        if (wasEarly) {
            message = `Pagamento antecipado de R$ ${amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} confirmado! Seu score aumentou. 🌟`;
            await scoreService.onPaymentEarly(customerEmail);
        } else if (wasOnTime) {
            message = `Pagamento de R$ ${amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} confirmado! Obrigado por pagar em dia.`;
            await scoreService.onPaymentOnTime(customerEmail);
        } else {
            message = `Pagamento de R$ ${amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} confirmado!`;
        }

        await autoNotificationService.createNotification(
            customerEmail,
            'Pagamento Confirmado ✓',
            message,
            'SUCCESS',
            '/client/contracts'
        );
    },

    // ============================================
    // NOTIFICAÇÕES DE INDICAÇÃO
    // ============================================

    // Indicação recebida
    onReferralReceived: async (referrerEmail: string, referredName: string): Promise<void> => {
        await autoNotificationService.createNotification(
            referrerEmail,
            'Nova Indicação Recebida! 👥',
            `${referredName} usou seu código de indicação. Você receberá bônus quando a indicação for aprovada.`,
            'INFO',
            '/client/profile'
        );
    },

    // Bônus de indicação creditado
    onReferralBonusPaid: async (referrerEmail: string, referredName: string, bonusAmount: number): Promise<void> => {
        await autoNotificationService.createNotification(
            referrerEmail,
            'Bônus de Indicação! 💰',
            `${referredName} contratou através da sua indicação! Você ganhou R$ ${bonusAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} de bônus.`,
            'SUCCESS',
            '/client/profile'
        );
    },

    // ============================================
    // NOTIFICAÇÕES DE SISTEMA
    // ============================================

    // Documento pendente
    onDocumentRequired: async (customerEmail: string, documentType: string): Promise<void> => {
        await autoNotificationService.createNotification(
            customerEmail,
            'Documento Pendente',
            `Por favor, envie seu ${documentType} para dar continuidade à sua solicitação.`,
            'WARNING',
            '/client/documents'
        );
    },

    // Oferta pré-aprovada
    onPreApprovedOffer: async (customerEmail: string, amount: number): Promise<void> => {
        await autoNotificationService.createNotification(
            customerEmail,
            'Oferta Exclusiva! 🌟',
            `Você tem R$ ${amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} pré-aprovados! Aproveite essa oferta especial.`,
            'SUCCESS',
            '/client/dashboard'
        );
    },

    // ============================================
    // VERIFICAÇÃO DE PARCELAS (executar periodicamente)
    // ============================================

    checkDueInstallments: async (): Promise<void> => {
        const today = new Date();
        const threeDaysFromNow = new Date(today);
        threeDaysFromNow.setDate(today.getDate() + 3);

        // Buscar parcelas que vencem em 3 dias
        const { data: dueSoon } = await supabase
            .from('installments')
            .select('id, due_date, amount, loans(customers(email))')
            .eq('status', 'OPEN')
            .gte('due_date', today.toISOString().split('T')[0])
            .lte('due_date', threeDaysFromNow.toISOString().split('T')[0]);

        if (dueSoon) {
            for (const installment of dueSoon) {
                const customerEmail = (installment as any).loans?.customers?.email;
                if (customerEmail) {
                    await autoNotificationService.onInstallmentDueSoon(
                        customerEmail,
                        installment.amount,
                        installment.due_date
                    );
                }
            }
        }

        // Buscar parcelas atrasadas
        const { data: overdue } = await supabase
            .from('installments')
            .select('id, due_date, amount, loans(customers(email))')
            .eq('status', 'OPEN')
            .lt('due_date', today.toISOString().split('T')[0]);

        if (overdue) {
            for (const installment of overdue) {
                const customerEmail = (installment as any).loans?.customers?.email;
                if (customerEmail) {
                    const dueDate = new Date(installment.due_date);
                    const daysLate = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

                    // Só notificar em certos intervalos (1, 3, 7, 15, 30 dias)
                    if ([1, 3, 7, 15, 30].includes(daysLate)) {
                        await autoNotificationService.onInstallmentOverdue(
                            customerEmail,
                            installment.amount,
                            daysLate
                        );
                    }
                }
            }
        }
    }
};

export default autoNotificationService;
