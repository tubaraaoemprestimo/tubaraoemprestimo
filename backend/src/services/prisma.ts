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

    // Plural aliases -> Singular Prisma properties (used in cron, routes)
    installments: 'installment',
    notifications: 'notification',
    loans: 'loan',
    customers: 'customer',
    users: 'user',

    // Snake_case aliases -> camelCase Prisma properties (used in openFinance)
    credit_scores: 'creditScore',
    income_analyses: 'incomeAnalysis',
    open_finance_consents: 'openFinanceConsent',
    system_settings: 'systemSetting',
    risk_events: 'riskEvent',
    trusted_devices: 'trustedDevice',
    security_blocks: 'securityBlock',
    security_alerts: 'securityAlert',
    notification_logs: 'notificationLog',
    push_subscriptions: 'pushSubscription',
    loan_requests: 'loanRequest',
    loan_packages: 'loanPackage',
    collection_rules: 'collectionRule',
    message_templates: 'messageTemplate',
    contract_signatures: 'contractSignature',
    temporary_links: 'temporaryLink',
    scheduled_status: 'scheduledStatus',
    payment_receipts: 'paymentReceipt',
    ai_chat_history: 'aiChatHistory',
    ai_chatbot_config: 'aiChatbotConfig',
    webauthn_credentials: 'webauthnCredential',
    whatsapp_config: 'whatsappConfig',

    // CamelCase plural aliases
    systemSettings: 'systemSetting',
    loanRequests: 'loanRequest',
    riskEvents: 'riskEvent',
    trustedDevices: 'trustedDevice',
    securityBlocks: 'securityBlock',
    securityAlerts: 'securityAlert',

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
    openFinanceConsent: 'openFinanceConsent',
    blacklist: 'blacklist',
    otpCode: 'otpCode',
    scheduledStatus: 'scheduledStatus'
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
