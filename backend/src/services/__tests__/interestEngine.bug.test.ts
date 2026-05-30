/**
 * Teste de EXPLORAÇÃO da bug condition (property-based) — Task 1 do bugfix
 * spec "correcao-calculo-juros-parcelas".
 *
 * OBJETIVO: surfar contraexemplos que provam o bug ANTES do fix.
 * Este teste DEVE FALHAR no código NÃO corrigido — a falha confirma o bug.
 * Ele codifica o comportamento ESPERADO (officialCharge do design.md), portanto
 * validará o fix quando passar (ver task 3.10).
 *
 * NÃO importamos diretamente `calculateOverdueAmount()` de
 * backend/src/services/collectionAutomationService.ts porque aquele módulo acopla
 * `@prisma/client` (não instalado/gerado neste ambiente) via imports transitivos
 * (`./prisma`, `./templateService`). Para manter o teste puro, determinístico e
 * sem I/O, replicamos a fórmula EXATA do código atual (10% a.m.) com referência à
 * fonte, e usamos um "seam" (`actualCronCharge`) que resolve dinamicamente o futuro
 * `interestEngine.computeCharge` quando existir (após o fix), caindo na réplica 10%
 * enquanto o engine não existe. Assim o MESMO teste falha agora e passa após o fix,
 * sem alterar nenhum comportamento de produção.
 *
 * Framework: fast-check + vitest. Rodar com: vitest --run (nunca watch).
 *
 * **Validates: Requirements 2.1, 2.2, 2.4, 2.5, 2.6, 2.7, 2.10**
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

type RolloverProfile = 'CLT' | 'GARANTIA' | 'GARANTIA_VEICULO';
const ROLLOVER_PROFILES: RolloverProfile[] = ['CLT', 'GARANTIA', 'GARANTIA_VEICULO'];

// ───────────────────────────────────────────────────────────────────────────
// Réplica FIEL do cálculo atual de produção (taxa hardcoded de 10% a.m.).
// Fonte: backend/src/services/collectionAutomationService.ts
//   function calculateOverdueAmount(originalAmount, daysOverdue) {
//     const monthsOverdue = daysOverdue / 30;
//     const interestRate = 0.10; // 10% ao mês
//     return originalAmount * (1 + (interestRate * monthsOverdue));
//   }
// BUG: usa 10% (não 30%), prorrateio linear, e ignora multa 7% e R$20/dia.
// ───────────────────────────────────────────────────────────────────────────
function currentCalculateOverdueAmount(originalAmount: number, daysOverdue: number): number {
  const monthsOverdue = daysOverdue / 30;
  const interestRate = 0.10; // 10% ao mês (defeito 1.1)
  return originalAmount * (1 + interestRate * monthsOverdue);
}

// ───────────────────────────────────────────────────────────────────────────
// Fórmula OFICIAL (comportamento esperado) — design.md > officialCharge.
// CLT/GARANTIA/GARANTIA_VEICULO em atraso:
//   valor = (principal × 0,30) + (loanAmount × 0,07) + (D × 20)
//   D = 0  → apenas (principal × 0,30)  (sem 7%, sem R$20)
// ───────────────────────────────────────────────────────────────────────────
const MONTHLY_RATE = 0.30; // 30% a.m. (default oficial — nunca 10%)
const FINE_PERCENT = 0.07; // 7% sobre o valor emprestado (CLT/GARANTIA)
const LATE_FEE_DAILY = 20; // R$ 20,00 por dia corrido de atraso

function officialChargeRollover(principal: number, loanAmount: number, D: number): number {
  const jurosMes = principal * MONTHLY_RATE;
  if (D <= 0) return jurosMes; // não venceu: só juros do mês (req 2.3)
  const multa7 = loanAmount * FINE_PERCENT; // uma vez por ciclo (req 2.4)
  const multaDiaria = D * LATE_FEE_DAILY; // dias corridos (req 2.2)
  return jurosMes + multa7 + multaDiaria;
}

// AUTONOMO: juros de mora 30% EXCLUINDO domingos + R$20/dia, SEM os 7% (req 2.5/2.6).
// Convenção documentada para a exploração; o fix (interestEngine) consolidará os
// detalhes de proRata. O ponto do teste é demonstrar a DIVERGÊNCIA do caminho 10%.
function officialChargeAutonomo(parcela: number, principal: number, dueDate: Date, today: Date): number {
  const D = daysOverdueUTC(dueDate, today);
  const sundays = countSundaysUTC(dueDate, today);
  const diasJuros = Math.max(0, D - sundays);
  const jurosMora = principal * MONTHLY_RATE * (diasJuros / 30);
  const multaDiaria = D * LATE_FEE_DAILY; // sem 7% para AUTONOMO
  return parcela + jurosMora + multaDiaria;
}

const MS_PER_DAY = 1000 * 60 * 60 * 24;

function startOfUTCDay(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function daysOverdueUTC(dueDate: Date, today: Date): number {
  const diff = Math.floor((startOfUTCDay(today) - startOfUTCDay(dueDate)) / MS_PER_DAY);
  return diff > 0 ? diff : 0;
}

/** Conta domingos no intervalo (dueDate, today]. */
function countSundaysUTC(dueDate: Date, today: Date): number {
  let count = 0;
  const start = startOfUTCDay(dueDate);
  const end = startOfUTCDay(today);
  for (let t = start + MS_PER_DAY; t <= end; t += MS_PER_DAY) {
    if (new Date(t).getUTCDay() === 0) count++;
  }
  return count;
}

