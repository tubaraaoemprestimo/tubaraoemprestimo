import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock3, ExternalLink, Mail, Phone, Search, ShieldCheck, TrendingUp, XCircle } from 'lucide-react';
import { Button } from '../../components/Button';
import { useToast } from '../../components/Toast';
import { InvestorStatus } from '../../types';
import { apiService } from '../../services/apiService';

type InvestorRow = {
  id: string;
  fullName: string;
  cpfCnpj: string;
  email: string;
  phone: string;
  rgCnh: string;
  birthDate: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  preferredContactTime: string;
  investmentAmount: number;
  investmentTier: string;
  payoutMode: string;
  monthlyRate: number;
  contractMonths: number;
  autoRenew: boolean;
  withdrawalNoticeMonths: number;
  termsAccepted: boolean;
  termsAcceptedAt: string;
  signatureUrl: string;
  status: InvestorStatus;
  bankName: string;
  pixKey: string;
  pixKeyType: string;
  accountHolderName: string;
  idCardUrl: string;
  idCardBackUrl: string;
  proofOfAddressUrl: string;
  selfieUrl: string;
  createdAt: string;
  approvedAt: string;
  updatedAt: string;
  adminNotes: string;
};

const statusStyles: Record<InvestorStatus, string> = {
  PENDING: 'bg-yellow-500/20 text-yellow-300 border-yellow-600/40',
  APPROVED: 'bg-blue-500/20 text-blue-300 border-blue-600/40',
  ACTIVE: 'bg-cyan-500/20 text-cyan-300 border-cyan-600/40',
  COMPLETED: 'bg-green-500/20 text-green-300 border-green-600/40',
  REJECTED: 'bg-red-500/20 text-red-300 border-red-600/40',
  CANCELLED: 'bg-zinc-700/40 text-zinc-300 border-zinc-600/40',
};

const statusLabel: Record<InvestorStatus, string> = {
  PENDING: 'Pendente',
  APPROVED: 'Aprovado',
  ACTIVE: 'Ativo',
  COMPLETED: 'Concluído',
  REJECTED: 'Rejeitado',
  CANCELLED: 'Cancelado',
};

const formatCurrency = (value: number) => `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatDate = (value: string) => {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('pt-BR');
};

const formatDateTime = (value: string) => {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('pt-BR');
};

const normalizeUrl = (value: string) => {
  if (!value || value === '-') return '';
  if (value.startsWith('http://') || value.startsWith('https://')) return value;
  return `https://${value}`;
};

const digitsOnly = (value: string) => value.replace(/\D/g, '');

