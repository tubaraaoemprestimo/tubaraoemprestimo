import { describe, it, expect, beforeEach } from 'vitest';
import {
    createInfinitePayService,
    reaisToCents,
    toInternationalPhone,
    buildRedirectUrl,
    CHARGE_STATUS,
    ChargeError,
} from '../infinitepay/infinitepayService';
import { createInfinitePayClient, InfinitePayError } from '../infinitepay/infinitepayClient';

// ---------------------------------------------------------------------------
// Prisma em memória: só o que o serviço usa. Nenhuma chamada externa real.
// ---------------------------------------------------------------------------
function makeDb() {
    const db: any = {
        charges: new Map<string, any>(),
        receipts: [] as any[],
        audits: [] as any[],
        customers: [{ id: 'cust-1', userId: 'user-1', name: 'Maria Silva', email: 'maria@x.com', phone: '(11) 98888-7777' }],
        loans: [{ id: 'loan-1', customerId: 'cust-1', installments: [{ id: 'inst-1', status: 'OPEN', dueDate: new Date() }] }],
        installments: new Map<string, any>([['inst-1', { id: 'inst-1', status: 'OPEN' }]]),
        seq: 0,
    };

    const matches = (c: any, where: any) =>
        Object.entries(where).every(([k, v]: any) => {
            if (v && typeof v === 'object' && 'in' in v) return v.in.includes(c[k]);
            return c[k] === v;
        });

    const prisma: any = {
        paymentCharge: {
            create: async ({ data }: any) => {
                const row = { id: `charge-${++db.seq}`, createdAt: new Date(Date.now() + db.seq), status: 'PENDING', ...data };
                db.charges.set(row.id, row);
                return { ...row };
            },
            update: async ({ where, data }: any) => {
                const row = db.charges.get(where.id);
                Object.assign(row, data);
                return { ...row };
            },
            updateMany: async ({ where, data }: any) => {
                let count = 0;
                for (const row of db.charges.values()) {
                    if (!matches(row, where)) continue;
                    if (data.transactionNsu) {
                        const clash = [...db.charges.values()].find((o: any) => o.id !== row.id && o.transactionNsu === data.transactionNsu);
                        if (clash) throw Object.assign(new Error('unique'), { code: 'P2002' });
                    }
                    Object.assign(row, data);
                    count++;
                }
                return { count };
            },
            findUnique: async ({ where }: any) => {
                const row = db.charges.get(where.id);
                return row ? { ...row } : null;
            },
            findFirst: async ({ where }: any) => {
                const row = [...db.charges.values()].find((c: any) => matches(c, where));
                return row ? { ...row } : null;
            },
            findMany: async ({ where }: any) =>
                [...db.charges.values()]
                    .filter((c: any) => matches(c, where))
                    .sort((a: any, b: any) => b.createdAt - a.createdAt)
                    .map((c: any) => ({ ...c })),
        },
        customer: {
            findFirst: async ({ where }: any) => db.customers.find((c: any) => c.userId === where.userId) || null,
        },
        loan: {
            findUnique: async ({ where }: any) => db.loans.find((l: any) => l.id === where.id) || null,
        },
        installment: {
            findUnique: async ({ where }: any) => db.installments.get(where.id) || null,
        },
        paymentReceipt: {
            create: async ({ data }: any) => {
                const row = { id: `rec-${db.receipts.length + 1}`, ...data };
                db.receipts.push(row);
                return row;
            },
        },
        auditLog: {
            create: async ({ data }: any) => {
                db.audits.push(data);
                return data;
            },
        },
    };
    return { db, prisma };
}

const CONFIG = {
    handle: 'tubaraoemprestimo',
    apiUrl: 'https://api.checkout.infinitepay.io',
    webhookUrl: 'https://api.example.com/api/webhooks/infinitepay',
    redirectUrl: 'https://app.example.com/#/pagamento/retorno',
    timeoutMs: 1000,
};

