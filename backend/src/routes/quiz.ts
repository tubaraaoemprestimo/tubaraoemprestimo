import { Router, Request, Response } from 'express';
import { prisma } from '../services/prisma';
import { authenticate } from '../middleware/auth';
import { saveQuizResponse, getLeadsByStatus, QuizData } from '../services/leadScoringService';

const requireAuth = authenticate;

const quizRouter = Router();

/**
 * POST /api/quiz/submit
 * Submete o quiz de qualificação após conclusão do curso
 */
quizRouter.post('/submit', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const quizData: QuizData = {
      userId,
      courseId: req.body.courseId,

      // Passo 1
      npsScore: parseInt(req.body.npsScore),
      wouldRecommend: req.body.wouldRecommend,
      whatCaughtAttention: req.body.whatCaughtAttention,

      // Passo 2
      situationBefore: req.body.situationBefore,
      clarityNow: req.body.clarityNow,

      // Passo 3
      interestMotos: req.body.interestMotos,
      interestCredit: req.body.interestCredit,

      // Passo 4
      wouldStartSteps: req.body.wouldStartSteps,
      investmentAmount: req.body.investmentAmount,

      // Passo 5
      interestOnlineMentorship: req.body.interestOnlineMentorship,
      interestPresentialMentorship: req.body.interestPresentialMentorship,

      // Passo 6
      fullName: req.body.fullName,
      whatsapp: req.body.whatsapp,
      city: req.body.city,
      state: req.body.state,
      suggestions: req.body.suggestions,
    };

    // Valida campos obrigatórios
    if (!quizData.courseId || quizData.npsScore === undefined || !quizData.fullName || !quizData.whatsapp) {
      return res.status(400).json({ error: 'Campos obrigatórios faltando' });
    }

    // Salva e calcula lead scoring
    const result = await saveQuizResponse(quizData);

    res.json({
      success: true,
      leadStatus: result.scoring.leadStatus,
      leadScore: result.scoring.leadScore,
      message: result.scoring.leadStatus === 'HOT'
        ? '🔥 Obrigado! Nossa equipe vai entrar em contato em breve!'
        : 'Obrigado pelo feedback! Analisaremos seu perfil.'
    });

  } catch (error: any) {
    console.error('Erro ao salvar quiz:', error);

    // Se já respondeu
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Você já respondeu este quiz' });
    }

    res.status(500).json({ error: 'Erro ao processar quiz' });
  }
});

/**
 * GET /api/quiz/check/:courseId
 * Verifica se o usuário já respondeu o quiz
 */
quizRouter.get('/check/:courseId', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { courseId } = req.params;

    const response = await prisma.quizResponse.findUnique({
      where: {
        userId_courseId: {
          userId,
          courseId
        }
      }
    });

    res.json({
      hasResponded: !!response,
      response: response ? {
        leadStatus: response.leadStatus,
        leadScore: response.leadScore,
        createdAt: response.createdAt
      } : null
    });

  } catch (error) {
    console.error('Erro ao verificar quiz:', error);
    res.status(500).json({ error: 'Erro ao verificar quiz' });
  }
});

/**
 * GET /api/quiz/leads
 * Lista leads por status (ADMIN ONLY)
 */
