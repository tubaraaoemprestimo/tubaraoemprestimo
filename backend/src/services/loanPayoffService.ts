import { prisma } from './prisma';

const PAYABLE_STATUSES = ['OPEN', 'LATE', 'AWAITING_CONFIRMATION'] as const;
const ROLLOVER_PROFILES = ['CLT', 'GARANTIA', 'GARANTIA_VEICULO'] as const;

export interface LoanPayoffBalance {
  loanId: string;
  principalBalance: number;
  interestBalance: number;
  feeBalance: number;
  totalPayoffBalance: number;
  cycleChargeBalance: number;
  pendingInstallmentIds: string[];
}

export interface PaymentWaterfallInput {
  paymentAmount: number;
  principalBalance: number;
  interestBalance: number;
  feeBalance: number;
}

export interface PaymentWaterfallResult {
  appliedToFees: number;
  appliedToInterest: number;
  appliedToPrincipal: number;
  unappliedAmount: number;
  remainingFeeBalance: number;
  remainingInterestBalance: number;
  remainingPrincipalBalance: number;
  remainingTotalBalance: number;
}

function money(value: number): number {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}

function applyBucket(paymentLeft: number, balance: number): { applied: number; remainingPayment: number; remainingBalance: number } {
  const applied = money(Math.min(paymentLeft, balance));
  return {
    applied,
    remainingPayment: money(paymentLeft - applied),
    remainingBalance: money(balance - applied),
  };
}

/**
 * Waterfall financeiro oficial:
 * 1) Multas/mora
 * 2) Juros
 * 3) Capital principal
 */
export function applyPaymentWaterfall(input: PaymentWaterfallInput): PaymentWaterfallResult {
  let paymentLeft = money(input.paymentAmount);
  let feeBalance = money(input.feeBalance);
  let interestBalance = money(input.interestBalance);
  let principalBalance = money(input.principalBalance);

  if (paymentLeft <= 0) {
    return {
      appliedToFees: 0,
      appliedToInterest: 0,
      appliedToPrincipal: 0,
      unappliedAmount: 0,
      remainingFeeBalance: feeBalance,
      remainingInterestBalance: interestBalance,
      remainingPrincipalBalance: principalBalance,
      remainingTotalBalance: money(feeBalance + interestBalance + principalBalance),
    };
  }

  const feeStep = applyBucket(paymentLeft, feeBalance);
  paymentLeft = feeStep.remainingPayment;
  feeBalance = feeStep.remainingBalance;

  const interestStep = applyBucket(paymentLeft, interestBalance);
  paymentLeft = interestStep.remainingPayment;
  interestBalance = interestStep.remainingBalance;

  const principalStep = applyBucket(paymentLeft, principalBalance);
  paymentLeft = principalStep.remainingPayment;
  principalBalance = principalStep.remainingBalance;

  return {
    appliedToFees: feeStep.applied,
    appliedToInterest: interestStep.applied,
    appliedToPrincipal: principalStep.applied,
    unappliedAmount: paymentLeft,
    remainingFeeBalance: feeBalance,
    remainingInterestBalance: interestBalance,
    remainingPrincipalBalance: principalBalance,
    remainingTotalBalance: money(feeBalance + interestBalance + principalBalance),
  };
}

/**
 * Fonte de verdade transitória do saldo exigível usando schema atual.
 *
 * Regras:
 * - principalBalance vem de Loan.remainingAmount (capital vivo já amortizado pelos fluxos atuais).
 * - feeBalance soma lateFeeAmount/fineAccumulated das cobranças em aberto.
 * - interestBalance soma amount das cobranças de juros em aberto em contratos de rolagem
 *   (CLT/GARANTIA/GARANTIA_VEICULO ou installment.isInterestPayment).
 * - Em AUTONOMO/Comércio, installment.amount é agenda/diária operacional; capital vivo fica em remainingAmount.
 */
export async function getLoanPayoffBalance(loanId: string): Promise<LoanPayoffBalance> {
  const loan = await prisma.loan.findUnique({
    where: { id: loanId },
    include: {
      loanRequest: { select: { profileType: true } },
      installments: {
        where: { status: { in: [...PAYABLE_STATUSES] } },
        orderBy: { dueDate: 'asc' },
      },
    },
  });

  if (!loan) throw new Error('Contrato não encontrado');

  const profileType = loan.loanRequest?.profileType || '';
  const isRollover = (ROLLOVER_PROFILES as readonly string[]).includes(profileType);
  const principalBalance = money(Number(loan.remainingAmount ?? loan.principalAmount ?? loan.amount ?? 0));

  let interestBalance = 0;
  let feeBalance = 0;
  const pendingInstallmentIds: string[] = [];

  for (const installment of loan.installments || []) {
    pendingInstallmentIds.push(installment.id);
    feeBalance = money(feeBalance + Number(installment.lateFeeAmount || installment.fineAccumulated || 0));

    if (isRollover || installment.isInterestPayment) {
      interestBalance = money(interestBalance + Number(installment.amount || 0));
    }
  }

  const cycleChargeBalance = money(interestBalance + feeBalance);
  const totalPayoffBalance = money(principalBalance + cycleChargeBalance);

  return {
    loanId,
    principalBalance,
    interestBalance,
    feeBalance,
    totalPayoffBalance,
    cycleChargeBalance,
    pendingInstallmentIds,
  };
}

export default {
  getLoanPayoffBalance,
  applyPaymentWaterfall,
};
