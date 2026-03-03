// ─────────────────────────────────────────────────────────────────────────────
// Hook centralizado de tracking para o funil de vendas.
// Usa fire-and-forget: nunca bloqueia a UX independente de erros de rede.
// ─────────────────────────────────────────────────────────────────────────────

const API_BASE = import.meta.env.VITE_API_URL ?? 'https://api.tubaraoemprestimo.com.br/api';

export type FunnelEventType =
  | 'STEP_VIEW'
  | 'CLICK_YES'
  | 'CLICK_NO'
  | 'VIDEO_PLAY'
  | 'VIDEO_COMPLETE';

interface TrackPayload {
  sessionId: string;
  step:      number;
  eventType: FunnelEventType;
  metadata?: Record<string, unknown>;
}

interface PurchasePayload {
  sessionId:   string;
  step:        number;
  productName: string;
  amount:      number;
  gatewayRef?: string;
}

function post(endpoint: string, body: object) {
  fetch(`${API_BASE}/funil/${endpoint}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  }).catch(() => {/* tracking nunca quebra a UX */});
}

export function track(payload: TrackPayload) {
  post('track', payload);
}

export function trackPurchase(payload: PurchasePayload) {
  post('purchase', payload);
}

export function getOrCreateSessionId(): string {
  if (typeof window === 'undefined') return '';
  const key = 'funnel_session_id';
  let sid = localStorage.getItem(key);
  if (!sid) {
    sid = crypto.randomUUID();
    localStorage.setItem(key, sid);
  }
  return sid;
}
