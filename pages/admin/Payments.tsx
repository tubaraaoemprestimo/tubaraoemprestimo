// 💰 Página de Controle de Pagamentos
import React, { useState, useEffect } from 'react';
import {
    DollarSign, Check, X, Upload, Calendar, Search, Filter,
    Eye, Trash2, CheckCircle2, Clock, AlertTriangle, Plus, Download
} from 'lucide-react';
import { Button } from '../../components/Button';
import { apiService } from '../../services/apiService';
import { paymentService, LoanPayment } from '../../services/paymentService';
import { LoanRequest } from '../../types';
import { useToast } from '../../components/Toast';

export const PaymentsPage: React.FC = () => {
    const { addToast } = useToast();
    const [payments, setPayments] = useState<LoanPayment[]>([]);
    const [requests, setRequests] = useState<LoanRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'pending' | 'confirmed'>('all');
    const [searchTerm, setSearchTerm] = useState('');

    // Modal de novo pagamento
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedRequestId, setSelectedRequestId] = useState('');
    const [paymentType, setPaymentType] = useState<'JUROS' | 'PARCELA' | 'TOTAL' | 'MULTA'>('JUROS');
    const [amount, setAmount] = useState('');
    const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
    const [referenceMonth, setReferenceMonth] = useState('');
    const [notes, setNotes] = useState('');
    const [proofFile, setProofFile] = useState<File | null>(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        const [paymentsData, requestsData] = await Promise.all([
            paymentService.getAllPayments(),
            apiService.getRequests()
        ]);
        setPayments(paymentsData);
        // Carregar todas as solicitações para o select
        setRequests(requestsData);
        setLoading(false);
    };

    const handleCreatePayment = async () => {
        if (!selectedRequestId || !amount) {
            addToast('Preencha todos os campos obrigatórios', 'warning');
            return;
        }

        setSaving(true);
        try {
            // Upload do comprovante se houver
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
                setIsModalOpen(false);
                resetForm();
                loadData();
            } else {
                throw new Error('Falha ao registrar');
            }
        } catch (error) {
            addToast('Erro ao registrar pagamento', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleConfirmPayment = async (paymentId: string) => {
        const confirmed = await paymentService.confirmPayment(paymentId, 'Admin');
        if (confirmed) {
            addToast('Pagamento confirmado!', 'success');
            loadData();
        } else {
            addToast('Erro ao confirmar pagamento', 'error');
        }
    };

    const handleDeletePayment = async (paymentId: string) => {
        if (!confirm('Excluir este pagamento?')) return;

        const deleted = await paymentService.deletePayment(paymentId);
        if (deleted) {
            addToast('Pagamento excluído', 'success');
            loadData();
        } else {
            addToast('Erro ao excluir', 'error');
        }
    };

    const resetForm = () => {
        setSelectedRequestId('');
        setPaymentType('JUROS');
        setAmount('');
        setPaymentDate(new Date().toISOString().split('T')[0]);
        setReferenceMonth('');
        setNotes('');
        setProofFile(null);
    };

    const filteredPayments = payments.filter(p => {
        if (filter === 'pending' && p.confirmed) return false;
        if (filter === 'confirmed' && !p.confirmed) return false;
        if (searchTerm) {
            const request = requests.find(r => r.id === p.request_id);
            if (!request?.clientName?.toLowerCase().includes(searchTerm.toLowerCase())) {
                return false;
            }
        }
        return true;
    });

    const getRequestName = (requestId: string) => {
        const request = requests.find(r => r.id === requestId);
        return request?.clientName || 'N/A';
    };

    const totalConfirmed = payments.filter(p => p.confirmed).reduce((sum, p) => sum + p.amount, 0);
    const totalPending = payments.filter(p => !p.confirmed).reduce((sum, p) => sum + p.amount, 0);

    return (
        <div className="p-4 md:p-8 bg-black min-h-screen text-white pb-32">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <h1 className="text-3xl font-bold text-[#D4AF37] flex items-center gap-2">
                    <DollarSign size={32} /> Controle de Pagamentos
                </h1>
                <Button onClick={() => setIsModalOpen(true)} className="bg-[#D4AF37] text-black hover:bg-[#B5942F]">
                    <Plus size={18} className="mr-2" /> Registrar Pagamento
                </Button>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <div className="bg-gradient-to-br from-green-500/20 to-green-900/10 border border-green-500/30 rounded-2xl p-6">
                    <div className="flex items-center gap-2 mb-2">
                        <CheckCircle2 className="text-green-400" size={20} />
                        <span className="text-zinc-400 text-sm">Total Confirmado</span>
                    </div>
                    <p className="text-2xl font-bold text-white">R$ {totalConfirmed.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                </div>

                <div className="bg-gradient-to-br from-yellow-500/20 to-yellow-900/10 border border-yellow-500/30 rounded-2xl p-6">
                    <div className="flex items-center gap-2 mb-2">
                        <Clock className="text-yellow-400" size={20} />
                        <span className="text-zinc-400 text-sm">Pendente Confirmação</span>
                    </div>
                    <p className="text-2xl font-bold text-white">R$ {totalPending.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                </div>

                <div className="bg-gradient-to-br from-blue-500/20 to-blue-900/10 border border-blue-500/30 rounded-2xl p-6">
                    <div className="flex items-center gap-2 mb-2">
                        <Calendar className="text-blue-400" size={20} />
                        <span className="text-zinc-400 text-sm">Total Registros</span>
                    </div>
                    <p className="text-2xl font-bold text-white">{payments.length}</p>
                </div>
            </div>

            {/* Filtros */}
            <div className="flex flex-wrap gap-4 mb-6">
                <div className="flex gap-2">
                    {(['all', 'pending', 'confirmed'] as const).map(f => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${filter === f ? 'bg-[#D4AF37] text-black' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
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

            {/* Tabela de Pagamentos */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
                {loading ? (
                    <div className="p-8 text-center text-zinc-500">Carregando...</div>
                ) : filteredPayments.length === 0 ? (
                    <div className="p-8 text-center text-zinc-500">
                        Nenhum pagamento encontrado
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-zinc-950">
                                <tr className="border-b border-zinc-800">
                                    <th className="text-left p-4 text-zinc-400 text-sm font-medium">Cliente</th>
                                    <th className="text-left p-4 text-zinc-400 text-sm font-medium">Tipo</th>
                                    <th className="text-left p-4 text-zinc-400 text-sm font-medium">Valor</th>
                                    <th className="text-left p-4 text-zinc-400 text-sm font-medium">Data</th>
                                    <th className="text-left p-4 text-zinc-400 text-sm font-medium">Referência</th>
                                    <th className="text-left p-4 text-zinc-400 text-sm font-medium">Status</th>
                                    <th className="text-left p-4 text-zinc-400 text-sm font-medium">Comprovante</th>
                                    <th className="text-right p-4 text-zinc-400 text-sm font-medium">Ações</th>
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
                                        <td className="p-4 text-zinc-500 text-sm">
                                            {payment.reference_month || '-'}
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
                                        <td className="p-4">
                                            {payment.proof_url ? (
                                                <a
                                                    href={payment.proof_url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-[#D4AF37] hover:underline text-sm flex items-center gap-1"
                                                >
                                                    <Eye size={14} /> Ver
                                                </a>
                                            ) : (
                                                <span className="text-zinc-600 text-sm">-</span>
                                            )}
                                        </td>
                                        <td className="p-4 text-right">
                                            <div className="flex justify-end gap-2">
                                                {!payment.confirmed && (
                                                    <button
                                                        onClick={() => handleConfirmPayment(payment.id!)}
                                                        className="p-2 bg-green-900/30 text-green-400 rounded-lg hover:bg-green-900/50 transition-colors"
                                                        title="Confirmar"
                                                    >
                                                        <Check size={16} />
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => handleDeletePayment(payment.id!)}
                                                    className="p-2 bg-red-900/30 text-red-400 rounded-lg hover:bg-red-900/50 transition-colors"
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

            {/* Modal de Novo Pagamento */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-50 p-4">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl animate-in zoom-in duration-200">
                        <div className="sticky top-0 bg-zinc-900 p-6 pb-4 border-b border-zinc-800 flex justify-between items-center">
                            <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                <DollarSign className="text-[#D4AF37]" /> Registrar Pagamento
                            </h3>
                            <button onClick={() => { setIsModalOpen(false); resetForm(); }}>
                                <X className="text-zinc-500 hover:text-white" />
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            {/* Cliente */}
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

                            {/* Tipo de Pagamento */}
                            <div>
                                <label className="block text-sm font-bold text-zinc-400 mb-1">Tipo de Pagamento *</label>
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

                            {/* Valor e Data */}
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
                                    <label className="block text-sm font-bold text-zinc-400 mb-1">Data do Pagamento *</label>
                                    <input
                                        type="date"
                                        value={paymentDate}
                                        onChange={e => setPaymentDate(e.target.value)}
                                        className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white focus:border-[#D4AF37] outline-none"
                                    />
                                </div>
                            </div>

                            {/* Mês de Referência */}
                            <div>
                                <label className="block text-sm font-bold text-zinc-400 mb-1">Mês de Referência</label>
                                <input
                                    type="month"
                                    value={referenceMonth}
                                    onChange={e => setReferenceMonth(e.target.value)}
                                    className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white focus:border-[#D4AF37] outline-none"
                                />
                            </div>

                            {/* Comprovante */}
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
                                        className="flex items-center justify-center gap-2 w-full p-3 border border-dashed border-zinc-700 rounded-lg cursor-pointer hover:border-[#D4AF37] transition-colors"
                                    >
                                        <Upload size={18} className="text-zinc-500" />
                                        <span className="text-zinc-400">
                                            {proofFile ? proofFile.name : 'Clique para anexar'}
                                        </span>
                                    </label>
                                </div>
                            </div>

                            {/* Observações */}
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
            )}
        </div>
    );
};
