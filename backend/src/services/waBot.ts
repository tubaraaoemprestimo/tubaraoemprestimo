import axios from 'axios';
import bcrypt from 'bcryptjs';
import { createHash, randomBytes, randomInt } from 'node:crypto';
import { prisma } from './prisma';
import { emailService } from './email';
import { saveBufferToStorage } from './storageService';
import { submitLoanRequest } from '../routes/loanRequests';
import { BotEvent, Button, Card, numbered, whaileysSend } from './whaileys';
import { Answers, Profile, PROFILES, PROFILE_LABEL, Step, buildPayload, guaranteeOk, isErr, nextStep, summary, CepLookup } from './waBotSteps';

/**
 * Autoatendimento por botões (Whaileys). Sem IA: só máquina de estados.
 * Identidade: o pedido sempre pertence a um usuário do app. O telefone sozinho não prova nada:
 * na primeira vez, o cliente prova o e-mail (código de 6 dígitos) ou cria a conta.
 * Nada é gravado em loan_requests antes da confirmação final; o envio usa a mesma função do app.
 */
const MAX_FILES = 10;
const SIGN_HOURS = 24;
const APP_URL = (process.env.APP_PUBLIC_URL || 'https://www.tubaraoemprestimo.com.br').replace(/\/+$/, '');
export const signTokenHash = (t: string) => createHash('sha256').update(`sign:${t}`).digest('hex');
const OTP_MIN = 10;
const MAX_MEDIA = 30 * 1024 * 1024; // igual ao limite de vídeo do motor
const MIME: Record<string, RegExp> = { image: /^image\/(jpeg|png|webp|heic|heif)$/, video: /^video\/(mp4|3gpp|quicktime|webm)$/, document: /^application\/pdf$|^image\/(jpeg|png)$/ };

type Session = { phone: string; userId: string | null; step: string; data: Answers; options: Button[]; verified: boolean; otpHash: string | null; otpTries: number; otpExpires: Date | null; signHash?: string | null; signExpires?: Date | null };
export type Send = (card: Card) => Promise<unknown>;
export type Ctx = { phone: string; messageId: string; media?: { mimetype: string; data: string }; send: Send; db?: any; cep?: CepLookup; now?: Date };

const MENU_WORDS = /^(menu|inicio|início|oi|ola|olá|bom dia|boa tarde|boa noite|0|voltar)$/i;
const CANCEL_WORDS = /^(cancelar|sair|parar)$/i;
const hash = (s: string) => createHash('sha256').update(s).digest('hex');
const maskEmail = (e: string) => e.replace(/^(.{2}).*(@.*)$/, '$1***$2');

export const viaCep: CepLookup = async (cep) => {
    const r = (await axios.get(`https://viacep.com.br/ws/${cep}/json/`, { timeout: 6000 })).data;
    return r && !r.erro ? { street: r.logradouro, neighborhood: r.bairro, city: r.localidade, state: r.uf } : null;
};

async function load(db: any, phone: string): Promise<Session> {
    const s = await db.waBotSession.upsert({ where: { phone }, update: {}, create: { phone } });
    return { ...s, data: s.data || {}, options: Array.isArray(s.options) ? s.options : [] };
}
const save = (db: any, s: Session) => db.waBotSession.update({ where: { phone: s.phone }, data: { userId: s.userId, step: s.step, data: s.data, options: s.options, verified: s.verified, otpHash: s.otpHash, otpTries: s.otpTries, otpExpires: s.otpExpires, signHash: s.signHash ?? null, signExpires: s.signExpires ?? null } });

/** Envia o card e lembra as opções (para aceitar "1", "2" ou a palavra). Até 3 botões; mais que isso vira lista. */
async function ask(ctx: Ctx, s: Session, text: string, opts: Button[] = [], listTitle = 'Opções') {
    s.options = opts;
    if (!opts.length) return ctx.send({ text });
    const body = numbered(text, opts);
    if (opts.length <= 3) return ctx.send({ text: body, buttons: opts.map(o => ({ id: o.id, title: o.title.slice(0, 20) })) });
    return ctx.send({ text: body, buttonText: 'Ver opções', sections: [{ title: listTitle, rows: opts.slice(0, 10).map(o => ({ id: o.id, title: o.title.slice(0, 24), description: (o as any).description })) }] });
}

