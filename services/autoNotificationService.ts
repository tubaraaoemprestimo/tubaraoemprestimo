// 🔔 Auto Notification Service - Notificações Automáticas
// Triggers automáticos para enviar notificações ao cliente
// Integrado com Firebase Push Notifications e WhatsApp

import { api } from './apiClient';
import { scoreService } from './scoreService';
import { firebasePushService } from './firebasePushService';
import { whatsappService } from './whatsappService';

const APP_LINK = 'https://www.tubaraoemprestimo.com.br/';

// Helper para buscar telefone do cliente pelo email
async function getCustomerPhone(email: string): Promise<string | null> {
    const { data } = await api.get<any>(`/customers?email=${encodeURIComponent(email)}`);
    const customer = Array.isArray(data) ? data[0] : data;
    return customer?.phone || null;
}

// Helper para buscar chave PIX
async function getPixKey(): Promise<string | null> {
    try {
        const { data } = await api.get<any[]>('/settings');
        if (data && typeof data === 'object' && data.pix_key) {
            return data.pix_key as string;
        }
        return null;
    } catch (error) {
        console.error('[AutoNotification] Erro ao buscar chave PIX:', error);
        return null;
    }
}

async function getCustomerData(email: string): Promise<{ phone: string | null; name: string }> {
    const { data } = await api.get<any>(`/customers?email=${encodeURIComponent(email)}`);
    const customer = Array.isArray(data) ? data[0] : data;
    return { phone: customer?.phone || null, name: customer?.name || 'Cliente' };
}

const shouldFallbackLegacy = (error: any): boolean => {
    const msg = String(error?.message || '').toLowerCase();
    return msg.includes('for_role') || (msg.includes('column') && msg.includes('does not exist'));
};

