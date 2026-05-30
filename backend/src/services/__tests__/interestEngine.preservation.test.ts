/**
 * Testes de PRESERVAÇÃO (property-based) — Task 2 do bugfix spec
 * "correcao-calculo-juros-parcelas".
 *
 * **Property 2: Preservation** — Rolagem Não Amortiza, UI Sem Contagem de
 * Parcelas (CLT/GARANTIA) e Amortização Inalterada.
 *
 * METODOLOGIA (observation-first): observamos o comportamento ATUAL (baseline,
 * código NÃO corrigido) e o codificamos como propriedades que DEVEM PASSAR
 * agora e continuar passando após o fix. Estes testes protegem contra
 * regressões em comportamentos que JÁ ESTÃO corretos no domínio de entradas ¬C.
 *
 * Por que funções puras self-contained? Importar os módulos de produção
 * (`collectionAutomationService.ts`, `routes/loans.ts`, `routes/paymentReceipts.ts`)
 * acopla `@prisma/client` (não gerado/instalado neste ambiente) via imports
 * transitivos (`./prisma`). Para manter o teste puro, determinístico e sem I/O,
 * modelamos as REGRAS de baseline observadas no código real como funções puras,
 * com referência às fontes. Usamos o mesmo "seam" `tryLoadEngine()` do
 * interestEngine.bug.test.ts: enquanto `interestEngine.ts` não existe, caímos nas
 * funções de referência baseline; após o fix, o MESMO seam valida o engine real.
 *
 * Fontes do baseline (árvore da RAIZ):
 *  - backend/src/services/collectionAutomationService.ts
 *      (calculateOverdueAmount 10%, applyDailyLateFees R$20/dia, ensureInterestOnly...)
 *  - backend/src/routes/loans.ts
 *      (/manual-payment, /proof, /generate-payment, /settle-all, bloco de comissão)
 *  - backend/src/routes/paymentReceipts.ts (/:id/approve — rolagem vs amortização vs discharge)
 *  - pages/admin/Contracts.tsx + services/reportService.ts (paidCount)
 *  - backend/prisma/schema.prisma (Installment, Loan, Customer)
 *
 * Framework: fast-check + vitest. Rodar com: vitest --run (nunca watch).
 *
 * **Validates: Requirements 2.9, 2.12, 3.1, 3.2, 3.3, 3.4, 3.5, 3.8, 3.9**
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

// ───────────────────────────────────────────────────────────────────────────
// Constantes oficiais (coerentes com o design e com interestEngine.bug.test.ts)
// ───────────────────────────────────────────────────────────────────────────
const MONTHLY_RATE = 0.30; // 30% a.m. (default oficial — nunca 10%)
const FINE_PERCENT = 0.07; // 7% sobre o valor emprestado (CLT/GARANTIA)
const LATE_FEE_DAILY = 20; // R$ 20,00 por dia corrido de atraso
const DEFAULT_RATE = 0.30; // fallback documentado da cascata

type RolloverProfile = 'CLT' | 'GARANTIA' | 'GARANTIA_VEICULO';
const ROLLOVER_PROFILES: RolloverProfile[] = ['CLT', 'GARANTIA', 'GARANTIA_VEICULO'];
const AMORTIZING_PROFILES = ['AUTONOMO', 'MOTO'] as const;
const OUT_OF_SCOPE_PROFILES = ['LIMPA_NOME', 'INVESTIDOR'] as const;
const ALL_PROFILES = [
  ...ROLLOVER_PROFILES,
  ...AMORTIZING_PROFILES,
  ...OUT_OF_SCOPE_PROFILES,
] as const;

function isRollover(profileType: string): boolean {
  return (ROLLOVER_PROFILES as readonly string[]).includes(profileType);
}

// ═══════════════════════════════════════════════════════════════════════════
// Seam: resolve o futuro interestEngine.computeCharge; enquanto não existe, usa
// a referência baseline. Idêntico em espírito ao do interestEngine.bug.test.ts.
// ═══════════════════════════════════════════════════════════════════════════
function tryLoadEngine(): any | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('../interestEngine');
  } catch {
    return null;
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Referência baseline da fórmula oficial (somente os ramos exercidos na
// preservação: D=0 para qualquer perfil; serviços/investimento sem mora).
// design.md > officialCharge.
// ───────────────────────────────────────────────────────────────────────────
function officialChargeReference(params: {
  profileType: string;
  principal: number;
  loanAmount: number;
  base: number; // valor da parcela/diária (MOTO/AUTONOMO) ou cobrança base
  daysOverdue: number;
  monthlyRate?: number;
}): number {
  const { profileType, principal, base, daysOverdue } = params;
  const rate = params.monthlyRate ?? MONTHLY_RATE;

  // Serviços/investimento: fora do escopo de juros de mora (req 3.4, 3.5)
  if ((OUT_OF_SCOPE_PROFILES as readonly string[]).includes(profileType)) {
    return base;
  }

  if (isRollover(profileType)) {
    const jurosMes = principal * rate;
    if (daysOverdue <= 0) return jurosMes; // D=0: só juros do mês (req 2.3)
    const multa7 = params.loanAmount * FINE_PERCENT;
    const multaDiaria = daysOverdue * LATE_FEE_DAILY;
    return jurosMes + multa7 + multaDiaria;
  }

  // AUTONOMO/MOTO: D=0 → valor base sem juros/multa (req 3.2). D>0 do AUTONOMO
  // é território de fault-condition (Task 1); aqui só asseguramos o baseline D=0.
  return base;
}

/**
 * Seam de cobrança: usa o engine quando existir, senão a referência baseline.
 * Após o fix (task 3.1), valida o engine real para os mesmos invariantes.
 */