const toInvestorRow = (raw: any): InvestorRow => ({
  id: raw.id,
  fullName: raw.client_name ?? raw.clientName ?? raw.full_name ?? raw.fullName ?? '-',
  cpfCnpj: raw.cpf ?? raw.cpf_cnpj ?? raw.cpfCnpj ?? '-',
  email: raw.email ?? '-',
  phone: raw.phone ?? '-',
  rgCnh: raw.rg_cnh ?? raw.rgCnh ?? '-',
  birthDate: raw.birth_date ?? raw.birthDate ?? '',
  address: raw.address ?? '-',
  city: raw.city ?? '-',
  state: raw.state ?? '-',
  zipCode: raw.zip_code ?? raw.zipCode ?? '-',
  preferredContactTime: raw.preferred_contact_time ?? raw.preferredContactTime ?? '-',
  investmentAmount: Number(raw.amount ?? raw.investment_amount ?? raw.investmentAmount ?? 0),
  investmentTier: raw.investment_tier ?? raw.investmentTier ?? 'STANDARD',
  payoutMode: raw.payout_mode ?? raw.payoutMode ?? 'MONTHLY',
  monthlyRate: Number(raw.monthly_rate ?? raw.monthlyRate ?? 2.5),
  contractMonths: Number(raw.contract_months ?? raw.contractMonths ?? 12),
  autoRenew: Boolean(raw.auto_renew ?? raw.autoRenew ?? true),
  withdrawalNoticeMonths: Number(raw.withdrawal_notice_months ?? raw.withdrawalNoticeMonths ?? 3),
  termsAccepted: Boolean(raw.terms_accepted ?? raw.termsAccepted ?? false),
  termsAcceptedAt: raw.terms_accepted_at ?? raw.termsAcceptedAt ?? '',
  signatureUrl: raw.signature_url ?? raw.signatureUrl ?? '',
  status: (raw.status ?? 'PENDING') as InvestorStatus,
  bankName: raw.bank_name ?? raw.bankName ?? '-',
  pixKey: raw.pix_key ?? raw.pixKey ?? '-',
  pixKeyType: raw.pix_key_type ?? raw.pixKeyType ?? '-',
  accountHolderName: raw.account_holder_name ?? raw.accountHolderName ?? '-',
  idCardUrl: raw.id_card_url ?? raw.idCardUrl ?? '',
  idCardBackUrl: raw.id_card_back_url ?? raw.idCardBackUrl ?? '',
  proofOfAddressUrl: raw.proof_of_address_url ?? raw.proofOfAddressUrl ?? '',
  selfieUrl: raw.selfie_url ?? raw.selfieUrl ?? '',
  createdAt: raw.created_at ?? raw.createdAt ?? new Date().toISOString(),
  approvedAt: raw.approved_at ?? raw.approvedAt ?? '',
  updatedAt: raw.updated_at ?? raw.updatedAt ?? '',
  adminNotes: raw.admin_notes ?? raw.adminNotes ?? '',
});

