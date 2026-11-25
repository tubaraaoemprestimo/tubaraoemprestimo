import { Router, Request } from 'express';
import { prisma } from '../services/prisma';
import { authenticate, requireAdmin } from '../middleware/auth';
import { scheduleDates } from './legacyClients';
import { OPEN_DISPUTE } from '../services/collectionRules';
import { getCommunicationSettings, saveCommunicationSettings, sendClientWhatsApp } from '../services/communication';

/**
 * Pendências dos clientes antigos:
 *  - celular vendido antes do sistema (contrato legado + dados do aparelho; sem venda nova nem estoque);
 *  - investimento antigo (a empresa deve ao investidor; fora da régua de cobrança);
 *  - contestações (suspendem cobranças da obrigação; não mexem em saldo);
 *  - preferências de comunicação do titular;
 *  - painel com números reais;
 *  - automações de WhatsApp ligadas/pausadas pelo painel.
 */
export const legacyOpsRouter = Router();
export const clientDisputesRouter = Router(); // cliente autenticado: abrir/consultar divergência

const str = (v: unknown, max = 300) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const num = (v: unknown) => { if (v === '' || v === null || v === undefined) return null; const n = Number(v); return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : NaN; };
const int = (v: unknown) => { if (v === '' || v === null || v === undefined) return null; const n = Number(v); return Number.isInteger(n) && n >= 0 ? n : NaN; };
const dt = (v: unknown) => { if (!v) return null; const d = new Date(String(v)); return Number.isNaN(d.getTime()) ? undefined : d; };
const url = (v: unknown) => { const s = str(v, 600); return s && /^https:\/\/[^\s]+$/.test(s) ? s : null; };
const today0 = () => new Date(new Date().setHours(0, 0, 0, 0));

async function audit(req: Request, action: string, entity: string, entityId: string, details: any) {
    await prisma.auditLog.create({ data: { userId: req.user!.id, userName: req.user!.name, action, entity, entityId, details: JSON.stringify(details), ipAddress: req.ip } }).catch(() => {});
}

legacyOpsRouter.use(authenticate, requireAdmin);

// ───────────────────────── Celular antigo ─────────────────────────

/**
 * Registra celular vendido/financiado antes do sistema. Vira contrato legado
 * (perfil FINANCIAMENTO_CELULAR) com as parcelas restantes informadas + ficha do aparelho.
 * Não cria venda (phone_sales), não baixa estoque, não lança caixa nem contrato jurídico novo.
 * Faltando dado indispensável: salva PENDENTE DE CONFERÊNCIA, fora da régua.
 */
