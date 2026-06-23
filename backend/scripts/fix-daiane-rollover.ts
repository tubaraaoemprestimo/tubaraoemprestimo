#!/usr/bin/env tsx
/**
 * Correção isolada Daiane — rolagem não amortiza principal.
 *
 * DRY-RUN é padrão. Sem --apply, nada grava.
 *
 * Uso (a partir de backend/):
 *   npx tsx scripts/fix-daiane-rollover.ts
 *   npx tsx scripts/fix-daiane-rollover.ts --apply
 *   npx tsx scripts/fix-daiane-rollover.ts --loan-id <id> --apply
 *   npx tsx scripts/fix-daiane-rollover.ts --customer "Daiane"
 *
 * Faz, em transação:
 *   - Loan.principalAmount = 1000
 *   - Loan.remainingAmount = 1000
 *   - marca parcela PAID de ~300 como isInterestPayment=true
 *   - garante próxima parcela de juros R$300 em aberto no vencimento informado/default
 *   - ajusta nextPaymentDate para próximo ciclo
 *   - registra Transaction de rastreio sem criar migração
 */

import { prisma } from '../src/services/prisma';

interface Options {
  apply: boolean;
  loanId?: string;
  customerQuery: string;
  principal: number;
  interest: number;
  nextDueDate?: Date;
}

function parseArgs(argv: string[]): Options {
  const opts: Options = {
    apply: false,
    customerQuery: 'Daiane',
    principal: 1000,
    interest: 300,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--apply') opts.apply = true;
    else if (arg === '--loan-id') opts.loanId = argv[++i];
    else if (arg.startsWith('--loan-id=')) opts.loanId = arg.slice('--loan-id='.length);
    else if (arg === '--customer') opts.customerQuery = argv[++i] || opts.customerQuery;
    else if (arg.startsWith('--customer=')) opts.customerQuery = arg.slice('--customer='.length);
    else if (arg === '--principal') opts.principal = Number(argv[++i]);
    else if (arg.startsWith('--principal=')) opts.principal = Number(arg.slice('--principal='.length));
    else if (arg === '--interest') opts.interest = Number(argv[++i]);
    else if (arg.startsWith('--interest=')) opts.interest = Number(arg.slice('--interest='.length));
    else if (arg === '--next-due') opts.nextDueDate = new Date(argv[++i]);
    else if (arg.startsWith('--next-due=')) opts.nextDueDate = new Date(arg.slice('--next-due='.length));
    else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
  }
  return opts;
}

function printHelp(): void {
  console.log(`Correção Daiane rollover

Uso:
  npx tsx scripts/fix-daiane-rollover.ts                         DRY-RUN
  npx tsx scripts/fix-daiane-rollover.ts --apply                 aplica
  npx tsx scripts/fix-daiane-rollover.ts --loan-id <id> --apply  aplica em contrato específico
  npx tsx scripts/fix-daiane-rollover.ts --next-due 2026-07-10   ajusta vencimento aberto

Defaults: customer="Daiane", principal=1000, interest=300.
`);
}

function addMonthsPreservingDay(date: Date, months = 1): Date {
  const day = date.getDate();
  const next = new Date(date);
  next.setDate(1);
  next.setMonth(next.getMonth() + months);
  const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
  next.setDate(Math.min(day, lastDay));
  return next;
}

function defaultNextDueDate(): Date {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return addMonthsPreservingDay(d, 1);
}