function setup(overrides: { amount?: number; paid?: boolean; checkAmount?: number } = {}) {
    const { db, prisma } = makeDb();
    const calls = { links: [] as any[], checks: [] as any[], applied: [] as any[], admin: [] as any[] };
    let checkResponse: any = { success: true, paid: overrides.paid ?? true, amount: overrides.checkAmount ?? 48500, paid_amount: 48500, installments: 1, capture_method: 'pix' };
    let linkError: Error | null = null;

    const client: any = {
        createCheckoutLink: async (input: any) => {
            calls.links.push(input);
            if (linkError) throw linkError;
            return { url: `https://checkout.infinitepay.io/pay/${input.orderNsu}` };
        },
        paymentCheck: async (input: any) => {
            calls.checks.push(input);
            if (checkResponse instanceof Error) throw checkResponse;
            return checkResponse;
        },
    };

    let now = new Date('2026-09-29T12:00:00Z');
    const service = createInfinitePayService({
        prisma,
        client,
        config: CONFIG,
        computeQuote: async () => ({
            paymentAmount: overrides.amount ?? 485,
            paymentDescription: 'Pagamento de Juros Mensal (30% sobre R$ 1.616,67)',
            targetInstallment: { id: 'inst-1' },
        }),
        applyApprovedPayment: async (receipt: any, opts: any) => {
            calls.applied.push({ receipt, opts });
            db.installments.get(receipt.installmentId).status = 'PAID';
            return 'OK';
        },
        notifyAdmins: async (title: string) => {
            calls.admin.push(title);
        },
        now: () => now,
    });

    return {
        db,
        calls,
        service,
        setCheck: (v: any) => { checkResponse = v; },
        setLinkError: (e: Error | null) => { linkError = e; },
        advance: (ms: number) => { now = new Date(now.getTime() + ms); },
    };
}

const webhook = (orderNsu: string, extra: Record<string, any> = {}) => ({
    invoice_slug: 'slug-1',
    amount: 48500,
    paid_amount: 48500,
    installments: 1,
    capture_method: 'pix',
    transaction_nsu: 'txn-1',
    order_nsu: orderNsu,
    receipt_url: 'https://recibo.infinitepay.io/abc',
    ...extra,
});

describe('conversões monetárias e dados do cliente', () => {
    it('converte reais para centavos sem erro de ponto flutuante', () => {
        expect(reaisToCents(10)).toBe(1000);
        expect(reaisToCents(1.15)).toBe(115);
        expect(reaisToCents(4095.3)).toBe(409530);
        expect(reaisToCents(0.1 + 0.2)).toBe(30);
        expect(() => reaisToCents(NaN)).toThrow();
    });

    it('normaliza telefone BR e omite inválidos', () => {
        expect(toInternationalPhone('(11) 98888-7777')).toBe('+5511988887777');
        expect(toInternationalPhone('5511988887777')).toBe('+5511988887777');
        expect(toInternationalPhone('123')).toBeUndefined();
        expect(toInternationalPhone(null)).toBeUndefined();
    });

    it('monta a URL de retorno com o id da cobrança (HashRouter)', () => {
        expect(buildRedirectUrl(CONFIG.redirectUrl, 'abc')).toBe('https://app.example.com/#/pagamento/retorno?charge=abc');
    });
});

