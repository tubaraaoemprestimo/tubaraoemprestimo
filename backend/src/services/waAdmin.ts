import axios from 'axios';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from './prisma';
import type { BotEvent, Button } from './whaileys';
import type { Ctx } from './waBot';

/**
 * Admin pelo WhatsApp de botões. Não reimplementa regra de negócio: cada ação chama
 * a MESMA rota HTTP do painel (loopback), com um JWT curto do próprio admin.
 * Segurança: número cadastrado + PIN (bcrypt) para entrar, sessão de 15 min,
 * PIN de novo para ações sensíveis, bloqueio após 5 erros, auditoria e aviso aos outros admins.
 */
const SESSION_MIN = 15;
const LOCK_MIN = 30;
const MAX_TRIES = 5;
const API = `http://127.0.0.1:${process.env.PORT || 3001}/api`;

export type Admin = { phone: string; userId: string; pinHash: string | null; pinTries: number; lockedUntil: Date | null; sessionUntil: Date | null; active: boolean };
type St = { step: string; data: Record<string, any>; options: Button[] };

export async function adminFor(phone: string, db: any = prisma): Promise<Admin | null> {
    const a = await db.waAdminPhone.findUnique({ where: { phone } });
    if (!a?.active) return null;
    const u = await db.user.findUnique({ where: { id: a.userId }, select: { role: true } });
    return u?.role === 'ADMIN' ? a : null;
}

/** Chamada à rota do painel como o próprio admin (token de 2 min, nunca sai do servidor). */
export async function panel(userId: string, method: 'get' | 'post' | 'put' | 'patch' | 'delete', path: string, data?: any, db: any = prisma) {
    const u = await db.user.findUnique({ where: { id: userId }, select: { id: true, email: true, name: true, role: true } });
    if (u?.role !== 'ADMIN') throw new Error('Sem permissão de administrador');
    const token = jwt.sign({ id: u.id, email: u.email, name: u.name, role: u.role }, process.env.JWT_SECRET || 'default-secret', { expiresIn: '2m' });
    try {
        return (await axios.request({ method, url: `${API}${path}`, data, timeout: 30000, headers: { Authorization: `Bearer ${token}`, 'x-wa-admin': '1' } })).data;
    } catch (e: any) {
        throw new Error(e?.response?.data?.error || e?.response?.data?.message || `Falha (${e?.response?.status || 'rede'})`);
    }
}

const money = (n: any) => Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const date = (d: any) => (d ? new Date(d).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '-');
const mask = (cpf?: string) => (cpf ? `***.${String(cpf).replace(/\D/g, '').slice(3, 6)}.***-**` : '-');

/** Ação = uma tela do painel reduzida a botões. `pin: true` exige PIN de novo antes de executar. */
type Action = { id: string; title: string; pin?: boolean; run: (c: AdminCtx, arg?: string) => Promise<void> };
type AdminCtx = { ctx: Ctx; st: St; admin: Admin; db: any; ask: (text: string, opts?: Button[]) => Promise<unknown>; say: (text: string) => Promise<unknown>; api: (m: any, p: string, d?: any) => Promise<any> };

const MENU: Button[] = [
    { id: 'adm:dash', title: '📊 Resumo do dia' },
    { id: 'adm:req', title: '📥 Solicitações' },
    { id: 'adm:rcp', title: '🧾 Comprovantes' },
    { id: 'adm:cust', title: '🔎 Buscar cliente' },
    { id: 'adm:late', title: '⚠️ Parcelas em atraso' },
    { id: 'adm:disp', title: '⚖️ Contestações' },
    { id: 'adm:status', title: '📸 Agendar status' },
    { id: 'adm:more', title: '➕ Mais opções' },
    { id: 'adm:exit', title: '🔒 Sair' },
];

export async function adminMenu(c: AdminCtx) {
    c.st.step = 'ADM_MENU'; c.st.data = {};
    await c.ask('🛠️ *Painel Tubarão* — o que deseja fazer?', MENU);
}

// ───────── Telas ─────────
const STATUS_LABEL: Record<string, string> = { PENDING: '⏳ Pendente', WAITING_DOCS: '📎 Aguardando docs', PENDING_ACCEPTANCE: '✍️ Aguardando aceite', APPROVED: '✅ Aprovada', REJECTED: '❌ Recusada', PAUSED: '⏸️ Pausada' };

async function listRequests(c: AdminCtx) {
    const all: any[] = await c.api('get', '/loan-requests');
    const open = all.filter(r => ['PENDING', 'WAITING_DOCS', 'PENDING_ACCEPTANCE', 'PAUSED'].includes(r.status)).slice(0, 10);
    if (!open.length) { await c.say('Nenhuma solicitação pendente. ✅'); return adminMenu(c); }
    c.st.step = 'ADM_REQ'; c.st.data = { ids: open.map(r => r.id) };
    await c.ask(`📥 *Solicitações pendentes* (${open.length})`, open.map((r, i) => ({ id: `req:${i}`, title: `${(r.clientName || '?').split(' ')[0]} ${r.profileType || ''} ${r.amount ? money(r.amount) : ''}`.slice(0, 24) })));
}

async function showRequest(c: AdminCtx, id: string) {
    const all: any[] = await c.api('get', '/loan-requests');
    const r = all.find(x => x.id === id);
    if (!r) { await c.say('Solicitação não encontrada.'); return listRequests(c); }
    let extra: any = {};
    try { extra = JSON.parse(r.supplementalDescription || '{}'); } catch { /* texto livre */ }
    const docs: [string, any][] = [['Selfie', r.selfieUrl], ['Doc. frente', r.idCardUrl], ['Doc. verso', r.idCardBackUrl], ['Comp. endereço', r.proofOfAddressUrl], ['Comp. renda', r.proofIncomeUrl], ['Vídeo aceite', r.videoSelfieUrl], ['Vídeo casa', r.videoHouseUrl], ['Carteira', r.workCardUrl], ['Assinatura', r.signatureUrl]];
    const links = docs.filter(([, u]) => u).map(([n, u]) => { let first = u; try { const a = JSON.parse(u); if (Array.isArray(a)) first = a[0]; } catch { /* url simples */ } return `• ${n}: ${first}`; });
    const lines = [
        `📄 *${r.clientName}* — ${r.profileType}`, `Status: ${STATUS_LABEL[r.status] || r.status}`, `CPF: ${mask(r.cpf)} · Tel: ${r.phone || '-'}`,
        `Valor: ${money(r.amount)} em ${r.installments}x · Renda: ${money(r.monthlyIncome)}`,
        `Cidade: ${r.city || extra.city || '-'} · Enviado em ${date(r.createdAt)}`,
        r.reference1Name ? `Refs: ${r.reference1Name} (${r.reference1Phone}) · ${r.reference2Name} (${r.reference2Phone})` : '',
        extra.channel === 'WHATSAPP_BUTTONS' ? '📱 Feita pelo WhatsApp' : '',
        links.length ? `\n*Documentos:*\n${links.join('\n')}` : '',
    ].filter(Boolean);
    c.st.step = 'ADM_REQ_ONE'; c.st.data = { id };
    await c.say(lines.join('\n'));
    await c.ask('Ação:', [
        { id: 'act:approve', title: '✅ Aprovar' }, { id: 'act:counter', title: '💬 Contraproposta' }, { id: 'act:reject', title: '❌ Recusar' },
        { id: 'act:docs', title: '📎 Pedir documentos' }, { id: 'act:values', title: '✏️ Ajustar valores' }, { id: 'act:pause', title: r.status === 'PAUSED' ? '▶️ Retomar' : '⏸️ Pausar' }, { id: 'act:cancel', title: '🗑️ Cancelar pedido' }, { id: 'adm:req', title: '⬅️ Voltar' },
    ]);
}

