
import React, { useState, useEffect } from 'react';
import { DollarSign, Clock, AlertTriangle, CheckCircle, RefreshCw, Send } from 'lucide-react';
import { apiService } from '../services/apiService';
import { whatsappService } from '../services/whatsappService';
import { useToast } from './Toast';

interface TodaySummary {
  totalDueToday: number;
  installmentsDueCount: number;
  installmentsDueToday: Array<{
    installmentId: string;
    loanId: string;
    amount: number;
    dueDate: string;
    customer: { id: string; name: string; phone: string } | null;
  }>;
  loansInDefaultCount: number;
  loansInDefault: Array<{
    loanId: string;
    amount: number;
    remainingAmount: number;
    daysOverdue: number;
    customer: { id: string; name: string; phone: string } | null;
    nextInstallment: any;
  }>;
  paymentsReceivedToday: number;
  paymentsReceivedCount: number;
}

const fmt = (v: number) => (v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const TodayFinancialDashboard: React.FC = () => {
  const { addToast } = useToast();
  const [summary, setSummary] = useState<TodaySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [sendingTo, setSendingTo] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const data = await apiService.getTodaySummary();
    setSummary(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const sendReminder = async (phone: string, name: string, amount: number, type: 'due' | 'overdue', daysOverdue?: number) => {
    if (!phone) { addToast('Cliente sem telefone cadastrado', 'warning'); return; }
    setSendingTo(phone);
    const msg = type === 'due'
      ? `Olá ${name.split(' ')[0]}! 🦈 Lembrete: sua parcela de *${fmt(amount)}* vence hoje. Evite multas e juros.\n\nSe já pagou, desconsidere esta mensagem. ✅`
      : `Olá ${name.split(' ')[0]}! 🦈 Identificamos que sua parcela de *${fmt(amount)}* está em atraso há *${daysOverdue} dias*.\n\nEntre em contato para evitar encargos adicionais. 📞`;

    const ok = await whatsappService.sendMessage(phone, msg);
    setSendingTo(null);
    if (ok) {
      addToast(`Mensagem enviada para ${name}!`, 'success');
    } else {
      addToast('Erro ao enviar mensagem', 'error');
    }
  };

  if (loading) {
    return (
      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5 animate-pulse">
        <div className="h-6 bg-zinc-800 rounded w-48 mb-4" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-zinc-800 rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (!summary) return null;

  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-bold text-lg text-white">📅 Operação de Hoje</h2>
          <p className="text-xs text-zinc-500">{new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        </div>
        <button onClick={load} className="text-zinc-500 hover:text-white transition-colors">
          <RefreshCw size={16} />
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-yellow-900/20 border border-yellow-700/40 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign size={18} className="text-yellow-400" />
            <p className="text-xs text-yellow-400 font-bold uppercase">A Receber Hoje</p>
          </div>
          <p className="text-2xl font-bold text-white">{fmt(summary.totalDueToday)}</p>
          <p className="text-xs text-zinc-500 mt-1">{summary.installmentsDueCount} parcela(s)</p>
        </div>

        <div className="bg-blue-900/20 border border-blue-700/40 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock size={18} className="text-blue-400" />
            <p className="text-xs text-blue-400 font-bold uppercase">Vencendo Hoje</p>
          </div>
          <p className="text-2xl font-bold text-white">{summary.installmentsDueCount}</p>
          <p className="text-xs text-zinc-500 mt-1">clientes</p>
        </div>

        <div className="bg-red-900/20 border border-red-700/40 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={18} className="text-red-400" />
            <p className="text-xs text-red-400 font-bold uppercase">Em Atraso</p>
          </div>
          <p className="text-2xl font-bold text-white">{summary.loansInDefaultCount}</p>
          <p className="text-xs text-zinc-500 mt-1">contratos</p>
        </div>

        <div className="bg-green-900/20 border border-green-700/40 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle size={18} className="text-green-400" />
            <p className="text-xs text-green-400 font-bold uppercase">Recebido Hoje</p>
          </div>
          <p className="text-2xl font-bold text-white">{fmt(summary.paymentsReceivedToday)}</p>
          <p className="text-xs text-zinc-500 mt-1">{summary.paymentsReceivedCount} pagamento(s)</p>
        </div>
      </div>

      {/* Vencendo Hoje */}
      {summary.installmentsDueToday.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-yellow-400 mb-3 flex items-center gap-2">
            <Clock size={14} /> Parcelas Vencendo Hoje
          </h3>
          <div className="space-y-2">
            {summary.installmentsDueToday.map(inst => (
              <div key={inst.installmentId} className="flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3">
                <div>
                  <p className="font-bold text-sm text-white">{inst.customer?.name || '—'}</p>
                  <p className="text-xs text-zinc-500">{inst.customer?.phone}</p>
                </div>
                <div className="flex items-center gap-3">
                  <p className="font-bold text-[#D4AF37]">{fmt(inst.amount)}</p>
                  {inst.customer?.phone && (
                    <button
                      onClick={() => inst.customer && sendReminder(inst.customer.phone, inst.customer.name, inst.amount, 'due')}
                      disabled={sendingTo === inst.customer?.phone}
                      className="flex items-center gap-1 text-xs bg-green-800 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                    >
                      <Send size={12} /> {sendingTo === inst.customer?.phone ? '...' : 'Avisar'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Em Atraso */}
      {(summary.loansInDefault ?? []).length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-red-400 mb-3 flex items-center gap-2">
            <AlertTriangle size={14} /> Contratos em Atraso
          </h3>
          <div className="space-y-2">
            {(summary.loansInDefault ?? []).slice(0, 10).map(loan => (
              <div key={loan.loanId} className="flex items-center justify-between bg-zinc-900 border border-red-900/40 rounded-lg px-4 py-3">
                <div>
                  <p className="font-bold text-sm text-white">{loan.customer?.name || '—'}</p>
                  <p className="text-xs text-zinc-500">{loan.customer?.phone}</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-xs text-red-400 font-bold">{loan.daysOverdue}d atraso</p>
                    <p className="text-xs text-zinc-500">Restante: {fmt(loan.remainingAmount)}</p>
                  </div>
                  {loan.customer?.phone && (
                    <button
                      onClick={() => loan.customer && sendReminder(loan.customer.phone, loan.customer.name, loan.remainingAmount, 'overdue', loan.daysOverdue)}
                      disabled={sendingTo === loan.customer?.phone}
                      className="flex items-center gap-1 text-xs bg-red-900 hover:bg-red-800 text-white px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                    >
                      <Send size={12} /> {sendingTo === loan.customer?.phone ? '...' : 'Cobrar'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {(summary.installmentsDueToday ?? []).length === 0 && (summary.loansInDefault ?? []).length === 0 && (
        <div className="text-center py-4 text-zinc-500 text-sm">
          ✅ Nenhuma ação necessária para hoje
        </div>
      )}
    </div>
  );
};
