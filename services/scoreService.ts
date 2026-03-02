// 📊 Score Service - Gerenciamento de Score do Cliente
// Lógica real para aumentar/diminuir score baseado em comportamento

import { api } from './apiClient';

// Configuração de pontos
const SCORE_CONFIG = {
    // Pagamentos
    PAYMENT_ON_TIME: 15,        // +15 por pagamento em dia
    PAYMENT_EARLY: 25,          // +25 por pagamento antecipado
    PAYMENT_LATE_1_7: -10,      // -10 por atraso de 1-7 dias
    PAYMENT_LATE_8_30: -25,     // -25 por atraso de 8-30 dias
    PAYMENT_LATE_30_PLUS: -50,  // -50 por atraso de 30+ dias

    // Empréstimos
    LOAN_COMPLETED: 30,         // +30 por empréstimo quitado
    LOAN_DEFAULTED: -100,       // -100 por inadimplência

    // Cadastro
    COMPLETE_PROFILE: 20,       // +20 por perfil completo
    DOCUMENTS_VERIFIED: 15,     // +15 por documentos verificados

    // Limites
    MIN_SCORE: 100,
    MAX_SCORE: 1000,
    INITIAL_SCORE: 500
};

export const scoreService = {
    // ============================================
    // ATUALIZAR SCORE
    // ============================================

    updateScore: async (customerEmail: string, change: number, reason: string): Promise<boolean> => {
        try {
            // Buscar cliente e score atual
            const { data: customer, error: findError } = await api.get<any>(`/customers?email=${encodeURIComponent(customerEmail)}&single=true`);

            if (findError || !customer) {
                console.error('Customer not found:', customerEmail);
                return false;
            }

            const oldScore = customer.internal_score || SCORE_CONFIG.INITIAL_SCORE;
            let newScore = oldScore + change;

            // Aplicar limites
            newScore = Math.max(SCORE_CONFIG.MIN_SCORE, Math.min(SCORE_CONFIG.MAX_SCORE, newScore));

            // Atualizar score do cliente
            const { error: updateError } = await api.put('/customers/' + customer.id, { internal_score: newScore });

            if (updateError) {
                console.error('Error updating score:', updateError);
                return false;
            }

            // Registrar histórico
            await api.post('/finance/transactions', {
                type: 'SCORE',
                description: reason,
                customerEmail,
                scoreBefore: oldScore,
                scoreAfter: newScore
            });

            console.log(`Score updated: ${customerEmail} ${oldScore} -> ${newScore} (${reason})`);
            return true;
        } catch (err) {
            console.error('Score update error:', err);
            return false;
        }
    },

    // ============================================
    // EVENTOS DE PAGAMENTO
    // ============================================

    // Pagamento em dia
    onPaymentOnTime: async (customerEmail: string): Promise<void> => {
        await scoreService.updateScore(
            customerEmail,
            SCORE_CONFIG.PAYMENT_ON_TIME,
            'Pagamento realizado em dia'
        );
    },

    // Pagamento antecipado
    onPaymentEarly: async (customerEmail: string): Promise<void> => {
        await scoreService.updateScore(
            customerEmail,
            SCORE_CONFIG.PAYMENT_EARLY,
            'Pagamento realizado antecipadamente'
        );
    },

    // Pagamento em atraso
    onPaymentLate: async (customerEmail: string, daysLate: number): Promise<void> => {
        let change: number;
        let reason: string;

        if (daysLate <= 7) {
            change = SCORE_CONFIG.PAYMENT_LATE_1_7;
            reason = `Pagamento com ${daysLate} dia(s) de atraso`;
        } else if (daysLate <= 30) {
            change = SCORE_CONFIG.PAYMENT_LATE_8_30;
            reason = `Pagamento com ${daysLate} dias de atraso`;
        } else {
            change = SCORE_CONFIG.PAYMENT_LATE_30_PLUS;
            reason = `Pagamento com ${daysLate} dias de atraso (crítico)`;
        }

        await scoreService.updateScore(customerEmail, change, reason);
    },

    // ============================================
    // EVENTOS DE EMPRÉSTIMO
    // ============================================

    // Empréstimo quitado
    onLoanCompleted: async (customerEmail: string): Promise<void> => {
        await scoreService.updateScore(
            customerEmail,
            SCORE_CONFIG.LOAN_COMPLETED,
            'Empréstimo quitado com sucesso'
        );
    },

    // Inadimplência
    onLoanDefaulted: async (customerEmail: string): Promise<void> => {
        await scoreService.updateScore(
            customerEmail,
            SCORE_CONFIG.LOAN_DEFAULTED,
            'Empréstimo marcado como inadimplente'
        );
    },

    // ============================================
    // UTILIDADES
    // ============================================

    // Obter histórico de score
    getScoreHistory: async (customerEmail: string): Promise<any[]> => {
        const { data, error } = await api.get<any[]>('/customers/score-history?email=' + encodeURIComponent(customerEmail));

        if (error) return [];
        return data || [];
    },

    // Obter score atual
    getScore: async (customerEmail: string): Promise<number> => {
        const { data } = await api.get<any>('/customers?email=' + encodeURIComponent(customerEmail) + '&single=true');

        return data?.internal_score || SCORE_CONFIG.INITIAL_SCORE;
    },

    // Classificação do score
    getScoreLevel: (score: number): { level: string; color: string } => {
        if (score >= 800) return { level: 'EXCELENTE', color: 'green' };
        if (score >= 650) return { level: 'BOM', color: 'lime' };
        if (score >= 500) return { level: 'REGULAR', color: 'yellow' };
        if (score >= 350) return { level: 'BAIXO', color: 'orange' };
        return { level: 'CRÍTICO', color: 'red' };
    }
};

export default scoreService;
