
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  FileText, Search, X, ChevronDown, ChevronUp, Eye, DollarSign,
  Edit2, CheckCircle, Clock, AlertTriangle, RefreshCw, Save, Upload,
  Filter, Hourglass, CheckCircle2, XCircle, Image, ExternalLink, PhoneCall
} from 'lucide-react';
import { apiService } from '../../services/apiService';
import { Button } from '../../components/Button';
import { useToast } from '../../components/Toast';
import {
  getProfileType,
  getDisplayMode,
  countAmortizingPaid,
  getInterestState,
  INTEREST_STATE_LABEL,
} from '../../utils/modalityDisplay';

interface ContractInstallment {
  id: string;
  dueDate: string;
  amount: number;
  status: 'OPEN' | 'PAID' | 'LATE' | 'AWAITING_CONFIRMATION';
  paidAt?: string;
  proofUrl?: string;
  isInterestPayment?: boolean;
  lateFeeAmount?: number;
  totalAmount?: number;
}

interface PendingProof {
  installmentId: string;
  loanId: string;
  amount: number;
  dueDate: string;
  proofUrl: string;
  submittedAt: string;
  customer: { id: string; name: string; phone: string; cpf: string } | null;
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

// Badges de modalidade — cores específicas por profileType
const PROFILE_BADGE: Record<string, { label: string; color: string }> = {
  AUTONOMO:         { label: '🏪 Comércio/Giro',    color: 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/40' },
  CLT:              { label: '🏢 CLT',               color: 'bg-blue-500/20 text-blue-300 border border-blue-500/40' },
  GARANTIA:         { label: '🔒 Garantia',          color: 'bg-green-500/20 text-green-300 border border-green-500/40' },
  GARANTIA_VEICULO: { label: '🚗 Garantia Veículo',  color: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' },
  LIMPA_NOME:       { label: '✨ Limpa Nome',        color: 'bg-purple-500/20 text-purple-300 border border-purple-500/40' },
  MOTO:             { label: '🏍️ Moto',              color: 'bg-orange-500/20 text-orange-300 border border-orange-500/40' },
  INVESTIDOR:       { label: '📈 Investidor',        color: 'bg-pink-500/20 text-pink-300 border border-pink-500/40' },
};

// Filtros de modalidade
const MODALITY_FILTERS = [
  { value: 'ALL',       label: 'Todas' },
  { value: 'AUTONOMO',  label: '🏪 Comércio' },
  { value: 'CLT',       label: '🏢 CLT' },
  { value: 'GARANTIA',  label: '🔒 Garantia' },
  { value: 'LIMPA_NOME',label: '✨ Limpa Nome' },
  { value: 'MOTO',      label: '🏍️ Moto' },
  { value: 'INVESTIDOR',label: '📈 Investidor' },
];

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const installmentTotal = (inst: ContractInstallment) => inst.totalAmount ?? (Number(inst.amount || 0) + Number(inst.lateFeeAmount || 0));
const fmtDate = (d?: string) => d ? new Date(d).toLocaleDateString('pt-BR') : '—';
const STATUS_FILTER_STORAGE_KEY = 'tubarao.admin.contracts.statusFilter';
const getInitialStatusFilter = () => {
  if (typeof window === 'undefined') return 'ALL';
  return sessionStorage.getItem(STATUS_FILTER_STORAGE_KEY) || 'ALL';
};
const onlyDigits = (value?: string | null) => (value || '').replace(/\D/g, '');
const whatsappHref = (phone?: string | null) => {
  const digits = onlyDigits(phone);
  if (!digits) return null;
  return `https://wa.me/${digits.startsWith('55') ? digits : `55${digits}`}`;
};

export const Contracts: React.FC = () => {
  const { addToast } = useToast();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(getInitialStatusFilter);
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [modalityFilter, setModalityFilter] = useState('ALL');

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
  const [partialPaymentOpen, setPartialPaymentOpen] = useState(false);
  const [selectedInstallment, setSelectedInstallment] = useState<ContractInstallment | null>(null);
  const [paymentData, setPaymentData] = useState({ amount: '', paymentMethod: 'PIX', receiptUrl: '', notes: '' });
  const [payoffBalance, setPayoffBalance] = useState<any | null>(null);
  const [detailPayoffBalance, setDetailPayoffBalance] = useState<any | null>(null);
  const [loadingPayoffBalance, setLoadingPayoffBalance] = useState(false);
  const [loadingDetailPayoffBalance, setLoadingDetailPayoffBalance] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);

  // P1: Baixa Manual e Quitação Total
  const [processingBaixa, setProcessingBaixa] = useState<Set<string>>(new Set());
  const [settlingAll, setSettlingAll] = useState(false);

  // Comprovantes pendentes (AWAITING_CONFIRMATION)
  const [pendingProofs, setPendingProofs] = useState<PendingProof[]>([]);
  const [loadingProofs, setLoadingProofs] = useState(false);
  const [proofPreview, setProofPreview] = useState<PendingProof | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [processingProof, setProcessingProof] = useState(false);

  // PaymentReceipts (fluxo novo) do contrato aberto em detalhes
  const [loanReceipts, setLoanReceipts] = useState<any[]>([]);
  const [receiptPreview, setReceiptPreview] = useState<any | null>(null);
  const [approvingReceipt, setApprovingReceipt] = useState(false);
  const [receiptRejectReason, setReceiptRejectReason] = useState('');

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

  const loadPendingProofs = useCallback(async () => {
    setLoadingProofs(true);
    try {
      const data = await apiService.getPendingProofs();
      setPendingProofs(data);
    } catch {
      // silently fail
    } finally {
      setLoadingProofs(false);
    }
  }, []);

  const handleConfirmProof = async (proof: PendingProof) => {
    setProcessingProof(true);
    try {
      await apiService.confirmProof(proof.loanId, proof.installmentId);
      addToast('Pagamento confirmado com sucesso!', 'success');
      setProofPreview(null);
      loadPendingProofs();
      load();
    } catch (err: any) {
      addToast(err.message || 'Erro ao confirmar', 'error');
    } finally {
      setProcessingProof(false);
    }
  };

  const handleRejectProof = async (proof: PendingProof) => {
    setProcessingProof(true);
    try {
      await apiService.rejectProof(proof.loanId, proof.installmentId, rejectReason || undefined);
      addToast('Comprovante rejeitado.', 'info');
      setProofPreview(null);
      setRejectReason('');
      loadPendingProofs();
    } catch (err: any) {
      addToast(err.message || 'Erro ao rejeitar', 'error');
    } finally {
      setProcessingProof(false);
    }
  };

  // Filtro de modalidade aplicado no frontend (profileType vem do loanRequest)
  // Quando há busca, ignora filtro de modalidade para encontrar em todos
  const filteredContracts = useMemo(() => {
    if (search) return contracts; // busca ativa → mostra tudo que o backend retornou
    if (modalityFilter === 'ALL') return contracts;
    return contracts.filter(c => {
      const pt = c.loanRequest?.profileType;
      if (modalityFilter === 'GARANTIA') return pt === 'GARANTIA' || pt === 'GARANTIA_VEICULO';
      return pt === modalityFilter;
    });
  }, [contracts, modalityFilter, search]);

  useEffect(() => {
    sessionStorage.setItem(STATUS_FILTER_STORAGE_KEY, statusFilter);
  }, [statusFilter]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  useEffect(() => {
    loadPendingProofs();
  }, [loadPendingProofs]);

  const openDetails = async (c: Contract) => {
    setSelected(c);
    setDetailsOpen(true);
    setExpandedInstallments(false);
    setLoanReceipts([]); // Reset para evitar flash de dados do contrato anterior
    setDetailPayoffBalance(null);
    setLoadingDetailPayoffBalance(true);

    const [detailsResult, payoffResult, receiptsResult] = await Promise.allSettled([
      apiService.getAdminLoanDetails(c.id),
      apiService.getLoanPayoffBalance(c.id),
      apiService.getPaymentReceipts(),
    ]);

    if (detailsResult.status === 'fulfilled' && detailsResult.value) {
      setSelected(detailsResult.value);
    }
    if (payoffResult.status === 'fulfilled') {
      setDetailPayoffBalance(payoffResult.value);
    }
    if (receiptsResult.status === 'fulfilled') {
      const filtered = (receiptsResult.value || []).filter((r: any) => r.loanId === c.id);
      setLoanReceipts(filtered);
    } else {
      setLoanReceipts([]);
    }
    setLoadingDetailPayoffBalance(false);
  };

  const reloadLoanReceipts = useCallback(async () => {
    if (!selected) return;
    try {
      const all = await apiService.getPaymentReceipts();
      const filtered = (all || []).filter((r: any) => r.loanId === selected.id);
      setLoanReceipts(filtered);
    } catch {
      // ignore
    }
  }, [selected]);

  const handleApproveReceiptFromDetails = async (
    receipt: any,
    mode: 'INTEREST_ONLY' | 'AMORTIZATION' | 'DISCHARGE'
  ) => {
    setApprovingReceipt(true);
    try {
      await apiService.approvePaymentReceipt(receipt.id, {
        isDischarge: mode === 'DISCHARGE',
        isInterestOnly: mode === 'INTEREST_ONLY'
      });
      const msgMap = {
        INTEREST_ONLY: 'Juros aprovado — principal mantido, próxima parcela de juros gerada.',
        AMORTIZATION: 'Amortização aprovada — principal abatido.',
        DISCHARGE: 'Quitação total aprovada — contrato encerrado.'
      };
      addToast(msgMap[mode], 'success');
      setReceiptPreview(null);
      // Recarrega detalhes + receipts + lista
      const details = await apiService.getAdminLoanDetails(selected!.id);
      if (details) setSelected(details);
      reloadLoanReceipts();
      load();
    } catch (err: any) {
      addToast(err.message || 'Erro ao aprovar comprovante', 'error');
    } finally {
      setApprovingReceipt(false);
    }
  };

  const handleRejectReceiptFromDetails = async (receipt: any) => {
    setApprovingReceipt(true);
    try {
      await apiService.rejectPaymentReceipt(receipt.id, receiptRejectReason || undefined);
      addToast('Comprovante rejeitado.', 'info');
      setReceiptPreview(null);
      setReceiptRejectReason('');
      reloadLoanReceipts();
    } catch (err: any) {
      addToast(err.message || 'Erro ao rejeitar', 'error');
    } finally {
      setApprovingReceipt(false);
    }
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
    setPaymentData({ amount: String(installmentTotal(inst)), paymentMethod: 'PIX', receiptUrl: '', notes: '' });
    setPaymentOpen(true);
  };

  const openPartialPayment = async (c: Contract) => {
    setSelected(c);
    setSelectedInstallment(null);
    setPaymentData({ amount: '', paymentMethod: 'PIX', receiptUrl: '', notes: '' });
    setPayoffBalance(null);
    setPartialPaymentOpen(true);
    setLoadingPayoffBalance(true);
    try {
      const balance = await apiService.getLoanPayoffBalance(c.id);
      setPayoffBalance(balance);
      if (balance?.cycleChargeBalance > 0) {
        setPaymentData(d => ({ ...d, amount: String(balance.cycleChargeBalance) }));
      }
    } catch (err: any) {
      addToast(err.message || 'Erro ao calcular saldo', 'error');
    } finally {
      setLoadingPayoffBalance(false);
    }
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
      setStatusFilter('ACTIVE');
      load();
    } catch (err: any) {
      addToast(err.message || 'Erro ao registrar', 'error');
    } finally {
      setRegistering(false);
    }
  };

  const handleRegisterPartialPayment = async () => {
    if (!selected) return;
    if (!paymentData.amount) { addToast('Informe o valor pago', 'warning'); return; }
    setRegistering(true);
    try {
      const result = await apiService.registerPartialPayment(selected.id, {
        amount: parseFloat(paymentData.amount),
        paymentMethod: paymentData.paymentMethod,
        receiptUrl: paymentData.receiptUrl || undefined,
        notes: paymentData.notes || undefined
      });
      const wf = result?.waterfall;
      addToast(`Pagamento parcial registrado: juros ${fmt(wf?.appliedToInterest || 0)}, multas ${fmt(wf?.appliedToFees || 0)}, principal ${fmt(wf?.appliedToPrincipal || 0)}`, 'success');
      setPartialPaymentOpen(false);
      setDetailsOpen(false);
      setStatusFilter('ACTIVE');
      load();
    } catch (err: any) {
      addToast(err.message || 'Erro ao registrar pagamento parcial', 'error');
    } finally {
      setRegistering(false);
    }
  };


  // P1: Handler para Baixa Manual (marca parcela como PAID diretamente)
  const handleManualMarkPaid = async (inst: ContractInstallment) => {
    if (!selected) return;
    if (!window.confirm(`Confirmar baixa manual da parcela ${fmt(inst.amount)}?`)) return;
    
    setProcessingBaixa(prev => new Set(prev).add(inst.id));
    try {
      await apiService.registerManualPayment(selected.id, {
        installmentId: inst.id,
        amount: inst.amount,
        paymentMethod: 'MANUAL',
        notes: 'Baixa manual pelo admin'
      });
      addToast('Parcela marcada como paga!', 'success');
      const updated = await apiService.getAdminLoanDetails(selected.id);
      setSelected(updated);
      setStatusFilter(updated.status === 'COMPLETED' || updated.status === 'PAID' ? updated.status : 'ACTIVE');
      load();
    } catch (err: any) {
      addToast(err.message || 'Erro ao dar baixa', 'error');
    } finally {
      setProcessingBaixa(prev => {
        const next = new Set(prev);
        next.delete(inst.id);
        return next;
      });
    }
  };

  // P1: Handler para Quitação Total (marca TODAS as parcelas pendentes como PAID)
  const handleSettleAll = async () => {
    if (!selected) return;
    const pending = selected.installments.filter(i => i.status === 'OPEN' || i.status === 'LATE' || i.status === 'AWAITING_CONFIRMATION');
    if (pending.length === 0) {
      addToast('Não há parcelas pendentes para quitar', 'info');
      return;
    }
    
    const totalPending = pending.reduce((sum, i) => sum + i.amount, 0);
    if (!window.confirm(`Confirmar quitação total de ${pending.length} parcela(s) no valor de ${fmt(totalPending)}?`)) return;
    
    setSettlingAll(true);
    try {
      await apiService.settleAllInstallments(selected.id);
      addToast('Contrato quitado com sucesso!', 'success');
      setDetailsOpen(false);
      setStatusFilter('COMPLETED');
      load();
    } catch (err: any) {
      addToast(err.message || 'Erro ao quitar contrato', 'error');
    } finally {
      setSettlingAll(false);
    }
  };

  const getProfileBadge = (c: Contract) => {
    const pt = c.loanRequest?.profileType;
    if (pt && PROFILE_BADGE[pt]) return PROFILE_BADGE[pt];
    if (c.isService) return PROFILE_BADGE['LIMPA_NOME'];
    if (c.isInvestment) return PROFILE_BADGE['INVESTIDOR'];
    return { label: '💼 Empréstimo', color: 'bg-zinc-700/60 text-zinc-300 border border-zinc-600/40' };
  };

  // Conta apenas parcelas amortizadoras pagas (exclui pagamentos de juros de rolagem).
  // Conceitualmente válido só para MOTO — a decisão de exibir é feita por profileType.
  const paidCount = (c: Contract) => countAmortizingPaid(c.installments);

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <FileText className="text-[#D4AF37]" /> Contratos
          </h1>
          <p className="text-zinc-400 text-sm mt-1">
            {filteredContracts.length} contrato(s) exibido(s)
            {modalityFilter !== 'ALL' && <span className="ml-1 text-yellow-400">· filtrando por {MODALITY_FILTERS.find(f => f.value === modalityFilter)?.label}</span>}
          </p>
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

      {/* Filtro de Modalidade — linha separada com destaque */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="flex items-center gap-1 text-xs text-zinc-500 shrink-0">
          <Filter size={12} /> Modalidade:
        </span>
        {MODALITY_FILTERS.map(f => (
          <button
            key={f.value}
            onClick={() => setModalityFilter(f.value)}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
              modalityFilter === f.value
                ? 'bg-[#D4AF37] text-black shadow-md shadow-yellow-500/20'
                : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800 hover:border-zinc-600'
            }`}
          >
            {f.label}
          </button>
        ))}
        {modalityFilter !== 'ALL' && (
          <span className="text-xs text-zinc-500 ml-2">
            {filteredContracts.length} contrato(s)
          </span>
        )}
      </div>

      {/* ===== SEÇÃO: Comprovantes Aguardando Validação ===== */}
      {(loadingProofs || pendingProofs.length > 0) && (
        <div className="bg-amber-950/20 border border-amber-700/40 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-amber-400 flex items-center gap-2">
              <Hourglass size={18} />
              Comprovantes Aguardando Validação
              {pendingProofs.length > 0 && (
                <span className="bg-amber-500 text-black text-xs font-black px-2 py-0.5 rounded-full">{pendingProofs.length}</span>
              )}
            </h2>
            <button onClick={loadPendingProofs} className="text-zinc-500 hover:text-white text-xs flex items-center gap-1">
              <RefreshCw size={12} /> Atualizar
            </button>
          </div>

          {loadingProofs ? (
            <p className="text-zinc-500 text-sm">Carregando...</p>
          ) : (
            <div className="space-y-2">
              {pendingProofs.map(proof => (
                <div key={proof.installmentId} className="bg-zinc-950 border border-amber-700/30 rounded-lg p-3 flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-white text-sm">{proof.customer?.name || '—'}</p>
                    <p className="text-xs text-zinc-500">{proof.customer?.cpf} · {proof.customer?.phone}</p>
                    <p className="text-xs text-zinc-400 mt-1">
                      Parcela de <span className="text-amber-400 font-bold">{fmt(proof.amount)}</span>
                      · Vence {fmtDate(proof.dueDate)}
                      · Enviado {fmtDate(proof.submittedAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {proof.proofUrl && (
                      <a href={proof.proofUrl} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1 px-2 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-xs text-zinc-300 transition-colors">
                        <Image size={12} /> Ver
                      </a>
                    )}
                    <button
                      onClick={() => { setProofPreview(proof); setRejectReason(''); }}
                      className="flex items-center gap-1 px-3 py-1.5 bg-amber-900/40 hover:bg-amber-900/70 border border-amber-600/40 rounded-lg text-xs text-amber-300 font-bold transition-colors"
                    >
                      Analisar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="text-center py-12 text-zinc-500">Carregando...</div>
      ) : filteredContracts.length === 0 ? (
        <div className="text-center py-12 text-zinc-500">
          {modalityFilter !== 'ALL' ? `Nenhum contrato de ${MODALITY_FILTERS.find(f => f.value === modalityFilter)?.label} encontrado` : 'Nenhum contrato encontrado'}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredContracts.map(c => {
            const status = STATUS_LABELS[c.status] || { label: c.status, color: 'bg-zinc-700 text-zinc-300' };
            const paid = paidCount(c);
            const total = c.totalInstallments || c.installmentsCount;
            const profileBadge = getProfileBadge(c);
            const displayMode = getDisplayMode(getProfileType(c));
            return (
              <div key={c.id} className={`bg-zinc-950 border rounded-xl p-4 hover:border-zinc-600 transition-colors ${c.loanRequest?.profileType === 'AUTONOMO' ? 'border-yellow-800/40 hover:border-yellow-700/60' : 'border-zinc-800'}`}>
                <div className="flex flex-col md:flex-row md:items-center gap-3">
                  {/* Cliente */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-white truncate">{c.customer?.name || '—'}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${status.color}`}>{status.label}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${profileBadge.color}`}>{profileBadge.label}</span>
                      {c.paymentFrequency === 'DAILY' && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-900/30 text-yellow-400 border border-yellow-600/30 font-semibold">⚡ Diário</span>
                      )}
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
                    {displayMode === 'PARCELAS' ? (
                      <div>
                        <p className="text-xs text-zinc-500">Parcelas</p>
                        <p className="font-bold text-white">{paid}/{total} <span className="text-xs text-zinc-500">pagas</span></p>
                      </div>
                    ) : displayMode === 'SALDO_JUROS' ? (
                      <div>
                        <p className="text-xs text-zinc-500">Juros do mês</p>
                        {(() => {
                          const state = getInterestState(c.installments);
                          const color = state === 'ATRASADO' ? 'text-red-400' : state === 'EM_ABERTO' ? 'text-yellow-400' : 'text-green-400';
                          return <p className={`font-bold ${color}`}>{INTEREST_STATE_LABEL[state]}</p>;
                        })()}
                      </div>
                    ) : displayMode === 'SALDO_DIARIAS' ? (
                      <div>
                        <p className="text-xs text-zinc-500">Diárias</p>
                        <p className="font-bold text-white">{paid}<span className="text-xs text-zinc-500">/{total} pagas</span></p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-xs text-zinc-500">Saldo</p>
                        <p className={`font-bold ${c.remainingAmount > 0 ? 'text-yellow-400' : 'text-green-400'}`}>{fmt(c.remainingAmount)}</p>
                      </div>
                    )}
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
                  <p className="text-xs text-zinc-500">Telefone</p>
                  {whatsappHref(selected.customer?.phone) ? (
                    <a
                      href={whatsappHref(selected.customer?.phone)!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-flex items-center gap-2 rounded-lg bg-green-600 px-3 py-2 text-sm font-bold text-white transition-colors hover:bg-green-700"
                      aria-label={`Abrir WhatsApp de ${selected.customer?.name || 'cliente'}`}
                    >
                      <PhoneCall size={14} />
                      {selected.customer?.phone || 'WhatsApp'}
                    </a>
                  ) : (
                    <p className="font-bold text-zinc-500">Sem telefone</p>
                  )}
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

              {/* Saldo atualizado pela API */}
              <div className="rounded-xl border border-red-700/50 bg-red-950/30 p-4 shadow-lg shadow-red-950/20">
                <p className="text-xs font-bold uppercase tracking-wide text-red-300">Dívida Total Atualizada</p>
                {loadingDetailPayoffBalance ? (
                  <p className="mt-2 text-sm text-red-200 animate-pulse">Calculando juros e multas de hoje...</p>
                ) : detailPayoffBalance ? (
                  <>
                    <p className="mt-1 text-3xl font-black text-red-100">{fmt(detailPayoffBalance.totalPayoffBalance || 0)}</p>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs md:grid-cols-4">
                      <p className="rounded-lg bg-black/30 p-2 text-zinc-300">Principal<br /><span className="font-bold text-white">{fmt(detailPayoffBalance.principalBalance || 0)}</span></p>
                      <p className="rounded-lg bg-black/30 p-2 text-zinc-300">Juros<br /><span className="font-bold text-yellow-300">{fmt(detailPayoffBalance.interestBalance || 0)}</span></p>
                      <p className="rounded-lg bg-black/30 p-2 text-zinc-300">Multas<br /><span className="font-bold text-red-300">{fmt(detailPayoffBalance.feeBalance || 0)}</span></p>
                      <p className="rounded-lg bg-black/30 p-2 text-zinc-300">Cobrança atual<br /><span className="font-bold text-[#D4AF37]">{fmt(detailPayoffBalance.cycleChargeBalance || 0)}</span></p>
                    </div>
                  </>
                ) : (
                  <p className="mt-2 text-sm text-red-200">Saldo atualizado indisponível. Reabra o modal ou use Registrar Pagamento Parcial/Avulso.</p>
                )}
              </div>

              {/* Notas Admin */}
              {selected.adminNotes && (
                <div className="bg-yellow-900/20 border border-yellow-700/40 rounded-lg p-3">
                  <p className="text-xs text-yellow-400 font-bold mb-1">Observações Admin</p>
                  <p className="text-sm text-white">{selected.adminNotes}</p>
                </div>
              )}

              {/* Comprovantes do contrato (PaymentReceipt) */}
              <div className="bg-amber-900/10 border border-amber-700/30 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-amber-400 flex items-center gap-2">
                    <Image size={16} /> Comprovantes do Cliente
                    {loanReceipts.filter(r => r.status === 'PENDING').length > 0 && (
                      <span className="bg-amber-500 text-black text-xs font-black px-2 py-0.5 rounded-full">
                        {loanReceipts.filter(r => r.status === 'PENDING').length} pendente(s)
                      </span>
                    )}
                  </h3>
                </div>
                {loanReceipts.length === 0 ? (
                  <p className="text-xs text-zinc-500">Nenhum comprovante enviado pelo cliente.</p>
                ) : (
                  <div className="space-y-2">
                    {loanReceipts.map((r) => (
                      <div key={r.id} className="bg-zinc-950 border border-zinc-800 rounded-lg p-3 flex items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                              r.status === 'PENDING' ? 'bg-amber-500/20 text-amber-400' :
                              r.status === 'APPROVED' ? 'bg-green-500/20 text-green-400' :
                              'bg-red-500/20 text-red-400'
                            }`}>
                              {r.status === 'PENDING' ? '⏳ Pendente' : r.status === 'APPROVED' ? '✓ Aprovado' : '✗ Rejeitado'}
                            </span>
                            <span className="text-sm font-bold text-white">{fmt(r.amount)}</span>
                          </div>
                          <p className="text-xs text-zinc-500">
                            Enviado em {fmtDate(r.submittedAt || r.createdAt)}
                            {r.reviewedAt && ` · Revisado em ${fmtDate(r.reviewedAt)}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {r.receiptUrl && (
                            <a href={r.receiptUrl} target="_blank" rel="noopener noreferrer"
                              className="text-xs bg-zinc-800 hover:bg-zinc-700 text-white px-3 py-1.5 rounded-lg flex items-center gap-1">
                              <ExternalLink size={12} /> Ver
                            </a>
                          )}
                          {r.status === 'PENDING' && (
                            <button
                              onClick={() => { setReceiptPreview(r); setReceiptRejectReason(''); }}
                              className="text-xs bg-[#D4AF37] text-black px-3 py-1.5 rounded-lg font-bold hover:bg-yellow-500"
                            >
                              Aprovar / Rejeitar
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Parcelas */}
              <div>
                <button
                  onClick={() => setExpandedInstallments(!expandedInstallments)}
                  className="flex items-center gap-2 w-full text-left font-bold text-[#D4AF37] mb-3"
                >
                  {expandedInstallments ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  {(() => {
                    const mode = getDisplayMode(getProfileType(selected));
                    const total = selected.totalInstallments || selected.installmentsCount;
                    if (mode === 'PARCELAS') {
                      return <>Parcelas ({paidCount(selected)}/{total} pagas)</>;
                    }
                    if (mode === 'SALDO_JUROS') {
                      const state = getInterestState(selected.installments);
                      return <>Cobranças · Saldo {fmt(selected.remainingAmount)} · {INTEREST_STATE_LABEL[state]}</>;
                    }
                    if (mode === 'SALDO_DIARIAS') {
                      return <>Diárias ({paidCount(selected)}/{total} pagas) · Saldo {fmt(selected.remainingAmount)}</>;
                    }
                    return <>Cobranças · Saldo {fmt(selected.remainingAmount)}</>;
                  })()}
                </button>

                {expandedInstallments && (
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {selected.installments.map((inst, idx) => (
                      <div key={inst.id} className={`flex items-center justify-between p-3 rounded-lg border ${inst.status === 'PAID' ? 'border-green-800 bg-green-900/10' : 'border-zinc-800 bg-zinc-900'}`}>
                        <div>
                          <p className="text-sm font-bold">#{idx + 1} — {fmt(installmentTotal(inst))}</p>
                          {Number(inst.lateFeeAmount || 0) > 0 && (
                            <p className="text-xs text-red-400">Base {fmt(inst.amount)} + atraso {fmt(Number(inst.lateFeeAmount || 0))}</p>
                          )}
                          <p className="text-xs text-zinc-500">
                            Vence: {fmtDate(inst.dueDate)}
                            {inst.paidAt && ` · Pago em: ${fmtDate(inst.paidAt)}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {inst.status === 'PAID' ? (
                            <CheckCircle size={16} className="text-green-400" />
                          ) : inst.status === 'AWAITING_CONFIRMATION' ? (
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-amber-400 flex items-center gap-1"><Hourglass size={12} /> Aguardando</span>
                              {inst.proofUrl && (
                                <a href={inst.proofUrl} target="_blank" rel="noopener noreferrer"
                                  className="text-xs text-zinc-400 hover:text-white underline flex items-center gap-1">
                                  <ExternalLink size={10} /> Comprovante
                                </a>
                              )}
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleManualMarkPaid(inst)}
                                disabled={processingBaixa.has(inst.id)}
                                className="text-xs bg-green-600 text-white px-3 py-1 rounded-lg font-bold hover:bg-green-700 transition-colors disabled:opacity-50"
                              >
                                {processingBaixa.has(inst.id) ? '...' : 'Baixa ✓'}
                              </button>
                              <button
                                onClick={() => { setDetailsOpen(false); openPayment(selected, inst); }}
                                className="text-xs bg-[#D4AF37] text-black px-3 py-1 rounded-lg font-bold hover:bg-yellow-500 transition-colors"
                              >
                                Registrar
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                <Button variant="secondary" onClick={() => setDetailsOpen(false)} className="w-full">Fechar</Button>
                <Button onClick={() => openPartialPayment(selected)} className="w-full bg-[#D4AF37] hover:bg-yellow-500 text-black">
                  <DollarSign size={16} /> Registrar Pagamento Parcial/Avulso
                </Button>
                {selected.installments.some(i => i.status === 'OPEN' || i.status === 'LATE' || i.status === 'AWAITING_CONFIRMATION') && (
                  <Button
                    onClick={handleSettleAll}
                    disabled={settlingAll}
                    className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50"
                  >
                    {settlingAll ? 'Quitando...' : 'Quitação Total 🏁'}
                  </Button>
                )}
                <Button onClick={() => { setDetailsOpen(false); openEdit(selected); }} className="w-full">
                  <Edit2 size={16} /> Editar Contrato
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== MODAL APROVAR COMPROVANTE (PaymentReceipt do contrato) ===== */}
      {receiptPreview && (
        <div className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-2xl max-h-[95vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-zinc-800 sticky top-0 bg-zinc-950 z-10">
              <h2 className="font-bold text-lg text-white">Aprovar Comprovante</h2>
              <button onClick={() => setReceiptPreview(null)} className="text-zinc-400 hover:text-white"><X size={20} /></button>
            </div>

            <div className="p-5 space-y-4">
              {/* Info */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-zinc-900 p-3 rounded-lg">
                  <p className="text-xs text-zinc-500">Cliente</p>
                  <p className="font-bold text-white">{receiptPreview.customerName || selected?.customer?.name || '—'}</p>
                </div>
                <div className="bg-zinc-900 p-3 rounded-lg">
                  <p className="text-xs text-zinc-500">Valor</p>
                  <p className="font-bold text-[#D4AF37]">{fmt(receiptPreview.amount)}</p>
                </div>
              </div>

              {/* Preview do comprovante */}
              {receiptPreview.receiptUrl && (
                <div className="bg-black rounded-lg p-2 border border-zinc-800">
                  {/\.(jpg|jpeg|png|webp|gif)$/i.test(receiptPreview.receiptUrl) ? (
                    <img
                      src={receiptPreview.receiptUrl}
                      alt="Comprovante"
                      className="w-full max-h-96 object-contain rounded"
                    />
                  ) : (
                    <div className="py-10 text-center">
                      <FileText size={48} className="mx-auto text-zinc-500 mb-2" />
                      <a href={receiptPreview.receiptUrl} target="_blank" rel="noopener noreferrer"
                        className="text-[#D4AF37] hover:underline text-sm">
                        Abrir comprovante em nova aba ↗
                      </a>
                    </div>
                  )}
                </div>
              )}

              {/* Aviso - tipo de pagamento */}
              <div className="bg-blue-900/20 border border-blue-700/40 rounded-lg p-3 text-xs text-blue-300">
                <strong>Como aprovar?</strong><br />
                • <span className="text-yellow-300 font-bold">Juros do Mês</span>: CLT/Garantia. Não abate do capital. Gera nova parcela de juros para o próximo mês.<br />
                • <span className="text-green-300 font-bold">Amortização</span>: Comércio/Diário. Abate o valor pago do principal.<br />
                • <span className="text-[#D4AF37] font-bold">Quitação Total</span>: Encerra o contrato (remainingAmount = 0).
              </div>

              {/* Motivo de rejeição */}
              <div>
                <label className="block text-xs font-bold mb-1 text-zinc-400">Motivo (se rejeitar):</label>
                <input
                  type="text"
                  value={receiptRejectReason}
                  onChange={e => setReceiptRejectReason(e.target.value)}
                  placeholder="Opcional — ex.: comprovante ilegível"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white"
                />
              </div>

              {/* Botões de ação */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  disabled={approvingReceipt}
                  onClick={() => handleApproveReceiptFromDetails(receiptPreview, 'INTEREST_ONLY')}
                  className="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-3 rounded-lg font-bold text-sm disabled:opacity-50 transition-colors"
                >
                  💰 Somente Juros do Mês
                </button>
                <button
                  disabled={approvingReceipt}
                  onClick={() => handleApproveReceiptFromDetails(receiptPreview, 'AMORTIZATION')}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-3 rounded-lg font-bold text-sm disabled:opacity-50 transition-colors"
                >
                  📉 Amortização (Diária)
                </button>
                <button
                  disabled={approvingReceipt}
                  onClick={() => handleApproveReceiptFromDetails(receiptPreview, 'DISCHARGE')}
                  className="bg-[#D4AF37] hover:bg-yellow-500 text-black px-4 py-3 rounded-lg font-bold text-sm disabled:opacity-50 transition-colors"
                >
                  🏁 Quitação Total
                </button>
                <button
                  disabled={approvingReceipt}
                  onClick={() => handleRejectReceiptFromDetails(receiptPreview)}
                  className="bg-red-600 hover:bg-red-700 text-white px-4 py-3 rounded-lg font-bold text-sm disabled:opacity-50 transition-colors"
                >
                  ✗ Rejeitar
                </button>
              </div>

              {approvingReceipt && (
                <p className="text-center text-xs text-zinc-400 animate-pulse">Processando...</p>
              )}
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

      {/* ===== MODAL ANALISAR COMPROVANTE ===== */}
      {proofPreview && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-amber-700/40 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-zinc-800">
              <h2 className="font-bold text-lg flex items-center gap-2 text-amber-400">
                <Hourglass size={18} /> Validar Comprovante
              </h2>
              <button onClick={() => setProofPreview(null)} className="text-zinc-400 hover:text-white"><X size={20} /></button>
            </div>
            <div className="p-5 space-y-4">
              {/* Cliente */}
              <div className="bg-zinc-900 p-3 rounded-lg">
                <p className="text-xs text-zinc-500">Cliente</p>
                <p className="font-bold text-white">{proofPreview.customer?.name || '—'}</p>
                <p className="text-sm text-zinc-400">{proofPreview.customer?.cpf} · {proofPreview.customer?.phone}</p>
                <p className="text-sm text-amber-400 font-bold mt-1">Parcela de {fmt(proofPreview.amount)} — Vence {fmtDate(proofPreview.dueDate)}</p>
              </div>

              {/* Preview da imagem */}
              {proofPreview.proofUrl ? (
                proofPreview.proofUrl.startsWith('data:image') || proofPreview.proofUrl.match(/\.(jpg|jpeg|png|gif|webp)/i) ? (
                  <div className="rounded-xl overflow-hidden border border-zinc-700">
                    <img src={proofPreview.proofUrl} alt="Comprovante" className="w-full max-h-80 object-contain bg-black" />
                  </div>
                ) : (
                  <a href={proofPreview.proofUrl} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-3 bg-zinc-900 border border-zinc-700 rounded-lg p-4 hover:border-zinc-500 transition-colors">
                    <FileText size={32} className="text-red-400 shrink-0" />
                    <div>
                      <p className="text-sm font-bold text-white">Abrir Comprovante</p>
                      <p className="text-xs text-zinc-500">Clique para visualizar o arquivo</p>
                    </div>
                    <ExternalLink size={16} className="text-zinc-500 ml-auto" />
                  </a>
                )
              ) : (
                <p className="text-zinc-500 text-sm text-center py-4">Sem comprovante anexado</p>
              )}

              {/* Campo para motivo de rejeição */}
              <div>
                <label className="block text-sm font-bold mb-1 text-zinc-300">Motivo da Rejeição (opcional)</label>
                <input
                  type="text"
                  value={rejectReason}
                  onChange={e => setRejectReason(e.target.value)}
                  className="w-full bg-black border border-zinc-700 rounded-lg px-4 py-2 text-white focus:border-red-500 outline-none text-sm"
                  placeholder="Ex: Imagem ilegível, valor incorreto..."
                />
              </div>

              {/* Botões */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  onClick={() => handleRejectProof(proofPreview)}
                  disabled={processingProof}
                  className="flex items-center justify-center gap-2 py-3 rounded-xl bg-red-900/30 border border-red-700/50 hover:border-red-500 text-red-400 font-bold text-sm transition-all disabled:opacity-50"
                >
                  <XCircle size={18} /> {processingProof ? '...' : 'Rejeitar'}
                </button>
                <button
                  onClick={() => handleConfirmProof(proofPreview)}
                  disabled={processingProof}
                  className="flex items-center justify-center gap-2 py-3 rounded-xl bg-green-900/30 border border-green-700/50 hover:border-green-500 text-green-400 font-bold text-sm transition-all disabled:opacity-50"
                >
                  <CheckCircle2 size={18} /> {processingProof ? '...' : 'Confirmar Pago'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== MODAL PAGAMENTO PARCIAL / AVULSO ===== */}
      {partialPaymentOpen && selected && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-zinc-800">
              <h2 className="font-bold text-lg">Registrar Pagamento Parcial/Avulso</h2>
              <button onClick={() => setPartialPaymentOpen(false)} className="text-zinc-400 hover:text-white"><X size={20} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="bg-zinc-900 p-3 rounded-lg space-y-1">
                <p className="text-xs text-zinc-500">Cliente</p>
                <p className="font-bold">{selected.customer?.name}</p>
                {loadingPayoffBalance ? (
                  <p className="text-sm text-zinc-500 animate-pulse">Calculando saldo...</p>
                ) : payoffBalance ? (
                  <div className="grid grid-cols-2 gap-2 pt-2 text-xs">
                    <p className="text-zinc-400">Multas: <span className="text-red-400 font-bold">{fmt(payoffBalance.feeBalance || 0)}</span></p>
                    <p className="text-zinc-400">Juros: <span className="text-yellow-400 font-bold">{fmt(payoffBalance.interestBalance || 0)}</span></p>
                    <p className="text-zinc-400">Principal: <span className="text-white font-bold">{fmt(payoffBalance.principalBalance || 0)}</span></p>
                    <p className="text-zinc-400">Total: <span className="text-[#D4AF37] font-bold">{fmt(payoffBalance.totalPayoffBalance || 0)}</span></p>
                  </div>
                ) : (
                  <p className="text-sm text-red-400">Saldo não carregado</p>
                )}
              </div>

              <div className="bg-blue-900/20 border border-blue-700/40 rounded-lg p-3 text-xs text-blue-300">
                Aplicação automática: multas/mora → juros → principal. Registro fica rastreável em Transaction com contrato:{selected.id}.
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
                  <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-zinc-700 rounded-lg cursor-pointer hover:border-[#D4AF37] transition-colors bg-black">
                    <Upload size={28} className="text-zinc-500 mb-2" />
                    <span className="text-sm text-zinc-500">{uploadingReceipt ? 'Carregando...' : 'Clique para anexar PDF ou imagem'}</span>
                    <input type="file" accept="image/*,application/pdf" onChange={handleReceiptUpload} disabled={uploadingReceipt} className="hidden" />
                  </label>
                ) : (
                  <div className="bg-black border border-zinc-700 rounded-lg p-3 flex items-center justify-between">
                    <span className="text-sm text-white">Comprovante anexado</span>
                    <button onClick={() => setPaymentData(d => ({ ...d, receiptUrl: '' }))} className="text-red-400 hover:text-red-300"><X size={18} /></button>
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
                  placeholder="Ex: Pagamento parcial no balcão"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <Button variant="secondary" onClick={() => setPartialPaymentOpen(false)} className="flex-1">Cancelar</Button>
                <Button onClick={handleRegisterPartialPayment} disabled={registering || loadingPayoffBalance} className="flex-1">
                  <DollarSign size={16} /> {registering ? 'Registrando...' : 'Confirmar'}
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
                <p className="text-sm text-[#D4AF37]">Parcela de {fmt(installmentTotal(selectedInstallment))} · Vence {fmtDate(selectedInstallment.dueDate)}</p>
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
