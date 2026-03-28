/**
 * installmentEngine.ts — Motor de Geração de Parcelas
 *
 * Regras implementadas:
 * - MONTHLY  (CLT, GARANTIA, LIMPA_NOME, MOTO): 1 parcela/mês na data de preferência do cliente
 * - DAILY    (AUTONOMO / Capital de Giro / Comércio): 1 parcela/dia em dias úteis (seg–sáb)
 *   • Domingos são PULADOS no calendário de vencimentos
 *   • Mas multas por atraso acumulam INCLUSIVE no domingo se o cliente já estiver inadimplente
 *
 * Multa por atraso (Regra do Domingo para inadimplentes):
 *   - R$20 por dia corrido de atraso (configável por lateFeeFixed)
 *   - Se o cliente AUTONOMO não pagar na sexta, sábado é D+1, DOMINGO é D+2 (multa acumula),
 *     segunda-feira seria a próxima parcela normal
 *
 * Inputs esperados no momento de ativação do contrato:
 *   - loanId, customerId, profileType
 *   - amount: valor total do empréstimo (já com juros incluídos ou sem — conforme billingType)
 *   - installmentsCount: número de parcelas
 *   - billingType: 'DAILY' | 'MONTHLY'
 *   - startDate: data de liberação do crédito (dia 0)
 *   - preferredDueDay: 1–28 (apenas para MONTHLY)
 *   - interestRate: taxa de juros já embutida no valor da parcela (informativo)
 */

export type BillingType = 'DAILY' | 'MONTHLY';

export interface GenerateInstallmentsInput {
  loanId: string;
  amount: number;           // Valor total a ser parcelado
  installmentsCount: number;
  billingType: BillingType;
  startDate: Date;          // Data de ativação do contrato
  preferredDueDay?: number; // 1–28, só para MONTHLY
  interestRate?: number;    // % mensal (informativo, já embutido no amount)
}

export interface InstallmentRecord {
  id: string;
  loan_id: string;
  due_date: Date;
  amount: number;           // Valor nominal da parcela
  status: 'OPEN';
  late_fee_amount: number;  // Multa acumulada pelo CRON (começa em 0)
  fine_accumulated: number; // Alias para somatorio de multas (começa em 0)
  days_overdue: number;     // Dias de atraso (atualizado pelo CRON)
  created_at: Date;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Retorna true se a data cair num domingo */
export function isSunday(date: Date): boolean {
  return date.getDay() === 0;
}

/** Avança 'days' dias úteis (seg–sáb) a partir de 'start' */
export function addBusinessDays(start: Date, days: number): Date {
  const result = new Date(start);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    if (!isSunday(result)) added++;
  }
  return result;
}

/** Próximo dia do mês igual a 'day', a partir de 'after' (inclusive) */
function nextMonthlyDueDate(after: Date, preferredDay: number): Date {
  const d = new Date(after);
  d.setDate(preferredDay);
  d.setHours(0, 0, 0, 0);
  // Se a data já passou, avança um mês
  if (d <= after) {
    d.setMonth(d.getMonth() + 1);
  }
  return d;
}

/** Gera ID simples para parcela */
function makeId(loanId: string, index: number): string {
  return `inst_${loanId}_${String(index).padStart(3, '0')}_${Date.now()}`;
}

// ── Motor principal ───────────────────────────────────────────────────────────

/**
 * Gera o array de parcelas de acordo com o perfil do contrato.
 * Não persiste nada — retorna os records prontos para INSERT.
 */
export function generateInstallments(input: GenerateInstallmentsInput): InstallmentRecord[] {
  const {
    loanId,
    amount,
    installmentsCount,
    billingType,
    startDate,
    preferredDueDay = 10,
  } = input;

  if (installmentsCount <= 0) throw new Error('installmentsCount deve ser > 0');

  const installmentAmount = +(amount / installmentsCount).toFixed(2);
  // Correção de arredondamento: a última parcela absorve centavos residuais
  const lastInstallmentAmount = +(amount - installmentAmount * (installmentsCount - 1)).toFixed(2);

  const records: InstallmentRecord[] = [];
  const baseDate = new Date(startDate);
  baseDate.setHours(0, 0, 0, 0);

  if (billingType === 'DAILY') {
    // ── AUTONOMO / Capital de Giro / Comércio ──────────────────────────────
    // 1ª parcela = próximo dia útil após liberação (D+1 útil)
    let dueDate = addBusinessDays(baseDate, 1);

    for (let i = 0; i < installmentsCount; i++) {
      records.push(makeRecord(loanId, i, dueDate,
        i === installmentsCount - 1 ? lastInstallmentAmount : installmentAmount
      ));

      if (i < installmentsCount - 1) {
        dueDate = addBusinessDays(dueDate, 1);
      }
    }
  } else {
    // ── MONTHLY: CLT, GARANTIA, LIMPA_NOME, MOTO ──────────────────────────
    let dueDate = nextMonthlyDueDate(baseDate, preferredDueDay);

    for (let i = 0; i < installmentsCount; i++) {
      records.push(makeRecord(loanId, i, dueDate,
        i === installmentsCount - 1 ? lastInstallmentAmount : installmentAmount
      ));

      if (i < installmentsCount - 1) {
        // Próximo mês, mesmo dia
        const next = new Date(dueDate);
        next.setMonth(next.getMonth() + 1);
        dueDate = next;
      }
    }
  }

  return records;
}

function makeRecord(
  loanId: string,
  index: number,
  dueDate: Date,
  amount: number
): InstallmentRecord {
  return {
    id: makeId(loanId, index),
    loan_id: loanId,
    due_date: new Date(dueDate),
    amount,
    status: 'OPEN',
    late_fee_amount: 0,
    fine_accumulated: 0,
    days_overdue: 0,
    created_at: new Date(),
  };
}

// ── Multa por Atraso (atualizada pelo CRON, não pelo motor de geração) ────────

/**
 * Calcula o total de multa acumulada para uma parcela em atraso.
 *
 * Regras:
 * - Multa acumula em dias CORRIDOS (inclusive domingos) para todos os perfis
 * - Mesmo para AUTONOMO: o domingo não é dia de parcela, mas É dia de multa
 * - R$20/dia (ou lateFeeFixed configurado)
 *
 * @param dueDate       - Data de vencimento da parcela
 * @param referenceDate - Data de referência (hoje — do CRON)
 * @param lateFeeFixed  - Multa diária em R$ (default: 20)
 * @returns { daysOverdue, fineTotal }
 */
export function calculateLateFee(
  dueDate: Date,
  referenceDate: Date,
  lateFeeFixed = 20
): { daysOverdue: number; fineTotal: number } {
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  const ref = new Date(referenceDate);
  ref.setHours(0, 0, 0, 0);

  if (ref <= due) return { daysOverdue: 0, fineTotal: 0 };

  const diffMs = ref.getTime() - due.getTime();
  const daysOverdue = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const fineTotal = +(daysOverdue * lateFeeFixed).toFixed(2);

  return { daysOverdue, fineTotal };
}

/**
 * Determina o billingType correto baseado no profileType da solicitação.
 */
export function billingTypeFromProfile(
  profileType: string | undefined | null
): BillingType {
  // Autônomo e Capital de Giro = cobranças diárias
  if (profileType === 'AUTONOMO') return 'DAILY';
  // Todos os demais = mensal
  return 'MONTHLY';
}
