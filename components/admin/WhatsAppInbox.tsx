import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Search, Send, Paperclip, Mic, Square, X, ChevronLeft, User, Bot, UserCheck, ArrowRightLeft, CheckCheck, Check, Clock, AlertTriangle, Archive, RotateCcw, PanelRightOpen, PanelRightClose, Zap, Smile, RefreshCw, Wifi, WifiOff, FileText, Play, Download, Link2, Reply } from 'lucide-react';
import { api } from '../../services/apiClient';
import { connectInbox } from '../../services/inboxRealtime';
import { getApiBaseUrl } from '../../services/runtimeConfig';

// Central WhatsApp em tempo real: lista · conversa · ficha (3 colunas no desktop, 3 telas no celular).

type Conv = { id: string; remoteJid: string; phone: string | null; name: string | null; profilePicUrl: string | null; mode: string; assignedTo: string | null; operatorName: string | null; unreadCount: number; lastMessageAt: string | null; lastMessagePreview: string | null; lastMessageFromMe: boolean | null; archived: boolean; version: number; customer: null | { id: string; name: string; isLegacy: boolean; hasAccount: boolean; confirmed: boolean }; phoneMatches?: number };
type Msg = { id: string; conversationId: string; externalId: string; fromMe: boolean; origin: string; senderName?: string | null; type: string; text: string | null; mediaMime: string | null; mediaName: string | null; quotedExternalId: string | null; status: string; error: string | null; timestamp: string; imported: boolean };

