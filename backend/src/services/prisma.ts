import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: any };

const base = globalForPrisma.prisma ?? new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

// Compat layer: código legado camelCase/singular -> schema atual snake_case/plural
// Compat layer: código legado camelCase/singular -> schema atual Prisma Client camelCase
const aliases: Record<string, string> = {
    // Singular -> Singular mappings (redundant if property exists, but safe)
    user: 'user',
    customer: 'customer',
    loanRequest: 'loanRequest',
    loan: 'loan',
    installment: 'installment',
    loanPackage: 'loanPackage',
    notification: 'notification',
    notificationLog: 'notificationLog',
    messageTemplate: 'messageTemplate',
    pushSubscription: 'pushSubscription',
    riskEvent: 'riskEvent',
    trustedDevice: 'trustedDevice',
    securityBlock: 'securityBlock',
    securityAlert: 'securityAlert',
    temporaryLink: 'temporaryLink',
    contractSignature: 'contractSignature',

    // Legacy singular -> Actual Model Property (Plural names in schema -> Plural properties in client)
    brandSetting: 'brandSettings', // Model BrandSettings
    goalsSetting: 'goalsSettings', // Model GoalsSettings
    goalSetting: 'goalsSettings',  // Alias variant

    // Other mappings
    systemSetting: 'systemSetting',
    whatsappConfig: 'whatsappConfig',
    collectionRule: 'collectionRule',
    campaign: 'campaign',
    coupon: 'coupon',
    aiChatbotConfig: 'aiChatbotConfig',
    aiChatHistory: 'aiChatHistory',
    webauthnCredential: 'webauthnCredential',
    transaction: 'transaction',
    auditLog: 'auditLog',
    paymentReceipt: 'paymentReceipt',
    referral: 'referral',
    creditScore: 'creditScore',
    incomeAnalysis: 'incomeAnalysis',
    openFinanceConsent: 'openFinanceConsent'
};

export const prisma: any = new Proxy(base as any, {
    get(target, prop: string, receiver) {
        if (typeof prop === 'string' && !(prop in target) && aliases[prop]) {
            return target[aliases[prop]];
        }
        return Reflect.get(target, prop, receiver);
    }
});

if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = base;
}
