import { createHmac, timingSafeEqual } from 'crypto';
import { ALLOWED_COMMANDS, INVENTORY_QUERIES, isForbiddenPurpose, MdmAdapter, MdmRequestType, plistGet } from './appleMdmAdapter';

const decodeRaw = (b64: unknown) => (typeof b64 === 'string' ? Buffer.from(b64, 'base64').toString('utf8') : '');
const str = (v: unknown) => (typeof v === 'string' && v ? v.slice(0, 120) : undefined);

/**
 * Fila de comandos MDM idempotente e auditada.
 * Estados: requested → authorized → queued → dispatched → acknowledged | failed | expired | unknown.
 * Só o webhook do servidor MDM leva a "acknowledged". O adaptador mock para em "queued".
 */

export class MdmCommandError extends Error {
    constructor(message: string, public readonly code: 'NOT_FOUND' | 'NOT_ALLOWED' | 'FORBIDDEN_PURPOSE' | 'NOT_ORG_OWNED' | 'NEEDS_APPROVAL' | 'SAME_APPROVER' | 'NOT_ENROLLED' | 'INVALID') {
        super(message);
    }
}

export function capabilitiesFor(device: { ownership: string; supervised: boolean | null; enrollmentId: string | null }) {
    return (Object.keys(ALLOWED_COMMANDS) as MdmRequestType[]).map(requestType => {
        const meta = ALLOWED_COMMANDS[requestType];
        let reason: string | undefined;
        if (device.ownership !== 'ORG_OWNED') reason = 'Aparelho não é mais patrimônio da empresa';
        else if (!device.enrollmentId) reason = 'Aparelho não inscrito no MDM';
        else if (meta.supervisedOnly && device.supervised !== true) reason = 'Requer aparelho supervisionado confirmado pelo MDM';
        return { requestType, label: meta.label, sensitive: meta.sensitive, allowed: !reason, reason };
    });
}

/** Parâmetros aceitos por comando (o resto é descartado). Modo Perdido exige mensagem ou telefone. */
function sanitizeParams(requestType: MdmRequestType, params: any): Record<string, string> | undefined {
    if (requestType !== 'EnableLostMode') return undefined;
    const out: Record<string, string> = {};
    for (const k of ['Message', 'PhoneNumber', 'Footnote']) {
        const v = typeof params?.[k] === 'string' ? params[k].trim().slice(0, 200) : '';
        if (v) out[k] = v;
    }
    if (!out.Message && !out.PhoneNumber) throw new MdmCommandError('Modo Perdido exige mensagem ou telefone na tela', 'INVALID');
    return out;
}

