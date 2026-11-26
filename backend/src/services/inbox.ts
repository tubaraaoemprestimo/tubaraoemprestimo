import { EventEmitter } from 'events';
import { inboxText } from './inboxBoundary';
import { prisma } from './prisma';

/**
 * Central WhatsApp: normaliza mensagens da Evolution (v2.3.7), grava em wa_conversations/wa_messages
 * de forma idempotente (instância + key.id), controla o modo de atendimento (IA x humano) e
 * publica eventos para o painel em tempo real (SSE).
 *
 * ponytail: barramento em memória — vale com 1 processo (PM2 fork, 1 instância, como hoje).
 * Com cluster, trocar por LISTEN/NOTIFY do PostgreSQL. O painel recupera eventos perdidos
 * pelo cursor (/inbox/changes), então nada depende só da memória.
 */

export type Origin = 'CLIENTE' | 'IA' | 'HUMANO' | 'AUTOMACAO' | 'DISPOSITIVO_EXTERNO' | 'ORIGEM_DESCONHECIDA';
export type Mode = 'AI_ACTIVE' | 'WAITING_HUMAN' | 'HUMAN_ACTIVE' | 'CLOSED';

export const inboxBus = new EventEmitter();
inboxBus.setMaxListeners(100);
export function publish(type: string, payload: any) { inboxBus.emit('event', { type, ...payload, at: new Date().toISOString() }); }

// ───────── Status de entrega (nunca regride) ─────────
const RANK: Record<string, number> = { PENDING: 1, SENT: 2, DELIVERED: 3, READ: 4 };
export function mapStatus(raw: unknown): { status: string; rank: number } | null {
    const s = String(raw ?? '').toUpperCase();
    if (s === 'PENDING' || s === '0' || s === '1') return { status: 'PENDING', rank: 1 };
    if (s === 'SERVER_ACK' || s === 'SENT' || s === '2') return { status: 'SENT', rank: 2 };
    if (s === 'DELIVERY_ACK' || s === 'DELIVERED' || s === '3') return { status: 'DELIVERED', rank: 3 };
    if (s === 'READ' || s === 'PLAYED' || s === '4' || s === '5') return { status: 'READ', rank: 4 };
    if (s === 'ERROR' || s === 'FAILED') return { status: 'FAILED', rank: 0 };
    return null;
}
/** Próximo status: só avança. Falha só vale se ainda não saiu do aparelho (rank ≤ 1). */
export function nextStatus(current: { status: string; statusRank: number }, incoming: { status: string; rank: number }) {
    if (incoming.status === 'FAILED') return current.statusRank <= 1 ? { status: 'FAILED', statusRank: current.statusRank } : null;
    if (incoming.rank > current.statusRank) return { status: incoming.status, statusRank: incoming.rank };
    return null;
}

// ───────── Normalização ─────────
export type NormalizedMessage = {
    externalId: string; remoteJid: string; phone: string | null; fromMe: boolean; pushName: string | null;
    type: string; text: string | null; mediaMime: string | null; mediaName: string | null;
    quotedExternalId: string | null; timestamp: Date; source: string | null; statusRaw: unknown;
};

export function isPrivateJid(jid: string) { return typeof jid === 'string' && /^\d{1,25}(?::\d{1,5})?@(s\.whatsapp\.net|lid)$/.test(jid); }
/** Telefone só quando o JID é número (@s.whatsapp.net). @lid não é telefone: não se converte. */
export function phoneFromJid(jid: string, alt?: string | null): string | null {
    if (jid.endsWith('@s.whatsapp.net')) return jid.split('@')[0].split(':')[0];
    if (alt && alt.endsWith('@s.whatsapp.net')) return alt.split('@')[0].split(':')[0];
    return null;
}

