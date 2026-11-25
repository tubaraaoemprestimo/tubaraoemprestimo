import { Router, Request, Response } from 'express';
import { createHash, randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '../services/prisma';
import { authenticate, requireAdmin } from '../middleware/auth';
import { sendWhatsAppMessage } from '../services/whatsapp';
import { whatsappAllowed } from '../services/collectionRules';

/**
 * Clientes antigos (anteriores à plataforma): pré-cadastro pelo admin, contrato
 * legado (sem desembolso e sem lançamento de caixa) e convite de ativação.
 *
 * - Nada aqui cria Transaction: saldo legado não é dinheiro novo.
 * - Convite: token aleatório de 32 bytes; o banco guarda só o SHA-256.
 * - Ativação exige token + confirmar os 4 últimos dígitos do telefone cadastrado
 *   + CPF quando houver; vincula a conta ao cadastro existente (não recria nada).
 * - WhatsApp do convite só sai com LEGACY_WHATSAPP_ENABLED=true; senão, o admin
 *   recebe o texto e o link para mandar manualmente (modo simulação).
 */

export const legacyClientsRouter = Router();
export const legacyActivationRouter = Router(); // público (sem login), usado pela página de ativação

const INVITE_DAYS = 7;
const MAX_ATTEMPTS = 5;
const APP_URL = () => (process.env.FRONTEND_URL || 'https://www.tubaraoemprestimo.com.br').replace(/\/$/, '');
const hashToken = (t: string) => createHash('sha256').update(t).digest('hex');
const digits = (s: unknown) => String(s ?? '').replace(/\D/g, '');

/** Telefone BR em formato internacional (55 + DDD + número). Inválido → null. */
export function normalizePhoneBR(raw: unknown): string | null {
    let d = digits(raw);
    if (d.startsWith('00')) d = d.slice(2);
    if (d.length === 10 || d.length === 11) d = `55${d}`;
    return /^55\d{10,11}$/.test(d) ? d : null;
}

/** CPF válido (dígitos verificadores). */
export function isValidCpf(raw: unknown): boolean {
    const c = digits(raw);
    if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false;
    const dv = (n: number) => {
        let s = 0;
        for (let i = 0; i < n; i++) s += Number(c[i]) * (n + 1 - i);
        const r = (s * 10) % 11;
        return r === 10 ? 0 : r;
    };
    return dv(9) === Number(c[9]) && dv(10) === Number(c[10]);
}

/** Vencimentos das parcelas restantes. Diária pula domingo (mesma regra do contrato novo). */
export function scheduleDates(first: Date, count: number, frequency: string): Date[] {
    const out: Date[] = [];
    const day = first.getDate();
    let d = new Date(first);
    if (frequency === 'DAILY') while (d.getDay() === 0) d.setDate(d.getDate() + 1);
    for (let i = 0; i < count; i++) {
        out.push(new Date(d));
        if (frequency === 'DAILY') { do d.setDate(d.getDate() + 1); while (d.getDay() === 0); }
        else if (frequency === 'WEEKLY') d.setDate(d.getDate() + 7);
        else { const n = new Date(first); n.setDate(1); n.setMonth(first.getMonth() + i + 1); n.setDate(Math.min(day, new Date(n.getFullYear(), n.getMonth() + 1, 0).getDate())); d = n; }
    }
    return out;
}

const str = (v: unknown, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const money = (v: unknown) => { const n = Number(v); return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null; };
const date = (v: unknown) => { if (!v) return null; const d = new Date(String(v)); return Number.isNaN(d.getTime()) ? null : d; };

async function audit(req: Request, action: string, entity: string, entityId: string, details: any) {
    await prisma.auditLog.create({
        data: { userId: req.user!.id, userName: req.user!.name, action, entity, entityId, details: JSON.stringify(details), ipAddress: req.ip },
    }).catch(() => {});
}

/** Clientes com o mesmo telefone, comparando só dígitos (formatos variam no banco). */
async function customerIdsByPhone(phone: string): Promise<string[]> {
    const rows = await prisma.$queryRaw<{ id: string; phone: string }[]>`
        SELECT id, phone FROM customers WHERE right(regexp_replace(phone, '\\D', '', 'g'), 8) = ${phone.slice(-8)} LIMIT 50`;
    return rows.filter(r => normalizePhoneBR(r.phone) === phone).map(r => r.id);
}

legacyClientsRouter.use(authenticate, requireAdmin);

/** Catálogo real de serviços (sem lista fixa no código). */
legacyClientsRouter.get('/services', async (_req, res) => {
    const rows = await prisma.serviceCatalogEntry.findMany({ orderBy: { sortOrder: 'asc' } });
    // Regra de cobrança de cada serviço (mostrada no formulário; vem das regras já existentes do sistema).
    const RULE: Record<string, { kind: string; note: string }> = {
        CLT: { kind: 'ROLLOVER', note: 'Juros mensal; o principal só é cobrado na quitação.' },
        GARANTIA: { kind: 'ROLLOVER', note: 'Juros mensal; o principal só é cobrado na quitação.' },
        AUTONOMO: { kind: 'INSTALLMENTS', note: 'Comércio/autônomo: diárias ou parcelas que abatem o saldo.' },
        MOTO: { kind: 'INSTALLMENTS', note: 'Parcelas fixas até quitar.' },
        LIMPA_NOME: { kind: 'INSTALLMENTS', note: 'Serviço: parcelas do valor combinado, sem juros de mora.' },
        FINANCIAMENTO_CELULAR: { kind: 'UNSUPPORTED', note: 'Tem módulo próprio (aparelho e contrato jurídico); registro antigo ainda não suportado.' },
    };
    res.json({ services: rows.map(r => ({ code: r.code, label: r.label, active: r.active, ...(RULE[r.code] || { kind: 'INSTALLMENTS', note: '' }) })) });
});

/** Busca de possíveis duplicidades antes de cadastrar. Não funde nada. */
legacyClientsRouter.get('/lookup', async (req, res) => {
    const phone = normalizePhoneBR(req.query.phone);
    const cpf = digits(req.query.cpf);
    if (!phone && cpf.length !== 11) { res.status(400).json({ error: 'Informe telefone válido ou CPF' }); return; }
    const ids = new Set(phone ? await customerIdsByPhone(phone) : []);
    if (cpf.length === 11) (await prisma.customer.findMany({ where: { cpf }, select: { id: true } })).forEach(c => ids.add(c.id));
    const found = ids.size ? await prisma.customer.findMany({
        where: { id: { in: [...ids] } },
        select: { id: true, name: true, cpf: true, phone: true, userId: true, isLegacy: true, activationStatus: true, _count: { select: { loans: true } } },
    }) : [];
    const matches = found.map(c => ({
            id: c.id, name: c.name, cpfMasked: /^\d{11}$/.test(c.cpf) ? `***.${c.cpf.slice(3, 6)}.***-${c.cpf.slice(9)}` : null,
            phone: c.phone, hasAccount: !!c.userId, isLegacy: c.isLegacy, activationStatus: c.activationStatus, contracts: c._count.loans,
            matchedBy: cpf && c.cpf === cpf ? 'CPF' : 'TELEFONE',
        }));
    res.json({ phone, matches });
});

/**
 * Pré-cadastro: só telefone é obrigatório. Sem CPF, usa o mesmo padrão de
 * identificador provisório que o cadastro pelo app já usa (REG_…), marcado como pendente.
 */
legacyClientsRouter.post('/', async (req, res) => {
    const phone = normalizePhoneBR(req.body?.phone);
    if (!phone) { res.status(400).json({ error: 'Telefone inválido (use DDD + número)' }); return; }
    const cpfRaw = digits(req.body?.cpf);
    if (cpfRaw && !isValidCpf(cpfRaw)) { res.status(400).json({ error: 'CPF inválido' }); return; }
    const name = str(req.body?.name, 120);
    // E-mail NÃO é gravado no pré-cadastro: o login (auth.ts) vincula cliente por e-mail,
    // então quem tivesse esse e-mail herdaria os contratos sem passar pelo convite.

    if (cpfRaw) {
        const dup = await prisma.customer.findUnique({ where: { cpf: cpfRaw }, select: { id: true } });
        if (dup) { res.status(409).json({ error: 'Já existe cliente com este CPF', code: 'DUPLICATE_CPF', customerId: dup.id }); return; }
    }
    // Telefone repetido NÃO bloqueia (pode ser compartilhado/reciclado), mas o admin precisa confirmar.
    if (!req.body?.confirmSharedPhone) {
        const same = await customerIdsByPhone(phone);
        if (same.length) { res.status(409).json({ error: 'Já existe cliente com este telefone. Confirme se é outra pessoa.', code: 'PHONE_IN_USE', customerIds: same }); return; }
    }

    const customer = await prisma.customer.create({
        data: {
            name: name || `Cliente antigo (final ${phone.slice(-4)})`,
            phone,
            email: '',
            cpf: cpfRaw || `REG_LEGADO_${randomBytes(6).toString('hex')}`,
            status: 'ACTIVE',
            source: 'LEGADO',
            source_detail: str(req.body?.origin, 80) || 'Cadastro administrativo',
            isLegacy: true,
            activationStatus: 'PRE_CADASTRO',
        },
    });
    await audit(req, 'LEGACY_CUSTOMER_CREATED', 'CUSTOMER', customer.id, { hasCpf: !!cpfRaw, notes: str(req.body?.notes, 500) || undefined });
    res.status(201).json({ customer: { id: customer.id, name: customer.name, phone: customer.phone } });
});

/** Lista paginada dos clientes antigos com contadores para o painel. */
legacyClientsRouter.get('/', async (req, res) => {
    const page = Math.max(1, Number(req.query.page || 1));
    const take = 30;
    const status = str(req.query.status, 30);
    const legacyScope = { OR: [{ isLegacy: true }, { loans: { some: { isLegacy: true } } }] };
    const where: any = { AND: [legacyScope, ...(status ? [{ activationStatus: status }] : [])] };
    const [items, total, byStatus] = await Promise.all([
        prisma.customer.findMany({
            where, orderBy: { joinedAt: 'desc' }, skip: (page - 1) * take, take,
            select: { id: true, name: true, phone: true, activationStatus: true, whatsappOptOut: true, userId: true, joinedAt: true,
                loans: { select: { id: true, status: true, remainingAmount: true, isLegacy: true, legacyBalanceConfirmed: true, collectionSuspended: true, messagesSuspended: true, nextPaymentDate: true, loanRequest: { select: { profileType: true } } } } },
        }),
        prisma.customer.count({ where }),
        prisma.customer.groupBy({ by: ['activationStatus'], where: legacyScope, _count: true }),
    ]);
    res.json({ items, total, page, totalPages: Math.max(1, Math.ceil(total / take)), byStatus: Object.fromEntries(byStatus.map(b => [b.activationStatus || 'SEM', b._count])) });
});

/**
 * Contrato legado: usa Loan/Installment existentes, marcado is_legacy.
 * - Sem Transaction (não é desembolso nem receita).
 * - Status: QUITADO (saldo 0) ou ATIVO; ativo só entra na régua com saldo confirmado.
 * - Referência do contrato original é única por cliente (idempotência).
 */
legacyClientsRouter.post('/:customerId/contracts', async (req, res) => {
    const customerId = String(req.params.customerId);
    // Vale também para cliente que já existe (achado na busca): o contrato antigo entra no cadastro dele, sem duplicar pessoa.
    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) { res.status(404).json({ error: 'Cliente não encontrado' }); return; }

    const serviceCode = str(req.body?.serviceCode, 40);
    const service = await prisma.serviceCatalogEntry.findUnique({ where: { code: serviceCode } });
    if (!service) { res.status(400).json({ error: 'Serviço inválido' }); return; }
    // Celular tem módulo e regras próprias (aparelho, Tabela Price, MDM): não vira empréstimo genérico.
    if (service.code === 'FINANCIAMENTO_CELULAR') {
        res.status(400).json({ error: 'Celular antigo ainda não pode ser registrado aqui: o financiamento de celulares tem regras próprias (aparelho, contrato jurídico). Registre na observação e trate pelo módulo de celulares.', code: 'SERVICE_RULES_PENDING' }); return;
    }
    const amount = money(req.body?.amount);
    const balance = money(req.body?.balance);
    const paid = money(req.body?.paidAmount);
    if (!amount || amount <= 0) { res.status(400).json({ error: 'Informe o valor contratado' }); return; }
    if (balance === null) { res.status(400).json({ error: 'Informe o saldo em aberto (0 se quitado)' }); return; }
    const reference = str(req.body?.reference, 80) || null;
    const nextDue = date(req.body?.nextDueDate);
    const frequency = ['MONTHLY', 'DAILY', 'WEEKLY'].includes(req.body?.frequency) ? req.body.frequency : 'MONTHLY';
    const interestRate = req.body?.interestRate !== undefined && req.body?.interestRate !== '' ? Number(req.body.interestRate) : null;
    if (interestRate !== null && (!Number.isFinite(interestRate) || interestRate < 0 || interestRate > 100)) { res.status(400).json({ error: 'Taxa inválida' }); return; }
    const installmentAmount = money(req.body?.installmentAmount);
    const settled = balance === 0;
    if (!settled && (!nextDue || !installmentAmount)) { res.status(400).json({ error: 'Contrato com saldo precisa de próximo vencimento e valor da cobrança' }); return; }
    // Vencimento no passado faria a régua aplicar multa retroativa sem base validada.
    if (!settled && nextDue! < new Date(new Date().setHours(0, 0, 0, 0))) { res.status(400).json({ error: 'O próximo vencimento não pode estar no passado' }); return; }
    if (!settled && installmentAmount! > balance) { res.status(400).json({ error: 'A cobrança não pode ser maior que o saldo' }); return; }
    const confirmed = req.body?.balanceConfirmed === true;
    // CLT/Garantia: juros mensal com rolagem automática (1 cobrança; a próxima nasce no pagamento).
    // Demais: parcelas restantes que somam o saldo informado — nada inventado além do que o admin digitou.
    const rollover = ['CLT', 'GARANTIA', 'GARANTIA_VEICULO'].includes(service.code);
    const count = rollover || settled ? (settled ? 0 : 1) : Math.trunc(Number(req.body?.remainingInstallments || 1));
    if (!rollover && !settled && (!Number.isInteger(count) || count < 1 || count > 360)) { res.status(400).json({ error: 'Parcelas restantes: de 1 a 360' }); return; }
    if (!rollover && !settled && Math.abs(count * installmentAmount! - balance) > 0.01 * count) {
        res.status(400).json({ error: `Parcelas restantes × valor (${(count * installmentAmount!).toFixed(2)}) precisam somar o saldo (${balance.toFixed(2)})`, code: 'SCHEDULE_MISMATCH' }); return;
    }
    if (!rollover && !settled && count === 1 && installmentAmount! < balance) { res.status(400).json({ error: 'Com 1 parcela restante, o valor da parcela deve ser o saldo' }); return; }
    const dueDates = scheduleDates(nextDue!, count, frequency);

    if (reference) {
        const dup = await prisma.loan.findFirst({ where: { customerId, legacyReference: reference }, select: { id: true } });
        if (dup) { res.status(409).json({ error: 'Este contrato antigo já foi registrado', code: 'DUPLICATE_REFERENCE', loanId: dup.id }); return; }
    }

    const loan = await prisma.$transaction(async tx => {
        const request = await tx.loanRequest.create({
            data: {
                customerId, clientName: customer.name, cpf: customer.cpf, email: customer.email || '', phone: customer.phone,
                amount, approvedAmount: amount, installments: 1, profileType: service.code, status: settled ? 'COMPLETED' : 'APPROVED',
                isLoan: service.code !== 'LIMPA_NOME', isService: service.code === 'LIMPA_NOME', isInvestment: false,
                supplementalDescription: JSON.stringify({ legado: true, servico: service.label, observacoes: str(req.body?.notes, 1000) || undefined }),
            },
        });
        const created = await tx.loan.create({
            data: {
                customerId, requestId: request.id, amount, principalAmount: amount, remainingAmount: balance, installmentsCount: Math.max(1, count), totalInstallments: Math.max(1, count),
                status: settled ? 'COMPLETED' : 'ACTIVE', startDate: date(req.body?.originalDate) || new Date(),
                paymentFrequency: frequency, interestRate, dailyInstallmentAmount: frequency === 'DAILY' ? installmentAmount : null,
                nextPaymentDate: settled ? null : nextDue, source: 'LEGADO', isLoan: request.isLoan, isService: request.isService,
                isLegacy: true, legacyReference: reference, legacyOriginalDate: date(req.body?.originalDate), legacyPaidAmount: paid,
                legacyBalanceDate: date(req.body?.balanceDate) || new Date(), legacyBalanceConfirmed: settled ? false : confirmed,
                // Saldo não conferido não é cobrado: régua suspensa até o admin confirmar.
                collectionSuspended: !settled && !confirmed,
                adminNotes: str(req.body?.notes, 1000) || null,
            },
        });
        if (!settled) {
            await tx.installment.createMany({
                data: dueDates.map(dueDate => ({ loanId: created.id, amount: installmentAmount!, dueDate, status: 'OPEN', isInterestPayment: rollover })),
            });
        }
        return created;
    });
    await audit(req, 'LEGACY_CONTRACT_CREATED', 'LOAN', loan.id, { serviceCode, amount, balance, paid, reference, confirmed, settled });
    res.status(201).json({ loan: { id: loan.id, status: loan.status, collectionSuspended: loan.collectionSuspended } });
});

/** Confirmar (ou suspender) a cobrança de um saldo legado. */
legacyClientsRouter.patch('/contracts/:loanId/collection', async (req, res) => {
    const loan = await prisma.loan.findFirst({ where: { id: String(req.params.loanId), isLegacy: true } });
    if (!loan) { res.status(404).json({ error: 'Contrato antigo não encontrado' }); return; }
    const confirm = req.body?.confirmBalance === true;
    const updated = await prisma.loan.update({
        where: { id: loan.id },
        data: confirm ? { legacyBalanceConfirmed: true, collectionSuspended: false } : { collectionSuspended: true },
    });
    await audit(req, confirm ? 'LEGACY_BALANCE_CONFIRMED' : 'LEGACY_COLLECTION_SUSPENDED', 'LOAN', loan.id, { reason: str(req.body?.reason, 300) || undefined });
    res.json({ loan: { id: updated.id, legacyBalanceConfirmed: updated.legacyBalanceConfirmed, collectionSuspended: updated.collectionSuspended } });
});

function inviteText(name: string, link: string) {
    return `Olá, ${name.split(' ')[0]}! Tudo bem?\n\nAgora você pode acompanhar seus serviços diretamente pelo aplicativo oficial Tubarão Empréstimos.\n\nAtive seu cadastro para consultar seus contratos, pagamentos e falar com nosso atendimento:\n${link}\n\nO link vale ${INVITE_DAYS} dias. Caso já tenha cadastro, acesse sua conta normalmente.`;
}

/** Gera convite (revoga os anteriores pendentes) e devolve link + texto. Envia por WhatsApp só se habilitado. */
legacyClientsRouter.post('/:customerId/invite', async (req, res) => {
    const customer = await prisma.customer.findFirst({ where: { id: String(req.params.customerId), isLegacy: true } });
    if (!customer) { res.status(404).json({ error: 'Cliente antigo não encontrado' }); return; }
    if (customer.userId) { res.status(409).json({ error: 'Cliente já tem conta ativa', code: 'ALREADY_ACTIVE' }); return; }
    const phone = normalizePhoneBR(customer.phone);
    if (!phone) { res.status(400).json({ error: 'Telefone inválido no cadastro', code: 'INVALID_PHONE' }); return; }

    const token = randomBytes(32).toString('base64url');
    const invite = await prisma.$transaction(async tx => {
        await tx.activationInvite.updateMany({ where: { customerId: customer.id, status: 'PENDING' }, data: { status: 'REVOKED', revokedAt: new Date() } });
        return tx.activationInvite.create({
            data: { customerId: customer.id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + INVITE_DAYS * 86400000), createdBy: req.user!.id },
        });
    });
    const link = `${APP_URL()}/#/ativar?c=${token}`;
    const text = inviteText(customer.name, link);
    const sendEnabled = process.env.LEGACY_WHATSAPP_ENABLED === 'true';
    let sent = false;
    if (sendEnabled && req.body?.send === true && !customer.whatsappOptOut) {
        sent = await sendWhatsAppMessage(phone, text).catch(() => false);
        if (sent) await prisma.activationInvite.update({ where: { id: invite.id }, data: { sentAt: new Date() } });
    }
    await prisma.customer.update({ where: { id: customer.id }, data: { activationStatus: 'CONVITE_ENVIADO' } });
    await audit(req, 'LEGACY_INVITE_CREATED', 'CUSTOMER', customer.id, { inviteId: invite.id, whatsappSent: sent, simulation: !sendEnabled });
    res.status(201).json({ link, text, expiresAt: invite.expiresAt, whatsappSent: sent, simulation: !sendEnabled });
});

