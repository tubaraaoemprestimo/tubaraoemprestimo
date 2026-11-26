import { Router, Request, Response } from 'express';
import { prisma } from '../services/prisma';
import { authenticate, requireAdmin } from '../middleware/auth';
import axios from 'axios';

export const whatsappStatusRouter = Router();

// ============ Helpers ============

// ============ ROUTES ============

// POST /api/whatsapp/schedule-status - Agendar novo status (admin only)
whatsappStatusRouter.post('/schedule-status', authenticate, requireAdmin, async (req: Request, res: Response) => {
    try {
        const { imageUrl, caption, scheduledAt } = req.body;

        if (!imageUrl) {
            res.status(400).json({ error: 'imageUrl é obrigatório' });
            return;
        }

        const scheduledDate = scheduledAt ? new Date(scheduledAt) : new Date();

        const scheduled = await prisma.scheduledStatus.create({
            data: {
                imageUrl,
                caption: caption || null,
                status: 'PENDING',
                scheduledAt: scheduledDate,
                startDate: scheduledDate,
                selectedDays: [],
                postTimes: [],
                recurrence: 'ONCE',
                postsPerDay: 1,
                totalDays: 1
            }
        });

        console.log(`[WhatsApp Status] Agendado: ${scheduled.id} para ${scheduled.scheduledAt}`);
        res.json({ success: true, id: scheduled.id, scheduledAt: scheduled.scheduledAt });
    } catch (error: any) {
        console.error('[WhatsApp Status] Erro ao agendar:', error);
        res.status(500).json({ error: 'Erro ao agendar status' });
    }
});

// GET /api/whatsapp/status-queue - Listar status pendentes (admin only)
whatsappStatusRouter.get('/status-queue', authenticate, requireAdmin, async (req: Request, res: Response) => {
    try {
        const { status: filterStatus, limit = '50' } = req.query;
        const normalizedStatus = Array.isArray(filterStatus) ? filterStatus[0] : filterStatus;

        const where: any = {};
        if (normalizedStatus) {
            where.status = normalizedStatus;
        }

        const statuses = await prisma.scheduledStatus.findMany({
            where,
            orderBy: { scheduledAt: 'asc' },
            take: parseInt(limit as string)
        });

        const counts = await prisma.scheduledStatus.groupBy({
            by: ['status'],
            _count: { id: true }
        });

        const summary: Record<string, number> = {};
        for (const c of counts) {
            summary[c.status] = c._count.id;
        }

        res.json({ statuses, summary });
    } catch {
        res.status(500).json({ error: 'Erro ao buscar fila de status' });
    }
});

// PUT /api/whatsapp/status/:id - Atualizar registro de status (admin only)
whatsappStatusRouter.put('/status/:id', authenticate, requireAdmin, async (req: Request, res: Response) => {
    try {
        const idParam = req.params.id;
        const id = Array.isArray(idParam) ? idParam[0] : idParam;
        const { status, errorMessage, imageUrl, caption, scheduledAt } = req.body;

        const existing = await prisma.scheduledStatus.findUnique({ where: { id } });
        if (!existing) {
            res.status(404).json({ error: 'Status não encontrado' });
            return;
        }

        const data: any = {};
        if (status !== undefined) data.status = status;
        if (errorMessage !== undefined) data.errorMessage = errorMessage;
        if (imageUrl !== undefined) data.imageUrl = imageUrl;
        if (caption !== undefined) data.caption = caption;
        if (scheduledAt !== undefined) data.scheduledAt = new Date(scheduledAt);

        // Se marcando como POSTED, define postedAt
        if (status === 'POSTED') {
            data.postedAt = new Date();
        }

        await prisma.scheduledStatus.update({ where: { id }, data });
        res.json({ success: true });
    } catch {
        res.status(500).json({ error: 'Erro ao atualizar status' });
    }
});

