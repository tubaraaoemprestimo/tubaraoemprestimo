import { Router, Request, Response } from 'express';
import { prisma } from '../services/prisma';
import { authenticate } from '../middleware/auth';

export const openFinanceRouter = Router();

// Score classification based on value
const getScoreClassification = (score: number): string => {
    if (score >= 800) return 'A';
    if (score >= 600) return 'B';
    if (score >= 400) return 'C';
    if (score >= 200) return 'D';
    return 'E';
};

// POST /api/open-finance/score/:customerId — Consultar/gerar score de crédito
openFinanceRouter.post('/score/:customerId', authenticate, async (req: Request, res: Response) => {
    try {
        const { customerId } = req.params;
        const { source } = req.body; // 'INTERNAL', 'SERASA', 'SPC'

        const customer = await prisma.customer.findUnique({ where: { id: customerId } });
        if (!customer) {
            res.status(404).json({ error: 'Cliente não encontrado' });
            return;
        }

        // Calculate score based on customer data
        const c = customer as any;
        const hasLoans = await prisma.loan.count({ where: { customerId } });
        const overdueLoans = await prisma.loan.count({ where: { customerId, status: 'OVERDUE' } });
        const paidLoans = await prisma.loan.count({ where: { customerId, status: 'PAID' } });

        // Payment history factor (35%)
        const paymentHistory = hasLoans > 0
            ? Math.min(100, ((paidLoans / hasLoans) * 80) + (overdueLoans === 0 ? 20 : 0))
            : 50; // New customer = neutral

        // Debt ratio factor (30%)
        const totalDebt = await prisma.installment.aggregate({
            where: { loan: { customerId }, status: { in: ['PENDING', 'OVERDUE'] } },
            _sum: { amount: true }
        });
        const debtAmount = totalDebt._sum.amount || 0;
        const debtRatio = Math.max(0, 100 - (debtAmount / 10000) * 100);

        // Credit age factor (15%)
        const accountAge = (Date.now() - new Date(c.createdAt).getTime()) / (365 * 24 * 60 * 60 * 1000);
        const creditAge = Math.min(100, accountAge * 20);

        // Recent inquiries factor (20%)
        const recentScores = await prisma.creditScore.count({
            where: { customerId, consultedAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } }
        });
        const recentInquiries = Math.max(0, 100 - recentScores * 10);

        // Weighted average
        let score = Math.round(
            (paymentHistory * 0.35 + debtRatio * 0.30 + creditAge * 0.15 + recentInquiries * 0.20) * 10
        );

        // Add variation for external sources
        if (source === 'SERASA' || source === 'SPC') {
            const variation = (Math.random() - 0.5) * 80;
            score = Math.round(score + variation);
        }

        score = Math.min(1000, Math.max(0, score));

        // Check restrictions
        const hasRestriction = overdueLoans > 0 || debtAmount > 5000;
        const restrictions = hasRestriction ? {
            hasRestriction: true,
            type: overdueLoans > 0 ? 'Inadimplência' : 'Dívida em Aberto',
            value: debtAmount,
            origin: source === 'SERASA' ? 'Serasa Experian' : source === 'SPC' ? 'SPC Brasil' : 'Sistema Interno'
        } : null;

        const creditScore = await prisma.creditScore.create({
            data: {
                customerId,
                score,
                classification: getScoreClassification(score),
                source: source || 'INTERNAL',
                factors: { paymentHistory: Math.round(paymentHistory), debtRatio: Math.round(debtRatio), creditAge: Math.round(creditAge), recentInquiries: Math.round(recentInquiries) },
                restrictions: restrictions || undefined
            }
        });

        res.json({
            id: creditScore.id,
            customerId: creditScore.customerId,
            score: creditScore.score,
            classification: creditScore.classification,
            source: creditScore.source,
            consultedAt: creditScore.consultedAt,
            factors: creditScore.factors,
            restrictions: creditScore.restrictions
        });
    } catch (error) {
        console.error('[OpenFinance] score error:', error);
        res.status(500).json({ error: 'Erro ao consultar score' });
    }
});