describe('criação da cobrança', () => {
    it('usa o valor final calculado pelo sistema, em centavos, e o id da cobrança como order_nsu', async () => {
        const t = setup({ amount: 485 });
        const charge = await t.service.createCharge('user-1', 'loan-1', 'interest_only');

        expect(charge.status).toBe(CHARGE_STATUS.LINK_CREATED);
        expect(charge.amount).toBe(485);
        expect(charge.checkoutUrl).toMatch(/^https:\/\//);
        expect(t.calls.links[0].amountCents).toBe(48500);
        expect(t.calls.links[0].orderNsu).toBe(charge.id);
        expect(t.calls.links[0].redirectUrl).toContain(`charge=${charge.id}`);
        expect(t.calls.links[0].customer).toEqual({ name: 'Maria Silva', email: 'maria@x.com', phone_number: '+5511988887777' });
        expect(t.db.audits.map((a: any) => a.action)).toEqual(['charge_created', 'checkout_created']);
    });

    it('funciona com cliente sem telefone válido', async () => {
        const t = setup();
        t.db.customers[0].phone = '';
        await t.service.createCharge('user-1', 'loan-1', 'full');
        expect(t.calls.links[0].customer.phone_number).toBeUndefined();
    });

    it('vários cliques reaproveitam o mesmo link', async () => {
        const t = setup();
        const a = await t.service.createCharge('user-1', 'loan-1', 'interest_only');
        const b = await t.service.createCharge('user-1', 'loan-1', 'interest_only');
        expect(b.id).toBe(a.id);
        expect(t.calls.links).toHaveLength(1);
    });

    it('valor mudou (multa diária): cancela o link antigo e gera outro', async () => {
        const t = setup({ amount: 485 });
        const a = await t.service.createCharge('user-1', 'loan-1', 'interest_only');
        // Simula a cotação ter mudado desde que o link foi gerado.
        t.db.charges.get(a.id).amountCents = 40000;
        const b = await t.service.createCharge('user-1', 'loan-1', 'interest_only');
        expect(b.id).not.toBe(a.id);
        expect(t.db.charges.get(a.id).status).toBe(CHARGE_STATUS.CANCELLED);
    });

    it('link expirado gera outro', async () => {
        const t = setup();
        const a = await t.service.createCharge('user-1', 'loan-1', 'interest_only');
        t.advance(25 * 60 * 60 * 1000);
        const b = await t.service.createCharge('user-1', 'loan-1', 'interest_only');
        expect(b.id).not.toBe(a.id);
    });

    it('bloqueia contrato de outro cliente', async () => {
        const t = setup();
        t.db.loans[0].customerId = 'outro';
        await expect(t.service.createCharge('user-1', 'loan-1', 'full')).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });

    it('erro da InfinitePay marca a cobrança como FAILED sem expor detalhes', async () => {
        const t = setup();
        t.setLinkError(new InfinitePayError('createCheckoutLink: timeout', 'TIMEOUT'));
        const err: any = await t.service.createCharge('user-1', 'loan-1', 'full').catch((e) => e);
        expect(err).toBeInstanceOf(ChargeError);
        expect(err.code).toBe('PROVIDER_ERROR');
        expect(err.message).not.toMatch(/timeout|http/i);
        const saved = [...t.db.charges.values()][0];
        expect(saved.status).toBe(CHARGE_STATUS.FAILED);
    });
});

describe('webhook', () => {
    let t: ReturnType<typeof setup>;
    let chargeId: string;
    beforeEach(async () => {
        t = setup();
        chargeId = (await t.service.createCharge('user-1', 'loan-1', 'interest_only')).id;
    });

    it('Pix: confirma via payment_check, grava dados e dá baixa pela regra existente', async () => {
        expect(await t.service.processWebhook(webhook(chargeId))).toBe('CONFIRMED');
        const c = t.db.charges.get(chargeId);
        expect(c.status).toBe(CHARGE_STATUS.PAID);
        expect(c.transactionNsu).toBe('txn-1');
        expect(c.invoiceSlug).toBe('slug-1');
        expect(c.receiptUrl).toBe('https://recibo.infinitepay.io/abc');
        expect(c.paymentMethod).toBe('pix');
        expect(c.paidAmountCents).toBe(48500);
        expect(t.calls.checks[0]).toEqual({ orderNsu: chargeId, transactionNsu: 'txn-1', slug: 'slug-1' });
        expect(t.calls.applied).toHaveLength(1);
        expect(t.calls.applied[0].receipt).toMatchObject({ installmentId: 'inst-1', amount: 485, status: 'APPROVED' });
        expect(t.calls.applied[0].opts).toEqual({ isDischarge: false });
    });

    it('cartão: registra o método e as parcelas informados', async () => {
        t.setCheck({ success: true, paid: true, amount: 48500, paid_amount: 50120, installments: 3, capture_method: 'credit_card' });
        await t.service.processWebhook(webhook(chargeId, { capture_method: 'credit_card', installments: 3, paid_amount: 50120 }));
        const c = t.db.charges.get(chargeId);
        expect(c.paymentMethod).toBe('credit_card');
        expect(c.installments).toBe(3);
        expect(c.paidAmountCents).toBe(50120);
    });

    it('quitação total aplica baixa como quitação', async () => {
        const full = await t.service.createCharge('user-1', 'loan-1', 'full');
        await t.service.processWebhook(webhook(full.id, { transaction_nsu: 'txn-9' }));
        expect(t.calls.applied[0].opts).toEqual({ isDischarge: true });
    });

    it('webhook repetido 10 vezes gera uma única baixa', async () => {
        const results = await Promise.all(Array.from({ length: 10 }, () => t.service.processWebhook(webhook(chargeId))));
        expect(results.filter((r) => r === 'CONFIRMED')).toHaveLength(1);
        expect(t.calls.applied).toHaveLength(1);
        expect(t.db.receipts).toHaveLength(1);
    });

    it('order_nsu inexistente é ignorado', async () => {
        expect(await t.service.processWebhook(webhook('nao-existe'))).toBe('UNKNOWN_ORDER');
        expect(t.calls.checks).toHaveLength(0);
        expect(t.calls.applied).toHaveLength(0);
    });

    it('valor diferente do cobrado não dá baixa', async () => {
        expect(await t.service.processWebhook(webhook(chargeId, { amount: 100 }))).toBe('AMOUNT_MISMATCH');
        expect(t.calls.applied).toHaveLength(0);
        t.setCheck({ success: true, paid: true, amount: 100 });
        expect(await t.service.processWebhook(webhook(chargeId))).toBe('AMOUNT_MISMATCH');
        expect(t.db.charges.get(chargeId).status).toBe(CHARGE_STATUS.LINK_CREATED);
    });

    it('webhook forjado (payment_check diz não pago) não dá baixa', async () => {
        t.setCheck({ success: true, paid: false });
        expect(await t.service.processWebhook(webhook(chargeId))).toBe('NOT_PAID');
        expect(t.calls.applied).toHaveLength(0);
    });

    it('falha no payment_check mantém pendente para reconciliar depois', async () => {
        t.setCheck(new InfinitePayError('paymentCheck: timeout', 'TIMEOUT'));
        expect(await t.service.processWebhook(webhook(chargeId))).toBe('CHECK_FAILED');
        expect(t.db.charges.get(chargeId).status).toBe(CHARGE_STATUS.LINK_CREATED);
    });

    it('parcela já quitada por outro meio vai para revisão, sem dar baixa de novo', async () => {
        t.db.installments.get('inst-1').status = 'PAID';
        expect(await t.service.processWebhook(webhook(chargeId))).toBe('NEEDS_REVIEW');
        expect(t.calls.applied).toHaveLength(0);
        expect(t.db.charges.get(chargeId).status).toBe(CHARGE_STATUS.NEEDS_REVIEW);
        expect(t.calls.admin[0]).toMatch(/revisão/);
    });

    it('segunda transação para cobrança já paga alerta o admin', async () => {
        await t.service.processWebhook(webhook(chargeId));
        expect(await t.service.processWebhook(webhook(chargeId, { transaction_nsu: 'txn-2' }))).toBe('SECOND_TRANSACTION');
        expect(t.calls.applied).toHaveLength(1);
    });

    it('pagamento de link substituído ainda é aceito (o dinheiro entrou)', async () => {
        t.db.charges.get(chargeId).status = CHARGE_STATUS.CANCELLED;
        expect(await t.service.processWebhook(webhook(chargeId))).toBe('CONFIRMED');
    });
});

describe('status / retorno do checkout', () => {
    it('retorno sem pagamento confirmado continua pendente', async () => {
        const t = setup({ paid: false });
        const { id } = await t.service.createCharge('user-1', 'loan-1', 'interest_only');
        const status = await t.service.getChargeStatus('user-1', false, id, { transactionNsu: 'forjado' });
        expect(status.status).toBe(CHARGE_STATUS.LINK_CREATED);
        expect(t.calls.applied).toHaveLength(0);
    });

    it('reconcilia pelo payment_check quando o webhook se perdeu', async () => {
        const t = setup();
        const { id } = await t.service.createCharge('user-1', 'loan-1', 'interest_only');
        const status = await t.service.getChargeStatus('user-1', false, id);
        expect(status.status).toBe(CHARGE_STATUS.PAID);
        expect(t.calls.applied).toHaveLength(1);
    });

    it('não faz polling agressivo (1 consulta a cada 20s)', async () => {
        const t = setup({ paid: false });
        const { id } = await t.service.createCharge('user-1', 'loan-1', 'interest_only');
        await t.service.getChargeStatus('user-1', false, id);
        await t.service.getChargeStatus('user-1', false, id);
        expect(t.calls.checks).toHaveLength(1);
        t.advance(21000);
        await t.service.getChargeStatus('user-1', false, id);
        expect(t.calls.checks).toHaveLength(2);
    });

    it('usuário não consulta cobrança de outro cliente', async () => {
        const t = setup();
        const { id } = await t.service.createCharge('user-1', 'loan-1', 'interest_only');
        t.db.customers.push({ id: 'cust-2', userId: 'user-2' });
        await expect(t.service.getChargeStatus('user-2', false, id)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });
});

describe('cliente HTTP', () => {
    const http = (impl: (url: string, body: any) => any) => ({ post: async (url: string, body: any) => impl(url, body) }) as any;

    it('monta o payload de /links em centavos e sem campos vazios', async () => {
        let sent: any;
        const client = createInfinitePayClient(CONFIG, http((url, body) => { sent = { url, body }; return { data: { url: 'https://checkout.infinitepay.io/x' } }; }));
        const res = await client.createCheckoutLink({ orderNsu: 'o1', amountCents: 1000, description: 'Teste', redirectUrl: 'https://r', customer: { name: 'A', email: '' } });
        expect(res.url).toBe('https://checkout.infinitepay.io/x');
        expect(sent.url).toBe('/links');
        expect(sent.body).toEqual({
            handle: 'tubaraoemprestimo',
            order_nsu: 'o1',
            redirect_url: 'https://r',
            webhook_url: CONFIG.webhookUrl,
            items: [{ quantity: 1, price: 1000, description: 'Teste' }],
            customer: { name: 'A' },
        });
    });

    it('trata timeout, HTTP e resposta inválida', async () => {
        const timeout = createInfinitePayClient(CONFIG, http(() => { throw Object.assign(new Error('timeout of 1000ms exceeded'), { code: 'ECONNABORTED' }); }));
        await expect(timeout.createCheckoutLink({ orderNsu: 'o', amountCents: 1, description: 'd', redirectUrl: 'r' })).rejects.toMatchObject({ kind: 'TIMEOUT' });

        for (const status of [400, 401, 403, 404, 409, 429, 500, 503]) {
            const c = createInfinitePayClient(CONFIG, http(() => { throw { response: { status } }; }));
            await expect(c.paymentCheck({ orderNsu: 'o' })).rejects.toMatchObject({ kind: 'HTTP', status });
        }

        const invalid = createInfinitePayClient(CONFIG, http(() => ({ data: { ok: true } })));
        await expect(invalid.createCheckoutLink({ orderNsu: 'o', amountCents: 1, description: 'd', redirectUrl: 'r' })).rejects.toMatchObject({ kind: 'INVALID_RESPONSE' });
    });

    it('recusa criar link sem configuração ou com valor inválido', async () => {
        const noHandle = createInfinitePayClient({ ...CONFIG, handle: '' }, http(() => ({})));
        await expect(noHandle.createCheckoutLink({ orderNsu: 'o', amountCents: 1, description: 'd', redirectUrl: 'r' })).rejects.toMatchObject({ kind: 'CONFIG' });
        const client = createInfinitePayClient(CONFIG, http(() => ({})));
        await expect(client.createCheckoutLink({ orderNsu: 'o', amountCents: 10.5, description: 'd', redirectUrl: 'r' })).rejects.toMatchObject({ kind: 'CONFIG' });
    });

    it('payment_check envia handle, order_nsu, transaction_nsu e slug', async () => {
        let body: any;
        const client = createInfinitePayClient(CONFIG, http((_u, b) => { body = b; return { data: { success: true, paid: true, amount: 1000, capture_method: 'pix' } }; }));
        const res = await client.paymentCheck({ orderNsu: 'o1', transactionNsu: 't1', slug: 's1' });
        expect(body).toEqual({ handle: 'tubaraoemprestimo', order_nsu: 'o1', transaction_nsu: 't1', slug: 's1' });
        expect(res).toMatchObject({ paid: true, amount: 1000, capture_method: 'pix' });
    });
});
