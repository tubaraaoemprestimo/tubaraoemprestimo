/**
 * audit-interest-calculation.ts — AUDITORIA SOMENTE-LEITURA (dry-run)
 *
 * Bugfix spec: "correcao-calculo-juros-parcelas" — Task 4.1.
 *
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  ESTE SCRIPT NÃO ESCREVE NADA NO BANCO.                                    ║
 * ║  Usa o Prisma client APENAS para leitura (findMany/select). NENHUM         ║
 * ║  update/create/delete e NENHUM `prisma db push`. É um diagnóstico.         ║
 * ║                                                                            ║
 * ║  A CORREÇÃO dos dados (backfill que restaura remainingAmount e marca       ║
 * ║  isInterestPayment) é responsabilidade da Task 4.2:                        ║
 * ║      backend/scripts/backfill-interest-rollover.ts                         ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * OBJETIVO: varrer TODOS os contratos (`Loan`) e solicitações (`LoanRequest`)
 * e produzir um RELATÓRIO legível (pt-BR) dos contratos AFETADOS, em três
 * categorias independentes (um contrato pode cair em mais de uma):
 *
 *   [C1] Rolagem amortizada indevidamente (caso Patricia)
 *        CLT/GARANTIA/GARANTIA_VEICULO com `remainingAmount < principalAmount`.
 *        A rolagem de juros NÃO amortiza — o saldo devedor deveria permanecer
 *        igual ao principal. Esperado após backfill: remainingAmount = principalAmount.
 *
 *   [C2] Pagamento de juros contado como parcela / UI "N/N pagas"
 *        Pagamentos de juros de rolagem marcados `status='PAID'` (valor ≈
 *        principalAmount × taxa) que entram no `paidCount`, e contratos onde
 *        `paidCount == total` com `remainingAmount > 0` (invariante de UI violado).
 *
 *   [C3] Divergência de cobrança (10% antigo vs fórmula oficial do engine)
 *        Para parcelas em atraso, compara o `valor_com_juros` da fórmula ANTIGA
 *        (10% a.m. prorrateado, replicada localmente abaixo) com o valor OFICIAL
 *        recalculado por `interestEngine.computeCharge`, mostrando a diferença.
 *
 * USO (a partir de backend/):
 *   npx tsx scripts/audit-interest-calculation.ts            # relatório pt-BR no console
 *   npx tsx scripts/audit-interest-calculation.ts --json     # saída estruturada JSON
 *   npx tsx scripts/audit-interest-calculation.ts --limit 50 # limita a listagem a 50 contratos
 *
 * Requirements validados (diagnóstico): 1.1, 1.9, 2.1, 2.9, 2.10
 */

import { prisma } from '../src/services/prisma';
import {
  computeCharge,
  resolveMonthlyRate,
  ROLLOVER_PROFILES,
  DEFAULT_MONTHLY_RATE,
} from '../src/services/interestEngine';

// ───────────────────────────────────────────────────────────────────────────
// Constantes / helpers
// ───────────────────────────────────────────────────────────────────────────

const MS_PER_DAY = 1000 * 60 * 60 * 24;

/** Status de parcela considerados "em aberto" (passíveis de atraso/cobrança). */
const OPEN_STATUSES = ['OPEN', 'LATE', 'AWAITING_CONFIRMATION'];

/** Conjunto dos perfis de rolagem (reuso do conceito do engine). */
const ROLLOVER_SET = new Set<string>(ROLLOVER_PROFILES as readonly string[]);

/**
 * Réplica FIEL do cálculo ANTIGO de produção (taxa hardcoded de 10% a.m.).
 * Fonte: backend/src/services/collectionAutomationService.ts
 *   function calculateOverdueAmount(originalAmount, daysOverdue) {
 *     const monthsOverdue = daysOverdue / 30;
 *     const interestRate = 0.10; // 10% ao mês
 *     return originalAmount * (1 + (interestRate * monthsOverdue));
 *   }
 * Mantida aqui SOMENTE para calcular a diferença vs a fórmula oficial (C3).
 */
function legacyOverdueAmount(originalAmount: number, daysOverdue: number): number {
  const monthsOverdue = daysOverdue / 30;
  const interestRate = 0.1; // 10% ao mês (defeito 1.1)
  return originalAmount * (1 + interestRate * monthsOverdue);
}

