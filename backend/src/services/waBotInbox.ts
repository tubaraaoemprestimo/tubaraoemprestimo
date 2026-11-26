import { prisma } from './prisma';
import { ingestMessage, publish, preview } from './inbox';
import { whaileysInstanceKey, whaileysSend, type BotEvent, type Card } from './whaileys';

/**
 * Liga o número de botões (Whaileys) à Central WhatsApp.
 * Toda mensagem do cliente e toda resposta do bot entram em wa_conversations/wa_messages
 * (instância `whaileys:<nome>`), então o painel mostra, filtra e etiqueta igual ao número principal.
 *
 * Quem responde nesta linha, pelo modo da conversa:
 *  - padrão (conversa nova ou AI_ACTIVE sem `botAi`): o BOT de botões (sem IA);
 *  - WAITING_HUMAN / HUMAN_ACTIVE: ninguém automático — o atendente responde pela Central;
 *  - IA: só quando o atendente toca em "Passar para IA" (flag `wa_bot_ai:<conversa>`).
 */
const AI_KEY = (convId: string) => `wa_bot_ai:${convId}`;

function textOf(ev: BotEvent): string | null {
    if (ev.kind === 'text') return ev.text;
    if (ev.kind === 'action') return `[botão] ${ev.id}`;
    if (ev.kind === 'location') return '[Localização]';
    if (ev.kind === 'media') return ev.caption || null;
    return null;
}

/** Grava a mensagem recebida. Devolve a conversa (para decidir quem responde). */
export async function recordInbound(phone: string, messageId: string, ev: BotEvent, pushName: string | null) {
    const type = ev.kind === 'media' ? ev.media : 'text';
    const r = await ingestMessage({
        externalId: messageId, remoteJid: `${phone}@s.whatsapp.net`, phone, fromMe: false, pushName, type,
        text: textOf(ev), mediaMime: ev.kind === 'media' ? ev.mimetype || null : null, mediaName: null, quotedExternalId: null,
        timestamp: new Date(), source: 'whaileys', statusRaw: 'DELIVERED',
    }, { instance: whaileysInstanceKey() });
    return r.conversation;
}

/** Envia pelo número de botões e grava na Central com a origem certa. */
export function inboxSender(phone: string, origin: 'AUTOMACAO' | 'IA') {
    return async (card: Card) => {
        const r = await whaileysSend(phone, card);
        const text = card.text.slice(0, 8000);
        await ingestMessage({
            externalId: String(r.messageId), remoteJid: `${phone}@s.whatsapp.net`, phone, fromMe: true, pushName: null, type: 'text', text,
            mediaMime: null, mediaName: null, quotedExternalId: null, timestamp: new Date(), source: 'api', statusRaw: 'SENT',
        }, { instance: whaileysInstanceKey(), origin }).catch((e: any) => console.error('[WaBot] falha ao gravar resposta na central:', e?.message));
        return r;
    };
}

export async function aiEnabledFor(convId: string, db: any = prisma) {
    const row = await db.systemSetting.findUnique({ where: { key: AI_KEY(convId) } }).catch(() => null);
    return row?.value === 'on';
}
export async function setAi(convId: string, on: boolean, actor: { id: string; name: string }, db: any = prisma) {
    if (on) await db.systemSetting.upsert({ where: { key: AI_KEY(convId) }, update: { value: 'on' }, create: { key: AI_KEY(convId), value: 'on' } });
    else await db.systemSetting.deleteMany({ where: { key: AI_KEY(convId) } });
    await db.auditLog.create({ data: { userId: actor.id, userName: actor.name, action: on ? 'WA_BOT_AI_ON' : 'WA_BOT_AI_OFF', entity: 'WA_CONVERSATION', entityId: convId, details: 'número de botões' } }).catch(() => {});
}

/** Pedido de atendente no bot → conversa vai para a fila humana da Central. */
export async function queueHuman(phone: string, topic: string, db: any = prisma) {
    const conv = await db.waConversation.findUnique({ where: { instance_remoteJid: { instance: whaileysInstanceKey(), remoteJid: `${phone}@s.whatsapp.net` } } });
    if (!conv || conv.mode === 'HUMAN_ACTIVE' || conv.mode === 'WAITING_HUMAN') return;
    await db.waConversation.updateMany({ where: { id: conv.id, version: conv.version }, data: { mode: 'WAITING_HUMAN', waitingSince: new Date(), archived: false, version: { increment: 1 } } });
    const updated = await db.waConversation.findUnique({ where: { id: conv.id } });
    publish('conversation.updated', { conversation: updated });
    publish('notify.human_requested', { conversationId: conv.id, name: updated?.name || topic });
}

/** IA na linha de botões (só quando o atendente ligou): histórico curto da própria Central. */
export async function aiAnswer(convId: string, phone: string, text: string, db: any = prisma) {
    // Últimas 16 (da mais nova para a mais antiga). A pergunta atual já foi gravada: sai do histórico e vai como mensagem.
    const rows = await db.waMessage.findMany({ where: { conversationId: convId, type: 'text', text: { not: null } }, orderBy: { timestamp: 'desc' }, take: 16, select: { fromMe: true, text: true } });
    const older = rows[0] && !rows[0].fromMe && rows[0].text === text ? rows.slice(1) : rows;
    const history = older.reverse().map((m: any) => ({ role: m.fromMe ? 'assistant' : 'user', content: String(m.text) }));
    const { aiReply } = await import('../routes/webhook');
    const reply = await aiReply(history, text);
    if (!reply) return false;
    await inboxSender(phone, 'IA')({ text: reply.slice(0, 3500) });
    return true;
}

export { preview };