export function createMdmCommandService(deps: { prisma: any; adapter: MdmAdapter; labMode: boolean; notify?: (title: string, message: string) => Promise<void> }) {
    const { prisma, adapter } = deps;
    const notify = deps.notify || (async () => {});

    const transition = async (cmd: any, toStatus: string, detail?: string, extra: Record<string, any> = {}) => {
        await prisma.mdmCommand.update({ where: { id: cmd.id }, data: { status: toStatus, ...extra } });
        await prisma.mdmCommandEvent.create({ data: { commandId: cmd.id, fromStatus: cmd.status, toStatus, detail: detail?.slice(0, 500) } });
        return { ...cmd, status: toStatus, ...extra };
    };

    async function dispatch(cmd: any, device: any) {
        const params = cmd.requestType === 'DeviceInformation' ? { Queries: INVENTORY_QUERIES } : cmd.params || undefined;
        const r = await adapter.enqueue(device.enrollmentId, cmd.requestType, params);
        if (!r.accepted) return transition(cmd, 'failed', r.detail, { errorMessage: r.detail });
        // Mock: nunca passa de "queued". Real: "dispatched" exige push enviado.
        const to = adapter.name === 'mock' ? 'queued' : r.pushOk ? 'dispatched' : 'queued';
        return transition(cmd, to, r.detail, { commandUuid: r.commandUuid, responseSummary: r.detail });
    }

    const service = {
        async request(input: { deviceId: string; requestType: string; purpose: string; idempotencyKey: string; adminId: string; params?: any }) {
            const existing = await prisma.mdmCommand.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
            if (existing) return existing; // reenvio do mesmo clique

            if (!(input.requestType in ALLOWED_COMMANDS)) throw new MdmCommandError('Comando não permitido', 'NOT_ALLOWED');
            const purpose = String(input.purpose || '').trim();
            if (purpose.length < 10) throw new MdmCommandError('Descreva o propósito corporativo (mínimo 10 caracteres)', 'INVALID');
            if (isForbiddenPurpose(purpose)) {
                throw new MdmCommandError('Comandos MDM não podem ser usados para cobrança ou inadimplência', 'FORBIDDEN_PURPOSE');
            }
            const device = await prisma.appleMdmDevice.findUnique({ where: { id: input.deviceId } });
            if (!device) throw new MdmCommandError('Aparelho não encontrado', 'NOT_FOUND');
            const cap = capabilitiesFor(device).find(c => c.requestType === input.requestType)!;
            if (!cap.allowed) throw new MdmCommandError(cap.reason!, device.ownership !== 'ORG_OWNED' ? 'NOT_ORG_OWNED' : 'NOT_ENROLLED');

            const requestType = input.requestType as MdmRequestType;
            const params = sanitizeParams(requestType, input.params);
            // Dupla aprovação: aparelhos do financiamento (unitId) ou modo laboratório.
            // Aparelho corporativo (funcionário) não tem 2º admin: confirmação fica na tela.
            const needsApproval = deps.labMode || (ALLOWED_COMMANDS[requestType].sensitive && device.unitId != null);
            const cmd = await prisma.mdmCommand.create({
                data: {
                    deviceId: device.id, commandUuid: `pending-${input.idempotencyKey}`, requestType, purpose, params,
                    requestedBy: input.adminId, idempotencyKey: input.idempotencyKey, adapter: adapter.name,
                    status: 'requested',
                },
            });
            await prisma.mdmCommandEvent.create({ data: { commandId: cmd.id, toStatus: 'requested', detail: `por ${input.adminId}` } });
            if (needsApproval) return cmd; // aguarda 2º admin
            const authorized = await transition(cmd, 'authorized', 'autorizado sem 2ª aprovação');
            return dispatch(authorized, device);
        },

        async approve(commandId: string, adminId: string) {
            const cmd = await prisma.mdmCommand.findUnique({ where: { id: commandId } });
            if (!cmd || cmd.status !== 'requested') throw new MdmCommandError('Comando não aguarda aprovação', 'NOT_FOUND');
            if (cmd.requestedBy === adminId) throw new MdmCommandError('A aprovação precisa ser de outro administrador', 'SAME_APPROVER');
            const device = await prisma.appleMdmDevice.findUnique({ where: { id: cmd.deviceId } });
            const cap = capabilitiesFor(device).find(c => c.requestType === cmd.requestType);
            if (!cap?.allowed) return transition(cmd, 'failed', cap?.reason || 'não permitido no momento da aprovação');
            const claimed = await prisma.mdmCommand.updateMany({ where: { id: cmd.id, status: 'requested' }, data: { status: 'authorized', approvedBy: adminId } });
            if (claimed.count !== 1) return prisma.mdmCommand.findUnique({ where: { id: commandId } });
            await prisma.mdmCommandEvent.create({ data: { commandId: cmd.id, fromStatus: 'requested', toStatus: 'authorized', detail: `aprovado por ${adminId}` } });
            return dispatch({ ...cmd, status: 'authorized', approvedBy: adminId }, device);
        },

        /**
         * Resultado vindo do webhook do NanoHUB (formato MicroMDM: topic
         * "mdm.Connect" com acknowledge_event {udid, command_uuid, status}).
         */
        async handleWebhook(event: any) {
            const ack = event?.acknowledge_event;
            if (event?.topic === 'mdm.Connect' && ack?.command_uuid) {
                const cmd = await prisma.mdmCommand.findUnique({ where: { commandUuid: String(ack.command_uuid) } });
                if (!cmd || ['acknowledged', 'failed'].includes(cmd.status)) return 'IGNORED';
                const st = String(ack.status || '');
                const to = st === 'Acknowledged' ? 'acknowledged' : st === 'Error' || st === 'CommandFormatError' ? 'failed' : st === 'NotNow' ? cmd.status : 'unknown';
                if (to === cmd.status) return 'NOT_NOW';
                await transition(cmd, to, `aparelho respondeu ${st}`, { responseStatus: st });
                if (to === 'acknowledged') await applyResult(cmd, decodeRaw(ack.raw_payload));
                return 'UPDATED';
            }
            const ci = event?.checkin_event;
            const udid = typeof ci?.udid === 'string' ? ci.udid : '';
            if ((event?.topic === 'mdm.Authenticate' || event?.topic === 'mdm.TokenUpdate') && udid) {
                const raw = decodeRaw(ci.raw_payload);
                const serial = str(plistGet(raw, 'SerialNumber'));
                const info = { deviceName: str(plistGet(raw, 'DeviceName')), model: str(plistGet(raw, 'ProductName')) || str(plistGet(raw, 'Model')), osVersion: str(plistGet(raw, 'OSVersion')) };
                const known = await prisma.appleMdmDevice.findUnique({ where: { enrollmentId: udid } })
                    || (serial ? await prisma.appleMdmDevice.findUnique({ where: { serialNumber: serial } }) : null);
                const seen = { lastSeenAt: new Date(), stateSource: 'NANOHUB', unenrolledAt: null };
                if (known) {
                    await prisma.appleMdmDevice.update({ where: { id: known.id }, data: { ...seen, enrollmentId: udid, ...Object.fromEntries(Object.entries(info).filter(([, v]) => v)) } });
                } else if (serial) {
                    // Aparelho corporativo novo: auto-registro (perfil só é instalado por quem tem o arquivo).
                    await prisma.appleMdmDevice.create({ data: { ...seen, ...info, enrollmentId: udid, serialNumber: serial, ownership: 'ORG_OWNED' } });
                    await notify('📱 Novo iPhone inscrito no MDM', `${info.deviceName || 'Aparelho'} (${info.model || 'iPhone'}) foi inscrito.`);
                }
                // TokenUpdate = inscrição concluída: pede inventário (traz supervisionado, IMEI, bateria).
                if (event.topic === 'mdm.TokenUpdate') {
                    const dev = await prisma.appleMdmDevice.findUnique({ where: { enrollmentId: udid } });
                    if (dev) await service.request({ deviceId: dev.id, requestType: 'DeviceInformation', purpose: 'Inventário automático após inscrição', idempotencyKey: `auto-inv-${udid}-${new Date().toISOString().slice(0, 13)}`, adminId: 'system' }).catch(() => {});
                }
                return 'CHECKIN';
            }
            if (event?.topic === 'mdm.CheckOut' && udid) {
                const dev = await prisma.appleMdmDevice.findUnique({ where: { enrollmentId: udid } });
                if (!dev) return 'IGNORED';
                await prisma.appleMdmDevice.update({ where: { id: dev.id }, data: { stateSource: 'NANOHUB', supervised: null, unenrolledAt: new Date() } });
                await notify('🚨 Perfil MDM removido', `${dev.deviceName || dev.serialNumber}${dev.assignedTo ? ` (${dev.assignedTo})` : ''} saiu do MDM. Verifique o aparelho e o Buscar iPhone.`);
                return 'CHECKOUT';
            }
            return 'IGNORED';
        },
    };

    /** Grava no aparelho o resultado de comandos que retornam dados. */
    async function applyResult(cmd: any, raw: string) {
        const now = new Date();
        if (cmd.requestType === 'DeviceInformation') {
            const q = (k: string) => plistGet(raw, k);
            const inventory = Object.fromEntries(INVENTORY_QUERIES.map(k => [k, q(k)]).filter(([, v]) => v !== undefined));
            const data: Record<string, any> = { lastInventoryAt: now, lastSeenAt: now, stateSource: 'NANOHUB', rawInventory: inventory };
            if (typeof inventory.IsSupervised === 'boolean') data.supervised = inventory.IsSupervised;
            if (typeof inventory.IsMDMLostModeEnabled === 'boolean') data.lostMode = inventory.IsMDMLostModeEnabled;
            if (str(inventory.OSVersion)) data.osVersion = inventory.OSVersion;
            if (str(inventory.DeviceName)) data.deviceName = inventory.DeviceName;
            if (str(inventory.ModelName)) data.model = inventory.ModelName;
            await prisma.appleMdmDevice.update({ where: { id: cmd.deviceId }, data });
        } else if (cmd.requestType === 'DeviceLocation') {
            const lat = plistGet(raw, 'Latitude'), lng = plistGet(raw, 'Longitude');
            if (typeof lat === 'number' && typeof lng === 'number') {
                const acc = plistGet(raw, 'HorizontalAccuracy');
                await prisma.appleMdmDevice.update({ where: { id: cmd.deviceId }, data: { lastLocation: { lat, lng, accuracy: typeof acc === 'number' ? acc : null, at: now.toISOString() }, lastSeenAt: now } });
            }
        } else if (cmd.requestType === 'EnableLostMode' || cmd.requestType === 'DisableLostMode') {
            await prisma.appleMdmDevice.update({ where: { id: cmd.deviceId }, data: { lostMode: cmd.requestType === 'EnableLostMode', lastSeenAt: now } });
        }
    }

    return service;
}

/** Valida o token do webhook (query ?token=) com comparação em tempo constante. */
export function isValidWebhookToken(received: unknown, expected: string | undefined) {
    if (!expected || typeof received !== 'string') return false;
    const a = Buffer.from(received);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
}

/** HMAC opcional (X-Hmac-Signature, base64 SHA-256), se o servidor MDM enviar. */
export function isValidHmac(rawBody: string, signature: unknown, key: string | undefined) {
    if (!key) return true;
    if (typeof signature !== 'string') return false;
    const expected = createHmac('sha256', key).update(rawBody).digest('base64');
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
}
