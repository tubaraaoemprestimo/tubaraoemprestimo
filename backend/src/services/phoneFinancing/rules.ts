/**
 * Regras puras do financiamento de celulares (sem banco). Dinheiro sempre em
 * centavos inteiros; taxas em basis points (300 = 3,00% ao mês).
 *
 * Independente de Loan/Installment: nada aqui toca os empréstimos.
 */

export const COMMERCIAL_SERVICE_CODES = ['CLT', 'AUTONOMO', 'GARANTIA', 'MOTO', 'LIMPA_NOME', 'FINANCIAMENTO_CELULAR'] as const;
export const PHONE_SERVICE_CODE = 'FINANCIAMENTO_CELULAR';

export type ApplicationStatus =
    | 'draft' | 'submitted' | 'under_review' | 'awaiting_documents' | 'approved' | 'rejected'
    | 'contract_pending' | 'awaiting_down_payment' | 'ready_for_handover' | 'active' | 'cancelled' | 'closed';

const TRANSITIONS: Record<ApplicationStatus, ApplicationStatus[]> = {
    draft: ['submitted', 'cancelled'],
    submitted: ['under_review', 'awaiting_documents', 'rejected', 'cancelled'],
    under_review: ['awaiting_documents', 'approved', 'rejected', 'cancelled'],
    awaiting_documents: ['under_review', 'rejected', 'cancelled'],
    approved: ['contract_pending', 'cancelled'],
    contract_pending: ['awaiting_down_payment', 'ready_for_handover', 'cancelled'],
    awaiting_down_payment: ['ready_for_handover', 'cancelled'],
    ready_for_handover: ['active', 'cancelled'],
    active: ['closed'],
    rejected: [],
    cancelled: [],
    closed: [],
};

export const APPLICATION_STATUSES = Object.keys(TRANSITIONS) as ApplicationStatus[];

export function canTransition(from: string, to: string): boolean {
    return (TRANSITIONS as Record<string, string[]>)[from]?.includes(to) ?? false;
}

function addMonthsClamped(base: Date, months: number): Date {
    const d = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + months, 1, base.getUTCHours(), base.getUTCMinutes()));
    const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
    d.setUTCDate(Math.min(base.getUTCDate(), lastDay));
    return d;
}

export interface ScheduleInput {
    financedCents: number;
    installments: number;
    monthlyInterestBps: number;
    firstDueDate: Date;
}

/**
 * Tabela Price. Juros 0 = divisão simples. Arredondamento em centavos; a
 * diferença de arredondamento vai para a última parcela.
 */
export function buildSchedule({ financedCents, installments, monthlyInterestBps, firstDueDate }: ScheduleInput) {
    if (!Number.isInteger(financedCents) || financedCents <= 0) throw new Error('Valor financiado inválido');
    if (!Number.isInteger(installments) || installments <= 0 || installments > 60) throw new Error('Número de parcelas inválido');
    if (!Number.isInteger(monthlyInterestBps) || monthlyInterestBps < 0) throw new Error('Taxa inválida');
    if (!(firstDueDate instanceof Date) || Number.isNaN(firstDueDate.getTime())) throw new Error('Data do 1º vencimento inválida');

    const i = monthlyInterestBps / 10000;
    const pmt = i === 0 ? financedCents / installments : (financedCents * i) / (1 - Math.pow(1 + i, -installments));
    // Sem juros a soma tem que dar exatamente o financiado.
    const regular = i === 0 ? Math.floor(pmt) : Math.round(pmt);
    const total = i === 0 ? financedCents : Math.round(pmt * installments);

    return Array.from({ length: installments }, (_, k) => ({
        number: k + 1,
        dueDate: addMonthsClamped(firstDueDate, k),
        amountCents: k === installments - 1 ? total - regular * (installments - 1) : regular,
    }));
}

export interface InstallmentState { id: string; number: number; amountCents: number; paidCents: number; status: string }

/**
 * Aloca um pagamento confirmado SOMENTE na parcela alvo. Nunca quita outras
 * parcelas por tabela (evita o problema de "quitação em lote" dos empréstimos).
 * Excedente fica não alocado para revisão humana.
 */
export function allocatePayment(installments: InstallmentState[], amountCents: number, targetInstallmentId: string) {
    const target = installments.find(i => i.id === targetInstallmentId);
    if (!target || ['PAID', 'CANCELLED'].includes(target.status)) {
        return { allocations: [] as { installmentId: string; amountCents: number; newPaidCents: number; newStatus: string }[], unallocatedCents: amountCents };
    }
    const due = target.amountCents - target.paidCents;
    const applied = Math.min(due, amountCents);
    const newPaidCents = target.paidCents + applied;
    return {
        allocations: [{
            installmentId: target.id,
            amountCents: applied,
            newPaidCents,
            newStatus: newPaidCents >= target.amountCents ? 'PAID' : 'PARTIAL',
        }],
        unallocatedCents: amountCents - applied,
    };
}

export function maskIdentifier(value?: string | null): string | null {
    if (!value) return null;
    const s = String(value);
    return s.length <= 4 ? '****' : '*'.repeat(s.length - 4) + s.slice(-4);
}

export function maskCpf(cpf?: string | null): string | null {
    const d = String(cpf || '').replace(/\D/g, '');
    return d.length === 11 ? `***.${d.slice(3, 6)}.***-**` : null;
}

export class OfferNotReadyError extends Error {
    code = 'OFFER_NOT_READY';
}

/** A oferta só pode ser ligada com parâmetros comerciais e contrato jurídico aprovados. */
export function assertOfferReady(s: { monthlyInterestBps: number | null; maxInstallments: number | null; minDownPaymentBps: number | null; legalTemplateStatus: string }) {
    const missing: string[] = [];
    if (s.monthlyInterestBps == null) missing.push('taxa de juros');
    if (!s.maxInstallments) missing.push('prazo máximo');
    if (s.minDownPaymentBps == null) missing.push('entrada mínima');
    if (s.legalTemplateStatus !== 'approved') missing.push('contrato aprovado pelo jurídico');
    if (missing.length) throw new OfferNotReadyError(`Oferta não pode ser ligada. Falta: ${missing.join(', ')}.`);
}

export function protocolFor(date: Date, random: string): string {
    const ymd = date.toISOString().slice(0, 10).replace(/-/g, '');
    return `CEL-${ymd}-${random.slice(0, 6).toUpperCase()}`;
}
