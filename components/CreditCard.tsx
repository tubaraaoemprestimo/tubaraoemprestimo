import React from 'react';
import { Logo } from './Logo';

interface CreditCardProps {
  name?: string;
}

export const CreditCard: React.FC<CreditCardProps> = ({ name = 'CLIENTE VIP' }) => {
  return (
    <div className="w-full aspect-[1.586/1] bg-gradient-to-br from-zinc-900 to-black rounded-2xl p-6 relative overflow-hidden shadow-2xl border border-zinc-800 group hover:border-[#D4AF37]/50 transition-all duration-500">
      {/* Glossy Effect */}
      <div className="absolute top-0 left-0 w-full h-full bg-[linear-gradient(110deg,rgba(255,255,255,0)_30%,rgba(255,255,255,0.05)_40%,rgba(255,255,255,0)_50%)] group-hover:opacity-100 opacity-50 transition-opacity"></div>
      
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(212,175,55,0.3) 1px, transparent 0)', backgroundSize: '20px 20px' }}></div>

      <div className="relative z-10 flex flex-col justify-between h-full">
        <div className="flex justify-between items-start">
          <div className="scale-75 origin-top-left">
             <Logo size="sm" />
          </div>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" className="opacity-50">
             <path d="M2 10C2 10 4 12 6 12C8 12 10 10 12 10C14 10 16 12 18 12C20 12 22 10 22 10" stroke="white" strokeWidth="2" strokeLinecap="round"/>
             <path d="M2 14C2 14 4 16 6 16C8 16 10 14 12 14C14 14 16 16 18 16C20 16 22 14 22 14" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.5"/>
          </svg>
        </div>

        <div className="flex items-center gap-4">
           <div className="w-12 h-8 bg-[#D4AF37]/20 rounded border border-[#D4AF37]/30 flex items-center justify-center">
              <div className="w-8 h-5 border border-[#D4AF37]/50 rounded-sm"></div>
           </div>
           <div className="text-zinc-500 font-mono text-xs tracking-[0.2em] flex-1">
              •••• •••• •••• 8892
           </div>
        </div>

        <div className="flex justify-between items-end">
          <div>
            <div className="text-[8px] text-zinc-500 uppercase tracking-widest mb-1">Titular</div>
            <div className="text-white font-medium tracking-wide uppercase shadow-black drop-shadow-md">{name}</div>
          </div>
          <div className="text-right">
             <div className="text-[8px] text-zinc-500 uppercase tracking-widest mb-1">Validade</div>
             <div className="text-white font-mono text-sm">12/30</div>
          </div>
        </div>
      </div>
    </div>
  );
};