legacyOpsRouter.post('/customers/:customerId/devices', async (req, res) => {
    const customer = await prisma.customer.findUnique({ where: { id: String(req.params.customerId) } });
    if (!customer) { res.status(404).json({ error: 'Cliente não encontrado' }); return; }
    const b = req.body || {};
    const brand = str(b.brand, 60), model = str(b.model, 80);
    if (!model) { res.status(400).json({ error: 'Informe ao menos o modelo do aparelho' }); return; }
    const price = num(b.originalPrice), down = num(b.downPayment), financed = num(b.financedAmount), balance = num(b.balance), instAmount = num(b.installmentAmount), rate = num(b.monthlyRate);
    const origCount = int(b.originalInstallments), paidCount = int(b.paidInstallments), remaining = int(b.remainingInstallments);
    for (const [k, v] of Object.entries({ price, down, financed, balance, instAmount, rate, origCount, paidCount, remaining })) {
        if (Number.isNaN(v as number)) { res.status(400).json({ error: `Valor inválido: ${k}` }); return; }
    }
    const nextDue = dt(b.nextDueDate), saleDate = dt(b.originalSaleDate), positionDate = dt(b.positionDate);
    if (nextDue === undefined || saleDate === undefined || positionDate === undefined) { res.status(400).json({ error: 'Data inválida' }); return; }
    if (rate !== null && rate > 100) { res.status(400).json({ error: 'Taxa inválida' }); return; }
    if (origCount !== null && paidCount !== null && paidCount > origCount) { res.status(400).json({ error: 'Parcelas pagas maior que o total original' }); return; }
    if (origCount !== null && paidCount !== null && remaining !== null && paidCount + remaining !== origCount) {
        res.status(400).json({ error: `Pagas (${paidCount}) + restantes (${remaining}) precisam somar o total original (${origCount})`, code: 'COUNT_MISMATCH' }); return;
    }
    const frequency = ['MONTHLY', 'WEEKLY', 'DAILY'].includes(b.frequency) ? b.frequency : 'MONTHLY';
    const reference = str(b.reference, 80) || null;
    const settled = balance === 0 || b.status === 'PAID';
    const cancelled = b.status === 'CANCELLED';

    // Indispensável para cobrar: saldo, parcelas restantes, valor da parcela, vencimento futuro e soma conferida.
    const missing: string[] = [];
    if (!settled && !cancelled) {
        if (balance === null) missing.push('saldo');
        if (!remaining) missing.push('parcelas restantes');
        if (!instAmount) missing.push('valor da parcela');
        if (!nextDue) missing.push('próximo vencimento');
        else if (nextDue < today0()) missing.push('vencimento futuro (o informado já passou)');
        if (balance && remaining && instAmount && Math.abs(remaining * instAmount - balance) > 0.01 * remaining) missing.push('parcelas × valor = saldo');
    }
    const confirmed = b.balanceConfirmed === true && missing.length === 0;
    const pending = !settled && !cancelled && (missing.length > 0 || !confirmed);

    if (reference && await prisma.loan.findFirst({ where: { customerId: customer.id, legacyReference: reference }, select: { id: true } })) {
        res.status(409).json({ error: 'Este contrato antigo já foi registrado', code: 'DUPLICATE_REFERENCE' }); return;
    }
    const amount = financed ?? (price !== null && down !== null ? price - down : null) ?? balance ?? 0;
    const status = cancelled ? 'CANCELLED' : settled ? 'COMPLETED' : 'ACTIVE';
    const createInstallments = status === 'ACTIVE' && missing.length === 0;
    const dueDates = createInstallments ? scheduleDates(nextDue!, remaining!, frequency) : [];

    const loan = await prisma.$transaction(async tx => {
        const request = await tx.loanRequest.create({
            data: {
                customerId: customer.id, clientName: customer.name, cpf: customer.cpf, email: customer.email || '', phone: customer.phone,
                amount, approvedAmount: amount, installments: origCount || remaining || 1, profileType: 'FINANCIAMENTO_CELULAR',
                status: status === 'ACTIVE' ? 'APPROVED' : status === 'CANCELLED' ? 'CANCELLED' : 'COMPLETED',
                isLoan: true, isService: false, isInvestment: false,
                supplementalDescription: JSON.stringify({ legado: true, servico: 'Financiamento de celular (antigo)', aparelho: `${brand} ${model}`.trim() }),
            },
        });
        const created = await tx.loan.create({
            data: {
                customerId: customer.id, requestId: request.id, amount, principalAmount: amount, remainingAmount: settled || cancelled ? 0 : (balance ?? 0),
                installmentsCount: Math.max(1, remaining || 1), totalInstallments: origCount || Math.max(1, remaining || 1),
                status, startDate: saleDate || new Date(), paymentFrequency: frequency, interestRate: rate,
                nextPaymentDate: createInstallments ? nextDue : null, source: 'LEGADO', isLoan: true,
                isLegacy: true, legacyReference: reference, legacyOriginalDate: saleDate, legacyPaidAmount: num(b.paidAmount) || null,
                legacyBalanceDate: positionDate || new Date(), legacyBalanceConfirmed: confirmed,
                collectionSuspended: pending, legacyDocumentUrl: url(b.contractUrl),
                adminNotes: [str(b.notes, 800), missing.length ? `Pendente de conferência: falta ${missing.join(', ')}` : ''].filter(Boolean).join(' | ') || null,
            },
        });
        await tx.legacyDeviceFinancing.create({
            data: { loanId: created.id, brand: brand || null, model, deviceIdentifier: str(b.deviceIdentifier, 40) || null, originalSaleDate: saleDate, originalPrice: price, downPayment: down, financedAmount: financed, originalInstallments: origCount, paidInstallments: paidCount, positionDate: positionDate || new Date() },
        });
        if (dueDates.length) await tx.installment.createMany({ data: dueDates.map(dueDate => ({ loanId: created.id, amount: instAmount!, dueDate, status: 'OPEN', isInterestPayment: false })) });
        return created;
    });
    await audit(req, 'LEGACY_DEVICE_CREATED', 'LOAN', loan.id, { model, balance, remaining, status, pending, missing });
    res.status(201).json({ loan: { id: loan.id, status: loan.status, collectionSuspended: loan.collectionSuspended }, missing });
});

