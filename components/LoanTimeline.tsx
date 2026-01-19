import React from 'react';
import { Check, Search, FileText, DollarSign, Clock, XCircle, CheckCircle2, Loader2, CreditCard, AlertTriangle } from 'lucide-react';
import { LoanStatus } from '../types';

interface LoanTimelineProps {
  status: LoanStatus;
  date: string;
  amount?: number;
  installments?: number;
}

export const LoanTimeline: React.FC<LoanTimelineProps> = ({ status, date, amount, installments }) => {
  const steps = [
    { id: 1, label: 'Enviado', icon: FileText, done: true },
    { id: 2, label: 'Análise Docs', icon: Search, done: true },
    { id: 3, label: 'Análise Crédito', icon: Clock, done: status !== LoanStatus.PENDING && status !== LoanStatus.WAITING_DOCS },
    { id: 4, label: 'Liberação', icon: CreditCard, done: status === LoanStatus.APPROVED || status === LoanStatus.PAID },
  ];

  // Determine active step index
  let activeIndex = 1; // Default to Analysis
  if (status === LoanStatus.WAITING_DOCS) activeIndex = 1;
  if (status === LoanStatus.PENDING) activeIndex = 2;
  if (status === LoanStatus.APPROVED || status === LoanStatus.PAID) activeIndex = 3;
  if (status === LoanStatus.REJECTED) activeIndex = 2; // Stop at credit analysis

  // Status label and color
  const getStatusInfo = () => {
    switch (status) {
      case LoanStatus.PENDING:
        return { label: 'Em Análise', color: 'text-yellow-400', bgColor: 'bg-yellow-500/10', borderColor: 'border-yellow-500/30', icon: Loader2, iconClass: 'animate-spin' };
      case LoanStatus.WAITING_DOCS:
        return { label: 'Aguard. Documentos', color: 'text-blue-400', bgColor: 'bg-blue-500/10', borderColor: 'border-blue-500/30', icon: AlertTriangle, iconClass: '' };
      case LoanStatus.APPROVED:
        return { label: 'Aprovado!', color: 'text-green-400', bgColor: 'bg-green-500/10', borderColor: 'border-green-500/30', icon: CheckCircle2, iconClass: '' };
      case LoanStatus.REJECTED:
        return { label: 'Não Aprovado', color: 'text-red-400', bgColor: 'bg-red-500/10', borderColor: 'border-red-500/30', icon: XCircle, iconClass: '' };
      case LoanStatus.PAID:
        return { label: 'Quitado', color: 'text-purple-400', bgColor: 'bg-purple-500/10', borderColor: 'border-purple-500/30', icon: CheckCircle2, iconClass: '' };
      default:
        return { label: 'Pendente', color: 'text-zinc-400', bgColor: 'bg-zinc-500/10', borderColor: 'border-zinc-500/30', icon: Clock, iconClass: '' };
    }
  };

  const statusInfo = getStatusInfo();
  const StatusIcon = statusInfo.icon;

  return (
    <div className={`${statusInfo.bgColor} border ${statusInfo.borderColor} rounded-2xl p-6 mb-6 relative overflow-hidden`}>
      {/* Top bar with status */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Sua Solicitação</p>
          <div className="flex items-center gap-2">
            <StatusIcon size={20} className={`${statusInfo.color} ${statusInfo.iconClass}`} />
            <h3 className={`font-bold text-lg ${statusInfo.color}`}>{statusInfo.label}</h3>
          </div>
        </div>
        <span className="text-xs text-zinc-500 bg-black/30 px-3 py-1 rounded-full border border-zinc-800">
          {new Date(date).toLocaleDateString('pt-BR')}
        </span>
      </div>

      {/* Amount requested */}
      {amount && (
        <div className="bg-black/30 rounded-xl p-4 mb-6 border border-zinc-800/50">
          <p className="text-xs text-zinc-500 uppercase mb-1">Valor Solicitado</p>
          <div className="flex items-center justify-between">
            <span className="text-2xl font-bold text-white">
              R$ {amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
            {installments && (
              <span className="text-sm text-zinc-400">
                em <span className="text-[#D4AF37] font-bold">{installments}x</span>
              </span>
            )}
          </div>
        </div>
      )}

      {/* Timeline */}
      <div className="relative flex justify-between px-2 mb-4">
        {/* Connecting Line background */}
        <div className="absolute top-5 left-0 w-full h-0.5 bg-zinc-800 z-0"></div>
        {/* Connecting Line progress */}
        <div
          className="absolute top-5 left-0 h-0.5 bg-[#D4AF37] z-0 transition-all duration-1000"
          style={{ width: `${(activeIndex / (steps.length - 1)) * 100}%` }}
        ></div>

        {steps.map((step, idx) => {
          const Icon = step.icon;
          const isActive = idx === activeIndex;
          const isDone = idx <= activeIndex;
          const isRejected = status === LoanStatus.REJECTED && idx === activeIndex;

          return (
            <div key={step.id} className="relative z-10 flex flex-col items-center gap-2">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-500 ${isRejected ? 'bg-red-600 border-red-600 text-white' :
                  isActive ? 'bg-[#D4AF37] border-[#D4AF37] text-black shadow-[0_0_20px_rgba(212,175,55,0.5)] scale-110' :
                    isDone ? 'bg-black border-[#D4AF37] text-[#D4AF37]' :
                      'bg-black border-zinc-700 text-zinc-600'
                }`}>
                {isRejected ? <XCircle size={18} /> : isDone && !isActive ? <Check size={14} /> : <Icon size={16} />}
              </div>
              <span className={`text-[10px] font-bold uppercase tracking-wider ${isActive ? 'text-[#D4AF37]' : isDone ? 'text-zinc-400' : 'text-zinc-700'
                }`}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Status Messages */}
      {status === LoanStatus.REJECTED && (
        <div className="mt-4 p-3 bg-red-900/20 border border-red-900/50 rounded-lg text-red-400 text-xs text-center">
          Infelizmente não pudemos aprovar seu pedido neste momento. Tente novamente em 30 dias.
        </div>
      )}

      {status === LoanStatus.APPROVED && (
        <div className="mt-4 p-3 bg-green-900/20 border border-green-900/50 rounded-lg text-green-400 text-xs text-center flex items-center justify-center gap-2">
          <CheckCircle2 size={16} />
          Seu empréstimo foi aprovado! O valor será liberado em breve.
        </div>
      )}

      {status === LoanStatus.PENDING && (
        <div className="mt-4 p-3 bg-yellow-900/20 border border-yellow-900/50 rounded-lg text-yellow-400 text-xs text-center flex items-center justify-center gap-2">
          <Loader2 size={16} className="animate-spin" />
          Estamos analisando sua solicitação. Você será notificado em breve.
        </div>
      )}

      {status === LoanStatus.WAITING_DOCS && (
        <div className="mt-4 p-3 bg-blue-900/20 border border-blue-900/50 rounded-lg text-blue-400 text-xs text-center flex items-center justify-center gap-2">
          <AlertTriangle size={16} />
          Precisamos de um documento adicional para continuar a análise.
        </div>
      )}
    </div>
  );
};
