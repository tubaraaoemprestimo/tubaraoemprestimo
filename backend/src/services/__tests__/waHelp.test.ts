import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../routes/loanRequests', async (orig) => ({ ...(await orig<any>()), submitLoanRequest: vi.fn() }));
vi.mock('../storageService', () => ({ saveBufferToStorage: vi.fn(async () => 'https://r2.test/comprovante.jpg') }));
const mails: string[] = [];
vi.mock('../email', () => ({ emailService: { send: vi.fn(async (_t: string, _s: string, html: string) => { mails.push(html); return true; }) } }));
vi.mock('../prisma', () => ({ prisma: {} }));
vi.mock('../../routes/push', () => ({ sendPushToRole: vi.fn(async () => {}) }));

import { handleBotMessage } from '../waBot';
import { parseIncoming } from '../whaileys';
import { inBusinessHours } from '../waHelp';

function fakeDb() {
    const sessions = new Map<string, any>();
    const users = new Map<string, any>([['cli@x.com', { id: 'u1', email: 'cli@x.com', name: 'Ana', role: 'CLIENT' }]]);
    const notes: any[] = [], receipts: any[] = [];
    return {
        notes, receipts, sessions,
        waAdminPhone: { findUnique: async () => null },
        waBotSession: {
            upsert: async ({ where, create }: any) => { if (!sessions.has(where.phone)) sessions.set(where.phone, { step: 'MENU', data: {}, options: [], verified: false, userId: null, otpHash: null, otpTries: 0, otpExpires: null, ...create }); return structuredClone(sessions.get(where.phone)); },
            update: async ({ where, data }: any) => { sessions.set(where.phone, { ...sessions.get(where.phone), ...structuredClone(data) }); },
        },
        user: { findUnique: async ({ where }: any) => (where.email ? users.get(where.email) : [...users.values()].find(u => u.id === where.id)) || null },
        customer: { findFirst: async ({ where }: any) => (where.userId === 'u1' ? { id: 'c1', name: 'Ana' } : null) },
        installment: {
            findMany: async () => [{ id: 'I1', amount: 300, dueDate: new Date('2026-12-19T12:00:00Z') }],
            findUnique: async ({ where }: any) => (where.id === 'I1' ? { id: 'I1', amount: 300, loan: { customerId: 'c1' } } : null),
        },
        paymentReceipt: { count: async () => receipts.length, create: async ({ data }: any) => { receipts.push(data); return data; } },
        systemSetting: { findUnique: async ({ where }: any) => (where.key === 'pix_key' ? { value: 'pix@tubarao.com.br' } : null) },
        notification: { create: async ({ data }: any) => { notes.push(data); return data; } },
        auditLog: { create: async () => ({}) },
    };
}

describe('Atendimento por assunto', () => {
    let db: any, out: any[];
    const phone = '5511988887777';
    const MON_10H = new Date('2026-11-23T13:00:00Z'); // segunda 10h em Brasília
    const SUN = new Date('2026-11-29T13:00:00Z');
    const say = async (msg: any, now = MON_10H, media?: any) => {
        const opts = db.sessions.get(phone)?.options || [];
        await handleBotMessage(parseIncoming(msg, opts), { phone, messageId: `m${Math.random()}`, media, send: async (c: any) => { out.push(c); }, db, now });
    };
    const last = () => out[out.length - 1]?.text as string;
    beforeEach(() => { db = fakeDb(); out = []; mails.length = 0; });

    it('menu traz os assuntos mais pedidos e "Falar com atendente"', async () => {
        await say({ conversation: 'oi' });
        const rows = out[0].sections[0].rows.map((r: any) => r.title);
        expect(rows).toEqual(expect.arrayContaining(['📝 Nova solicitação', '🧮 Quanto devo?', '💳 Pagar com Pix', '📎 Já paguei', '👤 Falar com atendente']));
    });

    it('"quero falar com atendente" digitado → pergunta o assunto → fila e aviso à equipe', async () => {
        await say({ conversation: 'quero falar com um atendente por favor' });
        expect(last()).toMatch(/Qual é o assunto/);
        expect(out[out.length - 1].sections[0].rows.map((r: any) => r.title)).toEqual(expect.arrayContaining(['📋 Solicitações', '🧮 Cálculo da dívida', '✅ Quitação']));
        await say({ listResponseMessage: { singleSelectReply: { selectedRowId: 'hum:Quitação' } } });
        await say({ conversation: 'Quero quitar meu contrato este mês' });
        expect(out.some(c => /atendente vai te responder/.test(c.text))).toBe(true);
        expect(db.notes.some((n: any) => /Quitação/.test(n.title) && /quitar meu contrato/.test(n.message))).toBe(true);
        // Mensagens seguintes não duplicam o pedido
        await say({ conversation: 'alô?' });
        expect(last()).toMatch(/já está com a equipe/);
        expect(db.notes.filter((n: any) => /Atendimento pedido/.test(n.title))).toHaveLength(1);
    });

    it('fora do horário avisa que responde no próximo horário', async () => {
        expect(inBusinessHours(MON_10H)).toBe(true);
        expect(inBusinessHours(SUN)).toBe(false);
        await say({ buttonsResponseMessage: { selectedButtonId: 'help:human' } }, SUN);
        await say({ listResponseMessage: { singleSelectReply: { selectedRowId: 'hum:Outro' } } }, SUN);
        await say({ buttonsResponseMessage: { selectedButtonId: 'hum:send' } }, SUN);
        expect(out.some(c => /fora do horário/.test(c.text))).toBe(true);
    });

    it('chave Pix sai sem identificação; comprovante exige identificação e vai para conferência', async () => {
        await say({ buttonsResponseMessage: { selectedButtonId: 'pay:key' } });
        expect(out.some(c => /pix@tubarao\.com\.br/.test(c.text))).toBe(true);
        await say({ buttonsResponseMessage: { selectedButtonId: 'pay:receipt' } });
        expect(last()).toMatch(/confirmar quem é você/);
        await say({ buttonsResponseMessage: { selectedButtonId: 'id:have' } });
        await say({ conversation: 'cli@x.com' });
        await say({ conversation: mails[mails.length - 1].match(/código: (\d{6})/)![1] });
        expect(last()).toMatch(/Envie agora a \*foto\* ou o \*PDF\*/);
        await say({ conversation: 'paguei ontem' });
        expect(db.receipts).toHaveLength(0);
        await say({ imageMessage: { mimetype: 'image/jpeg' } }, MON_10H, { mimetype: 'image/jpeg', data: Buffer.from('x').toString('base64') });
        expect(db.receipts).toEqual([{ installmentId: 'I1', customerId: 'c1', receiptUrl: 'https://r2.test/comprovante.jpg', amount: 300, status: 'PENDING' }]);
        expect(out.some(c => /Comprovante recebido/.test(c.text))).toBe(true);
    });
});