async function menu(ctx: Ctx, s: Session, greet = true) {
    s.step = 'MENU'; s.data = { phone: s.data.phone };
    const opts: Button[] = [...PROFILES.map(p => ({ id: `svc:${p.id}`, title: p.title, description: p.description }) as Button), { id: 'svc:STATUS', title: '📋 Minhas solicitações' }];
    await ask(ctx, s, `${greet ? '🦈 Olá! Aqui é a *Tubarão Empréstimos*.\n' : ''}O que você deseja fazer? Toque em uma opção ou responda com o número.`, opts, 'Serviços');
}

// ───────── Identificação (código por e-mail ou conta nova) ─────────
async function sendOtp(ctx: Ctx, s: Session, db: any, email: string) {
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    s.otpHash = hash(`${s.phone}:${code}`); s.otpTries = 0; s.otpExpires = new Date((ctx.now || new Date()).getTime() + OTP_MIN * 60000);
    await emailService.send(email, '🔐 Código de acesso pelo WhatsApp — Tubarão Empréstimos',
        `<div style="font-family:Arial,sans-serif;background:#000;color:#fff;padding:24px;border-radius:12px"><h2 style="color:#D4AF37">Seu código: ${code}</h2><p>Use este código no WhatsApp para continuar sua solicitação. Vale por ${OTP_MIN} minutos.</p><p style="color:#888">Se não foi você, ignore este e-mail.</p></div>`);
}

async function identify(ev: BotEvent, ctx: Ctx, s: Session, db: any): Promise<boolean> {
    if (s.verified && s.userId) return true;
    const text = ev.kind === 'text' ? ev.text.trim() : '';
    const id = ev.kind === 'action' ? ev.id : '';
    if (s.step === 'ID_ASK') {
        if (id === 'id:new') { s.step = 'ID_NEW_EMAIL'; await ask(ctx, s, 'Vamos criar sua conta. Qual é o seu *e-mail*?'); return false; }
        if (id === 'id:have') { s.step = 'ID_EMAIL'; await ask(ctx, s, 'Qual é o *e-mail* da sua conta no app?'); return false; }
    }
    if (s.step === 'ID_EMAIL' || s.step === 'ID_NEW_EMAIL') {
        const email = text.toLowerCase();
        if (!/^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,}$/.test(email)) { await ask(ctx, s, 'E-mail inválido. Digite novamente.'); return false; }
        const user = await db.user.findUnique({ where: { email }, select: { id: true, role: true } });
        if (user && user.role !== 'CLIENT') { await ask(ctx, s, 'Este e-mail não pode ser usado aqui. Use o app ou fale com a equipe.'); return false; }
        if (s.step === 'ID_NEW_EMAIL' && user) { s.step = 'ID_EMAIL'; }
        if (s.step === 'ID_EMAIL' && !user) {
            await ask(ctx, s, 'Não encontrei conta com este e-mail. Quer criar uma agora?', [{ id: 'id:new', title: '🆕 Criar conta' }, { id: 'id:have', title: '✉️ Outro e-mail' }]);
            s.step = 'ID_ASK'; return false;
        }
        s.data.pendingEmail = email;
        await sendOtp(ctx, s, db, email);
        s.step = 'ID_CODE';
        await ask(ctx, s, `Enviei um *código de 6 dígitos* para ${maskEmail(email)}. Digite o código aqui.\n_Confira também a caixa de spam._`, [{ id: 'id:resend', title: '🔁 Reenviar código' }]);
        return false;
    }
    if (s.step === 'ID_CODE') {
        if (id === 'id:resend') { await sendOtp(ctx, s, db, s.data.pendingEmail); await ask(ctx, s, 'Código reenviado. Digite os 6 dígitos.'); return false; }
        const now = ctx.now || new Date();
        if (!s.otpHash || !s.otpExpires || s.otpExpires < now || s.otpTries >= 5) {
            s.step = 'ID_ASK'; s.otpHash = null;
            await ask(ctx, s, 'O código expirou ou teve tentativas demais. Vamos de novo:', [{ id: 'id:have', title: '✅ Já tenho conta' }, { id: 'id:new', title: '🆕 Criar conta' }]);
            return false;
        }
        if (!/^\d{6}$/.test(text) || hash(`${s.phone}:${text}`) !== s.otpHash) { s.otpTries++; await ask(ctx, s, `Código incorreto. Tentativas restantes: ${5 - s.otpTries}.`); return false; }
        const email = s.data.pendingEmail as string;
        let user = await db.user.findUnique({ where: { email }, select: { id: true, role: true } });
        if (!user) {
            // Conta nova verificada pelo e-mail. Senha aleatória: o cliente define a dele em "Esqueci a senha" no app.
            const pwd = await bcrypt.hash(createHash('sha256').update(`${email}:${Date.now()}:${randomInt(1e9)}`).digest('hex'), 12);
            user = await db.user.create({ data: { email, name: 'Cliente WhatsApp', password: pwd, role: 'CLIENT', phone: s.phone }, select: { id: true, role: true } });
            await db.auditLog.create({ data: { userId: user.id, userName: 'WhatsApp', action: 'WA_BOT_ACCOUNT_CREATED', entity: 'USER', entityId: user.id, details: `telefone ***${s.phone.slice(-4)}` } }).catch(() => {});
        }
        if (user.role !== 'CLIENT') { s.step = 'ID_ASK'; await ask(ctx, s, 'Este e-mail não pode ser usado aqui.'); return false; }
        s.userId = user.id; s.verified = true; s.otpHash = null; s.otpTries = 0; s.otpExpires = null; delete s.data.pendingEmail;
        await db.auditLog.create({ data: { userId: user.id, userName: 'WhatsApp', action: 'WA_BOT_VERIFIED', entity: 'USER', entityId: user.id, details: `telefone ***${s.phone.slice(-4)}` } }).catch(() => {});
        return true;
    }
    s.step = 'ID_ASK';
    await ask(ctx, s, '🔐 Para sua segurança, preciso confirmar quem é você (uma única vez).', [{ id: 'id:have', title: '✅ Já tenho conta' }, { id: 'id:new', title: '🆕 Criar conta' }]);
    return false;
}

