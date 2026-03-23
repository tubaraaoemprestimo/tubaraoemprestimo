/**
 * DemoBar.tsx — Barra Flutuante do Modo Demo
 *
 * Exibida apenas quando VITE_DEMO_MODE=true.
 * Fixada no centro inferior da tela com badge "MODO DEMO" e botão de reset.
 */

import React, { useState, useEffect } from 'react';
import { resetAllDemoStores } from '../services/demoStore';
import { forceSeedDemoData } from '../services/demoSeed';

export function DemoBar() {
  const [resetting, setResetting] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Escuta o evento demo-toast disparado pelo mockApiClient
  useEffect(() => {
    const handler = (e: Event) => {
      const msg = (e as CustomEvent).detail?.message;
      if (msg) {
        setToastMsg(msg);
        setTimeout(() => setToastMsg(null), 4000);
      }
    };
    window.addEventListener('demo-toast', handler);
    return () => window.removeEventListener('demo-toast', handler);
  }, []);

  async function handleReset() {
    if (resetting) return;
    setResetting(true);
    try {
      resetAllDemoStores();
      await new Promise((r) => setTimeout(r, 300));
      forceSeedDemoData();
      await new Promise((r) => setTimeout(r, 200));
      // Redireciona para login
      window.location.href = '/login';
    } finally {
      setResetting(false);
    }
  }

  return (
    <>
      {/* Barra flutuante */}
      <div
        style={{ zIndex: 9999 }}
        className="fixed bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3
                   bg-zinc-950 border border-yellow-500/50 rounded-full px-5 py-2
                   shadow-2xl shadow-black/50 select-none"
      >
        {/* Indicador pulsante */}
        <span className="relative flex items-center">
          <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-yellow-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-yellow-400" />
        </span>

        <span className="text-yellow-400 text-xs font-bold tracking-widest uppercase">
          Modo Demo
        </span>

        <span className="w-px h-4 bg-zinc-700" />

        <button
          onClick={handleReset}
          disabled={resetting}
          className="text-xs text-zinc-400 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
        >
          {resetting ? (
            <>
              <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Resetando...
            </>
          ) : (
            <>
              <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                <path d="M3 3v5h5" />
              </svg>
              Resetar Demo
            </>
          )}
        </button>
      </div>

      {/* Toast de notificação simulada */}
      {toastMsg && (
        <div
          style={{ zIndex: 10000 }}
          className="fixed bottom-16 left-1/2 -translate-x-1/2 max-w-sm w-full mx-4
                     bg-zinc-900 border border-green-500/40 rounded-xl px-5 py-3
                     shadow-2xl shadow-black/50 animate-in slide-in-from-bottom-4 duration-300"
        >
          <div className="flex items-start gap-3">
            <span className="text-green-400 text-lg flex-shrink-0">🔔</span>
            <div>
              <p className="text-xs font-semibold text-green-400 mb-0.5">Notificação Simulada</p>
              <p className="text-xs text-zinc-300">{toastMsg}</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