const MODE: Record<string, { label: string; cls: string }> = {
  AI_ACTIVE: { label: 'IA atendendo', cls: 'bg-purple-900/50 text-purple-200' },
  WAITING_HUMAN: { label: 'Aguardando atendente', cls: 'bg-amber-900/60 text-amber-200' },
  HUMAN_ACTIVE: { label: 'Humano atendendo', cls: 'bg-green-900/60 text-green-200' },
  CLOSED: { label: 'Finalizada', cls: 'bg-zinc-800 text-zinc-400' },
};
const ORIGIN: Record<string, string> = { CLIENTE: 'Cliente', IA: 'IA', HUMANO: 'Atendente', AUTOMACAO: 'Automação', DISPOSITIVO_EXTERNO: 'Celular da empresa', ORIGEM_DESCONHECIDA: 'Origem não identificada' };
const FILTERS: [string, string][] = [['all', 'Todas'], ['unread', 'Não lidas'], ['waiting', 'Aguardando'], ['ai', 'IA'], ['human', 'Humano'], ['mine', 'Meus'], ['unassigned', 'Sem responsável'], ['closed', 'Finalizadas'], ['archived', 'Arquivadas']];
const EMOJIS = ['😀', '😊', '😉', '🙏', '👍', '👏', '🙌', '✅', '❤️', '🎉', '🤝', '📄', '💰', '📅', '⏰', '😅', '🙂', '😃'];
const errMsg = (e: any) => (typeof e === 'string' ? e : e?.error || 'Erro');
const fmtPhone = (p?: string | null) => { if (!p) return ''; const d = p.replace(/\D/g, ''); return d.length === 13 ? `(${d.slice(2, 4)}) ${d.slice(4, 9)}-${d.slice(9)}` : d.length === 12 ? `(${d.slice(2, 4)}) ${d.slice(4, 8)}-${d.slice(8)}` : p; };
const when = (s?: string | null) => { if (!s) return ''; const d = new Date(s), now = new Date(); return d.toDateString() === now.toDateString() ? d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }); };
const reqId = () => (crypto as any).randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const me = () => { if (import.meta.env.VITE_DEMO_MODE === 'true') return 'admin-demo'; try { const t = JSON.parse(localStorage.getItem('tubarao_auth') || '{}').accessToken; return JSON.parse(atob(t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).id as string; } catch { return ''; } };

function StatusIcon({ s }: { s: string }) {
  if (s === 'READ') return <CheckCheck size={14} className="text-sky-400" aria-label="Lida" />;
  if (s === 'DELIVERED') return <CheckCheck size={14} className="text-zinc-400" aria-label="Entregue" />;
  if (s === 'SENT') return <Check size={14} className="text-zinc-400" aria-label="Enviada" />;
  if (s === 'PENDING') return <Clock size={13} className="text-zinc-400" aria-label="Enviando" />;
  if (s === 'FAILED') return <AlertTriangle size={14} className="text-red-400" aria-label="Falha" />;
  return <span className="text-[10px] text-zinc-500" aria-label="Status desconhecido">?</span>;
}

export function WhatsAppInbox() {
  const [filter, setFilter] = useState('all');
  const [q, setQ] = useState('');
  const [convs, setConvs] = useState<Conv[]>([]);
  const [nextBefore, setNextBefore] = useState<string | null>(null);
  const [sel, setSel] = useState<Conv | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [view, setView] = useState<'list' | 'chat' | 'info'>('list'); // celular
  const [panel, setPanel] = useState(true); // desktop
  const [rt, setRt] = useState<'online' | 'reconnecting' | 'polling'>('reconnecting');
  const [health, setHealth] = useState<any>(null);
  const [dash, setDash] = useState<any>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [sound, setSound] = useState(() => { try { return localStorage.getItem('inbox_sound') !== 'off'; } catch { return true; } });
  const selRef = useRef<Conv | null>(null); selRef.current = sel;
  const myId = useMemo(me, []);

  const loadConvs = useCallback(async (append = false) => {
    const { data } = await api.get<any>(`/inbox/conversations?filter=${filter}${q ? `&q=${encodeURIComponent(q)}` : ''}${append && nextBefore ? `&before=${encodeURIComponent(nextBefore)}` : ''}`);
    if (!data) return;
    setConvs(prev => append ? [...prev, ...data.items.filter((i: Conv) => !prev.some(p => p.id === i.id))] : data.items);
    setNextBefore(data.nextBefore);
  }, [filter, q, nextBefore]);
  const loadMeta = useCallback(async () => {
    const [h, d] = await Promise.all([api.get<any>('/inbox/health'), api.get<any>('/inbox/dashboard')]);
    if (h.data) setHealth(h.data); if (d.data) setDash(d.data);
  }, []);

  useEffect(() => { const t = setTimeout(() => loadConvs(false), q ? 300 : 0); return () => clearTimeout(t); }, [filter, q]);
  useEffect(() => { loadMeta(); const t = setInterval(loadMeta, 60000); return () => clearInterval(t); }, [loadMeta]);

  const upsertConv = (c: Conv) => setConvs(prev => {
    const rest = prev.filter(p => p.id !== c.id);
    const merged = { ...(prev.find(p => p.id === c.id) || {}), ...c } as Conv;
    return [merged, ...rest].sort((a, b) => +new Date(b.lastMessageAt || 0) - +new Date(a.lastMessageAt || 0));
  });
  const upsertMsg = (m: Msg, replaces?: string) => setMsgs(prev => {
    if (selRef.current?.id !== m.conversationId) return prev;
    const rest = prev.filter(p => p.id !== m.id && p.id !== replaces);
    return [...rest, m].sort((a, b) => +new Date(a.timestamp) - +new Date(b.timestamp));
  });

  const beep = () => { if (!sound) return; try { const ctx = new (window.AudioContext || (window as any).webkitAudioContext)(); const o = ctx.createOscillator(); o.frequency.value = 880; o.connect(ctx.destination); o.start(); o.stop(ctx.currentTime + 0.12); } catch { /* sem áudio */ } };
  const notify = (title: string) => { setToast(title); setTimeout(() => setToast(null), 5000); };

  useEffect(() => connectInbox(ev => {
    if (ev.type === 'sync') { (ev.conversations || []).forEach((c: Conv) => upsertConv(c)); (ev.messages || []).forEach((m: Msg) => upsertMsg(m)); return; }
    if (ev.type === 'conversation.created' || ev.type === 'conversation.updated') {
      // Evento leve: dados de vínculo/operador vêm do servidor ao reabrir a conversa.
      setConvs(prev => { const old = prev.find(p => p.id === ev.conversation.id); return old || ev.type === 'conversation.created' ? [{ ...(old || { customer: null, operatorName: null }), ...ev.conversation }, ...prev.filter(p => p.id !== ev.conversation.id)].sort((a, b) => +new Date(b.lastMessageAt || 0) - +new Date(a.lastMessageAt || 0)) : [ev.conversation, ...prev]; });
      if (selRef.current?.id === ev.conversation.id) setSel(s => s ? { ...s, ...ev.conversation } : s);
    }
    if (ev.type === 'message.created' || ev.type === 'message.updated' || ev.type === 'message.status') {
      upsertMsg(ev.message, ev.replaces);
      if (ev.type === 'message.created' && !ev.message.fromMe && !ev.message.imported) {
        if (selRef.current?.id === ev.conversationId && document.visibilityState === 'visible') api.post(`/inbox/conversations/${ev.conversationId}/read`, {});
        else beep();
      }
    }
    if (ev.type === 'notify.human_requested') { beep(); notify(`🙋 ${ev.name || 'Um cliente'} pediu atendimento humano`); }
    if (ev.type === 'conversation.assigned' && ev.assignedTo === myId) { beep(); notify(`↪ ${ev.by} transferiu uma conversa para você`); }
    if (ev.type === 'notify.send_failed') notify('⚠️ Uma mensagem não foi enviada');
    if (ev.type === 'instance.connection') { setHealth((h: any) => ({ ...(h || {}), state: ev.state })); if (ev.state !== 'open') notify('⚠️ WhatsApp da empresa desconectado'); }
  }, setRt), [myId, sound]);

  const open = async (c: Conv) => {
    setSel(c); setView('chat'); setMsgs([]);
    const [m, full] = await Promise.all([api.get<any>(`/inbox/conversations/${c.id}/messages?limit=50`), api.get<any>(`/inbox/conversations/${c.id}`)]);
    if (m.data) { setMsgs(m.data.items); setHasMore(m.data.hasMore); }
    if (full.data) { setSel(full.data.conversation); upsertConv(full.data.conversation); }
    if (c.unreadCount) { api.post(`/inbox/conversations/${c.id}/read`, {}); setConvs(prev => prev.map(p => p.id === c.id ? { ...p, unreadCount: 0 } : p)); }
  };
  const older = async () => {
    if (!sel || !msgs.length) return;
    const { data } = await api.get<any>(`/inbox/conversations/${sel.id}/messages?limit=50&before=${encodeURIComponent(msgs[0].timestamp)}`);
    if (data) { setMsgs(prev => [...data.items, ...prev]); setHasMore(data.hasMore); }
  };
  const act = async (path: string, body: any = {}) => {
    if (!sel) return;
    const { data, error } = await api.post<any>(`/inbox/conversations/${sel.id}/${path}`, { version: sel.version, ...body });
    if (error) { notify(`⚠️ ${errMsg(error)}`); const r = await api.get<any>(`/inbox/conversations/${sel.id}`); if (r.data) setSel(r.data.conversation); return; }
    setSel(s => s ? { ...s, ...data.conversation } : s); upsertConv({ ...sel, ...data.conversation });
  };

  const instOk = !health || health.state === 'open';
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 text-white">
      {/* Barra de estado */}
      <div className="flex flex-wrap items-center gap-2 border-b border-zinc-800 px-3 py-2 text-xs">
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 ${instOk ? 'bg-green-900/50 text-green-200' : 'bg-red-900/60 text-red-200'}`}>{instOk ? <Wifi size={12} /> : <WifiOff size={12} />} WhatsApp {health?.state === 'open' ? 'conectado' : health?.state === 'unreachable' ? 'sem resposta' : health ? (health.state === 'connecting' ? 'reconectando' : 'desconectado') : '…'}</span>
        <span className={`rounded-full px-2 py-1 ${rt === 'online' ? 'bg-zinc-800 text-green-300' : 'bg-zinc-800 text-amber-300'}`}>{rt === 'online' ? 'Tempo real ativo' : rt === 'polling' ? 'Atualizando a cada 45 s' : 'Reconectando…'}</span>
        {dash && <span className="text-zinc-400 hidden sm:inline">Hoje: {dash.receivedToday} recebidas · {dash.sentToday} enviadas · {dash.waiting} aguardando · {dash.human} com humano{dash.failed ? ` · ${dash.failed} falhas` : ''}</span>}
        <label className="ml-auto inline-flex items-center gap-1 text-zinc-400"><input type="checkbox" checked={sound} onChange={e => { setSound(e.target.checked); try { localStorage.setItem('inbox_sound', e.target.checked ? 'on' : 'off'); } catch { /* ok */ } }} /> Som</label>
      </div>
      {!instOk && <div role="alert" className="bg-red-900/40 px-3 py-2 text-sm text-red-200">O WhatsApp da empresa está desconectado: mensagens novas não chegam e envios vão falhar. Verifique a conexão em Configurações do WhatsApp.</div>}
      {toast && <div role="status" className="bg-[#D4AF37] px-3 py-2 text-sm font-semibold text-black">{toast}</div>}

      <div className="flex min-h-0 flex-1">
        {/* Coluna 1 — conversas */}
        <aside className={`${view === 'list' ? 'flex' : 'hidden'} md:flex w-full md:w-[340px] lg:w-[360px] shrink-0 flex-col border-r border-zinc-800 min-h-0`} aria-label="Conversas">
          <div className="space-y-2 border-b border-zinc-800 p-2">
            <div className="relative"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar nome, telefone ou mensagem" aria-label="Buscar conversas" className="w-full min-h-[44px] rounded-lg border border-zinc-700 bg-black pl-9 pr-3 text-base outline-none focus:border-[#D4AF37]" /></div>
            <div className="flex gap-1 overflow-x-auto pb-1" role="tablist">
              {FILTERS.map(([k, l]) => <button key={k} role="tab" aria-selected={filter === k} onClick={() => setFilter(k)} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${filter === k ? 'bg-[#D4AF37] text-black' : 'bg-zinc-800 text-zinc-300'}`}>{l}{k === 'waiting' && dash?.waiting ? ` (${dash.waiting})` : ''}{k === 'unread' && dash?.unread ? ` (${dash.unread})` : ''}</button>)}
            </div>
          </div>
          <ul className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {convs.map(c => (
              <li key={c.id}>
                <button onClick={() => open(c)} className={`flex w-full gap-3 border-b border-zinc-900 px-3 py-3 text-left hover:bg-zinc-900 ${sel?.id === c.id ? 'bg-zinc-900' : ''}`}>
                  <Avatar c={c} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2"><span className="truncate font-semibold">{c.customer?.name || c.name || fmtPhone(c.phone) || 'Contato'}</span><span className={`shrink-0 text-xs ${c.unreadCount ? 'text-green-400' : 'text-zinc-500'}`}>{when(c.lastMessageAt)}</span></div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm text-zinc-400">{c.lastMessageFromMe ? '↗ ' : ''}{c.lastMessagePreview}</span>
                      {c.unreadCount > 0 && <span className="shrink-0 rounded-full bg-green-600 px-2 text-xs font-bold" aria-label={`${c.unreadCount} não lidas`}>{c.unreadCount}</span>}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1 text-[11px]">
                      <span className={`rounded px-1.5 ${MODE[c.mode]?.cls}`}>{MODE[c.mode]?.label}</span>
                      {c.operatorName && <span className="rounded bg-zinc-800 px-1.5 text-zinc-300">{c.operatorName}</span>}
                      {c.customer && <span className="rounded bg-zinc-800 px-1.5 text-[#D4AF37]">{c.customer.isLegacy ? 'Cliente antigo' : 'Cliente'}{c.customer.confirmed ? '' : ' ?'}</span>}
                    </div>
                  </div>
                </button>
              </li>
            ))}
            {!convs.length && <li className="p-6 text-center text-sm text-zinc-500">Nenhuma conversa neste filtro. {filter === 'all' && 'Use “Sincronizar histórico” para importar conversas antigas.'}</li>}
            {nextBefore && <li><button onClick={() => loadConvs(true)} className="w-full p-3 text-sm text-zinc-400">Carregar mais</button></li>}
          </ul>
        </aside>

        {/* Coluna 2 — conversa */}
        <section className={`${view === 'chat' ? 'flex' : 'hidden'} md:flex min-w-0 flex-1 flex-col min-h-0`} aria-label="Conversa">
          {sel ? <Chat key={sel.id} conv={sel} msgs={msgs} hasMore={hasMore} onOlder={older} myId={myId} act={act} onBack={() => setView('list')} onInfo={() => { setView('info'); setPanel(true); }} panel={panel} togglePanel={() => setPanel(p => !p)} onSent={upsertMsg} notify={notify} />
            : <div className="flex flex-1 items-center justify-center p-6 text-center text-zinc-500">Selecione uma conversa à esquerda.<br />As novas mensagens aparecem aqui sozinhas.</div>}
        </section>

        {/* Coluna 3 — ficha */}
        {sel && <aside className={`${view === 'info' ? 'flex' : 'hidden'} ${panel ? 'lg:flex' : ''} w-full lg:w-[340px] shrink-0 flex-col border-l border-zinc-800 min-h-0`} aria-label="Ficha do contato">
          <ContactPanel conv={sel} onBack={() => setView('chat')} onLinked={c => { setSel(c); upsertConv(c); }} />
        </aside>}
      </div>
    </div>
  );
}

