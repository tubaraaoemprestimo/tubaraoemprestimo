import { createHmac, timingSafeEqual } from 'crypto';
import { ALLOWED_COMMANDS, isForbiddenPurpose, MdmAdapter, MdmRequestType } from './appleMdmAdapter';

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
        else if (meta.sensitive && device.supervised !== true) reason = 'Requer aparelho supervisionado confirmado pelo MDM';
        return { requestType, label: meta.label, sensitive: meta.sensitive, allowed: !reason, reason };
    });
}

export function createMdmCommandService(deps: { prisma: any; adapter: MdmAdapter; labMode: boolean }) {
    const { prisma, adapter } = deps;

    const transition = async (cmd: any, toStatus: string, detail?: string, extra: Record<string, any> = {}) => {
        await prisma.mdmCommand.update({ where: { id: cmd.id }, data: { status: toStatus, ...extra } });
        await prisma.mdmCommandEvent.create({ data: { commandId: cmd.id, fromStatus: cmd.status, toStatus, detail: detail?.slice(0, 500) } });
        return { ...cmd, status: toStatus, ...extra };
    };

    async function dispatch(cmd: any, device: any) {
        const r = await adapter.enqueue(device.enrollmentId, cmd.requestType);
        if (!r.accepted) return transition(cmd, 'failed', r.detail, { errorMessage: r.detail });
        // Mock: nunca passa de "queued". Real: "dispatched" exige push enviado.
        const to = adapter.name === 'mock' ? 'queued' : r.pushOk ? 'dispatched' : 'queued';
        return transition(cmd, to, r.detail, { commandUuid: r.commandUuid, responseSummary: r.detail });
    }

    return {
        async request(input: { deviceId: string; requestType: string; purpose: string; idempotencyKey: string; adminId: string }) {
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
            const needsApproval = ALLOWED_COMMANDS[requestType].sensitive || deps.labMode;
            const cmd = await prisma.mdmCommand.create({
                data: {
                    deviceId: device.id, commandUuid: `pending-${input.idempotencyKey}`, requestType, purpose,
                    requestedBy: input.adminId, idempotencyKey: input.idempotencyKey, adapter: adapter.name,
                    status: 'requested',
                },
            });
            await prisma.mdmCommandEvent.create({ data: { commandId: cmd.id, toStatus: 'requested', detail: `por ${input.adminId}` } });
            if (needsApproval) return cmd; // aguarda 2º admin
            const authorized = await transition(cmd, 'authorized', 'comando não sensível');
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
                if (to === 'acknowledged' && cmd.requestType === 'DeviceInformation') {
                    await prisma.appleMdmDevice.update({ where: { id: cmd.deviceId }, data: { lastInventoryAt: new Date(), lastSeenAt: new Date(), stateSource: 'NANOHUB' } });
                }
                return 'UPDATED';
            }
            const ci = event?.checkin_event;
            if (event?.topic === 'mdm.Authenticate' || event?.topic === 'mdm.TokenUpdate') {
                const udid = ci?.udid;
                if (udid) {
                    await prisma.appleMdmDevice.updateMany({ where: { enrollmentId: udid }, data: { lastSeenAt: new Date(), stateSource: 'NANOHUB' } });
                }
                return 'CHECKIN';
            }
            if (event?.topic === 'mdm.CheckOut' && ci?.udid) {
                await prisma.appleMdmDevice.updateMany({ where: { enrollmentId: ci.udid }, data: { stateSource: 'NANOHUB', supervised: null } });
                return 'CHECKOUT';
            }
            return 'IGNORED';
        },
    };
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