describe('Atendente: o bot resolve primeiro', () => {
    let db: any, out: any[];
    const phone = '5511988887777';
    const NOW = new Date('2026-11-23T13:00:00Z');
    const say = async (msg: any) => {
        const opts = db.sessions.get(phone)?.options || [];
        await handleBotMessage(parseIncoming(msg, opts), { phone, messageId: `m${Math.random()}`, send: async (c: any) => { out.push(c); }, db, now: NOW });
    };
    const last = () => out[out.length - 1]?.text as string;
    beforeEach(() => { db = fakeDb(); out = []; });

    it('App/senha: mostra a solução e só chama a pessoa se o cliente insistir', async () => {
        await say({ buttonsResponseMessage: { selectedButtonId: 'help:human' } });
        await say({ listResponseMessage: { singleSelectReply: { selectedRowId: 'hum:App' } } });
        expect(out.some(c => /Esqueci a senha/.test(c.text))).toBe(true);
        expect(last()).toMatch(/Isso resolveu\?/);
        expect(db.notes.filter((n: any) => /Atendimento pedido/.test(n.title))).toHaveLength(0);
        await say({ buttonsResponseMessage: { selectedButtonId: 'hum:App' } }); // "Ainda preciso de atendente"
        expect(last()).toMatch(/Escreva em uma mensagem/);
        await say({ buttonsResponseMessage: { selectedButtonId: 'hum:send' } });
        expect(db.notes.filter((n: any) => /Atendimento pedido: App/.test(n.title))).toHaveLength(1);
    });

    it('"Sim, resolveu" volta ao menu sem chamar ninguém', async () => {
        await say({ buttonsResponseMessage: { selectedButtonId: 'help:human' } });
        await say({ listResponseMessage: { singleSelectReply: { selectedRowId: 'hum:Renegociação' } } });
        expect(out.some(c => /Atraso ou renegociação/.test(c.text))).toBe(true);
        await say({ buttonsResponseMessage: { selectedButtonId: 'help:menu' } });
        expect(last()).toMatch(/O que você deseja fazer\?/);
        expect(db.notes).toHaveLength(0);
    });

    it('Cobrança indevida vai direto para a equipe (não tem como o bot resolver)', async () => {
        await say({ buttonsResponseMessage: { selectedButtonId: 'help:human' } });
        await say({ listResponseMessage: { singleSelectReply: { selectedRowId: 'hum:Cobrança indevida' } } });
        await say({ conversation: 'Cobraram R$ 300 dia 10 que eu já tinha pago' });
        expect(db.notes.some((n: any) => /Cobrança indevida/.test(n.title) && /já tinha pago/.test(n.message))).toBe(true);
    });
});

describe('Atendente: botão de serviço sai do fluxo do atendente', () => {
    it('"Quanto devo?" na tela de renegociação pede identificação e segue o serviço', async () => {
        const db: any = fakeDb(); const out: any[] = []; const phone = '5511988887777';
        const say = async (msg: any) => handleBotMessage(parseIncoming(msg, db.sessions.get(phone)?.options || []), { phone, messageId: `m${Math.random()}`, send: async (c: any) => { out.push(c); }, db, now: new Date('2026-11-23T13:00:00Z') });
        await say({ buttonsResponseMessage: { selectedButtonId: 'help:human' } });
        await say({ listResponseMessage: { singleSelectReply: { selectedRowId: 'hum:Renegociação' } } });
        await say({ buttonsResponseMessage: { selectedButtonId: 'svc:DEBT' } });
        expect(out[out.length - 1].text).toMatch(/confirmar quem é você/);
        expect(db.notes).toHaveLength(0);
    });
});
