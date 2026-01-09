
import { ReferralCode, ReferralUsage, Customer } from '../types';

const STORAGE_KEYS = {
    REFERRAL_CODES: 'tubarao_referral_codes',
    REFERRAL_USAGES: 'tubarao_referral_usages'
};

function loadFromStorage<T>(key: string, defaultValue: T): T {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : defaultValue;
}

function saveToStorage(key: string, data: any): void {
    localStorage.setItem(key, JSON.stringify(data));
}

export const referralService = {
    // Generate or get existing referral code for a user
    getOrCreateCode: (userId: string, userName: string): ReferralCode => {
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
    },

    // Get code by code string
    getByCode: (code: string): ReferralCode | undefined => {
        const codes = loadFromStorage<ReferralCode[]>(STORAGE_KEYS.REFERRAL_CODES, []);
        return codes.find(c => c.code === code && c.status === 'ACTIVE');
    },

    // Register usage of a referral code (when a new user signs up)
    registerUsage: (code: string, newUserId: string, newUserName: string): void => {
        const referralCode = referralService.getByCode(code);
        if (!referralCode || referralCode.userId === newUserId) return; // Can't self-refer

        const usages = loadFromStorage<ReferralUsage[]>(STORAGE_KEYS.REFERRAL_USAGES, []);
        const codes = loadFromStorage<ReferralCode[]>(STORAGE_KEYS.REFERRAL_CODES, []);

        // Anti-fraud: Check if this user was already referred
        if (usages.some(u => u.referredId === newUserId)) return;

        const newUsage: ReferralUsage = {
            id: Date.now().toString(),
            referralCode: code,
            referrerId: referralCode.userId,
            referredId: newUserId,
            referredName: newUserName,
            status: 'PENDING',
            rewardAmount: 50.00, // Configurable?
            createdAt: new Date().toISOString()
        };

        // Increment usage count
        const codeIndex = codes.findIndex(c => c.id === referralCode.id);
        if (codeIndex >= 0) {
            codes[codeIndex].usageCount++;
            saveToStorage(STORAGE_KEYS.REFERRAL_CODES, codes);
        }

        usages.push(newUsage);
        saveToStorage(STORAGE_KEYS.REFERRAL_USAGES, usages);
    },

    // Admin: Get all usages
    getAllUsages: (): ReferralUsage[] => {
        return loadFromStorage<ReferralUsage[]>(STORAGE_KEYS.REFERRAL_USAGES, []);
    },

    // Admin: Validate usage (Anti-fraud check)
    validateUsage: (usageId: string, action: 'VALIDATE' | 'REJECT' | 'FRAUD', reason?: string): void => {
        const usages = loadFromStorage<ReferralUsage[]>(STORAGE_KEYS.REFERRAL_USAGES, []);
        const index = usages.findIndex(u => u.id === usageId);

        if (index >= 0) {
            usages[index].status = action === 'VALIDATE' ? 'VALIDATED' : action === 'FRAUD' ? 'FRAUD_SUSPECTED' : 'REJECTED';
            usages[index].validatedAt = new Date().toISOString();
            if (reason) usages[index].fraudReason = reason;

            saveToStorage(STORAGE_KEYS.REFERRAL_USAGES, usages);
        }
    },

    // Anti-fraud detection logic
    checkFraudIndicators: (usage: ReferralUsage, customers: Customer[]): string[] => {
        const risks: string[] = [];
        const referrer = customers.find(c => c.id === usage.referrerId);
        const referred = customers.find(c => c.id === usage.referredId);

        if (!referrer || !referred) return ['Usuário não encontrado'];

        // 1. Same IP (Mocked as not available in localStorage)

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