/**
 * "Consultar ou regularizar contrato": só com obrigação confirmada e elegível. A mensagem
 * não traz valor, CPF nem documento: leva para o login (área autenticada) e para o atendimento.
 */
legacyClientsRouter.post('/contracts/:loanId/regularize-message', async (req, res) => {
    const loan = await prisma.loan.findUnique({ where: { id: String(req.params.loanId) }, include: { customer: true } });
    if (!loan) { res.status(404).json({ error: 'Contrato não encontrado' }); return; }
    const blocked = loan.status !== 'ACTIVE' ? 'Contrato quitado ou cancelado: não se envia cobrança.'
        : Number(loan.remainingAmount) <= 0 ? 'Saldo zero.'
        : loan.collectionSuspended ? 'Saldo antigo ainda não conferido.'
        : loan.messagesSuspended ? 'Mensagens pausadas neste contrato.'
        : !whatsappAllowed(loan.customer) ? 'Telefone inválido ou cliente pediu para não receber WhatsApp.' : null;
    if (blocked) { res.status(409).json({ error: blocked, code: 'NOT_ELIGIBLE' }); return; }
    const c = loan.customer;
    const access = c.userId ? `${APP_URL()}/#/login` : null;
    const text = `Olá, ${c.name.split(' ')[0]}! Tudo bem?\n\nPassando para lembrar que você tem um serviço em andamento com a Tubarão Empréstimos.\n\n`
        + (access ? `Consulte os detalhes e pague com segurança entrando no aplicativo:\n${access}\n\n` : `Para consultar os detalhes, fale com a gente por aqui ou peça seu link de acesso ao aplicativo.\n\n`)
        + `Se já pagou, desconsidere esta mensagem. Qualquer dúvida, responda esta mensagem que nosso atendimento ajuda você.`;
    const sendEnabled = process.env.LEGACY_WHATSAPP_ENABLED === 'true';
    const sent = sendEnabled && req.body?.send === true ? await sendWhatsAppMessage(c.phone, text).catch(() => false) : false;
    await audit(req, 'REGULARIZE_MESSAGE', 'LOAN', loan.id, { whatsappSent: sent, simulation: !sendEnabled });
    res.json({ text, whatsappSent: sent, simulation: !sendEnabled, phone: normalizePhoneBR(c.phone) });
});