async function listReceipts(c: AdminCtx) {
    const rows: any = await c.api('get', '/payment-receipts?status=PENDING');
    const list: any[] = (Array.isArray(rows) ? rows : rows?.receipts || rows?.items || []).filter((r: any) => r.status === 'PENDING').slice(0, 10);
    if (!list.length) { await c.say('Nenhum comprovante pendente. ✅'); return adminMenu(c); }
    c.st.step = 'ADM_RCP'; c.st.data = { ids: list.map(r => r.id), rows: list.map(r => ({ id: r.id, name: r.customerName || r.customer?.name, amount: r.amount, url: r.receiptUrl || r.fileUrl, at: r.createdAt })) };
    await c.ask(`🧾 *Comprovantes pendentes* (${list.length})`, list.map((r, i) => ({ id: `rcp:${i}`, title: `${String(r.customerName || r.customer?.name || '?').split(' ')[0]} ${money(r.amount)}`.slice(0, 24) })));
}

async function showReceipt(c: AdminCtx, i: number) {
    const r = c.st.data.rows?.[i];
    if (!r) return listReceipts(c);
    c.st.step = 'ADM_RCP_ONE'; c.st.data = { ...c.st.data, id: r.id, cur: r };
    await c.say(`🧾 *${r.name || 'Cliente'}* — ${money(r.amount)}\nEnviado em ${date(r.at)}\n${r.url || ''}`);
    await c.ask('Como aprovar?', [{ id: 'rcp:ok', title: '✅ Aprovar parcela' }, { id: 'rcp:int', title: '💰 Só juros' }, { id: 'rcp:dis', title: '🏁 Quitação' }, { id: 'rcp:no', title: '❌ Recusar' }, { id: 'adm:rcp', title: '⬅️ Voltar' }]);
}

async function dashboard(c: AdminCtx) {
    const [reqs, rcp]: any[] = await Promise.all([c.api('get', '/loan-requests'), c.api('get', '/payment-receipts?status=PENDING').catch(() => [])]);
    const today = new Date().toISOString().slice(0, 10);
    const pend = reqs.filter((r: any) => r.status === 'PENDING').length;
    const hoje = reqs.filter((r: any) => String(r.createdAt).slice(0, 10) === today).length;
    const rlist = Array.isArray(rcp) ? rcp : rcp?.receipts || [];
    const late = await c.db.installment.count({ where: { status: { in: ['OPEN', 'LATE'] }, dueDate: { lt: new Date() } } });
    await c.say(`📊 *Resumo*\n\n📥 Solicitações pendentes: *${pend}* (${hoje} hoje)\n🧾 Comprovantes para conferir: *${rlist.filter((r: any) => r.status === 'PENDING').length}*\n⚠️ Parcelas vencidas em aberto: *${late}*`);
    await adminMenu(c);
}

async function searchCustomer(c: AdminCtx, q?: string) {
    if (!q) { c.st.step = 'ADM_CUST_Q'; return void (await c.ask('Digite *nome, CPF ou telefone* do cliente.', [{ id: 'adm:menu', title: '⬅️ Menu' }])); }
    const rows = await c.db.customer.findMany({
        where: { OR: [{ name: { contains: q, mode: 'insensitive' } }, { cpf: { contains: q.replace(/\D/g, '') || q } }, { phone: { contains: q.replace(/\D/g, '') || q } }] },
        take: 10, orderBy: { updatedAt: 'desc' }, select: { id: true, name: true, cpf: true },
    });
    if (!rows.length) { await c.say('Nenhum cliente encontrado.'); return searchCustomer(c); }
    c.st.step = 'ADM_CUST'; c.st.data = { ids: rows.map((r: any) => r.id) };
    await c.ask(`🔎 ${rows.length} encontrado(s):`, rows.map((r: any, i: number) => ({ id: `cus:${i}`, title: `${r.name} ${mask(r.cpf).slice(-6)}`.slice(0, 24) })));
}

async function showCustomer(c: AdminCtx, id: string) {
    const cu = await c.db.customer.findUnique({ where: { id }, select: { id: true, name: true, cpf: true, phone: true, email: true, status: true, city: true, totalDebt: true } });
    const loans = await c.db.loan.findMany({ where: { customerId: id }, orderBy: { createdAt: 'desc' }, take: 6, select: { id: true, amount: true, remainingAmount: true, status: true, installments: { where: { status: { in: ['OPEN', 'LATE'] } }, orderBy: { dueDate: 'asc' }, take: 1, select: { dueDate: true, amount: true } } } });
    const ls = loans.map((l: any, i: number) => `*${i + 1}.* ${money(l.amount)} — saldo ${money(l.remainingAmount)} — ${l.status}${l.installments[0] ? ` — vence ${date(l.installments[0].dueDate)} (${money(l.installments[0].amount)})` : ''}`);
    c.st.step = 'ADM_CUST_ONE'; c.st.data = { id, loanIds: loans.map((l: any) => l.id), phone: cu?.phone };
    await c.say(`👤 *${cu?.name}*\nCPF: ${mask(cu?.cpf)} · Tel: ${cu?.phone || '-'}\nE-mail: ${cu?.email || '-'} · ${cu?.city || ''}\nStatus: ${cu?.status}\n\n${ls.join('\n') || 'Sem contratos.'}`);
    const opts: Button[] = loans.slice(0, 5).map((_: any, i: number) => ({ id: `ln:${i}`, title: `📄 Contrato ${i + 1}` }));
    opts.push({ id: 'cus:msg', title: '✉️ Enviar mensagem' }, cu?.status === 'BLOCKED' ? { id: 'cus:unblock', title: '🔓 Desbloquear' } : { id: 'cus:block', title: '⛔ Bloquear' }, { id: 'adm:cust', title: '⬅️ Nova busca' });
    await c.ask('Escolha:', opts);
}