// ───────────────────────── Investimento antigo ─────────────────────────

/** Registra aporte antigo. Sem lançamento de caixa (o dinheiro entrou no passado), sem cobrança. */
legacyOpsRouter.post('/customers/:customerId/investments', async (req, res) => {
    const customer = await prisma.customer.findUnique({ where: { id: String(req.params.customerId) } });
    if (!customer) { res.status(404).json({ error: 'Cliente não encontrado' }); return; }
    const b = req.body || {};
    const amount = num(b.amount), rate = num(b.monthlyRate), paidYields = num(b.paidYieldsTotal), pending = num(b.pendingConfirmed);
    if (!amount || Number.isNaN(amount)) { res.status(400).json({ error: 'Informe o valor investido' }); return; }
    if ([rate, paidYields, pending].some(v => Number.isNaN(v as number))) { res.status(400).json({ error: 'Valor inválido' }); return; }
    if (rate !== null && rate > 100) { res.status(400).json({ error: 'Taxa inválida' }); return; }
    const originalDate = dt(b.originalDate), nextPayout = dt(b.nextPayoutDate), maturity = dt(b.maturityDate);
    if ([originalDate, nextPayout, maturity].includes(undefined)) { res.status(400).json({ error: 'Data inválida' }); return; }
    const yieldTerms = str(b.yieldTerms, 1000);
    const reference = str(b.reference, 80) || null;
    // Sem condição contratada informada, não se assume rendimento: fica pendente de conferência.
    const status = ['REDEEMED', 'CANCELLED'].includes(b.status) ? b.status : (yieldTerms || rate !== null) ? 'ACTIVE' : 'PENDING_REVIEW';
    if (reference && await prisma.investmentRecord.findFirst({ where: { customerId: customer.id, reference }, select: { id: true } })) {
        res.status(409).json({ error: 'Este investimento antigo já foi registrado', code: 'DUPLICATE_REFERENCE' }); return;
    }
    const inv = await prisma.investmentRecord.create({
        data: {
            customerId: customer.id, isLegacy: true, reference, originalDate, amount, yieldTerms: yieldTerms || null, monthlyRate: rate,
            payoutFrequency: ['MONTHLY', 'QUARTERLY', 'AT_MATURITY', 'OTHER'].includes(b.payoutFrequency) ? b.payoutFrequency : null,
            paidYieldsTotal: paidYields, pendingConfirmed: pending, nextPayoutDate: nextPayout, maturityDate: maturity, status,
            contractUrl: url(b.contractUrl), notes: str(b.notes, 1000) || null, createdBy: req.user!.id,
        },
    });
    await audit(req, 'LEGACY_INVESTMENT_CREATED', 'INVESTMENT', inv.id, { amount, rate, status, reference });
    res.status(201).json({ investment: inv });
});

legacyOpsRouter.get('/investments', async (_req, res) => {
    const items = await prisma.investmentRecord.findMany({
        orderBy: { createdAt: 'desc' }, take: 200,
        include: { customer: { select: { id: true, name: true, phone: true, userId: true } }, payouts: { orderBy: { paidAt: 'desc' }, take: 5 } },
    });
    res.json({ items });
});

/**
 * Repasse ao investidor. Repasse feito AGORA = saída de caixa (Transaction OUT).
 * Repasse histórico (já pago no passado) = só registro, sem caixa.
 */
