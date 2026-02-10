import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock3, Search, ShieldCheck, XCircle } from 'lucide-react';
import { Button } from '../../components/Button';
import { useToast } from '../../components/Toast';
import { InvestorStatus } from '../../types';
import { supabaseService } from '../../services/supabaseService';

type InvestorRow = {
  id: string;
  fullName: string;
  cpfCnpj: string;
  email: string;
  phone: string;
  investmentAmount: number;
  investmentTier: string;
  payoutMode: string;
  monthlyRate: number;
  status: InvestorStatus;
  bankName: string;
  pixKey: string;
  createdAt: string;
  adminNotes?: string;
};

const statusStyles: Record<InvestorStatus, string> = {
  PENDING: 'bg-yellow-500/20 text-yellow-300 border-yellow-600/40',
  APPROVED: 'bg-blue-500/20 text-blue-300 border-blue-600/40',
  ACTIVE: 'bg-cyan-500/20 text-cyan-300 border-cyan-600/40',
  COMPLETED: 'bg-green-500/20 text-green-300 border-green-600/40',
  REJECTED: 'bg-red-500/20 text-red-300 border-red-600/40',
  CANCELLED: 'bg-zinc-700/40 text-zinc-300 border-zinc-600/40',
};

const toInvestorRow = (raw: any): InvestorRow => ({
  id: raw.id,
  fullName: raw.full_name ?? raw.fullName ?? '-',
  cpfCnpj: raw.cpf_cnpj ?? raw.cpfCnpj ?? '-',
  email: raw.email ?? '-',
  phone: raw.phone ?? '-',
  investmentAmount: Number(raw.investment_amount ?? raw.investmentAmount ?? 0),
  investmentTier: raw.investment_tier ?? raw.investmentTier ?? '-',
  payoutMode: raw.payout_mode ?? raw.payoutMode ?? '-',
  monthlyRate: Number(raw.monthly_rate ?? raw.monthlyRate ?? 0),
  status: (raw.status ?? 'PENDING') as InvestorStatus,
  bankName: raw.bank_name ?? raw.bankName ?? '-',
  pixKey: raw.pix_key ?? raw.pixKey ?? '-',
  createdAt: raw.created_at ?? raw.createdAt ?? new Date().toISOString(),
  adminNotes: raw.admin_notes ?? raw.adminNotes,
});