async function showLoan(c: AdminCtx, loanId: string) {
    const l = await c.db.loan.findUnique({ where: { id: loanId }, select: { id: true, amount: true, remainingAmount: true, status: true, startDate: true, customer: { select: { name: true } }, installments: { orderBy: { dueDate: 'asc' }, select: { id: true, dueDate: true, amount: true, status: true } } } });
    if (!l) return adminMenu(c);
    const inst = l.installments.slice(0, 12).map((i: any, n: number) => `${n + 1}. ${date(i.dueDate)} ${money(i.amount)} ${i.status === 'PAID' ? '✅' : i.status === 'LATE' || new Date(i.dueDate) < new Date() ? '⚠️' : '⏳'}`);
    c.st.step = 'ADM_LOAN'; c.st.data = { ...c.st.data, loanId };
    await c.say(`📄 *${l.customer?.name}* — ${money(l.amount)}\nSaldo: ${money(l.remainingAmount)} · ${l.status} · início ${date(l.startDate)}\n\n${inst.join('\n')}`);
    c.st.data.installments = l.installments.filter((i: any) => i.status !== 'PAID').slice(0, 9).map((i: any) => ({ id: i.id, amount: i.amount, due: i.dueDate }));
    await c.ask('Ação:', [{ id: 'ln:link', title: '🔗 Link pagamento' }, { id: 'ln:manual', title: '💵 Dar baixa manual' }, { id: 'ln:msgoff', title: '🔕 Pausar mensagens' }, { id: 'ln:msgon', title: '🔔 Retomar mensagens' }, { id: 'ln:pause', title: '⏸️ Pausar/retomar' }, { id: 'adm:menu', title: '⬅️ Menu' }]);
}

async function lateList(c: AdminCtx) {
    const rows = await c.db.installment.findMany({ where: { status: { in: ['OPEN', 'LATE'] }, dueDate: { lt: new Date() } }, orderBy: { dueDate: 'asc' }, take: 15, select: { dueDate: true, amount: true, loan: { select: { customer: { select: { id: true, name: true } } } } } });
    if (!rows.length) { await c.say('Nenhuma parcela vencida. 🎉'); return adminMenu(c); }
    c.st.step = 'ADM_LATE'; c.st.data = { ids: rows.map((r: any) => r.loan?.customer?.id) };
    await c.say(`⚠️ *Parcelas vencidas*\n\n${rows.map((r: any, i: number) => `${i + 1}. ${r.loan?.customer?.name} — ${money(r.amount)} — ${date(r.dueDate)}`).join('\n')}`);
    await c.ask('Abrir cliente:', rows.slice(0, 10).map((r: any, i: number) => ({ id: `cus:${i}`, title: `${i + 1}. ${String(r.loan?.customer?.name || '').split(' ')[0]}`.slice(0, 24) })));
    c.st.step = 'ADM_CUST';
}

async function disputes(c: AdminCtx) {
    const r: any = await c.api('get', '/legacy-ops/disputes?status=OPEN_ALL');
    const rows: any[] = (r?.items || []).slice(0, 10);
    if (!rows.length) { await c.say('Nenhuma contestação aberta. ✅'); return adminMenu(c); }
    c.st.step = 'ADM_DISP'; c.st.data = { rows: rows.map(d => ({ id: d.id, name: d.customer?.name, reason: d.reason, description: d.description, status: d.status, at: d.createdAt })) };
    await c.ask(`⚖️ *Contestações abertas* (${rows.length})`, rows.map((d, i) => ({ id: `dsp:${i}`, title: `${String(d.customer?.name || '?').split(' ')[0]} ${String(d.reason || '').slice(0, 14)}`.slice(0, 24) })));
}

async function showDispute(c: AdminCtx, i: number) {
    const d = c.st.data.rows?.[i];
    if (!d) return disputes(c);
    c.st.step = 'ADM_DISP_ONE'; c.st.data = { ...c.st.data, cur: d };
    await c.say(`⚖️ *${d.name || '-'}* — ${d.status}\nMotivo: ${d.reason}\n${d.description ? `Detalhe: ${String(d.description).slice(0, 500)}\n` : ''}Aberta em ${date(d.at)}`);
    await c.ask('Mudar para:', [{ id: 'dsp:IN_REVIEW', title: '🔍 Em análise' }, { id: 'dsp:WAITING_DOCS', title: '📎 Aguardando docs' }, { id: 'dsp:RESOLVED', title: '✅ Resolver' }, { id: 'adm:disp', title: '⬅️ Voltar' }]);
}

// ───────── Status (stories): agendar enviando foto, vídeo ou texto ─────────
const SP_TZ = -3; // ponytail: Brasil sem horário de verão desde 2019; se voltar, usar Intl com America/Sao_Paulo.
/** "hoje 18h", "amanhã 9:30", "28/11 14h", "28/11/2026 14:00" → Date (horário de Brasília). */
export function parseWhen(input: string, now = new Date()): Date | null {
    const t = input.trim().toLowerCase().replace(/\s+/g, ' ');
    const sp = new Date(now.getTime() + SP_TZ * 3600000);
    let y = sp.getUTCFullYear(), mo = sp.getUTCMonth() + 1, d = sp.getUTCDate();
    let rest = t;
    if (/^hoje(\s|$)/.test(t)) rest = t.replace(/^hoje\s*(às|as)?\s*/, '');
    else if (/^amanh[ãa](\s|$)/.test(t)) { const n = new Date(Date.UTC(y, mo - 1, d + 1)); y = n.getUTCFullYear(); mo = n.getUTCMonth() + 1; d = n.getUTCDate(); rest = t.replace(/^amanh[ãa]\s*(às|as)?\s*/, ''); }
    else {
        const m = t.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?\s*(?:às|as)?\s*(.*)$/);
        if (!m) return null;
        d = Number(m[1]); mo = Number(m[2]); if (m[3]) y = Number(m[3]); rest = m[4];
    }
    const h = rest.match(/^(\d{1,2})(?:[:h](\d{2}))?h?$/);
    if (!h) return null;
    const hh = Number(h[1]), mm = Number(h[2] || 0);
    if (hh > 23 || mm > 59) return null;
    const day = new Date(Date.UTC(y, mo - 1, d));
    if (day.getUTCDate() !== d || day.getUTCMonth() !== mo - 1) return null; // 31/02 não vira 03/03
    return new Date(Date.UTC(y, mo - 1, d, hh - SP_TZ, mm));
}
const fmtWhen = (d: Date) => d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

async function statusStart(c: AdminCtx) {
    c.st.step = 'ADM_ST_MEDIA'; c.st.data = {};
    await c.ask('📸 *Agendar status*\nEnvie a *foto* ou o *vídeo* (até 30 MB) — ou *escreva o texto* do status.', [{ id: 'st:list', title: '📋 Ver agendados' }, { id: 'adm:menu', title: '⬅️ Menu' }]);
}

async function statusList(c: AdminCtx) {
    const rows = await c.db.scheduledStatus.findMany({ where: { status: { in: ['PENDING', 'SCHEDULED', 'FAILED'] } }, orderBy: { scheduledAt: 'asc' }, take: 9 });
    if (!rows.length) { await c.say('Nenhum status agendado.'); return statusStart(c); }
    c.st.step = 'ADM_ST_LIST'; c.st.data = { ids: rows.map((r: any) => r.id) };
    const label = (r: any) => `${r.mediaType?.startsWith('video') ? '🎥' : r.mediaType?.startsWith('image') ? '📷' : '📝'} ${fmtWhen(r.nextPostAt || r.scheduledAt)} ${r.channel === 'WHAILEYS' ? '(botões)' : ''}`;
    await c.say(`📋 *Status agendados*\n\n${rows.map((r: any, i: number) => `${i + 1}. ${label(r)} ${r.status === 'FAILED' ? `⚠️ falhou: ${r.errorMessage || ''}` : ''}\n   ${String(r.caption || r.content || '').slice(0, 60)}`).join('\n')}`);
    await c.ask('Cancelar qual?', [...rows.map((_: any, i: number) => ({ id: `stx:${i}`, title: `🗑️ Cancelar ${i + 1}` })), { id: 'adm:menu', title: '⬅️ Menu' }]);
}

