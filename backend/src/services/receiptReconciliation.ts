/**
 * Conciliação de comprovantes PENDENTES cuja parcela já está PAGA.
 * Somente leitura: classifica, não altera nada. A ação (rejeitar com motivo)
 * usa a rota de rejeição existente, uma por vez, com confirmação do admin.
 *
 * Regras (conservadoras — na dúvida, ANALISE_MANUAL):
 *  - DIVERGENCIA_CONTRATO: comprovante de cliente diferente do dono do contrato.
 *  - POSSIVEL_DUPLICIDADE: outro comprovante PENDENTE da mesma parcela, mesmo valor,
 *    mesmo dia, enviado antes (o mesmo envio repetido). Valor igual em dias
 *    diferentes NÃO conta como duplicidade.
 *  - JA_CONCILIADO: a parcela tem comprovante APROVADO com exatamente este valor.
 *  - PAGAMENTO_EXCEDENTE: já há aprovação na parcela e este valor é maior que a parcela.
 *  - PAGAMENTO_PARCIAL: valor menor que a parcela.
 *  - DIVERGENCIA_VALOR: valor maior que a parcela, sem aprovação na parcela.
 *  - ANALISE_MANUAL: parcela com valor 0 (juros de rolagem antigos) ou sem evidência suficiente.
 */
export type ReconClass =
    | 'DIVERGENCIA_CONTRATO' | 'POSSIVEL_DUPLICIDADE' | 'JA_CONCILIADO'
    | 'PAGAMENTO_EXCEDENTE' | 'PAGAMENTO_PARCIAL' | 'DIVERGENCIA_VALOR' | 'ANALISE_MANUAL';

export const RECON_REASON: Record<ReconClass, string> = {
    DIVERGENCIA_CONTRATO: 'Comprovante de cliente diferente do dono do contrato',
    POSSIVEL_DUPLICIDADE: 'Mesmo valor enviado de novo no mesmo dia para a mesma parcela',
    JA_CONCILIADO: 'A parcela já tem comprovante aprovado com este mesmo valor',
    PAGAMENTO_EXCEDENTE: 'Parcela já paga e o valor é maior que a parcela',
    PAGAMENTO_PARCIAL: 'Valor menor que a parcela',
    DIVERGENCIA_VALOR: 'Valor maior que a parcela, sem aprovação registrada',
    ANALISE_MANUAL: 'Sem evidência suficiente para classificar automaticamente',
};

type Receipt = { id: string; amount: number; createdAt: Date | string; customerId: string; installmentId: string; status: string };
type Installment = { id: string; amount: number; status: string; loanOwnerId: string };

const sameDay = (a: Date | string, b: Date | string) => new Date(a).toISOString().slice(0, 10) === new Date(b).toISOString().slice(0, 10);
const eq = (a: number, b: number) => Math.abs(Number(a) - Number(b)) < 0.005;

/** Pura: classifica um comprovante pendente a partir dos outros comprovantes da mesma parcela. */
export function classifyReceipt(r: Receipt, inst: Installment, sameInstallment: Receipt[]): ReconClass {
    if (r.customerId !== inst.loanOwnerId) return 'DIVERGENCIA_CONTRATO';
    const others = sameInstallment.filter(o => o.id !== r.id);
    const repeatedBefore = others.some(o => o.status === 'PENDING' && eq(o.amount, r.amount) && sameDay(o.createdAt, r.createdAt)
        && (new Date(o.createdAt).getTime() < new Date(r.createdAt).getTime() || (new Date(o.createdAt).getTime() === new Date(r.createdAt).getTime() && o.id < r.id)));
    if (repeatedBefore) return 'POSSIVEL_DUPLICIDADE';
    const approved = others.filter(o => o.status === 'APPROVED');
    if (approved.some(o => eq(o.amount, r.amount))) return 'JA_CONCILIADO';
    if (Number(inst.amount) <= 0) return 'ANALISE_MANUAL';
    if (approved.length && Number(r.amount) > Number(inst.amount)) return 'PAGAMENTO_EXCEDENTE';
    if (Number(r.amount) < Number(inst.amount)) return 'PAGAMENTO_PARCIAL';
    if (Number(r.amount) > Number(inst.amount)) return 'DIVERGENCIA_VALOR';
    return 'ANALISE_MANUAL';
}

/** Monta o relatório (somente leitura). */
export async function buildReconciliationReport(db: any) {
    // PaymentReceipt não tem relação Prisma com Installment: duas consultas.
    const allPending = await db.paymentReceipt.findMany({ where: { status: 'PENDING' }, orderBy: { createdAt: 'asc' } });
    if (!allPending.length) return [];
    const paid = await db.installment.findMany({
        where: { id: { in: [...new Set(allPending.map((r: any) => r.installmentId))] }, status: 'PAID' },
        select: { id: true },
    });
    const paidIds = new Set(paid.map((i: any) => i.id));
    const pending = allPending.filter((r: any) => paidIds.has(r.installmentId));
    if (!pending.length) return [];
    const instIds = [...paidIds];
    const [installments, siblings] = await Promise.all([
        db.installment.findMany({
            where: { id: { in: instIds } },
            select: { id: true, amount: true, status: true, dueDate: true, paidAt: true, loanId: true,
                loan: { select: { id: true, status: true, customerId: true, customer: { select: { name: true } } } } },
        }),
        db.paymentReceipt.findMany({ where: { installmentId: { in: instIds } } }),
    ]);
    const instById = new Map(installments.map((i: any) => [i.id, i]));
    const byInst = new Map<string, any[]>();
    for (const s of siblings) byInst.set(s.installmentId, [...(byInst.get(s.installmentId) || []), s]);

    return pending.map((r: any) => {
        const i: any = instById.get(r.installmentId);
        const cls = classifyReceipt(r, { id: i.id, amount: i.amount, status: i.status, loanOwnerId: i.loan.customerId }, byInst.get(r.installmentId) || []);
        const approvedOnInstallment = (byInst.get(r.installmentId) || []).filter((o: any) => o.status === 'APPROVED').reduce((s: number, o: any) => s + Number(o.amount), 0);
        return {
            receiptId: r.id, classification: cls, reason: RECON_REASON[cls],
            customerName: i.loan.customer?.name || '', loanId: i.loanId, loanStatus: i.loan.status,
            installmentId: i.id, installmentAmount: Number(i.amount), installmentDueDate: i.dueDate, installmentPaidAt: i.paidAt,
            receiptAmount: Number(r.amount), approvedOnInstallment, submittedAt: r.createdAt, receiptUrl: r.receiptUrl,
        };
    });
}
