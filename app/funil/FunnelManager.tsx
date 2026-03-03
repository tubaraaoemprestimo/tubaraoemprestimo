'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { Step1Main }        from './steps/Step1Main';
import { Step2Upsell1 }     from './steps/Step2Upsell1';
import { Step3Upsell2 }     from './steps/Step3Upsell2';
import { Step4Presencial }  from './steps/Step4Presencial';
import { Step5Confirmacao } from './steps/Step5Confirmacao';

// ---------------------------------------------------------------
// Gera ou recupera o sessionId do lead no localStorage.
// Garante persistência entre navegações e recarregamentos.
// ---------------------------------------------------------------
function getOrCreateSessionId(): string {
  if (typeof window === 'undefined') return '';
  const key = 'funnel_session_id';
  let sid = localStorage.getItem(key);
  if (!sid) {
    sid = crypto.randomUUID();
    localStorage.setItem(key, sid);
  }
  return sid;
}

// ---------------------------------------------------------------
// FunnelManager — página única do funil
//
// Lógica de step:
//  1. Lê ?step=X da URL (retorno do gateway InfinitePay)
//  2. Se não há ?step, começa no step 1
//  3. Botões de recusa avançam o state React (sem reload/redirect)
//  4. Botões de compra apontam para o gateway (nova aba opcional)
//     e o gateway redireciona de volta com ?step=X+1
// ---------------------------------------------------------------
export function FunnelManager() {
  const router       = useRouter();
  const searchParams = useSearchParams();

  const [sessionId, setSessionId]     = useState('');
  const [currentStep, setCurrentStep] = useState(1);

  // Inicializa o sessionId no cliente (evita SSR mismatch)
  useEffect(() => {
    setSessionId(getOrCreateSessionId());
  }, []);

  // Lê o ?step= da URL ao montar (retorno do gateway)
  useEffect(() => {
    const stepParam = searchParams.get('step');
    const sidParam  = searchParams.get('sid');

    if (stepParam) {
      const parsedStep = parseInt(stepParam, 10);
      if (parsedStep >= 1 && parsedStep <= 5) {
        setCurrentStep(parsedStep);
      }
    }

    // Se o gateway retornou um sessionId via URL, restaura-o
    if (sidParam) {
      localStorage.setItem('funnel_session_id', sidParam);
      setSessionId(sidParam);
    }

    // Limpa os params da URL (URL limpa sem perder o estado)
    if (stepParam || sidParam) {
      router.replace('/funil', { scroll: false });
    }
  }, [searchParams, router]);

  // Avança o step no estado React (sem reload — para recusas)
  const advanceStep = useCallback((nextStep: number) => {
    setCurrentStep(nextStep);
    // Scrolla suavemente para o topo do funil
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // Barra de progresso visual (Step 1–5)
  const progressPercent = ((currentStep - 1) / 4) * 100;

  // Ainda hidratando — evita flash de conteúdo errado
  if (!sessionId) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#D4AF37] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ---------------------------------------------------------------
  // State Machine — renderização condicional por step
  // ---------------------------------------------------------------
  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return <Step1Main sessionId={sessionId} />;

      case 2:
        return (
          <Step2Upsell1
            sessionId={sessionId}
            onDecline={() => advanceStep(3)}
          />
        );

      case 3:
        return (
          <Step3Upsell2
            sessionId={sessionId}
            onDecline={() => advanceStep(4)}
          />
        );

      case 4:
        return (
          <Step4Presencial
            sessionId={sessionId}
            onDecline={() => advanceStep(5)}
          />
        );

      case 5:
        return <Step5Confirmacao sessionId={sessionId} />;

      default:
        return <Step1Main sessionId={sessionId} />;
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Background pattern global */}
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(212,175,55,0.08),transparent_60%)] pointer-events-none" />

      {/* Barra de progresso fixa no topo */}
      <div className="fixed top-0 left-0 right-0 z-50 h-1 bg-zinc-900">
        <div
          className="h-full bg-gradient-to-r from-[#D4AF37] to-[#B8860B] transition-all duration-700 ease-out"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Indicador de etapa (desktop) */}
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

      {/* Conteúdo principal da etapa atual */}
      <main className="relative z-10 max-w-6xl mx-auto">
        {renderStep()}
      </main>

      {/* Footer */}
      <footer className="relative z-10 py-8 px-4 border-t border-zinc-900 text-center text-zinc-600 text-xs mt-8">
        <p>© 2026 Método Tubarão. Todos os direitos reservados.</p>
        <p className="mt-1">
          <a href="/termos" className="hover:text-[#D4AF37] transition-colors">Termos de Uso</a>
          {' • '}
          <a href="/privacidade" className="hover:text-[#D4AF37] transition-colors">Política de Privacidade</a>
        </p>
      </footer>
    </div>
  );
}
