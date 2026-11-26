import axios from 'axios';
import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Cliente do motor Whaileys (WhatsApp com botões). Independente da Evolution: número próprio, sem IA.
 * Variáveis só no servidor: WHAILEYS_API_URL, WHAILEYS_INSTANCE, WHAILEYS_TOKEN, WHAILEYS_WEBHOOK_SECRET.
 */
export const whaileysEnabled = () => Boolean(process.env.WHAILEYS_API_URL && process.env.WHAILEYS_INSTANCE && process.env.WHAILEYS_TOKEN && process.env.WHAILEYS_WEBHOOK_SECRET);

export type Button = { id: string; title: string };
export type Row = { id: string; title: string; description?: string };
export type Card = { text: string; buttons?: Button[]; sections?: { title: string; rows: Row[] }[]; buttonText?: string };
export type WhaileysStatus = { state: 'open' | 'connecting' | 'closed' | 'disconnected'; qr: string | null; pairingCode: string | null; me: { id: string | null; lid: string | null } | null };

function call<T>(method: 'get' | 'post' | 'delete', path: string, data?: unknown): Promise<T> {
    const base = String(process.env.WHAILEYS_API_URL).replace(/\/+$/, '');
    return axios.request<T>({ method, url: `${base}${path}`, data, timeout: 20000, headers: { 'x-api-key': process.env.WHAILEYS_TOKEN!, 'content-type': 'application/json' } })
        .then(r => r.data)
        .catch(e => { throw new Error(e?.response?.data?.error || `Whaileys indisponível (${e?.response?.status || e?.code || 'rede'})`); });
}
const inst = () => encodeURIComponent(process.env.WHAILEYS_INSTANCE!);
/** Nome da "instância" das conversas do número de botões na Central (separa do número principal). */
export const whaileysInstanceKey = () => `whaileys:${process.env.WHAILEYS_INSTANCE || 'botoes'}`;
export const whaileysStatus = () => call<WhaileysStatus>('get', `/sessions/${inst()}`);
export const whaileysConnect = (phone?: string) => call<WhaileysStatus>('post', `/sessions/${inst()}/connect`, phone ? { phone } : {});
export const whaileysLogout = () => call<{ ok: boolean }>('delete', `/sessions/${inst()}`);
export const whaileysSend = (to: string, card: Card) => call<{ messageId: string }>('post', `/sessions/${inst()}/send`, { to, ...card });

/** HMAC-SHA256 de `${timestamp}.${corpoCru}`, tempo constante, janela de 5 min. */
export function verifySignature(raw: string, timestamp: unknown, signature: unknown, secret = process.env.WHAILEYS_WEBHOOK_SECRET || '', now = Date.now()) {
    if (!secret || typeof timestamp !== 'string' || typeof signature !== 'string' || !/^\d{13}$/.test(timestamp) || !/^[0-9a-f]{64}$/.test(signature)) return false;
    if (Math.abs(now - Number(timestamp)) > 300_000) return false;
    const expected = createHmac('sha256', secret).update(`${timestamp}.${raw}`).digest();
    return timingSafeEqual(expected, Buffer.from(signature, 'hex'));
}

// ───────── Leitura da mensagem recebida (pura) ─────────
export type BotEvent =
    | { kind: 'action'; id: string }
    | { kind: 'text'; text: string }
    | { kind: 'media'; media: 'image' | 'video' | 'audio' | 'document'; mimetype?: string; caption?: string }
    | { kind: 'location'; lat: number; lng: number }
    | { kind: 'ignored' };

const unwrap = (m: any): any => m?.ephemeralMessage?.message ?? m?.viewOnceMessage?.message ?? m?.viewOnceMessageV2?.message ?? m?.documentWithCaptionMessage?.message ?? m;
const flowId = (p: unknown) => { if (typeof p !== 'string') return undefined; try { return JSON.parse(p)?.id; } catch { return undefined; } };
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/**
 * Clique → id; "1"/"2" → opção numerada do último card; palavra igual ao título → a opção.
 * `options` = [{id,title}] enviados no último card (guardados na sessão).
 */
export function parseIncoming(raw: unknown, options: Button[] = []): BotEvent {
    if (!raw || typeof raw !== 'object') return { kind: 'ignored' };
    const m = unwrap(raw);
    const id = m.buttonsResponseMessage?.selectedButtonId ?? m.templateButtonReplyMessage?.selectedId
        ?? m.listResponseMessage?.singleSelectReply?.selectedRowId ?? flowId(m.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson);
    if (typeof id === 'string' && id) return { kind: 'action', id: id.slice(0, 120) };
    const loc = m.locationMessage || m.liveLocationMessage;
    if (loc && Number.isFinite(loc.degreesLatitude) && Number.isFinite(loc.degreesLongitude)) return { kind: 'location', lat: loc.degreesLatitude, lng: loc.degreesLongitude };
    if (m.imageMessage) return { kind: 'media', media: 'image', mimetype: m.imageMessage.mimetype, caption: m.imageMessage.caption };
    if (m.videoMessage) return { kind: 'media', media: 'video', mimetype: m.videoMessage.mimetype, caption: m.videoMessage.caption };
    if (m.audioMessage) return { kind: 'media', media: 'audio', mimetype: m.audioMessage.mimetype };
    if (m.documentMessage) return { kind: 'media', media: 'document', mimetype: m.documentMessage.mimetype, caption: m.documentMessage.caption };
    const text = String(m.conversation ?? m.extendedTextMessage?.text ?? '').trim();
    if (!text) return { kind: 'ignored' };
    const n = /^\d{1,2}$/.test(text) ? Number(text) : 0;
    if (n >= 1 && n <= options.length) return { kind: 'action', id: options[n - 1].id };
    const byTitle = options.find(o => norm(o.title.replace(/^[^\p{L}\p{N}]+/u, '')) === norm(text));
    if (byTitle) return { kind: 'action', id: byTitle.id };
    return { kind: 'text', text: text.slice(0, 1000) };
}

/** Texto do card com as opções numeradas (reserva quando o aparelho não mostra botões). */
export function numbered(text: string, opts: Button[]) {
    return `${text}\n\n${opts.map((o, i) => `${i + 1}. ${o.title}`).join('\n')}`;
}
