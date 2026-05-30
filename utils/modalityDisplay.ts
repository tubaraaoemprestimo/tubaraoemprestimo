// 🧭 Exibição por modalidade (decisão por profileType)
// Centraliza a lógica de "o que exibir na coluna Parcelas" para evitar duplicação
// entre as telas admin (Contracts/Customers), o painel do cliente e os relatórios.
//
// Regra de negócio (ver design da spec correcao-calculo-juros-parcelas):
//   - MOTO              → única modalidade com parcelas reais: "X/Y parcelas pagas"
//   - CLT/GARANTIA/...  → rolagem (dívida + juros): NÃO contar parcelas; mostrar
//                         saldo devedor + estado do juros do mês
//   - AUTONOMO          → dívida amortizada por diárias: mostrar saldo devedor
//   - LIMPA_NOME/INVEST → fora do escopo de cobrança (comportamento default)
//
// A flag isInterestPayment é apenas insumo auxiliar (contagem de amortizadoras em MOTO);
// a decisão de apresentação é tomada por profileType.

// Perfis de rolagem (dívida + juros mensal; sem conceito de parcela)
export const ROLLOVER_PROFILES = ['CLT', 'GARANTIA', 'GARANTIA_VEICULO'] as const;

export type DisplayMode =
  | 'PARCELAS'       // MOTO → "X/Y parcelas pagas"
  | 'SALDO_JUROS'    // CLT/GARANTIA → saldo devedor + estado do juros
  | 'SALDO_DIARIAS'  // AUTONOMO → saldo amortizado pelas diárias
  | 'DEFAULT';       // demais (serviço/investimento) → comportamento atual

export type InterestState = 'EM_DIA' | 'EM_ABERTO' | 'ATRASADO';

// Estruturas mínimas e estruturais — funcionam com os diferentes formatos de
// contrato/empréstimo usados nas várias telas (admin, cliente, relatório).
interface InstallmentLike {
  status: string;
  dueDate?: string;
  isInterestPayment?: boolean;
}

interface ContractLike {
  loanRequest?: { profileType?: string | null } | null;
  profileType?: string | null;
  isService?: boolean;
  isInvestment?: boolean;
}

/**
 * Resolve o profileType de um contrato/empréstimo.
 * Ordem: loanRequest.profileType → profileType direto → fallback isService/isInvestment.
 * Retorna undefined quando não é possível determinar.
 */
export const getProfileType = (c?: ContractLike | null): string | undefined => {
  if (!c) return undefined;
  const pt = c.loanRequest?.profileType ?? c.profileType ?? undefined;
  if (pt) return pt;
  if (c.isService) return 'LIMPA_NOME';
  if (c.isInvestment) return 'INVESTIDOR';
  return undefined;
};

/**
 * Decide o modo de exibição a partir do profileType.
 * Apenas MOTO exibe contagem de parcelas; CLT/GARANTIA e AUTONOMO exibem saldo.
 */
export const getDisplayMode = (profileType?: string): DisplayMode => {
  if (profileType === 'MOTO') return 'PARCELAS';
  if (profileType && (ROLLOVER_PROFILES as readonly string[]).includes(profileType)) return 'SALDO_JUROS';
  if (profileType === 'AUTONOMO') return 'SALDO_DIARIAS';
  return 'DEFAULT';
};

/** Atalho: o contrato deve exibir contagem de parcelas? (somente MOTO) */
export const shouldShowParcelCount = (c?: ContractLike | null): boolean =>
  getDisplayMode(getProfileType(c)) === 'PARCELAS';

/**
 * Conta parcelas amortizadoras pagas (PAID e NÃO pagamento de juros de rolagem).
 * Conceitualmente válida apenas para MOTO; exclui isInterestPayment para nunca
 * contabilizar pagamento de juros como parcela.
 */
export const countAmortizingPaid = (installments?: InstallmentLike[] | null): number =>
  (installments ?? []).filter(i => i.status === 'PAID' && !i.isInterestPayment).length;

/**
 * Deriva o estado do juros do mês (CLT/GARANTIA) a partir das cobranças em aberto.
 *   - ATRASADO : há cobrança vencida sem pagamento (status LATE ou OPEN com dueDate passada)
 *   - EM_ABERTO: há cobrança em aberto ainda dentro do prazo
 *   - EM_DIA   : nenhuma cobrança em aberto (juros do mês quitado / recém-pago)
 */
export const getInterestState = (
  installments?: InstallmentLike[] | null,
  now: Date = new Date()
): InterestState => {
  const list = installments ?? [];
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  const open = list.filter(
    i => i.status === 'OPEN' || i.status === 'LATE' || i.status === 'AWAITING_CONFIRMATION'
  );
  if (open.length === 0) return 'EM_DIA';

  const overdue = open.some(i => {
    if (i.status === 'LATE') return true;
    if (!i.dueDate) return false;
    const d = new Date(i.dueDate);
    d.setHours(0, 0, 0, 0);
    return d < today;
  });
  return overdue ? 'ATRASADO' : 'EM_ABERTO';
};

/** Rótulos curtos por estado do juros (pt-BR). */
export const INTEREST_STATE_LABEL: Record<InterestState, string> = {
  EM_DIA: 'Juros em dia',
  EM_ABERTO: 'Juros em aberto',
  ATRASADO: 'Juros atrasado',
};
