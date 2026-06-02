/**
 * interestEngine — Função central PURA de cálculo de juros/multa de cobrança.
 *
 * Bugfix spec: "correcao-calculo-juros-parcelas" — Mudança 1 / Task 3.1.
 *
 * Esta é a ÚNICA fonte de verdade do cálculo oficial de cobrança, reutilizável
 * pelo cron de cobrança (`collectionAutomationService`) e pela rota
 * `POST /api/loans/:loanId/generate-payment` (`routes/loans.ts`), eliminando a
 * divergência histórica 10% (cron) vs 30% (generate-payment).
 *
 * PRINCÍPIOS:
 *  - Função 100% pura: SEM I/O, SEM acesso a Prisma, SEM leitura de settings.
 *    A taxa mensal já deve chegar resolvida via cascata (ver `resolveMonthlyRate`,
 *    helper opcional aqui exportado para os callers usarem antes de chamar o engine).
 *  - Determinística e totalmente testável isoladamente (vitest + fast-check).
 *  - Aditiva e reversível: não altera nenhum comportamento existente por si só.
 *
 * REGRA DE NEGÓCIO OFICIAL (design.md > officialCharge):
 *  - Taxa mensal padrão = 0,30 (30% a.m.) quando não informada — NUNCA 0,10.
 *  - CLT / GARANTIA / GARANTIA_VEICULO (dívida + juros, rolagem):
 *      jurosMes = principal × rate
 *      D <= 0 → total = jurosMes (sem 7%, sem R$20/dia)
 *      D  > 0 → total = jurosMes + (loanAmount × 7%, uma vez) + (D × R$20)
 *  - AUTONOMO / Comércio (diárias):
 *      total = base + (D × R$20)
 *      SEM 7%, SEM juros de mora pró-rata, SEM exclusão de domingo.
 *  - MOTO: parcela fixa → total = base (engine não calcula mora aqui).
 *  - LIMPA_NOME / INVESTIDOR: fora de escopo de mora → total = base.
 */

export type RolloverProfile = 'CLT' | 'GARANTIA' | 'GARANTIA_VEICULO';

export type ProfileType =
  | RolloverProfile
  | 'AUTONOMO'
  | 'MOTO'
  | 'LIMPA_NOME'
  | 'INVESTIDOR'
  | (string & {});

export type SundayPolicyForFine = 'CORRIDO' | 'PULA_DOMINGO';

/** Parâmetros de entrada do cálculo. Veja semântica em cada campo. */
export interface ComputeChargeParams {
  /** Modalidade do contrato (LoanRequest.profileType). */
  profileType: string;
  /** Valor emprestado — base dos 30% (juros do mês). */
  principal: number;
  /** Valor emprestado total — base dos 7% (multa de inadimplência). Normalmente == principal. */
  loanAmount: number;
  /** D = dias de atraso. <= 0 significa "não vencido". */
  daysOverdue: number;
  /**
   * Valor base da parcela/diária (MOTO/AUTONOMO/serviços).
   * Default = principal (para rollover não é usado como base — ver jurosMes).
   */
  base?: number;
  /** Vencimento — necessário para AUTONOMO (exclusão de domingos da contagem de juros). */
  dueDate?: Date;
  /** Data de referência ("hoje"). Usada com dueDate para contar domingos. */
  today?: Date;
  /** Taxa mensal JÁ resolvida via cascata. Default 0.30 (nunca 0.10). */
  monthlyRate?: number;
  /** Multa fixa por dia de atraso. Default R$ 20,00. */
  lateFeeDaily?: number;
  /** Percentual da multa de inadimplência (CLT/GARANTIA). Default 0.07 (7%). */
  finePercent?: number;
  /** Política de domingo para a multa diária. Default 'CORRIDO' (dias corridos). */
  sundayPolicyForFine?: SundayPolicyForFine;
}

/** Item discriminado do detalhamento da cobrança (transparência/templates). */
export interface ChargeBreakdownItem {
  label: string;
  amount: number;
}

/** Resultado do cálculo oficial de cobrança. */
export interface ChargeBreakdown {
  /** Valor base da parcela/diária considerado (0 para rollover, onde o "base" é o juros do mês). */
  base: number;
  /** Juros do mês (rollover) ou juros de mora pró-rata (AUTONOMO). */
  jurosMes: number;
  /** Multa de inadimplência de 7% sobre o valor emprestado (apenas CLT/GARANTIA, uma vez). */
  multa7: number;
  /** Multa fixa acumulada (R$ 20 × dias). */
  multaDiaria: number;
  /** Valor total a cobrar. */
  total: number;
  /** Taxa mensal efetivamente aplicada (0 quando fora de escopo de mora). */
  usedRate: number;
  /** Detalhamento legível dos componentes do total. */
  breakdown: ChargeBreakdownItem[];
}