// ───────── Etapas ─────────
async function prompt(ctx: Ctx, s: Session, st: Step) {
    if (st.kind === 'choice') return ask(ctx, s, st.text, st.options);
    if (st.kind === 'info') return ask(ctx, s, st.text, [{ id: 'next', title: '➡️ Continuar' }]);
    if (st.kind === 'file') {
        const n = Array.isArray(s.data[`${st.key}Buf`]) ? s.data[`${st.key}Buf`].length : 0;
        const opts: Button[] = [];
        if (st.multi && n) opts.push({ id: 'done', title: '✅ Pronto' });
        if (st.optional) opts.push({ id: 'skip', title: '⏭️ Pular' });
        return ask(ctx, s, n ? `${st.text}\n_Recebido(s): ${n}._` : st.text, opts);
    }
    if (st.kind === 'sign') {
        const token = randomBytes(24).toString('base64url');
        s.signHash = signTokenHash(token); s.signExpires = new Date((ctx.now || new Date()).getTime() + SIGN_HOURS * 3600000);
        return ask(ctx, s, `${st.text}

${APP_URL}/#/assinar/${token}`, [{ id: 'newlink', title: '🔁 Novo link' }]);
    }
    if (st.kind === 'text' && st.optional) return ask(ctx, s, st.text, [{ id: 'skip', title: '⏭️ Pular' }]);
    return ask(ctx, s, st.text);
}

/** Salva no R2 (mesma pasta do app). Várias fotos acumulam em `<key>Buf` até o "Pronto". */
async function storeMedia(ctx: Ctx, s: Session, st: Extract<Step, { kind: 'file' }>, ev: Extract<BotEvent, { kind: 'media' }>): Promise<string | null> {
    if (!st.accept.includes(ev.media as any)) return `Aqui preciso de ${st.accept.map(a => ({ image: 'foto', video: 'vídeo', document: 'PDF' }[a])).join(' ou ')}.`;
    if (!ctx.media?.data) return ev.media === 'video'
        ? 'Não consegui receber o vídeo. Grave um vídeo mais curto (até 30 segundos) e envie de novo.'
        : 'Não consegui baixar o arquivo. Envie de novo, por favor.';
    const mime = String(ctx.media.mimetype || ev.mimetype || '').split(';')[0].toLowerCase();
    const buf = Buffer.from(ctx.media.data, 'base64');
    if (!st.accept.some(a => MIME[a].test(mime)) || !buf.length || buf.length > MAX_MEDIA) return 'Arquivo inválido ou muito grande.';
    const target = st.multi ? `${st.key}Buf` : st.key;
    const list = Array.isArray(s.data[target]) ? s.data[target] : [];
    if (list.length >= MAX_FILES) return `Limite de ${MAX_FILES} arquivos aqui. Toque em *Pronto*.`;
    const url = await saveBufferToStorage(buf, mime, `solicitacoes/${s.userId}`, `whatsapp-${st.key}`);
    s.data[target] = [...list, url];
    return null;
}

