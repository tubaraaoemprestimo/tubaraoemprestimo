import { Router, Request, Response } from 'express';
import { prisma } from '../services/prisma';
import { authenticate, requireAdmin } from '../middleware/auth';

export const settingsRouter = Router();

// ============ SYSTEM SETTINGS ============

// GET /api/settings — Configurações do sistema
settingsRouter.get('/', authenticate, async (_req: Request, res: Response) => {
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
settingsRouter.put('/', authenticate, requireAdmin, async (req: Request, res: Response) => {
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
        const brand = await prisma.brandSettings.findFirst();
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
settingsRouter.put('/brand', authenticate, requireAdmin, async (req: Request, res: Response) => {
    try {
        const data = req.body;
        const existing = await prisma.brandSettings.findFirst();
        if (existing) {
            await prisma.brandSettings.update({ where: { id: existing.id }, data });
        } else {
            await prisma.brandSettings.create({ data });
        }
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao salvar marca' });
    }
});


// GET /api/settings/theme
settingsRouter.get('/theme', async (_req: Request, res: Response) => {
    const fallback = {
        primaryColor: '#D4AF37',
        secondaryColor: '#1a1a1a',
        accentColor: '#10b981',
        dangerColor: '#ef4444',
        warningColor: '#f59e0b',
        successColor: '#22c55e',
        backgroundColor: '#000000',
        cardColor: '#18181b',
        textColor: '#ffffff'
    };

    try {
        const themeSetting = await prisma.systemSetting.findUnique({ where: { key: 'theme' } });
        if (!themeSetting?.value) {
            res.json(fallback);
            return;
        }
        try {
            res.json(JSON.parse(themeSetting.value));
        } catch {
            res.json(fallback);
        }
    } catch {
        res.status(500).json({ error: 'Erro ao buscar tema' });
    }
});

// PUT /api/settings/theme
settingsRouter.put('/theme', authenticate, requireAdmin, async (req: Request, res: Response) => {
    try {
        const d = req.body || {};
        const payload = {
            primaryColor: d.primary_color || '#D4AF37',
            secondaryColor: d.secondary_color || '#1a1a1a',
            accentColor: d.accent_color || '#10b981',
            dangerColor: d.danger_color || '#ef4444',
            warningColor: d.warning_color || '#f59e0b',
            successColor: d.success_color || '#22c55e',
            backgroundColor: d.background_color || '#000000',
            cardColor: d.card_color || '#18181b',
            textColor: d.text_color || '#ffffff'
        };

        await prisma.systemSetting.upsert({
            where: { key: 'theme' },
            update: { value: JSON.stringify(payload) },
            create: { key: 'theme', value: JSON.stringify(payload) }
        });

        res.json({ success: true });
    } catch {
        res.status(500).json({ error: 'Erro ao salvar tema' });
    }
});

// ============ WHATSAPP CONFIG ============

// GET /api/settings/whatsapp
settingsRouter.get('/whatsapp', authenticate, requireAdmin, async (_req: Request, res: Response) => {
    try {
        const config = await prisma.whatsappConfig.findFirst();
        res.json(config || { apiUrl: '', apiKey: '', instanceName: '', isConnected: false });
    } catch (error) {
        res.status(500).json({ error: 'Erro' });
    }
});

// PUT /api/settings/whatsapp
settingsRouter.put('/whatsapp', authenticate, requireAdmin, async (req: Request, res: Response) => {
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
settingsRouter.get('/goals', authenticate, async (_req: Request, res: Response) => {
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
settingsRouter.put('/goals', authenticate, requireAdmin, async (req: Request, res: Response) => {
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
settingsRouter.get('/packages', authenticate, async (_req: Request, res: Response) => {
    try {
        const packages = await prisma.loanPackage.findMany({ orderBy: { createdAt: 'desc' } });
        res.json(packages);
    } catch (error) {
        res.status(500).json({ error: 'Erro' });
    }
});

// POST /api/settings/packages
settingsRouter.post('/packages', authenticate, requireAdmin, async (req: Request, res: Response) => {
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
settingsRouter.delete('/packages/:id', authenticate, requireAdmin, async (req: Request, res: Response) => {
    try {
        await prisma.loanPackage.delete({ where: { id: req.params.id as string } });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Erro' });
    }
});

// ============ COLLECTION RULES ============

// GET /api/settings/collection-rules
settingsRouter.get('/collection-rules', authenticate, async (_req: Request, res: Response) => {
    try {
        const rules = await prisma.collectionRule.findMany({ orderBy: { daysOffset: 'asc' } });
        res.json(rules);
    } catch (error) {
        res.status(500).json({ error: 'Erro' });
    }
});

// POST /api/settings/collection-rules
settingsRouter.post('/collection-rules', authenticate, requireAdmin, async (req: Request, res: Response) => {
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
settingsRouter.delete('/collection-rules/:id', authenticate, requireAdmin, async (req: Request, res: Response) => {
    try {
        await prisma.collectionRule.delete({ where: { id: req.params.id as string } });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Erro' });
    }
});
