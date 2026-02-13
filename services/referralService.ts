// 🤝 Referral Service - Sistema de Indicações
// Inclui gamificação com pontos e recompensas

import { api } from './apiClient';
import { ReferralCode, ReferralUsage, CustomerPoints, PointsTransaction, REFERRAL_REWARD_RULES } from '../types';

const STORAGE_KEYS = {
    REFERRAL_CODES: 'tubarao_referral_codes',
    REFERRAL_USAGES: 'tubarao_referral_usages'
};

// Fallback helpers
function loadFromStorage<T>(key: string, defaultValue: T): T {
    try {
        const stored = localStorage.getItem(key);
        return stored ? JSON.parse(stored) : defaultValue;
    } catch {
        return defaultValue;
    }
}

function saveToStorage(key: string, data: any): void {
    try {
        localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
        console.error('Error saving to storage:', e);
    }
}

export const referralService = {
    // ==========================================
    // GAMIFICAÇÃO - PONTOS E RECOMPENSAS
    // ==========================================

    async getCustomerPoints(customerId: string): Promise<CustomerPoints> {
        try {
            const { data } = await api.get<any>(`/customers/${customerId}/points`);
            return data as CustomerPoints;
        } catch (e) {
            const key = `points_${customerId}`;
            const stored = loadFromStorage<CustomerPoints>(key, {
                customerId,
                totalPoints: 0,
                availablePoints: 0,
                usedPoints: 0,
                referredCount: 0,
                approvedReferrals: 0,
                lastUpdated: new Date().toISOString()
            });
            return stored;
        }
    },

    async awardPointsForReferral(referrerId: string, referredId: string, loanAmount: number = 0): Promise<void> {
        let rule = REFERRAL_REWARD_RULES[0];
        for (const r of REFERRAL_REWARD_RULES) {
            if (loanAmount >= r.minLoanAmount) {
                rule = r;
            }
        }

        try {
            await api.post('/referrals/points', {
                customer_id: referrerId,
                points: rule.rewardValue,
                type: 'EARNED',
                reason: `Indicação aprovada${loanAmount > 0 ? ` (R$ ${loanAmount.toLocaleString()})` : ''}`,
                related_referral_id: referredId
            });
        } catch (e) {
            const key = `points_${referrerId}`;
            const points = loadFromStorage<CustomerPoints>(key, {
                customerId: referrerId,
                totalPoints: 0,
                availablePoints: 0,
                usedPoints: 0,
                referredCount: 0,
                approvedReferrals: 0,
                lastUpdated: new Date().toISOString()
            });

            points.totalPoints += rule.rewardValue;
            points.availablePoints += rule.rewardValue;
            points.referredCount++;
            points.approvedReferrals++;
            points.lastUpdated = new Date().toISOString();
            saveToStorage(key, points);

            const txKey = `points_tx_${referrerId}`;
            const txs = loadFromStorage<any[]>(txKey, []);
            txs.push({
                id: Date.now().toString(),
                customerId: referrerId,
                points: rule.rewardValue,
                type: 'EARNED',
                reason: rule.description,
                relatedReferralId: referredId,
                createdAt: new Date().toISOString()
            });
            saveToStorage(txKey, txs);
        }
    },

    async getPointsHistory(customerId: string): Promise<PointsTransaction[]> {
        try {
            const { data } = await api.get<any[]>(`/customers/${customerId}/points/history`);
            return data as PointsTransaction[];
        } catch (e) {
            const txKey = `points_tx_${customerId}`;
            return loadFromStorage<PointsTransaction[]>(txKey, []);
        }
    },

    async getAllCustomersPoints(): Promise<any[]> {
        try {
            const { data } = await api.get<any[]>('/referrals/points/all');
            return data;
        } catch (e) {
            const customers = await apiService.getCustomers();
            const result: any[] = [];

            for (const cust of customers) {
                const points = await this.getCustomerPoints(cust.id);
                result.push({ customer: cust, points });
            }
            return result;
        }
    },

    // ==========================================
    // FUNÇÕES ORIGINAIS
    // ==========================================

    getOrCreateCode: async (userId: string, userName: string): Promise<ReferralCode> => {
        try {
            const { data: existing } = await api.get<any[]>(`/referrals?referrer_customer_id=${userId}&limit=1`);

            if (existing && existing.length > 0) {
                const first = existing[0];
                return {
                    id: first.id,
                    userId: first.referrer_customer_id,
                    userName: first.referrer_name,
                    code: `IND-${first.referrer_name.split(' ')[0].toUpperCase()}-${first.id.slice(0, 4)}`,
                    createdAt: first.created_at,
                    status: first.status === 'CONVERTED' ? 'USED' : 'ACTIVE',
                    usageCount: 1
                };
            }

            const firstName = userName.split(' ')[0].toUpperCase().replace(/[^A-Z]/g, '');
            const randomSuffix = Math.floor(1000 + Math.random() * 9000);
            return {
                id: Date.now().toString(),
                userId,
                userName,
                code: `IND-${firstName}-${randomSuffix}`,
                createdAt: new Date().toISOString(),
                status: 'ACTIVE',
                usageCount: 0
            };
        } catch (e) {
            const codes = loadFromStorage<ReferralCode[]>(STORAGE_KEYS.REFERRAL_CODES, []);
            const existing = codes.find(c => c.userId === userId);
            if (existing) return existing;

            const firstName = userName.split(' ')[0].toUpperCase().replace(/[^A-Z]/g, '');
            const randomSuffix = Math.floor(1000 + Math.random() * 9000);
            const newCode: ReferralCode = {
                id: Date.now().toString(),
                userId,
                userName,
                code: `IND-${firstName}-${randomSuffix}`,
                createdAt: new Date().toISOString(),
                status: 'ACTIVE',
                usageCount: 0
            };
            codes.push(newCode);
            saveToStorage(STORAGE_KEYS.REFERRAL_CODES, codes);
            return newCode;
        }
    },

    getByCode: async (code: string): Promise<ReferralCode | undefined> => {
        try {
            const codes = loadFromStorage<ReferralCode[]>(STORAGE_KEYS.REFERRAL_CODES, []);
            return codes.find(c => c.code === code && c.status === 'ACTIVE');
        } catch {
            return undefined;
        }
    },

    registerUsage: async (code: string, newUserId: string, newUserName: string): Promise<void> => {
        const referralCode = await referralService.getByCode(code);
        if (!referralCode || referralCode.userId === newUserId) return;

        try {
            const { data: existing } = await api.get<any[]>(`/referrals?referred_cpf=${newUserId}&limit=1`);
            if (existing && existing.length > 0) return;

            await api.post('/referrals', {
                referrer_customer_id: referralCode.userId,
                referrer_name: referralCode.userName,
                referred_name: newUserName,
                referred_cpf: newUserId,
                status: 'PENDING',
                reward_amount: 50.00
            });
        } catch (e) {
            const usages = loadFromStorage<ReferralUsage[]>(STORAGE_KEYS.REFERRAL_USAGES, []);
            const codes = loadFromStorage<ReferralCode[]>(STORAGE_KEYS.REFERRAL_CODES, []);

            if (usages.some(u => u.referredId === newUserId)) return;

            const newUsage: ReferralUsage = {
                id: Date.now().toString(),
                referralCode: code,
                referrerId: referralCode.userId,
                referredId: newUserId,
                referredName: newUserName,
                status: 'PENDING',
                rewardAmount: 50.00,
                createdAt: new Date().toISOString()
            };

            const codeIndex = codes.findIndex(c => c.id === referralCode.id);
            if (codeIndex >= 0) {
                codes[codeIndex].usageCount++;
                saveToStorage(STORAGE_KEYS.REFERRAL_CODES, codes);
            }

            usages.push(newUsage);
            saveToStorage(STORAGE_KEYS.REFERRAL_USAGES, usages);
        }
    },

    getAllUsages: async (): Promise<ReferralUsage[]> => {
        try {
            const { data, error } = await api.get<any[]>('/referrals');
            if (error || !data) throw error;

            return data.map(r => ({
                id: r.id,
                referralCode: `IND-${r.referrer_name.split(' ')[0].toUpperCase()}`,
                referrerId: r.referrer_customer_id,
                referredId: r.referred_cpf,
                referredName: r.referred_name,
                status: r.status === 'CONVERTED' ? 'VALIDATED' : r.status === 'REJECTED' ? 'REJECTED' : 'PENDING',
                rewardAmount: r.reward_amount || 50,
                createdAt: r.created_at,
                validatedAt: r.converted_at
            }));
        } catch (e) {
            return loadFromStorage<ReferralUsage[]>(STORAGE_KEYS.REFERRAL_USAGES, []);
        }
    },

    validateUsage: async (usageId: string, action: 'VALIDATE' | 'REJECT' | 'FRAUD', reason?: string): Promise<void> => {
        try {
            const newStatus = action === 'VALIDATE' ? 'CONVERTED' : action === 'FRAUD' ? 'REJECTED' : 'REJECTED';
            await api.put(`/referrals/${usageId}`, {
                status: newStatus,
                converted_at: new Date().toISOString(),
                notes: reason
            });
        } catch (e) {
            const usages = loadFromStorage<ReferralUsage[]>(STORAGE_KEYS.REFERRAL_USAGES, []);
            const index = usages.findIndex(u => u.id === usageId);

            if (index >= 0) {
                usages[index].status = action === 'VALIDATE' ? 'VALIDATED' : action === 'FRAUD' ? 'FRAUD_SUSPECTED' : 'REJECTED';
                usages[index].validatedAt = new Date().toISOString();
                if (reason) usages[index].fraudReason = reason;
                saveToStorage(STORAGE_KEYS.REFERRAL_USAGES, usages);
            }
        }
    },

    checkFraudIndicators: (usage: ReferralUsage, customers: Customer[]): string[] => {
        const risks: string[] = [];
        const referrer = customers.find(c => c.id === usage.referrerId);
        const referred = customers.find(c => c.id === usage.referredId);

        if (!referrer || !referred) return ['Usuário não encontrado'];

        if (referrer.name.split(' ')[1] === referred.name.split(' ')[1]) {
            risks.push('Sobrenome idêntico - Possível parente (verificar regras)');
        }

        const timeDiff = Math.abs(new Date(referred.joinedAt).getTime() - new Date(referrer.joinedAt).getTime());
        if (timeDiff < 1000 * 60 * 60) {
            risks.push('Contas criadas com menos de 1h de diferença');
        }

        const cpf1 = referrer.cpf.replace(/\D/g, '');
        const cpf2 = referred.cpf.replace(/\D/g, '');
        if (Math.abs(Number(cpf1) - Number(cpf2)) < 100) {
            risks.push('CPFs sequenciais ou muito próximos');
        }

        return risks;
    }
};