legacyOpsRouter.post('/investments/:id/payouts', async (req, res) => {
    const inv = await prisma.investmentRecord.findUnique({ where: { id: String(req.params.id) }, include: { customer: true } });
    if (!inv) { res.status(404).json({ error: 'Investimento não encontrado' }); return; }
    const amount = num(req.body?.amount);
    if (!amount || Number.isNaN(amount)) { res.status(400).json({ error: 'Informe o valor do repasse' }); return; }
    const paidAt = dt(req.body?.paidAt) || new Date();
    if (paidAt === undefined) { res.status(400).json({ error: 'Data inválida' }); return; }
    const historical = req.body?.historical === true;
    if (!historical && String(req.body?.confirm || '').toUpperCase() !== 'REPASSAR') {
        res.status(400).json({ error: 'Confirme o repasse digitando REPASSAR (gera saída no caixa).', code: 'CONFIRM_REQUIRED' }); return;
    }
    const payout = await prisma.$transaction(async tx => {
        const t = historical ? null : await tx.transaction.create({ data: { type: 'OUT', description: `Repasse ao investidor — ${inv.customer.name}`, amount, category: 'INVESTMENT_PAYOUT', date: paidAt } });
        return tx.investmentPayout.create({ data: { investmentId: inv.id, paidAt, amount, receiptUrl: url(req.body?.receiptUrl), transactionId: t?.id || null, notes: str(req.body?.notes, 500) || null, createdBy: req.user!.id } });
    });
    await audit(req, historical ? 'INVESTMENT_PAYOUT_HISTORICAL' : 'INVESTMENT_PAYOUT', 'INVESTMENT', inv.id, { amount, paidAt, transactionId: payout.transactionId });
    let whatsapp = null;
    if (!historical && req.body?.notify === true) {
        whatsapp = await sendClientWhatsApp(inv.customerId, 'INVESTMENT_PAYOUT', `Olá, ${inv.customer.name.split(' ')[0]}! Registramos um repasse do seu investimento na Tubarão Empréstimos. Os detalhes e o comprovante estão no app.`);
    }
    res.status(201).json({ payout, whatsapp });
});

// ───────────────────────── Contestações ─────────────────────────

const DISPUTE_STATUS = ['OPEN', 'IN_REVIEW', 'WAITING_DOCS', 'RESOLVED'];
const histEntry = (req: Request, action: string, note?: string) => ({ at: new Date().toISOString(), by: req.user!.name, role: req.user!.role, action, note: note || undefined });

legacyOpsRouter.post('/disputes', async (req, res) => {
    const loan = await prisma.loan.findUnique({ where: { id: str(req.body?.loanId, 60) }, select: { id: true, customerId: true } });
    if (!loan) { res.status(404).json({ error: 'Contrato não encontrado' }); return; }
    const installmentId = str(req.body?.installmentId, 60) || null;
    if (installmentId && !await prisma.installment.count({ where: { id: installmentId, loanId: loan.id } })) { res.status(400).json({ error: 'Cobrança não pertence ao contrato' }); return; }
    const reason = str(req.body?.reason, 120);
    if (!reason) { res.status(400).json({ error: 'Informe o motivo' }); return; }
    const docs = (Array.isArray(req.body?.documentUrls) ? req.body.documentUrls : []).map(url).filter(Boolean).slice(0, 10);
    const d = await prisma.dispute.create({
        data: { customerId: loan.customerId, loanId: loan.id, installmentId, receiptId: str(req.body?.receiptId, 60) || null, reason, description: str(req.body?.description, 2000) || null,
            status: 'OPEN', openedBy: req.user!.id, openedByRole: 'ADMIN', documentUrls: docs, history: [histEntry(req, 'ABERTA', reason)] },
    });
    await audit(req, 'DISPUTE_OPENED', 'LOAN', loan.id, { disputeId: d.id, installmentId, reason });
    res.status(201).json({ dispute: d });
});

legacyOpsRouter.get('/disputes', async (req, res) => {
    const status = String(req.query.status || '');
    const where: any = status === 'OPEN_ALL' ? { status: { in: OPEN_DISPUTE } } : DISPUTE_STATUS.includes(status) ? { status } : {};
    if (req.query.loanId) where.loanId = String(req.query.loanId);
    if (req.query.customerId) where.customerId = String(req.query.customerId);
    const items = await prisma.dispute.findMany({ where, orderBy: { createdAt: 'desc' }, take: 200, include: { customer: { select: { name: true, phone: true } } } });
    res.json({ items });
});