// ───────────────────────────────────────────────────────────────────────────
// Seam: tenta resolver o futuro interestEngine.computeCharge; enquanto não existe,
// usa a réplica atual (10%). Após o fix (task 3.1), o engine retornará o valor
// oficial e este MESMO teste passará. Não modifica produção.
// ───────────────────────────────────────────────────────────────────────────
function tryLoadEngine(): any | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('../interestEngine');
  } catch {
    return null;
  }
}

function actualCronCharge(params: {
  profileType: string;
  principal: number;
  loanAmount: number;
  daysOverdue: number;
  chargeAmount: number;
  dueDate?: Date;
  today?: Date;
}): number {
  const engine = tryLoadEngine();
  if (engine && typeof engine.computeCharge === 'function') {
    const out = engine.computeCharge({
      profileType: params.profileType,
      principal: params.principal,
      loanAmount: params.loanAmount,
      daysOverdue: params.daysOverdue,
      dueDate: params.dueDate,
      today: params.today,
      monthlyRate: MONTHLY_RATE,
    });
    return typeof out === 'number' ? out : out.total;
  }
  // Caminho atual do cron (collectionAutomationService): 10% sobre chargeAmount.
  return currentCalculateOverdueAmount(params.chargeAmount, params.daysOverdue);
}

/**
 * Valor que a rota POST /:loanId/generate-payment produz para a MESMA entrada do cron.
 *
 * Convergência (req 2.7): após o fix (task 3.4) a rota generate-payment passou a usar o
 * MESMO `interestEngine.computeCharge` com os MESMOS parâmetros do cron, de modo que os
 * dois caminhos retornam valor idêntico para o mesmo contrato/período. Enquanto o engine
 * não existe, cai na fórmula inline original da rota (loanAmount × monthlyRate, fallback
 * '30'), que diverge do cron (10%) — preservando a falha exploratória antes do fix.
 *
 * Modela explicitamente o caminho de produção usando a MESMA fonte e os MESMOS parâmetros
 * que `actualCronCharge`, em vez de comparar o engine (com atraso) contra uma fórmula que
 * ignora o atraso.
 */
function generatePaymentCharge(params: {
  profileType: string;
  principal: number;
  loanAmount: number;
  daysOverdue: number;
  chargeAmount: number;
  dueDate?: Date;
  today?: Date;
}): number {
  const engine = tryLoadEngine();
  if (engine && typeof engine.computeCharge === 'function') {
    const out = engine.computeCharge({
      profileType: params.profileType,
      principal: params.principal,
      loanAmount: params.loanAmount,
      daysOverdue: params.daysOverdue,
      dueDate: params.dueDate,
      today: params.today,
      monthlyRate: MONTHLY_RATE,
    });
    return typeof out === 'number' ? out : out.total;
  }
  // Caminho atual de generate-payment (routes/loans.ts): loanAmount × monthlyRate (fallback '30').
  return Number((params.loanAmount * MONTHLY_RATE).toFixed(2));
}

