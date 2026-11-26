import { describe, it, expect, vi, beforeEach } from 'vitest';

const submitted: any[] = [];
vi.mock('../../routes/loanRequests', async (orig) => ({ ...(await orig<any>()), submitLoanRequest: vi.fn(async (data: any) => { submitted.push(data); return { status: 201, body: { id: 'lr1' } }; }) }));
vi.mock('../storageService', () => ({ saveBufferToStorage: vi.fn(async (_b: Buffer, _m: string, _f: string, n: string) => `https://r2.test/${n}-${Math.random().toString(36).slice(2, 6)}`) }));
const mails: string[] = [];
vi.mock('../email', () => ({ emailService: { send: vi.fn(async (_to: string, _s: string, html: string) => { mails.push(html); return true; }) } }));
vi.mock('../prisma', () => ({ prisma: {} }));

import { handleBotMessage, signSubmit, signInfo, signTokenHash } from '../waBot';
import { parseIncoming } from '../whaileys';
import { nextStep, parseMoney, parseBirth, buildPayload } from '../waBotSteps';
import { validateRequestByProfile } from '../../routes/loanRequests';

// Banco em memória com o mínimo que o bot usa.
function fakeDb() {
    const sessions = new Map<string, any>(); const users = new Map<string, any>();
    users.set('cli@x.com', { id: 'u1', email: 'cli@x.com', name: 'Cliente WhatsApp', role: 'CLIENT' });
    users.set('adm@x.com', { id: 'a1', email: 'adm@x.com', name: 'Adm', role: 'ADMIN' });
    const byId = (id: string) => [...users.values()].find(u => u.id === id);
    return {
        waBotSession: {
            upsert: async ({ where, create }: any) => { if (!sessions.has(where.phone)) sessions.set(where.phone, { step: 'MENU', data: {}, options: [], verified: false, userId: null, otpHash: null, otpTries: 0, otpExpires: null, ...create }); return structuredClone(sessions.get(where.phone)); },
            update: async ({ where, data }: any) => { sessions.set(where.phone, { ...sessions.get(where.phone), ...structuredClone(data) }); },
            updateMany: async ({ where, data }: any) => { const s = sessions.get(where.phone); if (!s || Object.entries(where).some(([k, v]) => k !== 'phone' && s[k] !== v)) return { count: 0 }; Object.assign(s, data); return { count: 1 }; },
            findUnique: async ({ where }: any) => [...sessions.entries()].map(([phone, v]) => ({ phone, ...v })).find(x => x.signHash === where.signHash) || null,
        },
        user: {
            findUnique: async ({ where }: any) => (where.email ? users.get(where.email) : byId(where.id)) || null,
            create: async ({ data }: any) => { const u = { id: 'new1', ...data }; users.set(data.email, u); return u; },
            update: async ({ where, data }: any) => Object.assign(byId(where.id), data),
        },
        loanRequest: { findMany: async () => [] },
        auditLog: { create: async () => ({}) },
        sessions,
    };
}

