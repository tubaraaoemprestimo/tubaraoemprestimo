import { Router, Request, Response } from 'express';
import { prisma } from '../services/prisma';
import { authenticate, requireAdmin } from '../middleware/auth';

export const notificationsRouter = Router();
notificationsRouter.use(authenticate);

// GET /api/notifications - Listar notificações do cliente (não lidas)
notificationsRouter.get('/', async (req: Request, res: Response) => {
    try {
        // Busca customer do user
        const customer = await prisma.customer.findFirst({ where: { userId: req.user!.id } });
        const where: any = { isRead: false };
        if (customer) {
            where.OR = [
                { customerId: customer.id },
                { customerEmail: req.user!.email }
            ];
        } else {
            where.customerEmail = req.user!.email;
        }
        const notifications = await prisma.notification.findMany({
            where,
            take: 20,
            orderBy: { createdAt: 'desc' }
        });
        res.json(notifications);
    } catch {
        res.status(500).json({ error: 'Erro ao buscar notificações' });
    }
});

// PUT /api/notifications/:id/read - Marcar como lida
notificationsRouter.put('/:id/read', async (req: Request, res: Response) => {
    try {
        await prisma.notification.update({
            where: { id: req.params.id as string },
            data: { isRead: true }
        });
        res.json({ success: true });
    } catch {
        res.status(500).json({ error: 'Erro ao marcar como lida' });
    }
});

// POST /api/notifications - Criar notificação
notificationsRouter.post('/', async (req: Request, res: Response) => {
    try {
        const { customerId, customerEmail, title, message, type } = req.body;
        await prisma.notification.create({
            data: {
                customerId: customerId || null,
                customerEmail: customerEmail || null,
                title,
                message,
                type: type || 'INFO'
            }
        });
        res.json({ success: true });
    } catch {
        res.status(500).json({ error: 'Erro ao criar notificação' });
    }
});

// ============ COUPONS ============

// GET /api/notifications/coupons - Cupons do cliente logado
notificationsRouter.get('/coupons', async (req: Request, res: Response) => {
    try {
        const email = req.query.email as string || req.user!.email;
        const coupons = await prisma.coupon.findMany({
            where: {
                OR: [
                    { customerEmail: email },
                    { customerEmail: null } // Cupons públicos
                ],
                active: true,
                expiresAt: { gte: new Date() },
                usedAt: null
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json(coupons);
    } catch {
        res.status(500).json({ error: 'Erro ao buscar cupons' });
    }
});

// GET /api/notifications/coupons/all - Todos os cupons (admin)
notificationsRouter.get('/coupons/all', requireAdmin, async (_req: Request, res: Response) => {
    try {
        const coupons = await prisma.coupon.findMany({
            orderBy: { createdAt: 'desc' }
        });
        res.json(coupons);
    } catch {
        res.status(500).json({ error: 'Erro ao buscar cupons' });
    }
});

// POST /api/notifications/coupons - Criar/atualizar cupom (admin)
notificationsRouter.post('/coupons', requireAdmin, async (req: Request, res: Response) => {
    try {
        const data = req.body;
        if (data.expiresAt) data.expiresAt = new Date(data.expiresAt);

        if (data.id) {
            await prisma.coupon.update({ where: { id: data.id }, data });
        } else {
            await prisma.coupon.create({ data });
        }
        res.json({ success: true });
    } catch {
        res.status(500).json({ error: 'Erro ao salvar cupom' });
    }
});

// DELETE /api/notifications/coupons/:id - Deletar cupom (admin)
notificationsRouter.delete('/coupons/:id', requireAdmin, async (req: Request, res: Response) => {
    try {
        await prisma.coupon.delete({ where: { id: req.params.id as string } });
        res.json({ success: true });
    } catch {
        res.status(500).json({ error: 'Erro ao deletar cupom' });
    }
});
