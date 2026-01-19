import React, { useEffect, useState } from 'react';
import { Download, X, Share } from 'lucide-react';
import { Button } from './Button';
import { Logo } from './Logo';

export const InstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Check if iOS
    const isIosDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    
    if (isIosDevice && !isStandalone) {
      setIsIOS(true);
      // Show iOS prompt after a delay if not installed
      const hasSeenPrompt = localStorage.getItem('tubarao_ios_prompt');
      if (!hasSeenPrompt) {
        setTimeout(() => setShowPrompt(true), 3000);
      }
    }

    // Android/Desktop PWA Prompt
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
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
      <div className="bg-zinc-900/95 backdrop-blur-xl border border-[#D4AF37]/50 rounded-2xl p-4 shadow-[0_0_30px_rgba(0,0,0,0.8)] max-w-md mx-auto relative overflow-hidden">
        {/* Glow Effect */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent opacity-50"></div>
        
        <button onClick={closePrompt} className="absolute top-2 right-2 text-zinc-500 hover:text-white">
          <X size={20} />
        </button>

        <div className="flex items-center gap-4">
          <div className="bg-black rounded-xl border border-zinc-800 flex items-center justify-center shadow-lg shrink-0 p-2">
            <Logo size="sm" showText={false} />
          </div>
          <div className="flex-1">
            <h3 className="text-white font-bold text-sm">Instalar Aplicativo</h3>
            <p className="text-zinc-400 text-xs">Adicione à tela inicial para melhor experiência.</p>
          </div>
        </div>

        <div className="mt-4">
          {isIOS ? (
            <div className="text-xs text-zinc-300 bg-black/50 p-3 rounded-lg border border-zinc-800">
               Toque em <span className="inline-flex align-middle"><Share size={14} className="mx-1"/></span> e depois em <strong>"Adicionar à Tela de Início"</strong>
            </div>
          ) : (
            <Button onClick={handleInstallClick} className="w-full bg-[#D4AF37] text-black hover:bg-[#B5942F] h-10 text-sm font-bold shadow-lg shadow-[#D4AF37]/10">
              <Download size={16} className="mr-2" /> Instalar Agora
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};