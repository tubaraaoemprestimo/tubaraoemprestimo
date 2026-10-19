import { describe, it, expect, beforeEach } from 'vitest';
import { createPhonePaymentService, isPhoneOrder, PhonePaymentError } from '../phoneFinancing/phonePayments';

// Prisma em memória, só com o que o serviço usa. Nenhuma chamada externa.
function makeDb() {
    const t: Record<string, Map<string, any>> = {
        phoneSalePayment: new Map(), phoneSaleInstallment: new Map(), phoneSale: new Map(),
        phonePaymentAllocation: new Map(), customer: new Map(),
    };
    let seq = 0;
    const match = (row: any, where: any = {}) => Object.entries(where).every(([k, v]: any) =>
        v && typeof v === 'object' && 'in' in v ? v.in.includes(row[k]) : row[k] === v);
    const model = (name: string, unique: string[] = []) => ({
        create: async ({ data }: any) => {
            for (const u of unique) if (data[u] != null && [...t[name].values()].some(r => r[u] === data[u])) throw Object.assign(new Error('unique'), { code: 'P2002' });
            const row = { id: data.id || `${name}-${++seq}`, createdAt: new Date(Date.now() + seq), ...data };
            t[name].set(row.id, row); return { ...row };
        },
        update: async ({ where, data }: any) => {
            const row = t[name].get(where.id) || [...t[name].values()].find(r => match(r, where));
            for (const u of unique) if (data[u] != null && [...t[name].values()].some(r => r !== row && r[u] === data[u])) throw Object.assign(new Error('unique'), { code: 'P2002' });
            Object.assign(row, data); return { ...row };
        },
        updateMany: async ({ where, data }: any) => {
            let count = 0;
            for (const row of t[name].values()) {
                if (!match(row, where)) continue;
                for (const u of unique) if (data[u] != null && [...t[name].values()].some(r => r !== row && r[u] === data[u])) throw Object.assign(new Error('unique'), { code: 'P2002' });
                Object.assign(row, data); count++;
            }
            return { count };
        },
        findUnique: async ({ where, include }: any) => {
            const row = t[name].get(where.id) || [...t[name].values()].find(r => match(r, where));
            if (!row) return null;
            const out = { ...row };
            if (include?.sale) out.sale = { ...t.phoneSale.get(row.saleId) };
            return out;
        },
        findFirst: async ({ where }: any) => { const r = [...t[name].values()].find(x => match(x, where)); return r ? { ...r } : null; },
        findMany: async ({ where }: any = {}) => [...t[name].values()].filter(r => match(r, where)).sort((a, b) => b.createdAt - a.createdAt).map(r => ({ ...r })),
        count: async ({ where }: any) => [...t[name].values()].filter(r => match(r, where)).length,
    });
    const prisma: any = {
        phoneSalePayment: model('phoneSalePayment', ['orderNsu', 'transactionNsu']),
        phoneSaleInstallment: model('phoneSaleInstallment'),
        phoneSale: model('phoneSale'),
        phonePaymentAllocation: model('phonePaymentAllocation'),
        customer: model('customer'),
        auditLog: { create: async () => ({}) },
    };
    prisma.$transaction = async (fn: any) => fn(prisma);
    return { prisma, t };
}

function setup(check: { paid: boolean; amount?: number } = { paid: true }) {
    const { prisma, t } = makeDb();
    t.customer.set('cust-1', { id: 'cust-1', name: 'Ana', email: 'a@x.com', phone: '11999998888' });
    t.phoneSale.set('sale-1', { id: 'sale-1', customerId: 'cust-1', status: 'active' });
    t.phoneSaleInstallment.set('i1', { id: 'i1', saleId: 'sale-1', number: 1, kind: 'INSTALLMENT', amountCents: 10000, paidCents: 0, status: 'OPEN' });
    t.phoneSaleInstallment.set('i2', { id: 'i2', saleId: 'sale-1', number: 2, kind: 'INSTALLMENT', amountCents: 10000, paidCents: 0, status: 'OPEN' });
    const calls = { links: 0, checks: 0, notify: 0 };
    const client: any = {
        createCheckoutLink: async (_: any) => { calls.links++; return { url: 'https://checkout.infinitepay.io/x' }; },
        paymentCheck: async () => { calls.checks++; return { success: true, ...check, amount: check.amount ?? 10000 }; },
    };
    const svc = createPhonePaymentService({
        prisma, client,
        config: { handle: 'h', apiUrl: 'x', webhookUrl: 'https://w', redirectUrl: 'https://r', timeoutMs: 1 },
        notifyAdmins: async () => { calls.notify++; }, now: () => new Date('2026-11-01T12:00:00Z'),
    });
    return { svc, t, calls };
}

describe('roteamento do webhook único', () => {
    it('só pedidos "PH-" vão para celulares; empréstimos seguem intactos', () => {
        expect(isPhoneOrder('PH-abc')).toBe(true);
        expect(isPhoneOrder('3f2b-uuid-de-emprestimo')).toBe(false);
        expect(isPhoneOrder(undefined)).toBe(false);
    });
});

