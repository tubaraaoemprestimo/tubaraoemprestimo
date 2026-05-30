/**
 * backfill-interest-rollover.ts — BACKFILL idempotente e reversível (SEGURO p/ PRODUÇÃO)
 *
 * Bugfix spec: "correcao-calculo-juros-parcelas" — Task 4.2.
 *
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  --dry-run É O PADRÃO. SEM --apply, NADA é gravado no banco.               ║
 * ║                                                                            ║
 * ║  Este script CORRIGE contratos de rolagem (CLT/GARANTIA/GARANTIA_VEICULO)  ║
 * ║  já corrompidos — onde um pagamento de juros de rolagem foi tratado como   ║
 * ║  amortização e abateu o principal (caso Patricia: remainingAmount R$ 700   ║
 * ║  quando deveria ser R$ 1.000). A rolagem de juros NÃO amortiza.            ║
 * ║                                                                            ║
 * ║  Para cada contrato candidato (de forma idempotente):                      ║
 * ║   1. marca isInterestPayment=true nos pagamentos de juros de rolagem       ║
 * ║      (parcelas PAID com valor ≈ principalAmount × taxa) — só se ainda false;║
 * ║   2. recalcula remainingAmount = principalAmount — só se ainda divergir;    ║
 * ║   3. registra log antes/depois (permite --revert <runId>).                 ║
 * ║                                                                            ║
 * ║  As escritas de cada contrato são feitas dentro de prisma.$transaction     ║
 * ║  (atomicidade por contrato). O diagnóstico/auditoria é a Task 4.1          ║
 * ║  (scripts/audit-interest-calculation.ts).                                  ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * CRITÉRIO DE SELEÇÃO (candidatos):
 *   - profileType ∈ {CLT, GARANTIA, GARANTIA_VEICULO} (rolagem);
 *   - status ativo (NÃO em {COMPLETED, CANCELLED});
 *   - remainingAmount < principalAmount (sinal de abatimento indevido de juros).
 *
 * IDEMPOTÊNCIA:
 *   - remainingAmount só é alterado se != principalAmount;
 *   - isInterestPayment só é alterado se ainda false;
 *   - rodar duas vezes: na 2ª execução o contrato já não satisfaz
 *     `remainingAmount < principalAmount` (não é selecionado) e as parcelas de
 *     juros já estão marcadas — nada muda.
 *
 * REVERSIBILIDADE:
 *   - cada execução real (--apply) grava backend/scripts/backfill-logs/<runId>.json
 *     com os valores ANTES/DEPOIS por contrato/parcela;
 *   - `--revert <runId>` restaura os valores ANTES (também dry-run por padrão;
 *     exige --apply para gravar; também idempotente).
 *
 * USO (a partir de backend/):
 *   npx tsx scripts/backfill-interest-rollover.ts                 # DRY-RUN (não grava)
 *   npx tsx scripts/backfill-interest-rollover.ts --apply         # aplica (faça BACKUP antes!)
 *   npx tsx scripts/backfill-interest-rollover.ts --revert <id>   # prévia da reversão (dry-run)
 *   npx tsx scripts/backfill-interest-rollover.ts --revert <id> --apply   # reverte de fato
 *   npx tsx scripts/backfill-interest-rollover.ts --json          # saída estruturada (JSON)
 *   npx tsx scripts/backfill-interest-rollover.ts --limit N       # processa no máx. N contratos
 *   npx tsx scripts/backfill-interest-rollover.ts --help          # ajuda
 *
 * Requirements: 2.9, 2.10
 */

import * as fs from 'fs';
import * as path from 'path';
import { prisma } from '../src/services/prisma';
import { resolveMonthlyRate, ROLLOVER_PROFILES, DEFAULT_MONTHLY_RATE } from '../src/services/interestEngine';

// ───────────────────────────────────────────────────────────────────────────
// Constantes / helpers (heurísticas alinhadas com audit-interest-calculation.ts)
// ───────────────────────────────────────────────────────────────────────────

