import { Router, Request, Response } from 'express';
import { prisma } from '../services/prisma';
import { authenticate, requireAdmin } from '../middleware/auth';

export const loansRouter = Router();
loansRouter.use(authenticate);

// GET /api/loans — Empréstimos do cliente ou todos (admin)
loansRouter.get('/', async (req: Request, res: Response) => {
    try {
        let loans;
        if (req.user!.role === 'ADMIN') {
            loans = await prisma.loan.findMany({
                include: { customer: true, installments: true },
                orderBy: { createdAt: 'desc' }
            });
        } else {
            // Busca customer do user
            const customer = await prisma.customer.findFirst({
                where: { userId: req.user!.id }
            });
            if (!customer) { res.json([]); return; }

            loans = await prisma.loan.findMany({
                where: { customerId: customer.id },
                include: { installments: true },
                orderBy: { createdAt: 'desc' }
            });
        }
        res.json(loans);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar empréstimos' });
    }
});

// PUT /api/loans/:loanId/installments/:installmentId/proof — Upload comprovante
loansRouter.put('/:loanId/installments/:installmentId/proof', async (req: Request, res: Response) => {
    try {
        const { proofUrl } = req.body;
        const installment = await prisma.installment.update({
            where: { id: req.params.installmentId as string },
            data: {
                proofUrl,
                status: 'PAID',
                paidAt: new Date()
            }
        });

        // Atualiza remaining_amount do loan
        const loan = await prisma.loan.findUnique({
            where: { id: req.params.loanId as string }
        });
        if (loan) {
            const newRemaining = loan.remainingAmount - installment.amount;
            await prisma.loan.update({
                where: { id: loan.id },
                data: {
                    remainingAmount: Math.max(0, newRemaining),
                    status: newRemaining <= 0 ? 'PAID' : loan.status
                }
            });

            // Cria transação
            await prisma.transaction.create({
                data: {
                    type: 'IN',
                    description: `Pagamento parcela - ${loan.id.substring(0, 8)}`,
                    amount: installment.amount,
                    category: 'PAYMENT',
                    date: new Date()
                }
            });
        }

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao registrar pagamento' });
    }
});

// GET /api/loans/pre-approval — Pré-aprovação do cliente
loansRouter.get('/pre-approval', async (req: Request, res: Response) => {
    try {
        const customer = await prisma.customer.findFirst({
            where: { userId: req.user!.id },
            select: { preApprovedAmount: true }
        });
        res.json({ amount: customer?.preApprovedAmount || null });
    } catch (error) {
        res.status(500).json({ error: 'Erro' });
    }
});

// GET /api/loans/installment-offer — Oferta de parcelamento do cliente
loansRouter.get('/installment-offer', async (req: Request, res: Response) => {
    try {
        const customer = await prisma.customer.findFirst({
            where: { userId: req.user!.id },
            select: { installmentOffer: true }
        });
        res.json({ offer: customer?.installmentOffer || null });
    } catch (error) {
        res.status(500).json({ error: 'Erro' });
    }
});
