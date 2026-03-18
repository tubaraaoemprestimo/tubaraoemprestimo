import { Router, Request, Response } from 'express';
import { prisma } from '../services/prisma';
import { authenticate, requireAdmin } from '../middleware/auth';
import axios from 'axios';

export const whatsappStatusRouter = Router();

// ============ Helpers ============

/**
 * Posta um status no WhatsApp via Evolution API
 */
async function postStatusToWhatsApp(
    config: { apiUrl: string; apiKey: string; instanceName: string },
    imageUrl: string,
    caption?: string | null
): Promise<{ success: boolean; error?: string }> {
    try {
        // Evolution API endpoint para postar status/stories
        const url = `${config.apiUrl}/message/sendStatus/${config.instanceName}`;

        console.log('[WhatsApp Status] Posting to Evolution API:', url);
        console.log('[WhatsApp Status] Image URL:', imageUrl);
        console.log('[WhatsApp Status] Caption:', caption);

        await axios.post(url, {
            type: 'image',
            content: imageUrl,
            caption: caption || '',
            allContacts: true,
            backgroundColor: '#000000',
            font: 1
        }, {
            headers: {
                apikey: config.apiKey,
                'Content-Type': 'application/json'
            },
            timeout: 60000
        });

        return { success: true };
    } catch (error: any) {
        const errorMsg = error.response?.data?.message || error.message || 'Erro desconhecido ao postar status';
        console.error('[WhatsApp Status] Erro ao postar:', errorMsg);
        console.error('[WhatsApp Status] Full error:', error.response?.data || error.message);
        return { success: false, error: errorMsg };
    }
}

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

        // Busca config do WhatsApp
        const whatsappConfig = await prisma.whatsappConfig.findFirst();
        if (!whatsappConfig || !whatsappConfig.isConnected) {
            res.status(400).json({ error: 'WhatsApp não configurado ou desconectado' });
            return;
        }

        // Busca status pendentes que já passaram do horário agendado
        const now = new Date();
        const pendingStatuses = await prisma.scheduledStatus.findMany({
            where: {
                status: 'PENDING',
                scheduledAt: { lte: now }
            },
            orderBy: { scheduledAt: 'asc' },
            take: 10 // Processa no máximo 10 por vez
        });

        if (pendingStatuses.length === 0) {
            res.json({ success: true, processed: 0, message: 'Nenhum status pendente para processar' });
            return;
        }

        let posted = 0;
        let failed = 0;
        const results: { id: string; status: string; error?: string }[] = [];

        for (const scheduledStatus of pendingStatuses) {
            const result = await postStatusToWhatsApp(
                {
                    apiUrl: whatsappConfig.apiUrl,
                    apiKey: whatsappConfig.apiKey,
                    instanceName: whatsappConfig.instanceName
                },
                scheduledStatus.imageUrl,
                scheduledStatus.caption
            );

            if (result.success) {
                await prisma.scheduledStatus.update({
                    where: { id: scheduledStatus.id },
                    data: {
                        status: 'POSTED',
                        postedAt: new Date()
                    }
                });
                posted++;
                results.push({ id: scheduledStatus.id, status: 'POSTED' });
            } else {
                await prisma.scheduledStatus.update({
                    where: { id: scheduledStatus.id },
                    data: {
                        status: 'FAILED',
                        errorMessage: result.error || 'Erro desconhecido'
                    }
                });
                failed++;
                results.push({ id: scheduledStatus.id, status: 'FAILED', error: result.error });
            }

            // Delay entre posts para evitar rate limiting
            await new Promise(resolve => setTimeout(resolve, 2000));
        }

        // Loga no NotificationLog
        await prisma.notificationLog.create({
            data: {
                type: 'WHATSAPP',
                recipient: 'status-broadcast',
                subject: 'Processamento de fila de status',
                content: `Processados: ${pendingStatuses.length} | Postados: ${posted} | Falhas: ${failed}`,
                status: failed === 0 ? 'SENT' : 'FAILED',
                errorMessage: failed > 0 ? `${failed} status falharam` : null,
                metadata: {
                    processed: pendingStatuses.length,
                    posted,
                    failed,
                    results
                }
            }
        });

        console.log(`[WhatsApp Status] Fila processada: ${posted} postados, ${failed} falhas de ${pendingStatuses.length} total`);
        res.json({ success: true, processed: pendingStatuses.length, posted, failed, results });
    } catch (error: any) {
        console.error('[WhatsApp Status] Erro ao processar fila:', error);
        res.status(500).json({ error: 'Erro ao processar fila de status' });
    }
});

// POST /api/whatsapp/post-now/:id - Postar status imediatamente (admin only)
whatsappStatusRouter.post('/post-now/:id', authenticate, requireAdmin, async (req: Request, res: Response) => {
    try {
        const idParam = req.params.id;
        const id = Array.isArray(idParam) ? idParam[0] : idParam;

        const scheduledStatus = await prisma.scheduledStatus.findUnique({ where: { id } });
        if (!scheduledStatus) {
            res.status(404).json({ error: 'Status não encontrado' });
            return;
        }

        if (scheduledStatus.status === 'POSTED') {
            res.status(400).json({ error: 'Status já foi postado' });
            return;
        }

        // Busca config do WhatsApp
        const whatsappConfig = await prisma.whatsappConfig.findFirst();
        if (!whatsappConfig || !whatsappConfig.isConnected) {
            res.status(400).json({ error: 'WhatsApp não configurado ou desconectado' });
            return;
        }

        const result = await postStatusToWhatsApp(
            {
                apiUrl: whatsappConfig.apiUrl,
                apiKey: whatsappConfig.apiKey,
                instanceName: whatsappConfig.instanceName
            },
            scheduledStatus.imageUrl,
            scheduledStatus.caption
        );

        if (result.success) {
            await prisma.scheduledStatus.update({
                where: { id },
                data: { status: 'POSTED', postedAt: new Date() }
            });
            res.json({ success: true, message: 'Status postado com sucesso' });
        } else {
            await prisma.scheduledStatus.update({
                where: { id },
                data: { status: 'FAILED', errorMessage: result.error }
            });
            res.status(500).json({ error: 'Falha ao postar status', details: result.error });
        }
    } catch {
        res.status(500).json({ error: 'Erro ao postar status' });
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