async function statusFlow(c: AdminCtx, ev: BotEvent, sensitive: (m: any, p: string, b: any, l: string, back?: string) => Promise<unknown>, media?: { mimetype: string; data: string }) {
    const id = ev.kind === 'action' ? ev.id : '', text = ev.kind === 'text' ? ev.text.trim() : '';
    const st = c.st;
    if (id === 'st:list') return statusList(c);
    if (st.step === 'ADM_ST_LIST' && /^stx:\d$/.test(id)) {
        const sid = st.data.ids[Number(id.slice(4))];
        return sensitive('local', `status-cancel:${sid}`, null, 'Cancelar status agendado', 'status');
    }
    if (st.step === 'ADM_ST_MEDIA') {
        if (ev.kind === 'media' && (ev.media === 'image' || ev.media === 'video')) {
            if (!media?.data) return c.say(ev.media === 'video' ? 'Não consegui receber o vídeo. Envie um de até 30 MB.' : 'Não consegui baixar a foto. Envie de novo.');
            const mime = String(media.mimetype || '').split(';')[0];
            if (!/^(image\/(jpeg|png|webp)|video\/(mp4|3gpp|quicktime))$/.test(mime)) return c.say('Formato não aceito. Use foto JPG/PNG ou vídeo MP4.');
            const { saveBufferToStorage } = await import('./storageService');
            const url = await saveBufferToStorage(Buffer.from(media.data, 'base64'), mime, 'status', `status-${ev.media}`);
            st.data = { mediaType: mime, mediaUrl: url, caption: ev.caption || '' };
            st.step = 'ADM_ST_CAPTION';
            return c.ask(`✅ ${ev.media === 'video' ? 'Vídeo' : 'Foto'} recebido.${ev.caption ? `\nLegenda: "${ev.caption}"` : ''}\nEscreva a *legenda* ou toque em uma opção.`, [{ id: 'st:keep', title: ev.caption ? '✅ Manter legenda' : '➡️ Sem legenda' }]);
        }
        if (text) { st.data = { mediaType: 'text', content: text.slice(0, 700) }; return statusWhen(c); }
        return statusStart(c);
    }
    if (st.step === 'ADM_ST_CAPTION') {
        if (id === 'st:keep') return statusWhen(c);
        if (text) { st.data.caption = text.slice(0, 700); return statusWhen(c); }
        return c.ask('Escreva a legenda ou toque em uma opção.', [{ id: 'st:keep', title: '➡️ Sem legenda' }]);
    }
    if (st.step === 'ADM_ST_WHEN') {
        const now = c.ctx.now || new Date();
        let at: Date | null = null;
        if (id === 'stw:now') at = now;
        else if (id === 'stw:18') at = parseWhen('hoje 18h', now);
        else if (id === 'stw:9') at = parseWhen('amanhã 9h', now);
        else if (text) at = parseWhen(text, now);
        if (!at) return c.say('Não entendi. Exemplos: *hoje 18h*, *amanhã 9:30*, *28/11 14h*.');
        if (at.getTime() < now.getTime() - 60000) return c.say('Esse horário já passou. Escolha outro.');
        if (at.getTime() > now.getTime() + 60 * 86400000) return c.say('Agende até 60 dias à frente.');
        st.data.at = at.toISOString(); st.step = 'ADM_ST_CHANNEL';
        const { whaileysEnabled } = await import('./whaileys');
        if (!whaileysEnabled()) { st.data.channel = 'EVOLUTION'; return statusConfirm(c, sensitive); }
        return c.ask(`Quando: *${id === 'stw:now' ? 'agora' : fmtWhen(at)}*.\nPublicar em qual número?`, [{ id: 'stc:EVOLUTION', title: '📱 Número principal' }, { id: 'stc:WHAILEYS', title: '🤖 Número de botões' }, { id: 'stc:BOTH', title: '📱+🤖 Os dois' }]);
    }
    if (st.step === 'ADM_ST_CHANNEL' && /^stc:(EVOLUTION|WHAILEYS|BOTH)$/.test(id)) { st.data.channel = id.slice(4); return statusConfirm(c, sensitive); }
    return statusStart(c);
}

async function statusWhen(c: AdminCtx) {
    c.st.step = 'ADM_ST_WHEN';
    await c.ask('Quando publicar? Toque ou escreva (ex.: *28/11 14h*).', [{ id: 'stw:now', title: '⚡ Agora' }, { id: 'stw:18', title: '🕕 Hoje 18h' }, { id: 'stw:9', title: '🌅 Amanhã 9h' }]);
}

async function statusConfirm(c: AdminCtx, sensitive: (m: any, p: string, b: any, l: string, back?: string) => Promise<unknown>) {
    const d = c.st.data, at = new Date(d.at);
    const where = d.channel === 'BOTH' ? 'nos dois números' : d.channel === 'WHAILEYS' ? 'no número de botões' : 'no número principal';
    const kind = d.mediaType === 'text' ? 'texto' : d.mediaType.startsWith('video') ? 'vídeo' : 'foto';
    return sensitive('local', 'status-create', d, `Agendar status (${kind}) para ${fmtWhen(at)} ${where}`, 'status');
}

/** Ações locais (sem rota do painel): criar/cancelar status. Chamadas só depois do PIN. */
async function statusLocal(c: AdminCtx, path: string, body: any) {
    if (path === 'status-create') {
        const at = new Date(body.at);
        const channels = body.channel === 'BOTH' ? ['EVOLUTION', 'WHAILEYS'] : [body.channel];
        for (const channel of channels) {
            await c.db.scheduledStatus.create({ data: {
                title: 'WhatsApp admin', content: body.mediaType === 'text' ? body.content : (body.caption || null), mediaType: body.mediaType, mediaUrl: body.mediaUrl || null,
                imageUrl: body.mediaType?.startsWith('image') ? body.mediaUrl : null, caption: body.caption || null,
                recurrence: 'ONCE', selectedDays: [], postTimes: [], postsPerDay: 1, totalDays: 1, startDate: at, scheduledAt: at, nextPostAt: at,
                status: 'SCHEDULED', channel, createdBy: c.admin.userId,
            } });
        }
        // "Agora": publica já (não espera o próximo minuto do agendador).
        if (at.getTime() <= Date.now() + 60000) { const { runDueStatuses } = await import('./statusPublisher'); await runDueStatuses(); }
        return;
    }
    const m = /^status-cancel:(.+)$/.exec(path);
    if (m) {
        const r = await c.db.scheduledStatus.updateMany({ where: { id: m[1], status: { in: ['PENDING', 'SCHEDULED', 'FAILED'] } }, data: { status: 'CANCELLED', errorMessage: 'Cancelado pelo WhatsApp (admin)' } });
        if (!r.count) throw new Error('Status já publicado ou cancelado');
        return;
    }
    throw new Error('Ação desconhecida');
}

