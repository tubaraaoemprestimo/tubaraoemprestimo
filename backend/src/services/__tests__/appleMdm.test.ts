import { describe, it, expect, beforeEach } from 'vitest';
import { buildCommandPlist, isForbiddenPurpose, MockMdmAdapter, NanoHubAdapter } from '../appleMdm/appleMdmAdapter';
import { capabilitiesFor, createMdmCommandService, isValidWebhookToken, MdmCommandError } from '../appleMdm/mdmCommandService';

function makeDb() {
    const t: Record<string, Map<string, any>> = { appleMdmDevice: new Map(), mdmCommand: new Map(), mdmCommandEvent: new Map() };
    let seq = 0;
    const match = (r: any, w: any = {}) => Object.entries(w).every(([k, v]: any) => r[k] === v);
    const model = (n: string) => ({
        create: async ({ data }: any) => { const r = { id: `${n}-${++seq}`, ...data }; t[n].set(r.id, r); return { ...r }; },
        update: async ({ where, data }: any) => { const r = t[n].get(where.id); Object.assign(r, data); return { ...r }; },
        updateMany: async ({ where, data }: any) => { let count = 0; for (const r of t[n].values()) if (match(r, where)) { Object.assign(r, data); count++; } return { count }; },
        findUnique: async ({ where }: any) => { const r = t[n].get(where.id) || [...t[n].values()].find(x => match(x, where)); return r ? { ...r } : null; },
    });
    return { prisma: { appleMdmDevice: model('appleMdmDevice'), mdmCommand: model('mdmCommand'), mdmCommandEvent: model('mdmCommandEvent') }, t };
}

const supervisedDevice = { id: 'd1', unitId: 'u1', enrollmentId: 'UDID-1', serialNumber: 'S1', supervised: true, ownership: 'ORG_OWNED' };

describe('política MDM', () => {
    it('propósitos ligados a cobrança são recusados', () => {
        expect(isForbiddenPurpose('Cliente inadimplente, bloquear')).toBe(true);
        expect(isForbiddenPurpose('parcela atrasada')).toBe(true);
        expect(isForbiddenPurpose('Aparelho de estoque furtado na loja, BO 1234')).toBe(false);
    });
    it('aparelho vendido/liberado não aceita nenhum comando', () => {
        expect(capabilitiesFor({ ownership: 'RELEASED', supervised: true, enrollmentId: 'x' }).every(c => !c.allowed)).toBe(true);
    });
    it('não inscrito ou não supervisionado não libera comandos sensíveis', () => {
        expect(capabilitiesFor({ ownership: 'ORG_OWNED', supervised: true, enrollmentId: null }).every(c => !c.allowed)).toBe(true);
        const caps = capabilitiesFor({ ownership: 'ORG_OWNED', supervised: false, enrollmentId: 'x' });
        expect(caps.find(c => c.requestType === 'EnableLostMode')!.allowed).toBe(false);
        expect(caps.find(c => c.requestType === 'DeviceInformation')!.allowed).toBe(true);
    });
    it('plist do comando segue o formato NanoMDM e escapa texto', () => {
        const p = buildCommandPlist('EnableLostMode', 'uuid-1', { Message: 'Devolva <loja> & ganhe' });
        expect(p).toContain('<string>EnableLostMode</string>');
        expect(p).toContain('<string>uuid-1</string>');
        expect(p).toContain('Devolva &lt;loja&gt; &amp; ganhe');
    });
    it('token do webhook: comparação estrita', () => {
        expect(isValidWebhookToken('abc', 'abc')).toBe(true);
        expect(isValidWebhookToken('abd', 'abc')).toBe(false);
        expect(isValidWebhookToken('abc', undefined)).toBe(false);
    });
});