/**
 * Muda a situação. Resolver exige resolução escrita + confirmação. A resolução NÃO
 * altera saldo: ajuste financeiro, se houver, é feito no contrato (fluxos financeiros
 * existentes, com confirmação própria). Ao resolver, só os avisos dos próximos
 * vencimentos voltam (lembretes de datas já passadas não são reenviados).
 */
legacyOpsRouter.patch('/disputes/:id', async (req, res) => {
    const d = await prisma.dispute.findUnique({ where: { id: String(req.params.id) } });
    if (!d) { res.status(404).json({ error: 'Contestação não encontrada' }); return; }
    if (d.status === 'RESOLVED') { res.status(409).json({ error: 'Contestação já resolvida' }); return; }
    const status = String(req.body?.status || '');
    if (!DISPUTE_STATUS.includes(status)) { res.status(400).json({ error: 'Situação inválida' }); return; }
    const note = str(req.body?.note, 1000);
    const docs = (Array.isArray(req.body?.documentUrls) ? req.body.documentUrls : []).map(url).filter(Boolean);
    if (status === 'RESOLVED') {
        if (!note) { res.status(400).json({ error: 'Descreva a resolução' }); return; }
        if (String(req.body?.confirm || '').toUpperCase() !== 'RESOLVER') { res.status(400).json({ error: 'Confirme digitando RESOLVER', code: 'CONFIRM_REQUIRED' }); return; }
    }
    const updated = await prisma.dispute.update({
        where: { id: d.id },
        data: {
            status, history: [...((d.history as any[]) || []), histEntry(req, status, note)],
            documentUrls: [...(((d.documentUrls as any[]) || [])), ...docs].slice(0, 20),
            ...(status === 'RESOLVED' ? { resolution: note, resolvedBy: req.user!.id, resolvedAt: new Date() } : {}),
        },
    });
    await audit(req, status === 'RESOLVED' ? 'DISPUTE_RESOLVED' : 'DISPUTE_UPDATED', 'LOAN', d.loanId, { disputeId: d.id, status, note });
    res.json({ dispute: updated });
});

// ───────────────────────── Preferências de comunicação ─────────────────────────

const PREF_FIELDS = ['whatsappOptOut', 'inviteOptOut', 'promoOptOut', 'phoneConfirmed'] as const;

legacyOpsRouter.get('/customers/:customerId/communication', async (req, res) => {
    const c = await prisma.customer.findUnique({ where: { id: String(req.params.customerId) }, select: { id: true, phone: true, activationStatus: true, whatsappOptOut: true, inviteOptOut: true, promoOptOut: true, phoneConfirmed: true, commSuspendedUntil: true, commSuspendedReason: true, commPrefsUpdatedAt: true, userId: true } });
    if (!c) { res.status(404).json({ error: 'Cliente não encontrado' }); return; }
    res.json({ preferences: { ...c, phoneInvalid: c.activationStatus === 'TELEFONE_INVALIDO' } });
});

