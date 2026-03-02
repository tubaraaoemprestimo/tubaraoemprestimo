// 🎮 Finance Hub - Pagamentos, Comprovantes e Gamificação Unificados
import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
    DollarSign, Check, X, Upload, Calendar, Search, Eye, Trash2,
    CheckCircle2, Clock, AlertTriangle, Plus, Receipt, Image, FileText,
    Trophy, Star, Flame, Target, TrendingUp, Award, Zap, Crown,
    RefreshCw, Gift, Medal, Sparkles, ArrowUpRight, ArrowDownRight, Calculator
} from 'lucide-react';
import { Button } from '../../components/Button';
import { api } from '../../services/apiClient';
import { apiService } from '../../services/apiService';
import { paymentService, LoanPayment } from '../../services/paymentService';
import { loanSettingsService } from '../../services/loanSettingsService';
import { LoanRequest, PaymentReceipt } from '../../types';
import { useToast } from '../../components/Toast';
import { autoNotificationService } from '../../services/autoNotificationService';

type TabType = 'overview' | 'payments' | 'receipts' | 'ranking';

interface ClientRanking {
    id: string;
    name: string;
    score: number;
    paymentsOnTime: number;
    totalPayments: number;
    streak: number;
    level: number;
    badges: string[];
}

export const FinanceHub: React.FC = () => {
    const { addToast } = useToast();
    const [searchParams] = useSearchParams();
    const [activeTab, setActiveTab] = useState<TabType>('overview');
    const [loading, setLoading] = useState(true);

    // Dados
    const [payments, setPayments] = useState<LoanPayment[]>([]);
    const [receipts, setReceipts] = useState<PaymentReceipt[]>([]);
    const [requests, setRequests] = useState<LoanRequest[]>([]);
    const [rankings, setRankings] = useState<ClientRanking[]>([]);

    // Filtros
    const [paymentFilter, setPaymentFilter] = useState<'all' | 'pending' | 'confirmed'>('all');
    const [receiptFilter, setReceiptFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('PENDING');
    const [searchTerm, setSearchTerm] = useState('');

    // Modal novo pagamento
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [selectedRequestId, setSelectedRequestId] = useState('');
    const [paymentType, setPaymentType] = useState<'JUROS' | 'PARCELA' | 'TOTAL' | 'MULTA'>('JUROS');
    const [amount, setAmount] = useState('');
    const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
    const [referenceMonth, setReferenceMonth] = useState('');
    const [notes, setNotes] = useState('');
    const [proofFile, setProofFile] = useState<File | null>(null);
    const [saving, setSaving] = useState(false);

    // Modal comprovante
    const [selectedReceipt, setSelectedReceipt] = useState<PaymentReceipt | null>(null);
    const [rejectionReason, setRejectionReason] = useState('');
    const [processing, setProcessing] = useState<string | null>(null);

    // Read tab from URL on mount and when URL changes
    useEffect(() => {
        const tabParam = searchParams.get('tab');
        if (tabParam === 'overview' || tabParam === 'payments' || tabParam === 'receipts' || tabParam === 'ranking') {
            setActiveTab(tabParam);
        }
    }, [searchParams]);

    useEffect(() => {
        loadAllData();
    }, []);

    const loadAllData = async () => {
        setLoading(true);
        try {
            const [paymentsData, requestsData] = await Promise.all([
                paymentService.getAllPayments(),
                apiService.getRequests()
            ]);
            setPayments(paymentsData);
            setRequests(requestsData);

            // Carregar comprovantes via API
            const { data: receiptsData } = await api.get('/finance/receipts');

            if (receiptsData) {
                setReceipts((receiptsData as any[]).map((r: any) => ({
                    id: r.id,
                    installmentId: r.installment_id || r.installmentId || '',
                    loanId: r.loan_id || r.loanId || '',
                    customerId: r.customer_id || r.customerId || '',
                    customerName: r.customer_name || r.customerName || '',
                    amount: r.amount,
                    receiptUrl: r.receipt_url || r.receiptUrl || '',
                    receiptType: r.receipt_type || r.receiptType || '',
                    status: r.status,
                    submittedAt: r.submitted_at || r.submittedAt || '',
                    reviewedAt: r.reviewed_at || r.reviewedAt || null,
                    reviewedBy: r.reviewed_by || r.reviewedBy || null,
                    rejectionReason: r.rejection_reason || r.rejectionReason || null
                })));
            }

            // Gerar rankings (mock por enquanto - pode integrar com tabela real)
            generateRankings(paymentsData, requestsData);
        } catch (err) {
            console.error('Error loading data:', err);
        }
        setLoading(false);
    };

    const generateRankings = (paymentsData: LoanPayment[], requestsData: LoanRequest[]) => {
        const clientPayments: { [key: string]: { name: string; count: number; onTime: number } } = {};

        paymentsData.filter(p => p.confirmed).forEach(p => {
            const request = requestsData.find(r => r.id === p.request_id);
            if (request?.clientName) {
                if (!clientPayments[request.clientName]) {
                    clientPayments[request.clientName] = { name: request.clientName, count: 0, onTime: 0 };
                }
                clientPayments[request.clientName].count++;
                clientPayments[request.clientName].onTime++;
            }
        });

        const rankingList: ClientRanking[] = Object.entries(clientPayments)
            .map(([name, data], index) => ({
                id: `client-${index}`,
                name: data.name,
                score: data.count * 100 + data.onTime * 50,
                paymentsOnTime: data.onTime,
                totalPayments: data.count,
                streak: Math.floor(Math.random() * 5) + 1,
                level: Math.min(10, Math.floor(data.count / 2) + 1),
                badges: getBadges(data.count, data.onTime)
            }))
            .sort((a, b) => b.score - a.score)
            .slice(0, 10);

        setRankings(rankingList);
    };

    const getBadges = (count: number, onTime: number): string[] => {
        const badges: string[] = [];
        if (count >= 1) badges.push('🌟 Primeiro Pagamento');
        if (count >= 5) badges.push('💎 Cliente Fiel');
        if (count >= 10) badges.push('👑 Cliente VIP');
        if (onTime >= 3) badges.push('⚡ Pagador Pontual');
        if (onTime >= 6) badges.push('🔥 Sequência de Fogo');
        return badges;
    };

    // KPIs
    const stats = useMemo(() => {
        const confirmedPayments = payments.filter(p => p.confirmed);
        const pendingPayments = payments.filter(p => !p.confirmed);
        const pendingReceipts = receipts.filter(r => r.status === 'PENDING');

        return {
            totalReceived: confirmedPayments.reduce((sum, p) => sum + p.amount, 0),
            pendingConfirmation: pendingPayments.reduce((sum, p) => sum + p.amount, 0),
            pendingReceipts: pendingReceipts.length,
            totalPayments: payments.length,
            approvedReceipts: receipts.filter(r => r.status === 'APPROVED').length,
            bestClient: rankings[0]?.name || '-',
            avgPaymentsPerClient: rankings.length > 0
                ? (rankings.reduce((sum, r) => sum + r.totalPayments, 0) / rankings.length).toFixed(1)
                : '0'
        };
    }, [payments, receipts, rankings]);

    // Handlers de pagamento
    const handleCreatePayment = async () => {
        if (!selectedRequestId || !amount) {
            addToast('Preencha todos os campos obrigatórios', 'warning');
            return;
        }

        setSaving(true);
        try {
            let proofUrl = '';
            if (proofFile) {
                proofUrl = await paymentService.uploadProof(proofFile, selectedRequestId) || '';
            }

            const payment = await paymentService.createPayment({
                request_id: selectedRequestId,
                payment_type: paymentType,
                amount: parseFloat(amount.replace(',', '.')),
                payment_date: paymentDate,
                reference_month: referenceMonth,
                proof_url: proofUrl,
                confirmed: false,
                notes
            });

            if (payment) {
                addToast('Pagamento registrado! Aguardando confirmação.', 'success');
                setIsPaymentModalOpen(false);
                resetPaymentForm();
                loadAllData();
            }
        } catch (error) {
            addToast('Erro ao registrar pagamento', 'error');
        }
        setSaving(false);
    };

    const handleConfirmPayment = async (paymentId: string) => {
        const confirmed = await paymentService.confirmPayment(paymentId, 'Admin');
        if (confirmed) {
            addToast('✅ Pagamento confirmado! Cliente ganhou pontos!', 'success');
            loadAllData();
        } else {
            addToast('Erro ao confirmar', 'error');
        }
    };

    const handleDeletePayment = async (paymentId: string) => {
        if (!confirm('Excluir este pagamento?')) return;
        const deleted = await paymentService.deletePayment(paymentId);
        if (deleted) {
            addToast('Pagamento excluído', 'success');
            loadAllData();
        }
    };

    // Handlers de comprovante
    const handleApproveReceipt = async (receipt: PaymentReceipt) => {
        setProcessing(receipt.id);
        try {
            await api.put(`/finance/receipts/${receipt.id}/approve`, {});

            // Criar pagamento automaticamente
            await paymentService.createPayment({
                request_id: receipt.loanId || '',
                payment_type: 'PARCELA',
                amount: receipt.amount,
                payment_date: new Date().toISOString().split('T')[0],
                proof_url: receipt.receiptUrl,
                confirmed: true,
                notes: `Aprovado via comprovante #${receipt.id}`
            });

            addToast('🎉 Comprovante aprovado! Pagamento registrado e cliente ganhou pontos!', 'success');
            setSelectedReceipt(null);
            loadAllData();
        } catch (err) {
            addToast('Erro ao aprovar', 'error');
        }
        setProcessing(null);
    };

    const handleRejectReceipt = async (receipt: PaymentReceipt) => {
        if (!rejectionReason.trim()) {
            addToast('Informe o motivo da rejeição', 'warning');
            return;
        }

        setProcessing(receipt.id);
        try {
            await api.put(`/finance/receipts/${receipt.id}/reject`, {
                rejectionReason
            });

            addToast('Comprovante rejeitado', 'info');
            setSelectedReceipt(null);
            setRejectionReason('');
            loadAllData();
        } catch (err) {
            addToast('Erro ao rejeitar', 'error');
        }
        setProcessing(null);
    };

    const resetPaymentForm = () => {
        setSelectedRequestId('');
        setPaymentType('JUROS');
        setAmount('');
        setPaymentDate(new Date().toISOString().split('T')[0]);
        setReferenceMonth('');
        setNotes('');
        setProofFile(null);
    };

    const getRequestName = (requestId: string) => {
        const request = requests.find(r => r.id === requestId);
        return request?.clientName || 'N/A';
    };

    const filteredPayments = payments.filter(p => {
        if (paymentFilter === 'pending' && p.confirmed) return false;
        if (paymentFilter === 'confirmed' && !p.confirmed) return false;
        if (searchTerm) {
            const request = requests.find(r => r.id === p.request_id);
            if (!request?.clientName?.toLowerCase().includes(searchTerm.toLowerCase())) {
                return false;
            }
        }
        return true;
    });

    const filteredReceipts = receipts.filter(r => {
        if (receiptFilter !== 'ALL' && r.status !== receiptFilter) return false;
        if (searchTerm && !r.customerName.toLowerCase().includes(searchTerm.toLowerCase())) return false;
        return true;
    });

    const getLevelIcon = (level: number) => {
        if (level >= 8) return <Crown className="text-yellow-400" size={20} />;
        if (level >= 5) return <Trophy className="text-yellow-500" size={20} />;
        if (level >= 3) return <Medal className="text-orange-400" size={20} />;
        return <Star className="text-zinc-400" size={20} />;
    };

    const tabs = [
        { id: 'overview', label: 'Visão Geral', icon: <TrendingUp size={18} /> },
        { id: 'payments', label: 'Pagamentos', icon: <DollarSign size={18} />, badge: payments.filter(p => !p.confirmed).length },
        { id: 'receipts', label: 'Comprovantes', icon: <Receipt size={18} />, badge: receipts.filter(r => r.status === 'PENDING').length },
        { id: 'ranking', label: 'Ranking', icon: <Trophy size={18} /> },
    ] as const;

    return (
        <div className="p-4 md:p-8 bg-black min-h-screen text-white pb-32">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-[#D4AF37] flex items-center gap-2">
                        <Sparkles size={32} /> Central Financeira
                    </h1>
                    <p className="text-zinc-500 mt-1">Pagamentos, Comprovantes e Gamificação</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="secondary" onClick={loadAllData}>
                        <RefreshCw size={18} className={loading ? 'animate-spin' : ''} /> Atualizar
                    </Button>
                    <Button onClick={() => setIsPaymentModalOpen(true)} className="bg-[#D4AF37] text-black">
                        <Plus size={18} /> Registrar Pagamento
                    </Button>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as TabType)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${activeTab === tab.id
                            ? 'bg-[#D4AF37] text-black'
                            : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800'
                            }`}
                    >
                        {tab.icon}
                        {tab.label}
                        {tab.badge !== undefined && tab.badge > 0 && (
                            <span className="ml-1 px-2 py-0.5 text-xs rounded-full bg-red-500 text-white">
                                {tab.badge}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* Overview Tab */}
            {activeTab === 'overview' && (
                <div className="space-y-6">
                    {/* KPIs Principais */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-gradient-to-br from-green-500/20 to-green-900/10 border border-green-500/30 rounded-2xl p-6">
                            <div className="flex items-center gap-2 mb-2">
                                <CheckCircle2 className="text-green-400" size={20} />
                                <span className="text-zinc-400 text-sm">Recebido</span>
                            </div>
                            <p className="text-2xl font-bold text-white">
                                R$ {stats.totalReceived.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </p>
                        </div>

                        <div className="bg-gradient-to-br from-yellow-500/20 to-yellow-900/10 border border-yellow-500/30 rounded-2xl p-6">
                            <div className="flex items-center gap-2 mb-2">
                                <Clock className="text-yellow-400" size={20} />
                                <span className="text-zinc-400 text-sm">Pendente</span>
                            </div>
                            <p className="text-2xl font-bold text-white">
                                R$ {stats.pendingConfirmation.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </p>
                        </div>

                        <div className="bg-gradient-to-br from-blue-500/20 to-blue-900/10 border border-blue-500/30 rounded-2xl p-6">
                            <div className="flex items-center gap-2 mb-2">
                                <Receipt className="text-blue-400" size={20} />
                                <span className="text-zinc-400 text-sm">Comprovantes</span>
                            </div>
                            <p className="text-2xl font-bold text-white">{stats.pendingReceipts}</p>
                            <p className="text-xs text-zinc-500">aguardando análise</p>
                        </div>

                        <div className="bg-gradient-to-br from-purple-500/20 to-purple-900/10 border border-purple-500/30 rounded-2xl p-6">
                            <div className="flex items-center gap-2 mb-2">
                                <Trophy className="text-purple-400" size={20} />
                                <span className="text-zinc-400 text-sm">Top Cliente</span>
                            </div>
                            <p className="text-lg font-bold text-white truncate">{stats.bestClient}</p>
                        </div>
                    </div>

                    {/* Gamification Banner */}
                    <div className="bg-gradient-to-r from-[#D4AF37]/20 via-purple-500/20 to-blue-500/20 border border-[#D4AF37]/30 rounded-2xl p-6">
                        <div className="flex items-center gap-4">
                            <div className="p-4 bg-[#D4AF37]/20 rounded-2xl">
                                <Flame className="text-[#D4AF37]" size={40} />
                            </div>
                            <div className="flex-1">
                                <h3 className="text-xl font-bold text-white mb-1">🎮 Sistema de Gamificação Ativo!</h3>
                                <p className="text-zinc-400">
                                    Clientes ganham pontos e sobem de nível a cada pagamento em dia.
                                    Veja o ranking e premie os melhores!
                                </p>
                            </div>
                            <Button onClick={() => setActiveTab('ranking')} className="bg-[#D4AF37] text-black">
                                <Trophy size={18} /> Ver Ranking
                            </Button>
                        </div>
                    </div>

                    {/* Últimas Atividades */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Últimos Pagamentos */}
                        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                <DollarSign className="text-green-400" size={20} /> Últimos Pagamentos
                            </h3>
                            <div className="space-y-3">
                                {payments.slice(0, 5).map(p => (
                                    <div key={p.id} className="flex items-center justify-between p-3 bg-black rounded-xl border border-zinc-800">
                                        <div>
                                            <p className="font-bold text-white">{getRequestName(p.request_id)}</p>
                                            <p className="text-xs text-zinc-500">{p.payment_type}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-bold text-green-400">
                                                R$ {p.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                            </p>
                                            {p.confirmed ? (
                                                <span className="text-xs text-green-400 flex items-center gap-1 justify-end">
                                                    <CheckCircle2 size={12} /> Confirmado
                                                </span>
                                            ) : (
                                                <span className="text-xs text-yellow-400 flex items-center gap-1 justify-end">
                                                    <Clock size={12} /> Pendente
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                                {payments.length === 0 && (
                                    <p className="text-center text-zinc-500 py-4">Nenhum pagamento registrado</p>
                                )}
                            </div>
                        </div>

                        {/* Últimos Comprovantes */}
                        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                <Receipt className="text-blue-400" size={20} /> Últimos Comprovantes
                            </h3>
                            <div className="space-y-3">
                                {receipts.slice(0, 5).map(r => (
                                    <div
                                        key={r.id}
                                        className="flex items-center justify-between p-3 bg-black rounded-xl border border-zinc-800 cursor-pointer hover:border-[#D4AF37]/50"
                                        onClick={() => setSelectedReceipt(r)}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`p-2 rounded-lg ${r.receiptType === 'IMAGE' ? 'bg-blue-500/20' : 'bg-red-500/20'}`}>
                                                {r.receiptType === 'IMAGE' ? <Image size={16} className="text-blue-400" /> : <FileText size={16} className="text-red-400" />}
                                            </div>
                                            <div>
                                                <p className="font-bold text-white">{r.customerName}</p>
                                                <p className="text-xs text-zinc-500">
                                                    {new Date(r.submittedAt).toLocaleDateString('pt-BR')}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-bold text-[#D4AF37]">
                                                R$ {r.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                            </p>
                                            {r.status === 'PENDING' && <span className="text-xs text-yellow-400">Analisar</span>}
                                            {r.status === 'APPROVED' && <span className="text-xs text-green-400">Aprovado</span>}
                                            {r.status === 'REJECTED' && <span className="text-xs text-red-400">Rejeitado</span>}
                                        </div>
                                    </div>
                                ))}
                                {receipts.length === 0 && (
                                    <p className="text-center text-zinc-500 py-4">Nenhum comprovante enviado</p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Payments Tab */}
            {activeTab === 'payments' && (
                <div className="space-y-6">
                    {/* Filtros */}
                    <div className="flex flex-wrap gap-4">
                        <div className="flex gap-2">
                            {(['all', 'pending', 'confirmed'] as const).map(f => (
                                <button
                                    key={f}
                                    onClick={() => setPaymentFilter(f)}
                                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${paymentFilter === f
                                        ? 'bg-[#D4AF37] text-black'
                                        : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                                        }`}
                                >
                                    {f === 'all' ? 'Todos' : f === 'pending' ? 'Pendentes' : 'Confirmados'}
                                </button>
                            ))}
                        </div>
                        <div className="relative flex-1 max-w-xs">
                            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                            <input
                                type="text"
                                placeholder="Buscar cliente..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white focus:border-[#D4AF37] outline-none"
                            />
                        </div>
                    </div>

                    {/* Lista de Pagamentos */}
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
                        {loading ? (
                            <div className="p-8 text-center text-zinc-500">Carregando...</div>
                        ) : filteredPayments.length === 0 ? (
                            <div className="p-8 text-center text-zinc-500">Nenhum pagamento encontrado</div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-zinc-950">
                                        <tr className="border-b border-zinc-800">
                                            <th className="text-left p-4 text-zinc-400 text-sm">Cliente</th>
                                            <th className="text-left p-4 text-zinc-400 text-sm">Tipo</th>
                                            <th className="text-left p-4 text-zinc-400 text-sm">Valor</th>
                                            <th className="text-left p-4 text-zinc-400 text-sm">Data</th>
                                            <th className="text-left p-4 text-zinc-400 text-sm">Status</th>
                                            <th className="text-right p-4 text-zinc-400 text-sm">Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredPayments.map(payment => (
                                            <tr key={payment.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                                                <td className="p-4">
                                                    <p className="font-bold text-white">{getRequestName(payment.request_id)}</p>
                                                </td>
                                                <td className="p-4">
                                                    <span className={`px-2 py-1 rounded text-xs font-bold ${payment.payment_type === 'JUROS' ? 'bg-yellow-900/30 text-yellow-400' :
                                                        payment.payment_type === 'PARCELA' ? 'bg-blue-900/30 text-blue-400' :
                                                            payment.payment_type === 'TOTAL' ? 'bg-green-900/30 text-green-400' :
                                                                'bg-red-900/30 text-red-400'
                                                        }`}>
                                                        {payment.payment_type}
                                                    </span>
                                                </td>
                                                <td className="p-4 font-bold text-green-400">
                                                    R$ {payment.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                </td>
                                                <td className="p-4 text-zinc-400">
                                                    {new Date(payment.payment_date).toLocaleDateString('pt-BR')}
                                                </td>
                                                <td className="p-4">
                                                    {payment.confirmed ? (
                                                        <span className="flex items-center gap-1 text-green-400 text-sm">
                                                            <CheckCircle2 size={14} /> Confirmado
                                                        </span>
                                                    ) : (
                                                        <span className="flex items-center gap-1 text-yellow-400 text-sm">
                                                            <Clock size={14} /> Pendente
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="p-4 text-right">
                                                    <div className="flex justify-end gap-2">
                                                        {!payment.confirmed && (
                                                            <button
                                                                onClick={() => handleConfirmPayment(payment.id!)}
                                                                className="p-2 bg-green-900/30 text-green-400 rounded-lg hover:bg-green-900/50"
                                                                title="Confirmar"
                                                            >
                                                                <Check size={16} />
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={() => handleDeletePayment(payment.id!)}
                                                            className="p-2 bg-red-900/30 text-red-400 rounded-lg hover:bg-red-900/50"
                                                            title="Excluir"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Receipts Tab */}
            {activeTab === 'receipts' && (
                <div className="space-y-6">
                    {/* Filtros */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {(['ALL', 'PENDING', 'APPROVED', 'REJECTED'] as const).map(f => (
                            <div
                                key={f}
                                onClick={() => setReceiptFilter(f)}
                                className={`bg-zinc-900 border rounded-xl p-4 cursor-pointer transition-all ${receiptFilter === f
                                    ? f === 'PENDING' ? 'border-yellow-500' :
                                        f === 'APPROVED' ? 'border-green-500' :
                                            f === 'REJECTED' ? 'border-red-500' : 'border-[#D4AF37]'
                                    : 'border-zinc-800 hover:border-zinc-600'
                                    }`}
                            >
                                <p className="text-zinc-400 text-sm">
                                    {f === 'ALL' ? 'Todos' : f === 'PENDING' ? 'Pendentes' : f === 'APPROVED' ? 'Aprovados' : 'Rejeitados'}
                                </p>
                                <p className="text-2xl font-bold text-white">
                                    {f === 'ALL' ? receipts.length : receipts.filter(r => r.status === f).length}
                                </p>
                            </div>
                        ))}
                    </div>

                    {/* Lista */}
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                        <div className="relative mb-6">
                            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                            <input
                                type="text"
                                placeholder="Buscar cliente..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 bg-black border border-zinc-700 rounded-lg text-white focus:border-[#D4AF37] outline-none"
                            />
                        </div>

                        <div className="space-y-4">
                            {filteredReceipts.map(receipt => (
                                <div
                                    key={receipt.id}
                                    onClick={() => setSelectedReceipt(receipt)}
                                    className={`bg-black border rounded-xl p-4 cursor-pointer hover:border-[#D4AF37]/50 transition-colors ${receipt.status === 'PENDING' ? 'border-yellow-500/30' : 'border-zinc-800'
                                        }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className={`p-3 rounded-lg ${receipt.receiptType === 'IMAGE' ? 'bg-blue-500/20' : 'bg-red-500/20'}`}>
                                                {receipt.receiptType === 'IMAGE' ? <Image size={24} className="text-blue-400" /> : <FileText size={24} className="text-red-400" />}
                                            </div>
                                            <div>
                                                <p className="font-bold text-white">{receipt.customerName}</p>
                                                <p className="text-[#D4AF37] font-bold">
                                                    R$ {receipt.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                </p>
                                                <p className="text-xs text-zinc-500">
                                                    {new Date(receipt.submittedAt).toLocaleString('pt-BR')}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            {receipt.status === 'PENDING' && (
                                                <span className="flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-yellow-900/30 text-yellow-400">
                                                    <Clock size={12} /> Pendente
                                                </span>
                                            )}
                                            {receipt.status === 'APPROVED' && (
                                                <span className="flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-green-900/30 text-green-400">
                                                    <CheckCircle2 size={12} /> Aprovado
                                                </span>
                                            )}
                                            {receipt.status === 'REJECTED' && (
                                                <span className="flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-red-900/30 text-red-400">
                                                    <X size={12} /> Rejeitado
                                                </span>
                                            )}
                                            <Button size="sm" variant="secondary">
                                                <Eye size={16} /> Analisar
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {filteredReceipts.length === 0 && (
                                <p className="text-center text-zinc-500 py-8">Nenhum comprovante encontrado</p>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Ranking Tab */}
            {activeTab === 'ranking' && (
                <div className="space-y-6">
                    {/* Banner Gamificação */}
                    <div className="bg-gradient-to-r from-yellow-500/20 via-orange-500/20 to-red-500/20 border border-yellow-500/30 rounded-2xl p-8 text-center">
                        <Trophy className="mx-auto text-yellow-400 mb-4" size={48} />
                        <h2 className="text-2xl font-bold text-white mb-2">🏆 Ranking de Clientes</h2>
                        <p className="text-zinc-400">
                            Clientes ganham pontos por pagamentos em dia! Premie os melhores pagadores.
                        </p>
                    </div>

                    {/* Top 3 */}
                    {rankings.length >= 3 && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {rankings.slice(0, 3).map((client, index) => (
                                <div
                                    key={client.id}
                                    className={`relative bg-zinc-900 border rounded-2xl p-6 text-center ${index === 0
                                        ? 'border-yellow-500 bg-gradient-to-b from-yellow-500/10 to-transparent'
                                        : index === 1
                                            ? 'border-zinc-400 bg-gradient-to-b from-zinc-400/10 to-transparent'
                                            : 'border-orange-600 bg-gradient-to-b from-orange-600/10 to-transparent'
                                        }`}
                                >
                                    <div className={`absolute -top-4 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full flex items-center justify-center text-lg font-bold ${index === 0 ? 'bg-yellow-500 text-black' :
                                        index === 1 ? 'bg-zinc-400 text-black' : 'bg-orange-600 text-white'
                                        }`}>
                                        {index + 1}
                                    </div>

                                    <div className="mt-4 mb-4">
                                        {index === 0 && <Crown className="mx-auto text-yellow-400" size={40} />}
                                        {index === 1 && <Trophy className="mx-auto text-zinc-400" size={36} />}
                                        {index === 2 && <Medal className="mx-auto text-orange-500" size={32} />}
                                    </div>

                                    <h3 className="text-lg font-bold text-white mb-1">{client.name}</h3>
                                    <p className="text-2xl font-bold text-[#D4AF37]">{client.score} pts</p>

                                    <div className="mt-4 flex items-center justify-center gap-2 text-sm text-zinc-400">
                                        <Flame className="text-orange-400" size={14} />
                                        <span>{client.streak} pagamentos seguidos</span>
                                    </div>

                                    <div className="mt-2 text-sm text-zinc-500">
                                        Nível {client.level} • {client.totalPayments} pagamentos
                                    </div>

                                    {client.badges.length > 0 && (
                                        <div className="mt-3 flex flex-wrap justify-center gap-1">
                                            {client.badges.slice(0, 2).map((badge, i) => (
                                                <span key={i} className="text-xs px-2 py-1 bg-zinc-800 rounded-full">
                                                    {badge}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Lista Completa */}
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
                        <div className="p-4 border-b border-zinc-800">
                            <h3 className="font-bold text-white">Ranking Completo</h3>
                        </div>
                        <div className="divide-y divide-zinc-800">
                            {rankings.map((client, index) => (
                                <div key={client.id} className="flex items-center gap-4 p-4 hover:bg-zinc-800/30">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${index < 3 ? 'bg-[#D4AF37] text-black' : 'bg-zinc-800 text-zinc-400'
                                        }`}>
                                        {index + 1}
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <p className="font-bold text-white">{client.name}</p>
                                            {getLevelIcon(client.level)}
                                            <span className="text-xs text-zinc-500">Nível {client.level}</span>
                                        </div>
                                        <p className="text-xs text-zinc-500">
                                            {client.totalPayments} pagamentos • {client.paymentsOnTime} em dia
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-bold text-[#D4AF37]">{client.score} pts</p>
                                        <div className="flex items-center gap-1 text-xs text-orange-400">
                                            <Flame size={12} /> {client.streak}x
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {rankings.length === 0 && (
                                <p className="text-center text-zinc-500 py-8">
                                    Nenhum cliente com pagamentos confirmados ainda
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Badges Legend */}
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                        <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                            <Award className="text-[#D4AF37]" size={20} /> Conquistas Disponíveis
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                            <div className="bg-black p-3 rounded-xl border border-zinc-800 text-center">
                                <span className="text-2xl">🌟</span>
                                <p className="text-xs text-white mt-1">Primeiro Pagamento</p>
                            </div>
                            <div className="bg-black p-3 rounded-xl border border-zinc-800 text-center">
                                <span className="text-2xl">💎</span>
                                <p className="text-xs text-white mt-1">Cliente Fiel</p>
                                <p className="text-[10px] text-zinc-500">5+ pagamentos</p>
                            </div>
                            <div className="bg-black p-3 rounded-xl border border-zinc-800 text-center">
                                <span className="text-2xl">👑</span>
                                <p className="text-xs text-white mt-1">Cliente VIP</p>
                                <p className="text-[10px] text-zinc-500">10+ pagamentos</p>
                            </div>
                            <div className="bg-black p-3 rounded-xl border border-zinc-800 text-center">
                                <span className="text-2xl">⚡</span>
                                <p className="text-xs text-white mt-1">Pagador Pontual</p>
                                <p className="text-[10px] text-zinc-500">3+ em dia</p>
                            </div>
                            <div className="bg-black p-3 rounded-xl border border-zinc-800 text-center">
                                <span className="text-2xl">🔥</span>
                                <p className="text-xs text-white mt-1">Sequência de Fogo</p>
                                <p className="text-[10px] text-zinc-500">6+ em dia seguidos</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Novo Pagamento */}
            {isPaymentModalOpen && (
                <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-50 p-4">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
                        <div className="sticky top-0 bg-zinc-900 p-6 pb-4 border-b border-zinc-800 flex justify-between items-center">
                            <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                <DollarSign className="text-[#D4AF37]" /> Registrar Pagamento
                            </h3>
                            <button onClick={() => { setIsPaymentModalOpen(false); resetPaymentForm(); }}>
                                <X className="text-zinc-500 hover:text-white" />
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-zinc-400 mb-1">Cliente / Solicitação *</label>
                                <select
                                    value={selectedRequestId}
                                    onChange={e => setSelectedRequestId(e.target.value)}
                                    className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white focus:border-[#D4AF37] outline-none"
                                >
                                    <option value="">Selecione...</option>
                                    {requests.map(req => (
                                        <option key={req.id} value={req.id}>
                                            {req.clientName} - R$ {req.amount?.toLocaleString() || 0}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-zinc-400 mb-1">Tipo *</label>
                                <div className="grid grid-cols-4 gap-2">
                                    {(['JUROS', 'PARCELA', 'TOTAL', 'MULTA'] as const).map(type => (
                                        <button
                                            key={type}
                                            onClick={() => setPaymentType(type)}
                                            className={`p-2 rounded-lg text-sm font-bold transition-all ${paymentType === type
                                                ? 'bg-[#D4AF37] text-black'
                                                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                                                }`}
                                        >
                                            {type}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Calculador de Juros Automático */}
                            {paymentType === 'JUROS' && selectedRequestId && (() => {
                                const selectedReq = requests.find(r => r.id === selectedRequestId);
                                if (!selectedReq) return null;
                                const isAutonomo = selectedReq.profileType === 'AUTONOMO';
                                const loanAmount = selectedReq.amount || 0;
                                const approvalDate = selectedReq.date ? new Date(selectedReq.date) : new Date();
                                const endDate = paymentDate ? new Date(paymentDate) : new Date();
                                const dailyRate = 1; // 1% ao dia padrão
                                const result = loanSettingsService.calculateDailyInterest(
                                    loanAmount, dailyRate, approvalDate, endDate, selectedReq.profileType
                                );

                                return (
                                    <div className={`p-4 rounded-xl border ${isAutonomo ? 'bg-blue-900/10 border-blue-500/30' : 'bg-zinc-800/50 border-zinc-700'}`}>
                                        <div className="flex items-center gap-2 mb-3">
                                            <Calculator size={16} className={isAutonomo ? 'text-blue-400' : 'text-zinc-400'} />
                                            <span className="text-sm font-bold text-white">Cálculo de Juros</span>
                                            {isAutonomo && (
                                                <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded text-xs font-bold">
                                                    AUTÔNOMO - Sem Domingo
                                                </span>
                                            )}
                                        </div>
                                        <div className="grid grid-cols-2 gap-3 text-sm">
                                            <div>
                                                <p className="text-zinc-500">Valor base</p>
                                                <p className="text-white font-bold">R$ {loanAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                            </div>
                                            <div>
                                                <p className="text-zinc-500">Taxa diária</p>
                                                <p className="text-white font-bold">{dailyRate}% ao dia</p>
                                            </div>
                                            <div>
                                                <p className="text-zinc-500">Dias totais</p>
                                                <p className="text-white font-bold">{result.totalDays} dias</p>
                                            </div>
                                            <div>
                                                <p className="text-zinc-500">Dias cobrados</p>
                                                <p className={`font-bold ${isAutonomo ? 'text-blue-400' : 'text-white'}`}>
                                                    {result.chargedDays} dias
                                                    {isAutonomo && result.skippedSundays > 0 && (
                                                        <span className="text-xs text-zinc-500 ml-1">(-{result.skippedSundays} dom)</span>
                                                    )}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="mt-3 pt-3 border-t border-zinc-700 flex items-center justify-between">
                                            <span className="text-zinc-400">Juros sugerido:</span>
                                            <button
                                                type="button"
                                                onClick={() => setAmount(result.interest.toFixed(2).replace('.', ','))}
                                                className="flex items-center gap-2 px-3 py-1.5 bg-[#D4AF37]/20 text-[#D4AF37] rounded-lg hover:bg-[#D4AF37]/30 font-bold"
                                            >
                                                R$ {result.interest.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} → Usar
                                            </button>
                                        </div>
                                    </div>
                                );
                            })()}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-zinc-400 mb-1">Valor (R$) *</label>
                                    <input
                                        type="text"
                                        value={amount}
                                        onChange={e => setAmount(e.target.value)}
                                        placeholder="0,00"
                                        className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white focus:border-[#D4AF37] outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-zinc-400 mb-1">Data *</label>
                                    <input
                                        type="date"
                                        value={paymentDate}
                                        onChange={e => setPaymentDate(e.target.value)}
                                        className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white focus:border-[#D4AF37] outline-none"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-zinc-400 mb-1">Mês de Referência</label>
                                <input
                                    type="month"
                                    value={referenceMonth}
                                    onChange={e => setReferenceMonth(e.target.value)}
                                    className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white focus:border-[#D4AF37] outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-zinc-400 mb-1">Comprovante</label>
                                <div className="relative">
                                    <input
                                        type="file"
                                        accept="image/*,application/pdf"
                                        onChange={e => setProofFile(e.target.files?.[0] || null)}
                                        className="hidden"
                                        id="proof-upload"
                                    />
                                    <label
                                        htmlFor="proof-upload"
                                        className="flex items-center justify-center gap-2 w-full p-3 border border-dashed border-zinc-700 rounded-lg cursor-pointer hover:border-[#D4AF37]"
                                    >
                                        <Upload size={18} className="text-zinc-500" />
                                        <span className="text-zinc-400">
                                            {proofFile ? proofFile.name : 'Anexar comprovante'}
                                        </span>
                                    </label>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-zinc-400 mb-1">Observações</label>
                                <textarea
                                    value={notes}
                                    onChange={e => setNotes(e.target.value)}
                                    placeholder="Informações adicionais..."
                                    className="w-full h-20 bg-black border border-zinc-700 rounded-lg p-3 text-white focus:border-[#D4AF37] outline-none resize-none"
                                />
                            </div>

                            <Button onClick={handleCreatePayment} isLoading={saving} className="w-full bg-[#D4AF37] text-black">
                                <Check size={18} className="mr-2" /> Registrar Pagamento
                            </Button>
                        </div>
                    </div>
                </div>
            )
            }

            {/* Modal Comprovante */}
            {
                selectedReceipt && (
                    <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-50 p-4">
                        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                            <div className="p-6 border-b border-zinc-800 flex justify-between items-center">
                                <h2 className="text-xl font-bold text-white">Analisar Comprovante</h2>
                                <button onClick={() => setSelectedReceipt(null)} className="text-zinc-500 hover:text-white">
                                    <X size={24} />
                                </button>
                            </div>

                            <div className="p-6 space-y-6">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-black p-4 rounded-xl border border-zinc-800">
                                        <p className="text-xs text-zinc-500 mb-1">Cliente</p>
                                        <p className="text-white font-bold">{selectedReceipt.customerName}</p>
                                    </div>
                                    <div className="bg-black p-4 rounded-xl border border-zinc-800">
                                        <p className="text-xs text-zinc-500 mb-1">Valor</p>
                                        <p className="text-[#D4AF37] font-bold text-lg">
                                            R$ {selectedReceipt.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                        </p>
                                    </div>
                                </div>

                                <div>
                                    <p className="text-sm text-zinc-400 mb-2">Comprovante Enviado</p>
                                    <div className="bg-black border border-zinc-800 rounded-xl p-4">
                                        {selectedReceipt.receiptType === 'IMAGE' ? (
                                            <img
                                                src={selectedReceipt.receiptUrl}
                                                alt="Comprovante"
                                                className="max-w-full max-h-96 mx-auto rounded-lg"
                                            />
                                        ) : (
                                            <div className="text-center py-8">
                                                <FileText size={48} className="mx-auto text-red-400 mb-4" />
                                                <a
                                                    href={selectedReceipt.receiptUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-[#D4AF37] hover:underline"
                                                >
                                                    Visualizar PDF
                                                </a>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {selectedReceipt.status === 'PENDING' && (
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-sm text-zinc-400 mb-2">
                                                Motivo da rejeição (opcional)
                                            </label>
                                            <textarea
                                                value={rejectionReason}
                                                onChange={e => setRejectionReason(e.target.value)}
                                                placeholder="Informe o motivo caso rejeite..."
                                                className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white focus:border-[#D4AF37] outline-none h-20 resize-none"
                                            />
                                        </div>

                                        <div className="flex gap-4">
                                            <Button
                                                variant="danger"
                                                className="flex-1"
                                                onClick={() => handleRejectReceipt(selectedReceipt)}
                                                isLoading={processing === selectedReceipt.id}
                                            >
                                                <X size={18} /> Rejeitar
                                            </Button>
                                            <Button
                                                className="flex-1 bg-green-600 hover:bg-green-700"
                                                onClick={() => handleApproveReceipt(selectedReceipt)}
                                                isLoading={processing === selectedReceipt.id}
                                            >
                                                <Check size={18} /> Aprovar e Registrar Pagamento
                                            </Button>
                                        </div>
                                    </div>
                                )}

                                {selectedReceipt.status !== 'PENDING' && (
                                    <div className={`p-4 rounded-xl ${selectedReceipt.status === 'APPROVED'
                                        ? 'bg-green-900/20 border border-green-700/30'
                                        : 'bg-red-900/20 border border-red-700/30'
                                        }`}>
                                        <p className={`font-bold ${selectedReceipt.status === 'APPROVED' ? 'text-green-400' : 'text-red-400'}`}>
                                            {selectedReceipt.status === 'APPROVED' ? '✅ Pagamento Aprovado' : '❌ Comprovante Rejeitado'}
                                        </p>
                                        {selectedReceipt.reviewedAt && (
                                            <p className="text-xs text-zinc-500 mt-1">
                                                Analisado em {new Date(selectedReceipt.reviewedAt).toLocaleString('pt-BR')}
                                            </p>
                                        )}
                                        {selectedReceipt.rejectionReason && (
                                            <p className="text-sm text-red-300 mt-2">
                                                Motivo: {selectedReceipt.rejectionReason}
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
};

export default FinanceHub;
