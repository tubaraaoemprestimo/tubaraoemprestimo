
import React, { useState, useEffect, useCallback } from 'react';
import {
  FileText, Search, X, ChevronDown, ChevronUp, Eye, DollarSign,
  Edit2, CheckCircle, Clock, AlertTriangle, RefreshCw, Save, Upload
} from 'lucide-react';
import { apiService } from '../../services/apiService';
import { Button } from '../../components/Button';
import { useToast } from '../../components/Toast';

interface ContractInstallment {
  id: string;
  dueDate: string;
  amount: number;
  status: 'OPEN' | 'PAID' | 'LATE';
  paidAt?: string;
  proofUrl?: string;
}

interface Contract {
  id: string;
  amount: number;
  principalAmount: number;
  remainingAmount: number;
  installmentsCount: number;
  totalInstallments: number;
  dailyInstallmentAmount?: number;
  status: string;
  startDate: string;
  createdAt: string;
  daysOverdue: number;
  nextPaymentDate?: string;
  lastPaymentDate?: string;
  paymentFrequency: string;
  interestRate?: number;
  adminNotes?: string;
  isService: boolean;
  isInvestment: boolean;
  isLoan: boolean;
  pixReceiptUrl?: string;
  installments: ContractInstallment[];
  customer: {
    id: string;
    name: string;
    cpf: string;
    phone: string;
    email: string;
  };
  loanRequest?: {
    profileType?: string;
    monthlyRate?: number;
    contractMonths?: number;
  };
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  ACTIVE: { label: 'Ativo', color: 'bg-green-900 text-green-300' },
  DEFAULT: { label: 'Inadimplente', color: 'bg-red-900 text-red-300' },
  COMPLETED: { label: 'Quitado', color: 'bg-zinc-700 text-zinc-300' },
  CANCELLED: { label: 'Cancelado', color: 'bg-orange-900 text-orange-300' },
  PAID: { label: 'Pago', color: 'bg-blue-900 text-blue-300' },
};

const FREQ_LABELS: Record<string, string> = {
  DAILY: 'Diária',
  WEEKLY: 'Semanal',
  MONTHLY: 'Mensal',
};

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDate = (d?: string) => d ? new Date(d).toLocaleDateString('pt-BR') : '—';

