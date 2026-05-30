/**
 * Property tests de FIX CHECKING e PRESERVATION CHECKING do `interestEngine`
 * — Task 3.2 do bugfix spec "correcao-calculo-juros-parcelas".
 *
 * Estes testes exercitam DIRETAMENTE a função pura `computeCharge` (e o helper
 * `resolveMonthlyRate`) do engine — a fonte única de cálculo criada na Task 3.1.
 * Diferente de `interestEngine.bug.test.ts` (exploração da bug condition) e de
 * `interestEngine.preservation.test.ts` (baseline observation-first via seam),
 * AQUI importamos o engine de verdade (módulo 100% puro, sem Prisma/I/O) e
 * verificamos que o COMPORTAMENTO CORRIGIDO satisfaz as Correctness Properties
 * do design. Devem PASSAR contra o engine atual (já corrigido).
 *
 * Princípio anti-tautologia: o valor esperado é RE-DERIVADO da fórmula oficial
 * (design.md > officialCharge) dentro do próprio teste — NUNCA chamando o engine
 * para calcular o esperado. Comparamos engine.total vs esperado independente.
 *
 * Framework: fast-check + vitest. Rodar com: vitest --run (nunca watch).
 *
 * **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7**
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  computeCharge,
  resolveMonthlyRate,
  resolveSundayPolicyForFine,
  DEFAULT_MONTHLY_RATE,
  DEFAULT_LATE_FEE_DAILY,
  DEFAULT_FINE_PERCENT,
  DEFAULT_SUNDAY_POLICY_FOR_FINE,
  type ComputeChargeParams,
} from '../interestEngine';

// ───────────────────────────────────────────────────────────────────────────
// Constantes oficiais (design.md) — re-declaradas aqui para independência.
// ───────────────────────────────────────────────────────────────────────────
const MONTHLY_RATE = 0.30; // 30% a.m. (default oficial — NUNCA 0.10)
const FINE_PERCENT = 0.07; // 7% sobre o valor emprestado (CLT/GARANTIA)
const LATE_FEE_DAILY = 20; // R$ 20,00 por dia corrido de atraso
const FORBIDDEN_RATE = 0.10; // a taxa bugada que jamais deve reaparecer

const ROLLOVER_PROFILES = ['CLT', 'GARANTIA', 'GARANTIA_VEICULO'] as const;
const OUT_OF_SCOPE_PROFILES = ['LIMPA_NOME', 'INVESTIDOR'] as const;

const MS_PER_DAY = 1000 * 60 * 60 * 24;

// ───────────────────────────────────────────────────────────────────────────
// Comparação robusta a ponto flutuante: tolerância absoluta + relativa.
// (valores chegam a ~1e6; toBeCloseTo(_,6) seria estrito demais nessa escala).
// ───────────────────────────────────────────────────────────────────────────
function approxEqual(a: number, b: number, tol = 1e-6): boolean {
  return Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));
}
function expectClose(actual: number, expected: number): void {
  expect(
    approxEqual(actual, expected),
    `expected ${actual} ≈ ${expected} (Δ=${Math.abs(actual - expected)})`
  ).toBe(true);
}

// ───────────────────────────────────────────────────────────────────────────
// Re-derivação INDEPENDENTE da fórmula oficial (não chama o engine).
// ───────────────────────────────────────────────────────────────────────────

/** Conta domingos no intervalo SEMI-ABERTO (dueDate, today] em UTC. */
function countSundaysUTCRef(dueDate: Date, today: Date): number {
  const startOfDay = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  let count = 0;
  const start = startOfDay(dueDate);
  const end = startOfDay(today);
  for (let t = start + MS_PER_DAY; t <= end; t += MS_PER_DAY) {
    if (new Date(t).getUTCDay() === 0) count++;
  }
  return count;
}

