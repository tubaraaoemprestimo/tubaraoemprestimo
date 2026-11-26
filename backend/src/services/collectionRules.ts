import { prisma } from './prisma';
import { templateService } from './templateService';

/**
 * Regras da régua de cobrança (configuráveis no painel) + porta única de envio.
 *
 * Toda mensagem automática passa por `collectionGate` (pode enviar?) e
 * `sendCollection` (envia e registra). O registro em collection_dispatches
 * (chave: cobrança + gatilho + vencimento) impede o mesmo aviso de sair duas vezes.
 */

export type CollectionRules = {
    enabled: boolean;           // false = régua não envia mensagens (multas/juros seguem calculando)
    reminderDays: number[];     // dias antes do vencimento (ex.: 7, 5, 3)
    sendHour: number;           // hora (Brasília) da rodada diária
    templates: Record<string, string>; // dias → gatilho do template (padrão INSTALLMENT_DUE_<n>_DAYS)
};

const RULES_KEY = 'collection_rules';
const LAST_RUN_KEY = 'collection_last_run';

export function defaultRules(): CollectionRules {
    return {
        enabled: true,
        reminderDays: process.env.COLLECTION_DUE_5_DAYS_ENABLED === 'true' ? [7, 5, 3] : [7, 3],
        sendHour: 9,
        templates: {},
    };
}

export function sanitizeRules(r: any): CollectionRules {
    const days = [...new Set((Array.isArray(r?.reminderDays) ? r.reminderDays : []).map(Number))]
        .filter((d: any) => Number.isInteger(d) && d >= 1 && d <= 30)
        .sort((a: any, b: any) => b - a) as number[];
    const hour = Number(r?.sendHour);
    const templates: Record<string, string> = {};
    for (const [k, v] of Object.entries(r?.templates || {})) {
        if (/^\d{1,2}$/.test(k) && typeof v === 'string' && /^[A-Z0-9_]{3,60}$/.test(v)) templates[k] = v;
    }
    return {
        enabled: r?.enabled !== false,
        reminderDays: days,
        sendHour: Number.isInteger(hour) && hour >= 7 && hour <= 20 ? hour : 9,
        templates,
    };
}

export async function getCollectionRules(db: any = prisma): Promise<CollectionRules> {
    const row = await db.systemSetting.findUnique({ where: { key: RULES_KEY } }).catch(() => null);
    if (!row) return defaultRules();
    try { return sanitizeRules({ ...defaultRules(), ...JSON.parse(row.value) }); } catch { return defaultRules(); }
}

export async function saveCollectionRules(input: any, db: any = prisma): Promise<CollectionRules> {
    const rules = sanitizeRules(input);
    await db.systemSetting.upsert({ where: { key: RULES_KEY }, update: { value: JSON.stringify(rules) }, create: { key: RULES_KEY, value: JSON.stringify(rules) } });
    return rules;
}

export const reminderTrigger = (rules: CollectionRules, days: number) => rules.templates[String(days)] || `INSTALLMENT_DUE_${days}_DAYS`;

/** Dia (Brasília, AAAA-MM-DD) da última rodada automática — evita rodar 2× no mesmo dia. */
export function brDate(d = new Date()): string {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(d);
}
export async function getLastRunDate(db: any = prisma): Promise<string | null> {
    return (await db.systemSetting.findUnique({ where: { key: LAST_RUN_KEY } }).catch(() => null))?.value ?? null;
}
export async function setLastRunDate(value: string, db: any = prisma) {
    await db.systemSetting.upsert({ where: { key: LAST_RUN_KEY }, update: { value }, create: { key: LAST_RUN_KEY, value } });
}

/** Comunicação do titular suspensa temporariamente (até a data, ou sem prazo se só tiver motivo). */
export function commSuspended(customer: any, now = new Date()): boolean {
    if (!customer) return false;
    if (customer.commSuspendedUntil) return new Date(customer.commSuspendedUntil) > now;
    return !!customer.commSuspendedReason;
}

