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
        const cmd = await svc.request({ deviceId: 'd1', requestType: 'EnableLostMode', purpose: 'Aparelho de demonstração furtado da loja', idempotencyKey: 'k2', adminId: 'a1', params: { Message: 'Devolva à loja' } });
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
    it('aparelho corporativo: Modo Perdido sai sem 2º admin, exige mensagem e leva os parâmetros', async () => {
        ctx.t.appleMdmDevice.set('c1', { id: 'c1', unitId: null, enrollmentId: 'UDID-C', serialNumber: 'SC', supervised: true, ownership: 'ORG_OWNED' });
        let sent: any;
        const http: any = { put: async (_u: string, body: string) => { sent = body; return { data: { status: { 'UDID-C': { push_result: 'p' } }, command_uuid: 'cu-c' } }; } };
        const svc = createMdmCommandService({ prisma: ctx.prisma, adapter: new NanoHubAdapter('http://x', 'k', http), labMode: false });
        const base = { deviceId: 'c1', requestType: 'EnableLostMode', purpose: 'iPhone do vendedor roubado na rua', adminId: 'a1' };
        await expect(svc.request({ ...base, idempotencyKey: 'kc0' })).rejects.toMatchObject({ code: 'INVALID' });
        const cmd = await svc.request({ ...base, idempotencyKey: 'kc1', params: { Message: 'Aparelho roubado', PhoneNumber: '11999990000', Evil: 'x' } });
        expect(cmd.status).toBe('dispatched');
        expect(sent).toContain('<string>Aparelho roubado</string>');
        expect(sent).not.toContain('Evil');
        await svc.handleWebhook({ topic: 'mdm.Connect', acknowledge_event: { command_uuid: 'cu-c', status: 'Acknowledged', raw_payload: '' } });
        expect(ctx.t.appleMdmDevice.get('c1').lostMode).toBe(true);
    });
    it('push falhou: fica "queued", não "dispatched"', async () => {
        const http: any = { put: async () => ({ data: { status: { 'UDID-1': { push_error: 'apns down' } }, command_uuid: 'cu-2' } }) };
        const svc = createMdmCommandService({ prisma: ctx.prisma, adapter: new NanoHubAdapter('http://x', 'k', http), labMode: false });
        const cmd = await svc.request({ deviceId: 'd1', requestType: 'DeviceInformation', purpose: 'Inventário do estoque', idempotencyKey: 'k6', adminId: 'a1' });
        expect(cmd.status).toBe('queued');
    });
});

const b64 = (s: string) => Buffer.from(s).toString('base64');
const plist = (body: string) => `<?xml version="1.0"?><plist version="1.0"><dict>${body}</dict></plist>`;

describe('webhook: aparelhos corporativos', () => {
    let ctx: ReturnType<typeof makeDb>;
    const alerts: string[] = [];
    const svc = () => createMdmCommandService({ prisma: ctx.prisma, adapter: new MockMdmAdapter(), labMode: false, notify: async t => { alerts.push(t); } });
    beforeEach(() => { ctx = makeDb(); alerts.length = 0; });

    it('Authenticate de aparelho desconhecido cria o registro; TokenUpdate pede inventário', async () => {
        const raw = b64(plist('<key>DeviceName</key><string>iPhone do João</string><key>ProductName</key><string>iPhone15,2</string><key>OSVersion</key><string>18.1</string><key>SerialNumber</key><string>F2LXYZ</string>'));
        expect(await svc().handleWebhook({ topic: 'mdm.Authenticate', checkin_event: { udid: 'U-NEW', raw_payload: raw } })).toBe('CHECKIN');
        const dev = [...ctx.t.appleMdmDevice.values()][0];
        expect(dev).toMatchObject({ enrollmentId: 'U-NEW', serialNumber: 'F2LXYZ', deviceName: 'iPhone do João', model: 'iPhone15,2', ownership: 'ORG_OWNED' });
        expect(alerts).toHaveLength(1);
        await svc().handleWebhook({ topic: 'mdm.TokenUpdate', checkin_event: { udid: 'U-NEW', raw_payload: b64(plist('')) } });
        expect([...ctx.t.mdmCommand.values()].map(c => c.requestType)).toEqual(['DeviceInformation']);
        expect(ctx.t.appleMdmDevice.size).toBe(1);
    });
    it('inventário grava supervisionado e Modo Perdido; localização grava coordenadas', async () => {
        ctx.t.appleMdmDevice.set('c1', { id: 'c1', unitId: null, enrollmentId: 'U1', serialNumber: 'S', ownership: 'ORG_OWNED', supervised: true });
        ctx.t.mdmCommand.set('m1', { id: 'm1', deviceId: 'c1', commandUuid: 'cu1', requestType: 'DeviceInformation', status: 'dispatched' });
        ctx.t.mdmCommand.set('m2', { id: 'm2', deviceId: 'c1', commandUuid: 'cu2', requestType: 'DeviceLocation', status: 'dispatched' });
        const inv = plist('<key>QueryResponses</key><dict><key>IsSupervised</key><false/><key>IsMDMLostModeEnabled</key><true/><key>BatteryLevel</key><real>0.5</real><key>OSVersion</key><string>18.2</string></dict>');
        await svc().handleWebhook({ topic: 'mdm.Connect', acknowledge_event: { command_uuid: 'cu1', status: 'Acknowledged', raw_payload: b64(inv) } });
        expect(ctx.t.appleMdmDevice.get('c1')).toMatchObject({ supervised: false, lostMode: true, osVersion: '18.2' });
        const loc = plist('<key>Latitude</key><real>-23.55</real><key>Longitude</key><real>-46.63</real><key>HorizontalAccuracy</key><real>12</real>');
        await svc().handleWebhook({ topic: 'mdm.Connect', acknowledge_event: { command_uuid: 'cu2', status: 'Acknowledged', raw_payload: b64(loc) } });
        expect(ctx.t.appleMdmDevice.get('c1').lastLocation).toMatchObject({ lat: -23.55, lng: -46.63, accuracy: 12 });
    });
    it('CheckOut (perfil removido) marca e alerta', async () => {
        ctx.t.appleMdmDevice.set('c1', { id: 'c1', enrollmentId: 'U1', serialNumber: 'S', assignedTo: 'Maria' });
        expect(await svc().handleWebhook({ topic: 'mdm.CheckOut', checkin_event: { udid: 'U1' } })).toBe('CHECKOUT');
        expect(ctx.t.appleMdmDevice.get('c1').unenrolledAt).toBeInstanceOf(Date);
        expect(alerts[0]).toContain('removido');
    });
});