legacyClientsRouter.post('/invites/:inviteId/revoke', async (req, res) => {
    const r = await prisma.activationInvite.updateMany({ where: { id: String(req.params.inviteId), status: 'PENDING' }, data: { status: 'REVOKED', revokedAt: new Date() } });
    if (r.count !== 1) { res.status(409).json({ error: 'Convite não está pendente' }); return; }
    await audit(req, 'LEGACY_INVITE_REVOKED', 'INVITE', String(req.params.inviteId), {});
    res.json({ ok: true });
});

// ─────────────────────────── Ativação pelo cliente (público) ───────────────────────────

async function findValidInvite(token: unknown) {
    if (typeof token !== 'string' || token.length < 30 || token.length > 100) return null;
    const inv = await prisma.activationInvite.findUnique({ where: { tokenHash: hashToken(token) }, include: { customer: true } });
    if (!inv || inv.status !== 'PENDING') return null;
    if (inv.expiresAt < new Date()) {
        await prisma.activationInvite.update({ where: { id: inv.id }, data: { status: 'EXPIRED' } }).catch(() => {});
        return null;
    }
    if (inv.attempts >= MAX_ATTEMPTS) return null;
    return inv;
}

/** Checa o convite. Não devolve dados pessoais: só o primeiro nome e o que precisa ser confirmado. */
legacyActivationRouter.post('/check', async (req, res) => {
    const inv = await findValidInvite(req.body?.token);
    if (!inv) { res.status(404).json({ error: 'Convite inválido ou expirado. Peça um novo ao atendimento.' }); return; }
    res.json({ firstName: inv.customer.name.split(' ')[0], needsCpf: /^\d{11}$/.test(inv.customer.cpf) });
});