quizRouter.get('/leads', requireAuth, async (req: Request, res: Response) => {
  try {
    // Apenas admins
    if (req.user!.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    const status = req.query.status as 'HOT' | 'WARM' | 'COLD' | undefined;
    const leads = await getLeadsByStatus(status);

    res.json(leads);

  } catch (error) {
    console.error('Erro ao listar leads:', error);
    res.status(500).json({ error: 'Erro ao listar leads' });
  }
});

/**
 * PUT /api/quiz/leads/:id/contact
 * Marca lead como contatado (ADMIN ONLY)
 */
quizRouter.put('/leads/:id/contact', requireAuth, async (req: Request, res: Response) => {
  try {
    if (req.user!.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    const { id } = req.params;
    const { notes } = req.body;

    const updated = await prisma.quizResponse.update({
      where: { id },
      data: {
        contactedAt: new Date(),
        contactedBy: req.user!.name,
        notes
      }
    });

    res.json(updated);

  } catch (error) {
    console.error('Erro ao atualizar lead:', error);
    res.status(500).json({ error: 'Erro ao atualizar lead' });
  }
});

/**
 * GET /api/quiz/questions
 * Lista perguntas do quiz (ADMIN ONLY)
 */
quizRouter.get('/questions', requireAuth, async (req: Request, res: Response) => {
  try {
    if (req.user!.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Acesso negado' });
    }
    const questions = await prisma.quizQuestion.findMany({
      where: { active: true },
      orderBy: [{ step: 'asc' }, { order: 'asc' }]
    });
    res.json(questions);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao listar perguntas' });
  }
});

/**
 * POST /api/quiz/questions
 */
quizRouter.post('/questions', requireAuth, async (req: Request, res: Response) => {
  try {
    if (req.user!.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Acesso negado' });
    }
    const { step, question, type, options, weight, category } = req.body;
    const created = await prisma.quizQuestion.create({
      data: { step, question, type, options: options || [], weight: weight || 10, category: category || 'experience' }
    });
    res.status(201).json(created);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao criar pergunta' });
  }
});

/**
 * PUT /api/quiz/questions/:id
 */
quizRouter.put('/questions/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    if (req.user!.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Acesso negado' });
    }
    const { step, question, type, options, weight, category } = req.body;
    const updated = await prisma.quizQuestion.update({
      where: { id: req.params.id },
      data: {
        ...(step !== undefined && { step }),
        ...(question !== undefined && { question }),
        ...(type !== undefined && { type }),
        ...(options !== undefined && { options }),
        ...(weight !== undefined && { weight }),
        ...(category !== undefined && { category }),
      }
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao atualizar pergunta' });
  }
});

/**
 * DELETE /api/quiz/questions/:id
 */
quizRouter.delete('/questions/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    if (req.user!.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Acesso negado' });
    }
    await prisma.quizQuestion.update({
      where: { id: req.params.id },
      data: { active: false }
    });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao excluir pergunta' });
  }
});

/**
 * GET /api/quiz/scoring-rules
 */
quizRouter.get('/scoring-rules', requireAuth, async (req: Request, res: Response) => {
  try {
    if (req.user!.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Acesso negado' });
    }
    const rules = await prisma.scoringRule.findMany({
      where: { active: true },
      orderBy: { createdAt: 'asc' }
    });
    res.json(rules);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao listar regras' });
  }
});

/**
 * POST /api/quiz/scoring-rules
 */
quizRouter.post('/scoring-rules', requireAuth, async (req: Request, res: Response) => {
  try {
    if (req.user!.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Acesso negado' });
    }
    const { condition, points, description } = req.body;
    const created = await prisma.scoringRule.create({ data: { condition, points, description } });
    res.status(201).json(created);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao criar regra' });
  }
});

/**
 * PUT /api/quiz/scoring-rules/:id
 */
quizRouter.put('/scoring-rules/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    if (req.user!.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Acesso negado' });
    }
    const { condition, points, description } = req.body;
    const updated = await prisma.scoringRule.update({
      where: { id: req.params.id },
      data: {
        ...(condition !== undefined && { condition }),
        ...(points !== undefined && { points }),
        ...(description !== undefined && { description }),
      }
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao atualizar regra' });
  }
});

/**
 * DELETE /api/quiz/scoring-rules/:id
 */
quizRouter.delete('/scoring-rules/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    if (req.user!.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Acesso negado' });
    }
    await prisma.scoringRule.update({
      where: { id: req.params.id },
      data: { active: false }
    });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao excluir regra' });
  }
});

export { quizRouter };
