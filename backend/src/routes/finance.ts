import { Router, Request, Response } from 'express';
import { prisma } from '../services/prisma';
import { authenticate, requireAdmin } from '../middleware/auth';

export const financeRouter = Router();
financeRouter.use(authenticate);

// GET /api/finance/dashboard - Resumo Financeiro
financeRouter.get('/dashboard', requireAdmin, async (_req: Request, res: Response) => {
    try {
        const totalLoans = await prisma.loan.count();
        const totalAmount = await prisma.loan.aggregate({
            _sum: { amount: true }
        });
        const totalPaid = await prisma.installment.aggregate({
            where: { status: 'PAID' },
            _sum: { amount: true }
        });
        const pendingAmount = (totalAmount._sum.amount || 0) - (totalPaid._sum.amount || 0);

        res.json({
            loans: totalLoans,
            amountInvested: totalAmount._sum.amount || 0,
            amountPaid: totalPaid._sum.amount || 0,
            amountPending: pendingAmount
        });
    } catch {
        res.status(500).json({ error: 'Erro ao buscar dados dashboard' });
    }
});

// GET /api/finance/transactions - Listar transações
financeRouter.get('/transactions', requireAdmin, async (_req: Request, res: Response) => {
    try {
        const transactions = await prisma.transaction.findMany({
            orderBy: { date: 'desc' },
            take: 50 // Paginação futura
        });
        res.json(transactions);
    } catch {
        res.status(500).json({ error: 'Erro ao buscar transações' });
    }
});

// POST /api/finance/transactions - Criar transação manual
financeRouter.post('/transactions', requireAdmin, async (req: Request, res: Response) => {
    try {
        const { type, description, amount, category, date } = req.body;

        await prisma.transaction.create({
            data: {
                type,
                description,
                amount: parseFloat(amount),
                category,
                date: new Date(date)
            }
        });
        res.json({ success: true });
    } catch {
        res.status(500).json({ error: 'Erro ao criar transação' });
    }
});

// GET /api/finance/interactions - Logs de interação (audit + messages)
financeRouter.get('/interactions', requireAdmin, async (_req: Request, res: Response) => {
    try {
        const logs = await prisma.auditLog.findMany({
            orderBy: { timestamp: 'desc' },
            take: 100
        });
        res.json(logs);
    } catch {
        res.status(500).json({ error: 'Erro ao buscar interações' });
    }
});