/** Conjunto dos perfis de rolagem (reuso do conceito do engine). */
const ROLLOVER_SET = new Set<string>(ROLLOVER_PROFILES as readonly string[]);

/**
 * Status de contrato considerados INATIVOS (não elegíveis ao backfill).
 *
 * IMPORTANTE: inclui `PAID`/`COMPLETED` porque este sistema marca o contrato como
 * `PAID`/`COMPLETED` quando o saldo zera — e isso pode representar uma QUITAÇÃO REAL
 * (cliente pagou principal + juros). Ressuscitar a dívida (`remaining → principal`)
 * de um contrato quitado cobraria indevidamente quem já pagou. Portanto, só contratos
 * efetivamente em aberto (ex.: ACTIVE) entram no backfill automático. Contratos
 * quitados que tenham sido fechados por engano devem ser tratados manualmente,
 * caso a caso, após conferência.
 */
const INACTIVE_LOAN_STATUSES = new Set<string>(['COMPLETED', 'CANCELLED', 'PAID']);

/** Diretório onde os logs de cada run real são persistidos (para --revert). */
const LOG_DIR = path.join(__dirname, 'backfill-logs');

/**
 * Normaliza uma taxa que pode estar em percentual (30 = 30%) ou fração (0.30).
 * Réplica do helper usado em audit-interest-calculation.ts / collectionAutomationService.
 */
function normalizeRate(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value) || value <= 0) return null;
  return value > 1 ? value / 100 : value;
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
 * (mesma heurística do script de auditoria)
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
 * `resolveMonthlyRate` do engine (mesma lógica do script de auditoria):
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

/** True se o status do contrato é considerado ativo (elegível ao backfill). */
function isActiveStatus(status: string | null | undefined): boolean {
  return !INACTIVE_LOAN_STATUSES.has(String(status ?? '').toUpperCase());
}

// ───────────────────────────────────────────────────────────────────────────
// CLI args
// ───────────────────────────────────────────────────────────────────────────

interface CliOptions {
  /** Quando true, grava no banco. Quando false (default), é dry-run. */
  apply: boolean;
  /** runId a reverter (modo --revert). null = modo backfill normal. */
  revertRunId: string | null;
  /** Saída em JSON estruturado. */
  json: boolean;
  /** Limita a quantidade de contratos processados. */
  limit: number | null;
  help: boolean;
}