// DELETE /api/whatsapp/status/:id - Deletar status agendado (admin only)
whatsappStatusRouter.delete('/status/:id', authenticate, requireAdmin, async (req: Request, res: Response) => {
    try {
        const idParam = req.params.id;
        const id = Array.isArray(idParam) ? idParam[0] : idParam;

        const existing = await prisma.scheduledStatus.findUnique({ where: { id } });
        if (!existing) {
            res.status(404).json({ error: 'Status não encontrado' });
            return;
        }

        if (existing.status === 'POSTED') {
            res.status(400).json({ error: 'Não é possível deletar um status já postado' });
            return;
        }

        await prisma.scheduledStatus.delete({ where: { id } });
        res.json({ success: true });
    } catch {
        res.status(500).json({ error: 'Erro ao deletar status' });
    }
});

// POST /api/whatsapp/process-queue - Processar fila de status pendentes (CRON trigger)
// Este endpoint pode ser chamado por um serviço CRON externo
// Aceita autenticação via header X-CRON-SECRET ou via JWT admin
whatsappStatusRouter.post('/process-queue', async (req: Request, res: Response) => {
    try {
        // Verificação de segurança: aceita CRON secret OU admin autenticado
        const cronSecret = req.headers['x-cron-secret'];
        const expectedSecret = process.env.CRON_SECRET;

        const isValidCron = expectedSecret && cronSecret === expectedSecret;
        const isAdmin = req.user?.role === 'ADMIN';

        if (!isValidCron && !isAdmin) {
            // Tenta autenticar via JWT se não é CRON
            res.status(401).json({ error: 'Acesso não autorizado. Use X-CRON-SECRET ou autenticação admin.' });
            return;
        }

        const { runDueStatuses } = await import('../services/statusPublisher');
        await runDueStatuses();
        res.json({ success: true });
    } catch (error: any) {
        console.error('[WhatsApp Status] Erro ao processar fila:', error);
        res.status(500).json({ error: 'Erro ao processar fila de status' });
    }
});

// POST /api/whatsapp/post-now/:id - Postar status imediatamente (admin only)
whatsappStatusRouter.post('/post-now/:id', authenticate, requireAdmin, async (req: Request, res: Response) => {
    try {
        const { postNow } = await import('../services/statusPublisher');
        await postNow(String(req.params.id));
        res.json({ success: true, message: 'Status postado com sucesso' });
    } catch (e: any) {
        res.status(400).json({ error: e?.message || 'Erro ao postar status' });
    }
});

// POST /api/whatsapp/schedule-bulk - Agendar múltiplos status de uma vez (admin only)
whatsappStatusRouter.post('/schedule-bulk', authenticate, requireAdmin, async (req: Request, res: Response) => {
    try {
        const { records } = req.body;

        if (!records || !Array.isArray(records) || records.length === 0) {
            res.status(400).json({ error: 'records é obrigatório e deve ser um array' });
            return;
        }

        if (records.length > 100) {
            res.status(400).json({ error: 'Máximo de 100 registros por vez' });
            return;
        }

        const created = await prisma.scheduledStatus.createMany({
            data: records.map((r: any) => {
                const scheduledAt = new Date(r.scheduled_at || r.scheduledAt);
                return {
                    imageUrl: r.image_url || r.imageUrl,
                    caption: r.caption || null,
                    status: 'PENDING',
                    scheduledAt: scheduledAt,
                    startDate: scheduledAt,
                    selectedDays: [],
                    postTimes: [],
                    recurrence: 'ONCE',
                    postsPerDay: 1,
                    totalDays: 1
                };
            })
        });

        res.json({ success: true, count: created.count });
    } catch (error: any) {
        console.error('[WhatsApp Status] Erro no schedule-bulk:', error);
        res.status(500).json({ error: 'Erro ao agendar status em massa' });
    }
});

// DELETE /api/whatsapp/status-bulk - Deletar múltiplos status (admin only)
whatsappStatusRouter.delete('/status-bulk', authenticate, requireAdmin, async (req: Request, res: Response) => {
    try {
        const { ids } = req.body;

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            res.status(400).json({ error: 'ids é obrigatório e deve ser um array' });
            return;
        }

        const { count } = await prisma.scheduledStatus.deleteMany({
            where: {
                id: { in: ids },
                status: { not: 'POSTED' }
            }
        });

        res.json({ success: true, deleted: count });
    } catch {
        res.status(500).json({ error: 'Erro ao deletar status em massa' });
    }
});