function Avatar({ c }: { c: Conv }) {
  const [bad, setBad] = useState(false);
  return c.profilePicUrl && !bad ? <img src={c.profilePicUrl} alt="" onError={() => setBad(true)} className="h-11 w-11 shrink-0 rounded-full object-cover" referrerPolicy="no-referrer" />
    : <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#D4AF37] to-yellow-700 font-bold text-black">{(c.customer?.name || c.name || '?').charAt(0).toUpperCase()}</div>;
}

function Chat({ conv, msgs, hasMore, onOlder, myId, act, onBack, onInfo, panel, togglePanel, onSent, notify }: { conv: Conv; msgs: Msg[]; hasMore: boolean; onOlder: () => void; myId: string; act: (p: string, b?: any) => void; onBack: () => void; onInfo: () => void; panel: boolean; togglePanel: () => void; onSent: (m: Msg, r?: string) => void; notify: (s: string) => void }) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [quote, setQuote] = useState<Msg | null>(null);
  const [showEmoji, setShowEmoji] = useState(false);
  const [quick, setQuick] = useState<any[] | null>(null);
  const [transfer, setTransfer] = useState<any[] | null>(null);
  const [rec, setRec] = useState<{ mr: MediaRecorder; chunks: Blob[]; start: number } | null>(null);
  const [audio, setAudio] = useState<{ blob: Blob; url: string; mime: string } | null>(null);
  const bottom = useRef<HTMLDivElement>(null); const fileRef = useRef<HTMLInputElement>(null);
  const lastCount = useRef(0);
  useEffect(() => { if (msgs.length > lastCount.current) bottom.current?.scrollIntoView({ block: 'end' }); lastCount.current = msgs.length; }, [msgs.length]);

  const mine = conv.mode === 'HUMAN_ACTIVE' && conv.assignedTo === myId;
  const other = conv.mode === 'HUMAN_ACTIVE' && conv.assignedTo && conv.assignedTo !== myId;

  const send = async (payload: { text?: string; media?: any }) => {
    if (sending) return;
    setSending(true);
    const clientRequestId = reqId();
    const { data, error } = await api.post<any>(`/inbox/conversations/${conv.id}/send`, { ...payload, clientRequestId, quotedExternalId: quote?.externalId });
    setSending(false);
    if (data?.message) onSent(data.message);
    if (data?.warning) notify(`⚠️ ${data.warning}`);
    if (error) { notify(`⚠️ ${errMsg(error)}`); return false; }
    setQuote(null);
    return true;
  };
  const submit = async (e?: React.FormEvent) => { e?.preventDefault(); if (!text.trim()) return; if (await send({ text })) setText(''); };

  const toB64 = (blob: Blob) => new Promise<string>((ok, ko) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1]); r.onerror = ko; r.readAsDataURL(blob); });
  const onFile = async (f?: File) => {
    if (!f) return;
    if (f.size > 16 * 1024 * 1024) { notify('⚠️ Arquivo acima de 16 MB'); return; }
    const kind = f.type.startsWith('image/') ? 'image' : f.type.startsWith('video/') ? 'video' : f.type.startsWith('audio/') ? 'audio' : 'document';
    await send({ text, media: { base64: await toB64(f), mimetype: f.type || 'application/octet-stream', fileName: f.name, kind } });
    setText(''); if (fileRef.current) fileRef.current.value = '';
  };
  const startRec = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = ['audio/ogg;codecs=opus', 'audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'].find(t => (window as any).MediaRecorder?.isTypeSupported?.(t)) || '';
      const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      const chunks: Blob[] = [];
      mr.ondataavailable = e => e.data.size && chunks.push(e.data);
      mr.onstop = () => { stream.getTracks().forEach(t => t.stop()); const blob = new Blob(chunks, { type: mr.mimeType || mime || 'audio/webm' }); setAudio({ blob, url: URL.createObjectURL(blob), mime: blob.type }); };
      mr.start(); setRec({ mr, chunks, start: Date.now() });
    } catch { notify('⚠️ Sem acesso ao microfone'); }
  };
  const stopRec = () => { rec?.mr.stop(); setRec(null); };
  const sendAudio = async () => { if (!audio) return; if (await send({ media: { base64: await toB64(audio.blob), mimetype: audio.mime.split(';')[0], fileName: 'audio', kind: 'audio' } })) { URL.revokeObjectURL(audio.url); setAudio(null); } };
  const openQuick = async () => { const { data } = await api.get<any>('/inbox/quick-replies'); setQuick(data?.items || []); };
  const fill = (body: string) => { const n = conv.customer?.name || conv.name || ''; setText(body.replace(/\{nome\}/g, n).replace(/\{primeiro_nome\}/g, n.split(' ')[0]).replace(/\{app\}/g, 'https://www.tubaraoemprestimo.com.br')); setQuick(null); };
  const openTransfer = async () => { const { data } = await api.get<any>('/inbox/operators'); setTransfer((data?.items || []).filter((o: any) => o.id !== conv.assignedTo)); };
  const byExt = useMemo(() => new Map(msgs.map(m => [m.externalId, m])), [msgs]);

  let lastDay = '';
  return (
    <>
      <header className="flex items-center gap-2 border-b border-zinc-800 px-2 py-2" style={{ paddingTop: 'max(0.5rem, env(safe-area-inset-top))' }}>
        <button onClick={onBack} aria-label="Voltar para conversas" className="md:hidden flex h-11 w-11 items-center justify-center rounded-lg bg-zinc-900"><ChevronLeft /></button>
        <button onClick={onInfo} className="flex min-w-0 flex-1 items-center gap-2 text-left lg:pointer-events-none">
          <Avatar c={conv} />
          <span className="min-w-0"><span className="block truncate font-semibold">{conv.customer?.name || conv.name || fmtPhone(conv.phone) || 'Contato'}</span>
            <span className="block truncate text-xs text-zinc-400">{fmtPhone(conv.phone) || 'Identificador privado do WhatsApp'} · <span className={`rounded px-1 ${MODE[conv.mode]?.cls}`}>{MODE[conv.mode]?.label}</span>{conv.operatorName ? ` · ${conv.operatorName}` : ''}</span></span>
        </button>
        <button onClick={togglePanel} aria-label={panel ? 'Fechar ficha' : 'Abrir ficha'} className="hidden lg:flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-900">{panel ? <PanelRightClose size={18} /> : <PanelRightOpen size={18} />}</button>
      </header>

      {/* Ações de atendimento */}
      <div className="flex gap-2 overflow-x-auto border-b border-zinc-800 px-2 py-2 text-sm">
        {conv.mode !== 'HUMAN_ACTIVE' && conv.mode !== 'CLOSED' && <Btn onClick={() => act('assume')} cls="bg-[#D4AF37] text-black"><UserCheck size={16} /> Assumir atendimento</Btn>}
        {other && <span className="shrink-0 self-center rounded bg-amber-900/50 px-2 py-1 text-amber-200">Em atendimento por {conv.operatorName}</span>}
        {conv.mode === 'HUMAN_ACTIVE' && <Btn onClick={() => act('return-ai')}><Bot size={16} /> Devolver para IA</Btn>}
        {conv.mode === 'HUMAN_ACTIVE' && <Btn onClick={openTransfer}><ArrowRightLeft size={16} /> Transferir</Btn>}
        {conv.mode === 'HUMAN_ACTIVE' && <Btn onClick={() => act('release')}><User size={16} /> Liberar para a fila</Btn>}
        {conv.mode !== 'CLOSED' ? <Btn onClick={() => act('close')}><Archive size={16} /> Finalizar</Btn> : <Btn onClick={() => act('reopen')} cls="bg-[#D4AF37] text-black"><RotateCcw size={16} /> Reabrir</Btn>}
      </div>

      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain bg-[radial-gradient(circle_at_top,#18181b,#09090b)] px-3 py-3" aria-live="polite">
        {hasMore && <button onClick={onOlder} className="mx-auto mb-2 block rounded-full bg-zinc-800 px-4 py-1.5 text-xs text-zinc-300">Mensagens anteriores</button>}
        {msgs.map(m => {
          const day = new Date(m.timestamp).toLocaleDateString('pt-BR');
          const sep = day !== lastDay ? (lastDay = day, <div key={`d-${day}`} className="my-2 text-center"><span className="rounded-full bg-zinc-800 px-3 py-0.5 text-[11px] text-zinc-400">{day}</span></div>) : null;
          const q = m.quotedExternalId ? byExt.get(m.quotedExternalId) : null;
          return (
            <React.Fragment key={m.id}>
              {sep}
              <div className={`group flex ${m.fromMe ? 'justify-end' : 'justify-start'}`}>
                <div className={`relative max-w-[85%] md:max-w-[70%] rounded-2xl px-3 py-2 shadow ${m.fromMe ? (m.origin === 'HUMANO' ? 'bg-[#2a2510] border border-[#D4AF37]/40' : 'bg-zinc-800') + ' rounded-br-sm' : 'bg-zinc-900 border border-zinc-800 rounded-bl-sm'}`}>
                  {m.fromMe && <p className="mb-0.5 text-[11px] font-semibold text-[#D4AF37]">{m.origin === 'HUMANO' && m.senderName ? m.senderName : ORIGIN[m.origin] || m.origin}</p>}
                  {(m.quotedExternalId) && <p className="mb-1 border-l-2 border-[#D4AF37] pl-2 text-xs text-zinc-400 line-clamp-2">{q ? (q.text || `[${q.type}]`) : 'Mensagem citada'}</p>}
                  <MediaView m={m} />
                  {m.text && <p className="whitespace-pre-wrap break-words text-[15px] leading-snug">{m.text}</p>}
                  <div className="mt-0.5 flex items-center justify-end gap-1 text-[11px] text-zinc-500">
                    {m.imported && <span title="Importada do histórico">hist.</span>}
                    <span>{new Date(m.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                    {m.fromMe && <StatusIcon s={m.status} />}
                  </div>
                  {m.status === 'FAILED' && <p className="text-xs text-red-300">{m.error || 'Falha no envio'}</p>}
                  {m.status === 'UNKNOWN' && m.error && <p className="text-xs text-amber-300">{m.error}</p>}
                  <button onClick={() => setQuote(m)} aria-label="Responder citando" className="absolute -top-2 right-1 hidden rounded-full bg-zinc-700 p-1 group-hover:block"><Reply size={12} /></button>
                </div>
              </div>
            </React.Fragment>
          );
        })}
        <div ref={bottom} />
      </div>

      {/* Composer */}
      <div className="border-t border-zinc-800 bg-zinc-950 px-2 pt-2" style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}>
        {other ? <p className="p-2 text-center text-sm text-zinc-400">{conv.operatorName} está atendendo. Peça a transferência para responder.</p> : <>
          {!mine && conv.mode !== 'CLOSED' && <p className="px-1 pb-1 text-xs text-zinc-400">Ao enviar, você assume o atendimento e a IA para nesta conversa.</p>}
          {quote && <div className="mb-2 flex items-center justify-between rounded-lg border-l-2 border-[#D4AF37] bg-zinc-900 px-2 py-1 text-xs text-zinc-300"><span className="line-clamp-1">Respondendo: {quote.text || `[${quote.type}]`}</span><button onClick={() => setQuote(null)} aria-label="Cancelar citação"><X size={14} /></button></div>}
          {showEmoji && <div className="mb-2 flex flex-wrap gap-1 rounded-lg bg-zinc-900 p-2">{EMOJIS.map(e => <button key={e} onClick={() => setText(t => t + e)} className="h-9 w-9 text-xl">{e}</button>)}</div>}
          {quick && <div className="mb-2 max-h-48 overflow-y-auto rounded-lg bg-zinc-900 p-1">{quick.length ? quick.map(r => <button key={r.id} onClick={() => fill(r.body)} className="block w-full rounded px-2 py-2 text-left text-sm hover:bg-zinc-800"><b>{r.title}</b><span className="block truncate text-xs text-zinc-400">{r.body}</span></button>) : <p className="p-2 text-xs text-zinc-500">Nenhuma resposta rápida. Cadastre em Configurações da Central.</p>}</div>}
          {transfer && <div className="mb-2 rounded-lg bg-zinc-900 p-2 text-sm"><p className="mb-1 text-xs text-zinc-400">Transferir para:</p>{transfer.map(o => <button key={o.id} onClick={() => { act('transfer', { toUserId: o.id }); setTransfer(null); }} className="mr-2 mb-1 rounded bg-zinc-800 px-3 py-2">{o.name}</button>)}<button onClick={() => setTransfer(null)} className="text-xs text-zinc-400">Cancelar</button></div>}
          {audio ? (
            <div className="flex items-center gap-2 pb-1"><audio src={audio.url} controls className="h-10 flex-1" /><Btn onClick={() => { URL.revokeObjectURL(audio.url); setAudio(null); }}><X size={16} /></Btn><Btn onClick={sendAudio} cls="bg-green-700" disabled={sending}><Send size={16} /> Enviar</Btn></div>
          ) : rec ? (
            <div className="flex items-center gap-2 pb-1"><span className="flex-1 animate-pulse text-sm text-red-300">● Gravando… toque em parar para ouvir antes de enviar</span><Btn onClick={stopRec} cls="bg-red-700"><Square size={16} /> Parar</Btn></div>
          ) : (
            <form onSubmit={submit} className="flex items-end gap-1 pb-1">
              <IconBtn label="Emojis" onClick={() => setShowEmoji(s => !s)}><Smile size={20} /></IconBtn>
              <IconBtn label="Respostas rápidas" onClick={() => (quick ? setQuick(null) : openQuick())}><Zap size={20} /></IconBtn>
              <IconBtn label="Anexar arquivo" onClick={() => fileRef.current?.click()}><Paperclip size={20} /></IconBtn>
              <input ref={fileRef} type="file" hidden accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip" onChange={e => onFile(e.target.files?.[0])} />
              <textarea value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && window.innerWidth >= 768) { e.preventDefault(); submit(); } }} rows={1} placeholder="Digite uma mensagem" aria-label="Mensagem" className="max-h-32 min-h-[44px] flex-1 resize-none rounded-2xl border border-zinc-700 bg-black px-3 py-2.5 text-base outline-none focus:border-[#D4AF37]" />
              {text.trim() ? <IconBtn label="Enviar" onClick={() => submit()} gold disabled={sending}><Send size={20} /></IconBtn> : <IconBtn label="Gravar áudio" onClick={startRec} gold><Mic size={20} /></IconBtn>}
            </form>
          )}
        </>}
      </div>
    </>
  );
}

