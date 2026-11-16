import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../services/prisma';
import { authenticate, requireAdmin } from '../middleware/auth';
import { getFlags } from '../services/phoneFinancing/flags';
import { maskIdentifier } from '../services/phoneFinancing/rules';
import { getMdmAdapter } from '../services/appleMdm/appleMdmAdapter';
import { capabilitiesFor, createMdmCommandService, isValidWebhookToken, MdmCommandError } from '../services/appleMdm/mdmCommandService';
import { enrollmentProfile, restrictionsProfile } from '../services/appleMdm/mdmProfiles';
import { notificationHub } from '../services/notificationHub';

/**
 * Apple MDM (NanoHUB) — rotas NOVAS, só admin. Sem relação com cobrança:
 * nenhuma rota recebe contrato/parcela, e o propósito do comando é auditado.
 */
const db: any = prisma;

function service() {
    const f = getFlags();
    return createMdmCommandService({
        prisma: db, adapter: getMdmAdapter(process.env, f.mdmRealCommands), labMode: f.mdmLabMode,
        notify: (title, message) => notificationHub.notifyAdmins({ title, message, type: 'WARNING', waToAdmin: process.env.MDM_ALERT_WHATSAPP || null }),
    });
}
const fail = (res: Response, status: number, error: string, code: string) => res.status(status).json({ error, code });
const requireMdm = (_req: Request, res: Response, next: NextFunction) => {
    if (!getFlags().mdm) { fail(res, 404, 'Recurso indisponível', 'FEATURE_DISABLED'); return; }
    next();
};
const wrap = (fn: (req: Request, res: Response) => Promise<any>) => async (req: Request, res: Response) => {
    try { await fn(req, res); } catch (err: any) {
        if (err instanceof MdmCommandError) {
            const http = { NOT_FOUND: 404, NOT_ALLOWED: 400, FORBIDDEN_PURPOSE: 403, NOT_ORG_OWNED: 403, NEEDS_APPROVAL: 409, SAME_APPROVER: 403, NOT_ENROLLED: 409, INVALID: 400 }[err.code];
            return fail(res, http, err.message, err.code);
        }
        if (err?.code === 'P2002') return fail(res, 409, 'Já cadastrado', 'DUPLICATE');
        console.error('[AppleMDM]', req.method, req.path, err?.message);
        fail(res, 500, 'Erro ao processar', 'INTERNAL');
    }
};
// Aparelho corporativo (sem unitId) mostra o serial completo: necessário para B.O. e Apple.
const deviceView = (d: any) => ({
    id: d.id, unitId: d.unitId, serialMasked: d.unitId ? maskIdentifier(d.serialNumber) : d.serialNumber, enrollmentId: d.enrollmentId, supervised: d.supervised,
    osVersion: d.osVersion, lastSeenAt: d.lastSeenAt, lastInventoryAt: d.lastInventoryAt, ownership: d.ownership, stateSource: d.stateSource, abmAssigned: d.abmAssigned,
    corporate: !d.unitId, deviceName: d.deviceName, model: d.model, assignedTo: d.assignedTo, lostMode: d.lostMode, lastLocation: d.lastLocation,
    unenrolledAt: d.unenrolledAt, inventory: d.rawInventory,
});

// Webhook do NanoHUB: sem JWT, protegido por token na URL (e rede local).
export const mdmWebhookRouter = Router();
mdmWebhookRouter.post('/', async (req: Request, res: Response) => {
    if (!getFlags().mdm || !isValidWebhookToken(req.query.token, process.env.MDM_WEBHOOK_TOKEN)) { res.status(404).end(); return; }
    try {
        const r = await service().handleWebhook(req.body);
        if (r !== 'IGNORED') console.log(`[AppleMDM] webhook ${req.body?.topic}: ${r}`);
    } catch (err: any) { console.error('[AppleMDM] webhook:', err?.message); }
    res.status(200).json({ received: true });
});

export const appleMdmRouter = Router();
appleMdmRouter.use(authenticate, requireAdmin, requireMdm);

