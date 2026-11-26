import { prisma } from './prisma';
import type { Button } from './whaileys';

/**
 * Assuntos do atendimento por botões, na ordem do que mais se pergunta no WhatsApp
 * (análise de 26/11/2026 sobre ~7.300 mensagens): novo empréstimo 486, andamento 163,
 * comprovante 142, app/senha 87, pix 80, falar com atendente 67, quitação 58, documentos 58,
 * atraso/renegociação 29, horário 26, saldo 22, contrato 22, limpa nome 12, cobrança indevida 10.
 * Sem IA: respostas fixas + ações do próprio sistema; o que não se resolve vai para a fila humana.
 */
export type Topic = { id: string; title: string; description: string };
export const TOPICS: Topic[] = [
    { id: 'help:payment', title: '💸 Pagamento e Pix', description: 'Chave Pix, link, já paguei' },
    { id: 'help:request', title: '📋 Minha solicitação', description: 'Andamento, documentos' },
    { id: 'help:debt', title: '🧮 Dívida e quitação', description: 'Quanto devo, quitar, atraso' },
    { id: 'help:app', title: '📱 App, senha e cadastro', description: 'Acesso ao aplicativo' },
    { id: 'help:contract', title: '📄 Contrato e extrato', description: 'Contrato, recibos' },
    { id: 'help:dispute', title: '⚖️ Cobrança indevida', description: 'Não reconheço / já paguei' },
    { id: 'help:info', title: '🕘 Horário e contato', description: 'Atendimento e endereço' },
    { id: 'help:human', title: '👤 Falar com atendente', description: 'Pessoa da equipe' },
];

export const HUMAN_TOPICS: Button[] = [
    { id: 'hum:Solicitação', title: '📋 Solicitações' },
    { id: 'hum:Dívida', title: '🧮 Cálculo da dívida' },
    { id: 'hum:Quitação', title: '✅ Quitação' },
    { id: 'hum:Renegociação', title: '🤝 Renegociar/atraso' },
    { id: 'hum:Pagamento', title: '💸 Pagamento/comprovante' },
    { id: 'hum:Cobrança indevida', title: '⚖️ Cobrança indevida' },
    { id: 'hum:App', title: '📱 App/senha' },
    { id: 'hum:Outro', title: '💬 Outro assunto' },
];

export const APP_URL = (process.env.APP_PUBLIC_URL || 'https://www.tubaraoemprestimo.com.br').replace(/\/+$/, '');

export async function pixKey(db: any = prisma): Promise<string | null> {
    const row = await db.systemSetting.findUnique({ where: { key: 'pix_key' } }).catch(() => null);
    return row?.value || null;
}

/** Horário de atendimento humano: seg–sex 9h–18h, sáb 9h–13h (Brasília). */
export function inBusinessHours(now = new Date()) {
    const sp = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
    const d = sp.getDay(), h = sp.getHours() + sp.getMinutes() / 60;
    return (d >= 1 && d <= 5 && h >= 9 && h < 18) || (d === 6 && h >= 9 && h < 13);
}

export const INFO_TEXT = '🕘 *Atendimento humano*\nSegunda a sexta: 9h às 18h\nSábado: 9h às 13h\n\n🤖 Por aqui (botões) você é atendido *24 horas*: dívida, pagamento, solicitações e documentos.\n\n🌐 App: ' + APP_URL;

export const APP_TEXT = `📱 *App Tubarão*\n${APP_URL}\n\n• *Esqueci a senha*: na tela de login toque em "Esqueci minha senha" e use o e-mail do cadastro.\n• *Primeiro acesso*: use o e-mail que você confirmou aqui no WhatsApp e toque em "Esqueci minha senha" para criar a sua.\n• Não lembra o e-mail? Toque em *Falar com atendente*.`;

/**
 * Pedido de atendimento humano: fila + aviso aos admins. Fora do horário avisa quando será respondido.
 * Fica registrado em notificação e auditoria (a equipe vê no painel e recebe push).
 */
export async function requestAttendant(phone: string, topic: string, detail: string | null, who: { userId: string | null; name?: string | null }, db: any = prisma, now = new Date()) {
    const t = topic.slice(0, 40), d = (detail || '').slice(0, 500);
    await db.notification.create({ data: { title: `👤 Atendimento pedido: ${t}`, message: `${who.name || 'Cliente'} (WhatsApp ***${phone.slice(-4)})${d ? `: ${d}` : ''}`, type: 'WARNING' } }).catch(() => {});
    await db.auditLog.create({ data: { userId: who.userId || 'system', userName: who.name || 'WhatsApp', action: 'WA_BOT_HUMAN_REQUESTED', entity: 'WA_BOT', entityId: phone.slice(-4), details: `${t}${d ? ` — ${d}` : ''}` } }).catch(() => {});
    try { const { sendPushToRole } = await import('../routes/push'); await sendPushToRole('ADMIN', `👤 Atendente: ${t}`, `${who.name || 'Cliente'} pediu atendimento pelo WhatsApp`); } catch { /* push não bloqueia */ }
    // Fila humana da Central (o atendente vê e responde pelo painel).
    try { const { queueHuman } = await import('./waBotInbox'); await queueHuman(phone, t, db); } catch { /* central indisponível não bloqueia */ }
    return inBusinessHours(now);
}
