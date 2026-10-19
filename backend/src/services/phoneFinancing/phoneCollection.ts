/**
 * Régua de cobrança do financiamento de celulares. SEPARADA da régua de
 * empréstimos (collectionAutomationService não é tocado) e SEM qualquer ligação
 * com MDM: atraso só gera mensagem e, depois da tolerância, encaminhamento humano.
 *
 * Idempotente: phone_collection_events tem UNIQUE(installment, stage, dia).
 * Roda no mesmo node-cron já existente (horário da política, America/Sao_Paulo).
 */

export type Stage = 'REMINDER' | 'DUE_TODAY' | 'AFTER_GRACE' | 'HUMAN_HANDOFF';

/** Dia (YYYY-MM-DD) em São Paulo. */
export function spDay(d: Date): string {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}
function dayDiff(a: string, b: string) {
    return Math.round((Date.parse(`${a}T12:00:00Z`) - Date.parse(`${b}T12:00:00Z`)) / 864e5);
}

/** Qual etapa cabe hoje para uma parcela (ou nenhuma). Pura, testável. */
export function stageFor(dueDate: Date, today: Date, policy: { reminderDaysBefore: number; graceDaysAfterDue: number }): Stage | null {
    const d = dayDiff(spDay(dueDate), spDay(today)); // >0: falta; <0: atraso
    if (d === policy.reminderDaysBefore && d > 0) return 'REMINDER';
    if (d === 0) return 'DUE_TODAY';
    if (d === -(policy.graceDaysAfterDue + 1)) return 'AFTER_GRACE';
    if (d === -(policy.graceDaysAfterDue + 8)) return 'HUMAN_HANDOFF';
    return null;
}

export function messageFor(stage: Stage, v: { name: string; label: string; amount: string; due: string; link: string }) {
    const first = v.name.split(' ')[0] || 'cliente';
    switch (stage) {
        case 'REMINDER': return `Olá, ${first}! Lembrete: a ${v.label} do seu financiamento de celular (R$ ${v.amount}) vence em ${v.due}. Pague pelo app: ${v.link}`;
        case 'DUE_TODAY': return `Olá, ${first}! A ${v.label} do seu financiamento de celular (R$ ${v.amount}) vence hoje. Pague pelo app: ${v.link}`;
        case 'AFTER_GRACE': return `Olá, ${first}. Não identificamos o pagamento da ${v.label} do seu financiamento de celular (R$ ${v.amount}), vencida em ${v.due}. Se já pagou, desconsidere. Para pagar ou negociar: ${v.link}`;
        case 'HUMAN_HANDOFF': return `Olá, ${first}. Nossa equipe vai entrar em contato sobre a ${v.label} do seu financiamento de celular, para encontrarmos a melhor forma de regularizar.`;
    }
}

export interface CollectionDeps {
    prisma: any;
    sendWhatsApp: (phone: string, text: string) => Promise<boolean>;
    notifyAdmins: (title: string, body: string) => Promise<void>;
    appUrl: string;
    now: () => Date;
}

export async function runPhoneCollection(deps: CollectionDeps) {
    const { prisma } = deps;
    const settings = await prisma.phoneFinancingSettings.findUnique({ where: { id: 'default' } });
    if (!settings) return { sent: 0, skipped: 0 };
    const today = deps.now();
    const horizon = new Date(today.getTime() + (settings.reminderDaysBefore + 2) * 864e5);
    const rows = await prisma.phoneSaleInstallment.findMany({
        where: {
            status: { in: ['OPEN', 'PARTIAL'] }, collectionPaused: false, dueDate: { lte: horizon },
            sale: { status: { in: ['active', 'in_collection'] } },
        },
        include: { sale: true },
    });
    let sent = 0, skipped = 0;
    for (const inst of rows) {
        const stage = stageFor(inst.dueDate, today, settings);
        if (!stage) continue;
        const sentOn = spDay(today);
        // Trava idempotente ANTES de enviar: se já existe, outra execução cuidou.
        try {
            await prisma.phoneCollectionEvent.create({ data: { installmentId: inst.id, stage, channel: 'WHATSAPP', status: 'PENDING', sentOn } });
        } catch { skipped++; continue; }
        const customer = await prisma.customer.findUnique({ where: { id: inst.sale.customerId } });
        const text = messageFor(stage, {
            name: customer?.name || '', label: inst.kind === 'DOWN_PAYMENT' ? 'entrada' : `parcela ${inst.number}`,
            amount: ((inst.amountCents - inst.paidCents) / 100).toFixed(2).replace('.', ','),
            due: new Date(inst.dueDate).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
            link: `${deps.appUrl.replace(/\/$/, '')}/#/client/financiamento-celulares`,
        });
        const ok = customer?.phone ? await deps.sendWhatsApp(customer.phone, text).catch(() => false) : false;
        await prisma.phoneCollectionEvent.updateMany({ where: { installmentId: inst.id, stage, sentOn }, data: { status: ok ? 'SENT' : 'FAILED' } });
        if (stage === 'AFTER_GRACE' && inst.sale.status === 'active') {
            await prisma.phoneSale.update({ where: { id: inst.saleId }, data: { status: 'in_collection' } });
        }
        if (stage === 'HUMAN_HANDOFF') {
            await deps.notifyAdmins('📱 Celular: cobrança para atendimento humano', `${customer?.name || 'Cliente'} — ${inst.kind === 'DOWN_PAYMENT' ? 'entrada' : `parcela ${inst.number}`} em atraso.`);
        }
        if (ok) sent++;
    }
    return { sent, skipped };
}
