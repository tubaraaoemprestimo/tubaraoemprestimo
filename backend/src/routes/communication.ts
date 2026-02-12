import { Router, Request, Response } from 'express';
import { prisma } from '../services/prisma';
import { authenticate, requireAdmin } from '../middleware/auth';

export const communicationRouter = Router();
communicationRouter.use(authenticate);
communicationRouter.use(requireAdmin);

// ============ MESSAGE TEMPLATES ============

// GET /api/communication/templates - Listar templates
communicationRouter.get('/templates', async (_req: Request, res: Response) => {
    try {
        const templates = await prisma.messageTemplate.findMany({
            orderBy: { createdAt: 'desc' }
        });
        res.json(templates);
    } catch {
        res.status(500).json({ error: 'Erro ao buscar templates' });
    }
});

// POST /api/communication/templates - Criar template
communicationRouter.post('/templates', async (req: Request, res: Response) => {
    try {
        const { name, category, content, variables, isActive } = req.body;
        const template = await prisma.messageTemplate.create({
            data: {
                name,
                category,
                content,
                variables: variables || [],
                isActive: isActive !== false
            }
        });
        res.status(201).json(template);
    } catch {
        res.status(500).json({ error: 'Erro ao criar template' });
    }
});

// PUT /api/communication/templates/:id - Atualizar template
communicationRouter.put('/templates/:id', async (req: Request, res: Response) => {
    try {
        const id = String(req.params.id);
        const { name, category, content, variables, isActive } = req.body;
        const template = await prisma.messageTemplate.update({
            where: { id },
            data: { name, category, content, variables, isActive }
        });
        res.json(template);
    } catch {
        res.status(500).json({ error: 'Erro ao atualizar template' });
    }
});

// DELETE /api/communication/templates/:id - Deletar template
communicationRouter.delete('/templates/:id', async (req: Request, res: Response) => {
    try {
        const id = String(req.params.id);
        await prisma.messageTemplate.delete({ where: { id } });
        res.json({ success: true });
    } catch {
        res.status(500).json({ error: 'Erro ao deletar template' });
    }
});

// ============ COUPONS ============

// GET /api/communication/coupons - Listar cupons
communicationRouter.get('/coupons', async (_req: Request, res: Response) => {
    try {
        const coupons = await prisma.coupon.findMany({
            orderBy: { createdAt: 'desc' }
        });
        res.json(coupons);
    } catch {
        res.status(500).json({ error: 'Erro ao buscar cupons' });
    }
});

// ============ SCHEDULED STATUS ============

// GET /api/communication/scheduled-status - Listar status agendados
communicationRouter.get('/scheduled-status', async (_req: Request, res: Response) => {
    try {
        const statuses = await prisma.scheduledStatus.findMany({
            orderBy: { scheduledAt: 'asc' }
        });
        res.json(statuses);
    } catch {
        res.status(500).json({ error: 'Erro ao buscar status agendados' });
    }
});

// DELETE /api/communication/scheduled-status/:id - Deletar status agendado
communicationRouter.delete('/scheduled-status/:id', async (req: Request, res: Response) => {
    try {
        const id = String(req.params.id);
        await prisma.scheduledStatus.delete({ where: { id } });
        res.json({ success: true });
    } catch {
        res.status(500).json({ error: 'Erro ao deletar status agendado' });
    }
});

// POST /api/communication/scheduled-status/:id/post - Postar status agora
communicationRouter.post('/scheduled-status/:id/post', async (req: Request, res: Response) => {
    try {
        const id = String(req.params.id);
        // Just mark as posted, actual posting is handled by whatsappStatus router
        await prisma.scheduledStatus.update({
            where: { id },
            data: { status: 'POSTED', postedAt: new Date() }
        });
        res.json({ success: true });
    } catch {
        res.status(500).json({ error: 'Erro ao postar status' });
    }
});

// ============ REFERRAL BONUS CONFIG ============

// GET /api/communication/referral-bonus - Obter valor do bônus
communicationRouter.get('/referral-bonus', async (_req: Request, res: Response) => {
    try {
        const setting = await prisma.systemSetting.findUnique({
            where: { key: 'referral_bonus' }
        });
        res.json({ value: setting?.value ? parseFloat(setting.value) : 50 });
    } catch {
        res.status(500).json({ error: 'Erro ao buscar configuração de bônus' });
    }
});

// PUT /api/communication/referral-bonus - Atualizar valor do bônus
communicationRouter.put('/referral-bonus', async (req: Request, res: Response) => {
    try {
        const { value } = req.body;
        await prisma.systemSetting.upsert({
            where: { key: 'referral_bonus' },
            update: { value: String(value) },
            create: { key: 'referral_bonus', value: String(value) }
        });
        res.json({ success: true });
    } catch {
        res.status(500).json({ error: 'Erro ao atualizar configuração de bônus' });
    }
});
