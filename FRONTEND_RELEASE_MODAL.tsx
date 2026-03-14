// ============================================================================
// FRONTEND - MODAL DE LIBERAÇÃO DO EMPRÉSTIMO (ETAPA 4)
// Arquivo: Adicionar ao Requests.tsx
// ============================================================================

// ESTE MODAL RESOLVE O BUG DO BECO SEM SAÍDA DO PIX
// Comprovante de PIX é OBRIGATÓRIO para liberar o empréstimo

// ===== NOVOS ESTADOS (adicionar após os estados existentes) =====
const [isReleaseModalOpen, setIsReleaseModalOpen] = useState(false);
const [releaseData, setReleaseData] = useState({
    releasedAmount: '',
    releaseMethod: 'PIX',
    pixReceiptUrl: '',
    releaseNotes: ''
});
const [uploadingPixReceipt, setUploadingPixReceipt] = useState(false);

// ===== FUNÇÃO DE UPLOAD DO COMPROVANTE PIX =====
const handlePixReceiptUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar tipo de arquivo
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'];
    if (!validTypes.includes(file.type)) {
        addToast('Formato inválido. Use JPG, PNG, WEBP ou PDF', 'error');
        return;
    }

    // Validar tamanho (máx 5MB)
    if (file.size > 5 * 1024 * 1024) {
        addToast('Arquivo muito grande. Máximo: 5MB', 'error');
        return;
    }

    setUploadingPixReceipt(true);

    try {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch('/api/upload', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: formData
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || 'Erro no upload');
        }

        setReleaseData({ ...releaseData, pixReceiptUrl: result.url });
        addToast('✅ Comprovante anexado com sucesso!', 'success');
    } catch (error: any) {
        addToast(error.message || 'Erro ao fazer upload', 'error');
    } finally {
        setUploadingPixReceipt(false);
    }
};

// ===== FUNÇÃO DE LIBERAÇÃO DO EMPRÉSTIMO =====
const handleReleaseLoan = async () => {
    if (!selectedRequest) return;

    // Validações
    if (!releaseData.releasedAmount || parseFloat(releaseData.releasedAmount) <= 0) {
        addToast('Valor liberado é obrigatório', 'error');
        return;
    }

    if (!releaseData.releaseMethod) {
        addToast('Método de liberação é obrigatório', 'error');
        return;
    }

    // ⚠️ VALIDAÇÃO CRÍTICA: Comprovante de PIX é OBRIGATÓRIO
    if (!releaseData.pixReceiptUrl || releaseData.pixReceiptUrl.trim() === '') {
        addToast('⚠️ COMPROVANTE DE PIX É OBRIGATÓRIO! Anexe o comprovante antes de liberar.', 'error');
        return;
    }

    setProcessing(selectedRequest.id);
    try {
        const response = await fetch(`/api/loans/${selectedRequest.id}/release`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({
                releasedAmount: parseFloat(releaseData.releasedAmount),
                releaseMethod: releaseData.releaseMethod,
                pixReceiptUrl: releaseData.pixReceiptUrl,
                releaseNotes: releaseData.releaseNotes
            })
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || 'Erro ao liberar empréstimo');
        }

        setProcessing(null);
        setIsReleaseModalOpen(false);
        setReleaseData({
            releasedAmount: '',
            releaseMethod: 'PIX',
            pixReceiptUrl: '',
            releaseNotes: ''
        });
        setSelectedRequest(null);
        loadRequests();
        addToast(`✅ Empréstimo liberado! Contrato #${result.data.loanId.slice(-6)} ativado.`, 'success');
    } catch (error: any) {
        setProcessing(null);
        addToast(error.message || 'Erro ao liberar empréstimo', 'error');
    }
};

// ===== FUNÇÃO PARA ABRIR MODAL DE LIBERAÇÃO =====
const openReleaseModal = () => {
    if (!selectedRequest) return;

    // Pré-preencher com o valor aprovado
    setReleaseData({
        releasedAmount: selectedRequest.approvedAmount?.toString() || selectedRequest.amount.toString(),
        releaseMethod: 'PIX',
        pixReceiptUrl: '',
        releaseNotes: ''
    });
    setIsReleaseModalOpen(true);
};