/** Oficial CLT/GARANTIA/GARANTIA_VEICULO (rollover). */
function officialRollover(principal: number, loanAmount: number, D: number, rate: number): number {
  const jurosMes = principal * rate;
  if (D <= 0) return jurosMes; // não venceu: só juros do mês (req 2.3)
  const multa7 = loanAmount * FINE_PERCENT; // uma vez por ciclo (req 2.4)
  const multaDiaria = D * LATE_FEE_DAILY; // dias corridos (req 2.2)
  return jurosMes + multa7 + multaDiaria;
}

/** Oficial AUTONOMO: juros de mora 30% excluindo domingos + R$20/dia, SEM 7%. */
function officialAutonomo(
  base: number,
  principal: number,
  D: number,
  rate: number,
  dueDate: Date,
  today: Date
): number {
  const sundays = countSundaysUTCRef(dueDate, today);
  const diasJuros = Math.max(0, D - sundays);
  const jurosMora = principal * rate * (diasJuros / 30);
  const multaDiaria = Math.max(0, D) * LATE_FEE_DAILY; // CORRIDO (sem 7%, req 2.5)
  return base + jurosMora + multaDiaria;
}

// ───────────────────────────────────────────────────────────────────────────
// Arbitraries (geradores) — constrangem o espaço de entrada de forma inteligente.
// ───────────────────────────────────────────────────────────────────────────
const arbMoney = fc.double({ min: 0.01, max: 1_000_000, noNaN: true, noDefaultInfinity: true });
const arbDaysOverdue = fc.integer({ min: 0, max: 120 });
const arbDaysOverduePositive = fc.integer({ min: 1, max: 120 });
// taxa mensal plausível que NÃO inclui a taxa proibida 0.10.
const arbRate = fc
  .double({ min: 0.15, max: 0.6, noNaN: true, noDefaultInfinity: true })
  .filter((r) => Math.abs(r - FORBIDDEN_RATE) > 1e-9);
// dueDate como dias-desde-epoch (UTC midnight) → evita ruído de fuso/DST.
const arbDueDateDays = fc.integer({ min: 18000, max: 20000 }); // ~2019–2024

