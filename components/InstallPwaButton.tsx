import React, { useEffect, useState } from 'react';
import { Download, Share } from 'lucide-react';
import { Logo } from './Logo';
import { Button } from './Button';

export const InstallPwaButton: React.FC<{ className?: string }> = ({ className = '' }) => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Check if already installed/standalone
    const isInStandaloneMode = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
    if (isInStandaloneMode) {
      setIsStandalone(true);
      return;
    }

    // Check iOS
    const isIosDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(isIosDevice);

    // Capture install prompt for Android/Desktop
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    } else if (isIOS) {
       alert("Para instalar no iPhone/iPad:\n1. Toque no botão Compartilhar (ícone quadrado com seta)\n2. Selecione 'Adicionar à Tela de Início'");
    } else {
       // Fallback for when prompt isn't available but user clicked (e.g. standard browser menu instruction)
       alert("Para instalar: Acesse o menu do navegador e selecione 'Instalar Aplicativo' ou 'Adicionar à Tela Inicial'.");
    }
  };

  // Don't show if already running as app
  if (isStandalone) return null;

  return (
    <button 
      onClick={handleInstall}
      className={`group flex items-center justify-between gap-3 bg-zinc-900/80 backdrop-blur-md border border-zinc-800 rounded-xl px-4 py-2 hover:border-[#D4AF37] hover:bg-zinc-800 transition-all shadow-lg ${className}`}
    >
      <div className="flex items-center gap-3">
         <div className="bg-black p-1.5 rounded-lg border border-zinc-800 group-hover:border-[#D4AF37]/50 transition-colors">
            <Logo size="sm" showText={false} />
         </div>
         <div className="text-left">
            <p className="text-[10px] text-zinc-400 uppercase tracking-wider">Disponível para baixar</p>
            <p className="text-sm font-bold text-white group-hover:text-[#D4AF37] transition-colors flex items-center gap-2">
               Instalar App <Download size={14} />
            </p>
         </div>
      </div>
    </button>
  );
};