async function advance(ctx: Ctx, s: Session) {
    const p = s.data.profile as Profile;
    const st = nextStep(p, s.data);
    if (st) return prompt(ctx, s, st);
    if (p === 'GARANTIA' && !guaranteeOk(s.data)) { s.data.gCount = Number(s.data.gCount || 1) + 1; return advance(ctx, s); }
    s.step = 'CONFIRM';
    await ask(ctx, s, `📋 *Confira sua solicitação*\n\n${summary(p, s.data)}\n\nPosso enviar para análise?`, [{ id: 'confirm', title: '✅ Enviar' }, { id: 'cancel', title: '❌ Cancelar' }]);
}

async function answer(ev: BotEvent, ctx: Ctx, s: Session): Promise<unknown> {
    const p = s.data.profile as Profile;
    const st = nextStep(p, s.data);
    if (!st) return advance(ctx, s);
    const id = ev.kind === 'action' ? ev.id : '';
    if (st.kind === 'choice') {
        const opt = st.options.find(o => o.id === id);
        if (!opt) return prompt(ctx, s, st);
        if (st.stop && opt.id in st.stop && st.stop[opt.id]) { s.step = 'MENU'; s.data = { phone: s.data.phone }; return void (await ctx.send({ text: st.stop[opt.id] })); }
        s.data[st.key] = opt.id;
        if (st.key.startsWith('gMore')) s.data.gCount = Number(s.data.gCount || 1) + 1;
        return advance(ctx, s);
    }
    if (st.kind === 'info') { if (id !== 'next' && !(ev.kind === 'text')) return prompt(ctx, s, st); s.data[st.key] = true; return advance(ctx, s); }
    if (st.kind === 'sign') {
        // A assinatura chega pela página do link (signSubmit). Aqui só reenvia o link.
        if (id === 'newlink') return prompt(ctx, s, st);
        return void (await ask(ctx, s, 'Estou aguardando a assinatura pelo link enviado acima. Se ele não abrir, toque em *Novo link*.', [{ id: 'newlink', title: '🔁 Novo link' }]));
    }
    if (st.kind === 'location') {
        if (ev.kind !== 'location') return void (await ctx.send({ text: 'Preciso da *localização*: toque no 📎 › *Localização* › *Enviar localização atual*.' }));
        s.data.location = { lat: ev.lat, lng: ev.lng }; return advance(ctx, s);
    }
    if (st.kind === 'file') {
        const buf = `${st.key}Buf`;
        if (id === 'skip' && st.optional) { s.data[st.key] = []; return advance(ctx, s); }
        if (id === 'done' && st.multi && s.data[buf]?.length) { s.data[st.key] = s.data[buf]; delete s.data[buf]; return advance(ctx, s); }
        if (ev.kind !== 'media') return prompt(ctx, s, st);
        const problem = await storeMedia(ctx, s, st, ev);
        if (problem) return void (await ctx.send({ text: problem }));
        if (!st.multi) return advance(ctx, s);
        return void (await ask(ctx, s, `✅ Recebido(s): ${s.data[buf].length}. Envie mais ou toque em *Pronto*.`, [{ id: 'done', title: '✅ Pronto' }]));
    }
    if (id === 'skip' && st.optional) { s.data[st.key] = ''; return advance(ctx, s); }
    if (ev.kind !== 'text') return prompt(ctx, s, st);
    const r = await st.parse(ev.text, s.data, ctx.cep);
    if (isErr(r)) return void (await ctx.send({ text: `⚠️ ${r.error}` }));
    s.data[st.key] = r.value;
    if (r.extra) Object.assign(s.data, Object.fromEntries(Object.entries(r.extra).filter(([, v]) => v)));
    return advance(ctx, s);
}

async function myRequests(ctx: Ctx, s: Session, db: any) {
    const rows = await db.loanRequest.findMany({ where: { userId: s.userId }, orderBy: { createdAt: 'desc' }, take: 5, select: { profileType: true, status: true, amount: true, createdAt: true } });
    const label: Record<string, string> = { PENDING: '⏳ Em análise', WAITING_DOCS: '📎 Aguardando documentos', PENDING_ACCEPTANCE: '✍️ Aguardando seu aceite', APPROVED: '✅ Aprovada', REJECTED: '❌ Não aprovada', CANCELLED: 'Cancelada' };
    const text = rows.length
        ? rows.map((r: any) => `• ${PROFILE_LABEL[r.profileType as Profile] || r.profileType} — ${label[r.status] || r.status} (${new Date(r.createdAt).toLocaleDateString('pt-BR')})`).join('\n')
        : 'Você ainda não tem solicitações.';
    await ctx.send({ text: `📋 *Suas solicitações*\n\n${text}\n\nDetalhes e contratos: https://www.tubaraoemprestimo.com.br` });
    await menu(ctx, s, false);
}