// ═══════════════════════════════════════════════════════════════════════════
// PROPERTY 1 — FIX CHECKING: total == officialCharge(...) por modalidade.
//   _Requirements: 2.1, 2.2, 2.4, 2.5, 2.6, 2.7_
// ═══════════════════════════════════════════════════════════════════════════
describe('Property 1: Fix Checking — computeCharge.total == fórmula oficial', () => {
  it('CLT/GARANTIA/GARANTIA_VEICULO: total == (principal×rate) + (loanAmount×7% se D>0) + (D×20)', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...ROLLOVER_PROFILES),
        arbMoney,
        arbMoney,
        arbDaysOverdue,
        arbRate,
        (profileType, principal, loanAmount, D, rate) => {
          const result = computeCharge({ profileType, principal, loanAmount, daysOverdue: D, monthlyRate: rate });
          const expected = officialRollover(principal, loanAmount, D, rate);
          expectClose(result.total, expected);
          // nunca a taxa bugada de 10%
          expect(result.usedRate).not.toBe(FORBIDDEN_RATE);
          expect(result.usedRate).toBe(rate);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('CLT em atraso usa o default 0.30 quando monthlyRate não é informado (nunca 0.10)', () => {
    fc.assert(
      fc.property(arbMoney, arbMoney, arbDaysOverduePositive, (principal, loanAmount, D) => {
        const result = computeCharge({ profileType: 'CLT', principal, loanAmount, daysOverdue: D });
        const expected = officialRollover(principal, loanAmount, D, DEFAULT_MONTHLY_RATE);
        expectClose(result.total, expected);
        expect(result.usedRate).toBe(DEFAULT_MONTHLY_RATE);
        expect(result.usedRate).toBe(0.30);
        expect(result.usedRate).not.toBe(FORBIDDEN_RATE);
      }),
      { numRuns: 100 }
    );
  });

  it('AUTONOMO: total == base + jurosMora(30% excluindo domingos) + (D×20), SEM os 7%', () => {
    fc.assert(
      fc.property(
        arbMoney, // base (diária)
        arbMoney, // principal
        arbMoney, // loanAmount (não deve influenciar — sem 7% no AUTONOMO)
        arbDaysOverduePositive,
        arbRate,
        arbDueDateDays,
        (base, principal, loanAmount, D, rate, dueDays) => {
          const dueDate = new Date(dueDays * MS_PER_DAY);
          const today = new Date((dueDays + D) * MS_PER_DAY);
          const result = computeCharge({
            profileType: 'AUTONOMO',
            principal,
            loanAmount,
            base,
            daysOverdue: D,
            dueDate,
            today,
            monthlyRate: rate,
          });
          const expected = officialAutonomo(base, principal, D, rate, dueDate, today);
          expectClose(result.total, expected);
          // AUTONOMO nunca aplica o componente de 7%
          expect(result.multa7).toBe(0);
          expect(result.usedRate).toBe(rate);
          expect(result.usedRate).not.toBe(FORBIDDEN_RATE);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('AUTONOMO: domingos no intervalo reduzem os dias de juros (req 2.6)', () => {
    // dueDate 2024-03-04 (seg), today 2024-03-11 (seg) → D=7, 1 domingo (10/03).
    const dueDate = new Date(Date.UTC(2024, 2, 4));
    const today = new Date(Date.UTC(2024, 2, 11));
    const D = 7;
    const principal = 3000;
    const base = 100;
    const result = computeCharge({
      profileType: 'AUTONOMO',
      principal,
      loanAmount: principal,
      base,
      daysOverdue: D,
      dueDate,
      today,
      monthlyRate: MONTHLY_RATE,
    });
    // diasJuros = 7 - 1 = 6; jurosMora = 3000 × 0,30 × 6/30 = 180; multaDiaria = 7 × 20 = 140.
    const expected = base + 3000 * 0.3 * (6 / 30) + 7 * 20; // 100 + 180 + 140 = 420
    expectClose(result.total, expected);
    expect(result.total).toBeCloseTo(420, 6);
  });

  it('FIX CHECKING: o componente 7% é aplicado no máximo UMA vez e é INDEPENDENTE de D (rollover)', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...ROLLOVER_PROFILES),
        arbMoney,
        arbMoney,
        arbDaysOverduePositive,
        arbDaysOverduePositive,
        arbRate,
        (profileType, principal, loanAmount, d1, d2, rate) => {
          const r1 = computeCharge({ profileType, principal, loanAmount, daysOverdue: d1, monthlyRate: rate });
          const r2 = computeCharge({ profileType, principal, loanAmount, daysOverdue: d2, monthlyRate: rate });
          // o 7% é sempre loanAmount×0,07, idêntico para qualquer D>0
          expectClose(r1.multa7, loanAmount * FINE_PERCENT);
          expectClose(r2.multa7, loanAmount * FINE_PERCENT);
          expectClose(r1.multa7, r2.multa7);
          // a ÚNICA parte dependente de D é a multa diária: total(d1)-total(d2) == 20×(d1-d2)
          expectClose(r1.total - r2.total, LATE_FEE_DAILY * (d1 - d2));
        }
      ),
      { numRuns: 200 }
    );
  });

  it('usedRate JAMAIS é 0.10 — para qualquer perfil e qualquer entrada (default 0.30 quando aplicável)', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...ROLLOVER_PROFILES, 'AUTONOMO', 'MOTO', ...OUT_OF_SCOPE_PROFILES),
        arbMoney,
        arbMoney,
        arbDaysOverdue,
        (profileType, principal, loanAmount, D) => {
          const result = computeCharge({ profileType, principal, loanAmount, daysOverdue: D });
          expect(result.usedRate).not.toBe(FORBIDDEN_RATE);
        }
      ),
      { numRuns: 200 }
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// PROPERTY 2 — PRESERVATION CHECKING.
//   _Requirements: 2.1, 2.3, 2.5, 3.2 (D=0); 3.4, 3.5 (fora de escopo)_
// ═══════════════════════════════════════════════════════════════════════════
describe('Property 2: Preservation — D=0 sem multas; MOTO/serviço/investimento sem juros de mora', () => {
  it('D=0 em QUALQUER perfil: nenhum 7% e nenhuma multa diária', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...ROLLOVER_PROFILES, 'AUTONOMO', 'MOTO', ...OUT_OF_SCOPE_PROFILES),
        arbMoney,
        arbMoney,
        (profileType, principal, loanAmount) => {
          const result = computeCharge({ profileType, principal, loanAmount, daysOverdue: 0 });
          expect(result.multa7).toBe(0);
          expect(result.multaDiaria).toBe(0);
        }
      ),
      { numRuns: 150 }
    );
  });

  it('D=0 rollover: total == apenas o juros do mês (principal × rate); sem 7%/R$20', () => {
    fc.assert(
      fc.property(fc.constantFrom(...ROLLOVER_PROFILES), arbMoney, arbMoney, arbRate, (profileType, principal, loanAmount, rate) => {
        const result = computeCharge({ profileType, principal, loanAmount, daysOverdue: 0, monthlyRate: rate });
        expectClose(result.total, principal * rate);
        expectClose(result.jurosMes, principal * rate);
        // garante que o 7% NÃO foi somado: o componente da multa é exatamente zero
        // (checagem direta e robusta — independe da escala de principal/loanAmount).
        expect(result.multa7).toBe(0);
        expect(result.multaDiaria).toBe(0);
      }),
      { numRuns: 150 }
    );
  });

  it('MOTO: retorna a parcela base sem juros de mora (usedRate 0)', () => {
    fc.assert(
      fc.property(arbMoney, arbDaysOverdue, (base, D) => {
        const result = computeCharge({ profileType: 'MOTO', principal: base, loanAmount: base, base, daysOverdue: D });
        expectClose(result.total, base);
        expect(result.usedRate).toBe(0);
        expect(result.multa7).toBe(0);
        expect(result.multaDiaria).toBe(0);
      }),
      { numRuns: 100 }
    );
  });

  it('LIMPA_NOME/INVESTIDOR: fora do escopo de mora — total == base, usedRate 0, p/ qualquer D', () => {
    fc.assert(
      fc.property(fc.constantFrom(...OUT_OF_SCOPE_PROFILES), arbMoney, arbDaysOverdue, (profileType, base, D) => {
        const result = computeCharge({ profileType, principal: base, loanAmount: base, base, daysOverdue: D });
        expectClose(result.total, base);
        expect(result.usedRate).toBe(0);
        expect(result.multa7).toBe(0);
        expect(result.multaDiaria).toBe(0);
      }),
      { numRuns: 100 }
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// PROPERTY 2 (cont.) — Cascata de resolução de taxa (resolveMonthlyRate).
//   contrato → customer → systemSetting → 0.30. _Requirements: 2.1_
// ═══════════════════════════════════════════════════════════════════════════
describe('Property 2: Preservation — resolveMonthlyRate respeita a precedência da cascata', () => {
  it('âncoras de precedência (contrato > customer > systemSetting > default 0.30)', () => {
    expect(resolveMonthlyRate({ contractRate: 0.25, customerRate: 0.28, systemSettingRate: 0.30 })).toBe(0.25);
    expect(resolveMonthlyRate({ contractRate: null, customerRate: 0.28, systemSettingRate: 0.30 })).toBe(0.28);
    expect(resolveMonthlyRate({ contractRate: null, customerRate: null, systemSettingRate: 0.42 })).toBe(0.42);
    const def = resolveMonthlyRate({ contractRate: null, customerRate: null, systemSettingRate: null });
    expect(def).toBe(DEFAULT_MONTHLY_RATE);
    expect(def).toBe(0.30);
    expect(def).not.toBe(FORBIDDEN_RATE);
  });

  it('property: resolve a primeira fonte definida na ordem; senão o default 0.30', () => {
    const optRate = fc.option(
      fc.double({ min: 0.01, max: 1, noNaN: true, noDefaultInfinity: true }),
      { nil: null }
    );
    fc.assert(
      fc.property(optRate, optRate, optRate, (contractRate, customerRate, systemSettingRate) => {
        const resolved = resolveMonthlyRate({ contractRate, customerRate, systemSettingRate });
        const expected =
          contractRate != null
            ? contractRate
            : customerRate != null
            ? customerRate
            : systemSettingRate != null
            ? systemSettingRate
            : DEFAULT_MONTHLY_RATE;
        expect(resolved).toBe(expected);
      }),
      { numRuns: 150 }
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// PROPERTY METAMÓRFICA — Convergência (req 2.7): mesma entrada (caminho do cron
// e do generate-payment) → mesmo total. computeCharge é determinístico, e a taxa
// resolvida via SystemSetting(0.30) vs default(0.30) alimenta o MESMO total.
//   _Requirements: 2.7_
// ═══════════════════════════════════════════════════════════════════════════
describe('Property metamórfica: Convergência cron == generate-payment (req 2.7)', () => {
  it('mesmos parâmetros → ChargeBreakdown idêntico (determinismo)', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...ROLLOVER_PROFILES, 'AUTONOMO', 'MOTO', ...OUT_OF_SCOPE_PROFILES),
        arbMoney,
        arbMoney,
        arbDaysOverdue,
        arbRate,
        (profileType, principal, loanAmount, D, rate) => {
          const params: ComputeChargeParams = {
            profileType,
            principal,
            loanAmount,
            base: principal,
            daysOverdue: D,
            monthlyRate: rate,
          };
          // "Caminho do cron" e "caminho do generate-payment" constroem os MESMOS
          // params e chamam a MESMA função pura → resultado profundamente igual.
          const cronResult = computeCharge({ ...params });
          const generateResult = computeCharge({ ...params });
          expect(cronResult).toEqual(generateResult);
          expect(cronResult.total).toBe(generateResult.total);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('taxa via SystemSetting(0.30) vs default(0.30) → total idêntico', () => {
    fc.assert(
      fc.property(fc.constantFrom(...ROLLOVER_PROFILES), arbMoney, arbMoney, arbDaysOverdue, (profileType, principal, loanAmount, D) => {
        // Caminho A (generate-payment): taxa lida de SystemSetting("monthlyInterestRate") = "30" → 0.30.
        const rateFromSetting = resolveMonthlyRate({ systemSettingRate: 0.30 });
        // Caminho B (cron, sem setting): cai no default da cascata = 0.30.
        const rateFromDefault = resolveMonthlyRate({});
        expect(rateFromSetting).toBe(rateFromDefault);

        const a = computeCharge({ profileType, principal, loanAmount, daysOverdue: D, monthlyRate: rateFromSetting });
        const b = computeCharge({ profileType, principal, loanAmount, daysOverdue: D, monthlyRate: rateFromDefault });
        expect(a.total).toBe(b.total);
        expect(a).toEqual(b);
      }),
      { numRuns: 150 }
    );
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Sanidade dos defaults exportados (coerência das constantes oficiais).
// ───────────────────────────────────────────────────────────────────────────
describe('Sanidade — constantes oficiais do engine', () => {
  it('defaults: 0.30 / R$20 / 7% (e nunca 0.10)', () => {
    expect(DEFAULT_MONTHLY_RATE).toBe(0.30);
    expect(DEFAULT_MONTHLY_RATE).not.toBe(FORBIDDEN_RATE);
    expect(DEFAULT_LATE_FEE_DAILY).toBe(20);
    expect(DEFAULT_FINE_PERCENT).toBe(0.07);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// TASK 5.1 (OPCIONAL) — Parametrização de sundayPolicyForFine (multa diária).
//
// A multa diária do AUTONOMO é parametrizável SEM mudar código:
//   - 'CORRIDO' (DEFAULT): multa = D × R$20 (dias corridos, inclui domingo).
//     DEVE preservar EXATAMENTE o comportamento atual.
//   - 'PULA_DOMINGO': multa = (D − domingos) × R$20 (exclui domingos).
//
// Invariantes verificados:
//   (a) default == comportamento atual (multa = D×20) e == omitir o parâmetro;
//   (b) PULA_DOMINGO == (D − domingos)×20;
//   (c) a política NÃO afeta CLT/GARANTIA (multa sempre D×20, dias corridos);
//   (d) a política NÃO afeta o juros de mora já coberto (req 2.6 — sempre exclui
//       domingos da contagem de juros, independente da política da multa);
//   (e) resolveSundayPolicyForFine resolve config → política, falha-segura.
//
//   _Requirements: 2.6_
// ═══════════════════════════════════════════════════════════════════════════
describe('Task 5.1 — sundayPolicyForFine parametrizável (multa diária do AUTONOMO)', () => {
  // âncora determinística com domingo garantido no intervalo:
  // dueDate 2024-03-04 (seg), today 2024-03-11 (seg) → D=7, 1 domingo (10/03).
  const dueDate = new Date(Date.UTC(2024, 2, 4));
  const today = new Date(Date.UTC(2024, 2, 11));
  const D = 7;

  it('default CORRIDO: AUTONOMO multa diária == D×20 (inclui domingo) — comportamento atual', () => {
    const base = 100;
    const principal = 3000;
    const r = computeCharge({
      profileType: 'AUTONOMO', principal, loanAmount: principal, base,
      daysOverdue: D, dueDate, today, monthlyRate: MONTHLY_RATE,
      sundayPolicyForFine: 'CORRIDO',
    });
    // multa = 7 × 20 = 140 (dias corridos, inclui o domingo 10/03)
    expectClose(r.multaDiaria, D * LATE_FEE_DAILY);
    expect(r.multaDiaria).toBeCloseTo(140, 6);
  });

  it('omitir o parâmetro == passar CORRIDO (retrocompatibilidade do default)', () => {
    const base = 100, principal = 3000;
    const omitted = computeCharge({
      profileType: 'AUTONOMO', principal, loanAmount: principal, base,
      daysOverdue: D, dueDate, today, monthlyRate: MONTHLY_RATE,
    });
    const corrido = computeCharge({
      profileType: 'AUTONOMO', principal, loanAmount: principal, base,
      daysOverdue: D, dueDate, today, monthlyRate: MONTHLY_RATE,
      sundayPolicyForFine: 'CORRIDO',
    });
    expect(omitted).toEqual(corrido);
    expect(DEFAULT_SUNDAY_POLICY_FOR_FINE).toBe('CORRIDO');
  });

  it('PULA_DOMINGO: AUTONOMO multa diária == (D − domingos)×20', () => {
    const base = 100, principal = 3000;
    const r = computeCharge({
      profileType: 'AUTONOMO', principal, loanAmount: principal, base,
      daysOverdue: D, dueDate, today, monthlyRate: MONTHLY_RATE,
      sundayPolicyForFine: 'PULA_DOMINGO',
    });
    // diasMulta = 7 − 1 domingo = 6 → multa = 6 × 20 = 120
    expectClose(r.multaDiaria, (D - 1) * LATE_FEE_DAILY);
    expect(r.multaDiaria).toBeCloseTo(120, 6);
  });

  it('property AUTONOMO: CORRIDO == D×20; PULA_DOMINGO == (D−domingos)×20; CORRIDO >= PULA_DOMINGO', () => {
    fc.assert(
      fc.property(arbMoney, arbMoney, arbDaysOverduePositive, arbRate, arbDueDateDays,
        (base, principal, D, rate, dueDays) => {
          const dd = new Date(dueDays * MS_PER_DAY);
          const td = new Date((dueDays + D) * MS_PER_DAY);
          const sundays = countSundaysUTCRef(dd, td);

          const corrido = computeCharge({
            profileType: 'AUTONOMO', principal, loanAmount: principal, base,
            daysOverdue: D, dueDate: dd, today: td, monthlyRate: rate,
            sundayPolicyForFine: 'CORRIDO',
          });
          const pula = computeCharge({
            profileType: 'AUTONOMO', principal, loanAmount: principal, base,
            daysOverdue: D, dueDate: dd, today: td, monthlyRate: rate,
            sundayPolicyForFine: 'PULA_DOMINGO',
          });

          expectClose(corrido.multaDiaria, D * LATE_FEE_DAILY);
          expectClose(pula.multaDiaria, Math.max(0, D - sundays) * LATE_FEE_DAILY);
          // pular domingos nunca aumenta a multa
          expect(pula.multaDiaria).toBeLessThanOrEqual(corrido.multaDiaria + 1e-9);
          // a política NÃO afeta o juros de mora (já exclui domingos por regra)
          expectClose(corrido.jurosMes, pula.jurosMes);
          // diferença das multas == domingos × 20
          expectClose(corrido.multaDiaria - pula.multaDiaria, sundays * LATE_FEE_DAILY);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('property: a política NÃO afeta CLT/GARANTIA (multa diária sempre D×20, dias corridos)', () => {
    fc.assert(
      fc.property(fc.constantFrom(...ROLLOVER_PROFILES), arbMoney, arbMoney, arbDaysOverduePositive, arbRate, arbDueDateDays,
        (profileType, principal, loanAmount, D, rate, dueDays) => {
          const dd = new Date(dueDays * MS_PER_DAY);
          const td = new Date((dueDays + D) * MS_PER_DAY);
          const corrido = computeCharge({
            profileType, principal, loanAmount, daysOverdue: D, dueDate: dd, today: td,
            monthlyRate: rate, sundayPolicyForFine: 'CORRIDO',
          });
          const pula = computeCharge({
            profileType, principal, loanAmount, daysOverdue: D, dueDate: dd, today: td,
            monthlyRate: rate, sundayPolicyForFine: 'PULA_DOMINGO',
          });
          // rollover ignora a política: total e multa diária idênticos
          expect(corrido).toEqual(pula);
          expectClose(corrido.multaDiaria, D * LATE_FEE_DAILY);
        }
      ),
      { numRuns: 150 }
    );
  });

  it('resolveSundayPolicyForFine: default CORRIDO; só "PULA_DOMINGO" (case/trim-insensitive) flipa', () => {
    // falha-segura: ausência/valores desconhecidos → CORRIDO (preserva o atual)
    expect(resolveSundayPolicyForFine(null)).toBe('CORRIDO');
    expect(resolveSundayPolicyForFine(undefined)).toBe('CORRIDO');
    expect(resolveSundayPolicyForFine('')).toBe('CORRIDO');
    expect(resolveSundayPolicyForFine('CORRIDO')).toBe('CORRIDO');
    expect(resolveSundayPolicyForFine('qualquer-coisa')).toBe('CORRIDO');
    // flip explícito e auditável
    expect(resolveSundayPolicyForFine('PULA_DOMINGO')).toBe('PULA_DOMINGO');
    expect(resolveSundayPolicyForFine('  pula_domingo  ')).toBe('PULA_DOMINGO');
    expect(resolveSundayPolicyForFine('Pula_Domingo')).toBe('PULA_DOMINGO');
  });

  it('property resolveSundayPolicyForFine: qualquer string != PULA_DOMINGO resolve para CORRIDO', () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        const expected = s.trim().toUpperCase() === 'PULA_DOMINGO' ? 'PULA_DOMINGO' : 'CORRIDO';
        expect(resolveSundayPolicyForFine(s)).toBe(expected);
      }),
      { numRuns: 200 }
    );
  });
});
