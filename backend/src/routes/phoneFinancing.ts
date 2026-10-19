import { Router, Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { prisma } from '../services/prisma';
import { authenticate, requireAdmin } from '../middleware/auth';
import { getFlags } from '../services/phoneFinancing/flags';
import {
    APPLICATION_STATUSES, assertOfferReady, buildSchedule, canTransition, maskCpf, maskIdentifier,
    OfferNotReadyError, protocolFor,
} from '../services/phoneFinancing/rules';
import { getServiceCatalog } from '../services/phoneFinancing/serviceKnowledge';
import { getPhonePaymentService, PhonePaymentError } from '../services/phoneFinancing/phonePayments';

/**
 * Financiamento de Celulares — rotas NOVAS. Não toca Loan/Installment/LoanRequest.
 * Valores em centavos. Contrato: docs/financiamento-celulares/API_CONTRATO.md
 */

const db: any = prisma;
const RESERVATION_HOURS = 72;
const DOC_KINDS = ['ID_FRONT', 'ID_BACK', 'PROOF_OF_ADDRESS', 'PROOF_OF_INCOME', 'OTHER'];
const STATUS_LABELS: Record<string, string> = {
    draft: 'Rascunho', submitted: 'Recebida', under_review: 'Em análise', awaiting_documents: 'Documentação pendente',
    approved: 'Aprovada', rejected: 'Recusada', contract_pending: 'Contrato pendente', awaiting_down_payment: 'Aguardando entrada',
    ready_for_handover: 'Aguardando entrega', active: 'Ativa', cancelled: 'Cancelada', closed: 'Encerrada',
};

const fail = (res: Response, status: number, error: string, code: string) => res.status(status).json({ error, code });
const isInt = (v: unknown, min = 0) => Number.isInteger(v) && (v as number) >= min;
const isHttpUrl = (v: unknown) => typeof v === 'string' && /^https?:\/\/\S+$/i.test(v) && v.length < 2000;
const str = (v: unknown, max = 500) => (typeof v === 'string' ? v.trim().slice(0, max) : undefined);

const requireFlag = (flag: keyof ReturnType<typeof getFlags>) => (_req: Request, res: Response, next: NextFunction) => {
    if (!getFlags()[flag]) { fail(res, 404, 'Recurso indisponível', 'FEATURE_DISABLED'); return; }
    next();
};

async function getSettings() {
    return db.phoneFinancingSettings.upsert({ where: { id: 'default' }, update: {}, create: { id: 'default' } });
}
async function customerOf(userId: string) {
    return db.customer.findFirst({ where: { userId } });
}
function wrap(fn: (req: Request, res: Response) => Promise<any>) {
    return async (req: Request, res: Response) => {
        try { await fn(req, res); } catch (err: any) {
            if (err instanceof OfferNotReadyError) return fail(res, 400, err.message, 'OFFER_NOT_READY');
            if (err instanceof PhonePaymentError) {
                const http = { NOT_CONFIGURED: 503, NOT_FOUND: 404, NOTHING_DUE: 400, IN_PROGRESS: 409, PROVIDER_ERROR: 502, DISABLED: 404 }[err.code];
                return fail(res, http, err.message, err.code);
            }
            if (err?.code === 'P2002') return fail(res, 409, 'Registro duplicado', 'DUPLICATE');
            console.error('[PhoneFinancing]', req.method, req.path, err?.message);
            fail(res, 500, 'Erro ao processar a solicitação', 'INTERNAL');
        }
    };
}

function unitView(u: any) {
    return {
        id: u.id, skuId: u.skuId, serialMasked: maskIdentifier(u.serialNumber), imeiMasked: maskIdentifier(u.imei),
        imei2Masked: maskIdentifier(u.imei2), assetTag: u.assetTag, supplier: u.supplier, invoiceNumber: u.invoiceNumber,
        storageLocation: u.storageLocation, physicalCondition: u.physicalCondition, legalOwner: u.legalOwner,
        commercialStatus: u.commercialStatus, mdmStatus: u.mdmStatus, mdmStatusSource: u.mdmStatusSource,
        sku: u.sku ? { id: u.sku.id, sku: u.sku.sku, storage: u.sku.storage, color: u.sku.color, model: u.sku.product?.model, brand: u.sku.product?.brand } : undefined,
        createdAt: u.createdAt,
    };
}

function saleSummary(s: any) {
    const inst = (s.installments || []).filter((i: any) => i.status !== 'CANCELLED');
    const paidCents = inst.reduce((a: number, i: any) => a + i.paidCents, 0);
    const owed = inst.reduce((a: number, i: any) => a + i.amountCents, 0);
    const next = inst.filter((i: any) => ['OPEN', 'PARTIAL'].includes(i.status)).sort((a: any, b: any) => +new Date(a.dueDate) - +new Date(b.dueDate))[0] || null;
    return {
        id: s.id, status: s.status, applicationId: s.applicationId,
        device: { model: s.unit?.sku?.product?.model, brand: s.unit?.sku?.product?.brand, storage: s.unit?.sku?.storage, color: s.unit?.sku?.color, serialMasked: maskIdentifier(s.unit?.serialNumber), imeiMasked: maskIdentifier(s.unit?.imei) },
        cashPriceCents: s.cashPriceCents, downPaymentCents: s.downPaymentCents, financedCents: s.financedCents, totalCents: s.totalCents,
        installmentsCount: s.installmentsCount, monthlyInterestBps: s.monthlyInterestBps, paidCents, balanceCents: owed - paidCents,
        nextInstallment: next && { id: next.id, number: next.number, kind: next.kind, dueDate: next.dueDate, amountCents: next.amountCents, paidCents: next.paidCents, status: next.status },
        contract: s.contract ? { status: s.contract.status, pdfUrl: s.contract.pdfUrl, templateVersion: s.contract.templateVersion } : null,
        physicalDeliveryDate: s.physicalDeliveryDate, paidOffAt: s.paidOffAt, legalTitleTransferDate: s.legalTitleTransferDate, mdmReleasedAt: s.mdmReleasedAt,
        createdAt: s.createdAt,
    };
}
const SALE_INCLUDE = { installments: { orderBy: { number: 'asc' } }, contract: true, unit: { include: { sku: { include: { product: true } } } } };

// ─────────────────────────── Catálogo (cliente) ───────────────────────────
export const servicesCatalogRouter = Router();
servicesCatalogRouter.use(authenticate);
servicesCatalogRouter.get('/catalog', wrap(async (req, res) => {
    const channel = req.query.channel === 'whatsapp' ? 'whatsapp' : 'client';
    res.json({ services: await getServiceCatalog(db, channel) });
}));

// ─────────────────────────── Cliente ───────────────────────────
export const phoneProductsRouter = Router();
phoneProductsRouter.use(authenticate);
phoneProductsRouter.get('/', wrap(async (_req, res) => {
    const products = await db.phoneProduct.findMany({
        where: { active: true },
        include: { skus: { where: { active: true }, include: { units: { where: { commercialStatus: 'AVAILABLE' }, select: { id: true } } } } },
        orderBy: [{ brand: 'asc' }, { model: 'asc' }],
    });
    res.json({
        products: products.filter((p: any) => p.skus.length).map((p: any) => ({
            id: p.id, brand: p.brand, line: p.line, model: p.model, description: p.description, imageUrl: p.imageUrl,
            skus: p.skus.map((s: any) => ({ id: s.id, sku: s.sku, storage: s.storage, color: s.color, condition: s.condition, cashPriceCents: s.cashPriceCents, financedPriceCents: s.financedPriceCents, availableUnits: s.units.length })),
        })),
    });
}));

export const phoneFinancingRouter = Router();
phoneFinancingRouter.use(authenticate);

phoneFinancingRouter.get('/offer', wrap(async (_req, res) => {
    const s = await getSettings();
    res.json({
        enabled: s.offerEnabled && getFlags().phoneFinancing, commercialTerms: s.commercialTerms, maxInstallments: s.maxInstallments,
        minDownPaymentBps: s.minDownPaymentBps, monthlyInterestBps: s.monthlyInterestBps, legalTemplateStatus: s.legalTemplateStatus,
    });
}));

phoneFinancingRouter.post('/simulate', requireFlag('phoneFinancing'), wrap(async (req, res) => {
    const s = await getSettings();
    if (!s.offerEnabled || s.monthlyInterestBps == null || !s.maxInstallments || s.minDownPaymentBps == null) {
        return fail(res, 400, 'As condições comerciais ainda não foram configuradas', 'OFFER_NOT_CONFIGURED');
    }
    const { skuId, downPaymentCents, installments } = req.body || {};
    const sku = typeof skuId === 'string' ? await db.phoneSku.findFirst({ where: { id: skuId, active: true } }) : null;
    if (!sku) return fail(res, 404, 'Modelo não encontrado', 'NOT_FOUND');
    const price = sku.financedPriceCents || sku.cashPriceCents;
    if (!isInt(installments, 1) || installments > s.maxInstallments) return fail(res, 400, `Escolha de 1 a ${s.maxInstallments} parcelas`, 'INVALID');
    const minDown = Math.ceil(price * s.minDownPaymentBps / 10000);
    if (!isInt(downPaymentCents) || downPaymentCents < minDown || downPaymentCents >= price) {
        return fail(res, 400, `A entrada deve ser de no mínimo R$ ${(minDown / 100).toFixed(2)} e menor que o preço`, 'INVALID');
    }
    const first = new Date(); first.setUTCMonth(first.getUTCMonth() + 1); first.setUTCHours(12, 0, 0, 0);
    const schedule = buildSchedule({ financedCents: price - downPaymentCents, installments, monthlyInterestBps: s.monthlyInterestBps, firstDueDate: first });
    const totalInst = schedule.reduce((a, p) => a + p.amountCents, 0);
    res.json({
        cashPriceCents: sku.cashPriceCents, priceCents: price, downPaymentCents, financedCents: price - downPaymentCents,
        installmentCents: schedule[0].amountCents, totalCents: downPaymentCents + totalInst, monthlyInterestBps: s.monthlyInterestBps,
        schedule: schedule.map(p => ({ number: p.number, dueDate: p.dueDate, amountCents: p.amountCents })),
        notice: 'Simulação sujeita a análise. Financiamento em parcelas com a Tubarão, diferente de parcelamento no cartão.',
    });
}));

phoneFinancingRouter.post('/applications', requireFlag('phoneFinancing'), wrap(async (req, res) => {
    const s = await getSettings();
    if (!s.offerEnabled) return fail(res, 400, 'O financiamento de celulares ainda não está aberto', 'OFFER_NOT_CONFIGURED');
    const b = req.body || {};
    if (b.lgpdConsent !== true) return fail(res, 400, 'É preciso aceitar o tratamento de dados (LGPD)', 'INVALID');
    const termsVersion = str(b.termsVersion, 40);
    if (!termsVersion) return fail(res, 400, 'Versão dos termos obrigatória', 'INVALID');
    const customer = await customerOf(req.user!.id);
    if (!customer) return fail(res, 400, 'Complete seu cadastro antes de solicitar', 'NO_CUSTOMER');
    if (b.skuId && !(await db.phoneSku.findFirst({ where: { id: b.skuId, active: true } }))) return fail(res, 404, 'Modelo não encontrado', 'NOT_FOUND');
    if (!b.skuId && b.wantsQuote !== true) return fail(res, 400, 'Escolha um modelo ou peça cotação', 'INVALID');
    const docs = Array.isArray(b.documents) ? b.documents : [];
    if (docs.length > 20 || docs.some((d: any) => !DOC_KINDS.includes(d?.kind) || !isHttpUrl(d?.url))) return fail(res, 400, 'Documentos inválidos', 'INVALID');
    for (const [k, min] of [['requestedInstallments', 1], ['requestedDownPaymentCents', 0], ['monthlyIncomeCents', 0]] as const) {
        if (b[k] != null && !isInt(b[k], min)) return fail(res, 400, `Campo inválido: ${k}`, 'INVALID');
    }
    const open = await db.phoneFinancingApplication.count({ where: { customerId: customer.id, status: { in: ['submitted', 'under_review', 'awaiting_documents'] } } });
    if (open >= 1) return fail(res, 409, 'Você já tem uma proposta de celular em análise', 'ALREADY_OPEN');

    const app = await db.phoneFinancingApplication.create({
        data: {
            protocol: protocolFor(new Date(), randomUUID().replace(/-/g, '')), customerId: customer.id, userId: req.user!.id,
            skuId: b.skuId || null, wantsQuote: !b.skuId, source: 'CLIENT_APP', status: 'submitted',
            requestedInstallments: b.requestedInstallments ?? null, requestedDownPaymentCents: b.requestedDownPaymentCents ?? null,
            monthlyIncomeCents: b.monthlyIncomeCents ?? null, occupation: str(b.occupation, 120) || null, notes: str(b.notes, 1000) || null,
            lgpdConsentAt: new Date(), termsVersion,
            documents: { create: docs.map((d: any) => ({ kind: d.kind, url: d.url })) },
            audits: { create: [{ actorId: req.user!.id, toStatus: 'submitted', reason: 'enviada pelo cliente' }] },
        },
    });
    try {
        const { sendPushToRole } = require('./push');
        await sendPushToRole('ADMIN', '📱 Nova proposta de celular', `${customer.name} — protocolo ${app.protocol}`);
    } catch { /* notificação não bloqueia */ }
    res.status(201).json({ application: { id: app.id, protocol: app.protocol, status: app.status } });
}));

// Consultas do cliente NUNCA dependem de flag: contratos existentes continuam visíveis.
phoneFinancingRouter.get('/my-applications', wrap(async (req, res) => {
    const customer = await customerOf(req.user!.id);
    if (!customer) return res.json({ applications: [] });
    const apps = await db.phoneFinancingApplication.findMany({ where: { customerId: customer.id }, include: { sku: { include: { product: true } } }, orderBy: { createdAt: 'desc' } });
    res.json({
        applications: apps.map((a: any) => ({
            id: a.id, protocol: a.protocol, status: a.status, statusLabel: STATUS_LABELS[a.status] || a.status, createdAt: a.createdAt,
            sku: a.sku && { id: a.sku.id, model: a.sku.product.model, brand: a.sku.product.brand, storage: a.sku.storage, color: a.sku.color },
        })),
    });
}));
phoneFinancingRouter.get('/my-contracts', wrap(async (req, res) => {
    const customer = await customerOf(req.user!.id);
    if (!customer) return res.json({ sales: [] });
    const sales = await db.phoneSale.findMany({ where: { customerId: customer.id, status: { not: 'cancelled' } }, include: SALE_INCLUDE, orderBy: { createdAt: 'desc' } });
    res.json({ sales: sales.map(saleSummary) });
}));
phoneFinancingRouter.get('/my-installments', wrap(async (req, res) => {
    const customer = await customerOf(req.user!.id);
    if (!customer) return res.json({ installments: [] });
    const rows = await db.phoneSaleInstallment.findMany({ where: { sale: { customerId: customer.id, status: { not: 'cancelled' } }, status: { not: 'CANCELLED' } }, orderBy: { dueDate: 'asc' } });
    res.json({ installments: rows.map((i: any) => ({ id: i.id, saleId: i.saleId, number: i.number, kind: i.kind, dueDate: i.dueDate, amountCents: i.amountCents, paidCents: i.paidCents, status: i.status })) });
}));
phoneFinancingRouter.post('/installments/:id/pay', requireFlag('phonePayment'), wrap(async (req, res) => {
    const customer = await customerOf(req.user!.id);
    if (!customer) return fail(res, 404, 'Parcela não encontrada', 'NOT_FOUND');
    res.json({ charge: await getPhonePaymentService().createCharge(customer.id, String(req.params.id)) });
}));
phoneFinancingRouter.get('/payments/:id', wrap(async (req, res) => {
    const customer = req.user!.role === 'ADMIN' ? null : await customerOf(req.user!.id);
    if (req.user!.role !== 'ADMIN' && !customer) return fail(res, 404, 'Pagamento não encontrado', 'NOT_FOUND');
    const q = (v: unknown) => (typeof v === 'string' && v.length <= 200 ? v : undefined);
    res.json({ charge: await getPhonePaymentService().getStatus(customer?.id ?? null, String(req.params.id), { transactionNsu: q(req.query.transaction_nsu), slug: q(req.query.slug) }) });
}));

// ─────────────────────────── Admin ───────────────────────────
export const phoneFinancingAdminRouter = Router();
phoneFinancingAdminRouter.use(authenticate, requireAdmin, requireFlag('phoneAdmin'));
const A = phoneFinancingAdminRouter;

A.get('/dashboard', wrap(async (_req, res) => {
    const group = async (model: string, field: string) => Object.fromEntries((await db[model].groupBy({ by: [field], _count: { _all: true } })).map((g: any) => [g[field], g._count._all]));
    const [apps, inv, sales, mdm] = await Promise.all([
        group('phoneFinancingApplication', 'status'), group('phoneInventoryUnit', 'commercialStatus'),
        group('phoneSale', 'status'), group('phoneInventoryUnit', 'mdmStatus'),
    ]);
    const live = { sale: { status: { in: ['active', 'in_collection', 'pending_contract'] } }, status: { not: 'CANCELLED' } };
    const agg = await db.phoneSaleInstallment.aggregate({ where: live, _sum: { amountCents: true, paidCents: true } });
    const today = new Date(); today.setUTCHours(0, 0, 0, 0);
    const overdue = await db.phoneSaleInstallment.findMany({ where: { ...live, status: { in: ['OPEN', 'PARTIAL'] }, dueDate: { lt: today } }, select: { amountCents: true, paidCents: true } });
    const received = await db.phoneSalePayment.aggregate({ where: { status: 'PAID' }, _sum: { amountCents: true } });
    res.json({
        applications: { submitted: apps.submitted || 0, under_review: apps.under_review || 0, approved: apps.approved || 0, rejected: apps.rejected || 0 },
        inventory: { available: inv.AVAILABLE || 0, reserved: inv.RESERVED || 0, sold: inv.SOLD || 0, delivered: inv.DELIVERED || 0, returned: inv.RETURNED || 0 },
        sales: { active: sales.active || 0, paid_off: sales.paid_off || 0, in_collection: sales.in_collection || 0, pending_contract: sales.pending_contract || 0 },
        receivableCents: (agg._sum.amountCents || 0) - (agg._sum.paidCents || 0),
        receivedCents: received._sum.amountCents || 0,
        overdueCents: overdue.reduce((a: number, i: any) => a + i.amountCents - i.paidCents, 0),
        mdm: { managed: (mdm.enrolled_supervised || 0) + (mdm.enrolled_unsupervised || 0), unmanaged: (mdm.registered_local || 0) + (mdm.unmanaged || 0), releasePending: mdm.release_pending || 0 },
    });
}));

A.get('/settings', wrap(async (_req, res) => res.json(await getSettings())));
A.put('/settings', wrap(async (req, res) => {
    const b = req.body || {};
    const data: any = { updatedBy: req.user!.id };
    for (const k of ['monthlyInterestBps', 'minDownPaymentBps', 'maxInstallments', 'lateFeeBps', 'dailyLateInterestBps', 'manualPaymentSecondApprovalCents']) {
        if (b[k] === null) data[k] = null;
        else if (b[k] !== undefined) { if (!isInt(b[k])) return fail(res, 400, `Campo inválido: ${k}`, 'INVALID'); data[k] = b[k]; }
    }
    if (data.maxInstallments != null && (data.maxInstallments < 1 || data.maxInstallments > 60)) return fail(res, 400, 'Prazo máximo entre 1 e 60', 'INVALID');
    for (const k of ['reminderDaysBefore', 'graceDaysAfterDue']) if (b[k] !== undefined) { if (!isInt(b[k]) || b[k] > 60) return fail(res, 400, `Campo inválido: ${k}`, 'INVALID'); data[k] = b[k]; }
    if (b.contactHour !== undefined) { if (!isInt(b.contactHour) || b.contactHour > 23) return fail(res, 400, 'Horário inválido', 'INVALID'); data.contactHour = b.contactHour; }
    if (b.commercialTerms !== undefined) data.commercialTerms = str(b.commercialTerms, 5000) ?? null;
    if (b.legalTemplateStatus !== undefined) {
        if (!['legal_template_pending', 'approved'].includes(b.legalTemplateStatus)) return fail(res, 400, 'Status jurídico inválido', 'INVALID');
        data.legalTemplateStatus = b.legalTemplateStatus;
    }
    const merged = { ...(await getSettings()), ...data };
    if (b.offerEnabled === true) assertOfferReady(merged);
    if (typeof b.offerEnabled === 'boolean') data.offerEnabled = b.offerEnabled;
    const saved = await db.phoneFinancingSettings.update({ where: { id: 'default' }, data });
    if (typeof b.offerEnabled === 'boolean') {
        await db.serviceCatalogEntry.updateMany({ where: { code: 'FINANCIAMENTO_CELULAR' }, data: { active: b.offerEnabled } }).catch(() => {});
    }
    res.json(saved);
}));
A.get('/collection-policy', wrap(async (_req, res) => {
    const s = await getSettings();
    res.json({ reminderDaysBefore: s.reminderDaysBefore, graceDaysAfterDue: s.graceDaysAfterDue, contactHour: s.contactHour });
}));
A.put('/collection-policy', wrap(async (req, res) => {
    const { reminderDaysBefore, graceDaysAfterDue, contactHour } = req.body || {};
    if (![reminderDaysBefore, graceDaysAfterDue].every(v => isInt(v) && v <= 60) || !isInt(contactHour) || contactHour > 23) return fail(res, 400, 'Valores inválidos', 'INVALID');
    await getSettings();
    res.json(await db.phoneFinancingSettings.update({ where: { id: 'default' }, data: { reminderDaysBefore, graceDaysAfterDue, contactHour, updatedBy: req.user!.id } }));
}));

A.get('/applications', wrap(async (req, res) => {
    const where: any = {};
    if (typeof req.query.status === 'string' && APPLICATION_STATUSES.includes(req.query.status as any)) where.status = req.query.status;
    const q = str(req.query.q, 80);
    const apps = await db.phoneFinancingApplication.findMany({
        where, include: { documents: true, sku: { include: { product: true } }, reservations: { where: { status: 'ACTIVE' } }, sale: { select: { id: true, status: true } } },
        orderBy: { createdAt: 'desc' }, take: 300,
    });
    const customers = await db.customer.findMany({ where: { id: { in: [...new Set(apps.map((a: any) => a.customerId))] } }, select: { id: true, name: true, cpf: true, phone: true } });
    const byId = new Map(customers.map((c: any) => [c.id, c]));
    const norm = (v: string) => v.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    let rows = apps.map((a: any) => {
        const c: any = byId.get(a.customerId) || {};
        return {
            id: a.id, protocol: a.protocol, status: a.status, statusLabel: STATUS_LABELS[a.status], createdAt: a.createdAt, source: a.source,
            customer: { id: a.customerId, name: c.name, cpfMasked: maskCpf(c.cpf), phone: c.phone },
            sku: a.sku && { id: a.sku.id, sku: a.sku.sku, model: a.sku.product.model, brand: a.sku.product.brand, storage: a.sku.storage, color: a.sku.color, cashPriceCents: a.sku.cashPriceCents },
            wantsQuote: a.wantsQuote, requestedInstallments: a.requestedInstallments, requestedDownPaymentCents: a.requestedDownPaymentCents,
            monthlyIncomeCents: a.monthlyIncomeCents, occupation: a.occupation, notes: a.notes, decisionReason: a.decisionReason,
            documents: a.documents.map((d: any) => ({ kind: d.kind, url: d.url })),
            reservation: a.reservations[0] ? { unitId: a.reservations[0].unitId, expiresAt: a.reservations[0].expiresAt } : null,
            sale: a.sale,
        };
    });
    if (q) rows = rows.filter((r: any) => norm(`${r.protocol} ${r.customer.name || ''} ${r.customer.phone || ''}`).includes(norm(q)));
    res.json({ applications: rows });
}));

A.patch('/applications/:id/status', wrap(async (req, res) => {
    const { status } = req.body || {};
    const reason = str(req.body?.reason, 500);
    const app = await db.phoneFinancingApplication.findUnique({ where: { id: String(req.params.id) } });
    if (!app) return fail(res, 404, 'Proposta não encontrada', 'NOT_FOUND');
    if (!canTransition(app.status, status)) return fail(res, 409, `Não é possível ir de "${STATUS_LABELS[app.status]}" para "${STATUS_LABELS[status] || status}"`, 'INVALID_TRANSITION');
    if (['rejected', 'cancelled'].includes(status) && !reason) return fail(res, 400, 'Informe o motivo', 'INVALID');
    const updated = await db.$transaction(async (tx: any) => {
        const claimed = await tx.phoneFinancingApplication.updateMany({ where: { id: app.id, status: app.status }, data: { status, reviewedBy: req.user!.id, reviewedAt: new Date(), decisionReason: reason ?? app.decisionReason } });
        if (claimed.count !== 1) throw Object.assign(new Error('concorrência'), { conflict: true });
        await tx.phoneApplicationAudit.create({ data: { applicationId: app.id, actorId: req.user!.id, fromStatus: app.status, toStatus: status, reason } });
        if (['rejected', 'cancelled'].includes(status)) {
            const res2 = await tx.phoneDeviceReservation.findMany({ where: { applicationId: app.id, status: 'ACTIVE' } });
            for (const r of res2) {
                await tx.phoneDeviceReservation.update({ where: { id: r.id }, data: { status: 'RELEASED' } });
                await tx.phoneInventoryUnit.updateMany({ where: { id: r.unitId, commercialStatus: 'RESERVED' }, data: { commercialStatus: 'AVAILABLE' } });
            }
        }
        return tx.phoneFinancingApplication.findUnique({ where: { id: app.id } });
    }).catch((e: any) => { if (e.conflict) return null; throw e; });
    if (!updated) return fail(res, 409, 'A proposta foi alterada por outra pessoa. Recarregue.', 'CONFLICT');
    res.json({ application: { id: updated.id, status: updated.status, statusLabel: STATUS_LABELS[updated.status] } });
}));

A.post('/applications/:id/reserve', wrap(async (req, res) => {
    const unitId = str(req.body?.unitId, 60);
    const app = await db.phoneFinancingApplication.findUnique({ where: { id: String(req.params.id) } });
    if (!app || !['under_review', 'approved', 'contract_pending'].includes(app.status)) return fail(res, 400, 'Só é possível reservar para proposta em análise ou aprovada', 'INVALID');
    const reservation = await db.$transaction(async (tx: any) => {
        // Expira reservas vencidas antes de tentar
        const expired = await tx.phoneDeviceReservation.findMany({ where: { status: 'ACTIVE', expiresAt: { lt: new Date() } } });
        for (const r of expired) {
            await tx.phoneDeviceReservation.update({ where: { id: r.id }, data: { status: 'EXPIRED' } });
            await tx.phoneInventoryUnit.updateMany({ where: { id: r.unitId, commercialStatus: 'RESERVED' }, data: { commercialStatus: 'AVAILABLE' } });
        }
        const claimed = await tx.phoneInventoryUnit.updateMany({ where: { id: unitId, commercialStatus: 'AVAILABLE' }, data: { commercialStatus: 'RESERVED' } });
        if (claimed.count !== 1) throw Object.assign(new Error('indisponível'), { unavailable: true });
        await tx.deviceCustodyEvent.create({ data: { unitId, event: 'RESERVED', actorId: req.user!.id, detail: `proposta ${app.protocol}` } });
        return tx.phoneDeviceReservation.create({ data: { unitId, applicationId: app.id, expiresAt: new Date(Date.now() + RESERVATION_HOURS * 3600e3) } });
    }).catch((e: any) => { if (e.unavailable || e.code === 'P2002') return null; throw e; });
    if (!reservation) return fail(res, 409, 'Aparelho indisponível (já reservado ou vendido)', 'UNIT_UNAVAILABLE');
    res.status(201).json({ reservation });
}));

A.get('/products', wrap(async (_req, res) => {
    const products = await db.phoneProduct.findMany({ include: { skus: { include: { _count: { select: { units: true } } } } }, orderBy: { createdAt: 'desc' } });
    res.json({ products: products.map((p: any) => ({ ...p, skus: p.skus.map((s: any) => ({ ...s, unitsCount: s._count.units, _count: undefined })) })) });
}));
A.post('/products', wrap(async (req, res) => {
    const b = req.body || {};
    if (!str(b.brand, 60) || !str(b.model, 120)) return fail(res, 400, 'Marca e modelo obrigatórios', 'INVALID');
    if (b.imageUrl && !isHttpUrl(b.imageUrl)) return fail(res, 400, 'Imagem inválida', 'INVALID');
    res.status(201).json({ product: await db.phoneProduct.create({ data: { brand: str(b.brand, 60), line: str(b.line, 60) || null, model: str(b.model, 120), description: str(b.description, 2000) || null, imageUrl: b.imageUrl || null } }) });
}));
A.patch('/products/:id', wrap(async (req, res) => {
    const b = req.body || {};
    const data: any = {};
    for (const k of ['brand', 'line', 'model', 'description']) if (b[k] !== undefined) data[k] = str(b[k], 2000) || null;
    if (b.imageUrl !== undefined) { if (b.imageUrl && !isHttpUrl(b.imageUrl)) return fail(res, 400, 'Imagem inválida', 'INVALID'); data.imageUrl = b.imageUrl || null; }
    if (typeof b.active === 'boolean') data.active = b.active;
    res.json({ product: await db.phoneProduct.update({ where: { id: String(req.params.id) }, data }) });
}));
const skuData = (b: any, partial: boolean) => {
    const data: any = {};
    for (const k of ['sku', 'storage', 'color']) if (b[k] !== undefined) data[k] = str(b[k], 80) || null;
    if (b.condition !== undefined) { if (!['NEW', 'USED', 'REFURBISHED'].includes(b.condition)) throw Object.assign(new Error('Condição inválida'), { bad: true }); data.condition = b.condition; }
    for (const k of ['costCents', 'cashPriceCents', 'financedPriceCents']) {
        if (b[k] === null && k === 'financedPriceCents') data[k] = null;
        else if (b[k] !== undefined) { if (!isInt(b[k], 1)) throw Object.assign(new Error(`Valor inválido: ${k}`), { bad: true }); data[k] = b[k]; }
    }
    if (typeof b.active === 'boolean') data.active = b.active;
    if (!partial && (!data.sku || data.costCents == null || data.cashPriceCents == null)) throw Object.assign(new Error('SKU, custo e preço à vista obrigatórios'), { bad: true });
    return data;
};
A.post('/products/:id/skus', wrap(async (req, res) => {
    try { res.status(201).json({ sku: await db.phoneSku.create({ data: { ...skuData(req.body || {}, false), productId: String(req.params.id) } }) }); }
    catch (e: any) { if (e.bad) return fail(res, 400, e.message, 'INVALID'); throw e; }
}));
A.patch('/skus/:id', wrap(async (req, res) => {
    try { res.json({ sku: await db.phoneSku.update({ where: { id: String(req.params.id) }, data: skuData(req.body || {}, true) }) }); }
    catch (e: any) { if (e.bad) return fail(res, 400, e.message, 'INVALID'); throw e; }
}));

A.get('/inventory', wrap(async (req, res) => {
    const where: any = {};
    if (typeof req.query.status === 'string' && req.query.status) where.commercialStatus = req.query.status;
    const units = await db.phoneInventoryUnit.findMany({ where, include: { sku: { include: { product: true } } }, orderBy: { createdAt: 'desc' }, take: 1000 });
    res.json({ units: units.map(unitView) });
}));
const IMEI_RE = /^\d{15}$/;
function unitData(b: any) {
    const serialNumber = str(b.serialNumber, 40)?.toUpperCase();
    if (!serialNumber || !/^[A-Z0-9]{6,40}$/.test(serialNumber)) throw Object.assign(new Error('Número de série inválido'), { bad: true });
    for (const k of ['imei', 'imei2']) if (b[k] && !IMEI_RE.test(String(b[k]))) throw Object.assign(new Error(`${k.toUpperCase()} deve ter 15 dígitos`), { bad: true });
    if (b.invoiceUrl && !isHttpUrl(b.invoiceUrl)) throw Object.assign(new Error('Nota fiscal inválida'), { bad: true });
    const purchasedAt = b.purchasedAt ? new Date(b.purchasedAt) : null;
    if (purchasedAt && Number.isNaN(purchasedAt.getTime())) throw Object.assign(new Error('Data de compra inválida'), { bad: true });
    return {
        skuId: b.skuId, serialNumber, imei: b.imei || null, imei2: b.imei2 || null, assetTag: str(b.assetTag, 60) || null,
        supplier: str(b.supplier, 120) || null, invoiceNumber: str(b.invoiceNumber, 60) || null, invoiceUrl: b.invoiceUrl || null,
        purchasedAt, storageLocation: str(b.storageLocation, 120) || null, physicalCondition: str(b.physicalCondition, 200) || null,
        legalOwner: str(b.legalOwner, 200) || null, custodian: str(b.custodian, 120) || null,
    };
}
A.post('/inventory', wrap(async (req, res) => {
    let data;
    try { data = unitData(req.body || {}); } catch (e: any) { return fail(res, 400, e.message, 'INVALID'); }
    if (!(await db.phoneSku.findUnique({ where: { id: data.skuId } }))) return fail(res, 400, 'SKU não encontrado', 'INVALID');
    try {
        const unit = await db.phoneInventoryUnit.create({ data, include: { sku: { include: { product: true } } } });
        await db.deviceCustodyEvent.create({ data: { unitId: unit.id, event: 'REGISTERED', actorId: req.user!.id } });
        res.status(201).json({ unit: unitView(unit) });
    } catch (e: any) {
        if (e?.code === 'P2002') return fail(res, 409, 'Número de série ou IMEI já cadastrado', 'DUPLICATE_SERIAL');
        throw e;
    }
}));
A.post('/inventory/import', wrap(async (req, res) => {
    const csv = typeof req.body?.csv === 'string' ? req.body.csv : '';
    const dryRun = req.body?.dryRun !== false;
    const lines = csv.split(/\r?\n/).map((l: string) => l.trim()).filter(Boolean);
    if (lines.length < 2 || lines.length > 2001) return fail(res, 400, 'CSV deve ter cabeçalho e de 1 a 2000 linhas', 'INVALID');
    const header = lines[0].toLowerCase().split(/[;,]/).map((h: string) => h.trim());
    const col = (n: string) => header.indexOf(n);
    if (col('sku') < 0 || col('serial') < 0) return fail(res, 400, 'Cabeçalho precisa de "sku" e "serial"', 'INVALID');
    const skus = new Map((await db.phoneSku.findMany({ select: { id: true, sku: true } })).map((s: any) => [s.sku, s.id]));
    const existing = await db.phoneInventoryUnit.findMany({ select: { serialNumber: true, imei: true, imei2: true } });
    const seen = new Set<string>(existing.flatMap((u: any) => [u.serialNumber, u.imei, u.imei2].filter(Boolean)));
    const errors: { line: number; message: string }[] = [];
    const rows: any[] = [];
    lines.slice(1).forEach((l: string, idx: number) => {
        const c = l.split(/[;,]/).map((v: string) => v.trim());
        const get = (n: string) => (col(n) >= 0 ? c[col(n)] || undefined : undefined);
        try {
            const skuId = skus.get(get('sku'));
            if (!skuId) throw new Error(`SKU "${get('sku')}" não existe`);
            const d = unitData({ skuId, serialNumber: get('serial'), imei: get('imei'), imei2: get('imei2'), invoiceNumber: get('invoice'), supplier: get('supplier'), storageLocation: get('location') });
            for (const v of [d.serialNumber, d.imei, d.imei2].filter(Boolean) as string[]) { if (seen.has(v)) throw new Error(`Duplicado: ${maskIdentifier(v)}`); seen.add(v); }
            rows.push(d);
        } catch (e: any) { errors.push({ line: idx + 2, message: e.message }); }
    });
    if (dryRun || errors.length) return res.json({ dryRun, valid: rows.length, errors, created: 0 });
    await db.$transaction(async (tx: any) => {
        for (const d of rows) {
            const u = await tx.phoneInventoryUnit.create({ data: d });
            await tx.deviceCustodyEvent.create({ data: { unitId: u.id, event: 'REGISTERED', actorId: req.user!.id, detail: 'importação CSV' } });
        }
    });
    res.json({ dryRun: false, valid: rows.length, errors: [], created: rows.length });
}));

A.post('/sales', wrap(async (req, res) => {
    const { applicationId, unitId, downPaymentCents, installments, firstDueDate } = req.body || {};
    const s = await getSettings();
    if (s.monthlyInterestBps == null || !s.maxInstallments) return fail(res, 400, 'Configure juros e prazo antes de vender', 'OFFER_NOT_CONFIGURED');
    if (!isInt(installments, 1) || installments > s.maxInstallments) return fail(res, 400, `Parcelas de 1 a ${s.maxInstallments}`, 'INVALID');
    const first = new Date(firstDueDate);
    if (Number.isNaN(first.getTime()) || first < new Date(Date.now() - 864e5)) return fail(res, 400, 'Data do 1º vencimento inválida', 'INVALID');
    const app = await db.phoneFinancingApplication.findUnique({ where: { id: applicationId } });
    if (!app || app.status !== 'approved') return fail(res, 400, 'A venda só pode ser criada para proposta aprovada', 'INVALID');
    const unit = await db.phoneInventoryUnit.findUnique({ where: { id: unitId }, include: { sku: true } });
    if (!unit) return fail(res, 404, 'Aparelho não encontrado', 'NOT_FOUND');
    const price = unit.sku.financedPriceCents || unit.sku.cashPriceCents;
    const minDown = Math.ceil(price * (s.minDownPaymentBps || 0) / 10000);
    if (!isInt(downPaymentCents) || downPaymentCents < minDown || downPaymentCents >= price) return fail(res, 400, `Entrada entre R$ ${(minDown / 100).toFixed(2)} e menor que o preço`, 'INVALID');
    const schedule = buildSchedule({ financedCents: price - downPaymentCents, installments, monthlyInterestBps: s.monthlyInterestBps, firstDueDate: first });
    const totalInst = schedule.reduce((a, p) => a + p.amountCents, 0);

    const sale = await db.$transaction(async (tx: any) => {
        const reserved = await tx.phoneDeviceReservation.findFirst({ where: { unitId, applicationId, status: 'ACTIVE' } });
        const claimed = await tx.phoneInventoryUnit.updateMany({
            where: { id: unitId, commercialStatus: reserved ? 'RESERVED' : 'AVAILABLE' }, data: { commercialStatus: 'SOLD' },
        });
        if (claimed.count !== 1) throw Object.assign(new Error('indisponível'), { unavailable: true });
        if (reserved) await tx.phoneDeviceReservation.update({ where: { id: reserved.id }, data: { status: 'CONVERTED' } });
        const created = await tx.phoneSale.create({
            data: {
                applicationId, customerId: app.customerId, unitId, cashPriceCents: price, downPaymentCents, financedCents: price - downPaymentCents,
                totalCents: downPaymentCents + totalInst, installmentsCount: installments, monthlyInterestBps: s.monthlyInterestBps,
                firstDueDate: first, status: 'pending_contract', createdBy: req.user!.id,
                installments: {
                    create: [
                        ...(downPaymentCents > 0 ? [{ number: 0, kind: 'DOWN_PAYMENT', dueDate: new Date(), amountCents: downPaymentCents }] : []),
                        ...schedule.map(p => ({ number: p.number, kind: 'INSTALLMENT', dueDate: p.dueDate, amountCents: p.amountCents })),
                    ],
                },
                contract: { create: { templateVersion: 'phone-v0-draft', status: 'legal_template_pending' } },
            },
        });
        await tx.phoneFinancingApplication.update({ where: { id: applicationId }, data: { status: 'contract_pending' } });
        await tx.phoneApplicationAudit.create({ data: { applicationId, actorId: req.user!.id, fromStatus: 'approved', toStatus: 'contract_pending', reason: `venda ${created.id.slice(0, 8)}` } });
        await tx.deviceCustodyEvent.create({ data: { unitId, event: 'SOLD', actorId: req.user!.id, detail: `venda ${created.id.slice(0, 8)}` } });
        return created;
    }).catch((e: any) => { if (e.unavailable || e.code === 'P2002') return null; throw e; });
    if (!sale) return fail(res, 409, 'Aparelho indisponível (reservado para outra proposta ou já vendido)', 'UNIT_UNAVAILABLE');
    res.status(201).json({ sale: saleSummary(await db.phoneSale.findUnique({ where: { id: sale.id }, include: SALE_INCLUDE })) });
}));

A.get('/sales', wrap(async (req, res) => {
    const where: any = {};
    if (typeof req.query.status === 'string' && req.query.status) where.status = req.query.status;
    const sales = await db.phoneSale.findMany({ where, include: SALE_INCLUDE, orderBy: { createdAt: 'desc' }, take: 500 });
    const customers = await db.customer.findMany({ where: { id: { in: [...new Set(sales.map((s: any) => s.customerId))] } }, select: { id: true, name: true, cpf: true } });
    const byId = new Map(customers.map((c: any) => [c.id, c]));
    res.json({ sales: sales.map((s: any) => { const c: any = byId.get(s.customerId) || {}; return { ...saleSummary(s), customer: { id: s.customerId, name: c.name, cpfMasked: maskCpf(c.cpf) } }; }) });
}));
A.get('/sales/:id', wrap(async (req, res) => {
    const s = await db.phoneSale.findUnique({ where: { id: String(req.params.id) }, include: { ...SALE_INCLUDE, payments: { orderBy: { createdAt: 'desc' } }, deliveries: true, releaseCase: { include: { steps: true } } } });
    if (!s) return fail(res, 404, 'Venda não encontrada', 'NOT_FOUND');
    const c = await db.customer.findUnique({ where: { id: s.customerId }, select: { id: true, name: true, cpf: true, phone: true } });
    const STEP_LABELS: Record<string, string> = { MDM_REMOVE: 'Remover gestão MDM', ABM_RELEASE: 'Liberar no Apple Business', ACTIVATION_LOCK_CLEARED: 'Bloqueio de Ativação da empresa removido', RESTORE_CONFIRMED: 'Restauração confirmada', TERM_SIGNED: 'Termo de liberação assinado' };
    res.json({
        sale: {
            ...saleSummary(s), customer: c && { id: c.id, name: c.name, cpfMasked: maskCpf(c.cpf), phone: c.phone },
            installments: s.installments.map((i: any) => ({ id: i.id, number: i.number, kind: i.kind, dueDate: i.dueDate, amountCents: i.amountCents, paidCents: i.paidCents, status: i.status, collectionPaused: i.collectionPaused })),
            payments: s.payments.map((p: any) => ({ id: p.id, provider: p.provider, status: p.status, amountCents: p.amountCents, installmentId: p.installmentId, receiptUrl: p.receiptUrl, paidAt: p.paidAt, recordedBy: p.recordedBy, secondApprovedBy: p.secondApprovedBy, needsSecondApproval: p.status === 'AWAITING_SECOND_APPROVAL', errorMessage: p.errorMessage })),
            deliveries: s.deliveries,
            releaseCase: s.releaseCase && { id: s.releaseCase.id, status: s.releaseCase.status, steps: s.releaseCase.steps.map((st: any) => ({ ...st, label: STEP_LABELS[st.step] || st.step })) },
        },
    });
}));

A.post('/sales/:id/contract/generate', wrap(async (req, res) => {
    const s = await getSettings();
    const sale = await db.phoneSale.findUnique({ where: { id: String(req.params.id) }, include: { contract: true } });
    if (!sale) return fail(res, 404, 'Venda não encontrada', 'NOT_FOUND');
    if (s.legalTemplateStatus !== 'approved') {
        return res.status(409).json({ error: 'O contrato de celulares aguarda revisão jurídica. Nenhum contrato foi gerado.', code: 'LEGAL_TEMPLATE_PENDING', contract: { status: 'legal_template_pending', templateVersion: sale.contract?.templateVersion } });
    }
    // ponytail: geração do PDF fica para quando o texto jurídico aprovado existir; hoje só registra a versão.
    const contract = await db.phoneContract.update({ where: { saleId: sale.id }, data: { status: 'generated', templateVersion: 'phone-v1' } });
    res.json({ contract: { status: contract.status, templateVersion: contract.templateVersion } });
}));

A.post('/sales/:id/delivery', wrap(async (req, res) => {
    const b = req.body || {};
    const deliveredAt = new Date(b.deliveredAt);
    const receivedBy = str(b.receivedBy, 120);
    if (Number.isNaN(deliveredAt.getTime()) || !receivedBy) return fail(res, 400, 'Data e quem recebeu são obrigatórios', 'INVALID');
    if (b.receiptUrl && !isHttpUrl(b.receiptUrl)) return fail(res, 400, 'Comprovante inválido', 'INVALID');
    const sale = await db.phoneSale.findUnique({ where: { id: String(req.params.id) }, include: { installments: true } });
    if (!sale || sale.status === 'cancelled') return fail(res, 404, 'Venda não encontrada', 'NOT_FOUND');
    const down = sale.installments.find((i: any) => i.kind === 'DOWN_PAYMENT');
    if (down && down.status !== 'PAID') return fail(res, 400, 'A entrada precisa estar paga antes da entrega', 'DOWN_PAYMENT_PENDING');
    await db.$transaction(async (tx: any) => {
        await tx.phoneDeliveryReceipt.create({ data: { saleId: sale.id, deliveredAt, deliveredBy: req.user!.id, receivedBy, receiptUrl: b.receiptUrl || null, notes: str(b.notes, 1000) || null } });
        await tx.phoneSale.update({ where: { id: sale.id }, data: { physicalDeliveryDate: deliveredAt, status: sale.status === 'pending_contract' ? 'active' : sale.status } });
        await tx.phoneInventoryUnit.update({ where: { id: sale.unitId }, data: { commercialStatus: 'DELIVERED' } });
        await tx.phoneFinancingApplication.updateMany({ where: { id: sale.applicationId, status: { in: ['contract_pending', 'awaiting_down_payment', 'ready_for_handover'] } }, data: { status: 'active' } });
        await tx.deviceCustodyEvent.create({ data: { unitId: sale.unitId, event: 'DELIVERED', actorId: req.user!.id, detail: `recebido por ${receivedBy}` } });
    });
    res.json({ ok: true });
}));

A.post('/sales/:id/manual-payment', wrap(async (req, res) => {
    const b = req.body || {};
    if (!isHttpUrl(b.receiptUrl)) return fail(res, 400, 'Comprovante obrigatório', 'INVALID');
    const s = await getSettings();
    const out = await getPhonePaymentService().recordManual({
        saleId: String(req.params.id), installmentId: String(b.installmentId), amountCents: b.amountCents, receiptUrl: b.receiptUrl,
        note: str(b.note, 500) || '', adminId: req.user!.id, secondApprovalCents: s.manualPaymentSecondApprovalCents,
    });
    res.status(201).json(out);
}));
A.post('/payments/:id/second-approval', wrap(async (req, res) => {
    res.json({ result: await getPhonePaymentService().approveManual(String(req.params.id), req.user!.id) });
}));

A.post('/installments/:id/collection-pause', wrap(async (req, res) => {
    if (typeof req.body?.paused !== 'boolean') return fail(res, 400, 'Informe paused', 'INVALID');
    const i = await db.phoneSaleInstallment.update({ where: { id: String(req.params.id) }, data: { collectionPaused: req.body.paused } });
    res.json({ installment: { id: i.id, collectionPaused: i.collectionPaused } });
}));

const RELEASE_STEPS = ['MDM_REMOVE', 'ABM_RELEASE', 'ACTIVATION_LOCK_CLEARED', 'RESTORE_CONFIRMED', 'TERM_SIGNED'];
A.post('/sales/:id/title-transfer', wrap(async (req, res) => {
    const date = new Date(req.body?.legalTitleTransferDate);
    if (Number.isNaN(date.getTime())) return fail(res, 400, 'Data da transferência inválida', 'INVALID');
    const sale = await db.phoneSale.findUnique({ where: { id: String(req.params.id) }, include: { releaseCase: true } });
    if (!sale) return fail(res, 404, 'Venda não encontrada', 'NOT_FOUND');
    if (sale.releaseCase) return fail(res, 409, 'Transferência já registrada', 'ALREADY_OPEN');
    const rc = await db.$transaction(async (tx: any) => {
        await tx.phoneSale.update({ where: { id: sale.id }, data: { legalTitleTransferDate: date } });
        // Aparelho passa a ser do cliente: nenhum comando MDM é mais aceito.
        await tx.appleMdmDevice.updateMany({ where: { unitId: sale.unitId }, data: { ownership: 'RELEASED' } });
        await tx.phoneInventoryUnit.update({ where: { id: sale.unitId }, data: { mdmStatus: 'release_pending', mdmStatusSource: 'LOCAL', mdmStatusUpdatedAt: new Date() } });
        await tx.deviceCustodyEvent.create({ data: { unitId: sale.unitId, event: 'TITLE_TRANSFERRED', actorId: req.user!.id } });
        return tx.phoneReleaseCase.create({ data: { saleId: sale.id, reason: 'transferência de titularidade', steps: { create: RELEASE_STEPS.map(step => ({ step })) } }, include: { steps: true } });
    });
    res.status(201).json({ releaseCase: rc });
}));
A.patch('/release-cases/:id/steps/:step', wrap(async (req, res) => {
    const status = req.body?.status;
    const evidence = str(req.body?.evidence, 1000);
    if (!['pending', 'done', 'not_applicable', 'failed'].includes(status)) return fail(res, 400, 'Status inválido', 'INVALID');
    if (status === 'done' && !evidence) return fail(res, 400, 'Informe a evidência (ex.: print, protocolo)', 'INVALID');
    const rc = await db.phoneReleaseCase.findUnique({ where: { id: String(req.params.id) }, include: { steps: true, sale: true } });
    if (!rc) return fail(res, 404, 'Caso não encontrado', 'NOT_FOUND');
    await db.deviceReleaseStep.update({ where: { releaseCaseId_step: { releaseCaseId: rc.id, step: String(req.params.step) } }, data: { status, evidence, doneBy: req.user!.id, doneAt: new Date() } });
    const steps = await db.deviceReleaseStep.findMany({ where: { releaseCaseId: rc.id } });
    const complete = steps.every((s: any) => ['done', 'not_applicable'].includes(s.status));
    if (complete) {
        await db.$transaction([
            db.phoneReleaseCase.update({ where: { id: rc.id }, data: { status: 'completed', completedAt: new Date() } }),
            db.phoneSale.update({ where: { id: rc.saleId }, data: { mdmReleasedAt: new Date() } }),
            db.phoneInventoryUnit.update({ where: { id: rc.sale.unitId }, data: { mdmStatus: 'released', mdmStatusSource: 'LOCAL', mdmStatusUpdatedAt: new Date() } }),
        ]);
    } else if (rc.status === 'open') {
        await db.phoneReleaseCase.update({ where: { id: rc.id }, data: { status: 'in_progress' } });
    }
    res.json({ releaseCase: await db.phoneReleaseCase.findUnique({ where: { id: rc.id }, include: { steps: true } }) });
}));