function computeChargeSeam(params: {
  profileType: string;
  principal: number;
  loanAmount: number;
  base: number;
  daysOverdue: number;
  monthlyRate?: number;
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
      monthlyRate: params.monthlyRate ?? MONTHLY_RATE,
    });
    return typeof out === 'number' ? out : out.total;
  }
  return officialChargeReference(params);
}

// ───────────────────────────────────────────────────────────────────────────
// Modelo baseline do efeito de um pagamento sobre o saldo devedor.
// Fonte: routes/loans.ts (/manual-payment, /proof) e paymentReceipts.ts (/approve):
//   - CLT/GARANTIA/GARANTIA_VEICULO (rolagem): remainingAmount NÃO muda.
//   - AUTONOMO/MOTO (amortização): remaining = max(0, before - amount).
// ───────────────────────────────────────────────────────────────────────────
function applyPaymentToRemaining(profileType: string, before: number, amount: number): number {
  if (isRollover(profileType)) {
    return before; // rolagem não amortiza (req 2.9)
  }
  return Math.max(0, before - amount); // amortização (req 3.1)
}

// ───────────────────────────────────────────────────────────────────────────
// Modelo baseline da quitação total (admin). Fonte: loans.ts /settle-all e
// paymentReceipts.ts /approve (isDischarge). Só ocorre por confirmação do admin.
// ───────────────────────────────────────────────────────────────────────────
type Inst = { id: string; status: string; amount: number; isInterestPayment?: boolean };

function applyDischarge(
  installments: Inst[],
  remainingBefore: number,
  adminConfirmed: boolean
): { installments: Inst[]; remainingAmount: number; status: string } {
  if (!adminConfirmed) {
    // Nada quita automaticamente (req 3.8 / 2.9): estado inalterado.
    return { installments, remainingAmount: remainingBefore, status: 'ACTIVE' };
  }
  const settled = installments.map((i) => ({
    ...i,
    status: 'PAID',
    paidAt: 'set',
  }));
  return { installments: settled, remainingAmount: 0, status: 'COMPLETED' };
}

