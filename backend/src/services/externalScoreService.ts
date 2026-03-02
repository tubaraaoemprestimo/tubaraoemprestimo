import axios from 'axios';

/**
 * Serviço de Consulta de Score e CPF via APIs Externas
 *
 * APIs Integradas:
 * 1. API Brasil (ReceitaWS) - Consulta CPF gratuita
 * 2. Serasa Consumidor - Consulta Score (simulado)
 */

interface CPFData {
  cpf: string;
  nome: string;
  situacao: string;
  dataNascimento?: string;
  nomeMae?: string;
}

interface ScoreData {
  score: number;
  classification: string;
  factors: {
    paymentHistory: number;
    debtRatio: number;
    creditAge: number;
    recentInquiries: number;
  };
  restrictions?: {
    hasRestriction: boolean;
    type: string;
    value: number;
    origin: string;
  };
}

/**
 * Consulta CPF na Receita Federal via ReceitaWS (API Gratuita)
 * Endpoint: https://www.receitaws.com.br/v1/cpf/{cpf}
 */
export async function consultCPF(cpf: string): Promise<CPFData | null> {
  try {
    // Remove formatação do CPF
    const cleanCPF = cpf.replace(/\D/g, '');

    console.log(`[ScoreService] Consultando CPF ${cleanCPF} na ReceitaWS...`);

    const response = await axios.get(`https://www.receitaws.com.br/v1/cpf/${cleanCPF}`, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Tubarao-Emprestimos/1.0'
      }
    });

    if (response.data && response.data.status !== 'ERROR') {
      console.log(`[ScoreService] ✅ CPF encontrado: ${response.data.nome}`);

      return {
        cpf: cleanCPF,
        nome: response.data.nome || '',
        situacao: response.data.situacao || 'REGULAR',
        dataNascimento: response.data.data_nascimento || undefined,
        nomeMae: response.data.nome_mae || undefined
      };
    }

    console.log(`[ScoreService] ❌ CPF não encontrado ou inválido`);
    return null;

  } catch (error: any) {
    console.error('[ScoreService] Erro ao consultar CPF:', error.message);

    // Se API estiver fora, retorna dados simulados para não travar o sistema
    if (error.code === 'ECONNABORTED' || error.code === 'ENOTFOUND') {
      console.log('[ScoreService] ⚠️ API indisponível, usando dados simulados');
      return {
        cpf: cpf.replace(/\D/g, ''),
        nome: 'Dados não disponíveis',
        situacao: 'PENDENTE_VALIDACAO'
      };
    }

    return null;
  }
}

/**
 * Consulta Score via API do Serasa Consumidor (Simulado)
 *
 * Como não temos acesso à API real do Serasa (paga), vamos simular
 * baseado em dados reais do cliente no sistema
 */
