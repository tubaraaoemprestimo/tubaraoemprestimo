import { Router, Request, Response } from 'express';
import { prisma } from '../services/prisma';
import { authenticate } from '../middleware/auth';

export const antifraudRouter = Router();

// =============================================
// RISK EVENTS
// =============================================

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

// GET /api/antifraud/risk-logs - Listar logs de risco (admin)
antifraudRouter.get('/risk-logs', authenticate, async (req: Request, res: Response) => {
    try {
        const { start, end, limit: limitParam } = req.query;
        const limit = Math.min(parseInt(String(limitParam || '200')), 500);

        const where: any = {};
        if (start) {
            where.createdAt = { ...(where.createdAt || {}), gte: new Date(String(start)) };
        }
        if (end) {
            where.createdAt = { ...(where.createdAt || {}), lte: new Date(String(end)) };
        }

        const events = await prisma.riskEvent.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: limit,
        });

        // Map to frontend expected format
        const mapped = events.map((e: any) => ({
            id: e.id,
            user_id: e.userId,
            session_id: e.details?.sessionId || null,
            ip: e.ipAddress,
            user_agent: e.userAgent,
            platform: e.details?.additionalData?.fingerprint?.platform || e.details?.additionalData?.platform || null,
            screen_resolution: e.details?.additionalData?.fingerprint?.screenResolution || null,
            timezone: e.details?.additionalData?.fingerprint?.timezone || null,
            latitude: e.latitude,
            longitude: e.longitude,
            action: e.eventType,
            risk_score: e.details?.riskScore || 0,
            risk_factors: e.details?.riskFactors || [],
            additional_data: e.details?.additionalData || e.details || null,
            created_at: e.createdAt,
        }));

        res.json(mapped);
    } catch (err: any) {
        console.error('[Antifraud] Error fetching risk logs:', err);
        res.status(500).json({ error: 'Erro ao buscar logs de risco' });
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

// =============================================
// BLACKLIST
// =============================================

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

// =============================================
// TRUSTED DEVICES
// =============================================

// GET /api/antifraud/device/list?user_id=... - Listar dispositivos confiáveis
antifraudRouter.get('/device/list', authenticate, async (req: Request, res: Response) => {
    try {
        const userId = String(req.query.user_id || req.user!.id);

        const devices = await prisma.trustedDevice.findMany({
            where: { userId },
            orderBy: { lastSeenAt: 'desc' },
        });

        // Map to frontend expected format
        const mapped = devices.map((d: any) => ({
            id: d.id,
            user_id: d.userId,
            device_fingerprint: d.deviceFingerprint,
            device_name: d.deviceName,
            device_model: d.deviceModel,
            platform: d.platform,
            browser: d.browser,
            screen_resolution: d.screenResolution,
            last_ip: d.lastIp,
            last_location_lat: d.lastLocationLat,
            last_location_lng: d.lastLocationLng,
            is_verified: d.isVerified,
            is_primary: d.isPrimary,
            trust_score: d.trustScore,
            login_count: d.loginCount,
            first_seen_at: d.firstSeenAt,
            last_seen_at: d.lastSeenAt,
        }));

        res.json(mapped);
    } catch (err: any) {
        console.error('[Antifraud] Error listing devices:', err);
        res.status(500).json({ error: 'Erro ao listar dispositivos' });
    }
});

// POST /api/antifraud/device/trust - Adicionar dispositivo confiável
antifraudRouter.post('/device/trust', authenticate, async (req: Request, res: Response) => {
    try {
        const body = req.body;

        const device = await prisma.trustedDevice.create({
            data: {
                userId: body.user_id || req.user!.id,
                deviceFingerprint: body.device_fingerprint,
                deviceName: body.device_name || 'Dispositivo',
                deviceModel: body.device_model || null,
                platform: body.platform || null,
                browser: body.browser || null,
                screenResolution: body.screen_resolution || null,
                lastIp: body.last_ip || req.ip || null,
                isVerified: body.is_verified || false,
                isPrimary: body.is_primary || false,
                trustScore: body.trust_score || 50,
                loginCount: body.login_count || 1,
            },
        });

        res.json({
            id: device.id,
            user_id: device.userId,
            device_fingerprint: device.deviceFingerprint,
            device_name: device.deviceName,
            device_model: device.deviceModel,
            is_verified: device.isVerified,
            is_primary: device.isPrimary,
            trust_score: device.trustScore,
        });
    } catch (err: any) {
        console.error('[Antifraud] Error adding trusted device:', err);
        res.status(500).json({ error: 'Erro ao adicionar dispositivo' });
    }
});

// PUT /api/antifraud/device/:id/activity - Atualizar atividade do dispositivo
antifraudRouter.put('/device/:id/activity', authenticate, async (req: Request, res: Response) => {
    try {
        const id = String(req.params.id);
        const { last_ip, last_seen_at } = req.body;

        await prisma.trustedDevice.update({
            where: { id },
            data: {
                lastIp: last_ip || req.ip,
                lastSeenAt: last_seen_at ? new Date(last_seen_at) : new Date(),
                loginCount: { increment: 1 },
            },
        });

        res.json({ success: true });
    } catch (err: any) {
        console.error('[Antifraud] Error updating device activity:', err);
        res.status(500).json({ error: 'Erro ao atualizar dispositivo' });
    }
});

// DELETE /api/antifraud/device/reset?user_id=... - Reset all devices for user
// NOTE: Must be BEFORE /device/:id to prevent Express matching 'reset' as :id
antifraudRouter.delete('/device/reset', authenticate, async (req: Request, res: Response) => {
    try {
        const userId = String(req.query.user_id || req.user!.id);
        await prisma.trustedDevice.deleteMany({ where: { userId } });
        res.json({ success: true });
    } catch (err: any) {
        console.error('[Antifraud] Error resetting devices:', err);
        res.status(500).json({ error: 'Erro ao resetar dispositivos' });
    }
});

// DELETE /api/antifraud/device/:id - Remover dispositivo
antifraudRouter.delete('/device/:id', authenticate, async (req: Request, res: Response) => {
    try {
        const id = String(req.params.id);
        await prisma.trustedDevice.delete({ where: { id } });
        res.json({ success: true });
    } catch (err: any) {
        console.error('[Antifraud] Error removing device:', err);
        res.status(500).json({ error: 'Erro ao remover dispositivo' });
    }
});

// PUT /api/antifraud/device/:id/verify - Verificar dispositivo
antifraudRouter.put('/device/:id/verify', authenticate, async (req: Request, res: Response) => {
    try {
        const id = String(req.params.id);
        await prisma.trustedDevice.update({
            where: { id },
            data: {
                isVerified: true,
                trustScore: 100,
            },
        });
        res.json({ success: true });
    } catch (err: any) {
        console.error('[Antifraud] Error verifying device:', err);
        res.status(500).json({ error: 'Erro ao verificar dispositivo' });
    }
});

// PUT /api/antifraud/device/:id/set-primary - Definir dispositivo como primário
antifraudRouter.put('/device/:id/set-primary', authenticate, async (req: Request, res: Response) => {
    try {
        const id = String(req.params.id);
        const { user_id } = req.body;
        const targetUserId = user_id || req.user!.id;

        // Remove primary flag from all other devices of this user
        await prisma.trustedDevice.updateMany({
            where: { userId: targetUserId },
            data: { isPrimary: false },
        });

        // Set this device as primary
        await prisma.trustedDevice.update({
            where: { id },
            data: { isPrimary: true },
        });

        res.json({ success: true });
    } catch (err: any) {
        console.error('[Antifraud] Error setting primary device:', err);
        res.status(500).json({ error: 'Erro' });
    }
});


// POST /api/antifraud/device/check - Verificar novo dispositivo (logado)
antifraudRouter.post('/device/check', authenticate, async (req: Request, res: Response) => {
    try {
        const { fingerprint, latitude, longitude } = req.body;

        const trusted = await prisma.trustedDevice.findFirst({
            where: {
                userId: req.user!.id,
                deviceFingerprint: fingerprint
            }
        });

        if (trusted) {
            await prisma.trustedDevice.update({
                where: { id: trusted.id },
                data: {
                    lastSeenAt: new Date(),
                    lastIp: req.ip,
                    lastLocationLat: latitude || trusted.lastLocationLat,
                    lastLocationLng: longitude || trusted.lastLocationLng
                }
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

        // Check Max Devices Limit
        const deviceCount = await prisma.trustedDevice.count({
            where: { userId: req.user!.id }
        });

        const maxDevicesSetting = await prisma.systemSetting.findUnique({
            where: { key: 'max_devices_per_user' }
        });
        // Política de segurança obrigatória: máximo 2 dispositivos
        const configuredMax = maxDevicesSetting ? parseInt(maxDevicesSetting.value) : 2;
        const maxDevices = Number.isFinite(configuredMax) && configuredMax > 0 ? Math.min(configuredMax, 2) : 2;

        if (deviceCount >= maxDevices) {
            res.status(403).json({
                error: 'Limite de dispositivos excedido',
                message: `Você atingiu o limite de ${maxDevices} dispositivos. Remova um dispositivo antigo para acessar neste novo.`
            });
            return;
        }

        // Limite de IPs por usuário (máx 2 IPs distintos entre dispositivos confiáveis)
        const devices = await prisma.trustedDevice.findMany({
            where: { userId: req.user!.id },
            select: { lastIp: true }
        });
        const knownIps = new Set((devices || []).map((d: any) => d.lastIp).filter(Boolean));
        const currentIp = req.ip || null;
        if (currentIp && !knownIps.has(currentIp) && knownIps.size >= 2) {
            res.status(403).json({
                error: 'Limite de IPs excedido',
                message: 'Detectamos acesso por um 3º IP diferente. Por segurança, o acesso foi bloqueado.'
            });
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

// =============================================
// SECURITY BLOCKS
// =============================================

// POST /api/antifraud/security-block - Criar bloqueio de segurança
antifraudRouter.post('/security-block', authenticate, async (req: Request, res: Response) => {
    try {
        const body = req.body;

        await prisma.securityBlock.create({
            data: {
                userId: body.user_id,
                blockType: body.block_type,
                blockReason: body.block_reason,
                deviceFingerprint: body.device_fingerprint || null,
                ipAddress: body.ip_address || req.ip || null,
                deviceInfo: body.device_info || null,
                isResolved: false,
                expiresAt: body.expires_at ? new Date(body.expires_at) : null,
            },
        });

        res.json({ success: true });
    } catch (err: any) {
        console.error('[Antifraud] Error creating security block:', err);
        res.status(500).json({ error: 'Erro ao criar bloqueio' });
    }
});

// GET /api/antifraud/security-block/check?user_id=... - Verificar se usuário está bloqueado
antifraudRouter.get('/security-block/check', authenticate, async (req: Request, res: Response) => {
    try {
        const userId = String(req.query.user_id || req.user!.id);

        const block = await prisma.securityBlock.findFirst({
            where: { userId, isResolved: false },
            orderBy: { createdAt: 'desc' },
        });

        if (block) {
            res.json({
                id: block.id,
                user_id: block.userId,
                block_type: block.blockType,
                block_reason: block.blockReason,
                device_fingerprint: block.deviceFingerprint,
                ip_address: block.ipAddress,
                device_info: block.deviceInfo,
                is_resolved: block.isResolved,
                expires_at: block.expiresAt,
                created_at: block.createdAt,
            });
        } else {
            res.json(null);
        }
    } catch (err: any) {
        console.error('[Antifraud] Error checking block:', err);
        res.status(500).json({ error: 'Erro' });
    }
});

// PUT /api/antifraud/security-block/:id/resolve - Resolver bloqueio
antifraudRouter.put('/security-block/:id/resolve', authenticate, async (req: Request, res: Response) => {
    try {
        const id = String(req.params.id);
        const { resolved_by, resolution_notes } = req.body;

        const block = await prisma.securityBlock.update({
            where: { id },
            data: {
                isResolved: true,
                resolvedAt: new Date(),
                resolvedBy: resolved_by || req.user!.name,
                resolutionNotes: resolution_notes || null,
            },
        });

        // If block has device fingerprint, add it as trusted
        if (block.deviceFingerprint) {
            const existingDevice = await prisma.trustedDevice.findFirst({
                where: { userId: block.userId, deviceFingerprint: block.deviceFingerprint }
            });

            if (!existingDevice) {
                await prisma.trustedDevice.create({
                    data: {
                        userId: block.userId,
                        deviceFingerprint: block.deviceFingerprint,
                        deviceName: 'Dispositivo liberado pelo admin',
                        deviceModel: (block.deviceInfo as any)?.model || null,
                        platform: (block.deviceInfo as any)?.platform || null,
                        browser: (block.deviceInfo as any)?.browser || null,
                        screenResolution: (block.deviceInfo as any)?.screen || null,
                        lastIp: block.ipAddress,
                        isVerified: true,
                        isPrimary: false,
                        trustScore: 100,
                        loginCount: 0,
                    },
                });
            }
        }

        res.json({ success: true, block_id: block.id });
    } catch (err: any) {
        console.error('[Antifraud] Error resolving block:', err);
        res.status(500).json({ error: 'Erro ao resolver bloqueio' });
    }
});

// PUT /api/antifraud/security-block/unblock-user - Desbloquear todos os bloqueios do usuário
antifraudRouter.put('/security-block/unblock-user', authenticate, async (req: Request, res: Response) => {
    try {
        const { user_id, resolved_by, resolution_notes } = req.body;

        await prisma.securityBlock.updateMany({
            where: { userId: user_id, isResolved: false },
            data: {
                isResolved: true,
                resolvedAt: new Date(),
                resolvedBy: resolved_by || req.user!.name,
                resolutionNotes: resolution_notes || 'Desbloqueado manualmente pelo admin',
            },
        });

        res.json({ success: true });
    } catch (err: any) {
        console.error('[Antifraud] Error unblocking user:', err);
        res.status(500).json({ error: 'Erro ao desbloquear' });
    }
});

// GET /api/antifraud/security-blocks?resolved=false - Listar bloqueios
antifraudRouter.get('/security-blocks', authenticate, async (req: Request, res: Response) => {
    try {
        const resolved = req.query.resolved === 'true';

        const blocks = await prisma.securityBlock.findMany({
            where: { isResolved: resolved },
            orderBy: { createdAt: 'desc' },
            take: 100,
        });

        const mapped = blocks.map((b: any) => ({
            id: b.id,
            user_id: b.userId,
            block_type: b.blockType,
            block_reason: b.blockReason,
            device_fingerprint: b.deviceFingerprint,
            ip_address: b.ipAddress,
            device_info: b.deviceInfo,
            is_resolved: b.isResolved,
            created_at: b.createdAt,
        }));

        res.json(mapped);
    } catch (err: any) {
        console.error('[Antifraud] Error listing blocks:', err);
        res.status(500).json({ error: 'Erro ao listar bloqueios' });
    }
});

// =============================================
// SECURITY ALERTS
// =============================================

// POST /api/antifraud/security-alerts - Criar alerta
antifraudRouter.post('/security-alerts', authenticate, async (req: Request, res: Response) => {
    try {
        const body = req.body;

        await prisma.securityAlert.create({
            data: {
                userId: body.user_id,
                userName: body.user_name,
                userEmail: body.user_email,
                alertType: body.alert_type,
                severity: body.severity,
                title: body.title,
                description: body.description,
                deviceInfo: body.device_info || null,
                ipAddress: body.ip_address || null,
                location: body.location || null,
                isRead: false,
            },
        });

        res.json({ success: true });
    } catch (err: any) {
        console.error('[Antifraud] Error creating alert:', err);
        res.status(500).json({ error: 'Erro ao criar alerta' });
    }
});

// GET /api/antifraud/security-alerts - Listar alertas
antifraudRouter.get('/security-alerts', authenticate, async (req: Request, res: Response) => {
    try {
        const { is_read, limit: limitParam } = req.query;
        const limit = Math.min(parseInt(String(limitParam || '50')), 200);

        const where: any = {};
        if (is_read === 'false') where.isRead = false;
        if (is_read === 'true') where.isRead = true;

        const alerts = await prisma.securityAlert.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: limit,
        });

        const mapped = alerts.map((a: any) => ({
            id: a.id,
            user_id: a.userId,
            user_name: a.userName,
            user_email: a.userEmail,
            alert_type: a.alertType,
            severity: a.severity,
            title: a.title,
            description: a.description,
            device_info: a.deviceInfo,
            ip_address: a.ipAddress,
            location: a.location,
            is_read: a.isRead,
            created_at: a.createdAt,
        }));

        res.json(mapped);
    } catch (err: any) {
        console.error('[Antifraud] Error listing alerts:', err);
        res.status(500).json({ error: 'Erro ao listar alertas' });
    }
});

// PUT /api/antifraud/security-alerts/:id/read - Marcar alerta como lido
antifraudRouter.put('/security-alerts/:id/read', authenticate, async (req: Request, res: Response) => {
    try {
        const id = String(req.params.id);
        await prisma.securityAlert.update({
            where: { id },
            data: { isRead: true },
        });
        res.json({ success: true });
    } catch (err: any) {
        console.error('[Antifraud] Error marking alert as read:', err);
        res.status(500).json({ error: 'Erro' });
    }
});

// GET /api/antifraud/security-alerts/count - Contar alertas não lidos
antifraudRouter.get('/security-alerts/count', authenticate, async (req: Request, res: Response) => {
    try {
        const isRead = req.query.is_read === 'false' ? false : req.query.is_read === 'true' ? true : false;
        const count = await prisma.securityAlert.count({ where: { isRead } });
        res.json({ count });
    } catch {
        res.json({ count: 0 });
    }
});

// =============================================
// SECURITY SETTINGS
// =============================================

// GET /api/antifraud/security-settings - Obter configurações de segurança
antifraudRouter.get('/security-settings', authenticate, async (req: Request, res: Response) => {
    try {
        const settings = await prisma.systemSetting.findMany({
            where: {
                key: {
                    in: [
                        'block_new_devices',
                        'require_verification_new_device',
                        'max_devices_per_user',
                        'block_different_model',
                        'notify_admin_new_device',
                        'auto_block_high_risk'
                    ]
                }
            }
        });

        const mapped = settings.map((s: any) => ({
            setting_key: s.key,
            setting_value: s.value,
        }));

        res.json(mapped);
    } catch {
        // Return empty array, frontend will use defaults
        res.json([]);
    }
});

// PUT /api/antifraud/security-settings - Atualizar configuração de segurança
antifraudRouter.put('/security-settings', authenticate, async (req: Request, res: Response) => {
    try {
        const { setting_key, setting_value } = req.body;

        await prisma.systemSetting.upsert({
            where: { key: setting_key },
            update: { value: setting_value },
            create: { key: setting_key, value: setting_value },
        });

        res.json({ success: true });
    } catch (err: any) {
        console.error('[Antifraud] Error updating setting:', err);
        res.status(500).json({ error: 'Erro ao atualizar configuração' });
    }
});

// =============================================
// REJECTION COOLDOWN
// =============================================

// GET /api/antifraud/rejection-cooldown?cpf=... - Verificar cooldown de CPF
antifraudRouter.get('/rejection-cooldown', async (req: Request, res: Response) => {
    try {
        const cpf = String(req.query.cpf || '').replace(/\D/g, '');
        if (!cpf || cpf.length < 11) {
            res.json({ blocked: false, daysRemaining: 0 });
            return;
        }

        // Find the most recent rejected loan request for this CPF
        const recentRejection = await prisma.loanRequest.findFirst({
            where: {
                cpf,
                status: 'REJECTED',
            },
            orderBy: { createdAt: 'desc' },
        });

        if (!recentRejection) {
            res.json({ blocked: false, daysRemaining: 0 });
            return;
        }

        const rejectionDate = new Date(recentRejection.createdAt);
        const cooldownDays = 30;
        const canRetryAt = new Date(rejectionDate.getTime() + cooldownDays * 24 * 60 * 60 * 1000);
        const now = new Date();

        if (now < canRetryAt) {
            const daysRemaining = Math.ceil((canRetryAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
            res.json({
                blocked: true,
                daysRemaining,
                rejectionDate: rejectionDate.toISOString(),
                canRetryAt: canRetryAt.toISOString(),
                message: `Seu CPF está em período de espera após uma solicitação reprovada. Aguarde ${daysRemaining} dia(s) para tentar novamente.`,
            });
        } else {
            res.json({ blocked: false, daysRemaining: 0 });
        }
    } catch (err: any) {
        console.error('[Antifraud] Error checking cooldown:', err);
        res.json({ blocked: false, daysRemaining: 0 });
    }
});

// =============================================
// TEMPORARY LINKS
// =============================================

// POST /api/antifraud/temporary-link - Criar link temporário
antifraudRouter.post('/temporary-link', authenticate, async (req: Request, res: Response) => {
    try {
        const { token, type, reference_id, expires_at, used } = req.body;

        await prisma.temporaryLink.create({
            data: {
                token,
                type,
                userId: req.user?.id || null,
                metadata: { referenceId: reference_id },
                used: used || false,
                expiresAt: new Date(expires_at),
            },
        });

        res.json({ success: true });
    } catch (err: any) {
        console.error('[Antifraud] Error creating temporary link:', err);
        res.status(500).json({ error: 'Erro ao criar link' });
    }
});

// GET /api/antifraud/temporary-link/validate?token=... - Validar link temporário
antifraudRouter.get('/temporary-link/validate', async (req: Request, res: Response) => {
    try {
        const token = String(req.query.token || '');

        const link = await prisma.temporaryLink.findFirst({
            where: { token, used: false },
        });

        if (!link) {
            res.json(null);
            return;
        }

        res.json({
            token: link.token,
            type: link.type,
            reference_id: (link.metadata as any)?.referenceId || null,
            expires_at: link.expiresAt,
        });
    } catch {
        res.json(null);
    }
});

// PUT /api/antifraud/temporary-link/use - Marcar link como usado
antifraudRouter.put('/temporary-link/use', async (req: Request, res: Response) => {
    try {
        const { token } = req.body;
        await prisma.temporaryLink.updateMany({
            where: { token },
            data: { used: true },
        });
        res.json({ success: true });
    } catch {
        res.status(500).json({ error: 'Erro' });
    }
});

// =============================================
// CONTRACT SIGNATURES
// =============================================

// POST /api/antifraud/contract-signature - Registrar assinatura de contrato
antifraudRouter.post('/contract-signature', authenticate, async (req: Request, res: Response) => {
    try {
        const body = req.body;

        await prisma.contractSignature.create({
            data: {
                loanRequestId: body.contract_id,
                signatureUrl: body.signature_image || '',
                ipAddress: body.ip_address || req.ip || null,
                userAgent: body.user_agent || req.headers['user-agent'] || null,
            },
        });

        // Also log as risk event for audit trail
        await prisma.riskEvent.create({
            data: {
                userId: body.user_id || req.user?.id || null,
                eventType: 'CONTRACT_SIGNED',
                details: {
                    contractId: body.contract_id,
                    sessionId: body.session_id,
                    acceptedTerms: body.accepted_terms,
                    latitude: body.latitude,
                    longitude: body.longitude,
                },
                ipAddress: body.ip_address || req.ip,
                userAgent: body.user_agent || req.headers['user-agent'],
                latitude: body.latitude || null,
                longitude: body.longitude || null,
            },
        });

        res.json({ success: true });
    } catch (err: any) {
        console.error('[Antifraud] Error registering contract signature:', err);
        res.status(500).json({ error: 'Erro ao registrar assinatura' });
    }
});

// =============================================
// BIOMETRIC (WebAuthn) ROUTES
// =============================================

// GET /api/antifraud/biometric/check?user_id=xxx — Check if user has biometric credentials
antifraudRouter.get('/biometric/check', async (req: Request, res: Response) => {
    try {
        const userId = String(req.query.user_id || '').trim();
        if (!userId) {
            res.json([]);
            return;
        }
        const credentials = await prisma.webAuthnCredential.findMany({
            where: { userId },
            select: { id: true, credentialId: true, deviceName: true, createdAt: true }
        });
        res.json(credentials);
    } catch (err: any) {
        console.error('[Biometric] check error:', err);
        res.json([]);
    }
});

// GET /api/antifraud/biometric/credentials?user_id=xxx — List credential IDs for a user
antifraudRouter.get('/biometric/credentials', async (req: Request, res: Response) => {
    try {
        const userId = String(req.query.user_id || '').trim();
        if (!userId) {
            res.json([]);
            return;
        }
        const credentials = await prisma.webAuthnCredential.findMany({
            where: { userId },
            select: { id: true, credentialId: true, deviceName: true, signCount: true, createdAt: true }
        });
        // Return with snake_case field names as the frontend biometricService expects
        res.json(credentials.map((c: any) => ({
            id: c.id,
            credential_id: c.credentialId,
            device_name: c.deviceName,
            sign_count: c.signCount,
            created_at: c.createdAt
        })));
    } catch (err: any) {
        console.error('[Biometric] credentials error:', err);
        res.json([]);
    }
});

// POST /api/antifraud/biometric — Save a new biometric credential
antifraudRouter.post('/biometric', async (req: Request, res: Response) => {
    try {
        const { user_id, user_email, credential_id, public_key, attestation_object, device_name, sign_count } = req.body;

        if (!user_id || !credential_id) {
            res.status(400).json({ error: 'user_id e credential_id são obrigatórios' });
            return;
        }

        const credential = await prisma.webAuthnCredential.create({
            data: {
                userId: user_id,
                userEmail: user_email || '',
                credentialId: credential_id,
                publicKey: public_key || '',
                attestationObject: attestation_object || '',
                deviceName: device_name || 'Desconhecido',
                signCount: sign_count || 0,
            }
        });

        res.json({ success: true, id: credential.id });
    } catch (err: any) {
        console.error('[Biometric] save error:', err);
        res.status(500).json({ error: 'Erro ao salvar credencial biométrica' });
    }
});

// GET /api/antifraud/biometric/verify?credential_id=xxx — Verify/lookup a credential
antifraudRouter.get('/biometric/verify', async (req: Request, res: Response) => {
    try {
        const credentialId = String(req.query.credential_id || '').trim();
        if (!credentialId) {
            res.status(400).json({ error: 'credential_id é obrigatório' });
            return;
        }

        const credential = await prisma.webAuthnCredential.findFirst({
            where: { credentialId }
        });

        if (!credential) {
            res.status(404).json({ error: 'Credencial não encontrada' });
            return;
        }

        res.json({
            id: credential.id,
            user_id: credential.userId,
            user_email: credential.userEmail,
            credential_id: credential.credentialId,
            public_key: credential.publicKey,
            sign_count: credential.signCount,
            device_name: credential.deviceName,
            created_at: credential.createdAt
        });
    } catch (err: any) {
        console.error('[Biometric] verify error:', err);
        res.status(500).json({ error: 'Erro ao verificar credencial' });
    }
});

// PUT /api/antifraud/biometric/update-count — Update sign count after authentication
antifraudRouter.put('/biometric/update-count', async (req: Request, res: Response) => {
    try {
        const { credential_id, sign_count, last_used_at } = req.body;
        if (!credential_id) {
            res.status(400).json({ error: 'credential_id é obrigatório' });
            return;
        }

        const credential = await prisma.webAuthnCredential.findFirst({
            where: { credentialId: credential_id }
        });

        if (!credential) {
            res.status(404).json({ error: 'Credencial não encontrada' });
            return;
        }

        await prisma.webAuthnCredential.update({
            where: { id: credential.id },
            data: {
                signCount: sign_count || (credential.signCount || 0) + 1,
                lastUsedAt: last_used_at ? new Date(last_used_at) : new Date()
            }
        });

        res.json({ success: true });
    } catch (err: any) {
        console.error('[Biometric] update-count error:', err);
        res.status(500).json({ error: 'Erro ao atualizar contagem' });
    }
});

// DELETE /api/antifraud/biometric?user_id=xxx — Remove all biometric credentials for a user
antifraudRouter.delete('/biometric', async (req: Request, res: Response) => {
    try {
        const userId = String(req.query.user_id || '').trim();
        if (!userId) {
            res.status(400).json({ error: 'user_id é obrigatório' });
            return;
        }

        await prisma.webAuthnCredential.deleteMany({ where: { userId } });
        res.json({ success: true });
    } catch (err: any) {
        console.error('[Biometric] delete error:', err);
        res.status(500).json({ error: 'Erro ao remover credenciais' });
    }
});

