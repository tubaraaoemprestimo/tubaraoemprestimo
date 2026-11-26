import { getApiBaseUrl } from './runtimeConfig';
import { api } from './apiClient';

/**
 * Tempo real da Central WhatsApp: SSE via fetch (token no header, nunca na URL).
 * Reconecta com espera crescente; ao voltar, busca o que mudou pelo cursor (/inbox/changes).
 * Sem SSE (rede/proxy), cai para consulta a cada 45 s.
 */
type Handler = (ev: any) => void;

export function connectInbox(onEvent: Handler, onState: (s: 'online' | 'reconnecting' | 'polling') => void) {
  let stopped = false, ctrl: AbortController | null = null, retry = 1000, cursor = new Date().toISOString(), poll: any = null, lastData = Date.now();
  const token = () => { try { return JSON.parse(localStorage.getItem('tubarao_auth') || '{}').accessToken || ''; } catch { return ''; } };

  const catchUp = async () => {
    const { data } = await api.get<any>(`/inbox/changes?since=${encodeURIComponent(cursor)}`);
    if (!data) return;
    cursor = data.cursor;
    if (data.conversations?.length || data.messages?.length) onEvent({ type: 'sync', conversations: data.conversations, messages: data.messages });
  };

  const run = async () => {
    while (!stopped) {
      if (import.meta.env.VITE_DEMO_MODE === 'true') { onState('polling'); return; }
      ctrl = new AbortController();
      try {
        const res = await fetch(`${getApiBaseUrl()}/inbox/stream`, { headers: { Authorization: `Bearer ${token()}`, Accept: 'text/event-stream' }, signal: ctrl.signal, cache: 'no-store' });
        if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
        onState('online'); retry = 1000; lastData = Date.now();
        if (poll) { clearInterval(poll); poll = null; }
        await catchUp();
        const reader = res.body.getReader(); const dec = new TextDecoder(); let buf = '';
        while (!stopped) {
          const { value, done } = await reader.read();
          if (done) break;
          lastData = Date.now();
          buf += dec.decode(value, { stream: true });
          let i;
          while ((i = buf.indexOf('\n\n')) >= 0) {
            const chunk = buf.slice(0, i); buf = buf.slice(i + 2);
            const line = chunk.split('\n').find(l => l.startsWith('data: '));
            if (!line) continue;
            try { const ev = JSON.parse(line.slice(6)); if (ev.type) { onEvent(ev); cursor = ev.at || cursor; } } catch { /* ignora pedaço inválido */ }
          }
        }
      } catch { /* cai para reconexão */ }
      if (stopped) return;
      onState('reconnecting');
      if (!poll) poll = setInterval(() => { onState('polling'); catchUp().catch(() => {}); }, 45000);
      await new Promise(r => setTimeout(r, retry));
      retry = Math.min(retry * 2, 30000);
    }
  };
  // Heartbeat do servidor a cada 20 s: 60 s sem nada = conexão morta, força reconexão.
  const watchdog = setInterval(() => { if (Date.now() - lastData > 60000 && ctrl) ctrl.abort(); }, 15000);
  run();
  return () => { stopped = true; ctrl?.abort(); if (poll) clearInterval(poll); clearInterval(watchdog); };
}