export function normalizeMessage(rec: any): NormalizedMessage | null {
    const key = rec?.key;
    if (!key?.id || !key?.remoteJid || !isPrivateJid(key.remoteJid)) return null;
    let m = rec.message || {};
    if (m.ephemeralMessage?.message) m = m.ephemeralMessage.message;
    if (m.documentWithCaptionMessage?.message) m = m.documentWithCaptionMessage.message;
    let type = 'other', text: string | null = null, mime: string | null = null, name: string | null = null;
    if (Object.values(m).some((part: any) => part?.viewOnce === true)) { type = 'view_once'; text = '[Mensagem de visualização única]'; }
    else if (m.conversation || m.extendedTextMessage) { type = 'text'; text = m.conversation || m.extendedTextMessage?.text || ''; }
    else if (m.imageMessage) { type = 'image'; text = m.imageMessage.caption || null; mime = m.imageMessage.mimetype || 'image/jpeg'; }
    else if (m.videoMessage) { type = 'video'; text = m.videoMessage.caption || null; mime = m.videoMessage.mimetype || 'video/mp4'; }
    else if (m.audioMessage || m.pttMessage) { type = 'audio'; mime = (m.audioMessage || m.pttMessage).mimetype || 'audio/ogg'; }
    else if (m.documentMessage) { type = 'document'; text = m.documentMessage.caption || null; mime = m.documentMessage.mimetype || 'application/octet-stream'; name = m.documentMessage.fileName || m.documentMessage.title || 'documento'; }
    else if (m.stickerMessage) { type = 'sticker'; mime = m.stickerMessage.mimetype || 'image/webp'; }
    else if (m.viewOnceMessage || m.viewOnceMessageV2 || m.viewOnceMessageV2Extension) { type = 'view_once'; text = '[Mensagem de visualização única]'; }
    else if (m.locationMessage) { type = 'other'; text = '[Localização]'; }
    else if (m.contactMessage || m.contactsArrayMessage) { type = 'other'; text = '[Contato]'; }
    else if (m.reactionMessage || m.protocolMessage || m.senderKeyDistributionMessage || m.pollUpdateMessage) return null; // não são mensagens visíveis
    else if (rec.messageType === 'conversation') { type = 'text'; text = ''; }
    else { text = `[${rec.messageType || 'Mensagem'}]`; }
    const ctx = rec.contextInfo || m.extendedTextMessage?.contextInfo || m.imageMessage?.contextInfo || m.audioMessage?.contextInfo || m.documentMessage?.contextInfo || m.videoMessage?.contextInfo;
    const ts = Number(rec.messageTimestamp?.low ?? rec.messageTimestamp ?? 0);
    return {
        externalId: String(key.id), remoteJid: String(key.remoteJid), phone: phoneFromJid(key.remoteJid, key.senderPn || key.remoteJidAlt),
        fromMe: !!key.fromMe, pushName: rec.pushName ? clip(String(rec.pushName), 120) : null, type, text: text === null ? null : clip(String(text), 8000),
        mediaMime: mime, mediaName: name ? clip(String(name), 255) : null, quotedExternalId: ctx?.stanzaId || null,
        timestamp: ts > 0 ? new Date(ts * 1000) : new Date(), source: rec.source || null, statusRaw: rec.status,
    };
}

/** Corta sem partir emoji (par surrogate) e troca surrogates soltos: o Prisma recusa string UTF-16 inválida. */
export function clip(s: string, max: number) {
    return s.slice(0, max).replace(/[\uD800-\uDBFF]$/, '').replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '�');
}

export function preview(n: { type: string; text: string | null; mediaName?: string | null }) {
    const label: Record<string, string> = { image: '📷 Foto', video: '🎬 Vídeo', audio: '🎤 Áudio', document: '📄 Documento', sticker: 'Figurinha', view_once: 'Visualização única' };
    return (n.text && n.text.trim()) ? clip(n.text, 140) : (label[n.type] || n.mediaName || 'Mensagem');
}

// ───────── Configuração da central ─────────
export type InboxSettings = { reopenMode: 'AI_ACTIVE' | 'WAITING_HUMAN'; pauseRemindersDuringHuman: boolean; handoffMessage: string };
const SETTINGS_KEY = 'inbox_settings';
export async function getInboxSettings(db: any = prisma): Promise<InboxSettings> {
    const row = await db.systemSetting.findUnique({ where: { key: SETTINGS_KEY } }).catch(() => null);
    let v: any = {}; try { v = row ? JSON.parse(row.value) : {}; } catch { /* padrão */ }
    return {
        reopenMode: v.reopenMode === 'WAITING_HUMAN' ? 'WAITING_HUMAN' : 'AI_ACTIVE',
        pauseRemindersDuringHuman: v.pauseRemindersDuringHuman === true,
        handoffMessage: typeof v.handoffMessage === 'string' && v.handoffMessage.trim() ? v.handoffMessage.slice(0, 500) : 'Certo! Encaminhei sua conversa para nossa equipe. Assim que um atendente estiver disponível, ele responde por aqui.',
    };
}
export async function saveInboxSettings(input: any, db: any = prisma) {
    const cur = await getInboxSettings(db);
    const next: InboxSettings = {
        reopenMode: input?.reopenMode === 'WAITING_HUMAN' ? 'WAITING_HUMAN' : input?.reopenMode === 'AI_ACTIVE' ? 'AI_ACTIVE' : cur.reopenMode,
        pauseRemindersDuringHuman: typeof input?.pauseRemindersDuringHuman === 'boolean' ? input.pauseRemindersDuringHuman : cur.pauseRemindersDuringHuman,
        handoffMessage: typeof input?.handoffMessage === 'string' && input.handoffMessage.trim() ? input.handoffMessage.trim().slice(0, 500) : cur.handoffMessage,
    };
    await db.systemSetting.upsert({ where: { key: SETTINGS_KEY }, update: { value: JSON.stringify(next) }, create: { key: SETTINGS_KEY, value: JSON.stringify(next) } });
    return next;
}