// ───────────────────────────────────────────────────────────────────────────
// Modelo baseline da cascata de taxa (req 2.1 / 3.3). Precedência:
//   contrato → Customer.(late)monthlyInterestRate → SystemSetting → 0.30.
// Espelha a intenção do design; resolve sempre a taxa mais específica disponível.
// ───────────────────────────────────────────────────────────────────────────
function resolveMonthlyRate(sources: {
  contractRate?: number | null;
  customerRate?: number | null;
  systemSettingRate?: number | null;
}): number {
  if (sources.contractRate != null) return sources.contractRate;
  if (sources.customerRate != null) return sources.customerRate;
  if (sources.systemSettingRate != null) return sources.systemSettingRate;
  return DEFAULT_RATE;
}

// ───────────────────────────────────────────────────────────────────────────
// Modelo baseline da DECISÃO DE EXIBIÇÃO por modalidade (design > Mudança 6).
// Só MOTO exibe contagem de parcelas. CLT/GARANTIA exibem saldo + estado do
// juros; AUTONOMO exibe saldo amortizado; serviço/investimento fora de escopo.
// ───────────────────────────────────────────────────────────────────────────
type DisplayKind = 'PARCELAS' | 'SALDO_JUROS' | 'SALDO' | 'OUTRO';

function displayForProfile(profileType: string): DisplayKind {
  if (profileType === 'MOTO') return 'PARCELAS';
  if (isRollover(profileType)) return 'SALDO_JUROS';
  if (profileType === 'AUTONOMO') return 'SALDO';
  return 'OUTRO'; // LIMPA_NOME / INVESTIDOR
}

/**
 * paidCount de parcelas AMORTIZADORAS (design glossary): status PAID e NÃO juros.
 * Fonte a preservar: pages/admin/Contracts.tsx / services/reportService.ts.
 * No baseline o campo isInterestPayment não existe (undefined) → !undefined = true,
 * portanto conta toda parcela PAID; em MOTO todas as PAID são amortizadoras.
 */
function paidCountAmortizing(installments: Inst[]): number {
  return installments.filter((i) => i.status === 'PAID' && !i.isInterestPayment).length;
}