/** WhatsApp só para o próprio titular, com telefone válido, sem opt-out, sem suspensão e sem marca de telefone inválido. */
export function whatsappAllowed(customer: any): boolean {
    if (!customer || customer.whatsappOptOut || customer.activationStatus === 'TELEFONE_INVALIDO' || commSuspended(customer)) return false;
    let d = String(customer.phone || '').replace(/\D/g, '');
    if (d.length === 10 || d.length === 11) d = `55${d}`;
    return /^55\d{10,11}$/.test(d);
}

export type SkipReason = 'CONTRATO_ENCERRADO' | 'SALDO_ZERO' | 'SALDO_NAO_CONFIRMADO' | 'COMUNICACAO_SUSPENSA' | 'CLIENTE_SUSPENSO' | 'EM_ATENDIMENTO_HUMANO' | 'CONTESTACAO_ABERTA' | 'PAGAMENTO_EM_CONFERENCIA' | 'JA_ENVIADO';

export const SKIP_LABEL: Record<SkipReason, string> = {
    CONTRATO_ENCERRADO: 'Contrato quitado/cancelado',
    SALDO_ZERO: 'Saldo zero',
    SALDO_NAO_CONFIRMADO: 'Saldo antigo não conferido',
    COMUNICACAO_SUSPENSA: 'Mensagens pausadas no contrato',
    CLIENTE_SUSPENSO: 'Comunicação do cliente suspensa',
    EM_ATENDIMENTO_HUMANO: 'Cliente em atendimento humano (lembretes pausados)',
    CONTESTACAO_ABERTA: 'Contestação aberta',
    PAGAMENTO_EM_CONFERENCIA: 'Pagamento aguardando conferência',
    JA_ENVIADO: 'Já enviado',
};

export const OPEN_DISPUTE = ['OPEN', 'IN_REVIEW', 'WAITING_DOCS'];

/**
 * null = pode enviar; senão o motivo de não enviar.
 * Relê contrato, cobrança e cliente do banco NA HORA do envio: um bloqueio feito
 * depois do início da rodada (pausa, contestação, opt-out, quitação) vale na hora.
 */
export async function collectionGate(installment: any, trigger: string, db: any = prisma): Promise<SkipReason | null> {
    const fresh = installment?.id && db.installment?.findUnique
        ? await db.installment.findUnique({ where: { id: installment.id }, include: { loan: { include: { customer: true } } } })
        : installment;
    const loan = fresh?.loan;
    if (fresh && installment?.loan) installment.loan.customer = loan?.customer ?? installment.loan.customer; // envio usa as preferências atuais
    let reason: SkipReason | null = null;
    if (!loan || !['ACTIVE'].includes(loan.status) || !['OPEN', 'LATE', 'AWAITING_CONFIRMATION'].includes(fresh.status)) reason = 'CONTRATO_ENCERRADO';
    else if (Number(loan.remainingAmount) <= 0) reason = 'SALDO_ZERO';
    else if (loan.collectionSuspended) reason = 'SALDO_NAO_CONFIRMADO';
    else if (loan.messagesSuspended) reason = 'COMUNICACAO_SUSPENSA';
    else if (commSuspended(loan.customer)) reason = 'CLIENTE_SUSPENSO';
    else if (trigger.startsWith('INSTALLMENT_DUE_') && await inHumanService(loan.customer, db)) reason = 'EM_ATENDIMENTO_HUMANO';
    else if (await db.dispute?.count?.({ where: { loanId: loan.id, status: { in: OPEN_DISPUTE }, OR: [{ installmentId: null }, { installmentId: fresh.id }] } })) reason = 'CONTESTACAO_ABERTA';
    else if (fresh.status === 'AWAITING_CONFIRMATION'
        || await db.paymentReceipt.count({ where: { installmentId: installment.id, status: 'PENDING' } })) reason = 'PAGAMENTO_EM_CONFERENCIA';
    else if (await db.collectionDispatch.count({ where: { installmentId: installment.id, triggerEvent: trigger, dueDate: installment.dueDate, status: 'SENT' } })) reason = 'JA_ENVIADO';
    if (reason) console.log(`[CollectionRules] ${trigger} cobrança ${String(installment?.id).slice(0, 8)} não enviada: ${reason}`);
    return reason;
}