describe('pagamento InfinitePay de parcela de celular', () => {
    let ctx: ReturnType<typeof setup>;
    beforeEach(() => { ctx = setup(); });

    it('cria link com order_nsu PH-, reaproveita no 2º clique e não mexe em outras parcelas', async () => {
        const a = await ctx.svc.createCharge('cust-1', 'i1');
        const b = await ctx.svc.createCharge('cust-1', 'i1');
        expect(a.id).toBe(b.id);
        expect(ctx.calls.links).toBe(1);
        expect([...ctx.t.phoneSalePayment.values()][0].orderNsu).toBe(`PH-${a.id}`);
    });

    it('cliente de outra conta não gera cobrança', async () => {
        await expect(ctx.svc.createCharge('cust-2', 'i1')).rejects.toBeInstanceOf(PhonePaymentError);
    });

    it('webhook confirmado via payment_check baixa só a parcela alvo', async () => {
        const c = await ctx.svc.createCharge('cust-1', 'i1');
        const r = await ctx.svc.processWebhook({ order_nsu: `PH-${c.id}`, transaction_nsu: 't1', amount: 10000 });
        expect(r).toBe('CONFIRMED');
        expect(ctx.t.phoneSaleInstallment.get('i1')).toMatchObject({ status: 'PAID', paidCents: 10000 });
        expect(ctx.t.phoneSaleInstallment.get('i2')).toMatchObject({ status: 'OPEN', paidCents: 0 });
        expect(ctx.t.phoneSale.get('sale-1').status).toBe('active');
    });

    it('webhook duplicado não baixa duas vezes', async () => {
        const c = await ctx.svc.createCharge('cust-1', 'i1');
        const body = { order_nsu: `PH-${c.id}`, transaction_nsu: 't1', amount: 10000 };
        await ctx.svc.processWebhook(body);
        expect(await ctx.svc.processWebhook(body)).toBe('DUPLICATE');
        expect(ctx.t.phonePaymentAllocation.size).toBe(1);
    });

    it('valor do webhook diferente do cobrado é recusado', async () => {
        const c = await ctx.svc.createCharge('cust-1', 'i1');
        expect(await ctx.svc.processWebhook({ order_nsu: `PH-${c.id}`, transaction_nsu: 't1', amount: 5000 })).toBe('AMOUNT_MISMATCH');
        expect(ctx.t.phoneSaleInstallment.get('i1').status).toBe('OPEN');
    });

    it('payment_check dizendo "não pago" não baixa (não confia no corpo do webhook)', async () => {
        ctx = setup({ paid: false });
        const c = await ctx.svc.createCharge('cust-1', 'i1');
        expect(await ctx.svc.processWebhook({ order_nsu: `PH-${c.id}`, transaction_nsu: 't1', amount: 10000 })).toBe('NOT_PAID');
        expect(ctx.t.phoneSaleInstallment.get('i1').status).toBe('OPEN');
    });

    it('última parcela paga marca venda quitada, sem tocar MDM nem titularidade', async () => {
        for (const id of ['i1', 'i2']) {
            const c = await ctx.svc.createCharge('cust-1', id);
            await ctx.svc.processWebhook({ order_nsu: `PH-${c.id}`, transaction_nsu: `t-${id}`, amount: 10000 });
        }
        const sale = ctx.t.phoneSale.get('sale-1');
        expect(sale.status).toBe('paid_off');
        expect(sale.legalTitleTransferDate).toBeUndefined();
        expect(sale.mdmReleasedAt).toBeUndefined();
    });

    it('pagamento para parcela já quitada vai para revisão, não duplica baixa', async () => {
        const c = await ctx.svc.createCharge('cust-1', 'i1');
        ctx.t.phoneSaleInstallment.get('i1').status = 'PAID';
        ctx.t.phoneSaleInstallment.get('i1').paidCents = 10000;
        expect(await ctx.svc.processWebhook({ order_nsu: `PH-${c.id}`, transaction_nsu: 't1', amount: 10000 })).toBe('NEEDS_REVIEW');
        expect(ctx.calls.notify).toBe(1);
    });
});

describe('baixa manual com segunda conferência', () => {
    it('acima do limite aguarda outro admin; o mesmo admin não aprova', async () => {
        const { svc, t } = setup();
        const { result, payment } = await svc.recordManual({ saleId: 'sale-1', installmentId: 'i1', amountCents: 10000, receiptUrl: 'https://r/x.jpg', note: 'pix', adminId: 'adm-1', secondApprovalCents: 5000 });
        expect(result).toBe('AWAITING_SECOND_APPROVAL');
        expect(t.phoneSaleInstallment.get('i1').status).toBe('OPEN');
        await expect(svc.approveManual(payment.id, 'adm-1')).rejects.toBeInstanceOf(PhonePaymentError);
        expect(await svc.approveManual(payment.id, 'adm-2')).toBe('CONFIRMED');
        expect(t.phoneSaleInstallment.get('i1').status).toBe('PAID');
    });
    it('pagamento parcial manual deixa a parcela PARTIAL', async () => {
        const { svc, t } = setup();
        await svc.recordManual({ saleId: 'sale-1', installmentId: 'i1', amountCents: 4000, receiptUrl: 'https://r', note: '', adminId: 'adm-1', secondApprovalCents: 50000 });
        expect(t.phoneSaleInstallment.get('i1')).toMatchObject({ status: 'PARTIAL', paidCents: 4000 });
    });
    it('sem comprovante é recusado', async () => {
        const { svc } = setup();
        await expect(svc.recordManual({ saleId: 'sale-1', installmentId: 'i1', amountCents: 4000, receiptUrl: '', note: '', adminId: 'a', secondApprovalCents: 1 })).rejects.toBeInstanceOf(PhonePaymentError);
    });
});
