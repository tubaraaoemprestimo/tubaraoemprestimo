import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getOrCreateSessionId } from './funnelTracker';
import { Step1Main }        from './steps/Step1Main';
import { Step2Upsell1 }     from './steps/Step2Upsell1';
import { Step3Upsell2 }     from './steps/Step3Upsell2';
import { Step4Presencial }  from './steps/Step4Presencial';
import { Step5Confirmacao } from './steps/Step5Confirmacao';

// ─────────────────────────────────────────────────────────────────────────────
// FunnelManager — One Page Funnel com 5 steps
//
// Fluxo de navegação:
//   Step 1 (Oferta principal)   → Sim → checkout InfinitePay (nova aba)
//                                  → gateway retorna com ?step=2&sid=xxx
//   Step 2 (Upsell módulos)     → Sim → checkout | Não → avança state (sem reload)
//   Step 3 (Mentoria Online)    → Sim → checkout | Não → avança state
//   Step 4 (Mentoria Presencial)→ Sim → checkout | Não → avança state
//   Step 5 (Confirmação)        → FIM
//
// sessionId: gerado em localStorage, passado via ?sid= para o gateway
//            e restaurado ao voltar
// ─────────────────────────────────────────────────────────────────────────────
export default function FunnelManager() {
  const navigate     = useNavigate();
  const [params]     = useSearchParams();

  const [sessionId, setSessionId]     = useState('');
  const [currentStep, setCurrentStep] = useState(1);

  // ── Inicializa sessionId (client-only para evitar SSR) ──────────────────
  useEffect(() => {
    setSessionId(getOrCreateSessionId());
  }, []);

  // ── Lê ?step= e ?sid= na volta do gateway InfinitePay ──────────────────
  useEffect(() => {
    const stepParam = params.get('step');
    const sidParam  = params.get('sid');

    if (sidParam) {
      localStorage.setItem('funnel_session_id', sidParam);
      setSessionId(sidParam);
    }

    if (stepParam) {
      const n = parseInt(stepParam, 10);
      if (n >= 1 && n <= 5) setCurrentStep(n);
    }

    // Limpa os params da URL mantendo o estado (URL limpa)
    if (stepParam || sidParam) {
      navigate('/funil', { replace: true });
    }
  }, [params, navigate]);

  // ── Avança step sem reload (para recusas) ───────────────────────────────
  const advanceStep = useCallback((next: number) => {
    setCurrentStep(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // ── Barra de progresso (0%–100%) ────────────────────────────────────────
  const progress = ((currentStep - 1) / 4) * 100;

  // Loading até o sessionId estar disponível (evita flash)
  if (!sessionId) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#D4AF37] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ── State machine ────────────────────────────────────────────────────────
  const renderStep = () => {
    switch (currentStep) {
      case 1: return <Step1Main sessionId={sessionId} onDecline={() => advanceStep(2)} />;
      case 2: return <Step2Upsell1 sessionId={sessionId} onDecline={() => advanceStep(3)} />;
      case 3: return <Step3Upsell2 sessionId={sessionId} onDecline={() => advanceStep(4)} />;
      case 4: return <Step4Presencial sessionId={sessionId} onDecline={() => advanceStep(5)} />;
      case 5: return <Step5Confirmacao sessionId={sessionId} />;
      default: return <Step1Main sessionId={sessionId} onDecline={() => advanceStep(2)} />;
    }
  };

  return (
    <div className="min-h-screen bg-black text-white font-sans">

      {/* Gradiente de fundo global */}
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(212,175,55,0.08),transparent_60%)] pointer-events-none" />

      {/* Barra de progresso fixa no topo */}
      <div className="fixed top-0 left-0 right-0 z-50 h-1 bg-zinc-900">
        <div
          className="h-full bg-gradient-to-r from-[#D4AF37] to-[#B8860B] transition-all duration-700 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Indicador de etapas (desktop) */}
      {currentStep < 5 && (
        <div className="fixed top-3 right-4 z-50 hidden md:flex items-center gap-1.5">
          {[1, 2, 3, 4].map((s) => (
            <div
              key={s}
              className={`w-2 h-2 rounded-full transition-all duration-300 ${
                s < currentStep
                  ? 'bg-[#D4AF37]'
                  : s === currentStep
                  ? 'bg-[#D4AF37] scale-125'
                  : 'bg-zinc-700'
              }`}
            />
          ))}
          <span className="text-zinc-500 text-xs ml-1">Etapa {currentStep}/4</span>
        </div>
      )}

      {/* Conteúdo do step atual */}
      <main className="relative z-10 max-w-6xl mx-auto">
        {renderStep()}
      </main>

      {/* Footer */}
      <footer className="relative z-10 py-8 px-4 border-t border-zinc-900 text-center text-zinc-600 text-xs mt-8">
        <p>© 2026 Método Tubarão. Todos os direitos reservados.</p>
        <p className="mt-1">
          <a href="/#/termos"     className="hover:text-[#D4AF37] transition-colors">Termos de Uso</a>
          {' • '}
          <a href="/#/privacidade" className="hover:text-[#D4AF37] transition-colors">Política de Privacidade</a>
        </p>
      </footer>
    </div>
  );
}