/** Envia pelo serviço de templates existente e registra o resultado (SENT/FAILED). */
export async function sendCollection(installment: any, trigger: string, recipient: any, variables: any) {
    const customer = installment.loan.customer;
    const result = await templateService.triggerTemplate(trigger, { ...recipient, phone: whatsappAllowed(customer) ? customer.phone : '' }, variables);
    const status = result.success ? 'SENT' : 'FAILED';
    const error = result.success ? null : 'Nenhum canal entregou (sem template ativo, WhatsApp desconectado ou sem contato)';
    await prisma.collectionDispatch.upsert({
        where: { installmentId_triggerEvent_dueDate: { installmentId: installment.id, triggerEvent: trigger, dueDate: installment.dueDate } },
        create: { loanId: installment.loanId, installmentId: installment.id, customerId: customer.id, triggerEvent: trigger, dueDate: installment.dueDate, status, channels: result.channels, error },
        update: { status, channels: result.channels, error, attempts: { increment: 1 } },
    }).catch((e: any) => console.error('[CollectionRules] falha ao registrar envio:', e?.message));
    return result;
}

const OPEN = ['OPEN', 'LATE', 'AWAITING_CONFIRMATION'];

/**
 * Mensagens programadas para os próximos `daysAhead` dias (lembretes e "vence hoje"),
 * com o motivo quando não sairão. Somente leitura.
 */
export async function previewScheduled(daysAhead = 7, db: any = prisma) {
    const rules = await getCollectionRules(db);
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const steps = [...rules.reminderDays.map(d => ({ days: d, trigger: reminderTrigger(rules, d) })), { days: 0, trigger: 'INSTALLMENT_DUE_TODAY' }];
    const items: any[] = [];
    for (const step of steps) {
        const from = new Date(start); from.setDate(from.getDate() + step.days);
        const to = new Date(from); to.setDate(to.getDate() + daysAhead);
        const insts = await db.installment.findMany({
            where: { dueDate: { gte: from, lt: to }, status: { in: OPEN }, loan: { status: 'ACTIVE' } },
            include: { loan: { include: { customer: { select: { id: true, name: true, phone: true, whatsappOptOut: true, activationStatus: true } } } } },
            orderBy: { dueDate: 'asc' }, take: 300,
        });
        for (const i of insts) {
            const sendOn = new Date(i.dueDate); sendOn.setHours(0, 0, 0, 0); sendOn.setDate(sendOn.getDate() - step.days);
            const skip = rules.enabled ? await collectionGate(i, step.trigger, db) : null;
            items.push({
                sendOn, dueDate: i.dueDate, trigger: step.trigger, daysBefore: step.days, amount: i.amount,
                loanId: i.loanId, installmentId: i.id, customerName: i.loan.customer?.name,
                whatsapp: whatsappAllowed(i.loan.customer),
                status: !rules.enabled ? 'REGUA_DESLIGADA' : skip ? skip : 'PROGRAMADA',
                reason: !rules.enabled ? 'Régua desligada' : skip ? SKIP_LABEL[skip] : null,
            });
        }
    }
    items.sort((a, b) => +a.sendOn - +b.sendOn);
    return { rules, items };
}

/**
 * Opcional (Central WhatsApp → Configurações): lembretes de vencimento (não as cobranças de atraso)
 * esperam enquanto o cliente está sendo atendido por um humano. Desligado por padrão.
 */
async function inHumanService(customer: any, db: any): Promise<boolean> {
    if (!customer?.phone || !db.waConversation?.findFirst) return false;
    const settings = await db.systemSetting?.findUnique?.({ where: { key: 'inbox_settings' } }).catch(() => null);
    if (!settings) return false;
    try { if (JSON.parse(settings.value).pauseRemindersDuringHuman !== true) return false; } catch { return false; }
    let d = String(customer.phone).replace(/\D/g, '');
    if (d.length === 10 || d.length === 11) d = `55${d}`;
    const conv = await db.waConversation.findFirst({ where: { phone: d, mode: { in: ['HUMAN_ACTIVE', 'WAITING_HUMAN'] } }, select: { id: true } }).catch(() => null);
    return !!conv;
}