// ───────── Roteamento ─────────
export async function handleAdmin(ev: BotEvent, ctx: Ctx, st: St, admin: Admin, deps: { db?: any; notifyAdmins?: (t: string, b: string) => Promise<unknown> } = {}) {
    const db = deps.db || prisma;
    const now = ctx.now || new Date();
    const say = (text: string) => ctx.send({ text });
    const ask = (text: string, opts: Button[] = []) => { st.options = opts; return opts.length ? ctx.send(opts.length <= 3 ? { text: `${text}\n\n${opts.map((o, i) => `${i + 1}. ${o.title}`).join('\n')}`, buttons: opts } : { text: `${text}\n\n${opts.map((o, i) => `${i + 1}. ${o.title}`).join('\n')}`, buttonText: 'Ver opções', sections: [{ title: 'Opções', rows: opts.slice(0, 10).map(o => ({ id: o.id, title: o.title.slice(0, 24) })) }] }) : ctx.send({ text }); };
    const c: AdminCtx = { ctx, st, admin, db, ask, say, api: (m, p, d) => panel(admin.userId, m, p, d, db) };
    const text = ev.kind === 'text' ? ev.text.trim() : '';
    const id = ev.kind === 'action' ? ev.id : '';
    const audit = (action: string, entityId: string, details: string) => db.auditLog.create({ data: { userId: admin.userId, userName: 'Admin WhatsApp', action, entity: 'WA_ADMIN', entityId, details: `${details} · tel ***${admin.phone.slice(-4)}` } }).catch(() => {});
    const notify = (t: string) => (deps.notifyAdmins || (async (title: string, body: string) => { const { sendPushToRole } = await import('../routes/push'); return sendPushToRole('ADMIN', title, body); }))('🛠️ Ação pelo WhatsApp', t).catch(() => {});

    // Bloqueio por tentativas
    if (admin.lockedUntil && admin.lockedUntil > now) return void (await say(`🔒 Acesso bloqueado até ${admin.lockedUntil.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo' })} por tentativas de PIN.`));

    // Primeiro acesso: criar PIN
    if (!admin.pinHash) {
        if (st.step !== 'ADM_PIN_NEW') { st.step = 'ADM_PIN_NEW'; return void (await say('🔐 *Primeiro acesso de administrador.*\nCrie um *PIN de 6 dígitos* (não use datas nem 123456).')); }
        if (!/^\d{6}$/.test(text) || /^(\d)\1{5}$/.test(text) || ['123456', '654321', '012345'].includes(text)) return void (await say('PIN fraco ou inválido. Digite 6 números diferentes de sequências.'));
        await db.waAdminPhone.update({ where: { phone: admin.phone }, data: { pinHash: await bcrypt.hash(text, 12), pinTries: 0, sessionUntil: new Date(now.getTime() + SESSION_MIN * 60000) } });
        await audit('WA_ADMIN_PIN_SET', admin.phone.slice(-4), 'PIN criado');
        await say('✅ PIN criado. *Apague a mensagem com o PIN* desta conversa.');
        return adminMenu(c);
    }

    const checkPin = async (pin: string) => {
        if (await bcrypt.compare(pin, admin.pinHash!)) { await db.waAdminPhone.update({ where: { phone: admin.phone }, data: { pinTries: 0, sessionUntil: new Date(now.getTime() + SESSION_MIN * 60000) } }); return true; }
        const tries = admin.pinTries + 1;
        await db.waAdminPhone.update({ where: { phone: admin.phone }, data: { pinTries: tries, ...(tries >= MAX_TRIES ? { lockedUntil: new Date(now.getTime() + LOCK_MIN * 60000), pinTries: 0, sessionUntil: null } : {}) } });
        await audit('WA_ADMIN_PIN_FAIL', admin.phone.slice(-4), `tentativa ${tries}`);
        if (tries >= MAX_TRIES) { await notify(`PIN errado ${MAX_TRIES}x no número ***${admin.phone.slice(-4)}. Bloqueado por ${LOCK_MIN} min.`); await say(`🔒 PIN errado ${MAX_TRIES} vezes. Bloqueado por ${LOCK_MIN} minutos.`); }
        else await say(`PIN incorreto. Restam ${MAX_TRIES - tries} tentativa(s).`);
        return false;
    };

    // Sessão expirada: pede PIN
    const active = admin.sessionUntil && admin.sessionUntil > now;
    if (!active) {
        if (st.step === 'ADM_PIN' && /^\d{6}$/.test(text)) { if (!(await checkPin(text))) return; await audit('WA_ADMIN_LOGIN', admin.phone.slice(-4), 'entrou'); return adminMenu(c); }
        st.step = 'ADM_PIN'; st.options = [];
        return void (await say('🔐 Painel do administrador. Digite seu *PIN*.'));
    }
    await db.waAdminPhone.update({ where: { phone: admin.phone }, data: { sessionUntil: new Date(now.getTime() + SESSION_MIN * 60000) } });

    // Ação sensível aguardando PIN
    if (st.step === 'ADM_CONFIRM_PIN') {
        if (!/^\d{6}$/.test(text)) { await say('Ação cancelada.'); return adminMenu(c); }
        if (!(await checkPin(text))) return;
        const p = st.data.pending as { method: any; path: string; body?: any; label: string; back?: string };
        try {
            if (p.method === 'local') await statusLocal(c, p.path, p.body); else await c.api(p.method, p.path, p.body);
            await audit('WA_ADMIN_ACTION', p.path, p.label);
            await notify(`${p.label} (pelo WhatsApp, ***${admin.phone.slice(-4)})`);
            await say(`✅ ${p.label} — feito.`);
        } catch (e: any) { await say(`⚠️ ${e.message}`); }
        if (p.back === 'req') return listRequests(c);
        if (p.back === 'rcp') return listReceipts(c);
        if (p.back === 'disp') return disputes(c);
        if (p.back === 'status') return statusList(c);
        if (p.back === 'more') return moreMenu(c);
        return adminMenu(c);
    }
    const sensitive = async (method: any, path: string, body: any, label: string, back?: string) => {
        st.step = 'ADM_CONFIRM_PIN'; st.data = { ...st.data, pending: { method, path, body, label, back } }; st.options = [];
        await say(`⚠️ Confirmar: *${label}*?\nDigite seu *PIN* para confirmar, ou qualquer outra coisa para cancelar.`);
    };

    try {
        if (/^(menu|0|painel)$/i.test(text) || id === 'adm:menu') return await adminMenu(c);
        if (id === 'adm:exit' || /^sair$/i.test(text)) { await db.waAdminPhone.update({ where: { phone: admin.phone }, data: { sessionUntil: null } }); return void (await say('🔒 Sessão encerrada.')); }
        if (id === 'adm:dash') return await dashboard(c);
        if (id === 'adm:req') return await listRequests(c);
        if (id === 'adm:rcp') return await listReceipts(c);
        if (id === 'adm:cust') return await searchCustomer(c);
        if (id === 'adm:late') return await lateList(c);
        if (id === 'adm:disp') return await disputes(c);
        if (id === 'adm:more') return await moreMenu(c);
        if (id === 'adm:status') return await statusStart(c);
        if (st.step.startsWith('ADM_ST_') || id === 'st:list') return await statusFlow(c, ev, sensitive, ctx.media);
        if (id.startsWith('more:')) return await runMore(c, id.slice(5), sensitive);

        if (st.step === 'ADM_REQ' && /^req:\d+$/.test(id)) return await showRequest(c, st.data.ids[Number(id.slice(4))]);
        if (st.step === 'ADM_REQ_ONE') {
            const rid = st.data.id;
            if (id === 'act:approve') return await sensitive('put', `/loan-requests/${rid}/approve`, {}, 'Aprovar solicitação', 'req');
            if (id === 'act:reject') return await sensitive('put', `/loan-requests/${rid}/reject`, {}, 'Recusar solicitação', 'req');
            if (id === 'act:pause') {
                const all: any[] = await c.api('get', '/loan-requests'); const r = all.find(x => x.id === rid);
                return await sensitive('put', `/loan-requests/${rid}/${r?.status === 'PAUSED' ? 'resume' : 'pause'}`, r?.status === 'PAUSED' ? {} : { reason: 'Pausado pelo WhatsApp (admin)' }, r?.status === 'PAUSED' ? 'Retomar solicitação' : 'Pausar solicitação', 'req');
            }
            if (id === 'act:values') { st.step = 'ADM_REQ_VALUES'; return void (await say('Novo *valor* e *parcelas* (ex.: "1200 2").')); }
            if (id === 'act:cancel') { st.step = 'ADM_REQ_CANCEL'; return void (await say('Motivo do cancelamento (o pedido vira CANCELADO, não é apagado):')); }
            if (id === 'act:docs') { st.step = 'ADM_REQ_DOCS'; return void (await say('Quais documentos pedir ao cliente? Escreva a mensagem (ex.: "Reenvie o comprovante de renda legível").')); }
            if (id === 'act:counter') { st.step = 'ADM_REQ_COUNTER'; return void (await say('Contraproposta: digite *valor* e *parcelas* (ex.: "800 1" ou "1500 2").')); }
        }
        if (st.step === 'ADM_REQ_DOCS' && text) return await sensitive('put', `/loan-requests/${st.data.id}/supplemental`, { description: text.slice(0, 1000) }, 'Pedir documentos complementares', 'req');
        if (st.step === 'ADM_REQ_CANCEL' && text) return await sensitive('delete', `/loan-requests/${st.data.id}`, { reason: text.slice(0, 500) }, 'Cancelar solicitação', 'req');
        if (st.step === 'ADM_REQ_VALUES' && text) {
            const m = text.replace(/r\$/i, '').trim().match(/^([\d.,]+)\s+(\d{1,3})$/);
            const amount = m ? Number(m[1].replace(/\./g, '').replace(',', '.')) : NaN;
            if (!m || !(amount > 0)) return void (await say('Formato: valor e parcelas, ex.: "1200 2".'));
            return await sensitive('put', `/loan-requests/${st.data.id}/values`, { amount, installments: Number(m[2]) }, `Ajustar valores para ${money(amount)} em ${m[2]}x`, 'req');
        }
        if (st.step === 'ADM_REQ_COUNTER' && text) {
            const m = text.replace(/r\$/i, '').trim().match(/^([\d.,]+)\s+(\d{1,3})$/);
            const amount = m ? Number(m[1].replace(/\./g, '').replace(',', '.')) : NaN;
            if (!m || !(amount > 0)) return void (await say('Formato: valor e parcelas, ex.: "800 1".'));
            return await sensitive('put', `/loan-requests/${st.data.id}/approve-with-counteroffer`, { approvedAmount: amount, installments: Number(m[2]) }, `Contraproposta de ${money(amount)} em ${m[2]}x`, 'req');
        }

        if (st.step === 'ADM_DISP' && /^dsp:\d+$/.test(id)) return await showDispute(c, Number(id.slice(4)));
        if (st.step === 'ADM_DISP_ONE' && /^dsp:(IN_REVIEW|WAITING_DOCS|RESOLVED)$/.test(id)) { st.data.newStatus = id.slice(4); st.step = 'ADM_DISP_NOTE'; return void (await say(id.endsWith('RESOLVED') ? 'Escreva a *decisão* (obrigatória; o cliente verá):' : 'Observação (ou envie *-*):')); }
        if (st.step === 'ADM_DISP_NOTE' && text) {
            const note = text === '-' ? '' : text.slice(0, 1000);
            if (st.data.newStatus === 'RESOLVED' && note.length < 5) return void (await say('A decisão precisa de um texto.'));
            return await sensitive('patch', `/legacy-ops/disputes/${st.data.cur.id}`, { status: st.data.newStatus, note, ...(st.data.newStatus === 'RESOLVED' ? { confirm: 'RESOLVER' } : {}) }, `Contestação de ${st.data.cur.name} → ${st.data.newStatus}`, 'disp');
        }
        if (st.step === 'ADM_RCP' && /^rcp:\d+$/.test(id)) return await showReceipt(c, Number(id.slice(4)));
        if (st.step === 'ADM_RCP_ONE') {
            const r = st.data.cur;
            if (id === 'rcp:ok') return await sensitive('put', `/payment-receipts/${r.id}/approve`, {}, `Aprovar comprovante ${money(r.amount)} de ${r.name}`, 'rcp');
            if (id === 'rcp:int') return await sensitive('put', `/payment-receipts/${r.id}/approve`, { isInterestOnly: true }, `Aprovar comprovante (só juros) ${money(r.amount)} de ${r.name}`, 'rcp');
            if (id === 'rcp:dis') return await sensitive('put', `/payment-receipts/${r.id}/approve`, { isDischarge: true }, `Aprovar QUITAÇÃO ${money(r.amount)} de ${r.name}`, 'rcp');
            if (id === 'rcp:no') { st.step = 'ADM_RCP_NO'; return void (await say('Motivo da recusa (o cliente verá):')); }
        }
        if (st.step === 'ADM_RCP_NO' && text) return await sensitive('put', `/payment-receipts/${st.data.cur.id}/reject`, { notes: text }, `Recusar comprovante de ${st.data.cur.name}`, 'rcp');

        if (st.step === 'ADM_CUST_Q' && text) return await searchCustomer(c, text.slice(0, 60));
        if (st.step === 'ADM_CUST' && /^cus:\d+$/.test(id)) return await showCustomer(c, st.data.ids[Number(id.slice(4))]);
        if (st.step === 'ADM_CUST_ONE') {
            if (/^ln:\d+$/.test(id)) return await showLoan(c, st.data.loanIds[Number(id.slice(3))]);
            if (id === 'cus:msg') { st.step = 'ADM_CUST_MSG'; return void (await say('Digite a mensagem para o cliente (sai pelo WhatsApp principal da empresa):')); }
        }
        if (st.step === 'ADM_CUST_MSG' && text) return await sensitive('post', '/webhook/send', { phone: st.data.phone, message: text }, 'Enviar mensagem ao cliente');
        if (st.step === 'ADM_LOAN') {
            if (id === 'ln:link') {
                const l = await db.loan.findUnique({ where: { id: st.data.loanId }, select: { customerId: true } });
                const cu = await db.customer.findUnique({ where: { id: l?.customerId } });
                const { getInfinitePayService } = await import('./infinitepay/infinitepayService');
                try { const ch = await getInfinitePayService().createChargeForCustomer(cu, st.data.loanId, 'interest_only'); await say(`🔗 Link (juros) ${money(ch.amount)}:\n${ch.checkoutUrl}\n\nEncaminhe ao cliente.`); }
                catch (e: any) { await say(`⚠️ ${e.message}`); }
                return await adminMenu(c);
            }
            if (id === 'ln:manual') {
                const list = st.data.installments || [];
                if (!list.length) return void (await say('Nenhuma parcela em aberto.'));
                st.step = 'ADM_LOAN_INST';
                return void (await ask('Qual parcela recebeu?', list.map((i: any, n: number) => ({ id: `in:${n}`, title: `${date(i.due)} ${money(i.amount)}` }))));
            }
            if (id === 'ln:msgoff' || id === 'ln:msgon') return await sensitive('patch', `/collection-automation/loans/${st.data.loanId}/messages`, { suspended: id === 'ln:msgoff' }, id === 'ln:msgoff' ? 'Pausar mensagens de cobrança do contrato' : 'Retomar mensagens de cobrança do contrato');
            if (id === 'ln:pause') {
                const l = await db.loan.findUnique({ where: { id: st.data.loanId }, select: { requestId: true, status: true } });
                if (!l?.requestId) return void (await say('Contrato sem solicitação vinculada; use o painel.'));
                return await sensitive('put', `/loan-requests/${l.requestId}/${l.status === 'PAUSED' ? 'resume' : 'pause'}`, l.status === 'PAUSED' ? {} : { reason: 'Pausado pelo WhatsApp (admin)' }, l.status === 'PAUSED' ? 'Retomar contrato' : 'Pausar contrato');
            }
        }
        if (st.step === 'ADM_LOAN_INST' && /^in:\d$/.test(id)) { st.data.inst = st.data.installments[Number(id.slice(3))]; st.step = 'ADM_LOAN_AMT'; return void (await ask(`Valor recebido? (parcela ${money(st.data.inst.amount)})`, [{ id: 'amt:full', title: `✅ ${money(st.data.inst.amount)}` }])); }
        if (st.step === 'ADM_LOAN_AMT' && (id === 'amt:full' || text)) {
            const amount = id === 'amt:full' ? Number(st.data.inst.amount) : Number(text.replace(/r\$/i, '').trim().replace(/\./g, '').replace(',', '.'));
            if (!(amount > 0)) return void (await say('Valor inválido.'));
            st.data.amount = amount; st.step = 'ADM_LOAN_METHOD';
            return void (await ask('Forma de pagamento:', [{ id: 'pm:PIX', title: 'PIX' }, { id: 'pm:DINHEIRO', title: 'Dinheiro' }, { id: 'pm:MANUAL', title: 'Outro' }]));
        }
        if (st.step === 'ADM_LOAN_METHOD' && /^pm:(PIX|DINHEIRO|MANUAL)$/.test(id)) return await sensitive('post', `/loans/${st.data.loanId}/manual-payment`, { installmentId: st.data.inst.id, amount: st.data.amount, paymentMethod: id.slice(3), notes: 'Baixa pelo WhatsApp (admin)' }, `Baixa manual de ${money(st.data.amount)} (${id.slice(3)})`);
        if (st.step === 'ADM_CUST_ONE' && id === 'cus:block') return await sensitive('put', `/customers/${st.data.id}/status`, { status: 'BLOCKED' }, 'Bloquear cliente');
        if (st.step === 'ADM_CUST_ONE' && id === 'cus:unblock') return await sensitive('put', `/customers/${st.data.id}/status`, { status: 'ACTIVE' }, 'Desbloquear cliente');
        if (st.step === 'ADM_BL_ADD' && text) {
            const m = text.match(/^(\d{11})\s+(.{3,})$/);
            if (!m) return void (await say('Formato: CPF (11 números) e motivo. Ex.: 52998224725 fraude documental'));
            return await sensitive('post', '/admin/blacklist', { cpf: m[1], name: m[1], reason: m[2].slice(0, 200) }, `Incluir CPF ***${m[1].slice(-4)} na blacklist`, 'more');
        }
        if (st.step === 'ADM_FRAUD' && /^blk:\d$/.test(id)) { const b = st.data.blocks[Number(id.slice(4))]; return await sensitive('put', `/antifraud/security-block/${b.id}/resolve`, { resolved_by: 'Admin (WhatsApp)', resolution_notes: 'Liberado pelo WhatsApp' }, `Liberar bloqueio de segurança (${b.reason})`, 'more'); }
        if (st.step === 'ADM_PHONE' && /^pha:\d$/.test(id)) { st.data.app = st.data.apps[Number(id.slice(4))]; st.step = 'ADM_PHONE_ONE'; return void (await ask(`📱 Proposta ${st.data.app.protocol} — ${st.data.app.status}`, [{ id: 'phs:under_review', title: '🔍 Em análise' }, { id: 'phs:awaiting_documents', title: '📎 Pedir documentos' }, { id: 'phs:approved', title: '✅ Aprovar' }, { id: 'phs:rejected', title: '❌ Recusar' }])); }
        if (st.step === 'ADM_PHONE_ONE' && /^phs:\w+$/.test(id)) { st.data.phs = id.slice(4); st.step = 'ADM_PHONE_REASON'; return void (await say('Motivo/observação (obrigatório para recusar):')); }
        if (st.step === 'ADM_PHONE_REASON' && text) return await sensitive('patch', `/admin/phone-financing/applications/${st.data.app.id}/status`, { status: st.data.phs, reason: text.slice(0, 500) }, `Proposta de celular ${st.data.app.protocol} → ${st.data.phs}`, 'more');
        if (st.step === 'ADM_COMM' && /^com:\d$/.test(id)) { const p = st.data.payables[Number(id.slice(4))]; return await sensitive('post', `/partners/commissions/${p.id}/pay`, { paymentMethod: 'PIX', paymentReference: 'WhatsApp admin' }, `Marcar comissão de ${money(p.amount)} como paga`, 'more'); }
        await adminMenu(c);
    } catch (e: any) {
        await say(`⚠️ ${e?.message || 'Erro'}`);
        await adminMenu(c);
    }
}

