import express, { Router, Request, Response } from 'express';
import { prisma } from '../services/prisma';
import { authenticate, requireAdmin } from '../middleware/auth';
import { parseIncoming, verifySignature, whaileysConnect, whaileysEnabled, whaileysLogout, whaileysStatus } from '../services/whaileys';
import { botSender, handleBotMessage, viaCep, signInfo, signSubmit, SignError } from '../services/waBot';

/**
 * WhatsApp por botões (Whaileys): número separado da Evolution, sem IA.
 * Webhook: HMAC + janela de 5 min → dedupe por key.id (tabela) → 200 → processa.
 */
export const whaileysWebhookRouter = Router();
whaileysWebhookRouter.post('/', express.raw({ type: '*/*', limit: '45mb' }), async (req: Request, res: Response) => {
    if (!whaileysEnabled()) { res.sendStatus(503); return; }
    const raw = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : '';
    if (!verifySignature(raw, req.get('x-whaileys-timestamp'), req.get('x-whaileys-signature'))) { res.sendStatus(401); return; }
    let body: any;
    try { body = JSON.parse(raw); } catch { res.sendStatus(400); return; }
    const id = body?.key?.id, jid = String(body?.key?.remoteJid || '');
    if (body?.instanceKey !== process.env.WHAILEYS_INSTANCE || typeof id !== 'string' || !/^[A-Za-z0-9._-]{4,128}$/.test(id) || body.key.fromMe) { res.json({ ignored: true }); return; }
    // Só conversa privada com número real: sem número não há como identificar o cliente com segurança.
    const pn = [jid, body.key.senderPn].find((j: any) => typeof j === 'string' && /^\d{10,15}@s\.whatsapp\.net$/.test(j));
    if (!pn) { res.json({ ignored: true }); return; }
    const phone = pn.split('@')[0];
    try { await prisma.waBotInbound.create({ data: { id, phone } }); }
    catch { res.json({ duplicate: true }); return; }
    res.json({ received: true });

    const session = await prisma.waBotSession.findUnique({ where: { phone }, select: { options: true } }).catch(() => null);
    const ev = parseIncoming(body.message, Array.isArray(session?.options) ? (session!.options as any) : []);
    if (ev.kind === 'ignored') return;
    const media = body.media?.data && body.media?.mimetype ? { mimetype: String(body.media.mimetype), data: String(body.media.data) } : undefined;
    handleBotMessage(ev, { phone, messageId: id, media, send: botSender(phone), cep: viaCep })
        .catch((e: any) => console.error('[WaBot] erro ao processar:', e?.message));
    // Limpeza da deduplicação (> 7 dias), barata e ocasional.
    if (Math.random() < 0.01) prisma.waBotInbound.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 7 * 86400000) } } }).catch(() => {});
});

/** Tela de conexão (admin): status, QR/código e desconectar. Credenciais só no servidor. */
export const whaileysAdminRouter = Router();
whaileysAdminRouter.use(authenticate, requireAdmin);
const off = (res: Response) => res.status(503).json({ error: 'WhatsApp por botões não configurado no servidor' });
const fail = (res: Response, e: any) => res.status(502).json({ error: e?.message || 'Whaileys indisponível' });

whaileysAdminRouter.get('/status', async (_req, res) => {
    if (!whaileysEnabled()) { res.json({ enabled: false }); return; }
    try { const s = await whaileysStatus(); res.json({ enabled: true, state: s.state, qr: s.qr, pairingCode: s.pairingCode, connected: s.me?.id ? `***${String(s.me.id).split('@')[0].split(':')[0].slice(-4)}` : null }); }
    catch (e) { fail(res, e); }
});
whaileysAdminRouter.post('/connect', async (req, res) => {
    if (!whaileysEnabled()) { off(res); return; }
    const phone = typeof req.body?.phone === 'string' ? req.body.phone.replace(/\D/g, '') : '';
    if (phone && !/^55\d{10,11}$/.test(phone)) { res.status(400).json({ error: 'Informe 55 + DDD + número' }); return; }
    try {
        const s = await whaileysConnect(phone || undefined);
        await prisma.auditLog.create({ data: { userId: req.user!.id, userName: req.user!.name, action: phone ? 'WHAILEYS_PAIRING_REQUESTED' : 'WHAILEYS_QR_REQUESTED', entity: 'WHATSAPP', entityId: 'whaileys', details: `estado=${s.state}` } }).catch(() => {});
        res.json({ state: s.state, qr: s.qr, pairingCode: s.pairingCode });
    } catch (e) { fail(res, e); }
});
whaileysAdminRouter.post('/disconnect', async (req, res) => {
    if (!whaileysEnabled()) { off(res); return; }
    try {
        await whaileysLogout();
        await prisma.auditLog.create({ data: { userId: req.user!.id, userName: req.user!.name, action: 'WHAILEYS_LOGOUT', entity: 'WHATSAPP', entityId: 'whaileys', details: '' } }).catch(() => {});
        res.json({ ok: true });
    } catch (e) { fail(res, e); }
});