async function submit(ctx: Ctx, s: Session, db: any) {
    const p = s.data.profile as Profile;
    const user = await db.user.findUnique({ where: { id: s.userId }, select: { id: true, email: true, name: true, role: true } });
    if (!user || user.role !== 'CLIENT') { s.verified = false; s.userId = null; return menu(ctx, s); }
    // Trava de idempotência: só uma confirmação por sessão vira pedido.
    const lock = await db.waBotSession.updateMany({ where: { phone: s.phone, step: 'CONFIRM' }, data: { step: 'SUBMITTING' } });
    if (!lock.count) return;
    const name = s.data.name || user.name;
    if (user.name === 'Cliente WhatsApp' && name) await db.user.update({ where: { id: user.id }, data: { name } }).catch(() => {});
    const payload = buildPayload(p, s.data, { email: user.email, acceptedAt: (ctx.now || new Date()).toISOString(), messageId: ctx.messageId });
    const r = await submitLoanRequest(payload, { id: user.id, email: user.email, name });
    if (r.status === 201) {
        await db.auditLog.create({ data: { userId: user.id, userName: name, action: 'WA_BOT_REQUEST_SUBMITTED', entity: 'LOAN_REQUEST', entityId: r.body.id, details: `${p} via WhatsApp (botões)` } }).catch(() => {});
        s.step = 'MENU'; s.data = { phone: s.data.phone };
        await ctx.send({ text: `✅ *Solicitação enviada!*\n\nSua solicitação de *${PROFILE_LABEL[p]}* está em análise. Avisaremos por aqui e pelo app.\n\nPara acompanhar, digite *menu* › Minhas solicitações.` });
        return;
    }
    s.step = 'CONFIRM';
    await ask(ctx, s, `⚠️ Não foi possível enviar: ${r.body?.error || 'erro inesperado'}.`, [{ id: 'cancel', title: '🏠 Voltar ao menu' }]);
}

/** Uma mensagem recebida. Sempre responde algo; nunca lança para o webhook. */
export async function handleBotMessage(ev: BotEvent, ctx: Ctx) {
    const db = ctx.db || prisma;
    const s = await load(db, ctx.phone);
    if (!s.data.phone) s.data.phone = ctx.phone.replace(/^55/, '');
    const text = ev.kind === 'text' ? ev.text.trim() : '';
    try {
        if (s.step === 'SUBMITTING') return void (await ctx.send({ text: '⏳ Estou enviando sua solicitação, um instante…' }));
        if (CANCEL_WORDS.test(text) || (ev.kind === 'action' && ev.id === 'cancel')) { await ctx.send({ text: 'Cancelado. Nada foi enviado.' }); await menu(ctx, s, false); return; }
        if (MENU_WORDS.test(text) && !s.step.startsWith('ID_')) { await menu(ctx, s); return; }
        if (s.step === 'MENU' || s.step.startsWith('ID_')) {
            const choice = ev.kind === 'action' && ev.id.startsWith('svc:') ? ev.id.slice(4) : s.data.pendingService;
            if (!choice) { await menu(ctx, s); return; }
            s.data.pendingService = choice;
            if (!(await identify(ev, ctx, s, db))) return;
            delete s.data.pendingService;
            if (choice === 'STATUS') return await myRequests(ctx, s, db);
            if (!PROFILES.some(p => p.id === choice)) { await menu(ctx, s); return; }
            s.step = 'FLOW'; s.data = { phone: s.data.phone, profile: choice };
            await ctx.send({ text: `Ótimo! Vamos fazer sua solicitação de *${PROFILE_LABEL[choice as Profile]}*.\nA qualquer momento digite *cancelar* para sair.` });
            return await advance(ctx, s);
        }
        if (s.step === 'CONFIRM') {
            if (ev.kind === 'action' && ev.id === 'confirm') { await save(db, s); return await submit(ctx, s, db); }
            return await advance(ctx, s);
        }
        if (s.step === 'FLOW') {
            return await answer(ev, ctx, s);
        }
        await menu(ctx, s);
    } finally {
        // SUBMITTING é controlado pela trava no banco; não sobrescrever.
        if (s.step !== 'SUBMITTING') await save(db, s).catch((e: any) => console.error('[WaBot] falha ao salvar sessão:', e?.message));
    }
}

