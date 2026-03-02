
// 🤖 Collection Automation Service - Régua de Cobrança Automática
// Tubarão Empréstimos - Automação de Cobranças via WhatsApp

import { whatsappService } from './whatsappService';
import { apiService } from './apiService';
import { notificationService } from './notificationService';
import { Loan, Installment, CollectionRule, Customer } from '../types';

export interface CollectionAction {
    id: string;
    customerId: string;
    customerName: string;
    customerPhone: string;
    loanId: string;
    installmentId: string;
    dueDate: string;
    amount: number;
    daysOffset: number; // Negative = before, Positive = after
    ruleId: string;
    type: 'WHATSAPP' | 'EMAIL' | 'SMS';
    message: string;
    status: 'PENDING' | 'SENT' | 'FAILED';
    scheduledFor: string;
    sentAt?: string;
}

// Default message templates with variables
export const DEFAULT_TEMPLATES = {
    reminder_3_days: {
        name: 'Lembrete 3 dias antes',
        daysOffset: -3,
        template: `Olá {nome}! 🦈

Lembrete: Sua parcela de *R$ {valor}* vence em *{data_vencimento}*.

Para sua comodidade, o Pix já está disponível no app. Evite juros e multas!

Tubarão Empréstimos - Crédito Rápido e Seguro 💰`
    },
    reminder_1_day: {
        name: 'Lembrete 1 dia antes',
        daysOffset: -1,
        template: `Olá {nome}! ⚠️

Sua parcela de *R$ {valor}* vence *amanhã* ({data_vencimento}).

Acesse seu app para pagar via Pix e evitar encargos.

Tubarão Empréstimos 🦈`
    },
    due_day: {
        name: 'Dia do vencimento',
        daysOffset: 0,
        template: `Olá {nome}! 📅

Hoje é o dia! Sua parcela de *R$ {valor}* vence hoje.

Pague agora pelo app e mantenha seu score em dia! ✅

Tubarão Empréstimos 🦈`
    },
    overdue_1_day: {
        name: '1 dia de atraso',
        daysOffset: 1,
        template: `Olá {nome},

Sua parcela de *R$ {valor}* venceu ontem e ainda não identificamos o pagamento.

Evite juros e multas! Regularize pelo app agora.

Tubarão Empréstimos 🦈`
    },
    overdue_3_days: {
        name: '3 dias de atraso',
        daysOffset: 3,
        template: `{nome}, tudo bem?

Identificamos que sua parcela de *R$ {valor}* está em atraso há 3 dias.

Entre em contato conosco para negociar e evitar maiores encargos.

📱 Acesse o app ou responda esta mensagem.

Tubarão Empréstimos 🦈`
    },
    overdue_7_days: {
        name: '7 dias de atraso',
        daysOffset: 7,
        template: `⚠️ ATENÇÃO {nome}

Sua parcela de *R$ {valor}* está em atraso há 7 dias.

Precisamos regularizar sua situação. Entre em contato URGENTE para negociar.

❌ O não pagamento pode resultar em:
- Negativação nos órgãos de proteção
- Bloqueio de novos empréstimos
- Ação de cobrança

Estamos aqui para ajudar! Responda esta mensagem.

Tubarão Empréstimos 🦈`
    },
    overdue_15_days: {
        name: '15 dias de atraso',
        daysOffset: 15,
        template: `🚨 ÚLTIMO AVISO - {nome}

Sua dívida de *R$ {valor}* está em atraso há 15 dias.

⚠️ AÇÃO NECESSÁRIA: Contato imediato.

Caso não haja regularização, seu nome será incluído nos órgãos de proteção ao crédito.

Entre em contato HOJE para negociar.

Tubarão Empréstimos 🦈`
    }
};

// Process template with variables
const processTemplate = (
    template: string,
    data: {
        nome: string;
        valor: number;
        data_vencimento: string;
        dias_atraso?: number
    }
): string => {
    return template
        .replace(/{nome}/g, data.nome.split(' ')[0]) // First name only
        .replace(/{valor}/g, data.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 }))
        .replace(/{data_vencimento}/g, new Date(data.data_vencimento).toLocaleDateString('pt-BR'))
        .replace(/{dias_atraso}/g, String(data.dias_atraso || 0));
};

// Get days difference between two dates
const daysDiff = (date1: Date, date2: Date): number => {
    const diffTime = date1.getTime() - date2.getTime();
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
};