appleMdmRouter.get('/status', wrap(async (_req, res) => {
    const f = getFlags();
    const adapter = getMdmAdapter(process.env, f.mdmRealCommands);
    const [server, pushCert] = await Promise.all([adapter.status(), adapter.pushCert(process.env.MDM_PUSH_TOPIC)]);
    res.json({ enabled: f.mdm, adapter: adapter.name, realCommandsEnabled: f.mdmRealCommands, labMode: f.mdmLabMode, server, pushCert });
}));
appleMdmRouter.get('/devices', wrap(async (_req, res) => {
    res.json({ devices: (await db.appleMdmDevice.findMany({ orderBy: { createdAt: 'desc' } })).map(deviceView) });
}));
appleMdmRouter.post('/devices', wrap(async (req, res) => {
    const unitId = typeof req.body?.unitId === 'string' ? req.body.unitId : '';
    const enrollmentId = typeof req.body?.enrollmentId === 'string' && /^[A-Za-z0-9-]{8,80}$/.test(req.body.enrollmentId) ? req.body.enrollmentId : null;
    const unit = await db.phoneInventoryUnit.findUnique({ where: { id: unitId }, include: { sales: { where: { legalTitleTransferDate: { not: null } } } } });
    if (!unit) return fail(res, 404, 'Aparelho não encontrado no estoque', 'NOT_FOUND');
    if (unit.sales.length) return fail(res, 403, 'Aparelho já transferido ao comprador; não pode ser gerenciado', 'NOT_ORG_OWNED');
    const device = await db.appleMdmDevice.create({ data: { unitId, serialNumber: unit.serialNumber, enrollmentId } });
    await db.phoneInventoryUnit.update({ where: { id: unitId }, data: { mdmStatus: enrollmentId ? 'enrollment_pending' : 'registered_local', mdmStatusSource: 'LOCAL', mdmStatusUpdatedAt: new Date() } });
    res.status(201).json({ device: deviceView(device) });
}));
appleMdmRouter.get('/devices/:id', wrap(async (req, res) => {
    const d = await db.appleMdmDevice.findUnique({ where: { id: String(req.params.id) } });
    if (!d) return fail(res, 404, 'Aparelho não encontrado', 'NOT_FOUND');
    res.json({ device: deviceView(d) });
}));
appleMdmRouter.patch('/devices/:id', wrap(async (req, res) => {
    const assignedTo = typeof req.body?.assignedTo === 'string' ? req.body.assignedTo.trim().slice(0, 120) || null : undefined;
    if (assignedTo === undefined) return fail(res, 400, 'assignedTo obrigatório', 'INVALID');
    const d = await db.appleMdmDevice.update({ where: { id: String(req.params.id) }, data: { assignedTo } }).catch(() => null);
    if (!d) return fail(res, 404, 'Aparelho não encontrado', 'NOT_FOUND');
    res.json({ device: deviceView(d) });
}));
// Download dos perfis. O de inscrição contém o SCEP_CHALLENGE: só admin autenticado.
appleMdmRouter.get('/profiles/:kind', wrap(async (req, res) => {
    let xml: string;
    if (req.params.kind === 'restrictions') xml = restrictionsProfile();
    else if (req.params.kind === 'enrollment') {
        const { MDM_PUBLIC_HOST: host, SCEP_CHALLENGE: challenge, MDM_PUSH_TOPIC: topic } = process.env;
        if (!host || !challenge || !topic) return fail(res, 409, 'MDM ainda sem certificado push (APNs) ou sem configuração no servidor', 'NOT_ENROLLED');
        xml = enrollmentProfile({ host, challenge, topic, locked: req.query.locked === '1' });
    } else return fail(res, 404, 'Perfil inexistente', 'NOT_FOUND');
    res.setHeader('Content-Type', 'application/x-apple-aspen-config');
    res.setHeader('Content-Disposition', `attachment; filename="tubarao-${req.params.kind}.mobileconfig"`);
    res.setHeader('Cache-Control', 'no-store');
    res.send(xml);
}));
appleMdmRouter.get('/devices/:id/capabilities', wrap(async (req, res) => {
    const d = await db.appleMdmDevice.findUnique({ where: { id: String(req.params.id) } });
    if (!d) return fail(res, 404, 'Aparelho não encontrado', 'NOT_FOUND');
    res.json({ commands: capabilitiesFor(d) });
}));
appleMdmRouter.post('/devices/:id/sync', wrap(async (req, res) => {
    const cmd = await service().request({ deviceId: String(req.params.id), requestType: 'DeviceInformation', purpose: 'Sincronização de inventário pelo admin', idempotencyKey: `sync-${req.params.id}-${Math.floor(Date.now() / 60000)}`, adminId: req.user!.id });
    res.json({ command: { id: cmd.id, status: cmd.status, commandUuid: cmd.commandUuid } });
}));
appleMdmRouter.post('/devices/:id/commands', wrap(async (req, res) => {
    const { requestType, purpose, idempotencyKey, params } = req.body || {};
    if (typeof idempotencyKey !== 'string' || idempotencyKey.length < 8 || idempotencyKey.length > 100) return fail(res, 400, 'idempotencyKey obrigatório', 'INVALID');
    const cmd = await service().request({ deviceId: String(req.params.id), requestType: String(requestType), purpose: String(purpose || ''), idempotencyKey, adminId: req.user!.id, params });
    res.status(201).json({ command: { id: cmd.id, status: cmd.status, commandUuid: cmd.commandUuid, requestType: cmd.requestType } });
}));
appleMdmRouter.get('/devices/:id/commands', wrap(async (req, res) => {
    const cmds = await db.mdmCommand.findMany({ where: { deviceId: String(req.params.id) }, include: { events: { orderBy: { createdAt: 'asc' } } }, orderBy: { createdAt: 'desc' }, take: 100 });
    res.json({ commands: cmds });
}));
appleMdmRouter.post('/commands/:id/approve', wrap(async (req, res) => {
    const cmd = await service().approve(String(req.params.id), req.user!.id);
    res.json({ command: { id: cmd.id, status: cmd.status, commandUuid: cmd.commandUuid } });
}));
appleMdmRouter.post('/devices/:id/release-review', wrap(async (req, res) => {
    const d = await db.appleMdmDevice.findUnique({ where: { id: String(req.params.id) } });
    if (!d) return fail(res, 404, 'Aparelho não encontrado', 'NOT_FOUND');
    if (!d.unitId) return fail(res, 400, 'Aparelho corporativo não passa por liberação de venda', 'INVALID');
    await db.phoneInventoryUnit.update({ where: { id: d.unitId }, data: { mdmStatus: 'release_pending', mdmStatusSource: 'LOCAL', mdmStatusUpdatedAt: new Date() } });
    res.json({ ok: true });
}));
