import { prisma } from './prisma';
import { publish, Mode, instanceName } from './inbox';

/**
 * Mudanças de modo de atendimento. Todas condicionais à versão lida (concorrência otimista):
 * dois operadores clicando "assumir" ao mesmo tempo → só um consegue; o outro recebe 409.
 */
export class HandoffConflict extends Error { constructor(msg: string) { super(msg); } }

type Actor = { id: string; name: string };

async function audit(actor: Actor, action: string, convId: string, details: any) {
    await prisma.auditLog.create({ data: { userId: actor.id, userName: actor.name, action, entity: 'WA_CONVERSATION', entityId: convId, details: JSON.stringify(details) } }).catch(() => {});
}

async function transition(convId: string, expectedVersion: number | undefined, guard: (c: any) => string | null, data: any, actor: Actor, action: string) {
    const conv = await prisma.waConversation.findUnique({ where: { id: convId } });
    if (!conv) throw new HandoffConflict('Conversa não encontrada');
    if (expectedVersion !== undefined && expectedVersion !== conv.version) throw new HandoffConflict('A conversa mudou (outro operador agiu). Atualize e tente de novo.');
    const err = guard(conv);
    if (err) throw new HandoffConflict(err);
    const r = await prisma.waConversation.updateMany({ where: { id: convId, version: conv.version }, data: { ...data, version: { increment: 1 } } });
    if (r.count !== 1) throw new HandoffConflict('Outro operador agiu nesta conversa ao mesmo tempo. Atualize e tente de novo.');
    const updated = await prisma.waConversation.findUnique({ where: { id: convId } });
    await audit(actor, action, convId, { from: { mode: conv.mode, assignedTo: conv.assignedTo }, to: { mode: updated!.mode, assignedTo: updated!.assignedTo } });
    publish('conversation.updated', { conversation: updated });
    return updated!;
}

export function assume(convId: string, actor: Actor, version?: number) {
    return transition(convId, version,
        c => c.mode === 'HUMAN_ACTIVE' && c.assignedTo && c.assignedTo !== actor.id ? 'Outro operador já está atendendo esta conversa' : null,
        { mode: 'HUMAN_ACTIVE' as Mode, assignedTo: actor.id, assignedAt: new Date(), waitingSince: null, archived: false }, actor, 'WA_ASSUME');
}

export async function transfer(convId: string, actor: Actor, toUserId: string, version?: number) {
    const target = await prisma.user.findFirst({ where: { id: toUserId, role: 'ADMIN' }, select: { id: true, name: true } });
    if (!target) throw new HandoffConflict('Operador de destino não encontrado ou sem permissão');
    const r = await transition(convId, version, () => null, { mode: 'HUMAN_ACTIVE' as Mode, assignedTo: target.id, assignedAt: new Date(), waitingSince: null }, actor, 'WA_TRANSFER');
    publish('conversation.assigned', { conversationId: convId, assignedTo: target.id, by: actor.name });
    return r;
}

/** Libera para a fila humana (sem responsável). */
export function release(convId: string, actor: Actor, version?: number) {
    return transition(convId, version, () => null, { mode: 'WAITING_HUMAN' as Mode, assignedTo: null, assignedAt: null, waitingSince: new Date() }, actor, 'WA_RELEASE');
}

/** Devolve para a IA. Mensagens recebidas no modo humano não são respondidas retroativamente: a IA só age na próxima mensagem. */
export function returnToAI(convId: string, actor: Actor, version?: number) {
    return transition(convId, version, () => null, { mode: 'AI_ACTIVE' as Mode, assignedTo: null, assignedAt: null, waitingSince: null }, actor, 'WA_RETURN_TO_AI');
}

export function close(convId: string, actor: Actor, version?: number, archive = true) {
    return transition(convId, version, () => null, { mode: 'CLOSED' as Mode, assignedTo: null, assignedAt: null, waitingSince: null, archived: archive, unreadCount: 0 }, actor, 'WA_CLOSE');
}

export function reopen(convId: string, actor: Actor, version?: number) {
    return transition(convId, version, () => null, { mode: 'HUMAN_ACTIVE' as Mode, assignedTo: actor.id, assignedAt: new Date(), archived: false, waitingSince: null }, actor, 'WA_REOPEN');
}

/** Cliente pediu humano (palavra-chave): vai para a fila; se já está com humano, não muda. */
export async function requestHuman(remoteJid: string, reason: string) {
    const conv = await prisma.waConversation.findUnique({ where: { instance_remoteJid: { instance: await instanceName(), remoteJid } } });
    if (!conv || conv.mode === 'HUMAN_ACTIVE' || conv.mode === 'WAITING_HUMAN') return;
    await prisma.waConversation.updateMany({ where: { id: conv.id, version: conv.version }, data: { mode: 'WAITING_HUMAN', waitingSince: new Date(), archived: false, version: { increment: 1 } } });
    const updated = await prisma.waConversation.findUnique({ where: { id: conv.id } });
    await audit({ id: 'system', name: 'Sistema' }, 'WA_HUMAN_REQUESTED', conv.id, { reason });
    publish('conversation.updated', { conversation: updated });
    publish('notify.human_requested', { conversationId: conv.id, name: updated?.name || null });
}
