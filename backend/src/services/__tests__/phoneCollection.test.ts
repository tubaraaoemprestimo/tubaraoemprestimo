import { describe, it, expect } from 'vitest';
import { stageFor, runPhoneCollection, messageFor } from '../phoneFinancing/phoneCollection';

const policy = { reminderDaysBefore: 2, graceDaysAfterDue: 3 };
const at = (s: string) => new Date(`${s}T15:00:00Z`); // 12h em São Paulo

describe('etapas da régua de celulares', () => {
    it('lembrete, vencimento, pós-tolerância e encaminhamento', () => {
        const due = at('2026-11-10');
        expect(stageFor(due, at('2026-11-08'), policy)).toBe('REMINDER');
        expect(stageFor(due, at('2026-11-10'), policy)).toBe('DUE_TODAY');
        expect(stageFor(due, at('2026-11-12'), policy)).toBeNull(); // dentro da tolerância: silêncio
        expect(stageFor(due, at('2026-11-14'), policy)).toBe('AFTER_GRACE');
        expect(stageFor(due, at('2026-11-21'), policy)).toBe('HUMAN_HANDOFF');
    });
    it('mensagens nunca mencionam bloqueio do aparelho', () => {
        for (const s of ['REMINDER', 'DUE_TODAY', 'AFTER_GRACE', 'HUMAN_HANDOFF'] as const) {
            expect(messageFor(s, { name: 'Ana', label: 'parcela 1', amount: '100,00', due: '10/11/2026', link: 'x' })).not.toMatch(/bloque|desativ|rastre/i);
        }
    });
});

describe('execução da régua', () => {
    function deps(installments: any[]) {
        const events = new Set<string>();
        const sent: string[] = [];
        const prisma: any = {
            phoneFinancingSettings: { findUnique: async () => policy },
            phoneSaleInstallment: { findMany: async () => installments },
            phoneCollectionEvent: {
                create: async ({ data }: any) => { const k = `${data.installmentId}|${data.stage}|${data.sentOn}`; if (events.has(k)) throw new Error('unique'); events.add(k); },
                updateMany: async () => ({ count: 1 }),
            },
            customer: { findUnique: async () => ({ name: 'Ana Souza', phone: '11999990000' }) },
            phoneSale: { update: async () => ({}) },
        };
        return { prisma, sent, d: { prisma, sendWhatsApp: async (_p: string, t: string) => { sent.push(t); return true; }, notifyAdmins: async () => {}, appUrl: 'https://app', now: () => at('2026-11-10') } };
    }
    const inst = (id: string, due: string, extra: any = {}) => ({ id, saleId: 's', number: 1, kind: 'INSTALLMENT', amountCents: 15000, paidCents: 0, dueDate: at(due), sale: { status: 'active', customerId: 'c' }, ...extra });

    it('envia uma vez por etapa/dia, mesmo rodando duas vezes', async () => {
        const { d, sent } = deps([inst('i1', '2026-11-10')]);
        await runPhoneCollection(d);
        const second = await runPhoneCollection(d);
        expect(sent).toHaveLength(1);
        expect(sent[0]).toContain('vence hoje');
        expect(second.skipped).toBe(1);
    });
});