// GET /api/open-finance/scores/:customerId — Histórico de scores
openFinanceRouter.get('/scores/:customerId', authenticate, async (req: Request, res: Response) => {
    try {
        const scores = await prisma.creditScore.findMany({
            where: { customerId: req.params.customerId },
            orderBy: { consultedAt: 'desc' },
            take: 20
        });

        res.json(scores.map((s: any) => ({
            id: s.id,
            customerId: s.customerId,
            score: s.score,
            classification: s.classification,
            source: s.source,
            consultedAt: s.consultedAt,
            factors: s.factors,
            restrictions: s.restrictions
        })));
    } catch (error) {
        console.error('[OpenFinance] scores history error:', error);
        res.json([]);
    }
});

// POST /api/open-finance/income-analysis/:customerId — Análise de renda
openFinanceRouter.post('/income-analysis/:customerId', authenticate, async (req: Request, res: Response) => {
    try {
        const { customerId } = req.params;
        const { declaredIncome } = req.body;

        const customer = await prisma.customer.findUnique({ where: { id: customerId } });
        if (!customer) {
            res.status(404).json({ error: 'Cliente não encontrado' });
            return;
        }

        const monthlyIncome = declaredIncome || 3000;
        const averageBalance = monthlyIncome * (0.5 + Math.random() * 0.5);

        const incomeSource = monthlyIncome > 10000 ? 'BUSINESS' : monthlyIncome > 5000 ? 'SALARY' : 'FREELANCE';
        const stability = incomeSource === 'SALARY' ? 'HIGH' : incomeSource === 'BUSINESS' ? 'MEDIUM' : 'LOW';

        // Calculate commitment
        const totalDebt = await prisma.installment.aggregate({
            where: { loan: { customerId }, status: { in: ['PENDING', 'OVERDUE'] } },
            _sum: { amount: true }
        });
        const debtAmount = totalDebt._sum.amount || 0;
        const currentCommitment = Math.min(100, (debtAmount / monthlyIncome) * 100);
        const maxCommitment = 30;
        const availableCommitment = Math.max(0, maxCommitment - currentCommitment);
        const maxLoanAmount = (monthlyIncome * (availableCommitment / 100)) * 12;

        let recommendation: string;
        if (availableCommitment >= 20) recommendation = 'APPROVE';
        else if (availableCommitment >= 10) recommendation = 'REVIEW';
        else recommendation = 'DENY';

        const analysis = await prisma.incomeAnalysis.create({
            data: {
                customerId,
                monthlyIncome,
                averageBalance: Math.round(averageBalance),
                incomeSource,
                stability,
                currentCommitment: Math.round(currentCommitment * 10) / 10,
                availableCommitment: Math.round(availableCommitment * 10) / 10,
                maxLoanAmount: Math.round(maxLoanAmount),
                recommendation
            }
        });

        res.json({
            id: analysis.id,
            customerId: analysis.customerId,
            analyzedAt: analysis.analyzedAt,
            monthlyIncome: analysis.monthlyIncome,
            averageBalance: analysis.averageBalance,
            incomeSource: analysis.incomeSource,
            stability: analysis.stability,
            currentCommitment: analysis.currentCommitment,
            availableCommitment: analysis.availableCommitment,
            maxLoanAmount: analysis.maxLoanAmount,
            recommendation: analysis.recommendation
        });
    } catch (error) {
        console.error('[OpenFinance] income analysis error:', error);
        res.status(500).json({ error: 'Erro ao analisar renda' });
    }
});

// GET /api/open-finance/analyses/:customerId — Histórico de análises
openFinanceRouter.get('/analyses/:customerId', authenticate, async (req: Request, res: Response) => {
    try {
        const analyses = await prisma.incomeAnalysis.findMany({
            where: { customerId: req.params.customerId },
            orderBy: { analyzedAt: 'desc' },
            take: 20
        });

        res.json(analyses.map((a: any) => ({
            id: a.id,
            customerId: a.customerId,
            analyzedAt: a.analyzedAt,
            monthlyIncome: a.monthlyIncome,
            averageBalance: a.averageBalance,
            incomeSource: a.incomeSource,
            stability: a.stability,
            currentCommitment: a.currentCommitment,
            availableCommitment: a.availableCommitment,
            maxLoanAmount: a.maxLoanAmount,
            recommendation: a.recommendation
        })));
    } catch (error) {
        console.error('[OpenFinance] analyses history error:', error);
        res.json([]);
    }
});

