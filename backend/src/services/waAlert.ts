import { whaileysSend, type BotEvent } from './whaileys';

const reasons = {
    human: 'Pedido de atendimento humano', card: 'Menção a carteirinha',
    certificate: 'Menção a atestado', pix: 'Pedido ou menção a Pix',
};
type Reason = keyof typeof reasons;
const cooldown = 30 * 60_000;
// ponytail: um processo PM2; reiniciar zera o intervalo. Em cluster, usar armazenamento compartilhado.
const recent = new Map<string, number>();

function classify(ev: BotEvent): Reason[] {
    if (ev.kind === 'action') {
        if (ev.id === 'help:human' || ev.id.startsWith('hum:')) return ['human'];
        if (ev.id === 'pay:key' || ev.id === 'svc:LOANS') return ['pix'];
        return [];
    }
    const raw = ev.kind === 'text' ? ev.text : ev.kind === 'media' ? ev.caption : null;
    if (typeof raw !== 'string') return [];
    const text = raw.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const result: Reason[] = [];
    if (/\batendentes?\b|\batendimento humano\b|\bfalar com (?:um |uma |o |a )?(?:humano|pessoa|alguem)\b/.test(text)) result.push('human');
    if (/\bcartei?rinha(?:s)?\b/.test(text)) result.push('card');
    if (/\batestados?\b/.test(text)) result.push('certificate');
    if (/\bpix\b/.test(text)) result.push('pix');
    return result;
}

export async function alertFromMessage(ev: BotEvent, phone: string, send = whaileysSend, now = Date.now()) {
    const to = process.env.WA_BOT_ALERT_PHONE || '';
    if (!/^55\d{10,11}$/.test(to) || to === phone) return;
    const fresh = classify(ev).filter(k => (recent.get(`${phone}:${k}`) ?? 0) <= now);
    if (!fresh.length) return;
    if (recent.size >= 5000) for (const [key, expiry] of recent) if (expiry <= now) recent.delete(key);
    for (const k of fresh) recent.set(`${phone}:${k}`, now + cooldown);
    // Sem transcrever a mensagem, chave Pix, documento ou informação de saúde no alerta.
    const text = `Atendimento pelo WhatsApp de botões\n${fresh.map(k => reasons[k]).join('; ')}\nCliente: final ${phone.slice(-4)}\nCentral: https://www.tubaraoemprestimo.com.br/#/admin/ai-hub?tab=conversations`;
    try { await send(to, { text }); }
    catch { for (const k of fresh) recent.delete(`${phone}:${k}`); console.error('[WaAlert] Falha no envio pela instância de botões.'); }
}