// ===== MODAL DE LIBERAÇÃO =====
{isReleaseModalOpen && selectedRequest && (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
        <div className="bg-zinc-900 border-2 border-[#D4AF37] rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 bg-zinc-900 border-b border-zinc-800 p-6 flex items-center justify-between">
                <div>
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                        <Send size={24} className="text-green-400" />
                        Liberar Empréstimo
                    </h3>
                    <p className="text-sm text-zinc-400 mt-1">
                        {selectedRequest.clientName} • CPF: {selectedRequest.cpf}
                    </p>
                </div>
                <button
                    onClick={() => {
                        setIsReleaseModalOpen(false);
                        setReleaseData({
                            releasedAmount: '',
                            releaseMethod: 'PIX',
                            pixReceiptUrl: '',
                            releaseNotes: ''
                        });
                    }}
                    className="text-zinc-400 hover:text-white transition-colors"
                >
                    <X size={24} />
                </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-6">
                {/* Alerta Importante */}
                <div className="bg-red-900/30 border-2 border-red-500 rounded-xl p-4">
                    <p className="text-red-400 font-bold text-center flex items-center justify-center gap-2">
                        <AlertTriangle size={20} />
                        ATENÇÃO: Só libere após transferir o valor para o cliente!
                    </p>
                </div>

                {/* Resumo da Aprovação */}
                <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-4">
                    <h4 className="font-bold text-white mb-3">📋 Resumo da Aprovação</h4>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                            <p className="text-zinc-500">Valor Aprovado</p>
                            <p className="font-bold text-white">
                                R$ {(selectedRequest.approvedAmount || selectedRequest.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </p>
                        </div>
                        <div>
                            <p className="text-zinc-500">Tipo de Cobrança</p>
                            <p className="font-bold text-white">
                                {selectedRequest.chargeType === 'DAILY' ? 'Diária' :
                                 selectedRequest.chargeType === 'WEEKLY' ? 'Semanal' :
                                 selectedRequest.chargeType === 'MONTHLY' ? 'Mensal' : 'Personalizado'}
                            </p>
                        </div>
                        <div>
                            <p className="text-zinc-500">Período</p>
                            <p className="font-bold text-white">
                                {selectedRequest.chargePeriod}x
                            </p>
                        </div>
                        <div>
                            <p className="text-zinc-500">Taxa de Juros</p>
                            <p className="font-bold text-white">
                                {selectedRequest.interestRate}%
                            </p>
                        </div>
                    </div>
                </div>

                {/* Valor Liberado */}
                <div className="space-y-2">
                    <label className="block text-sm font-bold text-white">
                        💰 Valor Liberado (R$) *
                    </label>
                    <input
                        type="number"
                        step="0.01"
                        value={releaseData.releasedAmount}
                        onChange={(e) => setReleaseData({ ...releaseData, releasedAmount: e.target.value })}
                        placeholder="Ex: 5000.00"
                        className="w-full bg-black border-2 border-zinc-700 rounded-xl p-3 text-white text-lg font-bold focus:border-[#D4AF37] outline-none"
                    />
                    <p className="text-xs text-zinc-500">
                        Valor efetivamente transferido para o cliente
                    </p>
                </div>

                {/* Método de Liberação */}
                <div className="space-y-2">
                    <label className="block text-sm font-bold text-white">
                        💳 Método de Liberação *
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                        {[
                            { id: 'PIX', label: 'PIX', icon: '⚡' },
                            { id: 'TED', label: 'TED', icon: '🏦' },
                            { id: 'DINHEIRO', label: 'Dinheiro', icon: '💵' }
                        ].map((method) => (
                            <button
                                key={method.id}
                                onClick={() => setReleaseData({ ...releaseData, releaseMethod: method.id })}
                                className={`p-3 rounded-lg border-2 transition-all ${
                                    releaseData.releaseMethod === method.id
                                        ? 'border-[#D4AF37] bg-[#D4AF37]/10 ring-2 ring-[#D4AF37]'
                                        : 'border-zinc-700 hover:border-zinc-500'
                                }`}
                            >
                                <p className="text-2xl mb-1">{method.icon}</p>
                                <p className="font-bold text-sm text-white">{method.label}</p>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Upload do Comprovante PIX - OBRIGATÓRIO */}
                <div className="space-y-2">
                    <label className="block text-sm font-bold text-white flex items-center gap-2">
                        📎 Comprovante de Transferência *
                        <span className="text-red-400 text-xs">(OBRIGATÓRIO)</span>
                    </label>

                    {!releaseData.pixReceiptUrl ? (
                        <div className="border-2 border-dashed border-[#D4AF37] rounded-xl p-6 text-center bg-[#D4AF37]/5">
                            <input
                                type="file"
                                accept="image/*,.pdf"
                                onChange={handlePixReceiptUpload}
                                disabled={uploadingPixReceipt}
                                className="hidden"
                                id="pix-receipt-upload"
                            />
                            <label
                                htmlFor="pix-receipt-upload"
                                className="cursor-pointer flex flex-col items-center gap-3"
                            >
                                {uploadingPixReceipt ? (
                                    <>
                                        <div className="w-12 h-12 border-4 border-[#D4AF37] border-t-transparent rounded-full animate-spin" />
                                        <p className="text-white font-bold">Enviando...</p>
                                    </>
                                ) : (
                                    <>
                                        <div className="w-16 h-16 bg-[#D4AF37] rounded-full flex items-center justify-center">
                                            <Upload size={32} className="text-black" />
                                        </div>
                                        <div>
                                            <p className="text-white font-bold mb-1">
                                                Clique para anexar o comprovante
                                            </p>
                                            <p className="text-xs text-zinc-500">
                                                JPG, PNG, WEBP ou PDF (máx 5MB)
                                            </p>
                                        </div>
                                    </>
                                )}
                            </label>
                        </div>
                    ) : (
                        <div className="border-2 border-green-500 rounded-xl p-4 bg-green-900/20">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 bg-green-500 rounded-lg flex items-center justify-center">
                                        <Check size={24} className="text-white" />
                                    </div>
                                    <div>
                                        <p className="font-bold text-white">Comprovante anexado</p>
                                        <a
                                            href={releaseData.pixReceiptUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-xs text-[#D4AF37] hover:underline flex items-center gap-1"
                                        >
                                            <ExternalLink size={12} />
                                            Ver comprovante
                                        </a>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setReleaseData({ ...releaseData, pixReceiptUrl: '' })}
                                    className="text-red-400 hover:text-red-300 transition-colors"
                                >
                                    <X size={20} />
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Observações */}
                <div className="space-y-2">
                    <label className="block text-sm font-bold text-white">
                        📝 Observações (opcional)
                    </label>
                    <textarea
                        value={releaseData.releaseNotes}
                        onChange={(e) => setReleaseData({ ...releaseData, releaseNotes: e.target.value })}
                        placeholder="Anotações sobre a liberação..."
                        rows={3}
                        className="w-full bg-black border-2 border-zinc-700 rounded-xl p-3 text-white focus:border-[#D4AF37] outline-none resize-none"
                    />
                </div>

                {/* Alerta Final */}
                <div className="bg-yellow-900/30 border border-yellow-600 rounded-xl p-4">
                    <p className="text-yellow-400 text-sm text-center">
                        ⚠️ Ao confirmar, o contrato será ativado e o cliente começará a pagar as parcelas.
                    </p>
                </div>
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 bg-zinc-900 border-t border-zinc-800 p-6 flex flex-col md:flex-row gap-3">
                <button
                    onClick={() => {
                        setIsReleaseModalOpen(false);
                        setReleaseData({
                            releasedAmount: '',
                            releaseMethod: 'PIX',
                            pixReceiptUrl: '',
                            releaseNotes: ''
                        });
                    }}
                    className="flex-1 px-6 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl font-bold transition-colors"
                    disabled={processing === selectedRequest.id}
                >
                    Cancelar
                </button>
                <button
                    onClick={handleReleaseLoan}
                    disabled={processing === selectedRequest.id || !releaseData.pixReceiptUrl}
                    className="flex-1 px-6 py-3 bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 text-white rounded-xl font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                    {processing === selectedRequest.id ? (
                        <>
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            Liberando...
                        </>
                    ) : (
                        <>
                            <Send size={20} />
                            Liberar Empréstimo
                        </>
                    )}
                </button>
            </div>
        </div>
    </div>
)}

// ===== ADICIONAR BOTÃO "LIBERAR EMPRÉSTIMO" NO MODAL DE DETALHES =====
// Procure pelo rodapé de ações do modal de detalhes e adicione este botão:

{selectedRequest?.status === 'APPROVED' && (
    <button
        onClick={openReleaseModal}
        className="flex-1 px-6 py-3 bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2"
    >
        <Send size={20} />
        LIBERAR EMPRÉSTIMO
    </button>
)}
