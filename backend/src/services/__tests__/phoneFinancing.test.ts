import { describe, it, expect } from 'vitest';
import {
    buildSchedule,
    canTransition,
    allocatePayment,
    maskIdentifier,
    assertOfferReady,
    COMMERCIAL_SERVICE_CODES,
} from '../phoneFinancing/rules';
import { getFlags } from '../phoneFinancing/flags';

describe('cronograma de parcelas (centavos)', () => {
    it('sem juros: soma exata do financiado, sobra no último', () => {
        const s = buildSchedule({ financedCents: 100000, installments: 3, monthlyInterestBps: 0, firstDueDate: new Date('2026-11-10T12:00:00Z') });
        expect(s.map(p => p.amountCents)).toEqual([33333, 33333, 33334]);
        expect(s.reduce((a, p) => a + p.amountCents, 0)).toBe(100000);
        expect(s.map(p => p.dueDate.toISOString().slice(0, 10))).toEqual(['2026-11-10', '2026-12-10', '2027-01-10']);
    });
    it('com juros (Price): parcelas iguais, total maior que o financiado', () => {
        const s = buildSchedule({ financedCents: 100000, installments: 12, monthlyInterestBps: 300, firstDueDate: new Date('2026-11-10T12:00:00Z') });
        const total = s.reduce((a, p) => a + p.amountCents, 0);
        expect(new Set(s.slice(0, 11).map(p => p.amountCents)).size).toBe(1);
        expect(s[0].amountCents).toBe(10046); // PMT(3%,12,1000) = 100,46
        expect(total).toBeGreaterThan(100000);
    });
    it('vencimento dia 31 não pula mês', () => {
        const s = buildSchedule({ financedCents: 30000, installments: 3, monthlyInterestBps: 0, firstDueDate: new Date('2027-01-31T12:00:00Z') });
        expect(s.map(p => p.dueDate.toISOString().slice(0, 10))).toEqual(['2027-01-31', '2027-02-28', '2027-03-31']);
    });
    it('rejeita entrada inválida', () => {
        expect(() => buildSchedule({ financedCents: 0, installments: 3, monthlyInterestBps: 0, firstDueDate: new Date() })).toThrow();
        expect(() => buildSchedule({ financedCents: 100, installments: 0, monthlyInterestBps: 0, firstDueDate: new Date() })).toThrow();
        expect(() => buildSchedule({ financedCents: 1.5, installments: 2, monthlyInterestBps: 0, firstDueDate: new Date() })).toThrow();
    });
});

describe('máquina de estados da proposta', () => {
    it('permite fluxo normal e bloqueia saltos', () => {
        expect(canTransition('submitted', 'under_review')).toBe(true);
        expect(canTransition('under_review', 'approved')).toBe(true);
        expect(canTransition('submitted', 'active')).toBe(false);
        expect(canTransition('rejected', 'approved')).toBe(false);
        expect(canTransition('closed', 'under_review')).toBe(false);
    });
});

describe('alocação de pagamento', () => {
    const inst = (id: string, amountCents: number, paidCents = 0) => ({ id, number: Number(id), amountCents, paidCents, status: paidCents ? 'PARTIAL' : 'OPEN' });
    it('paga a parcela alvo e não mexe nas outras', () => {
        const r = allocatePayment([inst('1', 1000), inst('2', 1000)], 1000, '1');
        expect(r.allocations).toEqual([{ installmentId: '1', amountCents: 1000, newPaidCents: 1000, newStatus: 'PAID' }]);
        expect(r.unallocatedCents).toBe(0);
    });
    it('pagamento parcial vira PARTIAL, nunca PAID', () => {
        const r = allocatePayment([inst('1', 1000)], 400, '1');
        expect(r.allocations[0]).toMatchObject({ newPaidCents: 400, newStatus: 'PARTIAL' });
    });
    it('valor acima do devido fica não alocado (para revisão)', () => {
        const r = allocatePayment([inst('1', 1000, 600)], 1000, '1');
        expect(r.allocations[0]).toMatchObject({ amountCents: 400, newStatus: 'PAID' });
        expect(r.unallocatedCents).toBe(600);
    });
    it('parcela já paga não recebe alocação', () => {
        const r = allocatePayment([{ id: '1', number: 1, amountCents: 1000, paidCents: 1000, status: 'PAID' }], 1000, '1');
        expect(r.allocations).toEqual([]);
        expect(r.unallocatedCents).toBe(1000);
    });
});

describe('mascaramento e prontidão da oferta', () => {
    it('mascara serial/IMEI mantendo só o final', () => {
        expect(maskIdentifier('356938035643809')).toBe('***********3809');
        expect(maskIdentifier(null)).toBeNull();
    });
    it('oferta só liga com juros, prazo, entrada e jurídico aprovados', () => {
        expect(() => assertOfferReady({ monthlyInterestBps: null, maxInstallments: 12, minDownPaymentBps: 1000, legalTemplateStatus: 'approved' })).toThrow();
        expect(() => assertOfferReady({ monthlyInterestBps: 300, maxInstallments: 12, minDownPaymentBps: 1000, legalTemplateStatus: 'legal_template_pending' })).toThrow();
        expect(() => assertOfferReady({ monthlyInterestBps: 300, maxInstallments: 12, minDownPaymentBps: 1000, legalTemplateStatus: 'approved' })).not.toThrow();
    });
    it('catálogo comercial tem exatamente 6 serviços e não inclui INVESTIDOR', () => {
        expect(COMMERCIAL_SERVICE_CODES).toEqual(['CLT', 'AUTONOMO', 'GARANTIA', 'MOTO', 'LIMPA_NOME', 'FINANCIAMENTO_CELULAR']);
        expect(COMMERCIAL_SERVICE_CODES).not.toContain('INVESTIDOR');
    });
});

describe('feature flags', () => {
    it('tudo desligado por padrão', () => {
        const f = getFlags({});
        expect(Object.values(f).every(v => v === false)).toBe(true);
    });
    it('só "true" liga; comandos reais exigem MDM ligado', () => {
        expect(getFlags({ PHONE_FINANCING_ENABLED: '1' }).phoneFinancing).toBe(false);
        expect(getFlags({ PHONE_FINANCING_ENABLED: 'true' }).phoneFinancing).toBe(true);
        expect(getFlags({ APPLE_MDM_REAL_COMMANDS_ENABLED: 'true' }).mdmRealCommands).toBe(false);
        expect(getFlags({ APPLE_MDM_ENABLED: 'true', APPLE_MDM_REAL_COMMANDS_ENABLED: 'true' }).mdmRealCommands).toBe(true);
    });
});