export const botSender = (phone: string): Send => (card) => whaileysSend(phone, card);

// ───────── Página pública de assinatura (link de uso único) ─────────
export class SignError extends Error { constructor(public status: number, msg: string) { super(msg); } }

async function sessionByToken(db: any, token: unknown, now: Date) {
    if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{20,64}$/.test(token)) throw new SignError(404, 'Link inválido');
    const s = await db.waBotSession.findUnique({ where: { signHash: signTokenHash(token) } });
    if (!s || !s.signExpires || s.signExpires < now) throw new SignError(410, 'Este link expirou. Volte ao WhatsApp e toque em "Novo link".');
    return s;
}

/** Dados mínimos para a página (nada sensível: nome e serviço). */
export async function signInfo(token: unknown, db: any = prisma, now = new Date()) {
    const s = await sessionByToken(db, token, now);
    const d = s.data || {};
    return { name: d.name || null, service: PROFILE_LABEL[d.profile as Profile] || null };
}

const dataUrl = (v: unknown, re: RegExp, max: number) => {
    const m = typeof v === 'string' ? v.match(/^data:([a-z/+.-]+);base64,([A-Za-z0-9+/=]+)$/) : null;
    if (!m || !re.test(m[1])) return null;
    const buf = Buffer.from(m[2], 'base64');
    return buf.length && buf.length <= max ? { mime: m[1], buf } : null;
};

/** Recebe assinatura + foto + localização; grava no R2, fecha a etapa e continua no WhatsApp. */
export async function signSubmit(token: unknown, body: any, meta: { ip: string; ua: string }, deps: { db?: any; send?: (phone: string) => Send; now?: Date } = {}) {
    const db = deps.db || prisma, now = deps.now || new Date();
    const row = await sessionByToken(db, token, now);
    const sig = dataUrl(body?.signature, /^image\/(png|jpeg)$/, 2 * 1024 * 1024);
    const photo = dataUrl(body?.photo, /^image\/(png|jpeg|webp)$/, 8 * 1024 * 1024);
    const lat = Number(body?.lat), lng = Number(body?.lng), accuracy = Number(body?.accuracy);
    if (!sig) throw new SignError(400, 'Assinatura obrigatória');
    if (!photo) throw new SignError(400, 'Foto obrigatória');
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) throw new SignError(400, 'Localização obrigatória');
    // Uso único: só a primeira chamada com este token fecha a etapa.
    const lock = await db.waBotSession.updateMany({ where: { phone: row.phone, signHash: row.signHash }, data: { signHash: null, signExpires: null } });
    if (!lock.count) throw new SignError(410, 'Este link já foi usado.');
    const folder = `solicitacoes/${row.userId || 'whatsapp'}`;
    const [url, photoUrl] = await Promise.all([saveBufferToStorage(sig.buf, sig.mime, folder, 'whatsapp-assinatura'), saveBufferToStorage(photo.buf, photo.mime, folder, 'whatsapp-foto-assinatura')]);
    const s: Session = { ...row, data: row.data || {}, options: Array.isArray(row.options) ? row.options : [], signHash: null, signExpires: null };
    s.data.signature = { url, photoUrl, lat, lng, accuracy: Number.isFinite(accuracy) ? accuracy : null, at: now.toISOString(), ip: meta.ip.slice(0, 64), ua: meta.ua.slice(0, 200) };
    await db.auditLog.create({ data: { userId: row.userId || 'system', userName: s.data.name || 'WhatsApp', action: 'WA_BOT_SIGNED', entity: 'WA_BOT', entityId: row.phone.slice(-4), details: `lat=${lat.toFixed(5)} lng=${lng.toFixed(5)} ip=${meta.ip.slice(0, 64)}` } }).catch(() => {});
    const ctx: Ctx = { phone: row.phone, messageId: `sign:${now.getTime()}`, send: (deps.send || botSender)(row.phone), db, now };
    await ctx.send({ text: '✅ Assinatura recebida!' }).catch(() => {});
    await advance(ctx, s);
    await save(db, s);
    return { ok: true };
}
