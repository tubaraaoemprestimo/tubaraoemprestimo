import React, { useEffect, useState } from 'react';
import { Download, X, Share2, ArrowRight } from 'lucide-react';
import { Button } from './Button';
import { Logo } from './Logo';

export const InstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const isIosDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;

    if (isIosDevice && !isStandalone) {
      setIsIOS(true);
      const hasSeenPrompt = localStorage.getItem('tubarao_ios_prompt');
      if (!hasSeenPrompt) {
        setTimeout(() => setShowPrompt(true), 4000);
      }
    }

    // Android/Desktop PWA Prompt
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        console.log('User accepted the install prompt');
      }
      setDeferredPrompt(null);
      setShowPrompt(false);
    }
  };

  const closePrompt = () => {
    setShowPrompt(false);
    if (isIOS) {
      localStorage.setItem('tubarao_ios_prompt', 'true');
    }
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[100] p-4 animate-in slide-in-from-bottom-full duration-500">
      <div className="bg-zinc-900/98 backdrop-blur-xl border border-[#D4AF37]/50 rounded-2xl p-4 shadow-[0_0_40px_rgba(0,0,0,0.9)] max-w-md mx-auto relative overflow-hidden">
        {/* Glow */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent opacity-60" />

        <button onClick={closePrompt} className="absolute top-3 right-3 text-zinc-500 hover:text-white p-1">
          <X size={18} />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="bg-gradient-to-br from-[#D4AF37] to-[#B8860B] rounded-xl w-12 h-12 flex items-center justify-center shadow-lg shrink-0">
            <Logo size="sm" showText={false} />
          </div>
          <div>
            <h3 className="text-white font-bold text-sm">Instalar App Tubarão</h3>
            <p className="text-zinc-400 text-xs">Acesso rápido + notificações gratuitas</p>
          </div>
        </div>

        {isIOS ? (
          /* iOS — passo a passo visual inline */
          <div>
            <div className="flex items-center gap-2 mb-3">
              {[
                { icon: '⬆️', label: 'Compartilhar' },
                { icon: '➕', label: 'Tela de Início' },
                { icon: '🏠', label: 'Abrir App' },
              ].map((item, i, arr) => (
                <React.Fragment key={i}>
                  <div className="flex flex-col items-center gap-1 flex-1">
                    <div className="text-2xl">{item.icon}</div>
                    <span className="text-[9px] text-zinc-500 text-center leading-tight">{item.label}</span>
                  </div>
                  {i < arr.length - 1 && (
                    <ArrowRight size={12} className="text-zinc-600 shrink-0" />
                  )}
                </React.Fragment>
              ))}
            </div>
            <div className="bg-black/60 border border-zinc-800 rounded-xl p-3 text-xs text-zinc-400 leading-relaxed">
              Toque em{' '}
              <span className="inline-flex items-center gap-1 bg-zinc-700 px-1.5 py-0.5 rounded text-white font-bold text-[11px]">
                <Share2 size={10} /> Compartilhar
              </span>{' '}
              → <strong className="text-white">Adicionar à Tela de Início</strong> → <strong className="text-white">Adicionar</strong>
            </div>
          </div>
        ) : (
          /* Android / Desktop */
          <Button
            onClick={handleInstallClick}
            className="w-full bg-gradient-to-r from-[#D4AF37] to-[#B8860B] text-black hover:opacity-90 h-11 text-sm font-bold shadow-lg"
          >
            <Download size={16} className="mr-2" /> Instalar Agora — É Grátis
          </Button>
        )}
      </div>
    </div>
  );
};
