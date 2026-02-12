import { Router, Request, Response } from 'express';
import { prisma } from '../services/prisma';
import { authenticate, requireAdmin } from '../middleware/auth';

export const settingsRouter = Router();
settingsRouter.use(authenticate);

// ============ SYSTEM SETTINGS ============

// GET /api/settings — Configurações do sistema
settingsRouter.get('/', async (_req: Request, res: Response) => {
    try {
        const settings = await prisma.systemSetting.findMany();
        const result: Record<string, string> = {};
        settings.forEach(s => { result[s.key] = s.value; });
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar configurações' });
    }
});

// PUT /api/settings — Salvar configurações
settingsRouter.put('/', requireAdmin, async (req: Request, res: Response) => {
    try {
        const settings = req.body;
        for (const [key, value] of Object.entries(settings)) {
            await prisma.systemSetting.upsert({
                where: { key },
                update: { value: String(value) },
                create: { key, value: String(value) }
            });
        }
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao salvar configurações' });
    }
});

// ============ BRAND SETTINGS ============

// GET /api/settings/brand
settingsRouter.get('/brand', async (_req: Request, res: Response) => {
    try {
        const brand = await prisma.brandSetting.findFirst();
        res.json(brand || {
            systemName: 'TUBARÃO EMPRÉSTIMO',
            primaryColor: '#FF0000',
            secondaryColor: '#D4AF37',
            backgroundColor: '#000000'
        });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar marca' });
    }
});

// PUT /api/settings/brand
settingsRouter.put('/brand', requireAdmin, async (req: Request, res: Response) => {
    try {
        const data = req.body;
        const existing = await prisma.brandSetting.findFirst();
        if (existing) {
            await prisma.brandSetting.update({ where: { id: existing.id }, data });
        } else {
            await prisma.brandSetting.create({ data });
        }
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao salvar marca' });
    }
});

// ============ WHATSAPP CONFIG ============

// GET /api/settings/whatsapp
settingsRouter.get('/whatsapp', requireAdmin, async (_req: Request, res: Response) => {
    try {
        const config = await prisma.whatsappConfig.findFirst();
        res.json(config || { apiUrl: '', apiKey: '', instanceName: '', isConnected: false });
    } catch (error) {
        res.status(500).json({ error: 'Erro' });
    }
});

// PUT /api/settings/whatsapp
settingsRouter.put('/whatsapp', requireAdmin, async (req: Request, res: Response) => {
    try {
        const data = req.body;
        const existing = await prisma.whatsappConfig.findFirst();
        if (existing) {
            await prisma.whatsappConfig.update({ where: { id: existing.id }, data });
        } else {
            await prisma.whatsappConfig.create({ data });
        }
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Erro' });
    }
});

// ============ GOALS ============

// GET /api/settings/goals
settingsRouter.get('/goals', async (_req: Request, res: Response) => {
    try {
        const goals = await prisma.goalsSetting.findFirst();
        res.json(goals || {
            monthlyLoanGoal: 0,
            monthlyClientGoal: 0,
            monthlyApprovalRateGoal: 0,
            projections: null,
            expectedGrowthRate: 0,
            goalPeriod: ''
        });
    } catch (error) {
        res.status(500).json({ error: 'Erro' });
    }
});

// PUT /api/settings/goals
settingsRouter.put('/goals', requireAdmin, async (req: Request, res: Response) => {
    try {
        const data = req.body;
        const existing = await prisma.goalsSetting.findFirst();
        if (existing) {
            await prisma.goalsSetting.update({ where: { id: existing.id }, data });
        } else {
            await prisma.goalsSetting.create({ data });
        }
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Erro' });
    }
});

// ============ PACKAGES ============

// GET /api/settings/packages
settingsRouter.get('/packages', async (_req: Request, res: Response) => {
    try {
        const packages = await prisma.loanPackage.findMany({ orderBy: { createdAt: 'desc' } });
        res.json(packages);
    } catch (error) {
        res.status(500).json({ error: 'Erro' });
    }
});

// POST /api/settings/packages
settingsRouter.post('/packages', requireAdmin, async (req: Request, res: Response) => {
    try {
        const data = req.body;
        if (data.id) {
            await prisma.loanPackage.update({ where: { id: data.id }, data });
        } else {
            await prisma.loanPackage.create({ data });
        }
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Erro' });
    }
});

// DELETE /api/settings/packages/:id
settingsRouter.delete('/packages/:id', requireAdmin, async (req: Request, res: Response) => {
    try {
        await prisma.loanPackage.delete({ where: { id: req.params.id as string } });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Erro' });
    }
});

// ============ COLLECTION RULES ============

// GET /api/settings/collection-rules
settingsRouter.get('/collection-rules', async (_req: Request, res: Response) => {
    try {
        const rules = await prisma.collectionRule.findMany({ orderBy: { daysOffset: 'asc' } });
        res.json(rules);
    } catch (error) {
        res.status(500).json({ error: 'Erro' });
    }
});

// POST /api/settings/collection-rules
settingsRouter.post('/collection-rules', requireAdmin, async (req: Request, res: Response) => {
    try {
        const data = req.body;
        if (data.id) {
            await prisma.collectionRule.update({ where: { id: data.id }, data });
        } else {
            await prisma.collectionRule.create({ data });
        }
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Erro' });
    }
});

// DELETE /api/settings/collection-rules/:id
settingsRouter.delete('/collection-rules/:id', requireAdmin, async (req: Request, res: Response) => {
    try {
        await prisma.collectionRule.delete({ where: { id: req.params.id as string } });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Erro' });
    }
});
