// 💰 Serviço de Pagamentos de Empréstimos
import { api } from './apiClient';

export interface LoanPayment {
    id?: string;
    request_id: string;
    customer_id?: string;
    payment_type: 'JUROS' | 'PARCELA' | 'TOTAL' | 'MULTA' | 'OUTRO';
    amount: number;
    payment_date: string;
    reference_month?: string;
    reference_year?: number;
    proof_url?: string;
    confirmed: boolean;
    confirmed_by?: string;
    confirmed_at?: string;
    notes?: string;
    created_at?: string;
}

export const paymentService = {
    // Buscar pagamentos de uma solicitação
    getPaymentsByRequest: async (requestId: string): Promise<LoanPayment[]> => {
        const { data, error } = await api.get<LoanPayment[]>(`/payment-receipts?request_id=${requestId}`);

        if (error) {
            console.error('Erro ao buscar pagamentos:', error);
            return [];
        }
        return data || [];
    },

    // Buscar todos os pagamentos
    getAllPayments: async (): Promise<LoanPayment[]> => {
        const { data, error } = await api.get<LoanPayment[]>('/payment-receipts');

        if (error) {
            console.error('Erro ao buscar pagamentos:', error);
            return [];
        }
        return data || [];
    },

    // Registrar novo pagamento
    createPayment: async (payment: Omit<LoanPayment, 'id' | 'created_at'>): Promise<LoanPayment | null> => {
        const { data, error } = await api.post<LoanPayment>('/payment-receipts', payment);

        if (error) {
            console.error('Erro ao criar pagamento:', error);
            return null;
        }

        // Atualizar totais na solicitação
        await paymentService.updateRequestTotals(payment.request_id);

        return data;
    },

    // Confirmar pagamento
    confirmPayment: async (paymentId: string, adminName: string): Promise<boolean> => {
        const { error } = await api.put(`/payments/${paymentId}/confirm`, {
            confirmed: true,
            confirmed_by: adminName,
            confirmed_at: new Date().toISOString()
        });

        if (error) {
            console.error('Erro ao confirmar pagamento:', error);
            return false;
        }
        return true;
    },

    // Excluir pagamento
    deletePayment: async (paymentId: string): Promise<boolean> => {
        // Primeiro, buscar o pagamento para saber o request_id
        const { data: payment } = await api.get<any>(`/payments/${paymentId}`);

        const { error } = await api.delete(`/payments/${paymentId}`);

        if (error) {
            console.error('Erro ao excluir pagamento:', error);
            return false;
        }

        // Atualizar totais
        if (payment?.request_id) {
            await paymentService.updateRequestTotals(payment.request_id);
        }

        return true;
    },

    // Atualizar totais na solicitação
    updateRequestTotals: async (requestId: string): Promise<void> => {
        // Buscar todos os pagamentos confirmados
        const { data: payments } = await api.get<any[]>(`/payments?request_id=${requestId}&confirmed=true`);

        const totalPaid = payments?.reduce((sum: number, p: any) => sum + (p.amount || 0), 0) || 0;
        const paymentsCount = payments?.length || 0;
        const lastPayment = payments?.[0]?.payment_date || null;

        await api.put(`/loan-requests/${requestId}`, {
            total_paid: totalPaid,
            payments_count: paymentsCount,
            last_payment_date: lastPayment
        });
    },

    // Obter resumo de pagamentos
    getPaymentsSummary: async (): Promise<{
        totalReceived: number;
        pendingConfirmation: number;
        thisMonth: number;
    }> => {
        const now = new Date();
        const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];

        // Total confirmado
        const { data: confirmed } = await api.get<any[]>('/payments?confirmed=true');

        // Pendente de confirmação
        const { data: pending } = await api.get<any[]>('/payments?confirmed=false');

        // Este mês
        const { data: thisMonth } = await api.get<any[]>(`/payments?confirmed=true&payment_date_gte=${firstDayOfMonth}`);

        return {
            totalReceived: confirmed?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0,
            pendingConfirmation: pending?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0,
            thisMonth: thisMonth?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0
        };
    },

    // Upload de comprovante
    uploadProof: async (file: File, requestId: string): Promise<string | null> => {
        const { data, error } = await api.upload(file, `payment_${requestId}_${Date.now()}_${file.name}`);

        if (error) {
            console.error('Erro ao fazer upload do comprovante:', error);
            return null;
        }

        return data?.url || null;
    }
};
