import { prisma } from './prisma';
import { sendWhatsAppAutomation } from './whatsappAutomationService';

export interface QuizData {
  userId: string;
  courseId: string;

  // Passo 1: Experiência
  npsScore: number;
  wouldRecommend: string;
  whatCaughtAttention?: string;

  // Passo 2: Transformação
  situationBefore: string;
  clarityNow: string;

  // Passo 3: Intenção
  interestMotos: string;
  interestCredit: string;

  // Passo 4: Qualificação
  wouldStartSteps: string;
  investmentAmount: string;

  // Passo 5: Venda Direta
  interestOnlineMentorship: string;
  interestPresentialMentorship: string;

  // Passo 6: Contato
  fullName: string;
  whatsapp: string;
  city?: string;
  state?: string;
  suggestions?: string;
}

export interface LeadScoringResult {
  leadStatus: 'HOT' | 'WARM' | 'COLD';
  leadScore: number;
  reasons: string[];
}

/**
 * 🔥 MOTOR DE LEAD SCORING - LÓGICA CRÍTICA
 *
 * Esta função analisa as respostas do quiz e classifica o lead em:
 * - HOT (Quente): Pronto para comprar AGORA
 * - WARM (Morno): Interessado, precisa de nutrição
 * - COLD (Frio): Sem interesse real
 */
export function calculateLeadScore(data: QuizData): LeadScoringResult {
  let score = 0;
  const reasons: string[] = [];

  // ============================================
  // CRITÉRIOS DE LEAD QUENTE (HOT)
  // ============================================

  // 1. NPS Alto (8-10) = +30 pontos
  if (data.npsScore >= 8) {
    score += 30;
    reasons.push(`NPS excelente (${data.npsScore}/10)`);
  } else if (data.npsScore >= 6) {
    score += 15;
    reasons.push(`NPS bom (${data.npsScore}/10)`);
  }

  // 2. Recomendaria = +20 pontos
  if (data.wouldRecommend === 'Sim') {
    score += 20;
    reasons.push('Recomendaria o curso');
  } else if (data.wouldRecommend === 'Talvez') {
    score += 10;
  }

  // 3. Interesse em Mentoria (CRÍTICO) = +40 pontos
  const wantsMentorship =
    data.interestOnlineMentorship === 'Sim' ||
    data.interestPresentialMentorship === 'Sim';

  if (wantsMentorship) {
    score += 40;
    const type = data.interestPresentialMentorship === 'Sim' ? 'presencial' : 'online';
    reasons.push(`🔥 Quer mentoria ${type}`);
  } else if (
    data.interestOnlineMentorship === 'Talvez' ||
    data.interestPresentialMentorship === 'Talvez'
  ) {
    score += 20;
    reasons.push('Talvez queira mentoria');
  }

  // 4. Capacidade de Investimento (CRÍTICO) = +30 pontos
  if (data.investmentAmount === '+3k') {
    score += 30;
    reasons.push('💰 Pode investir +3k');
  } else if (data.investmentAmount === '1k-3k') {
    score += 25;
    reasons.push('💰 Pode investir 1k-3k');
  } else if (data.investmentAmount === '500-1k') {
    score += 15;
    reasons.push('Pode investir 500-1k');
  } else if (data.investmentAmount === 'Até 500') {
    score += 5;
  }

  // 5. Começaria os passos = +15 pontos
  if (data.wouldStartSteps === 'Sim') {
    score += 15;
    reasons.push('Pronto para começar');
  } else if (data.wouldStartSteps === 'Talvez') {
    score += 8;
  }

  // 6. Interesse em produtos (motos/crédito) = +10 pontos
  if (data.interestMotos === 'Sim' || data.interestCredit === 'Sim') {
    score += 10;
    reasons.push('Interesse em produtos');
  }

  // 7. Transformação percebida = +10 pontos
  if (data.clarityNow === 'Muito mais claro') {
    score += 10;
    reasons.push('Teve clareza com o curso');
  }

  // 8. Situação financeira = +5 pontos
  if (data.situationBefore === 'Endividado' || data.situationBefore === 'Apertado') {
    score += 5;
    reasons.push('Precisa de solução financeira');
  }

  // ============================================
  // CLASSIFICAÇÃO FINAL
  // ============================================

  let leadStatus: 'HOT' | 'WARM' | 'COLD';

  // LEAD QUENTE: Score >= 80 OU (Mentoria + Investimento alto)
  const hasHighInvestment =
    data.investmentAmount === '1k-3k' ||
    data.investmentAmount === '+3k';

  if (score >= 80 || (wantsMentorship && hasHighInvestment)) {
    leadStatus = 'HOT';
    reasons.unshift('🔥 LEAD QUENTE - LIGAR AGORA!');
  }
  // LEAD MORNO: Score >= 50
  else if (score >= 50) {
    leadStatus = 'WARM';
    reasons.unshift('⚠️ Lead morno - nutrir e acompanhar');
  }
  // LEAD FRIO: Score < 50
  else {
    leadStatus = 'COLD';
    reasons.unshift('❄️ Lead frio - baixa prioridade');
  }

  return {
    leadStatus,
    leadScore: Math.min(score, 100), // Cap em 100
    reasons
  };
}