describe('fila de comandos', () => {
    let ctx: ReturnType<typeof makeDb>;
    beforeEach(() => { ctx = makeDb(); ctx.t.appleMdmDevice.set('d1', { ...supervisedDevice }); });

    it('mock nunca marca como executado no aparelho', async () => {
        const svc = createMdmCommandService({ prisma: ctx.prisma, adapter: new MockMdmAdapter(), labMode: false });
        const cmd = await svc.request({ deviceId: 'd1', requestType: 'DeviceInformation', purpose: 'Inventário do estoque', idempotencyKey: 'k1', adminId: 'a1' });
        expect(cmd.status).toBe('queued');
        expect(cmd.adapter).toBe('mock');
    });
    it('mesmo idempotencyKey não cria segundo comando', async () => {
        const svc = createMdmCommandService({ prisma: ctx.prisma, adapter: new MockMdmAdapter(), labMode: false });
        const input = { deviceId: 'd1', requestType: 'DeviceInformation', purpose: 'Inventário do estoque', idempotencyKey: 'k1', adminId: 'a1' };
        const a = await svc.request(input);
        const b = await svc.request(input);
        expect(a.id).toBe(b.id);
        expect(ctx.t.mdmCommand.size).toBe(1);
    });
    it('comando sensível exige 2º admin; o mesmo admin não aprova', async () => {
        const svc = createMdmCommandService({ prisma: ctx.prisma, adapter: new MockMdmAdapter(), labMode: false });
        const cmd = await svc.request({ deviceId: 'd1', requestType: 'EnableLostMode', purpose: 'Aparelho de demonstração furtado da loja', idempotencyKey: 'k2', adminId: 'a1' });
        expect(cmd.status).toBe('requested');
        await expect(svc.approve(cmd.id, 'a1')).rejects.toBeInstanceOf(MdmCommandError);
        const done = await svc.approve(cmd.id, 'a2');
        expect(done.status).toBe('queued');
    });
    it('propósito de cobrança é recusado antes de qualquer envio', async () => {
        const svc = createMdmCommandService({ prisma: ctx.prisma, adapter: new MockMdmAdapter(), labMode: false });
        await expect(svc.request({ deviceId: 'd1', requestType: 'DeviceLock', purpose: 'cliente com parcela em atraso', idempotencyKey: 'k3', adminId: 'a1' }))
            .rejects.toMatchObject({ code: 'FORBIDDEN_PURPOSE' });
        expect(ctx.t.mdmCommand.size).toBe(0);
    });
    it('NanoHUB fora do ar: comando vira "failed", nunca "executado"', async () => {
        const http: any = { put: async () => { throw Object.assign(new Error('x'), { code: 'ECONNREFUSED' }); }, get: async () => { throw Object.assign(new Error('x'), { code: 'ECONNREFUSED' }); } };
        const adapter = new NanoHubAdapter('http://127.0.0.1:9004', 'k', http);
        const svc = createMdmCommandService({ prisma: ctx.prisma, adapter, labMode: false });
        const cmd = await svc.request({ deviceId: 'd1', requestType: 'DeviceInformation', purpose: 'Inventário do estoque', idempotencyKey: 'k4', adminId: 'a1' });
        expect(cmd.status).toBe('failed');
        expect((await adapter.status()).reachable).toBe(false);
    });
    it('NanoHUB aceito + push ok = dispatched; só o webhook leva a acknowledged', async () => {
        const http: any = { put: async (url: string) => ({ data: { status: { 'UDID-1': { push_result: 'p1' } }, command_uuid: 'cu-1' } }) };
        const svc = createMdmCommandService({ prisma: ctx.prisma, adapter: new NanoHubAdapter('http://x', 'k', http), labMode: false });
        const cmd = await svc.request({ deviceId: 'd1', requestType: 'DeviceInformation', purpose: 'Inventário do estoque', idempotencyKey: 'k5', adminId: 'a1' });
        expect(cmd.status).toBe('dispatched');
        expect(await svc.handleWebhook({ topic: 'mdm.Connect', acknowledge_event: { udid: 'UDID-1', command_uuid: 'cu-1', status: 'Acknowledged' } })).toBe('UPDATED');
        expect(ctx.t.mdmCommand.get(cmd.id).status).toBe('acknowledged');
    });
    it('push falhou: fica "queued", não "dispatched"', async () => {
        const http: any = { put: async () => ({ data: { status: { 'UDID-1': { push_error: 'apns down' } }, command_uuid: 'cu-2' } }) };
        const svc = createMdmCommandService({ prisma: ctx.prisma, adapter: new NanoHubAdapter('http://x', 'k', http), labMode: false });
        const cmd = await svc.request({ deviceId: 'd1', requestType: 'DeviceInformation', purpose: 'Inventário do estoque', idempotencyKey: 'k6', adminId: 'a1' });
        expect(cmd.status).toBe('queued');
    });
});
