import { Router, Request, Response } from 'express';
import axios from 'axios';
import { randomUUID } from 'crypto';
import { prisma } from '../services/prisma';
import { authenticate, requireAdmin } from '../middleware/auth';
import { inboxBus, publish, ingestMessage, normalizeMessage, getInboxSettings, saveInboxSettings, instanceName, health, preview, phoneFromJid } from '../services/inbox';
import { assume, transfer, release, returnToAI, close, reopen, HandoffConflict } from '../services/inboxHandoff';
import { whatsappAllowed } from '../services/collectionRules';

/**
 * Central WhatsApp (admin). Toda conversa com a Evolution passa por aqui (a chave nunca vai ao navegador).
 * Tempo real: SSE autenticado (/inbox/stream) + cursor (/inbox/changes) para recuperar o que se perdeu.
 */
export const inboxRouter = Router();
inboxRouter.use(authenticate, requireAdmin);

const MAX_MEDIA = 16 * 1024 * 1024;
const ALLOWED_MIME = /^(image\/(jpeg|png|webp|gif)|video\/(mp4|3gpp|quicktime)|audio\/(ogg|mpeg|mp4|aac|webm|wav|x-m4a)|application\/(pdf|msword|vnd\.openxmlformats-officedocument\.[a-z.]+|vnd\.ms-excel|zip)|text\/plain)(;.*)?$/i;
const actor = (req: Request) => ({ id: req.user!.id, name: req.user!.name });
const str = (v: unknown, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

async function evo() {
    const c = await prisma.whatsappConfig.findFirst();
    if (!c?.apiUrl || !c.apiKey || !c.instanceName) throw new Error('WhatsApp (Evolution) não configurado');
    return { base: c.apiUrl.replace(/\/+$/, ''), key: c.apiKey, instance: c.instanceName, connected: c.isConnected };
}

function handle(res: Response, e: any) {
    if (e instanceof HandoffConflict) { res.status(409).json({ error: e.message }); return; }
    console.error('[Inbox]', e?.message);
    res.status(500).json({ error: 'Erro na central de atendimento' });
}

// Autorização por objeto para todos os subrecursos, leituras e mudanças de atendimento.
inboxRouter.param('id', async (req, res, next, id) => {
    try {
        const path = req.path.split('/')[1];
        if (path !== 'messages' && path !== 'conversations') return next();
        const scope = { id, instance: await instanceName() };
        const exists = path === 'messages' ? await prisma.waMessage.count({ where: scope }) : await prisma.waConversation.count({ where: scope });
        if (!exists) { res.sendStatus(404); return; }
        next();
    } catch { res.sendStatus(503); }
});

// ───────── Lista de conversas ─────────
inboxRouter.get('/conversations', async (req, res) => {
    const filter = String(req.query.filter || 'all');
    const q = str(req.query.q, 80);
    const take = Math.min(60, Math.max(10, Number(req.query.limit || 40)));
    const cursor = req.query.before ? new Date(String(req.query.before)) : null;
    const where: any = { instance: await instanceName(), AND: [] as any[] };
    const map: Record<string, any> = {
        all: { archived: false }, unread: { unreadCount: { gt: 0 } }, waiting: { mode: 'WAITING_HUMAN' }, ai: { mode: 'AI_ACTIVE', archived: false },
        human: { mode: 'HUMAN_ACTIVE' }, mine: { mode: 'HUMAN_ACTIVE', assignedTo: req.user!.id }, unassigned: { mode: { in: ['WAITING_HUMAN', 'HUMAN_ACTIVE'] }, assignedTo: null },
        closed: { mode: 'CLOSED' }, archived: { archived: true },
    };
    where.AND.push(map[filter] || map.all, { lastMessageAt: { not: null } });
    if (cursor && !Number.isNaN(cursor.getTime())) where.AND.push({ lastMessageAt: { lt: cursor } });
    if (q) {
        const digits = q.replace(/\D/g, '');
        // Busca por nome/telefone/última mensagem; conteúdo completo: só conversas com mensagem que contém o termo (limitado).
        const byContent = q.length >= 3 ? (await prisma.waMessage.findMany({ where: { instance: await instanceName(), text: { contains: q, mode: 'insensitive' } }, select: { conversationId: true }, distinct: ['conversationId'], take: 50, orderBy: { timestamp: 'desc' } })).map(m => m.conversationId) : [];
        where.AND.push({ OR: [{ name: { contains: q, mode: 'insensitive' } }, ...(digits.length >= 3 ? [{ phone: { contains: digits } }] : []), { lastMessagePreview: { contains: q, mode: 'insensitive' } }, ...(byContent.length ? [{ id: { in: byContent } }] : [])] });
    }
    const items = await prisma.waConversation.findMany({ where, orderBy: { lastMessageAt: 'desc' }, take });
    res.json({ items: await decorate(items), nextBefore: items.length === take ? items[items.length - 1].lastMessageAt : null });
});

/** Acrescenta cliente vinculado (por vínculo confirmado ou telefone igual — só para exibir, não vincula). */
async function decorate(items: any[]) {
    const phones = items.map(i => i.phone).filter(Boolean) as string[];
    const ops = [...new Set(items.map(i => i.assignedTo).filter(Boolean))] as string[];
    const [customers, users] = await Promise.all([
        phones.length || items.some(i => i.customerId) ? prisma.customer.findMany({
            where: { OR: [{ id: { in: items.map(i => i.customerId).filter(Boolean) as string[] } }, ...phones.flatMap(p => [{ phone: p }, { phone: p.slice(2) }])] },
            select: { id: true, name: true, phone: true, isLegacy: true, userId: true },
        }) : [],
        ops.length ? prisma.user.findMany({ where: { id: { in: ops } }, select: { id: true, name: true } }) : [],
    ]);
    const digits = (s: string) => { let d = s.replace(/\D/g, ''); if (d.length === 10 || d.length === 11) d = '55' + d; return d; };
    return items.map(i => {
        const linked = i.customerId ? customers.find(c => c.id === i.customerId) : null;
        const byPhone = !linked && i.phone ? customers.filter(c => digits(c.phone || '') === i.phone) : [];
        return {
            ...i, operatorName: users.find(u => u.id === i.assignedTo)?.name || null,
            customer: linked ? { id: linked.id, name: linked.name, isLegacy: linked.isLegacy, hasAccount: !!linked.userId, confirmed: true }
                : byPhone.length === 1 ? { id: byPhone[0].id, name: byPhone[0].name, isLegacy: byPhone[0].isLegacy, hasAccount: !!byPhone[0].userId, confirmed: false } : null,
            phoneMatches: byPhone.length,
        };
    });
}

inboxRouter.get('/conversations/:id', async (req, res) => {
    const c = await prisma.waConversation.findUnique({ where: { id: String(req.params.id) } });
    if (!c) { res.status(404).json({ error: 'Conversa não encontrada' }); return; }
    res.json({ conversation: (await decorate([c]))[0] });
});

// ───────── Mensagens ─────────
inboxRouter.get('/conversations/:id/messages', async (req, res) => {
    const take = Math.min(100, Math.max(10, Number(req.query.limit || 50)));
    const before = req.query.before ? new Date(String(req.query.before)) : null;
    const items = await prisma.waMessage.findMany({
        where: { conversationId: String(req.params.id), ...(before && !Number.isNaN(before.getTime()) ? { timestamp: { lt: before } } : {}) },
        orderBy: { timestamp: 'desc' }, take,
    });
    const senders = [...new Set(items.map(m => m.senderUserId).filter(Boolean))] as string[];
    const users = senders.length ? await prisma.user.findMany({ where: { id: { in: senders } }, select: { id: true, name: true } }) : [];
    res.json({ items: items.reverse().map(m => ({ ...m, senderName: users.find(u => u.id === m.senderUserId)?.name || null })), hasMore: items.length === take });
});

/** Operador abriu a conversa: zera não lidas (leitura interna; não manda confirmação de leitura ao WhatsApp). */
inboxRouter.post('/conversations/:id/read', async (req, res) => {
    const c = await prisma.waConversation.update({ where: { id: String(req.params.id) }, data: { unreadCount: 0 } }).catch(() => null);
    if (!c) { res.status(404).json({ error: 'Conversa não encontrada' }); return; }
    publish('conversation.read', { conversationId: c.id });
    res.json({ ok: true });
});

// ───────── Envio pelo painel ─────────
/**
 * Texto ou mídia. Idempotente por clientRequestId (clique duplo/rede ruim não duplica).
 * Só sai se a conversa estiver com este operador (ou ele assumir junto) e o titular permitir WhatsApp.
 */
inboxRouter.post('/conversations/:id/send', async (req, res) => {
    const clientRequestId = str(req.body?.clientRequestId, 80);
    if (!clientRequestId) { res.status(400).json({ error: 'clientRequestId obrigatório' }); return; }
    const dup = await prisma.waMessage.findFirst({ where: { instance: await instanceName(), clientRequestId, conversationId: String(req.params.id), senderUserId: req.user!.id } });
    if (dup) { res.json({ message: dup, duplicate: true }); return; }
    const conv = await prisma.waConversation.findUnique({ where: { id: String(req.params.id) } });
    if (!conv) { res.status(404).json({ error: 'Conversa não encontrada' }); return; }
    if (conv.mode === 'HUMAN_ACTIVE' && conv.assignedTo && conv.assignedTo !== req.user!.id) { res.status(409).json({ error: 'Outro operador está atendendo esta conversa. Peça a transferência.' }); return; }
    const text = typeof req.body?.text === 'string' ? req.body.text.slice(0, 4000) : '';
    const media = req.body?.media as undefined | { base64: string; mimetype: string; fileName?: string; kind: 'image' | 'video' | 'audio' | 'document' };
    if (!text.trim() && !media) { res.status(400).json({ error: 'Mensagem vazia' }); return; }
    if (media) {
        if (!ALLOWED_MIME.test(String(media.mimetype || ''))) { res.status(400).json({ error: 'Tipo de arquivo não permitido' }); return; }
        if (typeof media.base64 !== 'string' || Math.floor(media.base64.length * 3 / 4) > MAX_MEDIA) { res.status(413).json({ error: 'Arquivo acima de 16 MB' }); return; }
        if (!['image', 'video', 'audio', 'document'].includes(media.kind)) { res.status(400).json({ error: 'Tipo de mídia inválido' }); return; }
    }
    if (conv.customerId) {
        const cust = await prisma.customer.findUnique({ where: { id: conv.customerId } });
        if (cust && !whatsappAllowed({ ...cust, phone: cust.phone || conv.phone })) { res.status(409).json({ error: 'O cliente pediu para não receber WhatsApp ou está com comunicação suspensa (Preferências de comunicação).' }); return; }
    }
    // Responder já assume o atendimento (a IA para nesta conversa antes do envio).
    if (conv.mode !== 'HUMAN_ACTIVE' || !conv.assignedTo) { try { await assume(conv.id, actor(req)); } catch (e) { handle(res, e); return; } }

    const quoted = str(req.body?.quotedExternalId, 120) || null;
    const type = media ? media.kind : 'text';
    const pending = await prisma.waMessage.create({
        data: { conversationId: conv.id, instance: conv.instance, externalId: `local:${clientRequestId}`, fromMe: true, origin: 'HUMANO', senderUserId: req.user!.id, type,
            text: media ? (text || null) : text, mediaMime: media?.mimetype || null, mediaName: media?.fileName || null, quotedExternalId: quoted,
            status: 'PENDING', statusRank: 1, clientRequestId, timestamp: new Date() },
    });
    publish('message.created', { conversationId: conv.id, message: pending });
    let e: Awaited<ReturnType<typeof evo>>;
    try { e = await evo(); } catch (err: any) { await fail(pending.id, conv.id, err.message); res.status(503).json({ error: err.message }); return; }
    const number = conv.phone || conv.remoteJid;
    const quotedPayload = quoted ? { quoted: { key: { id: quoted, remoteJid: conv.remoteJid } } } : {};
    try {
        let resp;
        if (!media) resp = await axios.post(`${e.base}/message/sendText/${e.instance}`, { number, text, ...quotedPayload }, { headers: { apikey: e.key }, timeout: 20000 });
        else if (media.kind === 'audio') resp = await axios.post(`${e.base}/message/sendWhatsAppAudio/${e.instance}`, { number, audio: media.base64, ...quotedPayload }, { headers: { apikey: e.key }, timeout: 60000 });
        else resp = await axios.post(`${e.base}/message/sendMedia/${e.instance}`, { number, mediatype: media.kind, mimetype: media.mimetype, media: media.base64, fileName: media.fileName || undefined, caption: text || undefined, ...quotedPayload }, { headers: { apikey: e.key }, timeout: 60000 });
        const key = resp.data?.key;
        const data: any = { status: 'SENT', statusRank: 2, ...(key?.id ? { externalId: String(key.id) } : {}) };
        // O webhook (SEND_MESSAGE/MESSAGES_UPSERT) pode ter gravado o mesmo id antes: junta numa só.
        const mergeEcho = async () => {
            const echoed = await prisma.waMessage.findUnique({ where: { instance_externalId: { instance: conv.instance, externalId: String(key.id) } } });
            if (!echoed || echoed.id === pending.id) return null;
            await prisma.waMessage.delete({ where: { id: pending.id } });
            const merged = await prisma.waMessage.update({ where: { id: echoed.id }, data: { origin: 'HUMANO', senderUserId: req.user!.id, clientRequestId, ...(echoed.statusRank < 2 ? { status: 'SENT', statusRank: 2 } : {}) } });
            publish('message.updated', { conversationId: conv.id, message: merged, replaces: pending.id });
            return merged;
        };
        if (key?.id) { const merged = await mergeEcho(); if (merged) { res.json({ message: merged }); return; } }
        let sent;
        try { sent = await prisma.waMessage.update({ where: { id: pending.id }, data }); }
        catch (err2: any) {
            if (err2?.code !== 'P2002' || !key?.id) throw err2;
            const merged = await mergeEcho(); res.json({ message: merged }); return;
        }
        await prisma.waConversation.update({ where: { id: conv.id }, data: { lastMessageAt: sent.timestamp, lastMessagePreview: preview(sent), lastMessageFromMe: true } });
        publish('message.updated', { conversationId: conv.id, message: sent });
        await prisma.auditLog.create({ data: { userId: req.user!.id, userName: req.user!.name, action: 'WA_MESSAGE_SENT', entity: 'WA_CONVERSATION', entityId: conv.id, details: JSON.stringify({ type, messageId: sent.id }) } }).catch(() => {});
        res.json({ message: sent });
    } catch (err: any) {
        const ambiguous = !err?.response; // timeout/rede: pode ter saído. Não marca falha; status fica desconhecido até o webhook confirmar.
        const msg = ambiguous ? 'Sem resposta do WhatsApp (pode ter sido enviada). Aguarde a confirmação antes de reenviar.' : (err.response?.data?.response?.message?.[0]?.exists === false ? 'Número sem WhatsApp' : 'O WhatsApp recusou o envio');
        if (ambiguous) {
            const u = await prisma.waMessage.update({ where: { id: pending.id }, data: { status: 'UNKNOWN', error: msg } });
            publish('message.updated', { conversationId: conv.id, message: u });
            res.status(202).json({ message: u, warning: msg });
        } else { await fail(pending.id, conv.id, msg); res.status(502).json({ error: msg }); }
    }
});

async function fail(id: string, conversationId: string, error: string) {
    const u = await prisma.waMessage.update({ where: { id }, data: { status: 'FAILED', statusRank: 0, error } });
    publish('message.updated', { conversationId, message: u });
    publish('notify.send_failed', { conversationId, error });
}

// ───────── Mídia sob demanda (proxy autenticado; nada de base64 no banco) ─────────
inboxRouter.get('/messages/:id/media', async (req, res) => {
    const m = await prisma.waMessage.findUnique({ where: { id: String(req.params.id) }, include: { conversation: { select: { remoteJid: true } } } });
    if (!m || !m.mediaMime || m.externalId.startsWith('local:') || m.externalId.startsWith('sys:')) { res.status(404).json({ error: 'Mídia indisponível' }); return; }
    if (m.type === 'view_once') { res.status(403).json({ error: 'Mensagem de visualização única' }); return; }
    try {
        const e = await evo();
        const r = await axios.post(`${e.base}/chat/getBase64FromMediaMessage/${e.instance}`, { message: { key: { id: m.externalId, remoteJid: m.conversation.remoteJid, fromMe: m.fromMe } }, convertToMp4: m.type === 'video' }, { headers: { apikey: e.key }, timeout: 45000, maxContentLength: Math.ceil(MAX_MEDIA * 1.5) });
        const b64 = r.data?.base64;
        if (!b64) { res.status(404).json({ error: 'Mídia não está mais disponível no WhatsApp' }); return; }
        if (typeof b64 !== 'string' || b64.length > Math.ceil(MAX_MEDIA / 3) * 4) { res.sendStatus(413); return; }
        const buf = Buffer.from(b64, 'base64');
        const mime = String(r.data?.mimetype || m.mediaMime).split(';')[0];
        if (!ALLOWED_MIME.test(mime)) { res.sendStatus(415); return; }
        res.setHeader('Content-Type', mime);
        res.setHeader('Cache-Control', 'private, no-store');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Content-Disposition', `${m.type === 'document' ? 'attachment' : 'inline'}; filename="${encodeURIComponent(m.mediaName || 'arquivo')}"`);
        res.end(buf);
    } catch { res.status(502).json({ error: 'Não foi possível baixar a mídia' }); }
});

// ───────── Atendimento (handoff) ─────────
const ver = (req: Request) => (typeof req.body?.version === 'number' ? req.body.version : undefined);
inboxRouter.post('/conversations/:id/assume', async (req, res) => { try { res.json({ conversation: await assume(String(req.params.id), actor(req), ver(req)) }); } catch (e) { handle(res, e); } });
inboxRouter.post('/conversations/:id/release', async (req, res) => { try { res.json({ conversation: await release(String(req.params.id), actor(req), ver(req)) }); } catch (e) { handle(res, e); } });
inboxRouter.post('/conversations/:id/return-ai', async (req, res) => { try { res.json({ conversation: await returnToAI(String(req.params.id), actor(req), ver(req)) }); } catch (e) { handle(res, e); } });
inboxRouter.post('/conversations/:id/close', async (req, res) => { try { res.json({ conversation: await close(String(req.params.id), actor(req), ver(req), req.body?.archive !== false) }); } catch (e) { handle(res, e); } });
inboxRouter.post('/conversations/:id/reopen', async (req, res) => { try { res.json({ conversation: await reopen(String(req.params.id), actor(req), ver(req)) }); } catch (e) { handle(res, e); } });
inboxRouter.post('/conversations/:id/transfer', async (req, res) => { try { res.json({ conversation: await transfer(String(req.params.id), actor(req), str(req.body?.toUserId, 60), ver(req)) }); } catch (e) { handle(res, e); } });
inboxRouter.get('/operators', async (_req, res) => { res.json({ items: await prisma.user.findMany({ where: { role: 'ADMIN' }, select: { id: true, name: true }, orderBy: { name: 'asc' } }) }); });

/** Vincula conversa a cliente após conferência do operador (nunca automático). */
inboxRouter.post('/conversations/:id/link', async (req, res) => {
    const customerId = req.body?.customerId === null ? null : str(req.body?.customerId, 60);
    if (customerId && !await prisma.customer.count({ where: { id: customerId } })) { res.status(404).json({ error: 'Cliente não encontrado' }); return; }
    const c = await prisma.waConversation.update({ where: { id: String(req.params.id) }, data: { customerId } }).catch(() => null);
    if (!c) { res.status(404).json({ error: 'Conversa não encontrada' }); return; }
    await prisma.auditLog.create({ data: { userId: req.user!.id, userName: req.user!.name, action: customerId ? 'WA_LINK_CUSTOMER' : 'WA_UNLINK_CUSTOMER', entity: 'WA_CONVERSATION', entityId: c.id, details: JSON.stringify({ customerId }) } }).catch(() => {});
    publish('conversation.updated', { conversation: c });
    res.json({ conversation: (await decorate([c]))[0] });
});

/** Ficha resumida do contato (Central 360°): só leitura, reaproveita os dados existentes. */
inboxRouter.get('/conversations/:id/contact', async (req, res) => {
    const conv = await prisma.waConversation.findUnique({ where: { id: String(req.params.id) } });
    if (!conv) { res.status(404).json({ error: 'Conversa não encontrada' }); return; }
    const [d] = await decorate([conv]);
    if (!conv.customerId || !d.customer?.confirmed) { res.json({ conversation: d, customer: null }); return; }
    const c = await prisma.customer.findUnique({
        where: { id: d.customer.id },
        select: { id: true, name: true, phone: true, status: true, isLegacy: true, activationStatus: true, userId: true, whatsappOptOut: true, inviteOptOut: true, promoOptOut: true, phoneConfirmed: true, commSuspendedReason: true, commSuspendedUntil: true,
            loans: { select: { id: true, status: true, remainingAmount: true, nextPaymentDate: true, isLegacy: true, loanRequest: { select: { profileType: true } }, installments: { where: { status: { in: ['OPEN', 'LATE', 'AWAITING_CONFIRMATION'] } }, orderBy: { dueDate: 'asc' }, take: 3, select: { id: true, dueDate: true, amount: true, status: true } } }, orderBy: { createdAt: 'desc' } },
            disputes: { where: { status: { in: ['OPEN', 'IN_REVIEW', 'WAITING_DOCS'] } }, select: { id: true, reason: true, status: true } },
        },
    });
    const pendingReceipts = c ? await prisma.paymentReceipt.count({ where: { customerId: c.id, status: 'PENDING' } }) : 0;
    const history = await prisma.auditLog.findMany({ where: { entity: 'WA_CONVERSATION', entityId: conv.id }, orderBy: { timestamp: 'desc' }, take: 15, select: { action: true, userName: true, timestamp: true } });
    res.json({ conversation: d, customer: c, pendingReceipts, history });
});

// ───────── Tempo real (SSE autenticado) + cursor ─────────
inboxRouter.get('/stream', (req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
    res.write(`retry: 5000\nevent: hello\ndata: ${JSON.stringify({ at: new Date().toISOString() })}\n\n`);
    const onEvent = (ev: any) => { res.write(`event: ${ev.type}\ndata: ${JSON.stringify(ev)}\n\n`); };
    inboxBus.on('event', onEvent);
    const beat = setInterval(() => res.write(`: ping ${Date.now()}\n\n`), 20000);
    req.on('close', () => { clearInterval(beat); inboxBus.off('event', onEvent); });
});

/** O que mudou desde o cursor (reconexão/ fallback de polling a cada 30–60s). */
inboxRouter.get('/changes', async (req, res) => {
    const since = new Date(String(req.query.since || 0));
    const from = Number.isNaN(since.getTime()) ? new Date(Date.now() - 5 * 60000) : since;
    const instance = await instanceName();
    const upper = new Date();
    const [convs, msgs] = await Promise.all([
        prisma.waConversation.findMany({ where: { instance, updatedAt: { gt: from, lte: upper } }, orderBy: { updatedAt: 'asc' }, take: 200 }),
        prisma.waMessage.findMany({ where: { instance, updatedAt: { gt: from, lte: upper } }, orderBy: { updatedAt: 'asc' }, take: 300 }),
    ]);
    res.json({ conversations: await decorate(convs), messages: msgs, cursor: upper.toISOString(), truncated: convs.length === 200 || msgs.length === 300 });
});

// ───────── Painel, saúde e configurações ─────────
inboxRouter.get('/dashboard', async (req, res) => {
    const from = req.query.from ? new Date(String(req.query.from)) : new Date(new Date().setHours(0, 0, 0, 0));
    const op = str(req.query.operator, 60) || undefined;
    const [byMode, unread, received, sent, failed, perOp, firstReplies] = await Promise.all([
        prisma.waConversation.groupBy({ by: ['mode'], _count: true }),
        prisma.waConversation.count({ where: { unreadCount: { gt: 0 } } }),
        prisma.waMessage.count({ where: { fromMe: false, imported: false, timestamp: { gte: from } } }),
        prisma.waMessage.count({ where: { fromMe: true, imported: false, timestamp: { gte: from }, ...(op ? { senderUserId: op } : {}) } }),
        prisma.waMessage.count({ where: { status: 'FAILED', timestamp: { gte: from } } }),
        prisma.waMessage.groupBy({ by: ['senderUserId'], where: { origin: 'HUMANO', timestamp: { gte: from }, senderUserId: { not: null } }, _count: true }),
        prisma.$queryRaw<{ avg_first: number | null; avg_wait: number | null }[]>`
            WITH firsts AS (
              SELECT c.id,
                (SELECT min(m.timestamp) FROM wa_messages m WHERE m.conversation_id = c.id AND m.from_me = false AND m.imported = false AND m.timestamp >= ${from}) AS first_in
              FROM wa_conversations c)
            SELECT avg(extract(epoch FROM (r.first_out - f.first_in)))::float AS avg_first, NULL::float AS avg_wait
            FROM firsts f
            JOIN LATERAL (SELECT min(m.timestamp) AS first_out FROM wa_messages m WHERE m.conversation_id = f.id AND m.from_me = true AND m.origin = 'HUMANO' AND m.timestamp > f.first_in) r ON true
            WHERE f.first_in IS NOT NULL AND r.first_out IS NOT NULL`,
    ]);
    const waitingNow = await prisma.waConversation.findMany({ where: { mode: 'WAITING_HUMAN', waitingSince: { not: null } }, select: { waitingSince: true } });
    const names = await prisma.user.findMany({ where: { id: { in: perOp.map(p => p.senderUserId!) } }, select: { id: true, name: true } });
    const count = (m: string) => byMode.find(b => b.mode === m)?._count || 0;
    res.json({
        total: byMode.reduce((a, b) => a + b._count, 0), unread, waiting: count('WAITING_HUMAN'), ai: count('AI_ACTIVE'), human: count('HUMAN_ACTIVE'), closed: count('CLOSED'),
        receivedToday: received, sentToday: sent, failed,
        avgFirstResponseSec: firstReplies[0]?.avg_first ? Math.round(firstReplies[0].avg_first) : null,
        avgWaitingSec: waitingNow.length ? Math.round(waitingNow.reduce((a, w) => a + (Date.now() - w.waitingSince!.getTime()) / 1000, 0) / waitingNow.length) : null,
        perOperator: perOp.map(p => ({ name: names.find(n => n.id === p.senderUserId)?.name || '—', messages: p._count })),
    });
});

inboxRouter.get('/health', async (_req, res) => {
    let state = 'unknown';
    try { const e = await evo(); const r = await axios.get(`${e.base}/instance/connectionState/${e.instance}`, { headers: { apikey: e.key }, timeout: 8000 }); state = r.data?.instance?.state || r.data?.state || 'unknown'; }
    catch { state = 'unreachable'; }
    const lastIn = await prisma.waMessage.findFirst({ where: { fromMe: false, imported: false }, orderBy: { timestamp: 'desc' }, select: { timestamp: true } });
    const lastOut = await prisma.waMessage.findFirst({ where: { fromMe: true, imported: false }, orderBy: { timestamp: 'desc' }, select: { timestamp: true } });
    const imp = await prisma.systemSetting.findUnique({ where: { key: 'inbox_import' } }).catch(() => null);
    res.json({ state, lastWebhookAt: health.lastWebhookAt, lastConnectionEvent: health.lastConnection, lastInboundAt: lastIn?.timestamp || null, lastOutboundAt: lastOut?.timestamp || null, import: imp ? JSON.parse(imp.value) : null, realtimeClients: inboxBus.listenerCount('event') });
});

inboxRouter.get('/settings', async (_req, res) => { res.json({ settings: await getInboxSettings() }); });
inboxRouter.put('/settings', async (req, res) => {
    const before = await getInboxSettings(); const after = await saveInboxSettings(req.body);
    await prisma.auditLog.create({ data: { userId: req.user!.id, userName: req.user!.name, action: 'INBOX_SETTINGS_UPDATED', entity: 'SETTINGS', entityId: 'inbox_settings', details: JSON.stringify({ before, after }) } }).catch(() => {});
    res.json({ settings: after });
});

// ───────── Respostas rápidas ─────────
inboxRouter.get('/quick-replies', async (req, res) => {
    const q = str(req.query.q, 60);
    res.json({ items: await prisma.waQuickReply.findMany({ where: { ...(req.query.all ? {} : { active: true }), ...(q ? { OR: [{ title: { contains: q, mode: 'insensitive' } }, { body: { contains: q, mode: 'insensitive' } }] } : {}) }, orderBy: { title: 'asc' } }) });
});
const VARS = ['{nome}', '{primeiro_nome}', '{app}'];
function checkVars(body: string) { const used = body.match(/\{[a-z_]+\}/g) || []; const bad = used.filter(v => !VARS.includes(v)); return bad.length ? `Variável não permitida: ${bad.join(', ')} (use ${VARS.join(', ')})` : null; }
inboxRouter.post('/quick-replies', async (req, res) => {
    const title = str(req.body?.title, 60), body = typeof req.body?.body === 'string' ? req.body.body.trim().slice(0, 2000) : '';
    if (!title || !body) { res.status(400).json({ error: 'Título e texto obrigatórios' }); return; }
    const err = checkVars(body); if (err) { res.status(400).json({ error: err }); return; }
    res.status(201).json({ item: await prisma.waQuickReply.create({ data: { title, body, createdBy: req.user!.id } }) });
});
inboxRouter.put('/quick-replies/:id', async (req, res) => {
    const data: any = {};
    if (typeof req.body?.title === 'string') data.title = str(req.body.title, 60);
    if (typeof req.body?.body === 'string') { data.body = req.body.body.trim().slice(0, 2000); const err = checkVars(data.body); if (err) { res.status(400).json({ error: err }); return; } }
    if (typeof req.body?.active === 'boolean') data.active = req.body.active;
    const item = await prisma.waQuickReply.update({ where: { id: String(req.params.id) }, data }).catch(() => null);
    if (!item) { res.status(404).json({ error: 'Resposta não encontrada' }); return; }
    res.json({ item });
});

// ───────── Importação do histórico (só leitura da Evolution; nunca aciona IA) ─────────
let importRunning = false;
inboxRouter.post('/import', async (req, res) => {
    if (importRunning) { res.status(409).json({ error: 'Sincronização já em andamento' }); return; }
    const days = Math.min(365, Math.max(1, Number(req.body?.days || 30)));
    importRunning = true;
    res.status(202).json({ started: true, days });
    runImport(days, req.user!.name).finally(() => { importRunning = false; });
});

async function saveProgress(p: any) {
    await prisma.systemSetting.upsert({ where: { key: 'inbox_import' }, update: { value: JSON.stringify(p) }, create: { key: 'inbox_import', value: JSON.stringify(p) } }).catch(() => {});
    publish('import.progress', p);
}

/**
 * Lê mensagens da Evolution página a página (mais recentes primeiro) até a data-limite.
 * Grava com imported=true (não conta como não lida, não reabre atendimento, não aciona IA).
 * Limitações: só o que a Evolution guardou (mensagens anteriores à conexão/instância não existem lá).
 */
export async function runImport(days: number, by: string, deps: { http?: any; db?: any } = {}) {
    const http = deps.http || axios; const db = deps.db || prisma;
    const since = Date.now() - days * 86400000;
    const p: any = { status: 'RUNNING', days, by, startedAt: new Date().toISOString(), pages: 0, scanned: 0, imported: 0, skipped: 0, contacts: 0 };
    try {
        const e = await evo();
        await saveProgress(p);
        // nomes/fotos das conversas (lista de chats: 1 chamada)
        const chats = (await http.post(`${e.base}/chat/findChats/${e.instance}`, {}, { headers: { apikey: e.key }, timeout: 60000 })).data;
        const chatInfo = new Map<string, any>((Array.isArray(chats) ? chats : []).map((c: any) => [c.remoteJid, c]));
        let page = 1, stop = false;
        while (!stop && page <= 400) {
            const r = (await http.post(`${e.base}/chat/findMessages/${e.instance}`, { where: {}, page, offset: 100 }, { headers: { apikey: e.key }, timeout: 60000 })).data;
            const recs = r?.messages?.records || [];
            if (!recs.length) break;
            for (const rec of recs) {
                p.scanned++;
                const ts = Number(rec.messageTimestamp || 0) * 1000;
                if (ts && ts < since) { stop = true; continue; }
                const n = normalizeMessage(rec);
                if (!n) { p.skipped++; continue; }
                const out = await ingestMessage(n, { instance: e.instance, imported: true, db });
                if (out.created) p.imported++; else p.skipped++;
                const info = chatInfo.get(n.remoteJid);
                if (out.created && info && (info.pushName || info.profilePicUrl) && (!out.conversation.name || !out.conversation.profilePicUrl)) {
                    await db.waConversation.update({ where: { id: out.conversation.id }, data: { name: out.conversation.name || info.pushName || null, profilePicUrl: info.profilePicUrl || out.conversation.profilePicUrl } }).catch(() => {});
                }
            }
            p.pages = page; page++;
            if (page > Number(r?.messages?.pages || 0)) break;
            if (page % 5 === 0) await saveProgress(p);
            await new Promise(r2 => setTimeout(r2, 150)); // não sobrecarrega Evolution/VM
        }
        p.status = 'DONE'; p.finishedAt = new Date().toISOString();
        health.lastSyncAt = new Date();
    } catch (err: any) {
        p.status = 'ERROR'; p.error = err?.message?.slice(0, 200); p.finishedAt = new Date().toISOString();
    }
    await saveProgress(p);
    return p;
}

export { phoneFromJid };
