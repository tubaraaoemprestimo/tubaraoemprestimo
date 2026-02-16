import { Router, Request, Response } from 'express';
import { prisma } from '../services/prisma';
import { authenticate, requireAdmin } from '../middleware/auth';

export const communicationRouter = Router();
communicationRouter.use(authenticate);
communicationRouter.use(requireAdmin);

// ============ MESSAGE TEMPLATES ============

// GET /api/communication/templates - Listar templates
communicationRouter.get('/templates', async (req: Request, res: Response) => {
    try {
        const { trigger_event, is_active, category } = req.query;

        const where: any = {};
        if (trigger_event) where.triggerEvent = trigger_event;
        if (is_active) where.isActive = is_active === 'true';
        if (category) where.category = category;

        const templates = await prisma.messageTemplate.findMany({
            where,
            orderBy: { createdAt: 'desc' }
        });
        res.json(templates);
    } catch (error) {
        console.error('[Communication] Erro ao buscar templates:', error);
        res.status(500).json({ error: 'Erro ao buscar templates' });
    }
});

// POST /api/communication/templates - Criar template
communicationRouter.post('/templates', async (req: Request, res: Response) => {
    try {
        const { name, category, triggerEvent, channel, subject, content, variables, isActive } = req.body;
        const template = await prisma.messageTemplate.create({
            data: {
                name,
                category,
                triggerEvent,
                channel,
                subject,
                content,
                variables: variables || [],
                isActive: isActive !== false
            }
        });
        res.status(201).json(template);
    } catch (error) {
        console.error('[Communication] Erro ao criar template:', error);
        res.status(500).json({ error: 'Erro ao criar template' });
    }
});

// PUT /api/communication/templates/:id - Atualizar template
communicationRouter.put('/templates/:id', async (req: Request, res: Response) => {
    try {
        const id = String(req.params.id);
        const { name, category, triggerEvent, channel, subject, content, variables, isActive } = req.body;
        const template = await prisma.messageTemplate.update({
            where: { id },
            data: { name, category, triggerEvent, channel, subject, content, variables, isActive }
        });
        res.json(template);
    } catch (error) {
        console.error('[Communication] Erro ao atualizar template:', error);
        res.status(500).json({ error: 'Erro ao atualizar template' });
    }
});

// DELETE /api/communication/templates/:id - Deletar template
communicationRouter.delete('/templates/:id', async (req: Request, res: Response) => {
    try {
        const id = String(req.params.id);
        await prisma.messageTemplate.delete({ where: { id } });
        res.json({ success: true });
    } catch (error) {
        console.error('[Communication] Erro ao deletar template:', error);
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

// POST /api/communication/coupons - Criar cupom
communicationRouter.post('/coupons', async (req: Request, res: Response) => {
    try {
        const { code, discount_percent, description, expires_at, usage_limit, active, customerEmail } = req.body;
        const coupon = await prisma.coupon.create({
            data: {
                code: code || `TUB${Date.now().toString(36).toUpperCase()}`,
                discount: discount_percent || 10,
                description: description || '',
                expiresAt: expires_at ? new Date(expires_at) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                usageLimit: usage_limit || 100,
                usageCount: 0,
                active: active !== false,
                customerEmail: customerEmail || null,
            }
        });
        res.status(201).json(coupon);
    } catch (err: any) {
        console.error('[Communication] Erro ao criar cupom:', err);
        res.status(500).json({ error: 'Erro ao criar cupom' });
    }
});

// PUT /api/communication/coupons/:id - Atualizar cupom
communicationRouter.put('/coupons/:id', async (req: Request, res: Response) => {
    try {
        const id = String(req.params.id);
        const { code, discount_percent, description, expires_at, usage_limit, active } = req.body;
        const data: any = {};
        if (code !== undefined) data.code = code;
        if (discount_percent !== undefined) data.discount = discount_percent;
        if (description !== undefined) data.description = description;
        if (expires_at !== undefined) data.expiresAt = new Date(expires_at);
        if (usage_limit !== undefined) data.usageLimit = usage_limit;
        if (active !== undefined) data.active = active;

        const coupon = await prisma.coupon.update({ where: { id }, data });
        res.json(coupon);
    } catch {
        res.status(500).json({ error: 'Erro ao atualizar cupom' });
    }
});

// DELETE /api/communication/coupons/:id - Deletar cupom
communicationRouter.delete('/coupons/:id', async (req: Request, res: Response) => {
    try {
        const id = String(req.params.id);
        await prisma.coupon.delete({ where: { id } });
        res.json({ success: true });
    } catch {
        res.status(500).json({ error: 'Erro ao deletar cupom' });
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
