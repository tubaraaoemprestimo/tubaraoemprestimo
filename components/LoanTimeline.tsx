
import React from 'react';
import { Check, Search, FileText, DollarSign, Clock } from 'lucide-react';
import { LoanStatus } from '../types';

interface LoanTimelineProps {
  status: LoanStatus;
  date: string;
}

export const LoanTimeline: React.FC<LoanTimelineProps> = ({ status, date }) => {
  const steps = [
    { id: 1, label: 'Enviado', icon: FileText, done: true },
    { id: 2, label: 'Análise Docs', icon: Search, done: true },
    { id: 3, label: 'Análise Crédito', icon: Clock, done: status !== LoanStatus.PENDING },
    { id: 4, label: 'Aprovação', icon: DollarSign, done: status === LoanStatus.APPROVED || status === LoanStatus.PAID },
  ];

  // Determine active step index
  let activeIndex = 1; // Default to Analysis
  if (status === LoanStatus.APPROVED || status === LoanStatus.PAID) activeIndex = 3;
  if (status === LoanStatus.REJECTED) activeIndex = 2; // Stop at credit analysis

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 mb-6 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#D4AF37] to-transparent opacity-20"></div>
      
      <div className="flex justify-between items-center mb-6">
        <h3 className="font-bold text-white flex items-center gap-2">
            Status da Solicitação
            <span className="text-xs font-normal text-zinc-500 bg-black px-2 py-1 rounded-full border border-zinc-800">
                {new Date(date).toLocaleDateString()}
            </span>
        </h3>
        {status === LoanStatus.PENDING && (
            <span className="text-xs text-[#D4AF37] animate-pulse font-bold">Em Análise...</span>
        )}
      </div>

      <div className="relative flex justify-between px-2">
        {/* Connecting Line background */}
        <div className="absolute top-1/2 left-0 w-full h-1 bg-black -translate-y-1/2 z-0 rounded-full"></div>
        {/* Connecting Line progress */}
        <div 
            className="absolute top-1/2 left-0 h-1 bg-[#D4AF37] -translate-y-1/2 z-0 rounded-full transition-all duration-1000"
            style={{ width: `${(activeIndex / (steps.length - 1)) * 100}%` }}
        ></div>

        {steps.map((step, idx) => {
            const Icon = step.icon;
            const isActive = idx === activeIndex;
            const isDone = idx <= activeIndex;
            const isRejected = status === LoanStatus.REJECTED && idx === activeIndex;

            return (
                <div key={step.id} className="relative z-10 flex flex-col items-center gap-2 group">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center border-4 transition-all duration-500 ${
                        isRejected ? 'bg-red-900 border-red-600 text-red-500' :
                        isActive ? 'bg-[#D4AF37] border-[#D4AF37] text-black shadow-[0_0_20px_rgba(212,175,55,0.5)] scale-110' :
                        isDone ? 'bg-zinc-900 border-[#D4AF37] text-[#D4AF37]' :
                        'bg-zinc-900 border-zinc-800 text-zinc-600'
                    }`}>
                        {isRejected ? <span className="text-xl font-bold">!</span> : <Icon size={16} />}
                    </div>
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${
                        isActive ? 'text-[#D4AF37]' : isDone ? 'text-zinc-400' : 'text-zinc-700'
                    }`}>
                        {step.label}
                    </span>
                </div>
            );
        })}
      </div>
      
      {status === LoanStatus.REJECTED && (
          <div className="mt-6 p-3 bg-red-900/10 border border-red-900/50 rounded-lg text-red-400 text-xs text-center">
              Infelizmente não pudemos aprovar seu pedido neste momento. Tente novamente em 30 dias.
          </div>
      )}
    </div>
  );
};