function Btn({ children, onClick, cls = 'bg-zinc-800', disabled }: { children: React.ReactNode; onClick: () => void; cls?: string; disabled?: boolean }) {
  return <button onClick={onClick} disabled={disabled} className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 min-h-[40px] font-semibold disabled:opacity-50 ${cls}`}>{children}</button>;
}
function IconBtn({ children, label, onClick, gold, disabled }: { children: React.ReactNode; label: string; onClick: () => void; gold?: boolean; disabled?: boolean }) {
  return <button type="button" onClick={onClick} aria-label={label} title={label} disabled={disabled} className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full disabled:opacity-50 ${gold ? 'bg-[#D4AF37] text-black' : 'text-zinc-300 hover:bg-zinc-800'}`}>{children}</button>;
}

/** Mídia carregada sob demanda pelo backend autenticado (nada fica guardado no navegador). */
function MediaView({ m }: { m: Msg }) {
  const [url, setUrl] = useState<string | null>(null); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  if (!m.mediaMime || m.type === 'text' || m.type === 'other') return null;
  if (m.type === 'view_once') return <p className="text-xs text-zinc-400">Mensagem de visualização única (abra no celular).</p>;
  if (m.externalId.startsWith('local:') || m.externalId.startsWith('sys:')) return <p className="text-xs text-zinc-400">{m.type === 'audio' ? '🎤 Áudio enviado' : m.mediaName || 'Arquivo enviado'}</p>;
  const load = async () => {
    setBusy(true); setErr('');
    try {
      const token = JSON.parse(localStorage.getItem('tubarao_auth') || '{}').accessToken;
      const r = await fetch(`${getApiBaseUrl()}/inbox/messages/${m.id}/media`, { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Mídia indisponível');
      setUrl(URL.createObjectURL(await r.blob()));
    } catch (e: any) { setErr(e.message); }
    setBusy(false);
  };
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  if (!url) return <button onClick={load} disabled={busy} className="mb-1 inline-flex items-center gap-2 rounded-lg bg-black/40 px-3 py-2 text-sm">{m.type === 'audio' ? <Play size={16} /> : m.type === 'document' ? <FileText size={16} /> : <Download size={16} />}{busy ? 'Carregando…' : m.type === 'audio' ? 'Ouvir áudio' : m.type === 'image' ? 'Ver foto' : m.type === 'video' ? 'Ver vídeo' : m.type === 'sticker' ? 'Ver figurinha' : (m.mediaName || 'Abrir documento')}{err && <span className="text-xs text-red-300"> · {err}</span>}</button>;
  if (m.type === 'image' || m.type === 'sticker') return <a href={url} target="_blank" rel="noopener noreferrer"><img src={url} alt="Imagem recebida" className="mb-1 max-h-72 rounded-lg" /></a>;
  if (m.type === 'video') return <video src={url} controls playsInline className="mb-1 max-h-72 rounded-lg" />;
  if (m.type === 'audio') return <audio src={url} controls className="mb-1 w-64 max-w-full" />;
  return <a href={url} download={m.mediaName || 'documento'} className="mb-1 inline-flex items-center gap-2 rounded-lg bg-black/40 px-3 py-2 text-sm underline"><FileText size={16} /> {m.mediaName || 'Baixar documento'}</a>;
}

function ContactPanel({ conv, onBack, onLinked }: { conv: Conv; onBack: () => void; onLinked: (c: Conv) => void }) {
  const [d, setD] = useState<any>(null); const [search, setSearch] = useState(''); const [found, setFound] = useState<any[]>([]); const [err, setErr] = useState('');
  const load = async () => { const { data } = await api.get<any>(`/inbox/conversations/${conv.id}/contact`); setD(data); };
  useEffect(() => { load(); }, [conv.id, conv.customer?.id]);
  const find = async () => {
    const digits = search.replace(/\D/g, '');
    const { data } = await api.get<any>(`/legacy-clients/lookup?${digits.length === 11 && !search.includes('(') ? `cpf=${digits}` : `phone=${encodeURIComponent(search || conv.phone || '')}`}`);
    setFound(data?.matches || []);
  };
  const link = async (customerId: string | null) => {
    if (customerId && !window.confirm('Confirma que este contato é o titular do cadastro? (Confira nome e CPF com o cliente antes.)')) return;
    const { data, error } = await api.post<any>(`/inbox/conversations/${conv.id}/link`, { customerId });
    if (error) { setErr(errMsg(error)); return; }
    onLinked(data.conversation); setFound([]); load();
  };
  const c = d?.customer; const brl = (v: number) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-3 text-sm space-y-3" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
      <button onClick={onBack} className="lg:hidden inline-flex min-h-[44px] items-center gap-1 rounded-lg bg-zinc-900 px-3"><ChevronLeft size={18} /> Voltar à conversa</button>
      <div className="flex items-center gap-3"><Avatar c={conv} /><div><p className="font-semibold">{conv.name || 'Contato'}</p><p className="text-zinc-400">{fmtPhone(conv.phone) || 'Número oculto pelo WhatsApp (LID)'}</p></div></div>
      {!c ? (
        <div className="space-y-2 rounded-xl border border-zinc-800 p-3">
          <p className="font-semibold">Sem cliente vinculado</p>
          {conv.customer && !conv.customer.confirmed && <p className="text-xs text-amber-300">Há um cadastro com o mesmo telefone ({conv.customer.name}), mas o vínculo só vale depois de você conferir.</p>}
          <div className="flex gap-2"><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Telefone ou CPF" className="min-h-[44px] flex-1 rounded-lg border border-zinc-700 bg-black px-3 text-base" /><Btn onClick={find}><Search size={16} /></Btn></div>
          {found.map(f => <div key={f.id} className="flex items-center justify-between gap-2 border-t border-zinc-800 pt-2"><span>{f.name}{f.cpfMasked ? ` · ${f.cpfMasked}` : ''}</span><Btn onClick={() => link(f.id)} cls="bg-[#D4AF37] text-black"><Link2 size={14} /> Vincular</Btn></div>)}
          <a href="#/admin/legacy-clients" className="inline-flex min-h-[44px] items-center gap-1 rounded-lg bg-zinc-800 px-3 font-semibold">Cadastrar cliente antigo</a>
          {err && <p className="text-red-300">{err}</p>}
        </div>
      ) : (<>
        <div className="space-y-1 rounded-xl border border-zinc-800 p-3">
          <p className="font-semibold text-[#D4AF37]">{c.name}</p>
          <p className="text-zinc-400">{c.isLegacy ? 'Cliente antigo' : 'Cliente'} · {c.userId ? 'com conta no app' : 'sem conta no app'} · cadastro {c.status === 'ACTIVE' ? 'ativo' : c.status}</p>
          <div className="flex flex-wrap gap-2 pt-1">
            <a href={`#/admin/customers?open=${c.id}`} className="rounded bg-zinc-800 px-2 py-1">Ficha completa</a>
            <a href={`#/admin/legacy-clients`} className="rounded bg-zinc-800 px-2 py-1">Clientes antigos</a>
            <button onClick={() => link(null)} className="rounded bg-zinc-900 px-2 py-1 text-zinc-400">Desvincular</button>
          </div>
        </div>
        <div className="rounded-xl border border-zinc-800 p-3"><p className="mb-1 font-semibold">Contratos</p>
          {c.loans.length ? c.loans.map((l: any) => <a key={l.id} href={`#/admin/contracts?loan=${l.id}`} className="block border-t border-zinc-900 py-1.5 first:border-0">{l.loanRequest?.profileType || 'Contrato'}{l.isLegacy ? ' (antigo)' : ''} · {l.status === 'ACTIVE' ? `saldo ${brl(l.remainingAmount)}` : l.status === 'COMPLETED' ? 'quitado' : l.status}{l.installments[0] ? <span className="block text-xs text-zinc-400">Próximo: {new Date(l.installments[0].dueDate).toLocaleDateString('pt-BR')} · {brl(l.installments[0].amount)}{l.installments[0].status === 'AWAITING_CONFIRMATION' ? ' · em conferência' : ''}</span> : null}</a>) : <p className="text-zinc-500">Nenhum contrato.</p>}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <a href="#/admin/finance?tab=receipts" className="rounded-xl border border-zinc-800 p-3"><b className="block text-lg">{d.pendingReceipts}</b><span className="text-xs text-zinc-400">comprovantes pendentes</span></a>
          <a href="#/admin/legacy-clients" className="rounded-xl border border-zinc-800 p-3"><b className="block text-lg">{c.disputes.length}</b><span className="text-xs text-zinc-400">contestações abertas</span></a>
        </div>
        <div className="rounded-xl border border-zinc-800 p-3 text-xs"><p className="mb-1 text-sm font-semibold">Comunicação</p>
          <p>WhatsApp: {c.whatsappOptOut ? <b className="text-red-300">não quer receber</b> : 'permitido'} · Promoções: {c.promoOptOut ? 'não' : 'sim'} · Telefone {c.phoneConfirmed ? 'confirmado' : 'não confirmado'}</p>
          {c.commSuspendedReason && <p className="text-amber-300">Suspensa: {c.commSuspendedReason}</p>}
          <p className="pt-1 text-zinc-500">Alterar em Ficha completa → Preferências de comunicação.</p>
        </div>
      </>)}
      {d?.history?.length > 0 && <div className="rounded-xl border border-zinc-800 p-3 text-xs"><p className="mb-1 text-sm font-semibold">Histórico do atendimento</p>{d.history.map((h: any, i: number) => <p key={i} className="text-zinc-400">{new Date(h.timestamp).toLocaleString('pt-BR')} · {h.userName}: {({ WA_ASSUME: 'assumiu', WA_RETURN_TO_AI: 'devolveu para IA', WA_TRANSFER: 'transferiu', WA_RELEASE: 'liberou para a fila', WA_CLOSE: 'finalizou', WA_REOPEN: 'reabriu', WA_HUMAN_REQUESTED: 'cliente pediu humano', WA_LINK_CUSTOMER: 'vinculou cliente', WA_UNLINK_CUSTOMER: 'desvinculou', WA_MESSAGE_SENT: 'enviou mensagem' } as any)[h.action] || h.action}</p>)}</div>}
      <p className="text-xs text-zinc-500">Pagamentos, quitações e ajustes são feitos só pelas telas de Contratos e Financeiro, com as confirmações de sempre.</p>
    </div>
  );
}

/** Configurações da central, respostas rápidas e sincronização do histórico. */
export function InboxSettingsPanel() {
  const [s, setS] = useState<any>(null); const [items, setItems] = useState<any[]>([]); const [form, setForm] = useState({ title: '', body: '' }); const [msg, setMsg] = useState(''); const [health, setHealth] = useState<any>(null); const [days, setDays] = useState(30);
  const load = async () => { const [a, b, h] = await Promise.all([api.get<any>('/inbox/settings'), api.get<any>('/inbox/quick-replies?all=1'), api.get<any>('/inbox/health')]); setS(a.data?.settings); setItems(b.data?.items || []); setHealth(h.data); };
  useEffect(() => { load(); }, []);
  useEffect(() => { if (health?.import?.status !== 'RUNNING') return; const t = setInterval(async () => { const h = await api.get<any>('/inbox/health'); setHealth(h.data); }, 4000); return () => clearInterval(t); }, [health?.import?.status]);
  if (!s) return <p className="text-sm text-zinc-400">Carregando…</p>;
  const save = async (patch: any) => { const { error } = await api.put<any>('/inbox/settings', patch); setMsg(error ? errMsg(error) : 'Salvo.'); load(); };
  const add = async (e: React.FormEvent) => { e.preventDefault(); const { error } = await api.post<any>('/inbox/quick-replies', form); setMsg(error ? errMsg(error) : 'Resposta rápida criada.'); if (!error) setForm({ title: '', body: '' }); load(); };
  const imp = health?.import;
  return (
    <div className="space-y-4 text-sm">
      <section className="space-y-2 rounded-xl border border-zinc-800 bg-zinc-900 p-4">
        <h3 className="font-bold">Sincronizar histórico</h3>
        <p className="text-zinc-400">Importa conversas guardadas pela Evolution (só leitura). Mensagens importadas não acionam a IA, não geram cobrança e não contam como não lidas. Mensagens anteriores à conexão do WhatsApp na Evolution não existem lá e não podem ser recuperadas.</p>
        <div className="flex flex-wrap items-center gap-2"><label>Últimos <select value={days} onChange={e => setDays(Number(e.target.value))} className="min-h-[40px] rounded bg-black px-2">{[7, 30, 90, 180, 365].map(d => <option key={d} value={d}>{d} dias</option>)}</select></label>
          <Btn disabled={imp?.status === 'RUNNING'} onClick={async () => { const { error } = await api.post<any>('/inbox/import', { days }); setMsg(error ? errMsg(error) : 'Sincronização iniciada.'); load(); }} cls="bg-[#D4AF37] text-black"><RefreshCw size={16} /> Sincronizar conversas</Btn></div>
        {imp && <p className={imp.status === 'ERROR' ? 'text-red-300' : 'text-zinc-300'}>{imp.status === 'RUNNING' ? '⏳ Em andamento' : imp.status === 'DONE' ? '✅ Concluída' : `⚠️ Erro: ${imp.error}`} · {imp.scanned} lidas · {imp.imported} novas · {imp.skipped} já existentes/ignoradas{imp.finishedAt ? ` · ${new Date(imp.finishedAt).toLocaleString('pt-BR')}` : ''}</p>}
        <p className="text-xs text-zinc-500">Último webhook: {health?.lastWebhookAt ? new Date(health.lastWebhookAt).toLocaleString('pt-BR') : 'desde o último reinício, nenhum'} · Última recebida: {health?.lastInboundAt ? new Date(health.lastInboundAt).toLocaleString('pt-BR') : '—'} · Última enviada: {health?.lastOutboundAt ? new Date(health.lastOutboundAt).toLocaleString('pt-BR') : '—'} · Painéis conectados: {health?.realtimeClients ?? 0}</p>
      </section>
      <section className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900 p-4">
        <h3 className="font-bold">Atendimento</h3>
        <label className="block">Nova mensagem em conversa finalizada vai para
          <select value={s.reopenMode} onChange={e => save({ reopenMode: e.target.value })} className="mt-1 block min-h-[44px] w-full rounded bg-black px-2"><option value="AI_ACTIVE">IA (atende sozinha)</option><option value="WAITING_HUMAN">Fila de atendimento humano</option></select></label>
        <label className="flex items-start gap-2"><input type="checkbox" className="mt-1 h-5 w-5" checked={s.pauseRemindersDuringHuman} onChange={e => save({ pauseRemindersDuringHuman: e.target.checked })} /><span>Pausar lembretes de vencimento (7/5/3 dias) enquanto o cliente está com um atendente. <span className="text-zinc-400">Cobranças de atraso continuam.</span></span></label>
        <label className="block">Mensagem quando o cliente pede atendente
          <textarea defaultValue={s.handoffMessage} onBlur={e => e.target.value !== s.handoffMessage && save({ handoffMessage: e.target.value })} rows={2} className="mt-1 w-full rounded bg-black p-2 text-base" /></label>
      </section>
      <section className="space-y-2 rounded-xl border border-zinc-800 bg-zinc-900 p-4">
        <h3 className="font-bold">Respostas rápidas</h3>
        <form onSubmit={add} className="grid gap-2 sm:grid-cols-[180px_1fr_auto]"><input required placeholder="Título" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="min-h-[44px] rounded bg-black px-2" /><input required placeholder="Texto (pode usar {nome}, {primeiro_nome}, {app})" value={form.body} onChange={e => setForm({ ...form, body: e.target.value })} className="min-h-[44px] rounded bg-black px-2" /><Btn onClick={() => {}} cls="bg-[#D4AF37] text-black">Adicionar</Btn></form>
        {items.map(r => <div key={r.id} className="flex items-center justify-between gap-2 border-t border-zinc-800 pt-2"><span className={r.active ? '' : 'text-zinc-500 line-through'}><b>{r.title}</b> — {r.body}</span><button onClick={async () => { await api.put<any>(`/inbox/quick-replies/${r.id}`, { active: !r.active }); load(); }} className="text-xs underline">{r.active ? 'Desativar' : 'Ativar'}</button></div>)}
        <p className="text-xs text-zinc-500">Não coloque valores, saldo ou CPF em respostas rápidas: o número pode não ser do titular.</p>
      </section>
      {msg && <p role="status" className="text-green-300">{msg}</p>}
    </div>
  );
}