/**
 * Ativa: confere 4 últimos dígitos do telefone (e CPF, se cadastrado), cria a
 * conta com a senha do próprio cliente e vincula ao cadastro existente.
 * Erros contam tentativa; 5 erros invalidam o convite.
 */
legacyActivationRouter.post('/complete', async (req, res) => {
    const inv = await findValidInvite(req.body?.token);
    if (!inv) { res.status(404).json({ error: 'Convite inválido ou expirado. Peça um novo ao atendimento.' }); return; }
    const c = inv.customer;
    const last4 = digits(req.body?.phoneLast4);
    const cpf = digits(req.body?.cpf);
    const identityOk = last4.length === 4 && digits(c.phone).endsWith(last4)
        && (!/^\d{11}$/.test(c.cpf) || cpf === c.cpf);
    if (!identityOk) {
        await prisma.activationInvite.update({ where: { id: inv.id }, data: { attempts: { increment: 1 } } });
        res.status(403).json({ error: 'Dados não conferem com o cadastro.', attemptsLeft: Math.max(0, MAX_ATTEMPTS - inv.attempts - 1) });
        return;
    }
    const email = str(req.body?.email, 160).toLowerCase();
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const name = str(req.body?.name, 120) || c.name;
    const newCpf = digits(req.body?.newCpf);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { res.status(400).json({ error: 'E-mail inválido' }); return; }
    if (password.length < 8) { res.status(400).json({ error: 'A senha precisa ter pelo menos 8 caracteres' }); return; }
    if (req.body?.acceptTerms !== true) { res.status(400).json({ error: 'É preciso aceitar os termos' }); return; }
    if (!/^\d{11}$/.test(c.cpf) && newCpf && !isValidCpf(newCpf)) { res.status(400).json({ error: 'CPF inválido' }); return; }
    if (await prisma.user.findUnique({ where: { email } }) || await prisma.customer.findFirst({ where: { email, id: { not: c.id } }, select: { id: true } })) { res.status(409).json({ error: 'Este e-mail já tem conta. Entre com ele ou use outro.', code: 'EMAIL_IN_USE' }); return; }
    if (newCpf && !/^\d{11}$/.test(c.cpf) && await prisma.customer.findUnique({ where: { cpf: newCpf } })) {
        res.status(409).json({ error: 'Este CPF já está em outro cadastro. Fale com o atendimento.', code: 'CPF_IN_USE' }); return;
    }

    const hashed = await bcrypt.hash(password, 12);
    try {
        await prisma.$transaction(async tx => {
            // Uso único: só um pedido consegue marcar o convite como usado.
            const claimed = await tx.activationInvite.updateMany({ where: { id: inv.id, status: 'PENDING' }, data: { status: 'USED', usedAt: new Date() } });
            if (claimed.count !== 1) throw new Error('INVITE_USED');
            const user = await tx.user.create({ data: { name, email, password: hashed, role: 'CLIENT', phone: c.phone, authId: null } });
            await tx.customer.update({
                where: { id: c.id },
                data: { userId: user.id, email, name, activationStatus: 'CONTA_ATIVA', contractTermsAccepted: true,
                    ...(newCpf && !/^\d{11}$/.test(c.cpf) ? { cpf: newCpf } : {}) },
            });
        });
    } catch (e: any) {
        if (e?.message === 'INVITE_USED') { res.status(409).json({ error: 'Este convite já foi usado.' }); return; }
        throw e;
    }
    res.status(201).json({ ok: true, message: 'Conta ativada. Entre com seu e-mail e senha.' });
});