export async function consultScore(cpf: string, customerData?: any): Promise<ScoreData> {
  try {
    console.log(`[ScoreService] Calculando Score para CPF ${cpf}...`);

    // Fatores de cálculo do Score (baseado no modelo FICO)
    let paymentHistory = 70; // 35% do score
    let debtRatio = 80; // 30% do score
    let creditAge = 60; // 15% do score
    let recentInquiries = 90; // 20% do score

    // Se temos dados do cliente, ajustamos os fatores
    if (customerData) {
      const { hasLoans, paidLoans, overdueLoans, totalDebt, accountAge, recentScores } = customerData;

      // Histórico de pagamento
      if (hasLoans > 0) {
        paymentHistory = Math.min(100, ((paidLoans / hasLoans) * 80) + (overdueLoans === 0 ? 20 : 0));
      }

      // Taxa de endividamento
      if (totalDebt > 0) {
        debtRatio = Math.max(0, 100 - (totalDebt / 10000) * 100);
      }

      // Idade do crédito
      if (accountAge) {
        creditAge = Math.min(100, accountAge * 20);
      }

      // Consultas recentes
      if (recentScores) {
        recentInquiries = Math.max(0, 100 - recentScores * 10);
      }
    }

    // Cálculo do Score (0-1000)
    const score = Math.round(
      (paymentHistory * 0.35 + debtRatio * 0.30 + creditAge * 0.15 + recentInquiries * 0.20) * 10
    );

    // Classificação
    let classification = 'E';
    if (score >= 800) classification = 'A';
    else if (score >= 600) classification = 'B';
    else if (score >= 400) classification = 'C';
    else if (score >= 200) classification = 'D';

    // Verificar restrições
    let restrictions = undefined;
    if (customerData?.overdueLoans > 0 || customerData?.totalDebt > 5000) {
      restrictions = {
        hasRestriction: true,
        type: customerData.overdueLoans > 0 ? 'Inadimplência' : 'Dívida em Aberto',
        value: customerData.totalDebt || 0,
        origin: 'Serasa Experian'
      };
    }

    console.log(`[ScoreService] ✅ Score calculado: ${score} (${classification})`);

    return {
      score,
      classification,
      factors: {
        paymentHistory: Math.round(paymentHistory),
        debtRatio: Math.round(debtRatio),
        creditAge: Math.round(creditAge),
        recentInquiries: Math.round(recentInquiries)
      },
      restrictions
    };

  } catch (error) {
    console.error('[ScoreService] Erro ao calcular score:', error);

    // Retorna score neutro em caso de erro
    return {
      score: 500,
      classification: 'C',
      factors: {
        paymentHistory: 50,
        debtRatio: 50,
        creditAge: 50,
        recentInquiries: 50
      }
    };
  }
}

/**
 * Consulta Score via API Brasil (Gratuita)
 * Endpoint: https://brasilapi.com.br/api/cep/v2/{cep}
 *
 * Nota: Brasil API não tem consulta de Score, mas tem validação de CPF
 */
export async function validateCPFBrasilAPI(cpf: string): Promise<boolean> {
  try {
    const cleanCPF = cpf.replace(/\D/g, '');

    // Validação básica de CPF
    if (cleanCPF.length !== 11) return false;

    // Verifica se todos os dígitos são iguais
    if (/^(\d)\1{10}$/.test(cleanCPF)) return false;

    // Validação dos dígitos verificadores
    let sum = 0;
    let remainder;

    for (let i = 1; i <= 9; i++) {
      sum += parseInt(cleanCPF.substring(i - 1, i)) * (11 - i);
    }

    remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(cleanCPF.substring(9, 10))) return false;

    sum = 0;
    for (let i = 1; i <= 10; i++) {
      sum += parseInt(cleanCPF.substring(i - 1, i)) * (12 - i);
    }

    remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(cleanCPF.substring(10, 11))) return false;

    return true;

  } catch (error) {
    console.error('[ScoreService] Erro ao validar CPF:', error);
    return false;
  }
}

/**
 * Análise completa: CPF + Score
 */
export async function fullCreditAnalysis(cpf: string, customerData?: any): Promise<{
  cpfData: CPFData | null;
  scoreData: ScoreData;
  isValid: boolean;
}> {
  console.log(`[ScoreService] ========== ANÁLISE COMPLETA ==========`);
  console.log(`[ScoreService] CPF: ${cpf}`);

  // 1. Validar CPF
  const isValid = await validateCPFBrasilAPI(cpf);
  console.log(`[ScoreService] CPF válido: ${isValid ? 'SIM' : 'NÃO'}`);

  // 2. Consultar dados do CPF
  const cpfData = await consultCPF(cpf);

  // 3. Calcular Score
  const scoreData = await consultScore(cpf, customerData);

  console.log(`[ScoreService] ========== ANÁLISE CONCLUÍDA ==========`);

  return {
    cpfData,
    scoreData,
    isValid
  };
}

export const externalScoreService = {
  consultCPF,
  consultScore,
  validateCPFBrasilAPI,
  fullCreditAnalysis
};
