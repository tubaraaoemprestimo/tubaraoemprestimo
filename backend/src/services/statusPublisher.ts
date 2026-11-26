import axios from 'axios';
import { prisma } from './prisma';
import { whaileysEnabled } from './whaileys';

/**
 * Publicador único de status (stories) — painel e WhatsApp de admin usam o mesmo.
 * EVOLUTION: número principal (todos os contatos salvos). WHAILEYS: número de botões
 * (público = clientes que já conversaram com ele; o WhatsApp só mostra a quem salvou o número).
 * Falha da API vira FAILED com motivo (antes o erro era engolido e o item ficava parado).
 */
export type StatusKind = 'text' | 'image' | 'video';
export type StatusItem = { id: string; channel: string; mediaType: string | null; mediaUrl: string | null; imageUrl: string | null; content: string | null; caption: string | null };

export function kindOf(item: Pick<StatusItem, 'mediaType' | 'mediaUrl' | 'imageUrl'>): StatusKind {
    const t = String(item.mediaType || '').toLowerCase();
    if (t.startsWith('video')) return 'video';
    if (t.startsWith('image') || item.imageUrl || item.mediaUrl) return 'image';
    return 'text';
}

async function viaEvolution(item: StatusItem, kind: StatusKind) {
    const cfg = await prisma.whatsappConfig.findFirst();
    if (!cfg?.apiUrl || !cfg.apiKey || !cfg.instanceName) throw new Error('WhatsApp principal não configurado');
    const url = item.mediaUrl || item.imageUrl;
    const body = kind === 'text'
        ? { type: 'text', content: item.content || item.caption || '', backgroundColor: '#000000', font: 1, allContacts: true }
        : { type: kind, content: url, caption: item.caption || item.content || '', allContacts: true };
    if (kind !== 'text' && !url) throw new Error('Status sem mídia');
    if (!body.content) throw new Error('Status vazio');
    await axios.post(`${cfg.apiUrl.replace(/\/+$/, '')}/message/sendStatus/${cfg.instanceName}`, body, { headers: { apikey: cfg.apiKey }, timeout: 120000 })
        .catch((e: any) => { throw new Error(e?.response?.data?.response?.message?.[0] || e?.response?.data?.message || e.message); });
}

/** Público do número de botões: quem já conversou com ele (sessões do autoatendimento). */
async function whaileysAudience(): Promise<string[]> {
    const rows = await prisma.waBotSession.findMany({ select: { phone: true }, take: 5000, orderBy: { updatedAt: 'desc' } });
    return rows.map(r => r.phone).filter(p => /^55\d{10,11}$/.test(p));
}

async function viaWhaileys(item: StatusItem, kind: StatusKind) {
    if (!whaileysEnabled()) throw new Error('WhatsApp por botões não configurado');
    const audience = await whaileysAudience();
    if (!audience.length) throw new Error('Ninguém conversou com o número de botões ainda');
    const url = item.mediaUrl || item.imageUrl;
    const body = kind === 'text' ? { type: 'text', text: item.content || item.caption, audience } : { type: kind, url, caption: item.caption || item.content || undefined, audience };
    const base = String(process.env.WHAILEYS_API_URL).replace(/\/+$/, '');
    await axios.post(`${base}/sessions/${encodeURIComponent(process.env.WHAILEYS_INSTANCE!)}/status`, body, { headers: { 'x-api-key': process.env.WHAILEYS_TOKEN! }, timeout: 120000 })
        .catch((e: any) => { throw new Error(e?.response?.data?.error || e.message); });
}

export async function publishStatus(item: StatusItem) {
    const kind = kindOf(item);
    if (item.channel === 'WHAILEYS') return viaWhaileys(item, kind);
    return viaEvolution(item, kind);
}

/**
 * Publica os vencidos. Trava por item (updateMany com status) para nunca publicar duas vezes,
 * mesmo com o cron e o "postar agora" ao mesmo tempo. Itens com mais de 24 h de atraso não saem.
 */
export async function runDueStatuses(now = new Date()) {
    const due = await prisma.scheduledStatus.findMany({ where: { status: { in: ['PENDING', 'SCHEDULED'] }, OR: [{ nextPostAt: { lte: now } }, { nextPostAt: null, scheduledAt: { lte: now } }] }, take: 10, orderBy: { scheduledAt: 'asc' } });
    for (const s of due) {
        const when = s.nextPostAt || s.scheduledAt;
        const lock = await prisma.scheduledStatus.updateMany({ where: { id: s.id, status: s.status }, data: { status: 'POSTING' } });
        if (!lock.count) continue;
        if (now.getTime() - when.getTime() > 24 * 3600000) {
            await prisma.scheduledStatus.update({ where: { id: s.id }, data: { status: 'EXPIRED', errorMessage: 'Passou mais de 24 h do horário; não publicado' } });
            continue;
        }
        try {
            await publishStatus(s as any);
            await prisma.scheduledStatus.update({ where: { id: s.id }, data: { status: 'POSTED', postedAt: new Date(), lastPostedAt: new Date(), postsCount: { increment: 1 }, errorMessage: null } });
        } catch (e: any) {
            await prisma.scheduledStatus.update({ where: { id: s.id }, data: { status: 'FAILED', errorMessage: String(e?.message || e).slice(0, 300) } });
            console.error('[Status] falha ao publicar', s.id.slice(0, 8), e?.message);
        }
    }
}

/** Publica um item agora (painel "Postar agora" e WhatsApp do admin). */
export async function postNow(id: string) {
    const s = await prisma.scheduledStatus.findUnique({ where: { id } });
    if (!s) throw new Error('Status não encontrado');
    if (s.status === 'POSTED' || s.status === 'POSTING') throw new Error('Status já publicado');
    const lock = await prisma.scheduledStatus.updateMany({ where: { id, status: s.status }, data: { status: 'POSTING' } });
    if (!lock.count) throw new Error('Status já está sendo publicado');
    try {
        await publishStatus(s as any);
        await prisma.scheduledStatus.update({ where: { id }, data: { status: 'POSTED', postedAt: new Date(), lastPostedAt: new Date(), postsCount: { increment: 1 }, errorMessage: null } });
    } catch (e: any) {
        await prisma.scheduledStatus.update({ where: { id }, data: { status: 'FAILED', errorMessage: String(e?.message || e).slice(0, 300) } });
        throw e;
    }
}