// POST /api/open-finance/full-analysis/:customerId — Análise completa
openFinanceRouter.post('/full-analysis/:customerId', authenticate, async (req: Request, res: Response) => {
    try {
        const { customerId } = req.params;
        const { declaredIncome } = req.body;

        // Generate internal score
        const internalRes = await fetch(`${req.protocol}://${req.get('host')}/api/open-finance/score/${customerId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': req.headers.authorization || '' },
            body: JSON.stringify({ source: 'INTERNAL' })
        });
        const internalScore = await internalRes.json() as any;

        // Generate Serasa score
        const serasaRes = await fetch(`${req.protocol}://${req.get('host')}/api/open-finance/score/${customerId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': req.headers.authorization || '' },
            body: JSON.stringify({ source: 'SERASA' })
        });
        const serasaScore = await serasaRes.json() as any;

        // Income analysis
        const incomeRes = await fetch(`${req.protocol}://${req.get('host')}/api/open-finance/income-analysis/${customerId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': req.headers.authorization || '' },
            body: JSON.stringify({ declaredIncome })
        });
        const incomeAnalysis = await incomeRes.json() as any;

        // Overall recommendation
        const avgScore = (internalScore.score + serasaScore.score) / 2;
        let overallRecommendation: string;
        if (avgScore >= 600 && incomeAnalysis.recommendation === 'APPROVE' && !serasaScore.restrictions?.hasRestriction) {
            overallRecommendation = 'APPROVE';
        } else if (avgScore >= 400 && incomeAnalysis.recommendation !== 'DENY') {
            overallRecommendation = 'REVIEW';
        } else {
            overallRecommendation = 'DENY';
        }

        const scoreFactor = avgScore / 1000;
        const suggestedLimit = Math.round((incomeAnalysis.maxLoanAmount || 0) * scoreFactor);

        res.json({
            internalScore,
            serasaScore,
            incomeAnalysis,
            overallRecommendation,
            suggestedLimit
        });
    } catch (error) {
        console.error('[OpenFinance] full analysis error:', error);
        res.status(500).json({ error: 'Erro ao realizar análise completa' });
    }
});

// POST /api/open-finance/consent — Criar consentimento
openFinanceRouter.post('/consent', authenticate, async (req: Request, res: Response) => {
    try {
        const { customerId, scope } = req.body;

        const consent = await prisma.openFinanceConsent.create({
            data: {
                customerId,
                scope: scope || ['CREDIT_SCORE', 'INCOME', 'ACCOUNTS'],
                status: 'ACTIVE',
                expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) // 90 days
            }
        });

        res.json({
            id: consent.id,
            customerId: consent.customerId,
            scope: consent.scope,
            status: consent.status,
            grantedAt: consent.grantedAt,
            expiresAt: consent.expiresAt
        });
    } catch (error) {
        console.error('[OpenFinance] consent error:', error);
        res.status(500).json({ error: 'Erro ao criar consentimento' });
    }
});

// GET /api/open-finance/consents/:customerId — Listar consentimentos
openFinanceRouter.get('/consents/:customerId', authenticate, async (req: Request, res: Response) => {
    try {
        const consents = await prisma.openFinanceConsent.findMany({
            where: { customerId: req.params.customerId },
            orderBy: { grantedAt: 'desc' }
        });

        res.json(consents.map((c: any) => ({
            id: c.id,
            customerId: c.customerId,
            scope: c.scope,
            status: c.status,
            grantedAt: c.grantedAt,
            expiresAt: c.expiresAt,
            revokedAt: c.revokedAt
        })));
    } catch (error) {
        console.error('[OpenFinance] consents error:', error);
        res.json([]);
    }
});

// PUT /api/open-finance/consent/:id/revoke — Revogar consentimento
openFinanceRouter.put('/consent/:id/revoke', authenticate, async (req: Request, res: Response) => {
    try {
        await prisma.openFinanceConsent.update({
            where: { id: req.params.id },
            data: { status: 'REVOKED', revokedAt: new Date() }
        });
        res.json({ success: true });
    } catch (error) {
        console.error('[OpenFinance] revoke consent error:', error);
        res.status(500).json({ error: 'Erro ao revogar consentimento' });
    }
});