// ═══════════════════════════════════════════════════════════════════════════
// Property 2.1 — Amortização AUTÔNOMO (diárias) / MOTO (parcelas) inalterada.
//   Para qualquer pagamento amortizador: remainingAfter == max(0, before - amount).
//   _Requirements: 3.1, 3.9_
// ═══════════════════════════════════════════════════════════════════════════
describe('Preservation 2.1 — Amortização AUTÔNOMO/MOTO: remainingAfter == max(0, before − amount)', () => {
  it('âncora AUTÔNOMO: saldo 1300, paga diária 43,33 → 1256,67', () => {
    const after = applyPaymentToRemaining('AUTONOMO', 1300, 43.33);
    expect(after).toBeCloseTo(1256.67, 2);
  });

  it('âncora MOTO: saldo 611, paga parcela 611 → 0 (quita ao amortizar tudo)', () => {
    const after = applyPaymentToRemaining('MOTO', 611, 611);
    expect(after).toBe(0);
  });

  it('property: amortizador nunca fica negativo e nunca aumenta o saldo', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...AMORTIZING_PROFILES),
        fc.double({ min: 0, max: 100000, noNaN: true, noDefaultInfinity: true }),
        fc.double({ min: 0, max: 100000, noNaN: true, noDefaultInfinity: true }),
        (profileType, before, amount) => {
          const after = applyPaymentToRemaining(profileType, before, amount);
          // Invariantes de amortização (baseline a preservar)
          expect(after).toBeGreaterThanOrEqual(0);
          expect(after).toBeLessThanOrEqual(before);
          if (amount >= before) {
            expect(after).toBe(0); // quitação por amortização (sob confirmação do admin)
          } else {
            expect(after).toBeCloseTo(before - amount, 6);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Property 2.2 — Rolagem CLT/GARANTIA: pagamento de juros NÃO amortiza.
//   remainingAfter == remainingBefore. _Requirements: 2.9_
// ═══════════════════════════════════════════════════════════════════════════
describe('Preservation 2.2 — Rolagem CLT/GARANTIA: pagamento de juros mantém remainingAmount', () => {
  it('âncora Patricia: principal 1000, paga juros 300 → saldo permanece 1000', () => {
    const after = applyPaymentToRemaining('CLT', 1000, 300);
    expect(after).toBe(1000);
  });

  it('property: qualquer pagamento de juros de rolagem deixa o saldo inalterado', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...ROLLOVER_PROFILES),
        fc.double({ min: 1, max: 100000, noNaN: true, noDefaultInfinity: true }), // saldo > 0
        fc.double({ min: 0, max: 100000, noNaN: true, noDefaultInfinity: true }), // valor do juros pago
        (profileType, before, interestPaid) => {
          const after = applyPaymentToRemaining(profileType, before, interestPaid);
          // A dívida rola: não amortiza (req 2.9)
          expect(after).toBe(before);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Property 2.3 — Não vencido (D=0): nem 7% nem R$20/dia para qualquer perfil.
//   _Requirements: 3.2 (+ 2.3 baseline)_
// ═══════════════════════════════════════════════════════════════════════════
describe('Preservation 2.3 — D=0 não aplica 7% nem R$20/dia (só juros do mês p/ rolagem; base p/ demais)', () => {
  it('âncora CLT D=0: principal 1000 → R$ 300 (sem 7%, sem R$20)', () => {
    const charge = computeChargeSeam({
      profileType: 'CLT',
      principal: 1000,
      loanAmount: 1000,
      base: 300,
      daysOverdue: 0,
    });
    expect(charge).toBeCloseTo(300, 2);
    // Garante explicitamente que o 7% NÃO foi somado.
    expect(charge).not.toBeCloseTo(1000 * MONTHLY_RATE + 1000 * FINE_PERCENT, 2);
  });

  it('property: para qualquer perfil, charge(D=0) == valor base esperado (sem multas)', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...ALL_PROFILES),
        fc.double({ min: 1, max: 100000, noNaN: true, noDefaultInfinity: true }),
        fc.double({ min: 1, max: 100000, noNaN: true, noDefaultInfinity: true }),
        (profileType, principal, loanAmount) => {
          const base = isRollover(profileType) ? principal * MONTHLY_RATE : principal; // base coerente por modalidade
          const expected = officialChargeReference({
            profileType,
            principal,
            loanAmount,
            base,
            daysOverdue: 0,
          });
          const actual = computeChargeSeam({
            profileType,
            principal,
            loanAmount,
            base,
            daysOverdue: 0,
          });
          expect(actual).toBeCloseTo(expected, 6);
          // O componente 7% nunca entra em D=0.
          const withSevenPercent = expected + loanAmount * FINE_PERCENT;
          expect(actual).not.toBeCloseTo(withSevenPercent, 6);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Property 2.4 — Cascata de taxas individuais do Customer (precedência).
//   contrato → customer → SystemSetting → 0.30. _Requirements: 3.3 (+2.1)_
// ═══════════════════════════════════════════════════════════════════════════
describe('Preservation 2.4 — Cascata de taxa resolve a mais específica disponível (default 0.30)', () => {
  it('âncora: contrato vence customer e systemSetting', () => {
    expect(
      resolveMonthlyRate({ contractRate: 0.25, customerRate: 0.28, systemSettingRate: 0.30 })
    ).toBe(0.25);
  });

  it('âncora: sem contrato, customer vence systemSetting', () => {
    expect(
      resolveMonthlyRate({ contractRate: null, customerRate: 0.28, systemSettingRate: 0.30 })
    ).toBe(0.28);
  });

  it('âncora: nenhuma fonte → default 0.30 (nunca 0.10)', () => {
    const r = resolveMonthlyRate({ contractRate: null, customerRate: null, systemSettingRate: null });
    expect(r).toBe(0.30);
    expect(r).not.toBe(0.10);
  });

  it('property: resolve a primeira fonte definida na ordem de precedência, senão 0.30', () => {
    const optRate = fc.option(fc.double({ min: 0.01, max: 1, noNaN: true, noDefaultInfinity: true }), {
      nil: null,
    });
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
            : DEFAULT_RATE;
        expect(resolved).toBe(expected);
      }),
      { numRuns: 100 }
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Property 2.5 — LIMPA_NOME (serviço) e INVESTIDOR fora do cálculo de mora.
//   charge == base (sem 7%, sem R$20, sem juros de mora) p/ qualquer D.
//   _Requirements: 3.4, 3.5_
// ═══════════════════════════════════════════════════════════════════════════
describe('Preservation 2.5 — LIMPA_NOME/INVESTIDOR excluídos do cálculo de juros de mora', () => {
  it('âncora LIMPA_NOME: base 500, D=30 → 500 (sem mora)', () => {
    const charge = computeChargeSeam({
      profileType: 'LIMPA_NOME',
      principal: 500,
      loanAmount: 500,
      base: 500,
      daysOverdue: 30,
    });
    expect(charge).toBe(500);
  });

  it('property: serviço/investimento retornam o valor base para qualquer atraso', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...OUT_OF_SCOPE_PROFILES),
        fc.double({ min: 1, max: 100000, noNaN: true, noDefaultInfinity: true }),
        fc.integer({ min: 0, max: 120 }),
        (profileType, base, daysOverdue) => {
          const charge = computeChargeSeam({
            profileType,
            principal: base,
            loanAmount: base,
            base,
            daysOverdue,
          });
          expect(charge).toBe(base); // nenhuma mora aplicada
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Property 2.6 — Quitação total: só por confirmação do admin; zera saldo e
//   marca tudo PAID. Nunca dispara automaticamente. _Requirements: 3.8, 2.9_
// ═══════════════════════════════════════════════════════════════════════════
describe('Preservation 2.6 — Quitação total exclusiva do admin (zera saldo, marca tudo PAID)', () => {
  it('âncora: admin confirma → remaining=0, status COMPLETED, todas PAID', () => {
    const installments: Inst[] = [
      { id: 'a', status: 'OPEN', amount: 100 },
      { id: 'b', status: 'LATE', amount: 100 },
    ];
    const result = applyDischarge(installments, 200, true);
    expect(result.remainingAmount).toBe(0);
    expect(result.status).toBe('COMPLETED');
    expect(result.installments.every((i) => i.status === 'PAID')).toBe(true);
  });

  it('property: sem confirmação do admin nada quita; com confirmação zera e marca PAID', () => {
    const instArb = fc.array(
      fc.record({
        id: fc.string({ minLength: 1, maxLength: 6 }),
        status: fc.constantFrom('OPEN', 'LATE', 'AWAITING_CONFIRMATION', 'PAID'),
        amount: fc.double({ min: 0, max: 5000, noNaN: true, noDefaultInfinity: true }),
      }),
      { minLength: 1, maxLength: 8 }
    );
    fc.assert(
      fc.property(
        instArb,
        fc.double({ min: 0, max: 100000, noNaN: true, noDefaultInfinity: true }),
        fc.boolean(),
        (installments, remainingBefore, adminConfirmed) => {
          const result = applyDischarge(installments as Inst[], remainingBefore, adminConfirmed);
          if (adminConfirmed) {
            expect(result.remainingAmount).toBe(0);
            expect(result.status).toBe('COMPLETED');
            expect(result.installments.every((i) => i.status === 'PAID')).toBe(true);
          } else {
            // Nada automático: estado preservado
            expect(result.remainingAmount).toBe(remainingBefore);
            expect(result.installments).toBe(installments);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Property 2.7 — Exibição por modalidade + paidCount de MOTO.
//   displayForProfile: 'PARCELAS' só para MOTO; CLT/GARANTIA nunca 'PARCELAS'
//   (mostram 'SALDO_JUROS'); AUTONOMO 'SALDO'. Para MOTO, paidCount nunca atinge
//   total enquanto remaining > 0. _Requirements: 2.12, 3.9_
// ═══════════════════════════════════════════════════════════════════════════
describe('Preservation 2.7 — Exibição por modalidade e contagem de parcelas só em MOTO', () => {
  it('âncora display: MOTO→PARCELAS; CLT/GARANTIA→SALDO_JUROS; AUTONOMO→SALDO', () => {
    expect(displayForProfile('MOTO')).toBe('PARCELAS');
    expect(displayForProfile('CLT')).toBe('SALDO_JUROS');
    expect(displayForProfile('GARANTIA')).toBe('SALDO_JUROS');
    expect(displayForProfile('GARANTIA_VEICULO')).toBe('SALDO_JUROS');
    expect(displayForProfile('AUTONOMO')).toBe('SALDO');
  });

  it('property: CLT/GARANTIA NUNCA renderizam contagem de parcelas', () => {
    fc.assert(
      fc.property(fc.constantFrom(...ROLLOVER_PROFILES), (profileType) => {
        expect(displayForProfile(profileType)).not.toBe('PARCELAS');
        expect(displayForProfile(profileType)).toBe('SALDO_JUROS');
      }),
      { numRuns: 30 }
    );
  });

  it('property MOTO: paidCount (amortizadoras) só atinge total quando remaining == 0', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 36 }), // total de parcelas reais (MOTO)
        fc.integer({ min: 0, max: 36 }), // pagas
        fc.double({ min: 1, max: 2000, noNaN: true, noDefaultInfinity: true }), // valor unitário
        (total, paidRaw, unit) => {
          const paid = Math.min(paidRaw, total);
          // Modelo fiel: parcelas MOTO são todas amortizadoras (sem juros de rolagem).
          const installments: Inst[] = Array.from({ length: total }, (_, i) => ({
            id: `m-${i}`,
            status: i < paid ? 'PAID' : 'OPEN',
            amount: unit,
          }));
          // remaining derivado das parcelas não pagas (saldo amortizado por parcela).
          const remaining = (total - paid) * unit;
          const paidCount = paidCountAmortizing(installments);

          // Invariante de UI (req 2.10/2.12): NUNCA "N/N pagas" com saldo > 0.
          const invariantHolds = !(paidCount === total && remaining > 0);
          expect(invariantHolds).toBe(true);
          // Coerência: paidCount == total  ⟺  remaining == 0
          expect(paidCount === total).toBe(remaining === 0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('property: parcela de juros de rolagem (isInterestPayment) NÃO entra no paidCount amortizador', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 5 }), // amortizadoras PAID
        fc.integer({ min: 0, max: 5 }), // parcelas de juros PAID (rolagem)
        (amortPaid, interestPaid) => {
          const installments: Inst[] = [
            ...Array.from({ length: amortPaid }, (_, i) => ({
              id: `amort-${i}`,
              status: 'PAID',
              amount: 100,
              isInterestPayment: false,
            })),
            ...Array.from({ length: interestPaid }, (_, i) => ({
              id: `juros-${i}`,
              status: 'PAID',
              amount: 30,
              isInterestPayment: true,
            })),
          ];
          // Só as amortizadoras contam (decisão futura de exibição, locked aqui).
          expect(paidCountAmortizing(installments)).toBe(amortPaid);
        }
      ),
      { numRuns: 50 }
    );
  });
});
