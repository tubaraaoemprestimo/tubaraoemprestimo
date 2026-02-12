import { Router, Request, Response } from 'express';
import { prisma } from '../services/prisma';
import { authenticate, requireAdmin } from '../middleware/auth';
import webpush from 'web-push';

export const pushRouter = Router();
pushRouter.use(authenticate);

// ============ Web Push Configuration ============

// Configura VAPID keys se disponíveis
const vapidPublicKey = process.env.VAPID_PUBLIC_KEY || '';
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || '';
const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:admin@tubarao.com';

if (vapidPublicKey && vapidPrivateKey) {
    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
}

// ============ Helper: Send Push to Subscription ============

async function sendPushToSubscription(
    subscription: { endpoint: string; p256dh: string; auth: string },
    payload: { title: string; body: string; data?: Record<string, any> }
): Promise<{ success: boolean; error?: string }> {
    try {
        const pushSubscription = {
            endpoint: subscription.endpoint,
            keys: {
                p256dh: subscription.p256dh,
                auth: subscription.auth
            }
        };

        await webpush.sendNotification(
            pushSubscription,
            JSON.stringify({
                title: payload.title,
                body: payload.body,
                icon: '/icon-192.png',
                badge: '/badge-72.png',
                data: payload.data || {},
                timestamp: Date.now()
            }),
            {
                TTL: 60 * 60, // 1 hora
                urgency: 'high'
            }
        );

        return { success: true };
    } catch (error: any) {
        // Se o endpoint expirou (410 Gone), remove a subscription
        if (error.statusCode === 410 || error.statusCode === 404) {
            return { success: false, error: 'SUBSCRIPTION_EXPIRED' };
        }
        return { success: false, error: error.message || 'Erro ao enviar push' };
    }
}

// ============ ROUTES ============

// POST /api/push/register - Registrar token/subscription do dispositivo
pushRouter.post('/register', async (req: Request, res: Response) => {
    try {
        const { endpoint, p256dh, auth, userAgent } = req.body;

        if (!endpoint || !p256dh || !auth) {
            res.status(400).json({ error: 'Campos obrigatórios: endpoint, p256dh, auth' });
            return;
        }

        // Verifica se já existe subscription com esse endpoint
        const existing = await prisma.pushSubscription.findFirst({
            where: {
                userId: req.user!.id,
                endpoint
            }
        });

        if (existing) {
            // Atualiza keys (podem ter mudado)
            await prisma.pushSubscription.update({
                where: { id: existing.id },
                data: {
                    p256dh,
                    auth,
                    userAgent: userAgent || req.headers['user-agent'] || null
                }
            });
            res.json({ success: true, message: 'Subscription atualizada', id: existing.id });
        } else {
            // Cria nova subscription
            const sub = await prisma.pushSubscription.create({
                data: {
                    userId: req.user!.id,
                    endpoint,
                    p256dh,
                    auth,
                    userAgent: userAgent || req.headers['user-agent'] || null
                }
            });
            res.json({ success: true, message: 'Subscription registrada', id: sub.id });
        }
    } catch (error: any) {
        console.error('[Push] Erro ao registrar:', error);
        res.status(500).json({ error: 'Erro ao registrar subscription' });
    }
});

