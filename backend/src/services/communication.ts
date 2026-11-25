import { prisma } from './prisma';
import { sendWhatsAppMessage } from './whatsapp';
import { whatsappAllowed, commSuspended } from './collectionRules';

/**
 * Comunicações automáticas de WhatsApp ao CLIENTE (fora da régua de templates).
 * Liga/desliga no painel (Réguas de Cobrança → Automações), sem precisar de SSH.
 *
 * - automationEnabled: false = nenhuma mensagem automática nova (pausa geral).
 * - inviteWhatsapp: convite de ativação e "consultar/regularizar" saem pelo sistema.
 *   A variável LEGACY_WHATSAPP_ENABLED=true continua valendo como "ligado" (compatibilidade).
 * - testPhone: com ele preenchido, as mensagens dessas ações vão SÓ para esse número
 *   (homologação controlada). Vazio = destinatário real.
 */
export type CommunicationSettings = { automationEnabled: boolean; inviteWhatsapp: boolean; testPhone: string };

const KEY = 'communication_settings';

export async function getCommunicationSettings(db: any = prisma): Promise<CommunicationSettings> {
    const row = await db.systemSetting.findUnique({ where: { key: KEY } }).catch(() => null);
    let v: any = {};
    try { v = row ? JSON.parse(row.value) : {}; } catch { /* usa padrões */ }
    return {
        automationEnabled: v.automationEnabled !== false,
        inviteWhatsapp: v.inviteWhatsapp === true || (v.inviteWhatsapp === undefined && process.env.LEGACY_WHATSAPP_ENABLED === 'true'),
        testPhone: typeof v.testPhone === 'string' ? v.testPhone.replace(/\D/g, '').slice(0, 13) : '',
    };
}

export async function saveCommunicationSettings(input: any, db: any = prisma): Promise<CommunicationSettings> {
    const cur = await getCommunicationSettings(db);
    const next: CommunicationSettings = {
        automationEnabled: typeof input?.automationEnabled === 'boolean' ? input.automationEnabled : cur.automationEnabled,
        inviteWhatsapp: typeof input?.inviteWhatsapp === 'boolean' ? input.inviteWhatsapp : cur.inviteWhatsapp,
        testPhone: typeof input?.testPhone === 'string' ? input.testPhone.replace(/\D/g, '').slice(0, 13) : cur.testPhone,
    };
    if (next.testPhone && !/^(55)?\d{10,11}$/.test(next.testPhone)) throw new Error('Telefone de teste inválido');
    await db.systemSetting.upsert({ where: { key: KEY }, update: { value: JSON.stringify(next) }, create: { key: KEY, value: JSON.stringify(next) } });
    return next;
}

export type ClientMessageKind = 'INVITE' | 'REGULARIZE' | 'PAYMENT_CONFIRMED' | 'PAYMENT_REJECTED' | 'SETTLED' | 'INVESTMENT_PAYOUT';

/**
 * Pode mandar esta mensagem a este cliente AGORA? Relê o cliente do banco
 * (vale o bloqueio feito depois que a ação começou). null = pode.
 */
export async function clientMessageBlock(customerId: string, kind: ClientMessageKind, db: any = prisma): Promise<string | null> {
    const settings = await getCommunicationSettings(db);
    if (!settings.automationEnabled) return 'Automações de WhatsApp pausadas no painel';
    const c = await db.customer.findUnique({ where: { id: customerId } });
    if (!c) return 'Cliente não encontrado';
    if (kind === 'INVITE' && c.inviteOptOut) return 'Cliente não quer receber convite';
    if (!whatsappAllowed(c)) return commSuspended(c) ? 'Comunicação do cliente suspensa' : 'Telefone inválido ou cliente não quer WhatsApp';
    return null;
}

/**
 * Envia uma mensagem de serviço ao titular, respeitando preferências na hora do envio,
 * a pausa geral e o modo de teste; registra em notification_logs.
 */
export async function sendClientWhatsApp(customerId: string, kind: ClientMessageKind, text: string, db: any = prisma): Promise<{ sent: boolean; blocked: string | null; testMode: boolean }> {
    const blocked = await clientMessageBlock(customerId, kind, db);
    const settings = await getCommunicationSettings(db);
    if (blocked) {
        await log(db, customerId, kind, 'BLOCKED', blocked);
        return { sent: false, blocked, testMode: !!settings.testPhone };
    }
    const c = await db.customer.findUnique({ where: { id: customerId }, select: { phone: true } });
    const to = settings.testPhone || c.phone;
    const sent = await sendWhatsAppMessage(to, settings.testPhone ? `[TESTE — destinatário real: final ${String(c.phone).slice(-4)}]\n\n${text}` : text).catch(() => false);
    await log(db, customerId, kind, sent ? 'SENT' : 'FAILED', sent ? null : 'Falha no provedor (Evolution) ou WhatsApp desconectado', settings.testPhone ? 'TEST' : undefined);
    return { sent, blocked: null, testMode: !!settings.testPhone };
}

async function log(db: any, customerId: string, kind: string, status: string, error: string | null, mode?: string) {
    await db.notificationLog.create({
        data: { type: 'CLIENT_WHATSAPP', recipient: customerId, subject: kind, status, errorMessage: error, metadata: mode ? { mode } : undefined },
    }).catch(() => {});
}