legacyOpsRouter.patch('/customers/:customerId/communication', async (req, res) => {
    const c = await prisma.customer.findUnique({ where: { id: String(req.params.customerId) } });
    if (!c) { res.status(404).json({ error: 'Cliente não encontrado' }); return; }
    const b = req.body || {};
    const data: any = { commPrefsUpdatedAt: new Date() };
    for (const k of PREF_FIELDS) if (typeof b[k] === 'boolean') data[k] = b[k];
    if (typeof b.phoneInvalid === 'boolean') {
        data.activationStatus = b.phoneInvalid ? 'TELEFONE_INVALIDO' : (c.activationStatus === 'TELEFONE_INVALIDO' ? (c.userId ? 'CONTA_ATIVA' : c.isLegacy ? 'PRE_CADASTRO' : null) : c.activationStatus);
        if (b.phoneInvalid) data.phoneConfirmed = false;
    }
    if (b.suspend === true) {
        const until = dt(b.suspendedUntil);
        const reason = str(b.suspendedReason, 300);
        if (until === undefined) { res.status(400).json({ error: 'Data inválida' }); return; }
        if (!reason) { res.status(400).json({ error: 'Informe o motivo da suspensão' }); return; }
        data.commSuspendedUntil = until; data.commSuspendedReason = reason;
    } else if (b.suspend === false) { data.commSuspendedUntil = null; data.commSuspendedReason = null; }
    const before = Object.fromEntries([...PREF_FIELDS, 'activationStatus', 'commSuspendedUntil', 'commSuspendedReason'].map(k => [k, (c as any)[k]]));
    const updated = await prisma.customer.update({ where: { id: c.id }, data });
    await audit(req, 'COMMUNICATION_PREFS_UPDATED', 'CUSTOMER', c.id, { before, after: Object.fromEntries(Object.keys(before).map(k => [k, (updated as any)[k]])) });
    res.json({ ok: true });
});

// ───────────────────────── Automações (sem SSH) ─────────────────────────

legacyOpsRouter.get('/automation', async (_req, res) => {
    const settings = await getCommunicationSettings();
    const wa = await prisma.whatsappConfig.findFirst({ select: { isConnected: true, instanceName: true } }).catch(() => null);
    const since = new Date(Date.now() - 30 * 86400000);
    const logs = await prisma.notificationLog.groupBy({ by: ['subject', 'status'], where: { type: 'CLIENT_WHATSAPP', createdAt: { gte: since } }, _count: true });
    const recent = await prisma.notificationLog.findMany({ where: { type: 'CLIENT_WHATSAPP' }, orderBy: { createdAt: 'desc' }, take: 30, select: { createdAt: true, subject: true, status: true, errorMessage: true, recipient: true, metadata: true } });
    const names = Object.fromEntries((await prisma.customer.findMany({ where: { id: { in: [...new Set(recent.map(r => r.recipient))] } }, select: { id: true, name: true } })).map(c => [c.id, c.name]));
    res.json({ settings, provider: { name: 'Evolution API', instance: wa?.instanceName || null, connected: !!wa?.isConnected }, last30: logs, recent: recent.map(r => ({ ...r, customerName: names[r.recipient] || null })) });
});

legacyOpsRouter.put('/automation', async (req, res) => {
    try {
        const before = await getCommunicationSettings();
        const after = await saveCommunicationSettings(req.body);
        await audit(req, 'AUTOMATION_SETTINGS_UPDATED', 'SETTINGS', 'communication_settings', { before, after });
        res.json({ settings: after });
    } catch (e: any) { res.status(400).json({ error: e.message }); }
});

// ───────────────────────── Painel ─────────────────────────

legacyOpsRouter.get('/dashboard', async (_req, res) => {
    const legacyCustomer = { OR: [{ isLegacy: true }, { loans: { some: { isLegacy: true } } }, { investments: { some: { isLegacy: true } } }] };
    const [total, withAccount, waiting, invitesSent, activeLoans, settledLoans, devices, investments, pendingReview, openDisputes, suspendedComm, sent30, failed30, rules] = await Promise.all([
        prisma.customer.count({ where: legacyCustomer }),
        prisma.customer.count({ where: { AND: [legacyCustomer, { userId: { not: null } }] } }),
        prisma.customer.count({ where: { AND: [legacyCustomer, { userId: null }] } }),
        prisma.activationInvite.count(),
        prisma.loan.count({ where: { isLegacy: true, status: 'ACTIVE' } }),
        prisma.loan.count({ where: { isLegacy: true, status: { in: ['COMPLETED', 'PAID'] } } }),
        prisma.legacyDeviceFinancing.count(),
        prisma.investmentRecord.count({ where: { isLegacy: true } }),
        prisma.loan.count({ where: { isLegacy: true, status: 'ACTIVE', collectionSuspended: true } }),
        prisma.dispute.count({ where: { status: { in: OPEN_DISPUTE } } }),
        prisma.customer.count({ where: { OR: [{ whatsappOptOut: true }, { commSuspendedReason: { not: null } }, { activationStatus: 'TELEFONE_INVALIDO' }] } }),
        prisma.collectionDispatch.count({ where: { status: 'SENT', createdAt: { gte: new Date(Date.now() - 30 * 86400000) } } }),
        prisma.collectionDispatch.count({ where: { status: 'FAILED', createdAt: { gte: new Date(Date.now() - 30 * 86400000) } } }),
        import('../services/collectionRules').then(m => m.previewScheduled(7)),
    ]);
    res.json({
        total, withAccount, waiting, invitesSent, activeLoans, settledLoans, devices, investments, pendingReview, openDisputes, suspendedComm,
        remindersScheduled: rules.items.filter((i: any) => i.status === 'PROGRAMADA').length, sent30, failed30,
    });
});