/**
 * Normaliza uma taxa que pode estar em percentual (30 = 30%) ou fração (0.30).
 * Réplica do helper de collectionAutomationService.normalizeRate (não exportado).
 */
function normalizeRate(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value) || value <= 0) return null;
  return value > 1 ? value / 100 : value;
}

/** Início do dia em UTC (timestamp ms). */
function startOfUTCDay(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/** Dias de atraso (>= 0) entre dueDate e hoje, em dias UTC corridos. */
function daysOverdueUTC(dueDate: Date, today: Date): number {
  const diff = Math.floor((startOfUTCDay(today) - startOfUTCDay(dueDate)) / MS_PER_DAY);
  return diff > 0 ? diff : 0;
}

/** Formata em moeda brasileira (R$ 1.234,56). */
function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Resolve o profileType de um contrato de forma resiliente (req 2.13):
 *   LoanRequest.profileType → flags isService/isInvestment → 'DESCONHECIDO'.
 */
function resolveProfileType(loan: any): string {
  const fromRequest = loan?.loanRequest?.profileType;
  if (fromRequest) return String(fromRequest);
  if (loan?.isService || loan?.loanRequest?.isService) return 'LIMPA_NOME';
  if (loan?.isInvestment || loan?.loanRequest?.isInvestment) return 'INVESTIDOR';
  return 'DESCONHECIDO';
}

/**
 * Resolve a taxa mensal do contrato pela cascata oficial (req 2.1), reutilizando
 * `resolveMonthlyRate` do engine:
 *   contrato → cliente (lateInterestMonthly ?? monthlyInterestRate) → SystemSetting → 0.30.
 */
function resolveLoanRate(loan: any, systemSettingRate: number | null): number {
  return resolveMonthlyRate({
    contractRate: normalizeRate(loan?.interestRate),
    customerRate: normalizeRate(
      loan?.customer?.lateInterestMonthly ?? loan?.customer?.monthlyInterestRate
    ),
    systemSettingRate,
  });
}

// ───────────────────────────────────────────────────────────────────────────
// CLI args
// ───────────────────────────────────────────────────────────────────────────

interface CliOptions {
  json: boolean;
  limit: number | null;
  help: boolean;
}

function parseArgs(argv: string[]): CliOptions {
  const opts: CliOptions = { json: false, limit: null, help: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--json') opts.json = true;
    else if (arg === '--help' || arg === '-h') opts.help = true;
    else if (arg === '--limit') {
      const n = Number(argv[i + 1]);
      if (Number.isFinite(n) && n > 0) opts.limit = Math.floor(n);
      i++;
    } else if (arg.startsWith('--limit=')) {
      const n = Number(arg.split('=')[1]);
      if (Number.isFinite(n) && n > 0) opts.limit = Math.floor(n);
    }
  }
  return opts;
}

function printHelp(): void {
  console.log(`
AUDITORIA do cálculo de juros / rolagem (SOMENTE LEITURA — não escreve nada).

Uso (a partir de backend/):
  npx tsx scripts/audit-interest-calculation.ts            Relatório pt-BR no console
  npx tsx scripts/audit-interest-calculation.ts --json     Saída estruturada (JSON)
  npx tsx scripts/audit-interest-calculation.ts --limit N  Limita a listagem a N contratos
  npx tsx scripts/audit-interest-calculation.ts --help     Esta ajuda

A correção dos dados é a Task 4.2 (scripts/backfill-interest-rollover.ts).
`);
}

// ───────────────────────────────────────────────────────────────────────────
// Tipos do relatório
// ───────────────────────────────────────────────────────────────────────────

interface OverdueDivergence {
  installmentId: string;
  dueDate: string;
  daysOverdue: number;
  baseAmount: number;
  legacyCharge: number; // valor_com_juros pela fórmula antiga (10%)
  officialCharge: number; // valor_com_juros oficial (interestEngine)
  difference: number; // oficial - antigo
}

interface SuspectInterestPayment {
  installmentId: string;
  amount: number;
  expectedInterest: number; // principalAmount × taxa
  isInterestPayment: boolean;
  paidAt: string | null;
}

interface AffectedContract {
  loanId: string;
  requestId: string | null;
  customerName: string;
  profileType: string;
  status: string;
  principalAmount: number;
  remainingAmount: number;
  usedMonthlyRate: number;
  categories: string[]; // 'C1' | 'C2' | 'C3'
  // C1
  expectedRemainingAfterBackfill?: number;
  remainingDelta?: number; // principalAmount - remainingAmount
  // C2
  paidCount?: number;
  totalInstallments?: number;
  uiInvariantViolated?: boolean; // paidCount == total && remaining > 0
  suspectInterestPayments?: SuspectInterestPayment[];
  // C3
  overdueDivergences?: OverdueDivergence[];
}

interface AuditReport {
  generatedAt: string;
  totals: {
    loansScanned: number;
    loanRequestsScanned: number;
    affected: number;
    c1_rolloverAmortizedWrong: number;
    c2_interestCountedAsPaid: number;
    c2_uiInvariantViolations: number;
    c3_chargeDivergence: number;
  };
  affectedContracts: AffectedContract[];
}

// ───────────────────────────────────────────────────────────────────────────
// Núcleo da auditoria (SOMENTE LEITURA)
// ───────────────────────────────────────────────────────────────────────────

async function runAudit(opts: CliOptions): Promise<AuditReport> {
  const today = new Date();

  // Taxa padrão do sistema (uma leitura). Read-only.
  let systemSettingRate: number | null = null;
  try {
    const setting = await prisma.systemSetting.findFirst({
      where: { key: 'monthlyInterestRate' },
      select: { value: true },
    });
    systemSettingRate = normalizeRate(setting?.value != null ? Number(setting.value) : null);
  } catch {
    systemSettingRate = null;
  }

  // Contagem das solicitações (LoanRequest) — leitura.
  const loanRequestsScanned: number = await prisma.loanRequest.count();

  // Todos os contratos com relações necessárias — leitura.
  const loans: any[] = await prisma.loan.findMany({
    select: {
      id: true,
      requestId: true,
      status: true,
      amount: true,
      principalAmount: true,
      remainingAmount: true,
      totalInstallments: true,
      installmentsCount: true,
      interestRate: true,
      isService: true,
      isInvestment: true,
      customer: {
        select: {
          name: true,
          monthlyInterestRate: true,
          lateInterestMonthly: true,
        },
      },
      loanRequest: {
        select: {
          profileType: true,
          isService: true,
          isInvestment: true,
        },
      },
      installments: {
        select: {
          id: true,
          amount: true,
          status: true,
          dueDate: true,
          paidAt: true,
          isInterestPayment: true,
        },
      },
    },
  });

  const report: AuditReport = {
    generatedAt: today.toISOString(),
    totals: {
      loansScanned: loans.length,
      loanRequestsScanned,
      affected: 0,
      c1_rolloverAmortizedWrong: 0,
      c2_interestCountedAsPaid: 0,
      c2_uiInvariantViolations: 0,
      c3_chargeDivergence: 0,
    },
    affectedContracts: [],
  };

  for (const loan of loans) {
    const profileType = resolveProfileType(loan);
    const rate = resolveLoanRate(loan, systemSettingRate);
    const principalAmount = Number(loan.principalAmount ?? loan.amount ?? 0);
    const loanAmount = Number(loan.amount ?? principalAmount);
    const remainingAmount = Number(loan.remainingAmount ?? 0);
    const installments: any[] = Array.isArray(loan.installments) ? loan.installments : [];
    const totalInstallments = Number(loan.totalInstallments ?? loan.installmentsCount ?? installments.length);
    const isRollover = ROLLOVER_SET.has(profileType);

    const categories = new Set<string>();
    const entry: AffectedContract = {
      loanId: loan.id,
      requestId: loan.requestId ?? null,
      customerName: loan.customer?.name ?? '(sem nome)',
      profileType,
      status: loan.status ?? '(sem status)',
      principalAmount,
      remainingAmount,
      usedMonthlyRate: rate,
      categories: [],
    };

    // ── [C1] Rolagem amortizada indevidamente (caso Patricia) ──
    if (isRollover && remainingAmount < principalAmount) {
      categories.add('C1');
      entry.expectedRemainingAfterBackfill = principalAmount;
      entry.remainingDelta = principalAmount - remainingAmount;
      report.totals.c1_rolloverAmortizedWrong++;
    }

    // ── [C2] Pagamento de juros contado como parcela / UI "N/N pagas" ──
    if (isRollover) {
      const paidInstallments = installments.filter((i) => i.status === 'PAID');
      const paidCount = paidInstallments.length;
      const expectedInterest = principalAmount * rate;
      // Heurística: PAID com valor ≈ principal × taxa, OU já marcado isInterestPayment.
      const tolerance = Math.max(1, expectedInterest * 0.05);
      const suspects: SuspectInterestPayment[] = paidInstallments
        .filter(
          (i) =>
            i.isInterestPayment === true ||
            Math.abs(Number(i.amount) - expectedInterest) <= tolerance
        )
        .map((i) => ({
          installmentId: i.id,
          amount: Number(i.amount),
          expectedInterest,
          isInterestPayment: Boolean(i.isInterestPayment),
          paidAt: i.paidAt ? new Date(i.paidAt).toISOString() : null,
        }));

      const uiInvariantViolated = totalInstallments > 0 && paidCount >= totalInstallments && remainingAmount > 0;

      if (suspects.length > 0 || uiInvariantViolated) {
        categories.add('C2');
        entry.paidCount = paidCount;
        entry.totalInstallments = totalInstallments;
        entry.uiInvariantViolated = uiInvariantViolated;
        entry.suspectInterestPayments = suspects;
        if (suspects.length > 0) report.totals.c2_interestCountedAsPaid++;
        if (uiInvariantViolated) report.totals.c2_uiInvariantViolations++;
      }
    }

    // ── [C3] Divergência de cobrança (10% antigo vs fórmula oficial) ──
    // Para parcelas em atraso, recalcula com o engine e compara com o 10% antigo.
    const overdueDivergences: OverdueDivergence[] = [];
    for (const inst of installments) {
      if (!OPEN_STATUSES.includes(inst.status)) continue;
      const due = inst.dueDate ? new Date(inst.dueDate) : null;
      if (!due) continue;
      const d = daysOverdueUTC(due, today);
      if (d <= 0) continue;

      const baseAmount = Number(inst.amount ?? 0);
      const legacyCharge = legacyOverdueAmount(baseAmount, d);
      const official = computeCharge({
        profileType,
        principal: principalAmount,
        loanAmount,
        daysOverdue: d,
        base: baseAmount,
        dueDate: due,
        today,
        monthlyRate: rate,
      });
      const officialCharge = official.total;
      const difference = officialCharge - legacyCharge;

      // Só reporta se houver divergência material (> R$ 0,01).
      if (Math.abs(difference) > 0.01) {
        overdueDivergences.push({
          installmentId: inst.id,
          dueDate: due.toISOString(),
          daysOverdue: d,
          baseAmount,
          legacyCharge,
          officialCharge,
          difference,
        });
      }
    }
    if (overdueDivergences.length > 0) {
      categories.add('C3');
      entry.overdueDivergences = overdueDivergences;
      report.totals.c3_chargeDivergence++;
    }

    if (categories.size > 0) {
      entry.categories = Array.from(categories).sort();
      report.affectedContracts.push(entry);
    }
  }

  report.totals.affected = report.affectedContracts.length;

  // Ordena: mais categorias primeiro, depois maior delta de saldo (C1).
  report.affectedContracts.sort((a, b) => {
    if (b.categories.length !== a.categories.length) return b.categories.length - a.categories.length;
    return (b.remainingDelta ?? 0) - (a.remainingDelta ?? 0);
  });

  return report;
}

// ───────────────────────────────────────────────────────────────────────────
// Impressão legível (pt-BR)
// ───────────────────────────────────────────────────────────────────────────

function printHumanReport(report: AuditReport, opts: CliOptions): void {
  const t = report.totals;
  console.log('═'.repeat(78));
  console.log('  AUDITORIA DE CÁLCULO DE JUROS E ROLAGEM — RELATÓRIO (SOMENTE LEITURA)');
  console.log('═'.repeat(78));
  console.log(`  Gerado em:           ${new Date(report.generatedAt).toLocaleString('pt-BR')}`);
  console.log(`  Taxa default oficial: ${(DEFAULT_MONTHLY_RATE * 100).toFixed(0)}% a.m.`);
  console.log('');
  console.log('  RESUMO');
  console.log('  ' + '─'.repeat(74));
  console.log(`  Contratos (Loan) varridos ............... ${t.loansScanned}`);
  console.log(`  Solicitações (LoanRequest) varridas ..... ${t.loanRequestsScanned}`);
  console.log(`  Contratos AFETADOS (total) .............. ${t.affected}`);
  console.log('');
  console.log('  Por categoria:');
  console.log(`   [C1] Rolagem amortizada indevidamente (remaining < principal) ... ${t.c1_rolloverAmortizedWrong}`);
  console.log(`   [C2] Pagamento de juros marcado PAID (entra no paidCount) ....... ${t.c2_interestCountedAsPaid}`);
  console.log(`        └─ invariante de UI violado (paidCount==total & saldo>0) .. ${t.c2_uiInvariantViolations}`);
  console.log(`   [C3] Divergência de cobrança (10% antigo vs oficial) ............ ${t.c3_chargeDivergence}`);
  console.log('');

  if (t.affected === 0) {
    console.log('  Nenhum contrato afetado encontrado. ✓');
    console.log('═'.repeat(78));
    return;
  }

  const list = opts.limit ? report.affectedContracts.slice(0, opts.limit) : report.affectedContracts;
  console.log('  CONTRATOS AFETADOS' + (opts.limit ? ` (exibindo ${list.length} de ${t.affected})` : ` (${t.affected})`));
  console.log('  ' + '─'.repeat(74));

  for (const c of list) {
    console.log('');
    console.log(`  • Loan ${c.loanId}  [${c.categories.join(', ')}]`);
    console.log(`    Cliente: ${c.customerName}   |   Modalidade: ${c.profileType}   |   Status: ${c.status}`);
    console.log(
      `    Principal: ${formatBRL(c.principalAmount)}   |   Restante atual: ${formatBRL(c.remainingAmount)}   |   Taxa: ${(c.usedMonthlyRate * 100).toFixed(2)}% a.m.`
    );

    if (c.categories.includes('C1')) {
      console.log(
        `    [C1] Rolagem amortizada indevidamente: restante ${formatBRL(c.remainingAmount)} → esperado ${formatBRL(
          c.expectedRemainingAfterBackfill ?? c.principalAmount
        )} (diferença ${formatBRL(c.remainingDelta ?? 0)})`
      );
    }

    if (c.categories.includes('C2')) {
      console.log(
        `    [C2] paidCount=${c.paidCount}/${c.totalInstallments}` +
          (c.uiInvariantViolated ? '  ⚠ invariante de UI violado (exibe "N/N pagas" com saldo > 0)' : '')
      );
      for (const s of c.suspectInterestPayments ?? []) {
        console.log(
          `         - Parcela ${s.installmentId} PAID = ${formatBRL(s.amount)} (≈ juros esperado ${formatBRL(
            s.expectedInterest
          )})${s.isInterestPayment ? ' [já marcada isInterestPayment]' : ' [SEM flag — candidata a backfill]'}`
        );
      }
    }

    if (c.categories.includes('C3')) {
      console.log('    [C3] Divergência de cobrança (parcelas em atraso):');
      for (const d of c.overdueDivergences ?? []) {
        const venc = new Date(d.dueDate).toLocaleDateString('pt-BR');
        console.log(
          `         - Parcela ${d.installmentId} (venc. ${venc}, ${d.daysOverdue}d atraso): ` +
            `antigo(10%)=${formatBRL(d.legacyCharge)} → oficial=${formatBRL(d.officialCharge)} ` +
            `(diferença ${d.difference >= 0 ? '+' : ''}${formatBRL(d.difference)})`
        );
      }
    }
  }

  console.log('');
  console.log('═'.repeat(78));
  console.log('  NOTA: nenhum dado foi alterado. A correção é a Task 4.2');
  console.log('        (scripts/backfill-interest-rollover.ts, dry-run por padrão).');
  console.log('═'.repeat(78));
}

// ───────────────────────────────────────────────────────────────────────────
// main
// ───────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    printHelp();
    return;
  }

  const report = await runAudit(opts);

  if (opts.json) {
    const out = opts.limit
      ? { ...report, affectedContracts: report.affectedContracts.slice(0, opts.limit) }
      : report;
    console.log(JSON.stringify(out, null, 2));
  } else {
    printHumanReport(report, opts);
  }
}

main()
  .catch((err) => {
    console.error('Erro durante a auditoria:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await prisma.$disconnect();
    } catch {
      /* noop */
    }
  });
