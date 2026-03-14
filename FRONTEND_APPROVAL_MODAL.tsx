// ============================================================================
// FRONTEND - MODAL DE APROVAÇÃO COM CONTRAPROPOSTA (ETAPA 2)
// Arquivo: Adicionar ao Requests.tsx
// ============================================================================

// SUBSTITUIR o modal de aprovação existente (procure por "isApprovalModalOpen")
// Este código corrige o BUG DO BOTÃO FANTASMA

// ===== NOVOS ESTADOS (adicionar após linha 56) =====
const [approvalData, setApprovalData] = useState({
    approvedAmount: '',
    chargeType: 'MONTHLY', // DAILY, WEEKLY, MONTHLY, CUSTOM
    chargePeriod: '',
    interestRate: '',
    firstPaymentDate: '',
    adminNotes: ''
});

// ===== FUNÇÃO DE APROVAÇÃO ATUALIZADA (substituir handleApproveWithCounteroffer) =====
const handleApproveWithCounteroffer = async () => {
    if (!selectedRequest) return;

    // Validações
    if (!approvalData.approvedAmount || parseFloat(approvalData.approvedAmount) <= 0) {
        addToast('Valor aprovado é obrigatório', 'error');
        return;
    }

    if (!approvalData.chargeType) {
        addToast('Tipo de cobrança é obrigatório', 'error');
        return;
    }

    if (!approvalData.chargePeriod || parseInt(approvalData.chargePeriod) <= 0) {
        addToast('Período de cobrança é obrigatório', 'error');
        return;
    }

    if (approvalData.interestRate === '' || parseFloat(approvalData.interestRate) < 0) {
        addToast('Taxa de juros é obrigatória (pode ser 0)', 'error');
        return;
    }

    if (!approvalData.firstPaymentDate) {
        addToast('Data do primeiro pagamento é obrigatória', 'error');
        return;
    }

    setProcessing(selectedRequest.id);
    try {
        const response = await fetch(`/api/loan-requests/${selectedRequest.id}/approve`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({
                approvedAmount: parseFloat(approvalData.approvedAmount),
                chargeType: approvalData.chargeType,
                chargePeriod: parseInt(approvalData.chargePeriod),
                interestRate: parseFloat(approvalData.interestRate),
                firstPaymentDate: approvalData.firstPaymentDate,
                adminNotes: approvalData.adminNotes
            })
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || 'Erro ao aprovar');
        }

        setProcessing(null);
        setIsApprovalModalOpen(false);
        setApprovalData({
            approvedAmount: '',
            chargeType: 'MONTHLY',
            chargePeriod: '',
            interestRate: '',
            firstPaymentDate: '',
            adminNotes: ''
        });
        setSelectedRequest(null);
        loadRequests();
        addToast(`✅ Empréstimo aprovado! Total: R$ ${result.data.totalDebtAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 'success');
    } catch (error: any) {
        setProcessing(null);
        addToast(error.message || 'Erro ao aprovar empréstimo', 'error');
    }
};

// ===== MODAL DE APROVAÇÃO ATUALIZADO (substituir o modal existente) =====
{isApprovalModalOpen && selectedRequest && (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
        <div className="bg-zinc-900 border-2 border-[#D4AF37] rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 bg-zinc-900 border-b border-zinc-800 p-6 flex items-center justify-between">
                <div>
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                        <Check size={24} className="text-green-400" />
                        Aprovar Empréstimo
                    </h3>
                    <p className="text-sm text-zinc-400 mt-1">
                        {selectedRequest.clientName} • CPF: {selectedRequest.cpf}
                    </p>
                </div>
                <button
                    onClick={() => {
                        setIsApprovalModalOpen(false);
                        setApprovalData({
                            approvedAmount: '',
                            chargeType: 'MONTHLY',
                            chargePeriod: '',
                            interestRate: '',
                            firstPaymentDate: '',
                            adminNotes: ''
                        });
                    }}
                    className="text-zinc-400 hover:text-white transition-colors"
                >
                    <X size={24} />
                </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-6">
                {/* Valor Solicitado vs Aprovado */}
                <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <p className="text-xs text-zinc-500 mb-1">Valor Solicitado</p>
                            <p className="text-lg font-bold text-white">
                                R$ {selectedRequest.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </p>
                        </div>
                        <div>
                            <p className="text-xs text-zinc-500 mb-1">Parcelas Solicitadas</p>
                            <p className="text-lg font-bold text-white">
                                {selectedRequest.installments}x
                            </p>
                        </div>
                    </div>
                </div>

                {/* Valor Aprovado */}
                <div className="space-y-2">
                    <label className="block text-sm font-bold text-white">
                        💰 Valor Aprovado (R$) *
                    </label>
                    <input
                        type="number"
                        step="0.01"
                        value={approvalData.approvedAmount}
                        onChange={(e) => setApprovalData({ ...approvalData, approvedAmount: e.target.value })}
                        placeholder="Ex: 5000.00"
                        className="w-full bg-black border-2 border-zinc-700 rounded-xl p-3 text-white text-lg font-bold focus:border-[#D4AF37] outline-none"
                    />
                    <p className="text-xs text-zinc-500">
                        Pode ser diferente do valor solicitado (contraproposta)
                    </p>
                </div>

                {/* Tipo de Cobrança */}
                <div className="space-y-2">
                    <label className="block text-sm font-bold text-white">
                        📊 Tipo de Cobrança *
                    </label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        {[
                            { id: 'DAILY', label: 'Diária', desc: 'Pagamento diário' },
                            { id: 'WEEKLY', label: 'Semanal', desc: '7 em 7 dias' },
                            { id: 'MONTHLY', label: 'Mensal', desc: 'Parcelas mensais' },
                            { id: 'CUSTOM', label: 'Personalizado', desc: 'Prazo customizado' }
                        ].map((type) => (
                            <button
                                key={type.id}
                                onClick={() => setApprovalData({ ...approvalData, chargeType: type.id })}
                                className={`p-3 rounded-lg border-2 transition-all text-left ${
                                    approvalData.chargeType === type.id
                                        ? 'border-[#D4AF37] bg-[#D4AF37]/10 ring-2 ring-[#D4AF37]'
                                        : 'border-zinc-700 hover:border-zinc-500'
                                }`}
                            >
                                <p className="font-bold text-sm text-white">{type.label}</p>
                                <p className="text-xs text-zinc-500">{type.desc}</p>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Período */}
                <div className="space-y-2">
                    <label className="block text-sm font-bold text-white">
                        📅 Quantidade de {approvalData.chargeType === 'MONTHLY' ? 'Parcelas' : 'Dias'} *
                    </label>
                    <input
                        type="number"
                        value={approvalData.chargePeriod}
                        onChange={(e) => setApprovalData({ ...approvalData, chargePeriod: e.target.value })}
                        placeholder={approvalData.chargeType === 'MONTHLY' ? 'Ex: 6' : 'Ex: 20'}
                        className="w-full bg-black border-2 border-zinc-700 rounded-xl p-3 text-white focus:border-[#D4AF37] outline-none"
                    />
                </div>

                {/* Taxa de Juros */}
                <div className="space-y-2">
                    <label className="block text-sm font-bold text-white">
                        📈 Taxa de Juros (%) *
                    </label>
                    <input
                        type="number"
                        step="0.01"
                        value={approvalData.interestRate}
                        onChange={(e) => setApprovalData({ ...approvalData, interestRate: e.target.value })}
                        placeholder="Ex: 7.00"
                        className="w-full bg-black border-2 border-zinc-700 rounded-xl p-3 text-white focus:border-[#D4AF37] outline-none"
                    />
                    <p className="text-xs text-zinc-500">
                        {approvalData.chargeType === 'DAILY' && 'Taxa aplicada por dia'}
                        {approvalData.chargeType === 'WEEKLY' && 'Taxa aplicada por semana'}
                        {approvalData.chargeType === 'MONTHLY' && 'Taxa aplicada por mês (juros compostos)'}
                        {approvalData.chargeType === 'CUSTOM' && 'Taxa aplicada no período total'}
                    </p>
                </div>

                {/* Data do Primeiro Pagamento */}
                <div className="space-y-2">
                    <label className="block text-sm font-bold text-white">
                        🗓️ Data do Primeiro Pagamento *
                    </label>
                    <input
                        type="date"
                        value={approvalData.firstPaymentDate}
                        onChange={(e) => setApprovalData({ ...approvalData, firstPaymentDate: e.target.value })}
                        min={new Date().toISOString().split('T')[0]}
                        className="w-full bg-black border-2 border-zinc-700 rounded-xl p-3 text-white focus:border-[#D4AF37] outline-none"
                    />
                </div>

                {/* Preview do Cálculo */}
                {approvalData.approvedAmount && approvalData.chargePeriod && approvalData.interestRate && (
                    <div className="bg-gradient-to-r from-[#D4AF37]/20 to-orange-500/20 border-2 border-[#D4AF37] rounded-xl p-4">
                        <h4 className="font-bold text-[#D4AF37] mb-3">📊 Preview do Contrato</h4>
                        {(() => {
                            const principal = parseFloat(approvalData.approvedAmount);
                            const rate = parseFloat(approvalData.interestRate) / 100;
                            const period = parseInt(approvalData.chargePeriod);

                            let totalDebt = 0;
                            let installmentValue = 0;

                            if (approvalData.chargeType === 'DAILY' || approvalData.chargeType === 'WEEKLY' || approvalData.chargeType === 'CUSTOM') {
                                // Juros simples
                                const totalInterest = principal * rate * period;
                                totalDebt = principal + totalInterest;
                                installmentValue = totalDebt / period;
                            } else if (approvalData.chargeType === 'MONTHLY') {
                                // Juros compostos
                                totalDebt = principal * Math.pow(1 + rate, period);
                                installmentValue = totalDebt / period;
                            }

                            return (
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-zinc-400">Valor Principal:</span>
                                        <span className="font-bold text-white">R$ {principal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-zinc-400">Valor Total da Dívida:</span>
                                        <span className="font-bold text-[#D4AF37]">R$ {totalDebt.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-zinc-400">Valor de Cada {approvalData.chargeType === 'MONTHLY' ? 'Parcela' : 'Diária'}:</span>
                                        <span className="font-bold text-white">R$ {installmentValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-zinc-400">Total de Juros:</span>
                                        <span className="font-bold text-orange-400">R$ {(totalDebt - principal).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                    </div>
                                </div>
                            );
                        })()}
                    </div>
                )}

                {/* Observações do Admin */}
                <div className="space-y-2">
                    <label className="block text-sm font-bold text-white">
                        📝 Observações Internas (opcional)
                    </label>
                    <textarea
                        value={approvalData.adminNotes}
                        onChange={(e) => setApprovalData({ ...approvalData, adminNotes: e.target.value })}
                        placeholder="Anotações sobre a aprovação..."
                        rows={3}
                        className="w-full bg-black border-2 border-zinc-700 rounded-xl p-3 text-white focus:border-[#D4AF37] outline-none resize-none"
                    />
                </div>
            </div>

            {/* Footer - BOTÕES CORRIGIDOS (BUG DO BOTÃO FANTASMA RESOLVIDO) */}
            <div className="sticky bottom-0 bg-zinc-900 border-t border-zinc-800 p-6 flex flex-col md:flex-row gap-3">
                <button
                    onClick={() => {
                        setIsApprovalModalOpen(false);
                        setApprovalData({
                            approvedAmount: '',
                            chargeType: 'MONTHLY',
                            chargePeriod: '',
                            interestRate: '',
                            firstPaymentDate: '',
                            adminNotes: ''
                        });
                    }}
                    className="flex-1 px-6 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl font-bold transition-colors"
                    disabled={processing === selectedRequest.id}
                >
                    Cancelar
                </button>
                <button
                    onClick={handleApproveWithCounteroffer}
                    disabled={processing === selectedRequest.id}
                    className="flex-1 px-6 py-3 bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 text-white rounded-xl font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                    {processing === selectedRequest.id ? (
                        <>
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            Aprovando...
                        </>
                    ) : (
                        <>
                            <Check size={20} />
                            Confirmar Aprovação
                        </>
                    )}
                </button>
            </div>
        </div>
    </div>
)}