// ───────────────────────── Cliente: divergências e investimentos ─────────────────────────

clientDisputesRouter.use(authenticate);

async function myCustomer(req: Request) {
    return prisma.customer.findFirst({ where: { userId: req.user!.id }, select: { id: true } });
}

/** Cliente informa divergência/pede conferência de um contrato próprio. Suspende cobranças daquela obrigação. */
clientDisputesRouter.post('/', async (req, res) => {
    const me = await myCustomer(req);
    const loan = me && await prisma.loan.findFirst({ where: { id: str(req.body?.loanId, 60), customerId: me.id }, select: { id: true } });
    if (!me || !loan) { res.status(404).json({ error: 'Contrato não encontrado' }); return; }
    const installmentId = str(req.body?.installmentId, 60) || null;
    if (installmentId && !await prisma.installment.count({ where: { id: installmentId, loanId: loan.id } })) { res.status(404).json({ error: 'Cobrança não encontrada' }); return; }
    const description = str(req.body?.description, 2000);
    if (description.length < 10) { res.status(400).json({ error: 'Conte o que está diferente (pelo menos 10 caracteres)' }); return; }
    if (await prisma.dispute.count({ where: { loanId: loan.id, openedByRole: 'CLIENT', status: { in: OPEN_DISPUTE } } }) >= 3) {
        res.status(429).json({ error: 'Você já tem pedidos de conferência abertos neste contrato. Aguarde nosso retorno.' }); return;
    }
    const d = await prisma.dispute.create({
        data: { customerId: me.id, loanId: loan.id, installmentId, reason: str(req.body?.reason, 120) || 'Divergência informada pelo cliente', description,
            status: 'OPEN', openedBy: req.user!.id, openedByRole: 'CLIENT', documentUrls: (Array.isArray(req.body?.documentUrls) ? req.body.documentUrls : []).map(url).filter(Boolean).slice(0, 5),
            history: [{ at: new Date().toISOString(), by: 'Cliente', role: 'CLIENT', action: 'ABERTA' }] },
    });
    await prisma.notification.create({ data: { title: '⚖️ Pedido de conferência', message: 'Um cliente informou divergência em um contrato. Veja em Clientes Antigos → Contestações.', type: 'WARNING' } }).catch(() => {});
    res.status(201).json({ dispute: { id: d.id, status: d.status } });
});

clientDisputesRouter.get('/', async (req, res) => {
    const me = await myCustomer(req);
    if (!me) { res.json({ items: [] }); return; }
    const items = await prisma.dispute.findMany({ where: { customerId: me.id }, orderBy: { createdAt: 'desc' }, select: { id: true, loanId: true, installmentId: true, reason: true, status: true, createdAt: true, resolution: true } });
    res.json({ items });
});

/** Investimentos do próprio cliente (painel do investidor). */
clientDisputesRouter.get('/investments', async (req, res) => {
    const me = await myCustomer(req);
    if (!me) { res.json({ items: [] }); return; }
    const items = await prisma.investmentRecord.findMany({ where: { customerId: me.id }, orderBy: { createdAt: 'desc' }, include: { payouts: { orderBy: { paidAt: 'desc' }, select: { paidAt: true, amount: true, receiptUrl: true } } } });
    res.json({ items: items.map(({ notes, createdBy, ...i }) => i) });
});
