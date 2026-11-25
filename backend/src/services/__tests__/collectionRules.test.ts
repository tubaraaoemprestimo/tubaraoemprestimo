import { describe, it, expect } from 'vitest';
import { sanitizeRules, whatsappAllowed, collectionGate, reminderTrigger } from '../collectionRules';
import { scheduleDates } from '../../routes/legacyClients';

const db = (receipts = 0, sent = 0) => ({
    paymentReceipt: { count: async () => receipts },
    collectionDispatch: { count: async () => sent },
});
const inst = (loan: any, status = 'OPEN') => ({ id: 'i1', status, dueDate: new Date('2099-01-10'), loan: { status: 'ACTIVE', remainingAmount: 100, collectionSuspended: false, messagesSuspended: false, ...loan } });

describe('régua — regras configuráveis', () => {
    it('aceita só dias 1..30, sem repetir, do maior para o menor; hora 7..20', () => {
        const r = sanitizeRules({ reminderDays: [3, 7, 5, 5, 0, 99, 'x'], sendHour: 3, templates: { 5: 'INSTALLMENT_DUE_5_DAYS', x: 'BAD', 7: 'drop table' } });
        expect(r.reminderDays).toEqual([7, 5, 3]);
        expect(r.sendHour).toBe(9);
        expect(r.templates).toEqual({ 5: 'INSTALLMENT_DUE_5_DAYS' });
        expect(sanitizeRules({ enabled: false }).enabled).toBe(false);
        expect(reminderTrigger(r, 5)).toBe('INSTALLMENT_DUE_5_DAYS');
        expect(reminderTrigger(r, 7)).toBe('INSTALLMENT_DUE_7_DAYS');
    });

    it('WhatsApp só para telefone válido, sem opt-out e sem marca de telefone inválido', () => {
        expect(whatsappAllowed({ phone: '(11) 98765-4321' })).toBe(true);
        expect(whatsappAllowed({ phone: '123' })).toBe(false);
        expect(whatsappAllowed({ phone: '11987654321', whatsappOptOut: true })).toBe(false);
        expect(whatsappAllowed({ phone: '11987654321', activationStatus: 'TELEFONE_INVALIDO' })).toBe(false);
    });

    it('bloqueia: quitado, saldo zero, saldo não conferido, pausado, pagamento em conferência, já enviado', async () => {
        expect(await collectionGate(inst({}), 'T', db())).toBeNull();
        expect(await collectionGate(inst({ status: 'COMPLETED' }), 'T', db())).toBe('CONTRATO_ENCERRADO');
        expect(await collectionGate(inst({ status: 'CANCELLED' }), 'T', db())).toBe('CONTRATO_ENCERRADO');
        expect(await collectionGate(inst({ remainingAmount: 0 }), 'T', db())).toBe('SALDO_ZERO');
        expect(await collectionGate(inst({ collectionSuspended: true }), 'T', db())).toBe('SALDO_NAO_CONFIRMADO');
        expect(await collectionGate(inst({ messagesSuspended: true }), 'T', db())).toBe('COMUNICACAO_SUSPENSA');
        expect(await collectionGate(inst({}, 'AWAITING_CONFIRMATION'), 'T', db())).toBe('PAGAMENTO_EM_CONFERENCIA');
        expect(await collectionGate(inst({}), 'T', db(1))).toBe('PAGAMENTO_EM_CONFERENCIA');
        expect(await collectionGate(inst({}), 'T', db(0, 1))).toBe('JA_ENVIADO');
    });
});

describe('contrato antigo — vencimentos das parcelas restantes', () => {
    it('mensal mantém o dia (fim de mês ajusta), diária pula domingo, semanal +7', () => {
        const m = scheduleDates(new Date(2026, 0, 31), 3, 'MONTHLY').map(d => d.getDate());
        expect(m).toEqual([31, 28, 31]);
        const daily = scheduleDates(new Date(2026, 10, 28), 3, 'DAILY'); // sáb 28/11
        expect(daily.map(d => d.getDay())).toEqual([6, 1, 2]);
        const w = scheduleDates(new Date(2026, 10, 25), 2, 'WEEKLY');
        expect((+w[1] - +w[0]) / 86400000).toBe(7);
    });
});