// POST /api/push/send - Enviar push notification (admin only)
pushRouter.post('/send', requireAdmin, async (req: Request, res: Response) => {
    try {
        const { to, title, body, data } = req.body;

        if (!title || !body) {
            res.status(400).json({ error: 'Campos obrigatórios: title, body' });
            return;
        }

        if (!vapidPublicKey || !vapidPrivateKey) {
            res.status(500).json({ error: 'VAPID keys não configuradas. Defina VAPID_PUBLIC_KEY e VAPID_PRIVATE_KEY.' });
            return;
        }

        // Determina os destinatários
        let subscriptions: { id: string; userId: string; endpoint: string; p256dh: string; auth: string }[] = [];

        if (to === 'admin') {
            // Busca subscriptions de admins
            subscriptions = await prisma.pushSubscription.findMany({
                where: {
                    user: { role: 'ADMIN' }
                },
                select: { id: true, userId: true, endpoint: true, p256dh: true, auth: true }
            });
        } else if (to === 'all') {
            // Todas as subscriptions
            subscriptions = await prisma.pushSubscription.findMany({
                select: { id: true, userId: true, endpoint: true, p256dh: true, auth: true }
            });
        } else if (Array.isArray(to)) {
            // Lista de user IDs específicos
            subscriptions = await prisma.pushSubscription.findMany({
                where: { userId: { in: to } },
                select: { id: true, userId: true, endpoint: true, p256dh: true, auth: true }
            });
        } else {
            res.status(400).json({ error: 'Campo "to" deve ser "admin", "all" ou array de user IDs' });
            return;
        }

        if (subscriptions.length === 0) {
            res.json({ success: true, sent: 0, failed: 0, message: 'Nenhuma subscription encontrada' });
            return;
        }

        // Envia para todas as subscriptions
        const payload = { title, body, data };
        let sent = 0;
        let failed = 0;
        const expiredIds: string[] = [];

        const results = await Promise.allSettled(
            subscriptions.map(async (sub) => {
                const result = await sendPushToSubscription(sub, payload);
                if (result.success) {
                    sent++;
                } else {
                    failed++;
                    if (result.error === 'SUBSCRIPTION_EXPIRED') {
                        expiredIds.push(sub.id);
                    }
                }
                return result;
            })
        );

        // Remove subscriptions expiradas
        if (expiredIds.length > 0) {
            await prisma.pushSubscription.deleteMany({
                where: { id: { in: expiredIds } }
            });
            console.log(`[Push] Removidas ${expiredIds.length} subscriptions expiradas`);
        }

        // Loga no NotificationLog
        await prisma.notificationLog.create({
            data: {
                type: 'PUSH',
                recipient: to === 'all' ? 'all' : to === 'admin' ? 'admin' : JSON.stringify(to),
                subject: title,
                content: body,
                status: sent > 0 ? 'SENT' : 'FAILED',
                errorMessage: failed > 0 ? `${failed} falha(s) de ${subscriptions.length}` : null,
                metadata: {
                    sent,
                    failed,
                    expiredRemoved: expiredIds.length,
                    totalSubscriptions: subscriptions.length,
                    sentBy: req.user!.id,
                    data: data || null
                }
            }
        });

        console.log(`[Push] Enviado: ${sent} sucesso, ${failed} falha(s), ${expiredIds.length} expiradas removidas`);
        res.json({ success: true, sent, failed, expiredRemoved: expiredIds.length });
    } catch (error: any) {
        console.error('[Push] Erro ao enviar:', error);
        res.status(500).json({ error: 'Erro ao enviar push notifications' });
    }
});

// GET /api/push/subscriptions - Listar subscriptions do usuário atual
pushRouter.get('/subscriptions', async (req: Request, res: Response) => {
    try {
        const subscriptions = await prisma.pushSubscription.findMany({
            where: { userId: req.user!.id },
            orderBy: { createdAt: 'desc' }
        });
        res.json(subscriptions);
    } catch {
        res.status(500).json({ error: 'Erro ao buscar subscriptions' });
    }
});

// DELETE /api/push/subscriptions/:id - Remover subscription
pushRouter.delete('/subscriptions/:id', async (req: Request, res: Response) => {
    try {
        const subscription = await prisma.pushSubscription.findUnique({
            where: { id: req.params.id as string }
        });

        if (!subscription) {
            res.status(404).json({ error: 'Subscription não encontrada' });
            return;
        }

        // Usuário só pode deletar suas próprias subscriptions (admin pode deletar qualquer uma)
        if (subscription.userId !== req.user!.id && req.user!.role !== 'ADMIN') {
            res.status(403).json({ error: 'Sem permissão para remover esta subscription' });
            return;
        }

        await prisma.pushSubscription.delete({ where: { id: req.params.id as string } });
        res.json({ success: true });
    } catch {
        res.status(500).json({ error: 'Erro ao remover subscription' });
    }
});

// GET /api/push/vapid-key - Retorna a VAPID public key (para o frontend se inscrever)
pushRouter.get('/vapid-key', async (_req: Request, res: Response) => {
    try {
        if (!vapidPublicKey) {
            res.status(500).json({ error: 'VAPID public key não configurada' });
            return;
        }
        res.json({ publicKey: vapidPublicKey });
    } catch {
        res.status(500).json({ error: 'Erro ao buscar VAPID key' });
    }
});
