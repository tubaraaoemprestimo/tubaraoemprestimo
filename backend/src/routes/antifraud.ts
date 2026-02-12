import { Router, Request, Response } from 'express';
import { prisma } from '../services/prisma';
import { authenticate } from '../middleware/auth';

export const antifraudRouter = Router();

// GET /api/antifraud/risk-count?ip=... (compatibilidade frontend)
antifraudRouter.get('/risk-count', async (req: Request, res: Response) => {
    try {
        const ip = String(req.query.ip || '').trim();
        if (!ip) {
            res.json({ count: 0 });
            return;
        }

        const count = await prisma.riskEvent.count({ where: { ipAddress: ip } });
        res.json({ count });
    } catch {
        res.json({ count: 0 });
    }
});

// POST /api/antifraud/risk-event (compatibilidade frontend pré-login)
antifraudRouter.post('/risk-event', async (req: Request, res: Response) => {
    try {
        const body = req.body || {};

        await prisma.riskEvent.create({
            data: {
                userId: body.user_id || body.userId || null,
                eventType: body.action || body.eventType || 'UNKNOWN',
                riskLevel: body.risk_level || null,
                details: {
                    sessionId: body.session_id || body.sessionId || null,
                    riskScore: body.risk_score || null,
                    riskFactors: body.risk_factors || null,
                    additionalData: body.additional_data || null
                },
                ipAddress: body.ip || req.ip,
                userAgent: body.user_agent || req.headers['user-agent'] || null,
                latitude: body.latitude || null,
                longitude: body.longitude || null
            }
        });

        res.json({ success: true });
    } catch {
        res.status(500).json({ error: 'Erro ao registrar evento de risco' });
    }
});

// POST /api/antifraud/log - Registrar evento de risco (logado)
antifraudRouter.post('/log', authenticate, async (req: Request, res: Response) => {
    try {
        const { eventType, details, latitude, longitude } = req.body;

        await prisma.riskEvent.create({
            data: {
                userId: req.user!.id,
                eventType,
                details: typeof details === 'object' ? details : { value: details },
                latitude,
                longitude,
                ipAddress: req.ip,
                userAgent: req.headers['user-agent']
            }
        });

        res.json({ success: true });
    } catch {
        res.status(500).json({ error: 'Erro ao logar' });
    }
});

// GET /api/antifraud/blacklist/:cpf - Verificar CPF na blacklist
antifraudRouter.get('/blacklist/:cpf', async (req: Request, res: Response) => {
    try {
        const cpf = (req.params.cpf as string).replace(/\D/g, '');
        const blocked = await prisma.blacklist.findFirst({
            where: { cpf, active: true }
        });

        if (blocked) {
            res.json({ blocked: true, reason: blocked.reason });
        } else {
            res.json({ blocked: false });
        }
    } catch {
        res.status(500).json({ error: 'Erro' });
    }
});

// POST /api/antifraud/device/check - Verificar novo dispositivo (logado)
antifraudRouter.post('/device/check', authenticate, async (req: Request, res: Response) => {
    try {
        const { fingerprint } = req.body;

        const trusted = await prisma.trustedDevice.findFirst({
            where: {
                userId: req.user!.id,
                deviceFingerprint: fingerprint
            }
        });

        if (trusted) {
            await prisma.trustedDevice.update({
                where: { id: trusted.id },
                data: { lastSeenAt: new Date(), lastIp: req.ip }
            });
            res.json({ trusted: true });
            return;
        }

        const blocked = await prisma.securityBlock.findFirst({
            where: {
                userId: req.user!.id,
                deviceFingerprint: fingerprint,
                isResolved: false
            }
        });

        if (blocked) {
            res.status(403).json({ error: 'Dispositivo bloqueado', reason: blocked.blockReason });
            return;
        }

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
    } catch {
        res.status(500).json({ error: 'Erro' });
    }
});
