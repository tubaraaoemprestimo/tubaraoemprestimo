import { describe, it, expect, vi, beforeEach } from 'vitest';
import bcrypt from 'bcryptjs';

vi.mock('../prisma', () => ({ prisma: {} }));
const mails: { to: string; token: string }[] = [];
vi.mock('../email', () => ({ emailService: {
    sendPasswordReset: vi.fn(async (to: string, _n: string, token: string) => { mails.push({ to, token }); return true; }),
    send: vi.fn(async (_t: string, _s: string, html: string) => { mails.push({ to: _t, token: html }); return true; }),
} }));
vi.mock('../../routes/loanRequests', async (orig) => ({ ...(await orig<any>()), submitLoanRequest: vi.fn() }));

import { requestPasswordReset, resetPassword, allowRequest } from '../passwordReset';
import { handleBotMessage } from '../waBot';
import { parseIncoming } from '../whaileys';

function fakeDb() {
    const users = new Map<string, any>([['u1', { id: 'u1', email: 'ana@x.com', name: 'Ana', password: bcrypt.hashSync('antiga1', 4), role: 'CLIENT' }]]);
    const sessions = new Map<string, any>();
    return {
        users, sessions,
        user: {
            findUnique: async ({ where }: any) => (where.id ? users.get(where.id) : [...users.values()].find(u => u.email === where.email)) || null,
            update: async ({ where, data }: any) => { Object.assign(users.get(where.id), data); },
        },
        waAdminPhone: { findUnique: async () => null },
        waBotSession: {
            upsert: async ({ where, create }: any) => { if (!sessions.has(where.phone)) sessions.set(where.phone, { step: 'MENU', data: {}, options: [], verified: false, userId: null, ...create }); return structuredClone(sessions.get(where.phone)); },
            update: async ({ where, data }: any) => { sessions.set(where.phone, { ...sessions.get(where.phone), ...structuredClone(data) }); },
        },
        auditLog: { create: async () => ({}) },
    };
}

describe('Esqueci minha senha', () => {
    beforeEach(() => { mails.length = 0; });

    it('e-mail existente recebe link; inexistente não recebe e não dá erro', async () => {
        const db: any = fakeDb();
        expect(await requestPasswordReset('  ANA@x.com ', db)).toBe(true);
        expect(mails[0].to).toBe('ana@x.com');
        expect(await requestPasswordReset('ninguem@x.com', db)).toBe(false);
        expect(mails).toHaveLength(1);
    });

    it('link troca a senha uma vez só; segunda tentativa recusada', async () => {
        const db: any = fakeDb();
        await requestPasswordReset('ana@x.com', db);
        const { token } = mails[0];
        await expect(resetPassword(token, '123', db)).rejects.toThrow(/pelo menos 6/);
        await resetPassword(token, 'novaSenha9', db);
        expect(bcrypt.compareSync('novaSenha9', db.users.get('u1').password)).toBe(true);
        await expect(resetPassword(token, 'outraSenha9', db)).rejects.toThrow(/já foi usado/);
        await expect(resetPassword('lixo', 'outraSenha9', db)).rejects.toThrow(/inválido/);
    });

    it('limita pedidos repetidos para o mesmo e-mail', () => {
        const t = 1_000_000;
        expect([1, 2, 3, 4].map(i => allowRequest('mail:limite@x.com', 3, t + i))).toEqual([true, true, true, false]);
        expect(allowRequest('mail:limite@x.com', 3, t + 16 * 60_000)).toBe(true);
    });

    it('WhatsApp: "esqueci minha senha" pede o e-mail e envia o link', async () => {
        const db: any = fakeDb(); const out: any[] = []; const phone = '5511977776666';
        const say = (msg: any) => handleBotMessage(parseIncoming(msg, db.sessions.get(phone)?.options || []), { phone, messageId: `m${Math.random()}`, send: async (c: any) => { out.push(c); }, db });
        await say({ conversation: 'esqueci minha senha' });
        expect(out[out.length - 1].text).toMatch(/e-mail do seu cadastro/);
        await say({ conversation: 'email errado' });
        expect(mails).toHaveLength(0);
        await say({ conversation: 'Ana@X.com' });
        expect(mails[0].to).toBe('ana@x.com');
        expect(out.some(c => /an\*\*\*@x\.com/.test(c.text) && /1 hora/.test(c.text))).toBe(true);
        // Mesmo texto para e-mail que não existe (não revela cadastro)
        await say({ buttonsResponseMessage: { selectedButtonId: 'pwd:retry' } });
        await say({ conversation: 'zz@y.com' });
        expect(mails).toHaveLength(1);
        expect(out[out.length - 2].text).toMatch(/Se \*zz\*\*\*@y\.com\* estiver cadastrado/);
    });

    it('WhatsApp: botão no assunto App/senha', async () => {
        const db: any = fakeDb(); const out: any[] = []; const phone = '5511977775555';
        const say = (msg: any) => handleBotMessage(parseIncoming(msg, db.sessions.get(phone)?.options || []), { phone, messageId: `m${Math.random()}`, send: async (c: any) => { out.push(c); }, db });
        await say({ listResponseMessage: { singleSelectReply: { selectedRowId: 'help:app' } } });
        expect(out[out.length - 1].buttons.map((b: any) => b.id)).toContain('pwd:reset');
        await say({ buttonsResponseMessage: { selectedButtonId: 'pwd:reset' } });
        expect(out[out.length - 1].text).toMatch(/e-mail do seu cadastro/);
    });
});
