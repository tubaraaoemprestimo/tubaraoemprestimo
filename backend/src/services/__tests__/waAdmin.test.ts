import { describe, it, expect, vi, beforeEach } from 'vitest';

const calls: any[] = [];
vi.mock('axios', () => ({ default: { request: vi.fn(async (cfg: any) => {
    calls.push({ method: cfg.method, url: cfg.url.replace(/^.*\/api/, ''), data: cfg.data, auth: !!cfg.headers?.Authorization });
    if (cfg.url.endsWith('/loan-requests')) return { data: [{ id: 'R1', clientName: 'Ana Souza', profileType: 'CLT', amount: 1000, installments: 1, status: 'PENDING', cpf: '52998224725', createdAt: new Date().toISOString() }] };
    if (cfg.url.includes('/payment-receipts')) return { data: [] };
    return { data: { ok: true } };
}) } }));
vi.mock('../prisma', () => ({ prisma: {} }));

import bcrypt from 'bcryptjs';
import { handleAdmin } from '../waAdmin';
import { parseIncoming } from '../whaileys';

function fakeDb(admin: any) {
    return {
        waAdminPhone: { update: async ({ data }: any) => Object.assign(admin, data), findUnique: async () => admin },
        user: { findUnique: async () => ({ id: 'a1', email: 'a@x', name: 'Adm', role: 'ADMIN' }) },
        auditLog: { create: async () => ({}) },
        installment: { count: async () => 0 },
    };
}

describe('Admin pelo WhatsApp', () => {
    const NOW = new Date('2026-11-26T12:00:00Z');
    let admin: any, st: any, out: string[], notes: string[];
    const say = async (msg: any) => {
        const db = fakeDb(admin);
        await handleAdmin(parseIncoming(msg, st.options), { phone: admin.phone, messageId: 'm', send: async (c: any) => { out.push(c.text); }, now: NOW } as any, st, { ...admin }, { db, notifyAdmins: async (_t, b) => { notes.push(b); } });
    };
    const last = () => out[out.length - 1];
    beforeEach(() => { admin = { phone: '5511900001111', userId: 'a1', pinHash: null, pinTries: 0, lockedUntil: null, sessionUntil: null, active: true }; st = { step: 'ADM_MENU', data: {}, options: [] }; out = []; notes = []; calls.length = 0; });

    it('primeiro acesso exige PIN forte e guarda só o hash', async () => {
        await say({ conversation: 'oi' }); expect(last()).toMatch(/Crie um \*PIN/);
        await say({ conversation: '123456' }); expect(last()).toMatch(/fraco/);
        await say({ conversation: '111111' }); expect(last()).toMatch(/fraco/);
        await say({ conversation: '482915' });
        expect(admin.pinHash).toBeTruthy(); expect(admin.pinHash).not.toContain('482915');
        expect(await bcrypt.compare('482915', admin.pinHash)).toBe(true);
        expect(last()).toMatch(/Painel Tubarão/);
    });

    it('sem sessão pede PIN; 5 erros bloqueiam e avisam os admins', async () => {
        admin.pinHash = await bcrypt.hash('482915', 4);
        await say({ conversation: 'oi' }); expect(last()).toMatch(/Digite seu \*PIN/);
        for (let i = 0; i < 5; i++) await say({ conversation: '000000' });
        expect(admin.lockedUntil).toBeInstanceOf(Date);
        expect(notes.some(n => /Bloqueado/.test(n))).toBe(true);
        await say({ conversation: '482915' }); expect(last()).toMatch(/bloqueado/i);
        expect(calls).toHaveLength(0);
    });

    it('aprovar só executa depois do PIN, pela mesma rota do painel', async () => {
        admin.pinHash = await bcrypt.hash('482915', 4);
        admin.sessionUntil = new Date(NOW.getTime() + 600000);
        await say({ buttonsResponseMessage: { selectedButtonId: 'adm:req' } });
        expect(last()).toMatch(/Solicitações pendentes/);
        await say({ conversation: '1' });
        expect(out.join('\n')).toMatch(/Ana Souza[\s\S]*\*\*\*\.982\.\*\*\*-\*\*/);
        await say({ buttonsResponseMessage: { selectedButtonId: 'act:approve' } });
        expect(last()).toMatch(/Confirmar: \*Aprovar solicitação\*/);
        expect(calls.some(c => c.method === 'put')).toBe(false);
        await say({ conversation: '482915' });
        const put = calls.find(c => c.method === 'put');
        expect(put).toMatchObject({ url: '/loan-requests/R1/approve', auth: true });
        expect(notes.some(n => /Aprovar solicitação/.test(n))).toBe(true);
    });

    it('PIN errado na confirmação não executa', async () => {
        admin.pinHash = await bcrypt.hash('482915', 4);
        admin.sessionUntil = new Date(NOW.getTime() + 600000);
        await say({ buttonsResponseMessage: { selectedButtonId: 'adm:req' } }); await say({ conversation: '1' });
        await say({ buttonsResponseMessage: { selectedButtonId: 'act:reject' } });
        await say({ conversation: '999999' });
        expect(calls.some(c => c.method === 'put')).toBe(false);
        await say({ conversation: 'não' });
        expect(calls.some(c => c.method === 'put')).toBe(false);
    });
});

describe('Admin pelo WhatsApp: telas extras', () => {
    const NOW = new Date('2026-11-26T12:00:00Z');
    it('contestação resolvida exige decisão escrita, PIN e envia confirm RESOLVER', async () => {
        const admin: any = { phone: '5511900001111', userId: 'a1', pinHash: await bcrypt.hash('482915', 4), pinTries: 0, lockedUntil: null, sessionUntil: new Date(NOW.getTime() + 600000), active: true };
        const st: any = { step: 'ADM_DISP', data: { rows: [{ id: 'D1', name: 'Bia', reason: 'cobrança indevida', status: 'OPEN', at: NOW }] }, options: [] };
        const out: string[] = []; calls.length = 0;
        const say = async (msg: any) => handleAdmin(parseIncoming(msg, st.options), { phone: admin.phone, messageId: 'm', send: async (c: any) => { out.push(c.text); }, now: NOW } as any, st, { ...admin }, { db: fakeDb(admin), notifyAdmins: async () => {} });
        await say({ listResponseMessage: { singleSelectReply: { selectedRowId: 'dsp:0' } } });
        await say({ listResponseMessage: { singleSelectReply: { selectedRowId: 'dsp:RESOLVED' } } });
        await say({ conversation: 'ok' });
        expect(out[out.length - 1]).toMatch(/precisa de um texto/);
        await say({ conversation: 'Cobrança cancelada, valor estornado' });
        expect(calls.some(c => c.method === 'patch')).toBe(false);
        await say({ conversation: '482915' });
        expect(calls.find(c => c.method === 'patch')).toMatchObject({ url: '/legacy-ops/disputes/D1', data: { status: 'RESOLVED', confirm: 'RESOLVER', note: 'Cobrança cancelada, valor estornado' } });
    });
});
