// Regressão da manutenção 23/11/2026: acesso a fichas de cliente, comprovantes idempotentes
// e auditoria da edição de contrato. Chama os routers do Express direto (sem rede).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import http from 'http';
import express from 'express';

const db: any = {};
vi.mock('../prisma', () => ({ prisma: new Proxy({}, { get: (_t, k) => db[k as string] }) }));
vi.mock('../../middleware/auth', () => ({
    authenticate: (req: any, _res: any, next: any) => { req.user = JSON.parse(req.headers['x-test-user'] || 'null'); next(); },
    requireAdmin: (req: any, res: any, next: any) => (req.user?.role === 'ADMIN' ? next() : res.status(403).json({ error: 'Acesso negado' })),
}));
vi.mock('../email', () => ({ emailService: { send: async () => {} } }));
vi.mock('../whatsapp', () => ({ sendWhatsAppMessage: async () => true }));
vi.mock('../../routes/push', () => ({ sendPushToUser: async () => {}, sendPushToRole: async () => {} }));
const applied: any[] = [];
vi.mock('../paymentConfirmationService', () => ({ applyApprovedPayment: async (r: any) => { applied.push(r.id); return 'OK'; } }));

const ADMIN = { id: 'adm', name: 'Admin', role: 'ADMIN' };
const CLIENT = { id: 'u1', name: 'Cli', role: 'CLIENT' };

async function call(router: any, mount: string, method: string, path: string, user: any, body?: any) {
    const app = express(); app.use(express.json()); app.use(mount, router);
    const server = http.createServer(app);
    await new Promise<void>(r => server.listen(0, r));
    const port = (server.address() as any).port;
    try {
        const res = await fetch(`http://127.0.0.1:${port}${mount}${path}`, {
            method, headers: { 'content-type': 'application/json', 'x-test-user': JSON.stringify(user) }, body: body ? JSON.stringify(body) : undefined,
        });
        return { status: res.status, body: await res.json().catch(() => null) };
    } finally { server.close(); }
}

describe('clientes: ficha só para admin', () => {
    beforeEach(() => {
        db.customer = { findMany: async () => [{ id: 'c1', name: 'X', _count: { loanRequests: 0 } }], findUnique: async () => ({ id: 'c1', cpf: '1' }) };
    });
    it('cliente comum recebe 403 na lista e na ficha; admin recebe 200', async () => {
        const { customersRouter } = await import('../../routes/customers');
        expect((await call(customersRouter, '/api/customers', 'GET', '/', CLIENT)).status).toBe(403);
        expect((await call(customersRouter, '/api/customers', 'GET', '/c1', CLIENT)).status).toBe(403);
        expect((await call(customersRouter, '/api/customers', 'GET', '/', ADMIN)).status).toBe(200);
        expect((await call(customersRouter, '/api/customers', 'GET', '/c1', ADMIN)).status).toBe(200);
    });
});

describe('comprovantes', () => {
    let receipt: any;
    beforeEach(() => {
        applied.length = 0;
        receipt = { id: 'r1', status: 'PENDING', amount: 505, notes: null, installmentId: 'i1', customerId: 'c1' };
        db.paymentReceipt = {
            findUnique: async () => ({ ...receipt }),
            findUniqueOrThrow: async () => ({ ...receipt }),
            updateMany: async ({ where, data }: any) => {
                if (receipt.status !== where.status) return { count: 0 };
                Object.assign(receipt, data); return { count: 1 };
            },
            create: async ({ data }: any) => ({ id: 'new', ...data }),
        };
        db.customer = { findUnique: async () => null };
        db.notification = { create: async () => ({}) };
        db.user = { findMany: async () => [] };
        db.installment = { findUnique: async () => ({ id: 'i1', amount: 150, status: 'OPEN', loan: { customer: { id: 'c1', userId: 'dono', name: 'Dono' } } }) };
    });
    it('comprovante de parcela já paga não é aprovado (evita crédito em dobro)', async () => {
        db.installment = { findUnique: async () => ({ id: 'i1', status: 'PAID' }) };
        const { paymentReceiptsRouter } = await import('../../routes/paymentReceipts');
        const r = await call(paymentReceiptsRouter, '/api/payment-receipts', 'PUT', '/r1/approve', ADMIN, {});
        expect(r.status).toBe(409);
        expect(r.body.code).toBe('INSTALLMENT_ALREADY_PAID');
        expect(applied).toEqual([]);
        expect(receipt.status).toBe('PENDING');
    });
    it('aprovar duas vezes aplica o pagamento uma vez só', async () => {
        const { paymentReceiptsRouter } = await import('../../routes/paymentReceipts');
        const [a, b] = await Promise.all([
            call(paymentReceiptsRouter, '/api/payment-receipts', 'PUT', '/r1/approve', ADMIN, {}),
            call(paymentReceiptsRouter, '/api/payment-receipts', 'PUT', '/r1/approve', ADMIN, {}),
        ]);
        expect([a.status, b.status].sort()).toEqual([200, 409]);
        expect(applied).toEqual(['r1']);
    });
    it('rejeitar comprovante aprovado é recusado', async () => {
        receipt.status = 'APPROVED';
        const { paymentReceiptsRouter } = await import('../../routes/paymentReceipts');
        expect((await call(paymentReceiptsRouter, '/api/payment-receipts', 'PUT', '/r1/reject', ADMIN, {})).status).toBe(409);
        expect(receipt.status).toBe('APPROVED');
    });
    it('cliente não envia comprovante para parcela de outro cliente', async () => {
        const { paymentReceiptsRouter } = await import('../../routes/paymentReceipts');
        const r = await call(paymentReceiptsRouter, '/api/payment-receipts', 'POST', '/', CLIENT, { installmentId: 'i1', receiptUrl: 'https://x/y.jpg' });
        expect(r.status).toBe(404);
    });
});

describe('edição de contrato', () => {
    it('registra auditoria com valor anterior e novo; recusa data inválida', async () => {
        const audits: any[] = [];
        db.loan = {
            findUnique: async () => ({ adminNotes: null, dailyInstallmentAmount: 100, nextPaymentDate: new Date('2026-12-01T00:00:00Z') }),
            update: async ({ data }: any) => ({ id: 'l1', ...data }),
        };
        db.auditLog = { create: async ({ data }: any) => { audits.push(data); return data; } };
        db.$transaction = async (ops: any[]) => Promise.all(ops);
        const { loansRouter } = await import('../../routes/loans');
        const ok = await call(loansRouter, '/api/loans', 'PUT', '/l1/admin-edit', ADMIN, { dailyInstallmentAmount: '120', adminNotes: 'ligou' });
        expect(ok.status).toBe(200);
        expect(audits).toHaveLength(1);
        const changes = JSON.parse(audits[0].details);
        expect(changes).toEqual(expect.arrayContaining([{ field: 'dailyInstallmentAmount', from: 100, to: 120 }]));
        expect(audits[0]).toMatchObject({ userId: 'adm', action: 'LOAN_ADMIN_EDIT', entityId: 'l1' });
        expect((await call(loansRouter, '/api/loans', 'PUT', '/l1/admin-edit', ADMIN, { nextPaymentDate: 'banana' })).status).toBe(400);
    });
});