/**
 * Salva a resposta do quiz e retorna o lead scoring
 */
export async function saveQuizResponse(data: QuizData) {
  // Calcula o lead scoring
  const scoring = calculateLeadScore(data);

  // Salva no banco
  const quizResponse = await prisma.quizResponse.create({
    data: {
      userId: data.userId,
      courseId: data.courseId,

      // Respostas
      npsScore: data.npsScore,
      wouldRecommend: data.wouldRecommend,
      whatCaughtAttention: data.whatCaughtAttention,
      situationBefore: data.situationBefore,
      clarityNow: data.clarityNow,
      interestMotos: data.interestMotos,
      interestCredit: data.interestCredit,
      wouldStartSteps: data.wouldStartSteps,
      investmentAmount: data.investmentAmount,
      interestOnlineMentorship: data.interestOnlineMentorship,
      interestPresentialMentorship: data.interestPresentialMentorship,
      fullName: data.fullName,
      whatsapp: data.whatsapp,
      city: data.city,
      state: data.state,
      suggestions: data.suggestions,

      // Lead Scoring
      leadStatus: scoring.leadStatus,
      leadScore: scoring.leadScore,
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
        }
      }
    }
  });

  // 🔥 GATILHO: Se for LEAD QUENTE, notifica o admin IMEDIATAMENTE
  if (scoring.leadStatus === 'HOT') {
    await notifyAdminHotLead(quizResponse, scoring);
  }

  // 🚀 AUTOMAÇÃO WHATSAPP: Dispara mensagem após 3 minutos
  // Executa em background (não bloqueia a resposta ao cliente)
  if (scoring.leadStatus === 'HOT' || scoring.leadStatus === 'WARM') {
    // Fire and forget - não aguarda conclusão
    sendWhatsAppAutomation(
      scoring.leadStatus,
      quizResponse.fullName,
      quizResponse.whatsapp,
      quizResponse.id // Passa ID para logging
    ).catch(error => {
      console.error('❌ Erro na automação WhatsApp (não crítico):', error);
      // Não propaga erro - automação falha não deve quebrar o fluxo
    });
  }

  return {
    quizResponse,
    scoring
  };
}

/**
 * 🔥 NOTIFICAÇÃO CRÍTICA: Lead Quente Detectado
 */
async function notifyAdminHotLead(quizResponse: any, scoring: LeadScoringResult) {
  const { fullName, whatsapp, investmentAmount, interestOnlineMentorship, interestPresentialMentorship } = quizResponse;

  const mentorshipType = interestPresentialMentorship === 'Sim' ? 'PRESENCIAL' : 'ONLINE';

  const message = `
🔥🔥🔥 LEAD QUENTE DETECTADO! 🔥🔥🔥

Nome: ${fullName}
WhatsApp: ${whatsapp}
Score: ${scoring.leadScore}/100

💰 Investimento: ${investmentAmount}
📚 Mentoria: ${mentorshipType}

Motivos:
${scoring.reasons.join('\n')}

⚡ AÇÃO IMEDIATA: Ligar para este lead AGORA!
  `.trim();

  // Cria notificação para TODOS os admins
  const admins = await prisma.user.findMany({
    where: { role: 'ADMIN' }
  });

  for (const admin of admins) {
    await prisma.notification.create({
      data: {
        customerId: admin.id,
        title: '🔥 LEAD QUENTE - AÇÃO IMEDIATA',
        message,
        type: 'SUCCESS',
        isRead: false,
      }
    });
  }

  // Marca como notificado
  await prisma.quizResponse.update({
    where: { id: quizResponse.id },
    data: { notifiedAdmin: true }
  });

  console.log('🔥 LEAD QUENTE NOTIFICADO:', fullName, whatsapp);
}

/**
 * Lista leads por status para o painel admin
 */
export async function getLeadsByStatus(status?: 'HOT' | 'WARM' | 'COLD') {
  const where = status ? { leadStatus: status } : {};

  return await prisma.quizResponse.findMany({
    where,
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
        }
      }
    },
    orderBy: [
      { leadScore: 'desc' },
      { createdAt: 'desc' }
    ]
  });
}
