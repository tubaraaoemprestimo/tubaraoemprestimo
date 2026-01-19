// 🤝 Referral Service - Sistema de Indicações
// Migrado para Supabase

import { supabase } from './supabaseClient';
import { ReferralCode, ReferralUsage, Customer } from '../types';

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
    // Generate or get existing referral code for a user
    getOrCreateCode: async (userId: string, userName: string): Promise<ReferralCode> => {
        try {
            // Check if code already exists
            const { data: existing } = await supabase
                .from('referrals')
                .select('*')
                .eq('referrer_customer_id', userId)
                .limit(1);

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

            // Generate new code
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

            return newCode;
        } catch (e) {
            // Fallback
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

    // Get code by code string
    getByCode: async (code: string): Promise<ReferralCode | undefined> => {
        try {
            // Parse code to find referral
            const codes = loadFromStorage<ReferralCode[]>(STORAGE_KEYS.REFERRAL_CODES, []);
            return codes.find(c => c.code === code && c.status === 'ACTIVE');
        } catch {
            return undefined;
        }
    },

    // Register usage of a referral code (when a new user signs up)
    registerUsage: async (code: string, newUserId: string, newUserName: string): Promise<void> => {
        const referralCode = await referralService.getByCode(code);
        if (!referralCode || referralCode.userId === newUserId) return; // Can't self-refer

        try {
            // Check if already referred
            const { data: existing } = await supabase
                .from('referrals')
                .select('id')
                .eq('referred_cpf', newUserId)
                .limit(1);

            if (existing && existing.length > 0) return;

            // Create referral in Supabase
            await supabase.from('referrals').insert({
                referrer_customer_id: referralCode.userId,
                referrer_name: referralCode.userName,
                referred_name: newUserName,
                referred_cpf: newUserId,
                status: 'PENDING',
                reward_amount: 50.00
            });
        } catch (e) {
            // Fallback
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

    // Admin: Get all usages
    getAllUsages: async (): Promise<ReferralUsage[]> => {
        try {
            const { data, error } = await supabase
                .from('referrals')
                .select('*')
                .order('created_at', { ascending: false });

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

    // Admin: Validate usage (Anti-fraud check)
    validateUsage: async (usageId: string, action: 'VALIDATE' | 'REJECT' | 'FRAUD', reason?: string): Promise<void> => {
        try {
            const newStatus = action === 'VALIDATE' ? 'CONVERTED' : action === 'FRAUD' ? 'REJECTED' : 'REJECTED';

            await supabase
                .from('referrals')
                .update({
                    status: newStatus,
                    converted_at: new Date().toISOString(),
                    notes: reason
                })
                .eq('id', usageId);
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

    // Anti-fraud detection logic
    checkFraudIndicators: (usage: ReferralUsage, customers: Customer[]): string[] => {
        const risks: string[] = [];
        const referrer = customers.find(c => c.id === usage.referrerId);
        const referred = customers.find(c => c.id === usage.referredId);

        if (!referrer || !referred) return ['Usuário não encontrado'];

        // 2. Similar Name patterns
        if (referrer.name.split(' ')[1] === referred.name.split(' ')[1]) {
            risks.push('Sobrenome idêntico - Possível parente (verificar regras)');
        }

        // 3. Very close creation time
        const timeDiff = Math.abs(new Date(referred.joinedAt).getTime() - new Date(referrer.joinedAt).getTime());
        if (timeDiff < 1000 * 60 * 60) { // 1 hour
            risks.push('Contas criadas com menos de 1h de diferença');
        }

        // 4. Sequential CPFs (Mock logic)
        const cpf1 = referrer.cpf.replace(/\D/g, '');
        const cpf2 = referred.cpf.replace(/\D/g, '');
        if (Math.abs(Number(cpf1) - Number(cpf2)) < 100) {
            risks.push('CPFs sequenciais ou muito próximos');
        }

        return risks;
    }
};