export const collectionService = {
    // Get all pending collection actions for today
    getPendingActions: async (): Promise<CollectionAction[]> => {
        const loans = await apiService.getClientLoans();
        const rules = await apiService.getCollectionRules();
        const customers = await apiService.getCustomers();
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const actions: CollectionAction[] = [];

        // Check each loan installment against rules
        loans.forEach(loan => {
            loan.installments.forEach(inst => {
                if (inst.status === 'PAID') return; // Skip paid

                const dueDate = new Date(inst.dueDate);
                dueDate.setHours(0, 0, 0, 0);
                const diff = daysDiff(today, dueDate);

                // Find matching rules
                rules.filter(r => r.active && r.daysOffset === diff).forEach(rule => {
                    // Find customer (in real app, loan would have customerId)
                    const customer = customers[0]; // Simplified for demo

                    if (customer && customer.phone) {
                        const message = processTemplate(rule.messageTemplate, {
                            nome: customer.name,
                            valor: inst.amount,
                            data_vencimento: inst.dueDate,
                            dias_atraso: diff > 0 ? diff : undefined
                        });

                        actions.push({
                            id: `action_${loan.id}_${inst.id}_${rule.id}`,
                            customerId: customer.id,
                            customerName: customer.name,
                            customerPhone: customer.phone,
                            loanId: loan.id,
                            installmentId: inst.id,
                            dueDate: inst.dueDate,
                            amount: inst.amount,
                            daysOffset: diff,
                            ruleId: rule.id,
                            type: rule.type,
                            message,
                            status: 'PENDING',
                            scheduledFor: today.toISOString()
                        });
                    }
                });
            });
        });

        return actions;
    },

    // Execute a single collection action
    executeAction: async (action: CollectionAction): Promise<boolean> => {
        try {
            if (action.type === 'WHATSAPP') {
                const success = await whatsappService.sendMessage(action.customerPhone, action.message);

                if (success) {
                    notificationService.create({
                        type: 'success',
                        title: '📱 Cobrança Enviada',
                        message: `Mensagem de cobrança enviada para ${action.customerName}.`,
                    });
                    return true;
                }
            }

            // EMAIL and SMS would be implemented here

            return false;
        } catch (error) {
            console.error('[Collection] Error executing action:', error);
            notificationService.create({
                type: 'error',
                title: '❌ Falha na Cobrança',
                message: `Erro ao enviar mensagem para ${action.customerName}.`,
            });
            return false;
        }
    },

    // Execute all pending actions
    executePendingActions: async (): Promise<{ success: number; failed: number }> => {
        const actions = await collectionService.getPendingActions();
        let success = 0;
        let failed = 0;

        for (const action of actions) {
            const result = await collectionService.executeAction(action);
            if (result) success++;
            else failed++;

            // Add delay between messages to avoid spam detection
            await new Promise(r => setTimeout(r, 2000));
        }

        if (success > 0) {
            notificationService.create({
                type: 'success',
                title: '✅ Régua de Cobrança',
                message: `${success} mensagens enviadas com sucesso.`,
            });
        }

        return { success, failed };
    },

    // Send manual collection message
    sendManualCollection: async (
        phone: string,
        customerName: string,
        amount: number,
        template: keyof typeof DEFAULT_TEMPLATES
    ): Promise<boolean> => {
        const tpl = DEFAULT_TEMPLATES[template];
        if (!tpl) return false;

        const message = processTemplate(tpl.template, {
            nome: customerName,
            valor: amount,
            data_vencimento: new Date().toISOString(),
            dias_atraso: Math.abs(tpl.daysOffset)
        });

        return await whatsappService.sendMessage(phone, message);
    },

    // Get collection statistics
    getStats: async (): Promise<{
        totalSent: number;
        pendingToday: number;
        overdueClients: number;
        totalOverdueAmount: number;
    }> => {
        const loans = await apiService.getClientLoans();
        const today = new Date();

        let totalOverdue = 0;
        let overdueAmount = 0;
        const overdueCustomers = new Set<string>();

        loans.forEach(loan => {
            loan.installments.forEach(inst => {
                if (inst.status === 'OPEN' && new Date(inst.dueDate) < today) {
                    totalOverdue++;
                    overdueAmount += inst.amount;
                    // Would add customerId to set in real implementation
                }
            });
        });

        return {
            totalSent: 0, // Would come from logs in real implementation
            pendingToday: (await collectionService.getPendingActions()).length,
            overdueClients: overdueCustomers.size || totalOverdue,
            totalOverdueAmount: overdueAmount
        };
    },

    // Initialize default collection rules if none exist
    initializeDefaultRules: async (): Promise<void> => {
        const existing = await apiService.getCollectionRules();
        if (existing.length > 0) return;

        const defaultRules = [
            { daysOffset: -3, type: 'WHATSAPP' as const, messageTemplate: DEFAULT_TEMPLATES.reminder_3_days.template, active: true },
            { daysOffset: -1, type: 'WHATSAPP' as const, messageTemplate: DEFAULT_TEMPLATES.reminder_1_day.template, active: true },
            { daysOffset: 0, type: 'WHATSAPP' as const, messageTemplate: DEFAULT_TEMPLATES.due_day.template, active: true },
            { daysOffset: 1, type: 'WHATSAPP' as const, messageTemplate: DEFAULT_TEMPLATES.overdue_1_day.template, active: true },
            { daysOffset: 3, type: 'WHATSAPP' as const, messageTemplate: DEFAULT_TEMPLATES.overdue_3_days.template, active: true },
            { daysOffset: 7, type: 'WHATSAPP' as const, messageTemplate: DEFAULT_TEMPLATES.overdue_7_days.template, active: true },
            { daysOffset: 15, type: 'WHATSAPP' as const, messageTemplate: DEFAULT_TEMPLATES.overdue_15_days.template, active: true },
        ];

        for (const rule of defaultRules) {
            await apiService.saveCollectionRule({
                id: `rule_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                ...rule
            });
        }
    }
};