async function insertScopedNotification(payload: {
    customer_email: string | null;
    title: string;
    message: string;
    type: 'INFO' | 'WARNING' | 'ALERT' | 'SUCCESS';
    link: string | null;
    for_role: 'CLIENT' | 'ADMIN' | 'ALL';
}): Promise<boolean> {
    let { error } = await api.post('/notifications', payload);

    if (error && shouldFallbackLegacy(error)) {
        const legacyPayload: any = { ...payload };
        delete legacyPayload.for_role;
        const fallback = await api.post('/notifications', legacyPayload);
        error = fallback.error;
    }

    if (error) {
        console.error('Error creating notification:', error);
        return false;
    }

    return true;
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
            if (!customerEmail) {
                console.warn('[Notification] createNotification called without customerEmail:', title);
                return false;
            }

            return await insertScopedNotification({
                customer_email: customerEmail,
                title,
                message,
                type,
                link: link || null,
                for_role: 'CLIENT'
            });
        } catch (err) {
            console.error('Notification error:', err);
            return false;
        }
    },

    createAdminNotification: async (
        title: string,
        message: string,
        type: 'INFO' | 'WARNING' | 'ALERT' | 'SUCCESS' = 'INFO',
        link?: string
    ): Promise<boolean> => {
        try {
            return await insertScopedNotification({
                customer_email: null,
                title,
                message,
                type,
                link: link || '/admin/security-hub',
                for_role: 'ADMIN'
            });
        } catch (err) {
            console.error('Admin notification error:', err);
            return false;
        }
    },

    // ============================================
    // NOTIFICAÇÕES DE BOAS-VINDAS
    // ============================================

    // Boas-vindas ao cliente (após cadastro)
    onWelcome: async (customerEmail: string, customerName: string, customerPhone?: string): Promise<void> => {
        const firstName = customerName.split(' ')[0];

        // Notificação no banco
        await autoNotificationService.createNotification(
            customerEmail,
            'Bem-vindo(a) ao Tubarão Empréstimos! 🦈',
            `Olá ${firstName}! Seu cadastro foi realizado com sucesso. Agora você pode solicitar seu empréstimo de forma rápida e segura!`,
            'SUCCESS',
            '/client/dashboard'
        );

        // 📱 Enviar WhatsApp
        if (customerPhone) {
            whatsappService.sendMessage(
                customerPhone,
                `👋 *BEM-VINDO(A) AO TUBARÃO EMPRÉSTIMOS!*\n\n` +
                `Olá ${firstName}!\n\n` +
                `Seu cadastro foi realizado com sucesso! 🎉\n\n` +
                `Agora você pode solicitar seu empréstimo de forma rápida e segura.\n\n` +
                `✅ *Vantagens:*\n` +
                `• Processo 100% digital\n` +
                `• Aprovação em até 24h\n` +
                `• Taxas competitivas\n\n` +
                `📱 *Acesse o App:*\n${APP_LINK}\n\n` +
                `_Tubarão Empréstimos 🦈_`
            ).catch(console.error);
        }

        // Notificação operacional para admin (novo acesso/cadastro)
        await autoNotificationService.createAdminNotification(
            '👤 Novo acesso cadastrado',
            `${customerName} concluiu cadastro e agora pode solicitar serviços.`,
            'INFO',
            '/admin/security-hub?tab=users'
        );

        // Push para o cliente
        firebasePushService.sendPush({
            to: customerEmail,
            title: '👋 Bem-vindo ao Tubarão Empréstimos!',
            body: 'Seu cadastro foi realizado com sucesso!',
            link: '/client/dashboard'
        }).catch(() => { });
    },

    // ============================================
    // NOTIFICAÇÕES DE EMPRÉSTIMO
    // ============================================

    // Solicitação recebida
    onLoanRequested: async (customerEmail: string, amount: number, clientName?: string, profileType?: string): Promise<void> => {
        const customer = await getCustomerData(customerEmail);
        const isLimpaNome = profileType === 'LIMPA_NOME';
        const formattedAmount = amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 });

        // Notificação no banco
        await autoNotificationService.createNotification(
            customerEmail,
            'Solicitação Recebida ✓',
            isLimpaNome
                ? `Recebemos sua solicitação do serviço Limpa Nome. Estamos analisando seus dados.`
                : `Recebemos sua solicitação de R$ ${formattedAmount}. Estamos analisando seus dados.`,
            'INFO',
            '/client/contracts'
        );

        // 📱 Enviar WhatsApp
        if (customer.phone) {
            whatsappService.sendMessage(
                customer.phone,
                isLimpaNome
                    ? `📝 *SOLICITAÇÃO RECEBIDA!*\n\n` +
                    `Olá ${customer.name.split(' ')[0]}!\n\n` +
                    `Recebemos sua solicitação do serviço *Limpa Nome*.\n\n` +
                    `⏳ Nossa equipe está analisando e em breve você receberá uma resposta.\n\n` +
                    `📱 *Acesse o App:*\n${APP_LINK}\n\n` +
                    `_Tubarão Empréstimos 🦈_`
                    : `📝 *SOLICITAÇÃO RECEBIDA!*\n\n` +
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
            body: isLimpaNome
                ? `Recebemos sua solicitação do serviço Limpa Nome`
                : `Recebemos sua solicitação de R$ ${formattedAmount}`,
            link: '/client/contracts'
        }).catch(() => { });

        await autoNotificationService.createAdminNotification(
            isLimpaNome ? '📝 Nova solicitação Limpa Nome' : '📝 Nova solicitação de empréstimo',
            isLimpaNome
                ? `${clientName || customer.name} enviou solicitação do serviço Limpa Nome.`
                : `${clientName || customer.name} solicitou R$ ${formattedAmount}.`,
            'INFO',
            '/admin/requests'
        );

        // Push para admin
        firebasePushService.sendPush({
            to: 'admin',
            title: isLimpaNome ? '📝 Nova Solicitação - Limpa Nome' : '📝 Nova Solicitação',
            body: isLimpaNome
                ? `${clientName || customer.name} solicitou o serviço Limpa Nome`
                : `${clientName || customer.name} solicitou R$ ${formattedAmount}`,
            link: '/admin/requests'
        }).catch(() => { });
    },

    // Empréstimo aprovado
    onLoanApproved: async (customerEmail: string, amount: number): Promise<void> => {
        const customer = await getCustomerData(customerEmail);
        const formattedAmount = amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
        const pixKey = await getPixKey();

        let notificationMessage = `Parabéns! Seu empréstimo de R$ ${formattedAmount} foi aprovado! O valor será liberado em breve.`;
        if (pixKey) {
            notificationMessage += ` Chave PIX para pagamentos: ${pixKey}`;
        }

        await autoNotificationService.createNotification(
            customerEmail,
            'Empréstimo Aprovado! 🎉',
            notificationMessage,
            'SUCCESS',
            '/client/contracts'
        );

        // 📱 Enviar WhatsApp
        if (customer.phone) {
            let message = `🎉 *EMPRÉSTIMO APROVADO!*\n\n` +
                `Parabéns ${customer.name.split(' ')[0]}!\n\n` +
                `Seu empréstimo de *R$ ${formattedAmount}* foi *APROVADO*!\n\n` +
                `O valor será liberado em até 24 horas após assinatura do contrato.\n\n`;

            if (pixKey) {
                message += `📱 *Chave PIX:* ${pixKey}\n` +
                    `Use esta chave para pagar suas parcelas.\n\n`;
            }

            message += `📱 *Acesse o App para assinar:*\n${APP_LINK}\n\n` +
                `_Tubarão Empréstimos 🦈_`;

            whatsappService.sendMessage(
                customer.phone,
                message
            ).catch(console.error);
        }

        // Push para o cliente
        firebasePushService.sendPush({
            to: customerEmail,
            title: '✅ Empréstimo Aprovado!',
            body: `Parabéns! Seu empréstimo de R$ ${formattedAmount} foi aprovado!` +
                (pixKey ? ` Chave PIX: ${pixKey}` : ''),
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

    // Contrato assinado
    onContractSigned: async (customerEmail: string, clientName?: string): Promise<void> => {
        const pixKey = await getPixKey();
        const title = "Contrato Assinado!";
        let message = "Seu contrato foi assinado com sucesso. Aguarde a liberação do valor.";

        if (pixKey) {
            message += ` Chave PIX para pagamentos: ${pixKey}`;
        }

        await autoNotificationService.createNotification(customerEmail, title, message, 'SUCCESS');

        // 📱 Enviar WhatsApp
        try {
            const { phone, name } = await getCustomerData(customerEmail);
            if (phone) {
                let content = `Olá ${name?.split(' ')[0] || clientName?.split(' ')[0]}! Seu contrato foi assinado com sucesso. O valor será liberado em breve.`;

                if (pixKey) {
                    content += ` 📱 *Chave PIX:* ${pixKey}\nUse esta chave para futuros pagamentos.`;
                }

                // Tenta buscar template
                const { data: templates } = await api.get<any[]>('/settings/templates?trigger_event=CONTRACT_SIGNED&is_active=true');
                const template = Array.isArray(templates) ? templates[0] : templates;

                if (template) {
                    content = template.content
                        .replace('{nome}', name?.split(' ')[0] || clientName?.split(' ')[0] || 'Cliente')
                        .replace('{pix_key}', pixKey || 'não configurada');
                } else {
                    content += `\n\n📱 *Acesse:* ${APP_LINK}`;
                }

                await whatsappService.sendMessage(phone, content);
            }
        } catch (err) {
            console.error('Erro ao enviar WhatsApp de contrato assinado:', err);
        }
    },

    // ============================================
    // NOTIFICAÇÕES DE PAGAMENTO
    // ============================================

    // Parcela vencendo (3 dias antes)
    onInstallmentDueSoon: async (customerEmail: string, amount: number, dueDate: string): Promise<void> => {
        const customer = await getCustomerData(customerEmail);
        const date = new Date(dueDate).toLocaleDateString('pt-BR');
        const formattedAmount = amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
        const pixKey = await getPixKey();

        await autoNotificationService.createNotification(
            customerEmail,
            'Parcela Vencendo',
            `Sua parcela de R$ ${formattedAmount} vence em ${date}. Evite juros! Chave PIX: ${pixKey || 'não configurada'}`,
            'WARNING',
            '/client/contracts'
        );

        await autoNotificationService.createAdminNotification(
            '📅 Parcela vencendo (cliente)',
            `${customer.name} possui parcela de R$ ${formattedAmount} vencendo em ${date}.`,
            'WARNING',
            '/admin/finance-hub'
        );

        // 📱 Enviar WhatsApp
        if (customer.phone) {
            let message = `📅 *LEMBRETE DE VENCIMENTO*\n\n` +
                `Olá ${customer.name.split(' ')[0]}!\n\n` +
                `Sua parcela de *R$ ${formattedAmount}* vence em *${date}*.\n\n` +
                `💡 Pague em dia e evite juros!\n\n`;

            if (pixKey) {
                message += `📱 *Chave PIX:* ${pixKey}\n\n`;
            }

            message += `📱 *Acesse o App para pagar:*\n${APP_LINK}\n\n` +
                `_Tubarão Empréstimos 🦈_`;

            whatsappService.sendMessage(
                customer.phone,
                message
            ).catch(console.error);
        }
    },

    // Parcela vencendo hoje
    onInstallmentDueToday: async (customerEmail: string, amount: number): Promise<void> => {
        const customer = await getCustomerData(customerEmail);
        const formattedAmount = amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
        const pixKey = await getPixKey();

        await autoNotificationService.createNotification(
            customerEmail,
            '⚠️ Parcela Vence Hoje!',
            `Sua parcela de R$ ${formattedAmount} vence HOJE. Pague agora para evitar multa. Chave PIX: ${pixKey || 'não configurada'}`,
            'ALERT',
            '/client/contracts'
        );

        // 📱 Enviar WhatsApp
        if (customer.phone) {
            let message = `🔔 *VENCIMENTO HOJE!*\n\n` +
                `Olá ${customer.name.split(' ')[0]}!\n\n` +
                `Sua parcela de *R$ ${formattedAmount}* vence *HOJE*.\n\n` +
                `⚡ Pague agora e evite cobranças adicionais!\n\n`;

            if (pixKey) {
                message += `📱 *Chave PIX:* ${pixKey}\n\n`;
            }

            message += `📱 *Acesse o App para pagar:*\n${APP_LINK}\n\n` +
                `_Tubarão Empréstimos 🦈_`;

            whatsappService.sendMessage(
                customer.phone,
                message
            ).catch(console.error);
        }
    },

    // Parcela atrasada
    onInstallmentOverdue: async (customerEmail: string, amount: number, daysLate: number): Promise<void> => {
        const customer = await getCustomerData(customerEmail);
        const formattedAmount = amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
        const pixKey = await getPixKey();

        await autoNotificationService.createNotification(
            customerEmail,
            '🚨 Parcela em Atraso',
            `Você possui uma parcela de R$ ${formattedAmount} em atraso há ${daysLate} dia(s). Regularize para evitar juros adicionais. Chave PIX: ${pixKey || 'não configurada'}`,
            'ALERT',
            '/client/contracts'
        );

        await autoNotificationService.createAdminNotification(
            '🚨 Parcela em atraso',
            `${customer.name} está com parcela de R$ ${formattedAmount} em atraso há ${daysLate} dia(s).`,
            'ALERT',
            '/admin/finance-hub'
        );

        // 📱 Enviar WhatsApp
        if (customer.phone) {
            let message = `⚠️ *PARCELA EM ATRASO*\n\n` +
                `Olá ${customer.name.split(' ')[0]}!\n\n` +
                `Sua parcela de *R$ ${formattedAmount}* está em atraso há *${daysLate} dia(s)*.\n\n` +
                `💡 Regularize o quanto antes para evitar juros adicionais.\n\n`;

            if (pixKey) {
                message += `📱 *Chave PIX:* ${pixKey}\n\n`;
            }

            message += `📱 *Acesse o App para pagar:*\n${APP_LINK}\n\n` +
                `_Tubarão Empréstimos 🦈_`;

            whatsappService.sendMessage(
                customer.phone,
                message
            ).catch(console.error);
        }

        // Atualizar score por atraso
        await scoreService.onPaymentLate(customerEmail, daysLate);
    },

    // Pagamento confirmado
    onPaymentConfirmed: async (customerEmail: string, amount: number, wasOnTime: boolean, wasEarly: boolean): Promise<void> => {
        const customer = await getCustomerData(customerEmail);
        const formattedAmount = amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
        const pixKey = await getPixKey();
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
            pixKey ? `${message} Chave PIX: ${pixKey}` : message,
            'SUCCESS',
            '/client/contracts'
        );

        await autoNotificationService.createAdminNotification(
            '✅ Pagamento confirmado',
            `${customer.name} teve pagamento de R$ ${formattedAmount} confirmado.`,
            'SUCCESS',
            '/admin/finance-hub?tab=receipts'
        );

        // 📱 Enviar WhatsApp
        if (customer.phone) {
            let whatsappMessage = `✅ *PAGAMENTO CONFIRMADO!*\n\n` +
                `Olá ${customer.name.split(' ')[0]}!\n\n` +
                `Recebemos seu pagamento de *R$ ${formattedAmount}*.\n\n` +
                `${wasEarly ? '🌟 Pagamento antecipado! Seu score aumentou!' : wasOnTime ? '👏 Obrigado por pagar em dia!' : ''}\n\n`;

            if (pixKey) {
                whatsappMessage += `📱 *Chave PIX:* ${pixKey}\n` +
                    `Use esta chave para futuros pagamentos.\n\n`;
            }

            whatsappMessage += `📱 *Acesse o App:*\n${APP_LINK}\n\n` +
                `_Tubarão Empréstimos 🦈_`;

            whatsappService.sendMessage(
                customer.phone,
                whatsappMessage
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
        const { data: dueSoon } = await api.get<any[]>(
            `/installments?status=OPEN&due_date_gte=${today.toISOString().split('T')[0]}&due_date_lte=${threeDaysFromNow.toISOString().split('T')[0]}`
        );

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
        const { data: overdue } = await api.get<any[]>(
            `/installments?status=OPEN&due_date_lt=${today.toISOString().split('T')[0]}`
        );

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
     * Dispara automação de CAMPANHA (WhatsApp + Email)
     * Usa o novo endpoint /campaigns/send do backend
     */
    triggerManualCampaign: async (campaignId: string): Promise<{ success: boolean; results?: any; error?: string }> => {
        try {
            const { data, error } = await api.post<any>('/campaigns/send', { type: 'campaign', id: campaignId });

            if (error) throw error;
            return { success: true, results: { campaigns: data } };
        } catch (error: any) {
            console.error('[Auto] Campaign error:', error);
            return { success: false, error: error.message || 'Erro ao processar campanha' };
        }
    },

    /**
     * Dispara automação de CUPOM (WhatsApp + Email)
     * Usa o novo endpoint /campaigns/send do backend
     */
    triggerManualCoupon: async (couponId: string): Promise<{ success: boolean; results?: any; error?: string }> => {
        try {
            const { data, error } = await api.post<any>('/campaigns/send', { type: 'coupon', id: couponId });

            if (error) throw error;
            return { success: true, results: { coupons: data } };
        } catch (error: any) {
            console.error('[Auto] Coupon error:', error);
            return { success: false, error: error.message || 'Erro ao processar cupom' };
        }
    },

    /**
     * Dispara automação de COBRANÇAS (WhatsApp + Email + Push)
     */
    triggerManualCollections: async (): Promise<{ success: boolean; results?: any; error?: string }> => {
        try {
            const { data, error } = await api.post<any>('/collections/dispatch', {});

            if (error) throw error;
            return { success: true, results: data?.results };
        } catch (error: any) {
            console.error('[Auto] Collections error:', error);
            return { success: false, error: error.message || 'Erro ao processar cobranças' };
        }
    },

    /**
     * Busca histórico de notificações WhatsApp enviadas
     */
    getWhatsAppHistory: async (limit: number = 50) => {
        try {
            const { data, error } = await api.get<any[]>(`/notifications/logs?limit=${limit}`);

            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('[WhatsApp] History error:', error);
            return [];
        }
    },
};

export default autoNotificationService;
