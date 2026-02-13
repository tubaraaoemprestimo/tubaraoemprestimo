// Referral Service - Sistema de Indicações com Gamificação
import { api } from './apiClient';

export interface MyReferralsData {
    referralCode: string;
    points: number;
    totalBonus: number;
    referrals: {
        id: string;
        referred_name: string;
        referred_phone: string;
        status: string;
        points_awarded: number;
        bonus_amount: number;
        created_at: string;
        approved_at: string | null;
    }[];
}

export const referralService = {
    // Buscar dados de indicação do cliente logado
    async getMyReferrals(): Promise<MyReferralsData> {
        try {
            const { data, error } = await api.get<MyReferralsData>('/referrals/my');
            if (error || !data) {
                return { referralCode: '', points: 0, totalBonus: 0, referrals: [] };
            }
            return data;
        } catch {
            return { referralCode: '', points: 0, totalBonus: 0, referrals: [] };
        }
    },

    // Listar todas as indicações (admin)
    async getAllReferrals(filters?: { status?: string }): Promise<any[]> {
        try {
            const query = filters?.status ? `?status=${filters.status}` : '';
            const { data, error } = await api.get<any[]>(`/referrals${query}`);
            if (error || !data) return [];
            return data;
        } catch {
            return [];
        }
    },

    // Atualizar status de uma indicação (admin)
    async updateReferral(id: string, updates: { status?: string; points_awarded?: number; bonus_amount?: number }) {
        const { data, error } = await api.put(`/referrals/${id}`, updates);
        if (error) throw new Error('Erro ao atualizar indicação');
        return data;
    },

    // Compartilhar código via Web Share API
    async shareCode(code: string): Promise<boolean> {
        if (navigator.share) {
            try {
                await navigator.share({
                    title: 'Tubarão Empréstimos - Indicação',
                    text: `Use meu código de indicação ${code} e ganhe benefícios exclusivos no Tubarão Empréstimos!`,
                    url: `https://www.tubaraoemprestimo.com.br/#/register?ref=${code}`
                });
                return true;
            } catch {
                return false;
            }
        }
        // Fallback: copiar para clipboard
        try {
            await navigator.clipboard.writeText(code);
            return true;
        } catch {
            return false;
        }
    },

    // Regras de recompensa
    getRewardRules() {
        return [
            { minLoanAmount: 0, points: 100, bonus: 0, description: 'Indicação aprovada (qualquer valor)' },
            { minLoanAmount: 5000, points: 100, bonus: 50, description: 'Indicação aprovada (R$ 5.000+)' },
            { minLoanAmount: 10000, points: 100, bonus: 100, description: 'Indicação aprovada (R$ 10.000+)' }
        ];
    }
};