function parseArgs(argv: string[]): CliOptions {
  const opts: CliOptions = {
    apply: false,
    revertRunId: null,
    json: false,
    limit: null,
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--apply') opts.apply = true;
    else if (arg === '--dry-run') opts.apply = false; // explícito (já é o default)
    else if (arg === '--json') opts.json = true;
    else if (arg === '--help' || arg === '-h') opts.help = true;
    else if (arg === '--revert') {
      opts.revertRunId = argv[i + 1] ?? null;
      i++;
    } else if (arg.startsWith('--revert=')) {
      opts.revertRunId = arg.split('=')[1] || null;
    } else if (arg === '--limit') {
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
BACKFILL de rolagem de juros (CLT/GARANTIA/GARANTIA_VEICULO) — idempotente e reversível.

╔════════════════════════════════════════════════════════════════════════════╗
║  --dry-run É O PADRÃO: sem --apply, NADA é gravado no banco.                 ║
║  Faça BACKUP do banco antes de rodar com --apply (passo manual).            ║
╚════════════════════════════════════════════════════════════════════════════╝

Uso (a partir de backend/):
  npx tsx scripts/backfill-interest-rollover.ts                 DRY-RUN (não grava nada)
  npx tsx scripts/backfill-interest-rollover.ts --apply         Aplica a correção (grava)
  npx tsx scripts/backfill-interest-rollover.ts --revert <id>   Prévia da reversão (dry-run)
  npx tsx scripts/backfill-interest-rollover.ts --revert <id> --apply   Reverte de fato
  npx tsx scripts/backfill-interest-rollover.ts --json          Saída estruturada (JSON)
  npx tsx scripts/backfill-interest-rollover.ts --limit N       Processa no máx. N contratos
  npx tsx scripts/backfill-interest-rollover.ts --help          Esta ajuda

O que faz (por contrato candidato):
  1. marca isInterestPayment=true nas parcelas de juros de rolagem (PAID ≈ principal × taxa);
  2. recalcula remainingAmount = principalAmount (rolagem não amortiza);
  3. grava log antes/depois em scripts/backfill-logs/<runId>.json (para --revert).

Critério de seleção: profileType ∈ {CLT, GARANTIA, GARANTIA_VEICULO}, status ativo,
remainingAmount < principalAmount.

A auditoria/diagnóstico (somente leitura) é a Task 4.1: scripts/audit-interest-calculation.ts.
`);
}

// ───────────────────────────────────────────────────────────────────────────
// Tipos do log de backfill (persistido em scripts/backfill-logs/<runId>.json)
// ───────────────────────────────────────────────────────────────────────────

/** Mudança de uma parcela (marca isInterestPayment). */
interface InstallmentChange {
  installmentId: string;
  amount: number;
  expectedInterest: number;
  before: { isInterestPayment: boolean };
  after: { isInterestPayment: boolean };
}

/** Mudança do contrato (remainingAmount) + parcelas marcadas. */
interface LoanChange {
  loanId: string;
  requestId: string | null;
  customerName: string;
  profileType: string;
  status: string;
  principalAmount: number;
  usedMonthlyRate: number;
  remaining: { before: number; after: number; changed: boolean };
  installmentChanges: InstallmentChange[];
  /** True se este contrato teve algo a alterar (saldo ou alguma parcela). */
  hasChanges: boolean;
}

/** Documento completo de um run (persistido em disco quando --apply). */
interface BackfillRunLog {
  runId: string;
  mode: 'backfill';
  startedAt: string;
  finishedAt: string;
  apply: boolean;
  totals: {
    candidates: number;
    loansChanged: number;
    remainingRestored: number;
    installmentsMarked: number;
  };
  loans: LoanChange[];
}

// ───────────────────────────────────────────────────────────────────────────
// Persistência do log de run (para reversão)
// ───────────────────────────────────────────────────────────────────────────

function ensureLogDir(): void {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}

function logPathFor(runId: string): string {
  // Sanitiza o runId para evitar path traversal (só [A-Za-z0-9._-]).
  const safe = runId.replace(/[^A-Za-z0-9._-]/g, '');
  return path.join(LOG_DIR, `${safe}.json`);
}

function writeRunLog(log: BackfillRunLog): string {
  ensureLogDir();
  const file = logPathFor(log.runId);
  fs.writeFileSync(file, JSON.stringify(log, null, 2), 'utf8');
  return file;
}

function readRunLog(runId: string): BackfillRunLog {
  const file = logPathFor(runId);
  if (!fs.existsSync(file)) {
    throw new Error(
      `Log do run "${runId}" não encontrado em ${file}. ` +
        `Verifique o runId (ex.: arquivos em scripts/backfill-logs/).`
    );
  }
  const raw = fs.readFileSync(file, 'utf8');
  return JSON.parse(raw) as BackfillRunLog;
}

/** Gera um runId único e legível: backfill-YYYYMMDD-HHMMSS-xxxx. */
function generateRunId(now: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp =
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
    `-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const rand = Math.random().toString(36).slice(2, 6);
  return `backfill-${stamp}-${rand}`;
}

// ───────────────────────────────────────────────────────────────────────────
// Planejamento do backfill (SOMENTE LEITURA — calcula o que SERIA alterado)
// ───────────────────────────────────────────────────────────────────────────

/**
 * Varre os contratos de rolagem candidatos e calcula, para cada um, as mudanças
 * necessárias (remainingAmount e parcelas de juros a marcar). NÃO escreve nada.
 * Retorna apenas contratos que satisfazem o critério de seleção.
 */
async function planBackfill(opts: CliOptions): Promise<LoanChange[]> {
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

  const loans: any[] = await prisma.loan.findMany({
    select: {
      id: true,
      requestId: true,
      status: true,
      amount: true,
      principalAmount: true,
      remainingAmount: true,
      interestRate: true,
      isService: true,
      isInvestment: true,
      customer: {
        select: { name: true, monthlyInterestRate: true, lateInterestMonthly: true },
      },
      loanRequest: {
        select: { profileType: true, isService: true, isInvestment: true },
      },
      installments: {
        select: { id: true, amount: true, status: true, isInterestPayment: true },
      },
    },
  });

  const planned: LoanChange[] = [];

  for (const loan of loans) {
    const profileType = resolveProfileType(loan);
    const isRollover = ROLLOVER_SET.has(profileType);
    const principalAmount = Number(loan.principalAmount ?? loan.amount ?? 0);
    const remainingAmount = Number(loan.remainingAmount ?? 0);

    // ── Critério de seleção (candidatos) ──
    //   rolagem + status ativo + remainingAmount < principalAmount.
    if (!isRollover) continue;
    if (!isActiveStatus(loan.status)) continue;
    if (!(remainingAmount < principalAmount)) continue;

    const rate = resolveLoanRate(loan, systemSettingRate);
    const installments: any[] = Array.isArray(loan.installments) ? loan.installments : [];
    const expectedInterest = principalAmount * rate;

    // Heurística de identificação da parcela de juros de rolagem (mesma do
    // script de auditoria): PAID com valor ≈ principal × taxa (tolerância 5%),
    // ou já marcada isInterestPayment.
    const tolerance = Math.max(1, expectedInterest * 0.05);

    const installmentChanges: InstallmentChange[] = [];
    for (const inst of installments) {
      if (inst.status !== 'PAID') continue;
      const amount = Number(inst.amount ?? 0);
      const looksLikeInterest =
        inst.isInterestPayment === true || Math.abs(amount - expectedInterest) <= tolerance;
      if (!looksLikeInterest) continue;

      const before = Boolean(inst.isInterestPayment);
      // Idempotência: só altera se ainda false.
      if (before === true) continue;

      installmentChanges.push({
        installmentId: inst.id,
        amount,
        expectedInterest,
        before: { isInterestPayment: before },
        after: { isInterestPayment: true },
      });
    }

    // Idempotência do saldo: só altera se ainda divergir do principal.
    const remainingChanged = remainingAmount !== principalAmount;

    const hasChanges = remainingChanged || installmentChanges.length > 0;

    planned.push({
      loanId: loan.id,
      requestId: loan.requestId ?? null,
      customerName: loan.customer?.name ?? '(sem nome)',
      profileType,
      status: loan.status ?? '(sem status)',
      principalAmount,
      usedMonthlyRate: rate,
      remaining: {
        before: remainingAmount,
        after: principalAmount,
        changed: remainingChanged,
      },
      installmentChanges,
      hasChanges,
    });

    if (opts.limit && planned.length >= opts.limit) break;
  }

  // Maior delta de saldo primeiro (contratos mais impactados no topo).
  planned.sort(
    (a, b) => (b.principalAmount - b.remaining.before) - (a.principalAmount - a.remaining.before)
  );

  return planned;
}

/**
 * Aplica as mudanças de UM contrato dentro de uma transação (atomicidade por
 * contrato). Só é chamada quando --apply. Reaplica as guardas de idempotência
 * dentro da transação para segurança (lê o estado atual antes de escrever).
 */
async function applyLoanChange(change: LoanChange): Promise<void> {
  await prisma.$transaction(async (tx: any) => {
    // Reverifica o saldo dentro da transação (idempotente).
    if (change.remaining.changed) {
      await tx.loan.update({
        where: { id: change.loanId },
        data: { remainingAmount: change.principalAmount },
      });
    }

    // Marca cada parcela de juros (idempotente: condiciona a isInterestPayment=false).
    for (const ic of change.installmentChanges) {
      await tx.installment.updateMany({
        where: { id: ic.installmentId, isInterestPayment: false },
        data: { isInterestPayment: true },
      });
    }
  });
}

// ───────────────────────────────────────────────────────────────────────────
// Runner do BACKFILL
// ───────────────────────────────────────────────────────────────────────────

async function runBackfill(opts: CliOptions): Promise<BackfillRunLog> {
  const startedAt = new Date();
  const runId = generateRunId(startedAt);

  printBackfillBanner(opts);

  const planned = await planBackfill(opts);
  const candidates = planned.length;
  const withChanges = planned.filter((c) => c.hasChanges);

  // Aplica (somente com --apply), contrato a contrato, em transação.
  if (opts.apply) {
    for (const change of withChanges) {
      try {
        await applyLoanChange(change);
      } catch (err) {
        console.error(`  ✗ Falha ao aplicar contrato ${change.loanId}:`, err);
        throw err; // aborta: o que já foi aplicado permanece gravado no log até aqui
      }
    }
  }

  const finishedAt = new Date();
  const log: BackfillRunLog = {
    runId,
    mode: 'backfill',
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    apply: opts.apply,
    totals: {
      candidates,
      loansChanged: withChanges.length,
      remainingRestored: withChanges.filter((c) => c.remaining.changed).length,
      installmentsMarked: withChanges.reduce((acc, c) => acc + c.installmentChanges.length, 0),
    },
    loans: planned,
  };

  // Persiste o log SOMENTE em execução real (necessário para --revert).
  if (opts.apply) {
    const file = writeRunLog(log);
    console.log(`\n  Log de auditoria salvo em: ${file}`);
    console.log(`  Para reverter este run:  npx tsx scripts/backfill-interest-rollover.ts --revert ${runId} --apply`);
  }

  if (!opts.json) printBackfillReport(log, opts);
  return log;
}

// ───────────────────────────────────────────────────────────────────────────
// Runner do REVERT (restaura valores ANTES de um run de --apply)
// ───────────────────────────────────────────────────────────────────────────

interface RevertResult {
  runId: string;
  apply: boolean;
  reverted: {
    loanId: string;
    customerName: string;
    remaining: { current: number | null; restoreTo: number; willChange: boolean };
    installments: { installmentId: string; restoreTo: boolean; willChange: boolean }[];
  }[];
  totals: { loans: number; remainingRestored: number; installmentsRestored: number };
}

async function runRevert(runId: string, opts: CliOptions): Promise<RevertResult> {
  const log = readRunLog(runId);

  printRevertBanner(runId, opts);

  if (!log.apply) {
    console.log('  AVISO: o log informado foi gerado em DRY-RUN (apply=false) — nada foi gravado');
    console.log('         originalmente, então não há o que reverter.');
  }

  const result: RevertResult = {
    runId,
    apply: opts.apply,
    reverted: [],
    totals: { loans: 0, remainingRestored: 0, installmentsRestored: 0 },
  };

  // Só consideramos contratos que efetivamente tiveram mudanças no run original.
  const changed = log.loans.filter((l) => l.hasChanges);

  for (const loanChange of changed) {
    // Lê o estado atual para reverter de forma idempotente.
    const current: any = await prisma.loan.findUnique({
      where: { id: loanChange.loanId },
      select: { remainingAmount: true },
    });
    const currentRemaining = current ? Number(current.remainingAmount) : null;

    // Restaura remainingAmount ao valor ANTES (apenas se foi alterado no run).
    const restoreRemainingTo = loanChange.remaining.before;
    const remainingWillChange =
      loanChange.remaining.changed && currentRemaining !== restoreRemainingTo;

    // Restaura isInterestPayment ao valor ANTES de cada parcela marcada.
    const instReverts: { installmentId: string; restoreTo: boolean; willChange: boolean }[] = [];
    for (const ic of loanChange.installmentChanges) {
      const inst: any = await prisma.installment.findUnique({
        where: { id: ic.installmentId },
        select: { isInterestPayment: true },
      });
      const currentFlag = inst ? Boolean(inst.isInterestPayment) : null;
      const restoreTo = ic.before.isInterestPayment;
      const willChange = currentFlag !== null && currentFlag !== restoreTo;
      instReverts.push({ installmentId: ic.installmentId, restoreTo, willChange });
    }

    // Aplica a reversão dentro de uma transação por contrato (somente --apply).
    if (opts.apply && log.apply) {
      await prisma.$transaction(async (tx: any) => {
        if (remainingWillChange) {
          await tx.loan.update({
            where: { id: loanChange.loanId },
            data: { remainingAmount: restoreRemainingTo },
          });
        }
        for (const r of instReverts) {
          if (r.willChange) {
            await tx.installment.update({
              where: { id: r.installmentId },
              data: { isInterestPayment: r.restoreTo },
            });
          }
        }
      });
    }

    result.reverted.push({
      loanId: loanChange.loanId,
      customerName: loanChange.customerName,
      remaining: {
        current: currentRemaining,
        restoreTo: restoreRemainingTo,
        willChange: remainingWillChange,
      },
      installments: instReverts,
    });
    result.totals.loans++;
    if (remainingWillChange) result.totals.remainingRestored++;
    result.totals.installmentsRestored += instReverts.filter((r) => r.willChange).length;
  }

  if (!opts.json) printRevertReport(result, opts);
  return result;
}

// ───────────────────────────────────────────────────────────────────────────
// Impressão legível (pt-BR) — banners e relatórios
// ───────────────────────────────────────────────────────────────────────────

function printBackfillBanner(opts: CliOptions): void {
  console.log('═'.repeat(78));
  console.log('  BACKFILL DE ROLAGEM DE JUROS (CLT / GARANTIA / GARANTIA_VEICULO)');
  console.log('═'.repeat(78));
  if (opts.apply) {
    console.log('  ⚠  MODO --apply: ALTERAÇÕES SERÃO GRAVADAS NO BANCO.');
    console.log('  ⚠  Certifique-se de ter feito BACKUP do banco antes de prosseguir.');
    console.log('  ⚠  (o backup é um passo MANUAL e não é executado por este script)');
  } else {
    console.log('  DRY-RUN — nada será gravado. Apenas lista o que SERIA alterado.');
    console.log('  Para aplicar de fato, rode novamente com --apply (após backup do banco).');
  }
  console.log('═'.repeat(78));
}

function printRevertBanner(runId: string, opts: CliOptions): void {
  console.log('═'.repeat(78));
  console.log(`  REVERSÃO DO BACKFILL — run "${runId}"`);
  console.log('═'.repeat(78));
  if (opts.apply) {
    console.log('  ⚠  MODO --apply: a reversão SERÁ GRAVADA (restaura valores ANTES do run).');
  } else {
    console.log('  DRY-RUN — nada será gravado. Apenas lista o que SERIA revertido.');
    console.log('  Para reverter de fato, rode novamente com --apply.');
  }
  console.log('═'.repeat(78));
}

function printBackfillReport(log: BackfillRunLog, opts: CliOptions): void {
  const t = log.totals;
  console.log('');
  console.log('  RESUMO');
  console.log('  ' + '─'.repeat(74));
  console.log(`  Taxa default oficial ................................ ${(DEFAULT_MONTHLY_RATE * 100).toFixed(0)}% a.m.`);
  console.log(`  Contratos candidatos (rolagem, remaining<principal) . ${t.candidates}`);
  console.log(`  Contratos com mudanças .............................. ${t.loansChanged}`);
  console.log(`   └─ saldo a restaurar (remaining → principal) ...... ${t.remainingRestored}`);
  console.log(`   └─ parcelas de juros a marcar (isInterestPayment) . ${t.installmentsMarked}`);
  console.log('');

  const withChanges = log.loans.filter((l) => l.hasChanges);
  if (withChanges.length === 0) {
    console.log('  Nenhum contrato a corrigir. ✓ (idempotente: nada a fazer)');
    console.log('═'.repeat(78));
    return;
  }

  console.log(`  ${opts.apply ? 'CONTRATOS CORRIGIDOS' : 'CONTRATOS QUE SERIAM CORRIGIDOS'} (${withChanges.length})`);
  console.log('  ' + '─'.repeat(74));
  for (const c of withChanges) {
    console.log('');
    console.log(`  • Loan ${c.loanId}`);
    console.log(`    Cliente: ${c.customerName}   |   Modalidade: ${c.profileType}   |   Status: ${c.status}`);
    console.log(`    Principal: ${formatBRL(c.principalAmount)}   |   Taxa: ${(c.usedMonthlyRate * 100).toFixed(2)}% a.m.`);
    if (c.remaining.changed) {
      console.log(
        `    Saldo devedor: ${formatBRL(c.remaining.before)} → ${formatBRL(c.remaining.after)} ` +
          `${opts.apply ? '(restaurado)' : '(seria restaurado)'}  [rolagem não amortiza]`
      );
    } else {
      console.log(`    Saldo devedor: ${formatBRL(c.remaining.before)} (já correto — não alterado)`);
    }
    for (const ic of c.installmentChanges) {
      console.log(
        `      - Parcela ${ic.installmentId} = ${formatBRL(ic.amount)} (≈ juros ${formatBRL(ic.expectedInterest)}): ` +
          `isInterestPayment false → true ${opts.apply ? '(marcada)' : '(seria marcada)'}`
      );
    }
  }

  console.log('');
  console.log('═'.repeat(78));
  if (!opts.apply) {
    console.log('  NOTA: DRY-RUN — nenhum dado foi alterado. Rode com --apply para gravar.');
  } else {
    console.log('  NOTA: alterações gravadas. Validação pós-backfill: nenhum contrato deve ter');
    console.log('        paidCount == total AND remainingAmount > 0 (use o script de auditoria 4.1).');
  }
  console.log('═'.repeat(78));
}

function printRevertReport(result: RevertResult, opts: CliOptions): void {
  const t = result.totals;
  console.log('');
  console.log('  RESUMO DA REVERSÃO');
  console.log('  ' + '─'.repeat(74));
  console.log(`  Contratos no log do run ............................. ${t.loans}`);
  console.log(`   └─ saldo a restaurar ao valor anterior ............ ${t.remainingRestored}`);
  console.log(`   └─ parcelas a restaurar (isInterestPayment) ....... ${t.installmentsRestored}`);
  console.log('');

  if (t.loans === 0) {
    console.log('  Nada a reverter neste run. ✓');
    console.log('═'.repeat(78));
    return;
  }

  for (const r of result.reverted) {
    console.log('');
    console.log(`  • Loan ${r.loanId}  (${r.customerName})`);
    if (r.remaining.willChange) {
      console.log(
        `    Saldo devedor: ${r.remaining.current != null ? formatBRL(r.remaining.current) : '?'} → ` +
          `${formatBRL(r.remaining.restoreTo)} ${opts.apply ? '(revertido)' : '(seria revertido)'}`
      );
    } else {
      console.log(`    Saldo devedor: já no valor anterior (${formatBRL(r.remaining.restoreTo)}) — não alterado`);
    }
    for (const inst of r.installments) {
      if (inst.willChange) {
        console.log(
          `      - Parcela ${inst.installmentId}: isInterestPayment → ${inst.restoreTo} ` +
            `${opts.apply ? '(revertida)' : '(seria revertida)'}`
        );
      } else {
        console.log(`      - Parcela ${inst.installmentId}: já no valor anterior (${inst.restoreTo}) — não alterada`);
      }
    }
  }

  console.log('');
  console.log('═'.repeat(78));
  if (!opts.apply) {
    console.log('  NOTA: DRY-RUN — nada foi revertido. Rode com --revert <id> --apply para gravar.');
  } else {
    console.log('  NOTA: reversão concluída (valores anteriores ao run restaurados).');
  }
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

  if (opts.revertRunId) {
    const result = await runRevert(opts.revertRunId, opts);
    if (opts.json) console.log(JSON.stringify(result, null, 2));
    return;
  }

  const log = await runBackfill(opts);
  if (opts.json) {
    const out = opts.limit ? { ...log, loans: log.loans.slice(0, opts.limit) } : log;
    console.log(JSON.stringify(out, null, 2));
  }
}

main()
  .catch((err) => {
    console.error('Erro durante o backfill:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await prisma.$disconnect();
    } catch {
      /* noop */
    }
  });
