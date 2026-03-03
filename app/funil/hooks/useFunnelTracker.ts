'use client';

import { useCallback } from 'react';

interface TrackPayload {
  step:      number;
  eventType: 'STEP_VIEW' | 'CLICK_YES' | 'CLICK_NO' | 'VIDEO_PLAY' | 'VIDEO_COMPLETE';
  metadata?: Record<string, unknown>;
}

interface PurchasePayload {
  step:        number;
  productName: string;
  amount:      number;
  gatewayRef?: string;
}

// ---------------------------------------------------------------
// useFunnelTracker
//
// Hook centralizado de tracking do funil.
// Usa fire-and-forget: nunca bloqueia a UX.
// ---------------------------------------------------------------
export function useFunnelTracker(sessionId: string) {
  // Registra eventos gerais (visualizações, cliques, vídeos)
  const track = useCallback(
    (payload: TrackPayload) => {
      if (!sessionId) return;

      fetch('/api/funil/track', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, ...payload }),
      }).catch(() => {
        // Silencia erros de rede — tracking nunca deve quebrar a UX
      });
    },
    [sessionId],
  );

  // Registra compras / cliques em "Sim, quero!"
  const trackPurchase = useCallback(
    (payload: PurchasePayload) => {
      if (!sessionId) return;

      fetch('/api/funil/purchase', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, ...payload }),
      }).catch(() => {
        // Silencia erros de rede
      });
    },
    [sessionId],
  );

  return { track, trackPurchase };
}
