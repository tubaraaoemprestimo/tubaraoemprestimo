// Regressão da fase de conciliação (25/11/2026): classificação dos comprovantes,
// trava do cron de cobrança e permissões da automação. Só dados fictícios.
import { describe, it, expect, vi } from 'vitest';
import { classifyReceipt } from '../receiptReconciliation';

const d = (s: string) => new Date(s);
const inst = (amount: number, owner = 'c1') => ({ id: 'i1', amount, status: 'PAID', loanOwnerId: owner });
const rc = (id: string, amount: number, at: string, status = 'PENDING', customerId = 'c1') => ({ id, amount, createdAt: d(at), customerId, installmentId: 'i1', status });

describe('conciliação: classificação conservadora', () => {
    it('cliente diferente do dono do contrato', () => {
        expect(classifyReceipt(rc('a', 300, '2026-09-10T10:00Z', 'PENDING', 'outro'), inst(300), [])).toBe('DIVERGENCIA_CONTRATO');
    });
    it('mesmo valor reenviado no MESMO dia = possível duplicidade só para o segundo', () => {
        const a = rc('a', 300, '2026-09-10T10:00Z'), b = rc('b', 300, '2026-09-10T10:05Z');
        expect(classifyReceipt(a, inst(300), [a, b])).not.toBe('POSSIVEL_DUPLICIDADE');
        expect(classifyReceipt(b, inst(300), [a, b])).toBe('POSSIVEL_DUPLICIDADE');
    });
    it('mesmo valor em dias diferentes NÃO é duplicidade', () => {
        const a = rc('a', 300, '2026-09-10T10:00Z'), b = rc('b', 300, '2026-09-18T10:00Z');
        expect(classifyReceipt(b, inst(300), [a, b])).not.toBe('POSSIVEL_DUPLICIDADE');
    });
    it('já existe aprovação com o mesmo valor = já conciliado', () => {
        const ok = rc('ok', 1000, '2026-05-25T10:00Z', 'APPROVED'), p = rc('p', 1000, '2026-04-07T10:00Z');
        expect(classifyReceipt(p, inst(1000), [ok, p])).toBe('JA_CONCILIADO');
    });
    it('parcela com valor 0 (juros antigos) vai para análise manual', () => {
        expect(classifyReceipt(rc('a', 336, '2026-07-10T10:00Z'), inst(0), [])).toBe('ANALISE_MANUAL');
    });
    it('parcial, excedente e divergência de valor', () => {
        expect(classifyReceipt(rc('a', 100, '2026-07-10T10:00Z'), inst(240), [])).toBe('PAGAMENTO_PARCIAL');
        const ap = rc('ap', 240, '2026-06-21T10:00Z', 'APPROVED');
        expect(classifyReceipt(rc('a', 356, '2026-07-10T10:00Z'), inst(240), [ap])).toBe('PAGAMENTO_EXCEDENTE');
        expect(classifyReceipt(rc('a', 356, '2026-07-10T10:00Z'), inst(240), [])).toBe('DIVERGENCIA_VALOR');
    });
    it('valor igual à parcela sem outra evidência = análise manual (não rejeita sozinho)', () => {
        expect(classifyReceipt(rc('a', 500, '2026-05-15T10:00Z'), inst(500), [])).toBe('ANALISE_MANUAL');
    });
});

describe('rotina de multas das 9h: repetir no mesmo dia não duplica', () => {
    it('duas execuções seguidas gravam o MESMO valor (recalcula, não soma)', async () => {
        vi.resetModules();
        const rows = [
            { id: 'clt', amount: 150, status: 'OPEN', dueDate: new Date(Date.now() - 10 * 86400000), isInterestPayment: true, lateFeeAmount: 0,
              loan: { amount: 500, principalAmount: 500, paymentFrequency: 'MONTHLY', customer: {}, loanRequest: { profileType: 'CLT' } } },
            { id: 'aut', amount: 44, status: 'OPEN', dueDate: new Date(Date.now() - 3 * 86400000), isInterestPayment: false, lateFeeAmount: 0,
              loan: { amount: 1000, principalAmount: 1000, paymentFrequency: 'DAILY', customer: {}, loanRequest: { profileType: 'AUTONOMO' } } },
        ];
        const store = new Map<string, number>();
        vi.doMock('../prisma', () => ({ prisma: {
            installment: {
                findMany: async () => rows,
                update: async ({ where, data }: any) => { store.set(where.id, data.lateFeeAmount); return {}; },
            },
        } }));
        const { applyDailyLateFees } = await import('../collectionAutomationService');
        await applyDailyLateFees();
        const first = new Map(store);
        await applyDailyLateFees();
        expect([...store]).toEqual([...first]);
        // CLT: 7% de 500 + 10 × R$20 = 235 ; AUTONOMO: 3 × R$20 = 60 (regra do código hoje).
        expect(store.get('clt')).toBe(235);
        expect(store.get('aut')).toBe(60);
    });
});

describe('cron de cobrança: trava entre processos', () => {
    it('sem a trava do PostgreSQL não executa; com a trava executa uma vez', async () => {
        vi.resetModules();
        vi.doMock('../prisma', () => ({ prisma: {} }));
        vi.doMock('../collectionAutomationService', () => ({ collectionAutomationService: {} }));
        const { withCollectionLock } = await import('../../cron/collectionCron');
        let held = false;
        // Simula duas réplicas: a 2ª encontra a trava ocupada.
        const db = {
            $transaction: async (fn: any) => fn({
                $queryRawUnsafe: async () => { if (held) return [{ ok: false }]; held = true; return [{ ok: true }]; },
            }),
        };
        let runs = 0;
        const job = async () => { runs++; await new Promise(r => setTimeout(r, 20)); return 'ok'; };
        const [a, b] = await Promise.all([withCollectionLock(job, db), withCollectionLock(job, db)]);
        expect([a.ran, b.ran].sort()).toEqual([false, true]);
        expect(runs).toBe(1);
    });
});