// ───────────────────────────────────────────────────────────────────────────
// Constantes oficiais (regra de negócio)
// ───────────────────────────────────────────────────────────────────────────
export const DEFAULT_MONTHLY_RATE = 0.3; // 30% a.m. (NUNCA 0.10)
export const DEFAULT_LATE_FEE_DAILY = 20; // R$ 20,00 por dia corrido
export const DEFAULT_FINE_PERCENT = 0.07; // 7% sobre o valor emprestado

export const ROLLOVER_PROFILES: readonly RolloverProfile[] = [
  'CLT',
  'GARANTIA',
  'GARANTIA_VEICULO',
];

const OUT_OF_SCOPE_PROFILES: readonly string[] = ['LIMPA_NOME', 'INVESTIDOR'];

const MS_PER_DAY = 1000 * 60 * 60 * 24;

// ───────────────────────────────────────────────────────────────────────────
// Helpers de data (UTC) — alinhados com countSundaysUTC dos testes.
// Não há `installmentEngine.ts` na árvore da raiz; implementamos um contador de
// domingos puro baseado em aritmética de dias UTC para evitar acoplar módulos
// que dependem de Prisma.
// ───────────────────────────────────────────────────────────────────────────

/** Início do dia em UTC (timestamp em ms, zerando hora/min/seg). */
function startOfUTCDay(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/** True se a data cair num domingo (UTC). */
export function isSundayUTC(d: Date): boolean {
  return d.getUTCDay() === 0;
}

/**
 * Conta domingos no intervalo SEMI-ABERTO (dueDate, today] usando aritmética de
 * dias em UTC. Idêntico em semântica ao helper `countSundaysUTC` dos testes.
 * Retorna 0 se o intervalo for vazio/negativo.
 */
export function countSundaysUTC(dueDate: Date, today: Date): number {
  let count = 0;
  const start = startOfUTCDay(dueDate);
  const end = startOfUTCDay(today);
  for (let t = start + MS_PER_DAY; t <= end; t += MS_PER_DAY) {
    if (new Date(t).getUTCDay() === 0) count++;
  }
  return count;
}

// ───────────────────────────────────────────────────────────────────────────
// Resolução de taxa via cascata (helper OPCIONAL para os callers).
// O engine em si recebe `monthlyRate` já resolvida; este helper centraliza a
// precedência oficial (2.1): contrato → customer → SystemSetting → 0.30.
// Mantido aqui (puro) para reuso por cron e generate-payment nas Tasks 3.3/3.4.
// ───────────────────────────────────────────────────────────────────────────
export interface RateSources {
  contractRate?: number | null;
  customerRate?: number | null;
  systemSettingRate?: number | null;
}

export function resolveMonthlyRate(sources: RateSources): number {
  if (sources.contractRate != null) return sources.contractRate;
  if (sources.customerRate != null) return sources.customerRate;
  if (sources.systemSettingRate != null) return sources.systemSettingRate;
  return DEFAULT_MONTHLY_RATE;
}

/** Política de domingo para a multa diária — DEFAULT oficial (preserva o atual). */
export const DEFAULT_SUNDAY_POLICY_FOR_FINE: SundayPolicyForFine = 'CORRIDO';

/**
 * Resolve a política de domingo para a multa diária a partir de um valor de
 * configuração (ex.: `SystemSetting("sundayPolicyForFine")`), de forma PURA.
 *
 * Bugfix spec "correcao-calculo-juros-parcelas" — Task 5.1 (OPCIONAL).
 *
 * Objetivo: permitir flipar a política do AUTONOMO entre dias corridos
 * (`'CORRIDO'`, default) e exclusão de domingos da multa diária
 * (`'PULA_DOMINGO'`) APENAS trocando uma config — SEM mudar código.
 *
 * Retrocompatível e falha-segura: qualquer valor ausente, vazio ou desconhecido
 * resolve para o DEFAULT `'CORRIDO'`, preservando EXATAMENTE o comportamento
 * atual. A única forma de flipar é a config conter literalmente `'PULA_DOMINGO'`
 * (case-insensitive, com trim), tornando a mudança explícita e auditável.
 */
export function resolveSundayPolicyForFine(
  value?: string | null
): SundayPolicyForFine {
  if (value == null) return DEFAULT_SUNDAY_POLICY_FOR_FINE;
  return value.trim().toUpperCase() === 'PULA_DOMINGO'
    ? 'PULA_DOMINGO'
    : DEFAULT_SUNDAY_POLICY_FOR_FINE;
}

function isRollover(profileType: string): boolean {
  return (ROLLOVER_PROFILES as readonly string[]).includes(profileType);
}

function isOutOfScope(profileType: string): boolean {
  return OUT_OF_SCOPE_PROFILES.includes(profileType);
}

// ───────────────────────────────────────────────────────────────────────────
// Função central
// ───────────────────────────────────────────────────────────────────────────

/**
 * Calcula a cobrança oficial para uma entrada, conforme a modalidade.
 * Pura e determinística. Não acessa I/O nem Prisma.
 */
export function computeCharge(params: ComputeChargeParams): ChargeBreakdown {
  const {
    profileType,
    principal,
    loanAmount,
    daysOverdue,
    dueDate,
    today,
    base,
    monthlyRate,
    lateFeeDaily = DEFAULT_LATE_FEE_DAILY,
    finePercent = DEFAULT_FINE_PERCENT,
    sundayPolicyForFine = 'CORRIDO',
  } = params;

  const rate = monthlyRate ?? DEFAULT_MONTHLY_RATE;
  const D = daysOverdue;
  // Base padrão = valor da parcela/diária quando informado; senão o principal
  // (usado por MOTO/AUTONOMO/serviços; rollover não usa base como total).
  const resolvedBase = base ?? principal;

  // ── Serviços/Investimento: fora do escopo de juros de mora (req 3.4, 3.5) ──
  if (isOutOfScope(profileType)) {
    return {
      base: resolvedBase,
      jurosMes: 0,
      multa7: 0,
      multaDiaria: 0,
      total: resolvedBase,
      usedRate: 0,
      breakdown: [{ label: 'base', amount: resolvedBase }],
    };
  }

  // ── CLT / GARANTIA / GARANTIA_VEICULO: dívida + juros (rolagem) ──
  if (isRollover(profileType)) {
    const jurosMes = principal * rate;

    // Não venceu: só o juros do mês (req 2.3) — sem 7%, sem R$ 20/dia.
    if (D <= 0) {
      return {
        base: 0,
        jurosMes,
        multa7: 0,
        multaDiaria: 0,
        total: jurosMes,
        usedRate: rate,
        breakdown: [{ label: 'juros_mes', amount: jurosMes }],
      };
    }

    // Em atraso: juros do mês + 7% (uma vez, independente de D) + R$ 20 × D.
    const multa7 = loanAmount * finePercent;
    const multaDiaria = D * lateFeeDaily;
    const total = jurosMes + multa7 + multaDiaria;

    return {
      base: 0,
      jurosMes,
      multa7,
      multaDiaria,
      total,
      usedRate: rate,
      breakdown: [
        { label: 'juros_mes', amount: jurosMes },
        { label: 'multa_7', amount: multa7 },
        { label: 'multa_diaria', amount: multaDiaria },
      ],
    };
  }

  // ── AUTONOMO / Comércio: diária fixa + mora diária. SEM 7%, SEM juros pró-rata. ──
  if (profileType === 'AUTONOMO') {
    const fineDays = Math.max(0, D);
    const multaDiaria = fineDays * lateFeeDaily;
    const total = resolvedBase + multaDiaria;

    return {
      base: resolvedBase,
      jurosMes: 0,
      multa7: 0,
      multaDiaria,
      total,
      usedRate: 0,
      breakdown: [
        { label: 'base', amount: resolvedBase },
        { label: 'multa_diaria', amount: multaDiaria },
      ],
    };
  }

  // ── MOTO: parcela fixa. Engine não calcula mora aqui (amortização real). ──
  // (default base = principal quando não informado)
  return {
    base: resolvedBase,
    jurosMes: 0,
    multa7: 0,
    multaDiaria: 0,
    total: resolvedBase,
    usedRate: 0,
    breakdown: [{ label: 'base', amount: resolvedBase }],
  };
}

export default { computeCharge, resolveMonthlyRate, resolveSundayPolicyForFine, countSundaysUTC, isSundayUTC };