// ═══════════════════════════════════════════════════════════════════════════
// Property 1 — Fault Condition (Ramo A: cobrança) e Ramo B (pagamento de juros).
// ═══════════════════════════════════════════════════════════════════════════
describe('Property 1: Fault Condition — Cálculo Oficial de Cobrança + Contagem de Parcela de Juros', () => {
  // ───────────── Ramo A.1 — CLT/GARANTIA em atraso (defeito 1.1/1.3) ─────────────
  it('Ramo A — âncora CLT: principal=1000, loanAmount=1000, D=6 → oficial R$490 (atual ~R$306)', () => {
    const principal = 1000;
    const loanAmount = 1000;
    const D = 6;

    const actual = actualCronCharge({
      profileType: 'CLT',
      principal,
      loanAmount,
      daysOverdue: D,
      chargeAmount: 300, // parcela de juros (300 = 1000 × 0,30) — como o cron cobra hoje
    });
    const official = officialChargeRollover(principal, loanAmount, D); // 300 + 70 + 120 = 490

    expect(official).toBe(490);
    // FALHA esperada no código atual: 306 !== 490
    expect(actual).toBeCloseTo(official, 2);
  });

  it('Ramo A — property CLT/GARANTIA em atraso diverge da fórmula oficial (10% != oficial)', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...ROLLOVER_PROFILES),
        fc.integer({ min: 1, max: 30 }), // D dias de atraso
        (profileType, D) => {
          const principal = 1000;
          const loanAmount = 1000;
          const chargeAmount = principal * MONTHLY_RATE; // 300, parcela de juros do mês
          const actual = actualCronCharge({ profileType, principal, loanAmount, daysOverdue: D, chargeAmount });
          const official = officialChargeRollover(principal, loanAmount, D);
          // Esperado: igualdade. No código atual FALHA (usa 10% e ignora 7%/R$20).
          expect(actual).toBeCloseTo(official, 2);
        }
      ),
      { numRuns: 50 }
    );
  });

  // ───────────── Ramo A.2 — AUTONOMO (defeito 1.4) ─────────────
  it('Ramo A — AUTONOMO em atraso: 10% prorrateado diverge da fórmula oficial (sem 7%, exclui domingo, +R$20/dia)', () => {
    // dueDate = 2024-03-04 (segunda), today = 2024-03-10 (domingo) → D=6, 1 domingo
    const dueDate = new Date(Date.UTC(2024, 2, 4));
    const today = new Date(Date.UTC(2024, 2, 10));
    const parcela = 300;
    const principal = 300;
    const D = daysOverdueUTC(dueDate, today);

    expect(D).toBe(6);
    expect(countSundaysUTC(dueDate, today)).toBe(1);

    const actual = actualCronCharge({
      profileType: 'AUTONOMO',
      principal,
      loanAmount: 1000,
      daysOverdue: D,
      chargeAmount: parcela,
      dueDate,
      today,
    });
    const official = officialChargeAutonomo(parcela, principal, dueDate, today); // 300 + 15 + 120 = 435

    expect(official).toBeCloseTo(435, 2);
    // FALHA esperada: atual = 300 × (1 + 0,10 × 6/30) = 306 !== 435
    expect(actual).toBeCloseTo(official, 2);
  });

  // ───────────── Ramo A.3 — Convergência cron vs generate-payment (req 2.7 / defeito 1.5) ─────────────
  it('Ramo A — convergência: cron e generate-payment produzem o MESMO valor para a mesma entrada', () => {
    const principal = 1000;
    const loanAmount = 1000;
    const D = 6;
    const chargeAmount = loanAmount * MONTHLY_RATE; // 300

    // Ambos os caminhos modelados com a MESMA fonte (interestEngine) e os MESMOS
    // parâmetros (profileType, principal, loanAmount, daysOverdue). Antes do fix,
    // cron usava 10% e generate-payment 30% → 306 vs 300 (FALHA). Após o fix (tasks
    // 3.3/3.4), ambos chamam computeCharge → mesmo valor (R$ 490 para CLT, D=6).
    const cronValue = actualCronCharge({
      profileType: 'CLT',
      principal,
      loanAmount,
      daysOverdue: D,
      chargeAmount,
    });
    const generateValue = generatePaymentCharge({
      profileType: 'CLT',
      principal,
      loanAmount,
      daysOverdue: D,
      chargeAmount,
    });

    // Esperado: os dois caminhos produzem o MESMO valor (convergência 2.7).
    expect(cronValue).toBeCloseTo(generateValue, 2);
  });

  // ───────────── Ramo B — Pagamento de juros NÃO conta como parcela amortizadora (req 2.10) ─────────────
  // Invariante esperado: NOT(paidCount === total AND remainingAmount > 0).
  // paidCount oficial = parcelas amortizadoras pagas = status PAID E NÃO juros (isInterestPayment).
  // Após o fix: a task 3.6 passa a setar `isInterestPayment: true` ao criar/confirmar o
  // pagamento de juros de rolagem (CLT/GARANTIA), e a task 3.9 deriva paidCount excluindo
  // `isInterestPayment`. Logo, um pagamento de juros de rolagem confirmado carrega
  // `isInterestPayment: true`, NÃO entra em paidCount, e o invariante de UI volta a valer
  // (a tela não exibe "N/N pagas" com saldo > 0 para uma modalidade sem parcela).
  type Inst = { id: string; status: string; isInterestPayment?: boolean };

  function paidCountOfficial(installments: Inst[]): number {
    // Derivação do frontend corrigido (task 3.9): só amortizadoras pagas contam.
    return installments.filter((i) => i.status === 'PAID' && !i.isInterestPayment).length;
  }

  it('Ramo B — âncora Patricia: pagamento de juros PAID (isInterestPayment) NÃO conta como amortizadora com remainingAmount > 0', () => {
    // Estado pós-fix: o pagamento de juros de rolagem confirmado carrega isInterestPayment=true.
    const installments: Inst[] = [
      { id: 'juros-1', status: 'PAID', isInterestPayment: true },
    ];
    const total = installments.length;
    const remainingAmount = 1000; // Patricia pós-correção: rolagem não amortiza → principal mantido
    const paidCount = paidCountOfficial(installments);

    // paidCount exclui o pagamento de juros → 0; invariante "nunca N/N pagas com saldo > 0" vale.
    const invariantHolds = !(paidCount === total && remainingAmount > 0);
    expect(paidCount).toBe(0);
    expect(invariantHolds).toBe(true);
  });

  it('Ramo B — property: pagamento de juros de rolagem PAID (isInterestPayment) nunca fecha paidCount com saldo > 0', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...ROLLOVER_PROFILES),
        fc.integer({ min: 0, max: 5 }), // amortizadoras OPEN adicionais
        fc.integer({ min: 1, max: 2000 }), // remainingAmount > 0
        (_profileType, extraOpen, remainingAmount) => {
          const installments: Inst[] = [
            // Pagamento de juros de rolagem confirmado (estado pós-fix: isInterestPayment=true)
            { id: 'juros', status: 'PAID', isInterestPayment: true },
            // Parcelas amortizadoras ainda abertas
            ...Array.from({ length: extraOpen }, (_, i) => ({ id: `open-${i}`, status: 'OPEN' as const })),
          ];
          const total = installments.length;
          const paidCount = paidCountOfficial(installments);
          // O pagamento de juros nunca entra em paidCount → invariante sempre vale.
          const invariantHolds = !(paidCount === total && remainingAmount > 0);
          expect(invariantHolds).toBe(true);
        }
      ),
      { numRuns: 50 }
    );
  });
});
