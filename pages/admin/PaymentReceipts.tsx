// 💳 Payment Receipts Management - Gestão de Comprovantes de Pagamento
// Admin pode aprovar ou rejeitar comprovantes enviados pelos clientes

import React, { useState, useEffect } from 'react';
import { Receipt, Check, X, Eye, Clock, Filter, Download, Search, AlertCircle, CheckCircle, XCircle, Image, FileText, RefreshCw } from 'lucide-react';
import { Button } from '../../components/Button';
import { supabase } from '../../services/supabaseClient';
import { PaymentReceipt } from '../../types';
import { useToast } from '../../components/Toast';
import { autoNotificationService } from '../../services/autoNotificationService';

export const PaymentReceipts: React.FC = () => {
    const { addToast } = useToast();
    const [receipts, setReceipts] = useState<PaymentReceipt[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('PENDING');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedReceipt, setSelectedReceipt] = useState<PaymentReceipt | null>(null);
    const [rejectionReason, setRejectionReason] = useState('');
    const [processing, setProcessing] = useState<string | null>(null);

    useEffect(() => {
        loadReceipts();
    }, [filter]);

    const loadReceipts = async () => {
        setLoading(true);
        try {
            let query = supabase
                .from('payment_receipts')
                .select('*')
                .order('submitted_at', { ascending: false });

            if (filter !== 'ALL') {
                query = query.eq('status', filter);
            }

            const { data, error } = await query;

            if (error) {
                console.warn('Supabase error, trying localStorage:', error);
                // Fallback localStorage
                const localReceipts = JSON.parse(localStorage.getItem('tubarao_payment_receipts') || '[]');
                setReceipts(localReceipts.filter((r: PaymentReceipt) =>
                    filter === 'ALL' || r.status === filter
                ));
            } else {
                setReceipts(data?.map(r => ({
                    id: r.id,
                    installmentId: r.installment_id,
                    loanId: r.loan_id,
                    customerId: r.customer_id,
                    customerName: r.customer_name,
                    amount: r.amount,
                    receiptUrl: r.receipt_url,
                    receiptType: r.receipt_type,
                    status: r.status,
                    submittedAt: r.submitted_at,
                    reviewedAt: r.reviewed_at,
                    reviewedBy: r.reviewed_by,
                    rejectionReason: r.rejection_reason
                })) || []);
            }
        } catch (err) {
            console.error('Error loading receipts:', err);
        }
        setLoading(false);
    };

    const handleApprove = async (receipt: PaymentReceipt) => {
        setProcessing(receipt.id);
        try {
            const user = JSON.parse(localStorage.getItem('tubarao_user') || '{}');

            const { error } = await supabase
                .from('payment_receipts')
                .update({
                    status: 'APPROVED',
                    reviewed_at: new Date().toISOString(),
                    reviewed_by: user.id
                })
                .eq('id', receipt.id);

            if (error) throw error;

            // Marcar parcela como paga
            await supabase
                .from('installments')
                .update({ status: 'PAID', paid_at: new Date().toISOString() })
                .eq('id', receipt.installmentId);

            // Buscar email do cliente para notificação
            const { data: customer } = await supabase
                .from('customers')
                .select('email')
                .eq('id', receipt.customerId)
                .single();

            // Enviar notificação e atualizar score
            if (customer?.email) {
                await autoNotificationService.onPaymentConfirmed(
                    customer.email,
                    receipt.amount,
                    true, // wasOnTime - podemos calcular depois
                    false // wasEarly
                );
            }

            addToast('Pagamento aprovado! Parcela baixada.', 'success');
            setSelectedReceipt(null);
            loadReceipts();
        } catch (err) {
            console.error('Error approving:', err);
            addToast('Erro ao aprovar pagamento', 'error');
        }
        setProcessing(null);
    };

    const handleReject = async (receipt: PaymentReceipt) => {
        if (!rejectionReason.trim()) {
            addToast('Informe o motivo da rejeição', 'warning');
            return;
        }

        setProcessing(receipt.id);
        try {
            const user = JSON.parse(localStorage.getItem('tubarao_user') || '{}');

            const { error } = await supabase
                .from('payment_receipts')
                .update({
                    status: 'REJECTED',
                    reviewed_at: new Date().toISOString(),
                    reviewed_by: user.id,
                    rejection_reason: rejectionReason
                })
                .eq('id', receipt.id);

            if (error) throw error;

            addToast('Comprovante rejeitado', 'info');
            setSelectedReceipt(null);
            setRejectionReason('');
            loadReceipts();
        } catch (err) {
            console.error('Error rejecting:', err);
            addToast('Erro ao rejeitar comprovante', 'error');
        }
        setProcessing(null);
    };

    const filteredReceipts = receipts.filter(r =>
        r.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.installmentId.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'PENDING':
                return <span className="flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-yellow-900/30 text-yellow-400"><Clock size={12} /> Pendente</span>;
            case 'APPROVED':
                return <span className="flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-green-900/30 text-green-400"><CheckCircle size={12} /> Aprovado</span>;
            case 'REJECTED':
                return <span className="flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-red-900/30 text-red-400"><XCircle size={12} /> Rejeitado</span>;
            default:
                return null;
        }
    };

    return (
        <div className="p-4 md:p-8 bg-black min-h-screen text-white pb-32">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-[#D4AF37] flex items-center gap-2">
                        <Receipt size={32} /> Comprovantes de Pagamento
                    </h1>
                    <p className="text-zinc-500 mt-1">Aprove ou rejeite os comprovantes enviados pelos clientes</p>
                </div>
                <Button variant="secondary" onClick={loadReceipts}>
                    <RefreshCw size={18} /> Atualizar
                </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                <div
                    className={`bg-zinc-900 border rounded-xl p-6 cursor-pointer transition-all ${filter === 'ALL' ? 'border-[#D4AF37]' : 'border-zinc-800 hover:border-zinc-600'}`}
                    onClick={() => setFilter('ALL')}
                >
                    <p className="text-zinc-400 text-sm">Total</p>
                    <p className="text-2xl font-bold text-white">{receipts.length}</p>
                </div>
                <div
                    className={`bg-zinc-900 border rounded-xl p-6 cursor-pointer transition-all ${filter === 'PENDING' ? 'border-yellow-500' : 'border-zinc-800 hover:border-zinc-600'}`}
                    onClick={() => setFilter('PENDING')}
                >
                    <p className="text-zinc-400 text-sm flex items-center gap-2"><Clock size={14} className="text-yellow-500" /> Pendentes</p>
                    <p className="text-2xl font-bold text-yellow-400">
                        {receipts.filter(r => r.status === 'PENDING').length}
                    </p>
                </div>
                <div
                    className={`bg-zinc-900 border rounded-xl p-6 cursor-pointer transition-all ${filter === 'APPROVED' ? 'border-green-500' : 'border-zinc-800 hover:border-zinc-600'}`}
                    onClick={() => setFilter('APPROVED')}
                >
                    <p className="text-zinc-400 text-sm flex items-center gap-2"><CheckCircle size={14} className="text-green-500" /> Aprovados</p>
                    <p className="text-2xl font-bold text-green-400">
                        {receipts.filter(r => r.status === 'APPROVED').length}
                    </p>
                </div>
                <div
                    className={`bg-zinc-900 border rounded-xl p-6 cursor-pointer transition-all ${filter === 'REJECTED' ? 'border-red-500' : 'border-zinc-800 hover:border-zinc-600'}`}
                    onClick={() => setFilter('REJECTED')}
                >
                    <p className="text-zinc-400 text-sm flex items-center gap-2"><XCircle size={14} className="text-red-500" /> Rejeitados</p>
                    <p className="text-2xl font-bold text-red-400">
                        {receipts.filter(r => r.status === 'REJECTED').length}
                    </p>
                </div>
            </div>

            {/* Search */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                <div className="flex gap-4 mb-6">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={20} />
                        <input
                            type="text"
                            placeholder="Buscar por cliente..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-black border border-zinc-700 rounded-lg pl-10 pr-4 py-3 text-white focus:border-[#D4AF37] outline-none"
                        />
                    </div>
                </div>

                {/* List */}
                {loading ? (
                    <div className="text-center py-12 text-zinc-500">
                        <RefreshCw size={32} className="mx-auto mb-4 animate-spin" />
                        <p>Carregando comprovantes...</p>
                    </div>
                ) : filteredReceipts.length === 0 ? (
                    <div className="text-center py-12 text-zinc-500">
                        <Receipt size={48} className="mx-auto mb-4 opacity-50" />
                        <p>Nenhum comprovante encontrado</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {filteredReceipts.map(receipt => (
                            <div
                                key={receipt.id}
                                className={`bg-black border rounded-xl p-6 hover:border-[#D4AF37]/50 transition-colors ${receipt.status === 'PENDING' ? 'border-yellow-500/30' : 'border-zinc-800'
                                    }`}
                            >
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    <div className="flex items-center gap-4">
                                        <div className={`p-3 rounded-lg ${receipt.receiptType === 'IMAGE'
                                            ? 'bg-blue-500/20 text-blue-400'
                                            : 'bg-red-500/20 text-red-400'
                                            }`}>
                                            {receipt.receiptType === 'IMAGE' ? <Image size={24} /> : <FileText size={24} />}
                                        </div>
                                        <div>
                                            <p className="font-bold text-white">{receipt.customerName}</p>
                                            <p className="text-[#D4AF37] font-bold">
                                                R$ {receipt.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                            </p>
                                            <p className="text-xs text-zinc-500 mt-1">
                                                Enviado em {new Date(receipt.submittedAt).toLocaleString('pt-BR')}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4">
                                        {getStatusBadge(receipt.status)}

                                        <Button
                                            size="sm"
                                            variant="secondary"
                                            onClick={() => setSelectedReceipt(receipt)}
                                        >
                                            <Eye size={16} /> Analisar
                                        </Button>
                                    </div>
                                </div>

                                {receipt.status === 'REJECTED' && receipt.rejectionReason && (
                                    <div className="mt-4 p-3 bg-red-900/20 border border-red-700/30 rounded-lg">
                                        <p className="text-xs text-red-400">
                                            <AlertCircle size={12} className="inline mr-1" />
                                            Motivo: {receipt.rejectionReason}
                                        </p>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Receipt Modal */}
            {selectedReceipt && (
                <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-50 p-4">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-zinc-800 flex justify-between items-center">
                            <h2 className="text-xl font-bold text-white">Analisar Comprovante</h2>
                            <button onClick={() => setSelectedReceipt(null)} className="text-zinc-500 hover:text-white">
                                <X size={24} />
                            </button>
                        </div>

                        <div className="p-6 space-y-6">
                            {/* Client Info */}
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

                            {/* Receipt Preview */}
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

                            {/* Actions */}
                            {selectedReceipt.status === 'PENDING' && (
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm text-zinc-400 mb-2">
                                            Motivo da rejeição (opcional)
                                        </label>
                                        <textarea
                                            value={rejectionReason}
                                            onChange={(e) => setRejectionReason(e.target.value)}
                                            placeholder="Informe o motivo caso rejeite o comprovante..."
                                            className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white focus:border-[#D4AF37] outline-none h-20 resize-none"
                                        />
                                    </div>

                                    <div className="flex gap-4">
                                        <Button
                                            variant="danger"
                                            className="flex-1"
                                            onClick={() => handleReject(selectedReceipt)}
                                            isLoading={processing === selectedReceipt.id}
                                        >
                                            <X size={18} /> Rejeitar
                                        </Button>
                                        <Button
                                            className="flex-1 bg-green-600 hover:bg-green-700"
                                            onClick={() => handleApprove(selectedReceipt)}
                                            isLoading={processing === selectedReceipt.id}
                                        >
                                            <Check size={18} /> Aprovar Pagamento
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {selectedReceipt.status !== 'PENDING' && (
                                <div className={`p-4 rounded-xl ${selectedReceipt.status === 'APPROVED'
                                    ? 'bg-green-900/20 border border-green-700/30'
                                    : 'bg-red-900/20 border border-red-700/30'
                                    }`}>
                                    <p className={`font-bold ${selectedReceipt.status === 'APPROVED' ? 'text-green-400' : 'text-red-400'
                                        }`}>
                                        {selectedReceipt.status === 'APPROVED' ? 'Pagamento Aprovado' : 'Comprovante Rejeitado'}
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
            )}
        </div>
    );
};

export default PaymentReceipts;
