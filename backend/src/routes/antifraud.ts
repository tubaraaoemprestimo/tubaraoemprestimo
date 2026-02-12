import { Router, Request, Response } from 'express';
import { prisma } from '../services/prisma';
import { authenticate } from '../middleware/auth';

export const antifraudRouter = Router();
antifraudRouter.use(authenticate);

// POST /api/antifraud/log - Registrar evento de risco
antifraudRouter.post('/log', async (req: Request, res: Response) => {
    try {
        const { eventType, details, latitude, longitude } = req.body;

        await prisma.riskEvent.create({
            data: {
                userId: req.user!.id,
                eventType,
                details: typeof details === 'object' ? JSON.stringify(details) : details,
                latitude,
                longitude,
                ipAddress: req.ip,
                userAgent: req.headers['user-agent']
            }
        });

        res.json({ success: true });
    } catch { res.status(500).json({ error: 'Erro ao logar' }); }
});

// GET /api/antifraud/blacklist/:cpf - Verificar CPF na blacklist
antifraudRouter.get('/blacklist/:cpf', async (req: Request, res: Response) => {
    try {
        const cpf = (req.params.cpf as string).replace(/\D/g, ''); // Limpa formatação
        const blocked = await prisma.blacklist.findFirst({
            where: { cpf, active: true }
        });

        if (blocked) {
            res.json({ blocked: true, reason: blocked.reason });
        } else {
            res.json({ blocked: false });
        }
    } catch { res.status(500).json({ error: 'Erro' }); }
});

// POST /api/antifraud/device/check - Verificar novo dispositivo
// Substitui a logica complexa de Device Security
antifraudRouter.post('/device/check', async (req: Request, res: Response) => {
    try {
        const { fingerprint } = req.body;

        // Verifica se já existe nos confiáveis
        const trusted = await prisma.trustedDevice.findFirst({
            where: {
                userId: req.user!.id,
                deviceFingerprint: fingerprint
            }
        });

        if (trusted) {
            // Atualiza last seen
            await prisma.trustedDevice.update({
                where: { id: trusted.id },
                data: { lastSeenAt: new Date(), lastIp: req.ip }
            });
            res.json({ trusted: true });
        } else {
            // Verifica se está bloqueado explicitamente
            const blocked = await prisma.securityBlock.findFirst({
                where: {
                    userId: req.user!.id,
                    deviceFingerprint: fingerprint,
                    isResolved: false
                }
            });

            if (blocked) {
                res.status(403).json({ error: 'Dispositivo bloqueado', reason: blocked.blockReason });
            } else {
                // É novo dispositivo -> Loga e avisa (pode bloquear dependendo da config)
                // Aqui simplifiquei, no real precisa ler SystemSettings
                await prisma.auditLog.create({
                    data: {
                        userId: req.user!.id,
                        userName: req.user!.name,
                        action: 'NEW_DEVICE_LOGIN',
                        entity: 'DEVICE',
                        entityId: fingerprint,
                        details: JSON.stringify(req.body),
                        ipAddress: req.ip
                    }
                });
                res.json({ trusted: false, isNew: true });
            }
        }
    } catch { res.status(500).json({ error: 'Erro' }); }
});