export const Contracts: React.FC = () => {
  const { addToast } = useToast();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');

  // Detail modal
  const [selected, setSelected] = useState<Contract | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [expandedInstallments, setExpandedInstallments] = useState(false);

  // Edit modal
  const [editOpen, setEditOpen] = useState(false);
  const [editData, setEditData] = useState({ adminNotes: '', dailyInstallmentAmount: '', nextPaymentDate: '' });
  const [saving, setSaving] = useState(false);

  // Payment modal
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [selectedInstallment, setSelectedInstallment] = useState<ContractInstallment | null>(null);
  const [paymentData, setPaymentData] = useState({ amount: '', paymentMethod: 'PIX', receiptUrl: '', notes: '' });
  const [registering, setRegistering] = useState(false);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await apiService.getAdminLoans({
      status: statusFilter !== 'ALL' ? statusFilter : undefined,
      type: typeFilter !== 'ALL' ? typeFilter : undefined,
      search: search || undefined
    });
    setContracts(data);
    setLoading(false);
  }, [statusFilter, typeFilter, search]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  const openDetails = async (c: Contract) => {
    const details = await apiService.getAdminLoanDetails(c.id);
    setSelected(details || c);
    setDetailsOpen(true);
    setExpandedInstallments(false);
  };

  const openEdit = (c: Contract) => {
    setSelected(c);
    setEditData({
      adminNotes: c.adminNotes || '',
      dailyInstallmentAmount: c.dailyInstallmentAmount ? String(c.dailyInstallmentAmount) : '',
      nextPaymentDate: c.nextPaymentDate ? c.nextPaymentDate.split('T')[0] : ''
    });
    setEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await apiService.editAdminLoan(selected.id, {
        adminNotes: editData.adminNotes || undefined,
        dailyInstallmentAmount: editData.dailyInstallmentAmount ? parseFloat(editData.dailyInstallmentAmount) : undefined,
        nextPaymentDate: editData.nextPaymentDate || undefined
      });
      addToast('Contrato atualizado!', 'success');
      setEditOpen(false);
      load();
    } catch (err: any) {
      addToast(err.message || 'Erro ao salvar', 'error');
    } finally {
      setSaving(false);
    }
  };

  const openPayment = (c: Contract, inst: ContractInstallment) => {
    setSelected(c);
    setSelectedInstallment(inst);
    setPaymentData({ amount: String(inst.amount), paymentMethod: 'PIX', receiptUrl: '', notes: '' });
    setPaymentOpen(true);
  };

  const handleReceiptUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      addToast('Arquivo muito grande. Máximo 5MB.', 'error');
      return;
    }

    setUploadingReceipt(true);
    try {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setPaymentData(d => ({ ...d, receiptUrl: base64 }));
        addToast('Comprovante carregado!', 'success');
        setUploadingReceipt(false);
      };
      reader.onerror = () => {
        addToast('Erro ao ler arquivo', 'error');
        setUploadingReceipt(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      addToast('Erro ao fazer upload', 'error');
      setUploadingReceipt(false);
    }
  };

  const handleRegisterPayment = async () => {
    if (!selected || !selectedInstallment) return;
    if (!paymentData.amount) { addToast('Informe o valor pago', 'warning'); return; }
    setRegistering(true);
    try {
      await apiService.registerManualPayment(selected.id, {
        installmentId: selectedInstallment.id,
        amount: parseFloat(paymentData.amount),
        paymentMethod: paymentData.paymentMethod,
        receiptUrl: paymentData.receiptUrl || undefined,
        notes: paymentData.notes || undefined
      });
      addToast('Pagamento registrado!', 'success');
      setPaymentOpen(false);
      setDetailsOpen(false);
      load();
    } catch (err: any) {
      addToast(err.message || 'Erro ao registrar', 'error');
    } finally {
      setRegistering(false);
    }
  };

  const getContractType = (c: Contract) => {
    if (c.isService) return 'Limpa Nome';
    if (c.isInvestment) return 'Investidor';
    return 'Empréstimo';
  };

  const paidCount = (c: Contract) => (c.installments ?? []).filter(i => i.status === 'PAID').length;

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <FileText className="text-[#D4AF37]" /> Contratos
          </h1>
          <p className="text-zinc-400 text-sm mt-1">{contracts.length} contrato(s) encontrado(s)</p>
        </div>
        <button onClick={load} className="flex items-center gap-2 text-zinc-400 hover:text-white text-sm">
          <RefreshCw size={16} /> Atualizar
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            placeholder="Buscar por nome ou CPF..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg pl-9 pr-4 py-2 text-sm text-white focus:border-[#D4AF37] outline-none"
          />
        </div>

        <div className="flex bg-zinc-900 rounded-lg p-1 border border-zinc-800">
          {['ALL', 'ACTIVE', 'DEFAULT', 'COMPLETED', 'CANCELLED'].map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1 rounded-md text-xs transition-colors ${statusFilter === s ? 'bg-[#D4AF37] text-black font-bold' : 'text-zinc-400 hover:text-white'}`}
            >
              {s === 'ALL' ? 'Todos' : STATUS_LABELS[s]?.label || s}
            </button>
          ))}
        </div>

        <div className="flex bg-zinc-900 rounded-lg p-1 border border-zinc-800">
          {[['ALL', 'Todos'], ['LOAN', 'Empréstimos'], ['SERVICE', 'Limpa Nome'], ['INVESTMENT', 'Investidor']].map(([v, l]) => (
            <button
              key={v}
              onClick={() => setTypeFilter(v)}
              className={`px-3 py-1 rounded-md text-xs transition-colors ${typeFilter === v ? 'bg-blue-600 text-white font-bold' : 'text-zinc-400 hover:text-white'}`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-12 text-zinc-500">Carregando...</div>
      ) : contracts.length === 0 ? (
        <div className="text-center py-12 text-zinc-500">Nenhum contrato encontrado</div>
      ) : (
        <div className="space-y-2">
          {contracts.map(c => {
            const status = STATUS_LABELS[c.status] || { label: c.status, color: 'bg-zinc-700 text-zinc-300' };
            const paid = paidCount(c);
            const total = c.totalInstallments || c.installmentsCount;
            return (
              <div key={c.id} className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 hover:border-zinc-600 transition-colors">
                <div className="flex flex-col md:flex-row md:items-center gap-3">
                  {/* Cliente */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-white truncate">{c.customer?.name || '—'}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${status.color}`}>{status.label}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400">{getContractType(c)}</span>
                    </div>
                    <p className="text-xs text-zinc-500 mt-0.5">{c.customer?.cpf} · {c.customer?.phone}</p>
                  </div>

                  {/* Valores */}
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-xs text-zinc-500">Valor</p>
                      <p className="font-bold text-white">{fmt(c.amount)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-500">Restante</p>
                      <p className={`font-bold ${c.remainingAmount > 0 ? 'text-yellow-400' : 'text-green-400'}`}>{fmt(c.remainingAmount)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-500">Parcelas</p>
                      <p className="font-bold text-white">{paid}/{total} <span className="text-xs text-zinc-500">pagas</span></p>
                    </div>
                  </div>

                  {/* Vencimento / Atraso */}
                  <div className="text-sm">
                    {c.daysOverdue > 0 ? (
                      <div className="flex items-center gap-1 text-red-400">
                        <AlertTriangle size={14} />
                        <span className="font-bold">{c.daysOverdue}d atraso</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-zinc-400">
                        <Clock size={14} />
                        <span>Próx: {fmtDate(c.nextPaymentDate)}</span>
                      </div>
                    )}
                    <p className="text-xs text-zinc-600">{FREQ_LABELS[c.paymentFrequency] || c.paymentFrequency}</p>
                  </div>

                  {/* Ações */}
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => openDetails(c)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-xs text-white transition-colors"
                    >
                      <Eye size={14} /> Detalhes
                    </button>
                    <button
                      onClick={() => openEdit(c)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-xs text-white transition-colors"
                    >
                      <Edit2 size={14} /> Editar
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ===== MODAL DETALHES ===== */}
      {detailsOpen && selected && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-zinc-800">
              <h2 className="font-bold text-lg">Detalhes do Contrato</h2>
              <button onClick={() => setDetailsOpen(false)} className="text-zinc-400 hover:text-white"><X size={20} /></button>
            </div>

            <div className="p-5 space-y-5">
              {/* Cliente */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-zinc-900 p-3 rounded-lg">
                  <p className="text-xs text-zinc-500">Cliente</p>
                  <p className="font-bold">{selected.customer?.name}</p>
                </div>
                <div className="bg-zinc-900 p-3 rounded-lg">
                  <p className="text-xs text-zinc-500">CPF</p>
                  <p className="font-bold">{selected.customer?.cpf}</p>
                </div>
                <div className="bg-zinc-900 p-3 rounded-lg">
                  <p className="text-xs text-zinc-500">Valor Principal</p>
                  <p className="font-bold text-[#D4AF37]">{fmt(selected.principalAmount || selected.amount)}</p>
                </div>
                <div className="bg-zinc-900 p-3 rounded-lg">
                  <p className="text-xs text-zinc-500">Valor Restante</p>
                  <p className={`font-bold ${selected.remainingAmount > 0 ? 'text-yellow-400' : 'text-green-400'}`}>{fmt(selected.remainingAmount)}</p>
                </div>
                <div className="bg-zinc-900 p-3 rounded-lg">
                  <p className="text-xs text-zinc-500">Frequência</p>
                  <p className="font-bold">{FREQ_LABELS[selected.paymentFrequency] || selected.paymentFrequency}</p>
                </div>
                <div className="bg-zinc-900 p-3 rounded-lg">
                  <p className="text-xs text-zinc-500">Valor da Parcela</p>
                  <p className="font-bold">{selected.dailyInstallmentAmount ? fmt(selected.dailyInstallmentAmount) : '—'}</p>
                </div>
                <div className="bg-zinc-900 p-3 rounded-lg">
                  <p className="text-xs text-zinc-500">Taxa de Juros</p>
                  <p className="font-bold">{selected.interestRate ? `${selected.interestRate}%` : '—'}</p>
                </div>
                <div className="bg-zinc-900 p-3 rounded-lg">
                  <p className="text-xs text-zinc-500">Início</p>
                  <p className="font-bold">{fmtDate(selected.startDate)}</p>
                </div>
              </div>

              {/* Notas Admin */}
              {selected.adminNotes && (
                <div className="bg-yellow-900/20 border border-yellow-700/40 rounded-lg p-3">
                  <p className="text-xs text-yellow-400 font-bold mb-1">Observações Admin</p>
                  <p className="text-sm text-white">{selected.adminNotes}</p>
                </div>
              )}

              {/* Parcelas */}
              <div>
                <button
                  onClick={() => setExpandedInstallments(!expandedInstallments)}
                  className="flex items-center gap-2 w-full text-left font-bold text-[#D4AF37] mb-3"
                >
                  {expandedInstallments ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  Parcelas ({paidCount(selected)}/{selected.totalInstallments || selected.installmentsCount} pagas)
                </button>

                {expandedInstallments && (
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {selected.installments.map((inst, idx) => (
                      <div key={inst.id} className={`flex items-center justify-between p-3 rounded-lg border ${inst.status === 'PAID' ? 'border-green-800 bg-green-900/10' : 'border-zinc-800 bg-zinc-900'}`}>
                        <div>
                          <p className="text-sm font-bold">#{idx + 1} — {fmt(inst.amount)}</p>
                          <p className="text-xs text-zinc-500">
                            Vence: {fmtDate(inst.dueDate)}
                            {inst.paidAt && ` · Pago em: ${fmtDate(inst.paidAt)}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {inst.status === 'PAID' ? (
                            <CheckCircle size={16} className="text-green-400" />
                          ) : (
                            <button
                              onClick={() => { setDetailsOpen(false); openPayment(selected, inst); }}
                              className="text-xs bg-[#D4AF37] text-black px-3 py-1 rounded-lg font-bold hover:bg-yellow-500 transition-colors"
                            >
                              Registrar
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <Button variant="secondary" onClick={() => setDetailsOpen(false)} className="flex-1">Fechar</Button>
                <Button onClick={() => { setDetailsOpen(false); openEdit(selected); }} className="flex-1">
                  <Edit2 size={16} /> Editar Contrato
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== MODAL EDITAR ===== */}
      {editOpen && selected && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-zinc-800">
              <h2 className="font-bold text-lg">Editar Contrato</h2>
              <button onClick={() => setEditOpen(false)} className="text-zinc-400 hover:text-white"><X size={20} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-bold mb-1">Valor da Parcela/Diária (R$)</label>
                <input
                  type="number"
                  value={editData.dailyInstallmentAmount}
                  onChange={e => setEditData(d => ({ ...d, dailyInstallmentAmount: e.target.value }))}
                  className="w-full bg-black border border-zinc-700 rounded-lg px-4 py-2 text-white focus:border-[#D4AF37] outline-none"
                  placeholder="Ex: 120.00"
                />
              </div>
              <div>
                <label className="block text-sm font-bold mb-1">Próximo Vencimento</label>
                <input
                  type="date"
                  value={editData.nextPaymentDate}
                  onChange={e => setEditData(d => ({ ...d, nextPaymentDate: e.target.value }))}
                  className="w-full bg-black border border-zinc-700 rounded-lg px-4 py-2 text-white focus:border-[#D4AF37] outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-bold mb-1">Observações</label>
                <textarea
                  value={editData.adminNotes}
                  onChange={e => setEditData(d => ({ ...d, adminNotes: e.target.value }))}
                  rows={3}
                  className="w-full bg-black border border-zinc-700 rounded-lg px-4 py-2 text-white focus:border-[#D4AF37] outline-none resize-none"
                  placeholder="Notas internas do contrato..."
                />
              </div>
              <div className="flex gap-3 pt-2">
                <Button variant="secondary" onClick={() => setEditOpen(false)} className="flex-1">Cancelar</Button>
                <Button onClick={handleSaveEdit} disabled={saving} className="flex-1">
                  <Save size={16} /> {saving ? 'Salvando...' : 'Salvar'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== MODAL PAGAMENTO MANUAL ===== */}
      {paymentOpen && selected && selectedInstallment && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-zinc-800">
              <h2 className="font-bold text-lg">Registrar Pagamento</h2>
              <button onClick={() => setPaymentOpen(false)} className="text-zinc-400 hover:text-white"><X size={20} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="bg-zinc-900 p-3 rounded-lg">
                <p className="text-xs text-zinc-500">Cliente</p>
                <p className="font-bold">{selected.customer?.name}</p>
                <p className="text-sm text-[#D4AF37]">Parcela de {fmt(selectedInstallment.amount)} · Vence {fmtDate(selectedInstallment.dueDate)}</p>
              </div>

              <div>
                <label className="block text-sm font-bold mb-1">Valor Recebido (R$)</label>
                <input
                  type="number"
                  value={paymentData.amount}
                  onChange={e => setPaymentData(d => ({ ...d, amount: e.target.value }))}
                  className="w-full bg-black border border-zinc-700 rounded-lg px-4 py-2 text-white focus:border-[#D4AF37] outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-bold mb-1">Método</label>
                <select
                  value={paymentData.paymentMethod}
                  onChange={e => setPaymentData(d => ({ ...d, paymentMethod: e.target.value }))}
                  className="w-full bg-black border border-zinc-700 rounded-lg px-4 py-2 text-white focus:border-[#D4AF37] outline-none"
                >
                  <option value="PIX">PIX</option>
                  <option value="DINHEIRO">Dinheiro</option>
                  <option value="TED">TED/Transferência</option>
                  <option value="CARTAO">Cartão</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold mb-1">Comprovante (PDF ou Imagem)</label>
                {!paymentData.receiptUrl ? (
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-zinc-700 rounded-lg cursor-pointer hover:border-[#D4AF37] transition-colors bg-black">
                    <Upload size={32} className="text-zinc-500 mb-2" />
                    <span className="text-sm text-zinc-500">
                      {uploadingReceipt ? 'Carregando...' : 'Clique para anexar PDF ou imagem'}
                    </span>
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={handleReceiptUpload}
                      disabled={uploadingReceipt}
                      className="hidden"
                    />
                  </label>
                ) : (
                  <div className="relative">
                    {paymentData.receiptUrl.includes('application/pdf') ? (
                      <div className="bg-black border border-zinc-700 rounded-lg p-4 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <FileText size={24} className="text-red-400" />
                          <span className="text-sm text-white">Comprovante.pdf</span>
                        </div>
                        <button
                          onClick={() => setPaymentData(d => ({ ...d, receiptUrl: '' }))}
                          className="text-red-400 hover:text-red-300"
                        >
                          <X size={20} />
                        </button>
                      </div>
                    ) : (
                      <div className="relative">
                        <img src={paymentData.receiptUrl} alt="Preview" className="w-full h-48 object-cover rounded-lg border border-zinc-700" />
                        <button
                          onClick={() => setPaymentData(d => ({ ...d, receiptUrl: '' }))}
                          className="absolute top-2 right-2 bg-red-600 text-white rounded-full p-1 hover:bg-red-700"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-bold mb-1">Observações</label>
                <input
                  type="text"
                  value={paymentData.notes}
                  onChange={e => setPaymentData(d => ({ ...d, notes: e.target.value }))}
                  className="w-full bg-black border border-zinc-700 rounded-lg px-4 py-2 text-white focus:border-[#D4AF37] outline-none"
                  placeholder="Ex: Pago pessoalmente"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <Button variant="secondary" onClick={() => setPaymentOpen(false)} className="flex-1">Cancelar</Button>
                <Button onClick={handleRegisterPayment} disabled={registering} className="flex-1">
                  <DollarSign size={16} /> {registering ? 'Registrando...' : 'Confirmar Pagamento'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