export const Investors: React.FC = () => {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState<InvestorRow[]>([]);
  const [selected, setSelected] = useState<InvestorRow | null>(null);
  const [filterText, setFilterText] = useState('');
  const [filterStatus, setFilterStatus] = useState<InvestorStatus | 'ALL'>('ALL');
  const [filterTier, setFilterTier] = useState<'ALL' | 'STANDARD' | 'PREMIUM'>('ALL');
  const [filterPayout, setFilterPayout] = useState<'ALL' | 'MONTHLY' | 'ANNUAL'>('ALL');
  const [sortBy, setSortBy] = useState<'NEWEST' | 'OLDEST' | 'AMOUNT_DESC' | 'AMOUNT_ASC'>('NEWEST');
  const [nextStatus, setNextStatus] = useState<InvestorStatus>('PENDING');
  const [notes, setNotes] = useState('');

  const loadData = async () => {
    setLoading(true);
    const data = await apiService.getInvestorRequests();
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

  const statusTotals = useMemo(() => {
    return items.reduce(
      (acc, item) => {
        acc[item.status] += 1;
        return acc;
      },
      { PENDING: 0, APPROVED: 0, ACTIVE: 0, COMPLETED: 0, REJECTED: 0, CANCELLED: 0 } as Record<InvestorStatus, number>,
    );
  }, [items]);

  const metrics = useMemo(() => {
    const totalVolume = items.reduce((sum, item) => sum + item.investmentAmount, 0);
    const approvedVolume = items
      .filter((item) => item.status === 'APPROVED' || item.status === 'ACTIVE' || item.status === 'COMPLETED')
      .reduce((sum, item) => sum + item.investmentAmount, 0);

    return {
      totalVolume,
      approvedVolume,
      conversionRate: items.length ? ((statusTotals.APPROVED + statusTotals.ACTIVE + statusTotals.COMPLETED) / items.length) * 100 : 0,
    };
  }, [items, statusTotals]);

  const filtered = useMemo(() => {
    const q = filterText.trim().toLowerCase();
    const list = items.filter((item) => {
      const byStatus = filterStatus === 'ALL' || item.status === filterStatus;
      const byTier = filterTier === 'ALL' || item.investmentTier === filterTier;
      const byPayout = filterPayout === 'ALL' || item.payoutMode === filterPayout;
      const byText = !q
        || item.fullName.toLowerCase().includes(q)
        || item.cpfCnpj.toLowerCase().includes(q)
        || item.email.toLowerCase().includes(q)
        || item.phone.toLowerCase().includes(q);
      return byStatus && byTier && byPayout && byText;
    });

    list.sort((a, b) => {
      if (sortBy === 'NEWEST') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (sortBy === 'OLDEST') return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      if (sortBy === 'AMOUNT_DESC') return b.investmentAmount - a.investmentAmount;
      return a.investmentAmount - b.investmentAmount;
    });

    return list;
  }, [items, filterStatus, filterText, filterTier, filterPayout, sortBy]);

  const updateStatus = async () => {
    if (!selected) return;
    setSaving(true);
    const ok = await apiService.updateInvestorStatus(selected.id, nextStatus, notes);
    setSaving(false);

    if (!ok) {
      addToast('Não foi possível atualizar o status do investidor.', 'error');
      return;
    }

    addToast('Status do investidor atualizado com sucesso.', 'success');
    setSelected(null);
    await loadData();
  };

  const selectedWhatsApp = selected ? digitsOnly(selected.phone) : "";

  return (
    <div className="p-4 md:p-8 bg-black min-h-screen text-white">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-cyan-400">Solicitações de Investidores</h1>
          <p className="text-zinc-400 text-sm mt-1">Página administrativa completa para análise, aprovação e acompanhamento do pipeline de captação.</p>
        </div>
        <Button variant="secondary" onClick={loadData} className="w-full md:w-auto">Atualizar Lista</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
          <p className="text-zinc-400 text-xs">Total de solicitações</p>
          <p className="text-2xl font-bold mt-1">{items.length}</p>
          <p className="text-xs text-zinc-500 mt-1">{statusTotals.PENDING} pendentes para análise</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
          <p className="text-zinc-400 text-xs">Volume captado (pipeline)</p>
          <p className="text-2xl font-bold text-[#D4AF37] mt-1">{formatCurrency(metrics.totalVolume)}</p>
          <p className="text-xs text-zinc-500 mt-1">Inclui todas as fases</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
          <p className="text-zinc-400 text-xs">Volume aprovado</p>
          <p className="text-2xl font-bold text-cyan-300 mt-1">{formatCurrency(metrics.approvedVolume)}</p>
          <p className="text-xs text-zinc-500 mt-1">Aprovado + Ativo + Concluído</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
          <p className="text-zinc-400 text-xs">Taxa de conversão</p>
          <p className="text-2xl font-bold text-green-300 mt-1">{metrics.conversionRate.toFixed(1)}%</p>
          <p className="text-xs text-zinc-500 mt-1">Rejeitados: {statusTotals.REJECTED}</p>
        </div>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
          <div className="relative md:col-span-2">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder="Buscar por nome, CPF/CNPJ, telefone ou e-mail"
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
          <select
            value={filterTier}
            onChange={(e) => setFilterTier(e.target.value as 'ALL' | 'STANDARD' | 'PREMIUM')}
            className="bg-black border border-zinc-700 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-cyan-500"
          >
            <option value="ALL">Todas as faixas</option>
            <option value="STANDARD">STANDARD</option>
            <option value="PREMIUM">PREMIUM</option>
          </select>
          <select
            value={filterPayout}
            onChange={(e) => setFilterPayout(e.target.value as 'ALL' | 'MONTHLY' | 'ANNUAL')}
            className="bg-black border border-zinc-700 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-cyan-500"
          >
            <option value="ALL">Todos os modelos</option>
            <option value="MONTHLY">Rendimento mensal</option>
            <option value="ANNUAL">Acumulado anual</option>
          </select>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'NEWEST' | 'OLDEST' | 'AMOUNT_DESC' | 'AMOUNT_ASC')}
            className="bg-black border border-zinc-700 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-cyan-500"
          >
            <option value="NEWEST">Mais recentes</option>
            <option value="OLDEST">Mais antigas</option>
            <option value="AMOUNT_DESC">Maior valor</option>
            <option value="AMOUNT_ASC">Menor valor</option>
          </select>
          <div className="text-xs text-zinc-400 flex items-center justify-end gap-2">
            <TrendingUp size={14} />
            {filtered.length} resultado(s) filtrado(s)
          </div>
        </div>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1200px]">
            <thead className="bg-zinc-950 text-zinc-400 text-sm">
              <tr>
                <th className="p-4 text-left">Investidor</th>
                <th className="p-4 text-left">Contato</th>
                <th className="p-4 text-left">Plano</th>
                <th className="p-4 text-left">Status</th>
                <th className="p-4 text-left">Cadastro</th>
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
                  <td className="p-6 text-zinc-400" colSpan={6}>Nenhuma solicitação encontrada com os filtros atuais.</td>
                </tr>
              ) : (
                filtered.map((item) => (
                  <tr key={item.id} className="border-t border-zinc-800 hover:bg-zinc-800/20">
                    <td className="p-4">
                      <div className="font-semibold">{item.fullName}</div>
                      <div className="text-xs text-zinc-400">{item.cpfCnpj}</div>
                      <div className="text-xs text-zinc-500">ID: {item.id.slice(0, 8)}...</div>
                    </td>
                    <td className="p-4">
                      <div className="text-sm">{item.email}</div>
                      <div className="text-xs text-zinc-400">{item.phone}</div>
                    </td>
                    <td className="p-4">
                      <div className="font-bold text-[#D4AF37]">{formatCurrency(item.investmentAmount)}</div>
                      <div className="text-xs text-zinc-400">Faixa: {item.investmentTier}</div>
                      <div className="text-xs text-cyan-300">{item.payoutMode === 'MONTHLY' ? 'Mensal' : 'Anual'} - {item.monthlyRate}% a.m.</div>
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded-md border text-xs font-bold ${statusStyles[item.status]}`}>
                        {statusLabel[item.status]}
                      </span>
                      <div className="text-xs text-zinc-500 mt-1">Atualizado: {formatDate(item.updatedAt)}</div>
                    </td>
                    <td className="p-4 text-sm text-zinc-300">{formatDate(item.createdAt)}</td>
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
          <div className="w-full max-w-5xl bg-zinc-950 border border-zinc-800 rounded-2xl p-5 max-h-[90vh] overflow-auto">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
              <div>
                <h2 className="text-xl font-bold text-cyan-400">Gestão de Investidor</h2>
                <p className="text-xs text-zinc-500">Protocolo: {selected.id}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-1 rounded-md border text-xs font-bold ${statusStyles[selected.status]}`}>
                  {statusLabel[selected.status]}
                </span>
                <button onClick={() => setSelected(null)} className="text-zinc-400 hover:text-white">Fechar</button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5 text-sm">
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
                <p className="text-zinc-400 text-xs mb-1">Dados pessoais</p>
                <p className="font-semibold text-base">{selected.fullName}</p>
                <p className="text-zinc-400">Nascimento: {formatDate(selected.birthDate)}</p>
              </div>
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
                <p className="text-zinc-400 text-xs mb-1">Contato</p>
                <p className="text-zinc-200 flex items-center gap-2"><Mail size={14} /> {selected.email}</p>
                <p className="text-zinc-200 flex items-center gap-2 mt-1"><Phone size={14} /> {selected.phone}</p>
                <p className="text-zinc-400 text-xs mt-2">
                  Melhor horário: {
                    selected.preferredContactTime === 'manha' ? 'Manhã (08h - 12h)' :
                    selected.preferredContactTime === 'tarde' ? 'Tarde (12h - 18h)' :
                    selected.preferredContactTime === 'noite' ? 'Noite (18h - 22h)' :
                    selected.preferredContactTime === 'qualquer' ? 'Qualquer horário' :
                    'Não informado'
                  }
                </p>
                <div className="mt-3 flex gap-2">
                  <a href={selectedWhatsApp ? `https://wa.me/55${selectedWhatsApp}` : '#'} target="_blank" rel="noreferrer" className={`text-xs px-2 py-1 rounded border ${selectedWhatsApp ? 'border-green-500/50 text-green-300 hover:bg-green-900/20' : 'border-zinc-700 text-zinc-500 pointer-events-none'}`}>
                    WhatsApp
                  </a>
                  <a href={selected.email && selected.email !== '-' ? `mailto:${selected.email}` : '#'} className={`text-xs px-2 py-1 rounded border ${selected.email && selected.email !== '-' ? 'border-cyan-500/50 text-cyan-300 hover:bg-cyan-900/20' : 'border-zinc-700 text-zinc-500 pointer-events-none'}`}>
                    Email
                  </a>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5 text-sm">
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
                <p className="text-zinc-400 text-xs mb-1">Dados do investimento</p>
                <p className="font-bold text-[#D4AF37]">{formatCurrency(selected.investmentAmount)}</p>
                <p className="text-zinc-400">Faixa: {selected.investmentTier}</p>
                <p className="text-zinc-400">Remuneração: {selected.monthlyRate}% ao mês</p>
                <p className="text-zinc-400">Modalidade: {selected.payoutMode === 'MONTHLY' ? 'Mensal' : 'Anual acumulado'}</p>
              </div>
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
                <p className="text-zinc-400 text-xs mb-1">Dados bancários</p>
                <p className="text-zinc-200">Banco: {selected.bankName}</p>
                <p className="text-zinc-400">Chave PIX: {selected.pixKey}</p>
                <p className="text-zinc-400">Tipo da chave: {selected.pixKeyType}</p>
                <p className="text-zinc-400">Titular: {selected.accountHolderName}</p>
              </div>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 mb-5 text-sm">
              <p className="text-zinc-400 text-xs mb-2">Documentação enviada</p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {[
                  { label: 'Documento frente', url: selected.idCardUrl },
                  { label: 'Documento verso', url: selected.idCardBackUrl },
                  { label: 'Comprovante de endereço', url: selected.proofOfAddressUrl },
                  { label: 'Selfie', url: selected.selfieUrl },
                  { label: 'Assinatura', url: selected.signatureUrl },
                ].map((doc) => {
                  const href = normalizeUrl(doc.url);
                  return (
                    <a key={doc.label} href={href || '#'} target="_blank" rel="noreferrer" className={`border rounded-lg p-2 flex items-center justify-between gap-2 ${href ? 'border-cyan-500/40 text-cyan-300 hover:bg-cyan-900/10' : 'border-zinc-700 text-zinc-500 pointer-events-none'}`}>
                      <span className="text-xs">{doc.label}</span>
                      <ExternalLink size={12} />
                    </a>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4 text-sm">
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
                <p className="text-zinc-400 text-xs mb-1">Condições e aceite</p>
                <p className="text-zinc-300">Prazo: {selected.contractMonths} meses</p>
                <p className="text-zinc-300">Renovação automática: {selected.autoRenew ? 'Sim' : 'Não'}</p>
                <p className="text-zinc-300">Aviso para retirada: {selected.withdrawalNoticeMonths} meses</p>
                <p className="text-zinc-300">Aceite legal: {selected.termsAccepted ? 'Confirmado' : 'Não confirmado'}</p>
              </div>
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
                <p className="text-zinc-400 text-xs mb-1">Linha do tempo</p>
                <p className="text-zinc-300">Cadastro: {formatDateTime(selected.createdAt)}</p>
                <p className="text-zinc-300">Aprovado em: {formatDateTime(selected.approvedAt)}</p>
                <p className="text-zinc-300">Última atualização: {formatDateTime(selected.updatedAt)}</p>
                <p className="text-zinc-300">Aceite dos termos: {formatDateTime(selected.termsAcceptedAt)}</p>
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
                  <option value="PENDING">Pendente</option>
                  <option value="APPROVED">Aprovado</option>
                  <option value="ACTIVE">Ativo</option>
                  <option value="COMPLETED">Concluído</option>
                  <option value="REJECTED">Rejeitado</option>
                  <option value="CANCELLED">Cancelado</option>
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
                placeholder="Ex: aprovado mediante validação final de contrato e KYC"
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