describe('Autoatendimento por botões', () => {
    let db: any, out: any[];
    const phone = '5511988887777';
    const NOW = new Date('2026-11-26T12:00:00Z');
    const say = async (msg: any, media?: any) => {
        const opts = db.sessions.get(phone)?.options || [];
        await handleBotMessage(parseIncoming(msg, opts), { phone, messageId: `m${Math.random()}`, media, send: async (c: any) => { out.push(c); }, db, cep: async () => ({ street: 'Rua A', neighborhood: 'Centro', city: 'São Paulo', state: 'SP' }), now: new Date('2026-11-26T12:00:00Z') });
    };
    const last = () => out[out.length - 1]?.text as string;
    const code = () => mails[mails.length - 1].match(/código: (\d{6})/)![1];
    beforeEach(() => { db = fakeDb(); out = []; submitted.length = 0; mails.length = 0; });

    it('menu com botões numerados; texto "1" vale como clique', async () => {
        await say({ conversation: 'oi' });
        expect(out[0].sections[0].rows.length).toBe(7);
        expect(last()).toMatch(/1\. 💼 Empréstimo CLT/);
        await say({ conversation: '1' });
        expect(last()).toMatch(/confirmar quem é você/);
    });

    it('não segue sem provar o e-mail; código errado conta tentativa; e-mail de admin é recusado', async () => {
        await say({ conversation: 'oi' }); await say({ conversation: '5' });
        await say({ buttonsResponseMessage: { selectedButtonId: 'id:have' } });
        await say({ conversation: 'adm@x.com' });
        expect(last()).toMatch(/não pode ser usado/);
        await say({ conversation: 'cli@x.com' });
        expect(last()).toMatch(/código de 6 dígitos/);
        await say({ conversation: '000000' });
        expect(last()).toMatch(/Código incorreto/);
        expect(db.sessions.get(phone).verified).toBe(false);
        await say({ conversation: code() });
        expect(db.sessions.get(phone).verified).toBe(true);
        expect(last()).toMatch(/Aceito/);
    });

    it('LIMPA_NOME completo: termos, dados, assinatura, resumo, envio único', async () => {
        await say({ conversation: 'oi' }); await say({ conversation: '5' });
        await say({ buttonsResponseMessage: { selectedButtonId: 'id:have' } }); await say({ conversation: 'cli@x.com' }); await say({ conversation: code() });
        await say({ conversation: '1' }); // aceito
        await say({ conversation: 'Maria da Silva' });
        await say({ conversation: '123' }); expect(last()).toMatch(/inválido/);
        await say({ conversation: '529.982.247-25' });
        await say({ conversation: '31/12/2015' }); expect(last()).toMatch(/menor de 18/);
        await say({ conversation: '25/03/1990' });
        expect(last()).toMatch(/assinatura[\s\S]*#\/assinar\/[A-Za-z0-9_-]{20,}/);
        const token = last().match(/#\/assinar\/([A-Za-z0-9_-]+)/)![1];
        await say({ conversation: 'texto' }); expect(last()).toMatch(/aguardando a assinatura/);
        expect(db.sessions.get(phone).signHash).toBe(signTokenHash(token));
        expect(await signInfo(token, db, NOW)).toEqual({ name: 'Maria da Silva', service: '🧾 Limpar nome' });
        const png = 'data:image/png;base64,' + Buffer.from('sig').toString('base64');
        const jpg = 'data:image/jpeg;base64,' + Buffer.from('foto').toString('base64');
        const send = () => async (c: any) => { out.push(c); };
        await expect(signSubmit(token, { signature: png, photo: jpg }, { ip: '1.2.3.4', ua: 'x' }, { db, send, now: NOW })).rejects.toThrow(/Localização/);
        await expect(signSubmit(token, { signature: png, lat: -23.5, lng: -46.6 }, { ip: '1.2.3.4', ua: 'x' }, { db, send, now: NOW })).rejects.toThrow(/Foto/);
        await signSubmit(token, { signature: png, photo: jpg, lat: -23.5, lng: -46.6, accuracy: 12 }, { ip: '1.2.3.4', ua: 'x' }, { db, send, now: NOW });
        await expect(signSubmit(token, { signature: png, photo: jpg, lat: 1, lng: 1 }, { ip: '1.2.3.4', ua: 'x' }, { db, send, now: NOW })).rejects.toThrow(/expirou|usado/);
        expect(last()).toMatch(/Confira sua solicitação[\s\S]*\*\*\*4725/);
        await say({ buttonsResponseMessage: { selectedButtonId: 'confirm' } });
        await say({ buttonsResponseMessage: { selectedButtonId: 'confirm' } });
        expect(submitted).toHaveLength(1);
        expect(submitted[0]).toMatchObject({ profileType: 'LIMPA_NOME', cpf: '52998224725', clientName: 'Maria da Silva', email: 'cli@x.com', phone: '11988887777' });
        expect(submitted[0].signatureUrl).toMatch(/whatsapp-assinatura/);
        expect(JSON.parse(submitted[0].supplementalDescription).signature).toMatchObject({ latitude: -23.5, longitude: -46.6, ip: '1.2.3.4' });
        expect(validateRequestByProfile(submitted[0])).toBeNull();
        expect(out.filter(c => /Solicitação enviada/.test(c.text))).toHaveLength(1);
    });

    it('CLT com menos de 3 meses encerra sem gravar nada', async () => {
        await say({ conversation: 'oi' }); await say({ conversation: '1' });
        await say({ buttonsResponseMessage: { selectedButtonId: 'id:have' } }); await say({ conversation: 'cli@x.com' }); await say({ conversation: code() });
        await say({ conversation: '2' }); // não é cliente
        await say({ conversation: '50' }); expect(last()).toMatch(/entre R\$ 300/);
        await say({ conversation: '1.500' });
        await say({ conversation: 'não' });
        expect(last()).toMatch(/mais de 3 meses/);
        expect(submitted).toHaveLength(0);
        expect(db.sessions.get(phone).step).toBe('MENU');
    });

    it('cancelar a qualquer momento não envia', async () => {
        await say({ conversation: 'oi' }); await say({ conversation: '5' });
        await say({ conversation: 'cancelar' });
        expect(out.some(c => /Nada foi enviado/.test(c.text))).toBe(true);
        expect(submitted).toHaveLength(0);
    });
});

describe('Etapas e regras do app', () => {
    it('valores e datas', () => {
        expect(parseMoney('1.500')).toBe(1500);
        expect(parseMoney('R$ 2.500,50')).toBe(2500.5);
        expect(parseMoney('abc')).toBeNull();
        expect(parseBirth('29/02/2001')).toBeNull();
        expect(parseBirth('10/10/1985')).toBe('1985-10-10');
    });

    it('CLT completo gera corpo que passa na mesma validação do servidor', () => {
        const f = (k: string) => [`https://r2.test/${k}`];
        const a: any = {
            phone: '11988887777', profile: 'CLT', returning: 'nao', amount: 1500, clt3m: 'sim', terms: 'aceito', name: 'João Souza', cpf: '52998224725', birthDate: '1990-03-25',
            instagram: '', cep: '01001000', street: 'Rua A', neighborhood: 'Centro', city: 'SP', state: 'SP', number: '10', income: 3000, occupation: 'Vendedor', companyName: 'Loja X',
            ref1Name: 'Ana', ref1Phone: '11911112222', ref1Rel: 'Mãe', ref2Name: 'Rui', ref2Phone: '11933334444', ref2Rel: 'Pai',
            selfie: f('s'), idFront: f('f'), idBack: f('b'), proofAddress: f('a'), proofIncome: f('i'), housePhotos: f('h'), billInName: f('c'), videoHouse: f('vh'), videoSelfie: f('vs'), workCard: f('w'),
            location: { lat: -23.5, lng: -46.6 }, bankName: 'Nubank', pixKeyType: 'cpf', pixKey: '52998224725', accountHolderName: 'João Souza', accountHolderCpf: '52998224725', signature: { url: 'https://r2.test/sig', photoUrl: 'https://r2.test/foto', lat: -23.5, lng: -46.6 },
        };
        expect(nextStep('CLT', a)).toBeNull();
        const body = buildPayload('CLT', a, { email: 'j@x.com', acceptedAt: 'now', messageId: 'm1' });
        expect(validateRequestByProfile(body)).toBeNull();
        expect(body).toMatchObject({ amount: 1500, installments: 1, latitude: -23.5 });
        expect(JSON.parse(body.supplementalDescription).channel).toBe('WHATSAPP_BUTTONS');
    });

    it('garantia exige bens valendo pelo menos o dobro', () => {
        const a: any = { profile: 'GARANTIA', returning: 'nao', amount: 5000, terms: 'aceito', name: 'X Y Z', cpf: '1', birthDate: 'x', phone: '1', instagram: '', cep: '1', street: 'r', number: '1', income: 1, ref1Name: 'a', ref1Phone: '1', ref1Rel: 'Pai', ref2Name: 'b', ref2Phone: '2', ref2Rel: 'Mãe', g0Type: 'carro', g0Desc: 'Gol', g0Cond: 'bom', g0Value: 4000, g0Photos: ['p'], g0HasInvoice: 'nao' };
        expect(nextStep('GARANTIA', a)!.key).toBe('gMore1');
    });
});
