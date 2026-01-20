// 🔔 Auto Notification Service - Notificações Automáticas
// Triggers automáticos para enviar notificações ao cliente
// Integrado com Firebase Push Notifications e WhatsApp

import { supabase } from './supabaseClient';
import { scoreService } from './scoreService';
import { firebasePushService } from './firebasePushService';
import { whatsappService } from './whatsappService';

const APP_LINK = 'https://tubaraoemprestimo.vercel.app/';

// Helper para buscar telefone do cliente pelo email
async function getCustomerPhone(email: string): Promise<string | null> {
    const { data } = await supabase
        .from('customers')
        .select('phone, name')
        .eq('email', email)
        .single();
    return data?.phone || null;
}

async function getCustomerData(email: string): Promise<{ phone: string | null; name: string }> {
    const { data } = await supabase
        .from('customers')
        .select('phone, name')
        .eq('email', email)
        .single();
    return { phone: data?.phone || null, name: data?.name || 'Cliente' };
}

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
        const customer = await getCustomerData(customerEmail);
        const formattedAmount = amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 });

        // Notificação no banco
        await autoNotificationService.createNotification(
            customerEmail,
            'Solicitação Recebida ✓',
            `Recebemos sua solicitação de R$ ${formattedAmount}. Estamos analisando seus dados.`,
            'INFO',
            '/client/contracts'
        );

        // 📱 Enviar WhatsApp
        if (customer.phone) {
            whatsappService.sendMessage(
                customer.phone,
                `📝 *SOLICITAÇÃO RECEBIDA!*\n\n` +
                `Olá ${customer.name.split(' ')[0]}!\n\n` +
                `Recebemos sua solicitação de empréstimo no valor de *R$ ${formattedAmount}*.\n\n` +
                `⏳ Nossa equipe está analisando e em breve você receberá uma resposta.\n\n` +
                `📱 *Acesse o App:*\n${APP_LINK}\n\n` +
                `_Tubarão Empréstimos 🦈_`
            ).catch(console.error);
        }

        // Push para o cliente
        firebasePushService.sendPush({
            to: customerEmail,
            title: '📝 Solicitação Recebida',
            body: `Recebemos sua solicitação de R$ ${formattedAmount}`,
            link: '/client/contracts'
        }).catch(() => { });

        // Push para admin
        firebasePushService.sendPush({
            to: 'admin',
            title: '📝 Nova Solicitação',
            body: `${clientName || customer.name} solicitou R$ ${formattedAmount}`,
            link: '/admin/requests'
        }).catch(() => { });
    },

    // Empréstimo aprovado
    onLoanApproved: async (customerEmail: string, amount: number): Promise<void> => {
        const customer = await getCustomerData(customerEmail);
        const formattedAmount = amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 });

        await autoNotificationService.createNotification(
            customerEmail,
            'Empréstimo Aprovado! 🎉',
            `Parabéns! Seu empréstimo de R$ ${formattedAmount} foi aprovado! O valor será liberado em breve.`,
            'SUCCESS',
            '/client/contracts'
        );

        // 📱 Enviar WhatsApp
        if (customer.phone) {
            whatsappService.sendMessage(
                customer.phone,
                `🎉 *EMPRÉSTIMO APROVADO!*\n\n` +
                `Parabéns ${customer.name.split(' ')[0]}!\n\n` +
                `Seu empréstimo de *R$ ${formattedAmount}* foi *APROVADO*!\n\n` +
                `O valor será liberado em até 24 horas após assinatura do contrato.\n\n` +
                `📱 *Acesse o App para assinar:*\n${APP_LINK}\n\n` +
                `_Tubarão Empréstimos 🦈_`
            ).catch(console.error);
        }

        // Push para o cliente
        firebasePushService.sendPush({
            to: customerEmail,
            title: '✅ Empréstimo Aprovado!',
            body: `Parabéns! Seu empréstimo de R$ ${formattedAmount} foi aprovado!`,
            link: '/client/contracts'
        }).catch(() => { });
    },

    // Empréstimo rejeitado
    onLoanRejected: async (customerEmail: string, reason?: string): Promise<void> => {
        const customer = await getCustomerData(customerEmail);
        const message = reason || 'Infelizmente sua solicitação não foi aprovada neste momento. Tente novamente em 30 dias.';

        await autoNotificationService.createNotification(
            customerEmail,
            'Solicitação Não Aprovada',
            message,
            'ALERT',
            '/client/dashboard'
        );

        // 📱 Enviar WhatsApp
        if (customer.phone) {
            whatsappService.sendMessage(
                customer.phone,
                `Olá ${customer.name.split(' ')[0]},\n\n` +
                `${message}\n\n` +
                `Você pode fazer uma nova solicitação em 30 dias.\n\n` +
                `📱 *Acesse o App:*\n${APP_LINK}\n\n` +
                `_Tubarão Empréstimos 🦈_`
            ).catch(console.error);
        }

        // Push para o cliente
        firebasePushService.sendPush({
            to: customerEmail,
            title: '❌ Solicitação Não Aprovada',
            body: message,
            link: '/client/dashboard'
        }).catch(() => { });
    },

    // ============================================
    // NOTIFICAÇÕES DE PAGAMENTO
    // ============================================

    // Parcela vencendo (3 dias antes)
    onInstallmentDueSoon: async (customerEmail: string, amount: number, dueDate: string): Promise<void> => {
        const customer = await getCustomerData(customerEmail);
        const date = new Date(dueDate).toLocaleDateString('pt-BR');
        const formattedAmount = amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 });

        await autoNotificationService.createNotification(
            customerEmail,
            'Parcela Vencendo',
            `Sua parcela de R$ ${formattedAmount} vence em ${date}. Evite juros!`,
            'WARNING',
            '/client/contracts'
        );

        // 📱 Enviar WhatsApp
        if (customer.phone) {
            whatsappService.sendMessage(
                customer.phone,
                `📅 *LEMBRETE DE VENCIMENTO*\n\n` +
                `Olá ${customer.name.split(' ')[0]}!\n\n` +
                `Sua parcela de *R$ ${formattedAmount}* vence em *${date}*.\n\n` +
                `💡 Pague em dia e evite juros!\n\n` +
                `📱 *Acesse o App para pagar:*\n${APP_LINK}\n\n` +
                `_Tubarão Empréstimos 🦈_`
            ).catch(console.error);
        }
    },

    // Parcela vencendo hoje
    onInstallmentDueToday: async (customerEmail: string, amount: number): Promise<void> => {
        const customer = await getCustomerData(customerEmail);
        const formattedAmount = amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 });

        await autoNotificationService.createNotification(
            customerEmail,
            '⚠️ Parcela Vence Hoje!',
            `Sua parcela de R$ ${formattedAmount} vence HOJE. Pague agora para evitar multa.`,
            'ALERT',
            '/client/contracts'
        );

        // 📱 Enviar WhatsApp
        if (customer.phone) {
            whatsappService.sendMessage(
                customer.phone,
                `🔔 *VENCIMENTO HOJE!*\n\n` +
                `Olá ${customer.name.split(' ')[0]}!\n\n` +
                `Sua parcela de *R$ ${formattedAmount}* vence *HOJE*.\n\n` +
                `⚡ Pague agora e evite cobranças adicionais!\n\n` +
                `📱 *Acesse o App para pagar:*\n${APP_LINK}\n\n` +
                `_Tubarão Empréstimos 🦈_`
            ).catch(console.error);
        }
    },

    // Parcela atrasada
    onInstallmentOverdue: async (customerEmail: string, amount: number, daysLate: number): Promise<void> => {
        const customer = await getCustomerData(customerEmail);
        const formattedAmount = amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 });

        await autoNotificationService.createNotification(
            customerEmail,
            '🚨 Parcela em Atraso',
            `Você possui uma parcela de R$ ${formattedAmount} em atraso há ${daysLate} dia(s). Regularize para evitar juros adicionais.`,
            'ALERT',
            '/client/contracts'
        );

        // 📱 Enviar WhatsApp
        if (customer.phone) {
            whatsappService.sendMessage(
                customer.phone,
                `⚠️ *PARCELA EM ATRASO*\n\n` +
                `Olá ${customer.name.split(' ')[0]}!\n\n` +
                `Sua parcela de *R$ ${formattedAmount}* está em atraso há *${daysLate} dia(s)*.\n\n` +
                `💡 Regularize o quanto antes para evitar juros adicionais.\n\n` +
                `📱 *Acesse o App para pagar:*\n${APP_LINK}\n\n` +
                `_Tubarão Empréstimos 🦈_`
            ).catch(console.error);
        }

        // Atualizar score por atraso
        await scoreService.onPaymentLate(customerEmail, daysLate);
    },

    // Pagamento confirmado
    onPaymentConfirmed: async (customerEmail: string, amount: number, wasOnTime: boolean, wasEarly: boolean): Promise<void> => {
        const customer = await getCustomerData(customerEmail);
        const formattedAmount = amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
        let message: string;

        if (wasEarly) {
            message = `Pagamento antecipado de R$ ${formattedAmount} confirmado! Seu score aumentou. 🌟`;
            await scoreService.onPaymentEarly(customerEmail);
        } else if (wasOnTime) {
            message = `Pagamento de R$ ${formattedAmount} confirmado! Obrigado por pagar em dia.`;
            await scoreService.onPaymentOnTime(customerEmail);
        } else {
            message = `Pagamento de R$ ${formattedAmount} confirmado!`;
        }

        await autoNotificationService.createNotification(
            customerEmail,
            'Pagamento Confirmado ✓',
            message,
            'SUCCESS',
            '/client/contracts'
        );

        // 📱 Enviar WhatsApp
        if (customer.phone) {
            whatsappService.sendMessage(
                customer.phone,
                `✅ *PAGAMENTO CONFIRMADO!*\n\n` +
                `Olá ${customer.name.split(' ')[0]}!\n\n` +
                `Recebemos seu pagamento de *R$ ${formattedAmount}*.\n\n` +
                `${wasEarly ? '🌟 Pagamento antecipado! Seu score aumentou!' : wasOnTime ? '👏 Obrigado por pagar em dia!' : ''}\n\n` +
                `📱 *Acesse o App:*\n${APP_LINK}\n\n` +
                `_Tubarão Empréstimos 🦈_`
            ).catch(console.error);
        }
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
    },

    // ============================================
    // 📱 WHATSAPP - CAMPANHAS E CUPONS
    // ============================================

    /**
     * Envia uma campanha para todos os clientes via WhatsApp
     */
    sendWhatsAppCampaign: async (campaignId: string): Promise<{ success: boolean; sent?: number; error?: string }> => {
        try {
            const response = await fetch(`https://cwhiujeragsethxjekkb.supabase.co/functions/v1/send-campaign`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'campaign', id: campaignId })
            });

            const data = await response.json();
            if (!response.ok) {
                return { success: false, error: data.error };
            }
            return { success: true, sent: data.sent };
        } catch (error) {
            console.error('[WhatsApp] Campaign error:', error);
            return { success: false, error: 'Erro de conexão' };
        }
    },

    /**
     * Envia um cupom para todos os clientes via WhatsApp
     */
    sendWhatsAppCoupon: async (couponId: string): Promise<{ success: boolean; sent?: number; error?: string }> => {
        try {
            const response = await fetch(`https://cwhiujeragsethxjekkb.supabase.co/functions/v1/send-campaign`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'coupon', id: couponId })
            });

            const data = await response.json();
            if (!response.ok) {
                return { success: false, error: data.error };
            }
            return { success: true, sent: data.sent };
        } catch (error) {
            console.error('[WhatsApp] Coupon error:', error);
            return { success: false, error: 'Erro de conexão' };
        }
    },

    /**
     * Executa cobranças automáticas via WhatsApp baseado nas regras
     */
    runWhatsAppCollections: async (): Promise<{ success: boolean; sent?: number; error?: string }> => {
        try {
            const response = await fetch(`https://cwhiujeragsethxjekkb.supabase.co/functions/v1/auto-notifications`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'collections' })
            });

            const data = await response.json();
            if (!response.ok) {
                return { success: false, error: data.error };
            }
            return { success: true, sent: data.results?.collections?.sent || 0 };
        } catch (error) {
            console.error('[WhatsApp] Collections error:', error);
            return { success: false, error: 'Erro de conexão' };
        }
    },

    /**
     * Busca histórico de notificações WhatsApp enviadas
     */
    getWhatsAppHistory: async (limit: number = 50) => {
        try {
            const { data, error } = await supabase
                .from('notification_logs')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(limit);

            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('[WhatsApp] History error:', error);
            return [];
        }
    }
};

export default autoNotificationService;
