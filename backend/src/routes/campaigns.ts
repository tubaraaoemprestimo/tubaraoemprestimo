import { Router, Request, Response } from 'express';
import { prisma } from '../services/prisma';
import { authenticate, requireAdmin } from '../middleware/auth';

export const campaignsRouter = Router();
campaignsRouter.use(authenticate);

// GET /api/campaigns - Listar
campaignsRouter.get('/', requireAdmin, async (_req: Request, res: Response) => {
    try {
        const campaigns = await prisma.campaign.findMany({ orderBy: { priority: 'desc' } });
        res.json(campaigns);
    } catch { res.status(500).json({ error: 'Erro' }); }
});

// POST /api/campaigns - Criar/Atualizar
campaignsRouter.post('/', requireAdmin, async (req: Request, res: Response) => {
    try {
        const { id, title, description, imageUrl, link, startDate, endDate, frequency, priority } = req.body;

        const data: any = { title, description, imageUrl, link, frequency, priority, startDate: new Date(startDate), endDate: new Date(endDate) };

        if (id) {
            await prisma.campaign.update({ where: { id }, data });
        } else {
            await prisma.campaign.create({ data: { ...data, active: true } });
        }
        res.json({ success: true });
    } catch { res.status(500).json({ error: 'Erro ao salvar' }); }
});

// DELETE /api/campaigns/:id - Deletar
campaignsRouter.delete('/:id', requireAdmin, async (req: Request, res: Response) => {
    try {
        await prisma.campaign.delete({ where: { id: req.params.id as string } });
        res.json({ success: true });
    } catch { res.status(500).json({ error: 'Erro' }); }
});

// GET /api/campaigns/active - Listar ativas (para o Cliente)
// Não precisa de admin, mas deve estar autenticado como client
campaignsRouter.get('/active', async (req: Request, res: Response) => {
    try {
        const now = new Date();
        const campaigns = await prisma.campaign.findMany({
            where: {
                active: true,
                startDate: { lte: now },
                endDate: { gte: now }
            },
            orderBy: { priority: 'desc' },
            take: 3
        });
        res.json(campaigns);
    } catch { res.status(500).json({ error: 'Erro' }); }
});
