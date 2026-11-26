import express, { Router, Request, Response } from 'express';
import { prisma } from '../services/prisma';
import { authenticate, requireAdmin } from '../middleware/auth';
import { parseIncoming, verifySignature, whaileysConnect, whaileysEnabled, whaileysLogout, whaileysStatus } from '../services/whaileys';
import { botSender, handleBotMessage, viaCep } from '../services/waBot';

/**
 * WhatsApp por botões (Whaileys): número separado da Evolution, sem IA.
 * Webhook: HMAC + janela de 5 min → dedupe por key.id (tabela) → 200 → processa.
 */
export const whaileysWebhookRouter = Router();
whaileysWebhookRouter.post('/', express.raw({ type: '*/*', limit: '30mb' }), async (req: Request, res: Response) => {
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