export const Investors: React.FC = () => {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState<InvestorRow[]>([]);
  const [selected, setSelected] = useState<InvestorRow | null>(null);
  const [filterText, setFilterText] = useState('');
  const [filterStatus, setFilterStatus] = useState<InvestorStatus | 'ALL'>('ALL');
  const [nextStatus, setNextStatus] = useState<InvestorStatus>('PENDING');
  const [notes, setNotes] = useState('');

  const loadData = async () => {
    setLoading(true);
    const data = await supabaseService.getInvestorRequests();
    setItems((data || []).map(toInvestorRow));
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!selected) return;
    setNextStatus(selected.status);
    setNotes(selected.adminNotes || '');
  }, [selected]);

  const filtered = useMemo(() => {
    return items.filter((item) => {
      const byStatus = filterStatus === 'ALL' ? true : item.status === filterStatus;
      const q = filterText.trim().toLowerCase();
      const byText = !q
        ? true
        : item.fullName.toLowerCase().includes(q)
          || item.cpfCnpj.toLowerCase().includes(q)
          || item.email.toLowerCase().includes(q);
      return byStatus && byText;
    });
  }, [items, filterStatus, filterText]);

  const updateStatus = async () => {
    if (!selected) return;
    setSaving(true);
    const ok = await supabaseService.updateInvestorStatus(selected.id, nextStatus, notes);
    setSaving(false);

    if (!ok) {
      addToast('Não foi possível atualizar o status do investidor.', 'error');
      return;
    }

    addToast('Status do investidor atualizado com sucesso.', 'success');
    setSelected(null);
    await loadData();
  };

  return (
    <div className="p-4 md:p-8 bg-black min-h-screen text-white">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-cyan-400">Área do Investidor</h1>
          <p className="text-zinc-400 text-sm mt-1">Gestão de solicitações de investimento Tubarão.</p>
        </div>
        <Button variant="secondary" onClick={loadData} className="w-full md:w-auto">Atualizar Lista</Button>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="relative md:col-span-2">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder="Buscar por nome, CPF/CNPJ ou e-mail"
              className="w-full bg-black border border-zinc-700 rounded-lg pl-9 pr-3 py-2.5 text-sm text-white outline-none focus:border-cyan-500"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as InvestorStatus | 'ALL')}
            className="bg-black border border-zinc-700 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-cyan-500"
          >
            <option value="ALL">Todos os status</option>
            <option value="PENDING">Pendente</option>
            <option value="APPROVED">Aprovado</option>
            <option value="ACTIVE">Ativo</option>
            <option value="COMPLETED">Concluído</option>
            <option value="REJECTED">Rejeitado</option>
            <option value="CANCELLED">Cancelado</option>
          </select>
        </div>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px]">
            <thead className="bg-zinc-950 text-zinc-400 text-sm">
              <tr>
                <th className="p-4 text-left">Investidor</th>
                <th className="p-4 text-left">Valor</th>
                <th className="p-4 text-left">Remuneração</th>
                <th className="p-4 text-left">Status</th>
                <th className="p-4 text-left">Data</th>
                <th className="p-4 text-left">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="p-6 text-zinc-400" colSpan={6}>Carregando investidores...</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td className="p-6 text-zinc-400" colSpan={6}>Nenhuma solicitação encontrada.</td>
                </tr>
              ) : (
                filtered.map((item) => (
                  <tr key={item.id} className="border-t border-zinc-800 hover:bg-zinc-800/20">
                    <td className="p-4">
                      <div className="font-semibold">{item.fullName}</div>
                      <div className="text-xs text-zinc-400">{item.cpfCnpj}</div>
                      <div className="text-xs text-zinc-500">{item.email}</div>
                    </td>
                    <td className="p-4">
                      <div className="font-bold text-[#D4AF37]">
                        R$ {item.investmentAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </div>
                      <div className="text-xs text-zinc-400">Faixa: {item.investmentTier}</div>
                    </td>
                    <td className="p-4">
                      <div className="text-sm">{item.payoutMode === 'MONTHLY' ? 'Mensal' : 'Anual acumulado'}</div>
                      <div className="text-xs text-cyan-300">{item.monthlyRate}% ao mês</div>
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded-md border text-xs font-bold ${statusStyles[item.status]}`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="p-4 text-sm text-zinc-300">{new Date(item.createdAt).toLocaleDateString('pt-BR')}</td>
                    <td className="p-4">
                      <Button size="sm" variant="outline" onClick={() => setSelected(item)}>Gerenciar</Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm p-4 flex items-center justify-center">
          <div className="w-full max-w-2xl bg-zinc-950 border border-zinc-800 rounded-2xl p-5 max-h-[90vh] overflow-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-cyan-400">Gestão de Investidor</h2>
              <button onClick={() => setSelected(null)} className="text-zinc-400 hover:text-white">Fechar</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mb-5">
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
                <p className="text-zinc-400">Nome</p>
                <p className="font-semibold">{selected.fullName}</p>
              </div>
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
                <p className="text-zinc-400">CPF/CNPJ</p>
                <p className="font-semibold">{selected.cpfCnpj}</p>
              </div>
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
                <p className="text-zinc-400">Valor</p>
                <p className="font-bold text-[#D4AF37]">R$ {selected.investmentAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              </div>
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
                <p className="text-zinc-400">Banco / Pix</p>
                <p className="font-semibold">{selected.bankName}</p>
                <p className="text-xs text-zinc-400">{selected.pixKey}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Novo status</label>
                <select
                  value={nextStatus}
                  onChange={(e) => setNextStatus(e.target.value as InvestorStatus)}
                  className="w-full bg-black border border-zinc-700 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-cyan-500"
                >
                  <option value="PENDING">PENDING</option>
                  <option value="APPROVED">APPROVED</option>
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="COMPLETED">COMPLETED</option>
                  <option value="REJECTED">REJECTED</option>
                  <option value="CANCELLED">CANCELLED</option>
                </select>
              </div>
              <div className="flex items-end gap-2">
                <Button size="sm" variant="secondary" onClick={() => setNextStatus('APPROVED')}><CheckCircle2 size={14} /> Aprovar</Button>
                <Button size="sm" variant="secondary" onClick={() => setNextStatus('ACTIVE')}><ShieldCheck size={14} /> Ativar</Button>
                <Button size="sm" variant="danger" onClick={() => setNextStatus('REJECTED')}><XCircle size={14} /> Rejeitar</Button>
              </div>
            </div>

            <div className="mb-5">
              <label className="block text-xs text-zinc-400 mb-1">Observações internas</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                placeholder="Ex: aprovado mediante validação documental..."
                className="w-full bg-black border border-zinc-700 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-cyan-500"
              />
            </div>

            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="secondary" onClick={() => setSelected(null)}>Cancelar</Button>
              <Button onClick={updateStatus} isLoading={saving}>
                <Clock3 size={14} /> Salvar Status
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