// ───────── Demais telas do painel (rotas reais do painel) ─────────
type More = { id: string; title: string; run: (c: AdminCtx) => Promise<boolean | void> };
const MORE: More[] = [
    { id: 'finance', title: '💰 Financeiro', run: async c => {
        const d: any = await c.api('get', '/finance/dashboard');
        await c.say(`💰 *Financeiro*\n\nContratos: *${d.loans}*\nEmprestado: ${money(d.amountInvested)}\nRecebido: ${money(d.amountPaid)}\nA receber: ${money(d.amountPending)}`);
    } },
    { id: 'legacy', title: '👴 Clientes antigos', run: async c => {
        const d: any = await c.api('get', '/legacy-ops/dashboard');
        await c.say(`👴 *Clientes antigos*\n\nTotal: *${d.total}* · com conta: ${d.withAccount} · aguardando: ${d.waiting}\nContratos ativos: ${d.activeLoans} · quitados: ${d.settledLoans}\nA revisar: ${d.pendingReview} · contestações: ${d.openDisputes}\nLembretes programados (7 dias): ${d.remindersScheduled}\nMensagens 30 dias: ${d.sent30} enviadas · ${d.failed30} falhas`);
    } },
    { id: 'collect', title: '📣 Régua de cobrança', run: async c => {
        const d: any = await c.api('get', '/collection-automation/stats').catch(() => null);
        await c.say(d ? `📣 *Régua de cobrança*\n\n${Object.entries(d).filter(([, v]) => typeof v !== 'object').slice(0, 10).map(([k, v]) => `• ${k}: ${v}`).join('\n')}\n\nPara pausar a régua de um contrato: Buscar cliente › contrato › Pausar mensagens.` : 'Sem dados da régua.');
    } },
    { id: 'investors', title: '📈 Investidores', run: async c => {
        const all: any[] = await c.api('get', '/loan-requests');
        const inv = all.filter(r => r.profileType === 'INVESTIDOR').slice(0, 10);
        await c.say(inv.length ? `📈 *Investidores*\n\n${inv.map((r, i) => `${i + 1}. ${r.clientName} — ${money(r.amount)} — ${STATUS_LABEL[r.status] || r.status}`).join('\n')}\n\nAprovar/recusar: menu › Solicitações.` : 'Nenhum investidor.');
    } },
    { id: 'phones', title: '📱 Celulares', run: async c => {
        const d: any = await c.api('get', '/admin/phone-financing/applications?status=submitted').catch((e: any) => ({ error: e.message }));
        const apps: any[] = (d?.applications || d?.items || []).slice(0, 9);
        if (d?.error || !apps.length) { await c.say(d?.error ? `📱 ${d.error}` : '📱 Nenhuma proposta de celular aguardando.'); return; }
        c.st.step = 'ADM_PHONE'; c.st.data = { apps: apps.map(a => ({ id: a.id, protocol: a.protocol, status: a.status })) };
        await c.ask('📱 *Propostas de celular*', apps.map((a, i) => ({ id: `pha:${i}`, title: `${a.protocol} ${a.customer?.name || ''}`.slice(0, 24) })));
        return true;
    } },
    { id: 'fraud', title: '🛡️ Antifraude', run: async c => {
        const rows: any[] = (await c.api('get', '/antifraud/security-blocks?resolved=false').catch(() => [])).slice(0, 9);
        if (!rows.length) { await c.say('🛡️ Nenhum bloqueio de segurança pendente.'); return; }
        c.st.step = 'ADM_FRAUD'; c.st.data = { blocks: rows.map(b => ({ id: b.id, reason: b.block_reason })) };
        await c.ask(`🛡️ *Bloqueios pendentes*\n\n${rows.map((b, i) => `${i + 1}. ${b.block_reason || '-'} (${date(b.blocked_at || b.created_at)})`).join('\n')}\n\nToque para liberar:`, rows.map((_b, i) => ({ id: `blk:${i}`, title: `Liberar ${i + 1}` })));
        return true;
    } },
    { id: 'blacklist', title: '🚫 Blacklist', run: async c => {
        const rows: any[] = await c.api('get', '/admin/blacklist').catch(() => []);
        c.st.step = 'ADM_BL_ADD';
        await c.say(`🚫 *Blacklist* (${rows.length})\n\n${rows.slice(0, 10).map((r: any) => `• ${mask(r.cpf)} — ${String(r.reason || '').slice(0, 50)}`).join('\n') || 'vazia'}\n\nPara incluir, envie: *CPF motivo* (ou *menu* para voltar).`);
        return true;
    } },
    { id: 'partners', title: '🤝 Parceiros', run: async c => {
        const rows: any = await c.api('get', '/partners').catch(() => []);
        const list: any[] = (Array.isArray(rows) ? rows : rows?.partners || []).slice(0, 5);
        const payables: any[] = [];
        for (const p of list) {
            const cm: any = await c.api('get', `/partners/${p.id}/commissions`).catch(() => []);
            for (const x of (Array.isArray(cm) ? cm : cm?.commissions || [])) if (x.status === 'PENDING' && payables.length < 9) payables.push({ id: x.id, amount: x.amount, name: p.name });
        }
        if (!payables.length) { await c.say(`🤝 Parceiros: ${list.length}. Nenhuma comissão pendente.`); return; }
        c.st.step = 'ADM_COMM'; c.st.data = { payables };
        await c.ask(`🤝 *Comissões pendentes*\n\n${payables.map((p, i) => `${i + 1}. ${p.name} — ${money(p.amount)}`).join('\n')}\n\nMarcar como paga:`, payables.map((_p, i) => ({ id: `com:${i}`, title: `Pagar ${i + 1}` })));
        return true;
    } },
    { id: 'whatsapp', title: '📶 Status WhatsApp', run: async c => {
        const h: any = await c.api('get', '/inbox/health').catch(() => null);
        await c.say(`📶 WhatsApp principal: *${h?.state || 'desconhecido'}*\nÚltima recebida: ${h?.lastInboundAt ? new Date(h.lastInboundAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '-'}\nPainéis abertos: ${h?.realtimeClients ?? '-'}`);
    } },
    { id: 'audit', title: '🧾 Auditoria', run: async c => {
        const rows = await c.db.auditLog.findMany({ orderBy: { timestamp: 'desc' }, take: 12, select: { action: true, userName: true, timestamp: true } }).catch(() => []);
        await c.say(`🧾 *Últimas ações*\n\n${rows.map((r: any) => `• ${new Date(r.timestamp).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })} — ${r.userName}: ${r.action}`).join('\n')}`);
    } },
];
async function moreMenu(c: AdminCtx) { c.st.step = 'ADM_MORE'; c.st.data = {}; await c.ask('➕ *Mais opções*', [...MORE.map(m => ({ id: `more:${m.id}`, title: m.title })), { id: 'adm:menu', title: '⬅️ Menu' }]); }
async function runMore(c: AdminCtx, id: string, _sensitive: any) { const m = MORE.find(x => x.id === id); if (!m) return adminMenu(c); const keep = await m.run(c); if (!keep) await moreMenu(c); }