// ───────── Saúde ─────────
export const health = { lastWebhookAt: null as Date | null, lastConnection: null as null | { state: string; at: Date }, lastSyncAt: null as Date | null };

// ───────── Gravação idempotente ─────────
let cachedInstance: { name: string; at: number } | null = null;
export async function instanceName(db: any = prisma): Promise<string> {
    if (cachedInstance && Date.now() - cachedInstance.at < 60000) return cachedInstance.name;
    const cfg = await db.whatsappConfig.findFirst({ select: { instanceName: true } }).catch(() => null);
    cachedInstance = { name: cfg?.instanceName || 'default', at: Date.now() };
    return cachedInstance.name;
}

/**
 * Grava a mensagem (se nova) e atualiza a conversa. Retorna se foi criada agora.
 * - Mensagem importada não conta como não lida e não reabre atendimento.
 * - Origem: CLIENTE (recebida); enviada pelo celular/app sem registro nosso → DISPOSITIVO_EXTERNO
 *   (source android/ios) ou ORIGEM_DESCONHECIDA. Envio do sistema chega com a origem certa (recordOutgoing).
 */
export async function ingestMessage(n: NormalizedMessage, opts: { instance: string; imported?: boolean; origin?: Origin; senderUserId?: string | null; db?: any } ) {
    n = { ...n, text: n.text === null ? null : inboxText(n.text) };
    const db = opts.db || prisma;
    const origin: Origin = opts.origin || (!n.fromMe ? 'CLIENTE' : (n.source === 'android' || n.source === 'ios') ? 'DISPOSITIVO_EXTERNO' : 'ORIGEM_DESCONHECIDA');
    const st = mapStatus(n.statusRaw) || (n.fromMe ? { status: 'SENT', rank: 2 } : { status: 'DELIVERED', rank: 3 });
    const persisted = await db.$transaction(async (tx: any) => {
    const conv = await tx.waConversation.upsert({
        where: { instance_remoteJid: { instance: opts.instance, remoteJid: n.remoteJid } },
        create: { instance: opts.instance, remoteJid: n.remoteJid, phone: n.phone, name: !n.fromMe ? n.pushName : null },
        update: { ...(n.phone ? { phone: n.phone } : {}), ...(!n.fromMe && n.pushName ? { name: n.pushName } : {}) },
    });
    const existing = await tx.waMessage.findUnique({ where: { instance_externalId: { instance: opts.instance, externalId: n.externalId } } });
    if (existing) {
        // Duplicado (retentativa, SEND_MESSAGE + MESSAGES_UPSERT, importação): só avança status e confirma origem conhecida.
        const ns = nextStatus(existing, st);
        const better = opts.origin && ['ORIGEM_DESCONHECIDA', 'DISPOSITIVO_EXTERNO'].includes(existing.origin) ? { origin: opts.origin, senderUserId: opts.senderUserId || null } : {};
        if (ns || Object.keys(better).length) {
            const upd = await tx.waMessage.update({ where: { id: existing.id }, data: { ...(ns || {}), ...better } });
            return { created: false, conversation: conv, message: upd, changed: true }; 
        }
        return { created: false, conversation: conv, message: existing };
    }
        const msg = await tx.waMessage.create({
            data: {
                conversationId: conv.id, instance: opts.instance, externalId: n.externalId, fromMe: n.fromMe, origin, senderUserId: opts.senderUserId || null,
                type: n.type, text: n.text, mediaMime: n.mediaMime, mediaName: n.mediaName, quotedExternalId: n.quotedExternalId,
                status: st.status, statusRank: st.rank, imported: !!opts.imported, timestamp: n.timestamp,
            },
        });
    const newer = !conv.lastMessageAt || n.timestamp >= conv.lastMessageAt;
    const inbound = !n.fromMe && !opts.imported;
    const settings = inbound && conv.mode === 'CLOSED' ? await getInboxSettings(tx) : null;
    const updated = await tx.waConversation.update({
        where: { id: conv.id },
        data: {
            ...(newer ? { lastMessageAt: n.timestamp, lastMessagePreview: preview(n), lastMessageFromMe: n.fromMe } : {}),
            ...(inbound ? { unreadCount: { increment: 1 }, archived: false } : {}),
            ...(settings ? { mode: settings.reopenMode, assignedTo: null, assignedAt: null, waitingSince: settings.reopenMode === 'WAITING_HUMAN' ? new Date() : null, version: { increment: 1 } } : {}),
        },
    });
    return { created: true, conversation: updated, message: msg, changed: false };
    });
    // Não notificar o painel antes do commit. A chave única da conversa serializa as gravações do contato.
    if (persisted.created) {
        publish('conversation.updated', { conversation: persisted.conversation });
        publish('message.created', { conversationId: persisted.conversation.id, message: persisted.message });
    } else if (persisted.changed) publish('message.updated', { conversationId: persisted.conversation.id, message: persisted.message });
    return persisted;
}

