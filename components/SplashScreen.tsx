import React, { useEffect, useState } from 'react';
import { Logo } from './Logo';

export const SplashScreen: React.FC<{ onFinish: () => void }> = ({ onFinish }) => {
  const [stage, setStage] = useState(0);

  useEffect(() => {
    // Sequence of animations
    const t1 = setTimeout(() => setStage(1), 500); // Fade in Logo
    const t2 = setTimeout(() => setStage(2), 2000); // Scale out
    const t3 = setTimeout(() => {
        setStage(3); // Fade out
        setTimeout(onFinish, 500); // Unmount
    }, 2500);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [onFinish]);

  if (stage === 3) return null;

  return (
    <div className={`fixed inset-0 z-[100] bg-black flex items-center justify-center transition-opacity duration-500 ${stage === 3 ? 'opacity-0' : 'opacity-100'}`}>
      <div className={`transition-all duration-1000 transform ${stage >= 1 ? 'scale-100 opacity-100' : 'scale-50 opacity-0'} ${stage === 2 ? 'scale-110' : ''}`}>
        <div className="relative flex flex-col items-center">
            {/* Pulsing Glow */}
            <div className="absolute inset-0 bg-[#FF0000] blur-3xl opacity-20 animate-pulse rounded-full"></div>
            
            <div className="relative z-10">
                <Logo size="xl" />
            </div>
            
            {/* Loading Bar */}
            <div className="w-32 h-1 bg-zinc-800 mt-8 rounded-full overflow-hidden">
                <div className="h-full bg-[#D4AF37] transition-all duration-1000 ease-out" style={{ width: stage >= 1 ? '100%' : '0%' }}></div>
            </div>
        </div>
      </div>
    </div>
  );
};