async function findLoan(opts: Options): Promise<any> {
  if (opts.loanId) {
    return prisma.loan.findUnique({
      where: { id: opts.loanId },
      include: { customer: true, loanRequest: true, installments: { orderBy: { dueDate: 'asc' } } },
    });
  }

  const loans = await prisma.loan.findMany({
    where: {
      customer: { name: { contains: opts.customerQuery, mode: 'insensitive' } },
      status: { in: ['ACTIVE', 'DEFAULT', 'APPROVED'] },
    },
    include: { customer: true, loanRequest: true, installments: { orderBy: { dueDate: 'asc' } } },
    orderBy: { createdAt: 'desc' },
  });

  if (loans.length > 1) {
    console.log('[Daiane] Mais de um contrato encontrado. Use --loan-id para evitar ambiguidade:');
    for (const loan of loans) {
      console.log(`  ${loan.id} | ${loan.customer?.name} | status=${loan.status} | principal=${loan.principalAmount} | remaining=${loan.remainingAmount}`);
    }
    return null;
  }
  return loans[0] || null;
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  if (!Number.isFinite(opts.principal) || opts.principal <= 0) throw new Error('--principal inválido');
  if (!Number.isFinite(opts.interest) || opts.interest <= 0) throw new Error('--interest inválido');

  const loan = await findLoan(opts);
  if (!loan) throw new Error('Contrato Daiane não encontrado ou ambíguo. Use --loan-id.');

  const profileType = loan.loanRequest?.profileType || '';
  if (!['CLT', 'GARANTIA', 'GARANTIA_VEICULO'].includes(profileType)) {
    throw new Error(`Contrato ${loan.id} não é rollover (${profileType}). Abortado.`);
  }

  const paidInterest = loan.installments.find((inst: any) =>
    inst.status === 'PAID' && Math.abs(Number(inst.amount) - opts.interest) <= 1
  );
  const openInterest = loan.installments.find((inst: any) =>
    ['OPEN', 'LATE', 'AWAITING_CONFIRMATION'].includes(inst.status) && Math.abs(Number(inst.amount) - opts.interest) <= 1
  );
  const nextDueDate = opts.nextDueDate || openInterest?.dueDate || defaultNextDueDate();
  const nextPaymentDate = addMonthsPreservingDay(nextDueDate, 1);

  const plan = {
    apply: opts.apply,
    loanId: loan.id,
    customer: loan.customer?.name,
    profileType,
    before: {
      principalAmount: Number(loan.principalAmount),
      remainingAmount: Number(loan.remainingAmount),
      nextPaymentDate: loan.nextPaymentDate,
    },
    after: {
      principalAmount: opts.principal,
      remainingAmount: opts.principal,
      paidInterestInstallmentId: paidInterest?.id || null,
      openInterestInstallmentId: openInterest?.id || null,
      openInterestDueDate: nextDueDate,
      nextPaymentDate,
    },
  };

  console.log(JSON.stringify(plan, null, 2));
  if (!opts.apply) {
    console.log('[Daiane] DRY-RUN — nada gravado. Rode com --apply após backup validado.');
    return;
  }

  await prisma.$transaction(async (tx: any) => {
    await tx.loan.update({
      where: { id: loan.id },
      data: {
        principalAmount: opts.principal,
        remainingAmount: opts.principal,
        nextPaymentDate,
        status: 'ACTIVE',
      },
    });

    if (paidInterest) {
      await tx.installment.update({
        where: { id: paidInterest.id },
        data: { amount: opts.interest, isInterestPayment: true, status: 'PAID' },
      });
    }

    if (openInterest) {
      await tx.installment.update({
        where: { id: openInterest.id },
        data: { amount: opts.interest, dueDate: nextDueDate, status: 'OPEN', isInterestPayment: true },
      });
    } else {
      await tx.installment.create({
        data: { loanId: loan.id, amount: opts.interest, dueDate: nextDueDate, status: 'OPEN', isInterestPayment: true },
      });
    }

    await tx.transaction.create({
      data: {
        type: 'IN',
        description: `Correção Daiane rollover contrato:${loan.id} principal:${opts.principal} juros:${opts.interest}`,
        amount: 0,
        category: 'FEE',
        date: new Date(),
      },
    });
  });

  console.log('[Daiane] Correção aplicada com sucesso.');
}

main()
  .catch((err) => {
    console.error('[Daiane] ERRO:', err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => {});
  });