/** Registra envio feito pelo sistema (IA, automação, painel) com o key.id devolvido pela Evolution. */
export async function recordOutgoing(p: { to: string; text: string; origin: Origin; response?: any; senderUserId?: string | null; type?: string; mediaMime?: string | null; mediaName?: string | null }) {
    try {
        const key = p.response?.key;
        const digits = String(p.to).replace(/\D/g, '');
        const jid = key?.remoteJid || (String(p.to).includes('@') ? String(p.to) : `${digits.length <= 11 ? '55' + digits : digits}@s.whatsapp.net`);
        if (!isPrivateJid(jid)) return;
        const externalId = key?.id || `sys:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;
        await ingestMessage({
            externalId, remoteJid: jid, phone: phoneFromJid(jid), fromMe: true, pushName: null, type: p.type || 'text', text: p.text == null ? null : clip(p.text, 8000),
            mediaMime: p.mediaMime || null, mediaName: p.mediaName || null, quotedExternalId: null,
            timestamp: new Date(), source: 'api', statusRaw: p.response?.status || 'PENDING',
        }, { instance: await instanceName(), origin: p.origin, senderUserId: p.senderUserId || null });
    } catch (e: any) {
        console.error('[Inbox] falha ao registrar envio:', e?.message);
    }
}

/** IA só responde em conversa no modo IA. Relido do banco na hora (vale o "assumir" feito durante o processamento). */
export async function aiAllowed(remoteJidOrPhone: string, db: any = prisma): Promise<boolean> {
    const jid = remoteJidOrPhone.includes('@') ? remoteJidOrPhone : `${remoteJidOrPhone}@s.whatsapp.net`;
    const instance = await instanceName(db);
    const conv = await db.waConversation.findUnique({ where: { instance_remoteJid: { instance, remoteJid: jid } }, select: { mode: true } });
    return conv?.mode === 'AI_ACTIVE';
}

/** Atualização de status (MESSAGES_UPDATE / SEND_MESSAGE_UPDATE). */
export async function applyStatusUpdate(data: any, instance: string, db: any = prisma) {
    const items = Array.isArray(data) ? data : [data];
    for (const d of items) {
        const id = d?.keyId || d?.key?.id;
        const st = mapStatus(d?.status ?? d?.update?.status);
        if (!id || !st) continue;
        const msg = await db.waMessage.findUnique({ where: { instance_externalId: { instance, externalId: String(id) } } });
        if (!msg) continue; // status antes da mensagem: a importação/sincronização corrige depois
        const ns = nextStatus(msg, st);
        if (!ns) continue;
        const upd = await db.waMessage.update({ where: { id: msg.id }, data: ns });
        publish('message.status', { conversationId: msg.conversationId, message: upd });
    }
}

/**
 * Entrada única do webhook da Evolution para a central. Retorna o que a IA precisa saber
 * (mensagem nova? recente?) para não responder a duplicados nem a histórico antigo.
 */
export async function handleWebhookEvent(body: any, instance: string): Promise<{ created: boolean; stale: boolean; conversationId?: string } | null> {
    health.lastWebhookAt = new Date();
    const event = String(body?.event || body?.type || '').toLowerCase().replace(/_/g, '.');
    const data = body?.data ?? body;
    if (event === 'connection.update') {
        health.lastConnection = { state: String(data?.state || 'unknown'), at: new Date() };
        publish('instance.connection', { state: health.lastConnection.state });
        return null;
    }
    if (event === 'messages.update' || event === 'send.message.update') { await applyStatusUpdate(data, instance); return null; }
    if (event !== 'messages.upsert' && event !== 'send.message' && event !== 'message') return null;
    let last: any = null;
    for (const rec of Array.isArray(data) ? data : [data]) {
        const n = normalizeMessage(rec);
        if (!n) continue;
        const r = await ingestMessage(n, { instance });
        last = { created: r.created, stale: Date.now() - n.timestamp.getTime() > 10 * 60 * 1000, conversationId: r.conversation.id };
    }
    return last;
}
