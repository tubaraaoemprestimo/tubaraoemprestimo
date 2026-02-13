import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: any };

const base = globalForPrisma.prisma ?? new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

// Compat layer: código legado camelCase/singular -> schema atual snake_case/plural
const aliases: Record<string, string> = {
    user: 'users',
    customer: 'customers',
    loanRequest: 'loan_requests',
    loan: 'loans',
    installment: 'installments',
    loanPackage: 'loan_packages',
    notification: 'notifications',
    notificationLog: 'notification_logs',
    messageTemplate: 'message_templates',
    pushSubscription: 'push_subscriptions',
    riskEvent: 'risk_events',
    trustedDevice: 'trusted_devices',
    securityBlock: 'security_blocks',
    securityAlert: 'security_alerts',
    temporaryLink: 'temporary_links',
    contractSignature: 'contract_signatures',
    brandSetting: 'brand_settings',
    goalSetting: 'goals_settings',
    goalsSetting: 'goals_settings',
    systemSetting: 'system_settings',
    whatsappConfig: 'whatsapp_config',
    collectionRule: 'collection_rules',
    campaign: 'campaigns',
    coupon: 'coupons',
    aiChatbotConfig: 'ai_chatbot_config',
    aiChatHistory: 'ai_chat_history',
    webauthnCredential: 'webauthn_credentials',
    transaction: 'transactions',
    auditLog: 'audit_logs'
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
