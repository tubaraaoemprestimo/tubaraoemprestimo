import { describe, it, expect, vi, beforeEach } from 'vitest';

process.env.WHAILEYS_INSTANCE = 'tubarao-botoes';
const ingested: any[] = [];
vi.mock('../inbox', () => ({ ingestMessage: vi.fn(async (n: any, o: any) => { ingested.push({ ...n, ...o }); return { conversation: { id: 'C1', mode: 'AI_ACTIVE' } }; }), publish: vi.fn(), preview: (n: any) => n.text }));
const sent: any[] = [];
vi.mock('../whaileys', async (orig) => ({ ...(await orig<any>()), whaileysSend: vi.fn(async (to: string, card: any) => { sent.push({ to, ...card }); return { messageId: `M${sent.length}` }; }) }));
const aiCalls: any[] = [];
vi.mock('../../routes/webhook', () => ({ aiReply: vi.fn(async (h: any, t: string) => { aiCalls.push({ h, t }); return 'Resposta da IA'; }) }));
vi.mock('../prisma', () => ({ prisma: {} }));

import { recordInbound, inboxSender, aiEnabledFor, setAi, aiAnswer, queueHuman } from '../waBotInbox';
import { whaileysInstanceKey } from '../whaileys';

function fakeDb() {
    const settings = new Map<string, string>(); const convs = new Map<string, any>([['C1', { id: 'C1', mode: 'AI_ACTIVE', version: 1, phone: '5511988887777', name: 'Ana' }]]);
    return {
        settings, convs,
        systemSetting: {
            findUnique: async ({ where }: any) => (settings.has(where.key) ? { key: where.key, value: settings.get(where.key) } : null),
            upsert: async ({ where, create }: any) => { settings.set(where.key, create.value); },
            deleteMany: async ({ where }: any) => { settings.delete(where.key); },
        },
        waConversation: {
            findUnique: async ({ where }: any) => (where.id ? convs.get(where.id) : convs.get('C1')),
            updateMany: async ({ where, data }: any) => { const c = convs.get(where.id); if (c.version !== where.version) return { count: 0 }; Object.assign(c, data, { version: c.version + 1 }); return { count: 1 }; },
        },
        waMessage: { findMany: async () => [{ fromMe: false, text: 'quanto devo?' }, { fromMe: true, text: 'Olá!' }] }, // mais nova primeiro (orderBy desc)
        auditLog: { create: async () => ({}) },
    };
}

describe('Número de botões na Central', () => {
    beforeEach(() => { ingested.length = 0; sent.length = 0; aiCalls.length = 0; });

    it('mensagem do cliente e resposta do bot entram na Central com a origem certa', async () => {
        await recordInbound('5511988887777', 'ABC1', { kind: 'action', id: 'svc:DEBT' }, 'Ana');
        expect(ingested[0]).toMatchObject({ instance: whaileysInstanceKey(), fromMe: false, phone: '5511988887777', text: '[botão] svc:DEBT', pushName: 'Ana' });
        await inboxSender('5511988887777', 'AUTOMACAO')({ text: 'Menu', buttons: [{ id: 'a', title: 'A' }] });
        expect(sent[0]).toMatchObject({ to: '5511988887777', text: 'Menu' });
        expect(ingested[1]).toMatchObject({ instance: 'whaileys:tubarao-botoes', fromMe: true, origin: 'AUTOMACAO', externalId: 'M1' });
    });

    it('IA desligada por padrão; ligada pelo atendente responde com histórico da Central', async () => {
        const db: any = fakeDb();
        expect(await aiEnabledFor('C1', db)).toBe(false);
        await setAi('C1', true, { id: 'a1', name: 'Adm' }, db);
        expect(await aiEnabledFor('C1', db)).toBe(true);
        expect(await aiAnswer('C1', '5511988887777', 'quanto devo?', db)).toBe(true);
        expect(aiCalls[0].h).toEqual([{ role: 'assistant', content: 'Olá!' }]);
        expect(sent[0].text).toBe('Resposta da IA');
        expect(ingested.find(i => i.fromMe)?.origin).toBe('IA');
        await setAi('C1', false, { id: 'a1', name: 'Adm' }, db);
        expect(await aiEnabledFor('C1', db)).toBe(false);
    });

    it('pedido de atendente põe a conversa na fila humana (uma vez)', async () => {
        const db: any = fakeDb();
        await queueHuman('5511988887777', 'Quitação', db);
        expect(db.convs.get('C1').mode).toBe('WAITING_HUMAN');
        const v = db.convs.get('C1').version;
        await queueHuman('5511988887777', 'Quitação', db);
        expect(db.convs.get('C1').version).toBe(v);
    });
});