/**
 * Página pública de assinatura (link enviado no WhatsApp). O token de uso único é a única credencial.
 * ponytail: limite de tentativas em memória por IP (1 processo PM2); com cluster, mover para o banco.
 */
export const signRouter = Router();
const hits = new Map<string, { n: number; at: number }>();
function limited(ip: string, max = 30) {
    const now = Date.now(), h = hits.get(ip);
    if (!h || now - h.at > 10 * 60000) { hits.set(ip, { n: 1, at: now }); if (hits.size > 5000) hits.clear(); return false; }
    return ++h.n > max;
}
const ipOf = (req: Request) => String(req.get('cf-connecting-ip') || req.socket.remoteAddress || '');
const signFail = (res: Response, e: any) => {
    if (e instanceof SignError) { res.status(e.status).json({ error: e.message }); return; }
    console.error('[WaBot] assinatura:', e?.message);
    res.status(500).json({ error: 'Não foi possível concluir. Tente de novo.' });
};
signRouter.get('/:token', async (req, res) => {
    if (limited(ipOf(req))) { res.status(429).json({ error: 'Muitas tentativas. Aguarde alguns minutos.' }); return; }
    try { res.json(await signInfo(req.params.token)); } catch (e) { signFail(res, e); }
});
signRouter.post('/:token', express.json({ limit: '15mb' }), async (req, res) => {
    if (limited(ipOf(req), 10)) { res.status(429).json({ error: 'Muitas tentativas. Aguarde alguns minutos.' }); return; }
    try { res.json(await signSubmit(req.params.token, req.body, { ip: ipOf(req), ua: String(req.get('user-agent') || '') })); } catch (e) { signFail(res, e); }
});

// ───────── Números autorizados como admin no WhatsApp de botões ─────────
const adminPhone = (v: unknown) => { const d = String(v || '').replace(/\D/g, ''); return /^55\d{10,11}$/.test(d) ? d : null; };
whaileysAdminRouter.get('/admins', async (_req, res) => {
    const rows = await prisma.waAdminPhone.findMany({ orderBy: { createdAt: 'asc' } });
    const users = await prisma.user.findMany({ where: { id: { in: rows.map(r => r.userId) } }, select: { id: true, name: true, email: true } });
    res.json({ items: rows.map(r => ({ phone: r.phone, label: r.label, active: r.active, hasPin: !!r.pinHash, locked: !!(r.lockedUntil && r.lockedUntil > new Date()), user: users.find(u => u.id === r.userId) || null, createdAt: r.createdAt })) });
});
whaileysAdminRouter.post('/admins', async (req, res) => {
    const phone = adminPhone(req.body?.phone);
    if (!phone) { res.status(400).json({ error: 'Número inválido: use 55 + DDD + número' }); return; }
    const userId = typeof req.body?.userId === 'string' ? req.body.userId : req.user!.id;
    const u = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
    if (u?.role !== 'ADMIN') { res.status(400).json({ error: 'O usuário vinculado precisa ser administrador' }); return; }
    const label = typeof req.body?.label === 'string' ? req.body.label.trim().slice(0, 60) : null;
    // Novo cadastro sempre sem PIN: o dono do número cria o PIN no primeiro acesso.
    await prisma.waAdminPhone.upsert({ where: { phone }, update: { userId, label, active: true, pinHash: null, pinTries: 0, lockedUntil: null, sessionUntil: null }, create: { phone, userId, label, createdBy: req.user!.id } });
    await prisma.auditLog.create({ data: { userId: req.user!.id, userName: req.user!.name, action: 'WA_ADMIN_PHONE_ADDED', entity: 'WA_ADMIN', entityId: phone.slice(-4), details: label || '' } }).catch(() => {});
    res.json({ ok: true });
});
whaileysAdminRouter.post('/admins/:phone/reset-pin', async (req, res) => {
    const phone = adminPhone(req.params.phone);
    if (!phone) { res.sendStatus(400); return; }
    await prisma.waAdminPhone.update({ where: { phone }, data: { pinHash: null, pinTries: 0, lockedUntil: null, sessionUntil: null } }).catch(() => null);
    await prisma.auditLog.create({ data: { userId: req.user!.id, userName: req.user!.name, action: 'WA_ADMIN_PIN_RESET', entity: 'WA_ADMIN', entityId: phone.slice(-4), details: '' } }).catch(() => {});
    res.json({ ok: true });
});
whaileysAdminRouter.delete('/admins/:phone', async (req, res) => {
    const phone = adminPhone(req.params.phone);
    if (!phone) { res.sendStatus(400); return; }
    await prisma.waAdminPhone.delete({ where: { phone } }).catch(() => null);
    await prisma.waBotSession.update({ where: { phone }, data: { step: 'MENU', data: {}, options: [] } }).catch(() => null);
    await prisma.auditLog.create({ data: { userId: req.user!.id, userName: req.user!.name, action: 'WA_ADMIN_PHONE_REMOVED', entity: 'WA_ADMIN', entityId: phone.slice(-4), details: '' } }).catch(() => {});
    res.json({ ok: true });
});
