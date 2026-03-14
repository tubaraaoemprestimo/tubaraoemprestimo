


import React, { useState, useEffect } from 'react';
import { Check, X, Eye, Maximize, Layers, Download, Filter, Video, Users, Phone, FileWarning, Send, AlertTriangle, MapPin, FileText, ExternalLink } from 'lucide-react';
import { Button } from '../../components/Button';
import { apiService } from '../../services/apiService';
import { emailService } from '../../services/emailService';
import { LoanRequest, LoanStatus } from '../../types';
import { ImageViewer } from '../../components/ImageViewer';
import { useToast } from '../../components/Toast';
import ConsultaCPFCard from '../../components/ConsultaCPFCard';

// Cores dos perfis para badges coloridas
const PROFILE_COLORS: Record<string, { bg: string; text: string; label: string }> = {
    CLT: { bg: 'bg-gray-600', text: 'text-white', label: 'CLT' },
    AUTONOMO: { bg: 'bg-green-600', text: 'text-white', label: 'Comércio' },
    MOTO: { bg: 'bg-blue-600', text: 'text-white', label: 'Fin. Moto' },
    GARANTIA: { bg: 'bg-yellow-500', text: 'text-black', label: 'Garantia' },
    LIMPA_NOME: { bg: 'bg-purple-600', text: 'text-white', label: 'Limpa Nome' },
    GARANTIA_VEICULO: { bg: 'bg-yellow-500', text: 'text-black', label: 'Garantia' },
};

// Guias por tipo de serviço
const PROFILE_TABS = [
    { id: 'ALL', label: 'Todos', bg: 'bg-zinc-200', text: 'text-black', border: 'border-zinc-300', profileTypes: [] as string[] },
    { id: 'CLT', label: 'CLT', bg: 'bg-gray-600', text: 'text-white', border: 'border-gray-600', profileTypes: ['CLT'] },
    { id: 'AUTONOMO', label: 'Comércio', bg: 'bg-green-600', text: 'text-white', border: 'border-green-600', profileTypes: ['AUTONOMO'] },
    { id: 'MOTO', label: 'Fin. Moto', bg: 'bg-blue-600', text: 'text-white', border: 'border-blue-600', profileTypes: ['MOTO'] },
    { id: 'GARANTIA', label: 'Garantia', bg: 'bg-yellow-500', text: 'text-black', border: 'border-yellow-500', profileTypes: ['GARANTIA', 'GARANTIA_VEICULO'] },
    { id: 'LIMPA_NOME', label: 'Limpa Nome', bg: 'bg-purple-600', text: 'text-white', border: 'border-purple-600', profileTypes: ['LIMPA_NOME'] },
];

const getProfileBadge = (profileType: string | undefined) => {
    const config = PROFILE_COLORS[profileType || ''] || { bg: 'bg-zinc-700', text: 'text-white', label: profileType || 'N/A' };
    return (
        <span className={`px-2 py-0.5 rounded text-xs font-bold ${config.bg} ${config.text}`}>
            {config.label}
        </span>
    );
};

export const Requests: React.FC = () => {
    const { addToast } = useToast();
    const [requests, setRequests] = useState<LoanRequest[]>([]);
    const [selectedRequest, setSelectedRequest] = useState<LoanRequest | null>(null);
    const [viewingImage, setViewingImage] = useState<{ urls: string[]; title: string } | null>(null);
    const [processing, setProcessing] = useState<string | null>(null);

    // Document Request Modal
    const [isDocRequestOpen, setIsDocRequestOpen] = useState(false);
    const [docRequestDesc, setDocRequestDesc] = useState('');

    // Approval Modal with Counteroffer
    const [isApprovalModalOpen, setIsApprovalModalOpen] = useState(false);
    const [approvedAmount, setApprovedAmount] = useState('');

    // Contract Activation Modal (FASE 2)
    const [isActivationModalOpen, setIsActivationModalOpen] = useState(false);
    const [contractData, setContractData] = useState({
        principalAmount: '',
        dailyInstallmentAmount: '',
        totalInstallments: '',
        firstPaymentDate: '',
        pixReceiptUrl: '',
        interestRate: '',
        paymentFrequency: 'MONTHLY',
        dueDay: '',
        adminNotes: ''
    });
    const [uploadingPix, setUploadingPix] = useState(false);

    // Editing Values
    const [isEditing, setIsEditing] = useState(false);
    const [editAmount, setEditAmount] = useState<string>('');
    const [editInstallments, setEditInstallments] = useState<string>('');

    // Filters
    const [filterStatus, setFilterStatus] = useState<string>('ALL');
    const [filterProfile, setFilterProfile] = useState<string>('ALL');

    useEffect(() => {
        loadRequests();
    }, []);

    const loadRequests = async () => {
        const data = await apiService.getRequests();
        setRequests(data);
    };

    const handleApprove = async (id: string) => {
        if (!selectedRequest) return;
        setProcessing(id);
        await apiService.approveLoan(id);

        // Enviar email de aprovação
        emailService.notifyApproved({
            clientName: selectedRequest.clientName,
            clientEmail: selectedRequest.email,
            amount: selectedRequest.amount,
            installments: selectedRequest.installments,
        }).catch(() => { });

        setProcessing(null);
        setSelectedRequest(null);
        loadRequests();
        addToast("Solicitação aprovada e saldo liberado.", 'success');
    };

    const openApprovalModal = () => {
        if (!selectedRequest) return;
        // Pré-preencher com o valor solicitado
        setApprovedAmount(selectedRequest.amount.toString());
        setIsApprovalModalOpen(true);
    };

    const handleApproveWithCounteroffer = async () => {
        if (!selectedRequest || !approvedAmount) return;

        const amount = parseFloat(approvedAmount);
        if (isNaN(amount) || amount <= 0) {
            addToast('Valor aprovado inválido', 'error');
            return;
        }

        setProcessing(selectedRequest.id);
        try {
            await apiService.approveWithCounteroffer(selectedRequest.id, amount);

            setProcessing(null);
            setIsApprovalModalOpen(false);
            setApprovedAmount('');
            setSelectedRequest(null);
            loadRequests();
            addToast("Contraproposta enviada ao cliente!", 'success');
        } catch (error) {
            setProcessing(null);
            addToast("Erro ao enviar contraproposta", 'error');
        }
    };

    // FASE 2: Abrir modal de ativação de contrato
    const openActivationModal = () => {
        if (!selectedRequest) return;

        // Pré-preencher com dados da solicitação
        const firstPayment = new Date();
        firstPayment.setDate(firstPayment.getDate() + 7); // 7 dias após hoje

        setContractData({
            principalAmount: selectedRequest.amount.toString(),
            dailyInstallmentAmount: selectedRequest.profileType === 'AUTONOMO' ? '' : '',
            totalInstallments: selectedRequest.installments.toString(),
            firstPaymentDate: firstPayment.toISOString().split('T')[0],
            pixReceiptUrl: '',
            interestRate: selectedRequest.profileType === 'CLT' ? '30' : '',
            paymentFrequency: selectedRequest.profileType === 'AUTONOMO' ? 'DAILY' : 'MONTHLY',
            dueDay: selectedRequest.preferredDueDay?.toString() || '10',
            adminNotes: ''
        });

        setIsActivationModalOpen(true);
    };

    // FASE 2: Upload do comprovante de PIX
    const handlePixUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validar tamanho (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            addToast('Arquivo muito grande. Máximo 5MB.', 'error');
            return;
        }

        setUploadingPix(true);
        try {
            const reader = new FileReader();
            reader.onloadend = () => {
                setContractData(prev => ({ ...prev, pixReceiptUrl: reader.result as string }));
                setUploadingPix(false);
                addToast('Comprovante carregado!', 'success');
            };
            reader.onerror = () => {
                setUploadingPix(false);
                addToast('Erro ao carregar arquivo', 'error');
            };
            reader.readAsDataURL(file);
        } catch (error) {
            setUploadingPix(false);
            addToast('Erro ao processar arquivo', 'error');
        }
    };

    // FASE 2: Ativar contrato
    const handleActivateContract = async () => {
        if (!selectedRequest) return;

        // Validações
        if (!contractData.principalAmount || parseFloat(contractData.principalAmount) <= 0) {
            addToast('Valor principal inválido', 'error');
            return;
        }
        if (!contractData.totalInstallments || parseInt(contractData.totalInstallments) <= 0) {
            addToast('Número de parcelas inválido', 'error');
            return;
        }
        if (!contractData.firstPaymentDate) {
            addToast('Data do primeiro pagamento obrigatória', 'error');
            return;
        }
        if (!contractData.pixReceiptUrl) {
            addToast('Comprovante de PIX obrigatório', 'error');
            return;
        }

        setProcessing(selectedRequest.id);
        try {
            const payload = {
                principalAmount: parseFloat(contractData.principalAmount),
                dailyInstallmentAmount: contractData.dailyInstallmentAmount ? parseFloat(contractData.dailyInstallmentAmount) : null,
                totalInstallments: parseInt(contractData.totalInstallments),
                firstPaymentDate: contractData.firstPaymentDate,
                pixReceiptUrl: contractData.pixReceiptUrl,
                interestRate: contractData.interestRate ? parseFloat(contractData.interestRate) : null,
                paymentFrequency: contractData.paymentFrequency,
                dueDay: contractData.dueDay ? parseInt(contractData.dueDay) : null,
                adminNotes: contractData.adminNotes || null
            };

            const response = await fetch(`${import.meta.env.VITE_API_URL || 'https://api.tubaraoemprestimo.com.br'}/api/loan-requests/${selectedRequest.id}/activate-contract`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('tubarao_token')}`
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Erro ao ativar contrato');
            }

            setProcessing(null);
            setIsActivationModalOpen(false);
            setContractData({
                principalAmount: '',
                dailyInstallmentAmount: '',
                totalInstallments: '',
                firstPaymentDate: '',
                pixReceiptUrl: '',
                interestRate: '',
                paymentFrequency: 'MONTHLY',
                dueDay: '',
                adminNotes: ''
            });
            setSelectedRequest(null);
            loadRequests();
            addToast('✅ Contrato ativado com sucesso!', 'success');
        } catch (error: any) {
            setProcessing(null);
            addToast(error.message || 'Erro ao ativar contrato', 'error');
        }
    };

    const handleReject = async (id: string) => {
        if (!selectedRequest) return;
        setProcessing(id);
        await apiService.rejectLoan(id);

        // Enviar email de reprovação
        emailService.notifyRejected({
            clientName: selectedRequest.clientName,
            clientEmail: selectedRequest.email,
            amount: selectedRequest.amount,
            installments: selectedRequest.installments,
        }).catch(() => { });

        setProcessing(null);
        setSelectedRequest(null);
        loadRequests();
        addToast("Solicitação reprovada.", 'info');
    };

    const handleRequestDoc = async () => {
        if (!selectedRequest || !docRequestDesc) return;

        setProcessing(selectedRequest.id);
        await apiService.requestSupplementalDoc(selectedRequest.id, docRequestDesc);

        // Enviar email solicitando documentos
        emailService.notifyWaitingDocs({
            clientName: selectedRequest.clientName,
            clientEmail: selectedRequest.email,
            amount: selectedRequest.amount,
            installments: selectedRequest.installments,
            message: docRequestDesc,
        }).catch(() => { });

        setProcessing(null);
        setIsDocRequestOpen(false);
        setDocRequestDesc('');
        setSelectedRequest(null);
        loadRequests();
        addToast("Solicitação de documento enviada ao cliente.", 'success');
    };

    const ensureArray = (src?: string | string[]): string[] => {
        if (!src) return [];
        if (Array.isArray(src)) return src;
        // Tentar parsear como JSON (para arrays salvos como string)
        if (typeof src === 'string' && src.startsWith('[')) {
            try {
                const parsed = JSON.parse(src);
                if (Array.isArray(parsed)) return parsed;
            } catch {
                // Não é JSON válido, retornar como array de um elemento
            }
        }
        return [src];
    };

    const handleExportCSV = () => {
        const headers = ["ID", "Cliente", "CPF", "Valor", "Parcelas", "Status", "Data"];
        const rows = filteredRequests.map(r => [
            r.id,
            r.clientName,
            r.cpf,
            r.amount,
            r.installments,
            r.status,
            new Date(r.date).toLocaleDateString()
        ]);

        let csvContent = "data:text/csv;charset=utf-8,"
            + headers.join(",") + "\n"
            + rows.map(e => e.join(",")).join("\n");

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "solicitacoes_tubarao.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const filteredRequests = requests.filter(req => {
        // Filtro por tipo de serviço
        if (filterProfile !== 'ALL') {
            const tab = PROFILE_TABS.find(t => t.id === filterProfile);
            if (tab && tab.profileTypes.length > 0) {
                if (!tab.profileTypes.includes(req.profileType || '')) return false;
            }
        }
        // Filtro por status
        if (filterStatus !== 'ALL' && req.status !== filterStatus) return false;
        return true;
    });

    const getTabCount = (tabId: string): number => {
        if (tabId === 'ALL') return requests.filter(r => filterStatus === 'ALL' || r.status === filterStatus).length;
        const tab = PROFILE_TABS.find(t => t.id === tabId);
        if (!tab) return 0;
        return requests.filter(r => {
            if (!tab.profileTypes.includes(r.profileType || '')) return false;
            if (filterStatus !== 'ALL' && r.status !== filterStatus) return false;
            return true;
        }).length;
    };

    return (
        <div className="p-4 md:p-8 bg-black min-h-screen text-white">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <h1 className="text-3xl font-bold text-[#D4AF37]">Histórico</h1>
                <Button onClick={handleExportCSV} variant="secondary" className="w-full md:w-auto bg-zinc-900 border border-zinc-800 hover:border-[#D4AF37]">
                    <Download size={18} className="mr-2" /> Exportar CSV
                </Button>
            </div>

            {/* Guias por Tipo de Serviço */}
            <div className="flex overflow-x-auto gap-2 mb-4 pb-2 -mx-4 px-4 md:mx-0 md:px-0 md:flex-wrap scrollbar-hide">
                {PROFILE_TABS.map((tab) => {
                    const count = getTabCount(tab.id);
                    const isActive = filterProfile === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setFilterProfile(tab.id)}
                            className={`px-3 md:px-4 py-2 md:py-2.5 rounded-xl text-xs md:text-sm font-bold transition-all duration-200 flex items-center gap-2 border-2 whitespace-nowrap shrink-0 ${isActive
                                ? `${tab.bg} ${tab.text} ${tab.border} shadow-lg scale-[1.02]`
                                : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-600 hover:text-white'
                                }`}
                        >
                            {tab.label}
                            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${isActive ? 'bg-black/20' : 'bg-zinc-800 text-zinc-500'
                                }`}>
                                {count}
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* Filtros por Status */}
            <div className="mb-6">
                <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2 font-medium">Status:</p>
                <div className="flex overflow-x-auto gap-2 pb-2 -mx-4 px-4 md:mx-0 md:px-0 md:flex-wrap scrollbar-hide">
                    {['ALL', LoanStatus.RETURNING_PENDING, LoanStatus.PENDING, LoanStatus.WAITING_DOCS, LoanStatus.APPROVED, LoanStatus.REJECTED].map((status) => (
                        <button
                            key={status}
                            onClick={() => setFilterStatus(status)}
                            className={`px-3 md:px-4 py-2 rounded-full text-xs font-bold transition-colors border whitespace-nowrap shrink-0 ${filterStatus === status
                                ? 'bg-[#D4AF37] text-black border-[#D4AF37]'
                                : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white'
                                }`}
                        >
                            {status === 'ALL' ? 'Todos' :
                                status === LoanStatus.RETURNING_PENDING ? '🔄 Antigo' :
                                    status === LoanStatus.WAITING_DOCS ? 'Aguardando' : status}
                        </button>
                    ))}
                </div>
            </div>

            {/* Desktop: Tabela */}
            <div className="hidden md:block bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-zinc-950 text-zinc-400">
                            <tr>
                                <th className="p-4 font-medium">Cliente</th>
                                <th className="p-4 font-medium">Tipo</th>
                                <th className="p-4 font-medium">Valor</th>
                                <th className="p-4 font-medium">Status</th>
                                <th className="p-4 font-medium">Data</th>
                                <th className="p-4 font-medium">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800">
                            {filteredRequests.length === 0 ? (
                                <tr><td colSpan={7} className="p-8 text-center text-zinc-500">Nenhuma solicitação encontrada com este filtro.</td></tr>
                            ) : (
                                filteredRequests.map((req) => (
                                    <tr key={req.id} className={`hover:bg-zinc-800/50 transition-colors ${(req.profileType === 'GARANTIA' || req.profileType === 'GARANTIA_VEICULO') ? 'border-l-4 border-l-yellow-500' :
                                        req.profileType === 'MOTO' ? 'border-l-4 border-l-blue-500' :
                                            req.profileType === 'LIMPA_NOME' ? 'border-l-4 border-l-purple-500' :
                                                req.profileType === 'AUTONOMO' ? 'border-l-4 border-l-green-500' :
                                                    req.profileType === 'CLT' ? 'border-l-4 border-l-gray-500' : ''
                                        }`}>
                                        <td className="p-4">
                                            <div className="font-medium text-white">{req.clientName}</div>
                                            <div className="text-xs text-zinc-500">{req.cpf}</div>
                                        </td>
                                        <td className="p-4">
                                            {getProfileBadge(req.profileType)}
                                            {(req.profileType === 'GARANTIA' || req.profileType === 'GARANTIA_VEICULO') && (
                                                <div className="mt-1">
                                                    <AlertTriangle size={12} className="inline text-yellow-400" />
                                                    <span className="text-xs text-yellow-400 ml-1">Conferir docs</span>
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-4 font-bold text-[#D4AF37]">
                                            {req.profileType === 'LIMPA_NOME'
                                                ? <span className="text-purple-400">Serviço</span>
                                                : req.profileType === 'MOTO'
                                                    ? <span className="text-blue-400">Financiamento</span>
                                                    : `R$ ${req.amount?.toLocaleString() || '0'}`
                                            }
                                        </td>

                                        <td className="p-4">
                                            <span className={`px-2 py-1 rounded-full text-xs font-bold ${req.status === LoanStatus.APPROVED ? 'bg-green-900/30 text-green-400' :
                                                req.status === LoanStatus.REJECTED ? 'bg-red-900/30 text-red-400' :
                                                    req.status === LoanStatus.WAITING_DOCS ? 'bg-blue-900/30 text-blue-400' :
                                                        req.status === LoanStatus.PENDING_ACCEPTANCE ? 'bg-orange-900/30 text-orange-400 border border-orange-700' :
                                                            req.status === 'RETURNING_PENDING' ? 'bg-emerald-900/30 text-emerald-400 border border-emerald-700' :
                                                                'bg-yellow-900/30 text-yellow-400'
                                                }`}>
                                                {req.status === LoanStatus.WAITING_DOCS ? 'AGUARDANDO DOC' :
                                                    req.status === LoanStatus.PENDING_ACCEPTANCE ? '⏳ AGUARDANDO ACEITE' :
                                                        req.status === 'RETURNING_PENDING' ? '🔄 CLIENTE ANTIGO' : req.status}
                                            </span>
                                        </td>
                                        <td className="p-4 text-zinc-500 text-sm">
                                            {new Date(req.date).toLocaleDateString()}
                                        </td>
                                        <td className="p-4">
                                            <Button variant="secondary" size="sm" className="py-1 px-3" onClick={() => {
                                                setSelectedRequest(req);
                                                setEditAmount(String(req.amount ?? ''));
                                                setEditInstallments(String(req.installments ?? ''));
                                                setIsEditing(false);
                                            }}>
                                                <Eye size={16} className="mr-2" /> Detalhes
                                            </Button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Mobile: Cards */}
            <div className="md:hidden space-y-3">
                {filteredRequests.length === 0 ? (
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center text-zinc-500">
                        Nenhuma solicitação encontrada com este filtro.
                    </div>
                ) : (
                    filteredRequests.map((req) => (
                        <div
                            key={req.id}
                            className={`bg-zinc-900 border-2 rounded-xl p-4 space-y-3 ${(req.profileType === 'GARANTIA' || req.profileType === 'GARANTIA_VEICULO') ? 'border-yellow-500' :
                                req.profileType === 'MOTO' ? 'border-blue-500' :
                                    req.profileType === 'LIMPA_NOME' ? 'border-purple-500' :
                                        req.profileType === 'AUTONOMO' ? 'border-green-500' :
                                            req.profileType === 'CLT' ? 'border-gray-500' : 'border-zinc-800'
                                }`}
                        >
                            {/* Header: Nome + Badge */}
                            <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-bold text-white text-base truncate">{req.clientName}</h3>
                                    <p className="text-xs text-zinc-500">{req.cpf}</p>
                                </div>
                                {getProfileBadge(req.profileType)}
                            </div>

                            {/* Valor + Status */}
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <p className="text-xs text-zinc-500 mb-0.5">Valor</p>
                                    <p className="font-bold text-[#D4AF37] text-lg">
                                        {req.profileType === 'LIMPA_NOME'
                                            ? <span className="text-purple-400">Serviço</span>
                                            : req.profileType === 'MOTO'
                                                ? <span className="text-blue-400">Financiamento</span>
                                                : `R$ ${req.amount?.toLocaleString() || '0'}`
                                        }
                                    </p>
                                </div>
                                <span className={`px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap ${req.status === LoanStatus.APPROVED ? 'bg-green-900/30 text-green-400' :
                                    req.status === LoanStatus.REJECTED ? 'bg-red-900/30 text-red-400' :
                                        req.status === LoanStatus.WAITING_DOCS ? 'bg-blue-900/30 text-blue-400' :
                                            req.status === LoanStatus.PENDING_ACCEPTANCE ? 'bg-orange-900/30 text-orange-400 border border-orange-700' :
                                                req.status === 'RETURNING_PENDING' ? 'bg-emerald-900/30 text-emerald-400 border border-emerald-700' :
                                                    'bg-yellow-900/30 text-yellow-400'
                                    }`}>
                                    {req.status === LoanStatus.WAITING_DOCS ? 'AGUARDANDO DOC' :
                                        req.status === LoanStatus.PENDING_ACCEPTANCE ? '⏳ ACEITE' :
                                            req.status === 'RETURNING_PENDING' ? '🔄 ANTIGO' : req.status}
                                </span>
                            </div>

                            {/* Data + Botão */}
                            <div className="flex items-center justify-between gap-3 pt-2 border-t border-zinc-800">
                                <p className="text-xs text-zinc-500">
                                    {new Date(req.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                                </p>
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    className="py-1.5 px-3 text-xs"
                                    onClick={() => {
                                        setSelectedRequest(req);
                                        setEditAmount(String(req.amount ?? ''));
                                        setEditInstallments(String(req.installments ?? ''));
                                        setIsEditing(false);
                                    }}
                                >
                                    <Eye size={14} className="mr-1" /> Ver
                                </Button>
                            </div>

                            {/* Alerta Garantia */}
                            {(req.profileType === 'GARANTIA' || req.profileType === 'GARANTIA_VEICULO') && (
                                <div className="flex items-center gap-2 bg-yellow-900/20 border border-yellow-600/40 rounded-lg p-2">
                                    <AlertTriangle size={14} className="text-yellow-400 shrink-0" />
                                    <span className="text-xs text-yellow-400 font-medium">Conferir documentos</span>
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>

            {/* Advanced Review Modal */}
            {selectedRequest && (
                <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-50 p-0 md:p-4 overflow-hidden">
                    <div className="bg-zinc-900 border-0 md:border border-zinc-800 md:rounded-2xl w-full max-w-6xl h-full md:max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-in fade-in zoom-in duration-200">

                        {/* Header */}
                        <div className="flex justify-between items-start md:items-center p-4 md:p-6 border-b border-zinc-800 bg-zinc-950 shrink-0">
                            <div>
                                <h2 className="text-xl md:text-2xl font-bold text-white flex flex-wrap items-center gap-2">
                                    <span className="truncate">
                                        {selectedRequest.profileType === 'LIMPA_NOME' ? 'Análise de Serviço' :
                                            selectedRequest.profileType === 'MOTO' ? 'Financiamento de Moto' :
                                                (selectedRequest.profileType === 'GARANTIA' || selectedRequest.profileType === 'GARANTIA_VEICULO') ? 'Análise de Garantia' :
                                                    'Análise de Crédito'}
                                    </span>
                                    <span className={`text-xs px-2 py-1 rounded-full border whitespace-nowrap ${selectedRequest.status === LoanStatus.APPROVED ? 'bg-green-900/30 text-green-500 border-green-800' :
                                        selectedRequest.status === LoanStatus.REJECTED ? 'bg-red-900/30 text-red-500 border-red-800' :
                                            selectedRequest.status === LoanStatus.WAITING_DOCS ? 'bg-blue-900/30 text-blue-500 border-blue-800' :
                                                selectedRequest.status === 'RETURNING_PENDING' ? 'bg-emerald-900/30 text-emerald-400 border-emerald-800' :
                                                    'bg-yellow-900/30 text-yellow-500 border-yellow-800'
                                        }`}>
                                        {selectedRequest.status === 'RETURNING_PENDING' ? '🔄 ANTIGO' : selectedRequest.status}
                                    </span>
                                </h2>
                                <p className="text-zinc-400 text-xs md:text-sm mt-1 flex flex-wrap items-center gap-2">
                                    <span className="truncate">ID: {selectedRequest.id.slice(0, 8)}...</span>
                                    <span className="hidden md:inline">•</span>
                                    <span className="truncate">{selectedRequest.email}</span>
                                    {getProfileBadge(selectedRequest.profileType)}
                                </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                {!isEditing && selectedRequest.profileType !== 'LIMPA_NOME' && selectedRequest.profileType !== 'MOTO' && (selectedRequest.status === LoanStatus.PENDING || selectedRequest.status === 'RETURNING_PENDING') && (
                                    <Button size="sm" variant="secondary" onClick={() => setIsEditing(true)} className="hidden md:flex">
                                        ✏️ Editar Valores
                                    </Button>
                                )}
                                {isEditing && (
                                    <>
                                        <Button size="sm" variant="danger" onClick={() => setIsEditing(false)}>Cancelar</Button>
                                        <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={async () => {
                                            const amtNum = parseFloat(editAmount);
                                            const instNum = parseInt(editInstallments);
                                            if (isNaN(amtNum) || amtNum <= 0) {
                                                addToast('Valor inválido', 'error');
                                                return;
                                            }
                                            setProcessing('saving');
                                            const success = await apiService.updateLoanRequestValues(selectedRequest.id, amtNum, instNum || 0);
                                            if (success) {
                                                addToast('Proposta atualizada!', 'success');
                                                setSelectedRequest({ ...selectedRequest, amount: amtNum, installments: instNum || 0 });
                                                setIsEditing(false);
                                                loadRequests();
                                            } else {
                                                addToast('Erro ao atualizar', 'error');
                                            }
                                            setProcessing(null);
                                        }} isLoading={processing === 'saving'}>Salvar</Button>
                                    </>
                                )}
                                <button onClick={() => setSelectedRequest(null)} className="p-2 hover:bg-zinc-800 rounded-full text-zinc-500 hover:text-white transition-colors">
                                    <X size={24} />
                                </button>
                            </div>
                        </div>

                        {/* Content Scrollable Area */}
                        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 md:space-y-8">

                            {/* SEÇÃO: INVESTIGAÇÃO & ANÁLISE DE RISCO */}
                            <div className="bg-zinc-950 border-2 border-[#D4AF37] rounded-xl p-4 md:p-6">
                                <h3 className="text-[#D4AF37] font-bold text-base md:text-lg uppercase tracking-wider mb-4 flex items-center gap-2">
                                    🔍 Investigação & Análise de Risco
                                </h3>
                                <ConsultaCPFCard cpf={selectedRequest.cpf} />
                            </div>

                            {/* Financial Summary */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                                <InfoBox label="Cliente" value={selectedRequest.clientName} />
                                <InfoBox label="CPF" value={selectedRequest.cpf} />

                                {selectedRequest.profileType === 'LIMPA_NOME' ? (
                                    <>
                                        <InfoBox label="Serviço" value="Limpa Nome" highlight />
                                        <InfoBox label="Contrato Assinado" value={selectedRequest.limpaNomeContractSigned ? '✅ Sim' : '❌ Não'} />
                                    </>
                                ) : selectedRequest.profileType === 'MOTO' ? (
                                    <>
                                        <InfoBox label="Produto" value="Pop 110i 2026" highlight />
                                        <InfoBox label="Entrada" value="R$ 2.000,00" />
                                        <InfoBox label="Parcelas" value="36x R$ 611,00" />
                                        <InfoBox label="Mensal Total" value="R$ 761,00 (+ seguro)" />
                                    </>
                                ) : (
                                    <>
                                        {isEditing ? (
                                            <div className="p-4 rounded-xl border bg-zinc-800 border-[#D4AF37]">
                                                <p className="text-xs text-[#D4AF37] mb-1 uppercase tracking-wide">Valor (R$)</p>
                                                <input
                                                    type="text"
                                                    inputMode="decimal"
                                                    value={editAmount}
                                                    onChange={e => setEditAmount(e.target.value.replace(/[^0-9.,]/g, ''))}
                                                    className="w-full bg-black border border-zinc-700 rounded p-2 text-white font-bold text-lg"
                                                    placeholder="Ex: 2500.00"
                                                />
                                            </div>
                                        ) : (
                                            <InfoBox label="Valor Solicitado" value={`R$ ${selectedRequest.amount.toLocaleString()}`} highlight />
                                        )}

                                        {/* Badge Contraproposta */}
                                        {selectedRequest.approvedAmount && (
                                            <div className="p-4 rounded-xl border bg-green-900/20 border-green-700">
                                                <p className="text-xs text-green-400 mb-1 uppercase tracking-wide">Valor Aprovado (Contraproposta)</p>
                                                <p className="font-bold text-green-400 text-lg">R$ {selectedRequest.approvedAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                                {selectedRequest.approvedAt && (
                                                    <p className="text-xs text-zinc-500 mt-1">Aprovado em {new Date(selectedRequest.approvedAt).toLocaleString('pt-BR')}</p>
                                                )}
                                                {selectedRequest.counterOfferAccepted ? (
                                                    <div className="flex items-center gap-2 mt-2">
                                                        <span className="bg-green-600 text-white px-2 py-1 rounded text-xs font-bold">
                                                            ✅ CONTRATO ACEITO
                                                        </span>
                                                        {selectedRequest.counterOfferAcceptedAt && selectedRequest.approvedAt && (
                                                            (() => {
                                                                const diff = new Date(selectedRequest.counterOfferAcceptedAt).getTime() - new Date(selectedRequest.approvedAt).getTime();
                                                                const hours = diff / (1000 * 60 * 60);
                                                                return hours < 1 ? (
                                                                    <span className="bg-[#D4AF37] text-black px-2 py-1 rounded text-xs font-bold animate-pulse">
                                                                        ⚡ APROVAÇÃO RÁPIDA ({Math.round(hours * 60)}min)
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-xs text-zinc-500">
                                                                        em {Math.round(hours * 10) / 10}h
                                                                    </span>
                                                                );
                                                            })()
                                                        )}
                                                    </div>
                                                ) : selectedRequest.status === 'PENDING_ACCEPTANCE' ? (
                                                    <span className="inline-block bg-orange-600 text-white px-2 py-1 rounded text-xs font-bold mt-2">
                                                        ⏳ AGUARDANDO ACEITE DO CLIENTE
                                                    </span>
                                                ) : null}
                                            </div>
                                        )}

                                        {isEditing && (
                                            <div className="p-4 rounded-xl border bg-zinc-800 border-[#D4AF37]">
                                                <p className="text-xs text-[#D4AF37] mb-1 uppercase tracking-wide">Parcelas (opcional)</p>
                                                <input
                                                    type="text"
                                                    inputMode="numeric"
                                                    value={editInstallments}
                                                    onChange={e => setEditInstallments(e.target.value.replace(/[^0-9]/g, ''))}
                                                    className="w-full bg-black border border-zinc-700 rounded p-2 text-white font-bold text-lg"
                                                    placeholder="Ex: 4"
                                                />
                                                <p className="text-xs text-zinc-500 mt-1">Deixe 0 se não quiser propor parcelamento</p>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>

                            {/* 📱 Botão WhatsApp - TODOS os tipos de solicitação */}
                            {selectedRequest.phone && (
                                <div className="flex items-center gap-3 p-3 bg-zinc-900 border border-green-500/30 rounded-xl">
                                    <div className="flex-1">
                                        <p className="text-xs text-zinc-500">WhatsApp do Cliente</p>
                                        <p className="text-white font-bold text-sm">{selectedRequest.phone}</p>
                                    </div>
                                    <a
                                        href={`https://wa.me/55${(selectedRequest.phone || '').replace(/\D/g, '')}?text=${encodeURIComponent(`Olá ${selectedRequest.clientName}! Sou da Tubarão Empréstimos. ${selectedRequest.profileType === 'LIMPA_NOME' ? 'Recebi sua solicitação de Limpa Nome e gostaria de falar sobre o andamento do serviço.' : 'Gostaria de falar sobre a sua solicitação de empréstimo.'}`)}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-500 text-white rounded-lg font-bold text-sm transition-all shrink-0"
                                    >
                                        <Phone size={16} /> Chamar
                                    </a>
                                </div>
                            )}

                            {/* Instagram do Cliente */}
                            {selectedRequest.instagram && (
                                <div className="flex items-center gap-3 p-3 bg-zinc-900 border border-pink-500/30 rounded-xl">
                                    <div className="flex-1">
                                        <p className="text-xs text-zinc-500">Instagram</p>
                                        <a href={`https://instagram.com/${selectedRequest.instagram.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="text-pink-400 font-bold text-sm hover:underline">{selectedRequest.instagram}</a>
                                    </div>
                                </div>
                            )}

                            {/* MOTO: Cor Escolhida */}
                            {selectedRequest.profileType === 'MOTO' && (() => {
                                let extraData: any = {};
                                try {
                                    if (selectedRequest.supplementalDescription) {
                                        extraData = JSON.parse(selectedRequest.supplementalDescription);
                                    }
                                } catch { /* ignore */ }

                                if (extraData.motoColor) {
                                    return (
                                        <div className="flex items-center gap-3 p-3 bg-zinc-900 border border-blue-500/30 rounded-xl">
                                            <div className="flex-1">
                                                <p className="text-xs text-zinc-500">Cor da Moto Escolhida</p>
                                                <p className="text-blue-400 font-bold text-sm">{extraData.motoColor}</p>
                                            </div>
                                        </div>
                                    );
                                }
                                return null;
                            })()}

                            {/* Termos e Declarações Aceitas */}
                            {(selectedRequest.contractTermsAccepted || selectedRequest.declarationAccepted) && (
                                <div className="bg-green-900/20 border border-green-600/40 p-4 rounded-xl">
                                    <h3 className="text-green-400 font-bold text-sm uppercase tracking-wider mb-3 flex items-center gap-2">
                                        ✅ Termos Aceitos
                                    </h3>
                                    <div className="space-y-2">
                                        {selectedRequest.contractTermsAccepted && (
                                            <div className="flex items-center gap-2 text-sm">
                                                <Check size={16} className="text-green-400" />
                                                <span className="text-white">Termos do Contrato Aceitos</span>
                                            </div>
                                        )}
                                        {selectedRequest.declarationAccepted && (
                                            <div className="flex items-center gap-2 text-sm">
                                                <Check size={16} className="text-green-400" />
                                                <span className="text-white">Declaração de Veracidade Aceita</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Contrato PDF Download */}
                            {selectedRequest.contractPdfUrl && (
                                <div className="flex items-center gap-3 p-3 bg-zinc-900 border border-emerald-500/30 rounded-xl">
                                    <div className="flex-1">
                                        <p className="text-xs text-zinc-500">Contrato Assinado (PDF)</p>
                                        <p className="text-white font-bold text-sm">Documento gerado automaticamente</p>
                                    </div>
                                    <a
                                        href={selectedRequest.contractPdfUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold text-sm transition-all shrink-0"
                                    >
                                        <Download size={16} /> Baixar PDF
                                    </a>
                                </div>
                            )}

                            {/* Endereço do Cliente */}
                            {(() => {
                                let extraAddr: any = null;
                                try {
                                    if (selectedRequest.supplementalDescription) {
                                        extraAddr = JSON.parse(selectedRequest.supplementalDescription);
                                    }
                                } catch { /* ignore */ }

                                if (extraAddr && (extraAddr.address || extraAddr.cep)) {
                                    return (
                                        <div className="bg-zinc-950 border border-zinc-800 p-4 rounded-xl">
                                            <h3 className="text-[#D4AF37] font-bold text-sm uppercase tracking-wider mb-4 flex items-center gap-2">
                                                <MapPin size={16} /> Endereço do Cliente
                                            </h3>
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                <div className="bg-black p-3 rounded-lg border border-zinc-800 md:col-span-2">
                                                    <p className="text-xs text-zinc-500 uppercase">Endereço</p>
                                                    <p className="font-bold text-white">
                                                        {extraAddr.address || 'N/A'}{extraAddr.number ? `, ${extraAddr.number}` : ''}
                                                    </p>
                                                </div>
                                                <div className="bg-black p-3 rounded-lg border border-zinc-800">
                                                    <p className="text-xs text-zinc-500 uppercase">CEP</p>
                                                    <p className="font-bold text-white">{extraAddr.cep || 'N/A'}</p>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                }
                                return null;
                            })()}

                            {/* Supplemental Docs Section (If Active or Completed) */}
                            {selectedRequest.supplementalInfo && (
                                <div className="bg-blue-900/10 border border-blue-800/50 p-4 rounded-xl">
                                    <h3 className="text-blue-400 font-bold text-sm uppercase tracking-wider mb-2 flex items-center gap-2">
                                        <FileWarning size={16} /> Solicitação de Documento Extra
                                    </h3>
                                    <p className="text-zinc-300 text-sm mb-4">
                                        <strong>Admin pediu:</strong> "{selectedRequest.supplementalInfo.description}"
                                    </p>

                                    {selectedRequest.supplementalInfo.docUrl ? (() => {
                                        // Parse: may be a single URL or a JSON array of URLs
                                        let suppUrls: string[] = [];
                                        try {
                                            const parsed = JSON.parse(selectedRequest.supplementalInfo.docUrl!);
                                            suppUrls = Array.isArray(parsed) ? parsed : [selectedRequest.supplementalInfo.docUrl!];
                                        } catch {
                                            suppUrls = [selectedRequest.supplementalInfo.docUrl!];
                                        }
                                        const videoUrls = suppUrls.filter(u => /\.(mp4|mov|avi|webm|mkv)(\?|$)/i.test(u));
                                        const docUrls = suppUrls.filter(u => !/\.(mp4|mov|avi|webm|mkv)(\?|$)/i.test(u));
                                        return (
                                            <div className="space-y-4">
                                                <p className="text-xs text-zinc-500">
                                                    {suppUrls.length} arquivo{suppUrls.length > 1 ? 's' : ''} enviado{suppUrls.length > 1 ? 's' : ''} pelo cliente:
                                                </p>
                                                {docUrls.length > 0 && (
                                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                        {docUrls.map((url, i) => (
                                                            <DocCard
                                                                key={i}
                                                                title={`Doc. Complementar ${docUrls.length > 1 ? i + 1 : ''}`}
                                                                urls={[url]}
                                                                onView={() => setViewingImage({ urls: docUrls, title: "Doc. Complementar" })}
                                                            />
                                                        ))}
                                                    </div>
                                                )}
                                                {videoUrls.length > 0 && (
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        {videoUrls.map((url, i) => (
                                                            <VideoCard
                                                                key={i}
                                                                title={`Vídeo Complementar ${videoUrls.length > 1 ? i + 1 : ''}`}
                                                                url={url}
                                                            />
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })() : (
                                        <div className="text-yellow-500 text-sm italic">
                                            Aguardando envio do cliente...
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* References Section - hide for LIMPA_NOME */}
                            {selectedRequest.profileType !== 'LIMPA_NOME' && selectedRequest.references && (
                                <div className="bg-zinc-950 border border-zinc-800 p-4 rounded-xl">
                                    <h3 className="text-[#D4AF37] font-bold text-sm uppercase tracking-wider mb-4 flex items-center gap-2">
                                        <Users size={16} /> Referências Pessoais
                                    </h3>
                                    {(() => {
                                        let extraData: any = {};
                                        try {
                                            if (selectedRequest.supplementalDescription) {
                                                extraData = JSON.parse(selectedRequest.supplementalDescription);
                                            }
                                        } catch { /* ignore */ }

                                        const relationshipLabels: Record<string, string> = {
                                            pai: 'Pai', mae: 'Mãe', irmao: 'Irmão(ã)', conjuge: 'Cônjuge',
                                            filho: 'Filho(a)', tio: 'Tio(a)', primo: 'Primo(a)',
                                            amigo: 'Amigo(a)', colega: 'Colega de trabalho', vizinho: 'Vizinho(a)', outro: 'Outro',
                                        };

                                        return (
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div className="bg-black p-3 rounded-lg border border-zinc-800">
                                                    <p className="text-xs text-zinc-500 uppercase mb-1">Referência 1</p>
                                                    {extraData.contactTrust1Name && (
                                                        <p className="font-bold text-white">{extraData.contactTrust1Name}</p>
                                                    )}
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <Phone size={14} className="text-zinc-500" />
                                                        <p className="text-white text-sm">{selectedRequest.references.fatherPhone || 'N/A'}</p>
                                                    </div>
                                                    {extraData.contactTrust1Relationship && (
                                                        <p className="text-xs text-[#D4AF37] mt-1">{relationshipLabels[extraData.contactTrust1Relationship] || extraData.contactTrust1Relationship}</p>
                                                    )}
                                                </div>
                                                <div className="bg-black p-3 rounded-lg border border-zinc-800">
                                                    <p className="text-xs text-zinc-500 uppercase mb-1">Referência 2</p>
                                                    {extraData.contactTrust2Name && (
                                                        <p className="font-bold text-white">{extraData.contactTrust2Name}</p>
                                                    )}
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <Phone size={14} className="text-zinc-500" />
                                                        <p className="text-white text-sm">{selectedRequest.references.motherPhone || 'N/A'}</p>
                                                    </div>
                                                    {extraData.contactTrust2Relationship && (
                                                        <p className="text-xs text-[#D4AF37] mt-1">{relationshipLabels[extraData.contactTrust2Relationship] || extraData.contactTrust2Relationship}</p>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })()}
                                </div>
                            )}

                            {/* Dados Profissionais e Endereço da Empresa */}
                            {selectedRequest.profileType !== 'LIMPA_NOME' && (() => {
                                let extraData: any = {};
                                try {
                                    if (selectedRequest.supplementalDescription) {
                                        extraData = JSON.parse(selectedRequest.supplementalDescription);
                                    }
                                } catch { /* ignore */ }

                                const hasCompanyData = extraData.occupation || extraData.companyAddress || extraData.whatsappPersonal ||
                                                      selectedRequest.companyName || selectedRequest.companyProfession ||
                                                      selectedRequest.companyWorkSince || selectedRequest.companyIncome ||
                                                      extraData.cnpj || extraData.businessAddress;

                                if (!hasCompanyData) return null;

                                return (
                                    <div className="bg-zinc-950 border border-zinc-800 p-4 rounded-xl">
                                        <h3 className="text-[#D4AF37] font-bold text-sm uppercase tracking-wider mb-4">
                                            {selectedRequest.profileType === 'AUTONOMO' ? 'Dados do Negócio' : 'Dados Profissionais'}
                                        </h3>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            {extraData.occupation && (
                                                <div className="bg-black p-3 rounded-lg border border-zinc-800">
                                                    <p className="text-xs text-zinc-500 uppercase">Profissão</p>
                                                    <p className="font-bold text-white">{extraData.occupation}</p>
                                                </div>
                                            )}
                                            {/* AUTONOMO: CNPJ */}
                                            {selectedRequest.profileType === 'AUTONOMO' && extraData.cnpj && (
                                                <div className="bg-black p-3 rounded-lg border border-zinc-800">
                                                    <p className="text-xs text-zinc-500 uppercase">CNPJ do Negócio</p>
                                                    <p className="font-bold text-white">{extraData.cnpj}</p>
                                                </div>
                                            )}
                                            {/* AUTONOMO: Endereço do Comércio */}
                                            {selectedRequest.profileType === 'AUTONOMO' && extraData.businessAddress && (
                                                <div className="bg-black p-3 rounded-lg border border-zinc-800 md:col-span-2">
                                                    <p className="text-xs text-zinc-500 uppercase">Endereço do Comércio</p>
                                                    <p className="font-bold text-white">{extraData.businessAddress}</p>
                                                </div>
                                            )}
                                            {selectedRequest.companyName && (
                                                <div className="bg-black p-3 rounded-lg border border-zinc-800">
                                                    <p className="text-xs text-zinc-500 uppercase">Empresa</p>
                                                    <p className="font-bold text-white">{selectedRequest.companyName}</p>
                                                </div>
                                            )}
                                            {selectedRequest.companyProfession && (
                                                <div className="bg-black p-3 rounded-lg border border-zinc-800">
                                                    <p className="text-xs text-zinc-500 uppercase">Cargo</p>
                                                    <p className="font-bold text-white">{selectedRequest.companyProfession}</p>
                                                </div>
                                            )}
                                            {selectedRequest.companyWorkSince && (
                                                <div className="bg-black p-3 rounded-lg border border-zinc-800">
                                                    <p className="text-xs text-zinc-500 uppercase">Trabalha desde</p>
                                                    <p className="font-bold text-white">{selectedRequest.companyWorkSince}</p>
                                                </div>
                                            )}
                                            {selectedRequest.companyIncome && (
                                                <div className="bg-black p-3 rounded-lg border border-zinc-800">
                                                    <p className="text-xs text-zinc-500 uppercase">Renda da Empresa</p>
                                                    <p className="font-bold text-green-400">R$ {selectedRequest.companyIncome.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                                </div>
                                            )}
                                            {selectedRequest.companyPaymentDay && (
                                                <div className="bg-black p-3 rounded-lg border border-zinc-800">
                                                    <p className="text-xs text-zinc-500 uppercase">Dia do Pagamento</p>
                                                    <p className="font-bold text-white">Dia {selectedRequest.companyPaymentDay}</p>
                                                </div>
                                            )}
                                            {extraData.whatsappPersonal && (
                                                <div className="bg-black p-3 rounded-lg border border-zinc-800">
                                                    <p className="text-xs text-zinc-500 uppercase">WhatsApp Pessoal</p>
                                                    <p className="font-bold text-white">{extraData.whatsappPersonal}</p>
                                                </div>
                                            )}
                                            {extraData.companyAddress && (
                                                <>
                                                    <div className="bg-black p-3 rounded-lg border border-zinc-800 md:col-span-3">
                                                        <p className="text-xs text-zinc-500 uppercase mb-1">Endereço da Empresa</p>
                                                        <p className="font-bold text-white">
                                                            {extraData.companyAddress.street || ''}
                                                            {extraData.companyAddress.number ? `, ${extraData.companyAddress.number}` : ''}
                                                            {extraData.companyAddress.neighborhood ? ` - ${extraData.companyAddress.neighborhood}` : ''}
                                                        </p>
                                                        <p className="text-sm text-zinc-400">
                                                            {extraData.companyAddress.city || ''}{extraData.companyAddress.state ? `/${extraData.companyAddress.state}` : ''}
                                                            {extraData.companyAddress.cep ? ` - CEP: ${extraData.companyAddress.cep}` : ''}
                                                        </p>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* Dados Bancários */}
                            {selectedRequest.profileType !== 'LIMPA_NOME' && (selectedRequest.bankName || selectedRequest.pixKey) && (
                                <div className="bg-zinc-950 border border-zinc-800 p-4 rounded-xl">
                                    <h3 className="text-[#D4AF37] font-bold text-sm uppercase tracking-wider mb-4 flex items-center gap-2">
                                        🏦 Dados Bancários
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        {selectedRequest.bankName && (
                                            <div className="bg-black p-3 rounded-lg border border-zinc-800">
                                                <p className="text-xs text-zinc-500 uppercase">Banco</p>
                                                <p className="font-bold text-white">{selectedRequest.bankName}</p>
                                            </div>
                                        )}
                                        {selectedRequest.bankAgency && (
                                            <div className="bg-black p-3 rounded-lg border border-zinc-800">
                                                <p className="text-xs text-zinc-500 uppercase">Agência</p>
                                                <p className="font-bold text-white">{selectedRequest.bankAgency}</p>
                                            </div>
                                        )}
                                        {selectedRequest.bankAccount && (
                                            <div className="bg-black p-3 rounded-lg border border-zinc-800">
                                                <p className="text-xs text-zinc-500 uppercase">Conta</p>
                                                <p className="font-bold text-white">{selectedRequest.bankAccount}</p>
                                                {selectedRequest.bankAccountType && (
                                                    <p className="text-xs text-zinc-400 mt-1">Tipo: {selectedRequest.bankAccountType}</p>
                                                )}
                                            </div>
                                        )}
                                        {selectedRequest.pixKey && (
                                            <div className="bg-black p-3 rounded-lg border border-zinc-800 md:col-span-2">
                                                <p className="text-xs text-zinc-500 uppercase">Chave PIX</p>
                                                <p className="font-bold text-green-400">{selectedRequest.pixKey}</p>
                                                {selectedRequest.pixKeyType && (
                                                    <p className="text-xs text-zinc-400 mt-1">Tipo: {selectedRequest.pixKeyType}</p>
                                                )}
                                            </div>
                                        )}
                                        {selectedRequest.accountHolderName && (
                                            <div className="bg-black p-3 rounded-lg border border-zinc-800">
                                                <p className="text-xs text-zinc-500 uppercase">Titular da Conta</p>
                                                <p className="font-bold text-white">{selectedRequest.accountHolderName}</p>
                                            </div>
                                        )}
                                        {(() => {
                                            let extraData: any = {};
                                            try {
                                                if (selectedRequest.supplementalDescription) {
                                                    extraData = JSON.parse(selectedRequest.supplementalDescription);
                                                }
                                            } catch { /* ignore */ }

                                            if (extraData.accountHolderCpf) {
                                                return (
                                                    <div className="bg-black p-3 rounded-lg border border-zinc-800">
                                                        <p className="text-xs text-zinc-500 uppercase">CPF do Titular</p>
                                                        <p className="font-bold text-white">{extraData.accountHolderCpf}</p>
                                                    </div>
                                                );
                                            }
                                            return null;
                                        })()}
                                    </div>
                                </div>
                            )}

                            {/* Video Gallery - hide for LIMPA_NOME */}
                            {selectedRequest.profileType !== 'LIMPA_NOME' && selectedRequest.documents && <div className="space-y-4">
                                <h3 className="text-[#D4AF37] font-bold text-sm uppercase tracking-wider border-b border-zinc-800 pb-2 mb-4 flex items-center gap-2">
                                    <Video size={16} /> Validação por Vídeo
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
                                    {selectedRequest.documents?.videoSelfieUrl && (
                                        <VideoCard title="Vídeo de Aceite" url={selectedRequest.documents.videoSelfieUrl} />
                                    )}
                                    {selectedRequest.documents?.videoHouseUrl && (
                                        <VideoCard
                                            title={selectedRequest.profileType === 'AUTONOMO' ? 'Vídeo do Estabelecimento' : 'Vídeo da Residência'}
                                            url={selectedRequest.documents.videoHouseUrl}
                                        />
                                    )}
                                    {selectedRequest.documents?.videoVehicleUrl && (
                                        <VideoCard title="Vídeo do Veículo" url={selectedRequest.documents.videoVehicleUrl} />
                                    )}
                                    {!selectedRequest.documents?.videoSelfieUrl && !selectedRequest.documents?.videoHouseUrl && !selectedRequest.documents?.videoVehicleUrl && (
                                        <div className="text-zinc-500 italic text-sm p-4">Nenhum vídeo anexado.</div>
                                    )}
                                </div>
                            </div>}

                            {/* Document Gallery - hide for LIMPA_NOME */}
                            {selectedRequest.profileType !== 'LIMPA_NOME' && <div className="space-y-6">

                                {/* Personal Documents */}
                                <div>
                                    <h3 className="text-[#D4AF37] font-bold text-sm uppercase tracking-wider border-b border-zinc-800 pb-2 mb-4">Documentação Pessoal</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
                                        <DocCard
                                            title="Selfie (Prova de Vida)"
                                            urls={ensureArray(selectedRequest.documents?.selfieUrl)}
                                            onView={() => setViewingImage({ urls: ensureArray(selectedRequest.documents?.selfieUrl), title: "Selfie" })}
                                        />
                                        <DocCard
                                            title="RG/CNH (Frente)"
                                            urls={ensureArray(selectedRequest.documents?.idCardUrl)}
                                            onView={() => setViewingImage({ urls: ensureArray(selectedRequest.documents?.idCardUrl), title: "RG/CNH Frente" })}
                                        />
                                        <DocCard
                                            title="RG/CNH (Verso)"
                                            urls={ensureArray(selectedRequest.documents?.idCardBackUrl || selectedRequest.documents?.idCardUrl)}
                                            onView={() => setViewingImage({ urls: ensureArray(selectedRequest.documents?.idCardBackUrl || selectedRequest.documents?.idCardUrl), title: "RG/CNH Verso" })}
                                        />
                                    </div>
                                </div>

                                {/* Financial Documents */}
                                <div>
                                    <h3 className="text-[#D4AF37] font-bold text-sm uppercase tracking-wider border-b border-zinc-800 pb-2 mb-4">Comprovantes</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
                                        <DocCard
                                            title="Comp. Residência"
                                            urls={ensureArray(selectedRequest.documents?.proofOfAddressUrl)}
                                            onView={() => setViewingImage({ urls: ensureArray(selectedRequest.documents?.proofOfAddressUrl), title: "Comp. Residência" })}
                                        />
                                        <DocCard
                                            title="Comp. Renda"
                                            urls={ensureArray(selectedRequest.documents?.proofIncomeUrl)}
                                            onView={() => setViewingImage({ urls: ensureArray(selectedRequest.documents?.proofIncomeUrl), title: "Comp. Renda" })}
                                        />
                                        <DocCard
                                            title="Assinatura Digital"
                                            urls={ensureArray(selectedRequest.signatureUrl)}
                                            isSignature
                                            onView={() => setViewingImage({ urls: ensureArray(selectedRequest.signatureUrl), title: "Assinatura" })}
                                        />
                                    </div>
                                </div>

                                {/* CLT: Carteira de Trabalho */}
                                {selectedRequest.profileType === 'CLT' && (() => {
                                    console.log('CLT workCardUrl:', selectedRequest.workCardUrl);
                                    console.log('CLT workCardUrl array:', ensureArray(selectedRequest.workCardUrl));

                                    return (
                                        <div>
                                            <h3 className="text-[#D4AF37] font-bold text-sm uppercase tracking-wider border-b border-zinc-800 pb-2 mb-4">📋 Documentos CLT</h3>
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
                                                {selectedRequest.workCardUrl && ensureArray(selectedRequest.workCardUrl).filter(Boolean).length > 0 ? (
                                                    <DocCard
                                                        title="Carteira de Trabalho (CTPS)"
                                                        urls={ensureArray(selectedRequest.workCardUrl)}
                                                        onView={() => setViewingImage({ urls: ensureArray(selectedRequest.workCardUrl), title: "Carteira de Trabalho" })}
                                                    />
                                                ) : (
                                                    <div className="bg-red-900/20 border border-red-600/40 rounded-lg p-4 md:col-span-3">
                                                        <p className="text-red-400 text-sm font-bold">⚠️ ATENÇÃO: Carteira de Trabalho NÃO foi enviada pelo cliente!</p>
                                                        <p className="text-red-300 text-xs mt-1">Este documento é obrigatório para perfil CLT.</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })()}

                                {/* MOTO/AUTONOMO: CNH */}
                                {(selectedRequest.profileType === 'MOTO' || selectedRequest.profileType === 'AUTONOMO') && selectedRequest.documents?.idCardUrl && ensureArray(selectedRequest.documents.idCardUrl).length > 0 && (
                                    <div>
                                        <h3 className="text-[#D4AF37] font-bold text-sm uppercase tracking-wider border-b border-zinc-800 pb-2 mb-4">🏍️ Habilitação (CNH)</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                            <DocCard
                                                title="CNH (Carteira de Habilitação)"
                                                urls={ensureArray(selectedRequest.documents?.idCardUrl)}
                                                onView={() => setViewingImage({ urls: ensureArray(selectedRequest.documents?.idCardUrl), title: "CNH" })}
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* Vehicle Documents (Conditional) */}
                                {selectedRequest.documents?.vehicleUrl && ensureArray(selectedRequest.documents.vehicleUrl).length > 0 && (
                                    <div>
                                        <h3 className="text-[#D4AF37] font-bold text-sm uppercase tracking-wider border-b border-zinc-800 pb-2 mb-4">Garantia Veicular</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                                            <DocCard
                                                title="Veículo (Fotos)"
                                                urls={ensureArray(selectedRequest.documents?.vehicleUrl)}
                                                onView={() => setViewingImage({ urls: ensureArray(selectedRequest.documents?.vehicleUrl), title: "Veículo (Galeria)" })}
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* SEÇÃO EXTRA: Localização e Dados Adicionais */}
                                {(() => {
                                    // Tentar parsear supplemental_description como JSON
                                    let extraData: any = null;
                                    try {
                                        if (selectedRequest.supplementalDescription) {
                                            extraData = JSON.parse(selectedRequest.supplementalDescription);
                                        }
                                    } catch {
                                        // Se não for JSON, é formato antigo (string)
                                    }

                                    if (extraData && typeof extraData === 'object') {
                                        return (
                                            <div className="space-y-6">
                                                {/* Localização em Tempo Real */}
                                                {extraData.location && (
                                                    <div className="bg-green-900/20 border border-green-600/40 p-4 rounded-xl">
                                                        <h3 className="text-green-400 font-bold text-sm uppercase tracking-wider mb-4 flex items-center gap-2">
                                                            📍 Localização Capturada
                                                        </h3>
                                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                            <div className="bg-black p-3 rounded-lg border border-zinc-800">
                                                                <p className="text-xs text-zinc-500">Latitude</p>
                                                                <p className="font-bold text-white">{extraData.location.latitude?.toFixed(6)}</p>
                                                            </div>
                                                            <div className="bg-black p-3 rounded-lg border border-zinc-800">
                                                                <p className="text-xs text-zinc-500">Longitude</p>
                                                                <p className="font-bold text-white">{extraData.location.longitude?.toFixed(6)}</p>
                                                            </div>
                                                            <div className="bg-black p-3 rounded-lg border border-zinc-800">
                                                                <p className="text-xs text-zinc-500">Precisão</p>
                                                                <p className="font-bold text-white">{extraData.location.accuracy?.toFixed(0)}m</p>
                                                            </div>
                                                        </div>
                                                        <a
                                                            href={`https://www.google.com/maps?q=${extraData.location.latitude},${extraData.location.longitude}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="mt-4 inline-block bg-green-800 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-green-700 transition"
                                                        >
                                                            🗺️ Ver no Google Maps
                                                        </a>
                                                    </div>
                                                )}

                                                {/* Fotos da Casa */}
                                                {extraData.housePhotos && ensureArray(extraData.housePhotos).length > 0 && (
                                                    <div>
                                                        <h3 className="text-[#D4AF37] font-bold text-sm uppercase tracking-wider border-b border-zinc-800 pb-2 mb-4">🏠 Fotos da Residência</h3>
                                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                                            <DocCard
                                                                title="Fachada da Casa"
                                                                urls={ensureArray(extraData.housePhotos)}
                                                                onView={() => setViewingImage({ urls: ensureArray(extraData.housePhotos), title: "Fotos da Residência" })}
                                                            />
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Boleto em Nome do Cliente */}
                                                {extraData.billInName && ensureArray(extraData.billInName).filter(Boolean).length > 0 && (
                                                    <div>
                                                        <h3 className="text-[#D4AF37] font-bold text-sm uppercase tracking-wider border-b border-zinc-800 pb-2 mb-4">🧾 Boleto em Nome do Cliente</h3>
                                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                                            <DocCard
                                                                title="Boleto/Conta em Seu Nome"
                                                                urls={ensureArray(extraData.billInName)}
                                                                onView={() => setViewingImage({ urls: ensureArray(extraData.billInName), title: "Boleto em Nome do Cliente" })}
                                                            />
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Dados da Garantia */}
                                                {extraData.guarantee && (
                                                    <div className="bg-yellow-900/20 border border-yellow-600/40 p-4 rounded-xl">
                                                        <h3 className="text-yellow-400 font-bold text-sm uppercase tracking-wider mb-4 flex items-center gap-2">
                                                            🔒 Garantia do Empréstimo
                                                        </h3>
                                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                                            <div className="bg-black p-3 rounded-lg border border-zinc-800">
                                                                <p className="text-xs text-zinc-500">Tipo</p>
                                                                <p className="font-bold text-white">{extraData.guarantee.type || 'N/A'}</p>
                                                            </div>
                                                            <div className="bg-black p-3 rounded-lg border border-zinc-800">
                                                                <p className="text-xs text-zinc-500">Descrição</p>
                                                                <p className="font-bold text-white">{extraData.guarantee.description || 'N/A'}</p>
                                                            </div>
                                                            <div className="bg-black p-3 rounded-lg border border-zinc-800">
                                                                <p className="text-xs text-zinc-500">Valor Estimado</p>
                                                                <p className="font-bold text-green-400">R$ {extraData.guarantee.estimatedValue || '0'}</p>
                                                            </div>
                                                        </div>
                                                        {extraData.guarantee.video && (
                                                            <VideoCard title="Vídeo da Garantia" url={extraData.guarantee.video} />
                                                        )}
                                                    </div>
                                                )}

                                                {/* Instagram e Profissão */}
                                                {(extraData.instagram || extraData.occupation) && (
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        {extraData.instagram && (
                                                            <div className="bg-black p-3 rounded-lg border border-zinc-800">
                                                                <p className="text-xs text-zinc-500">📷 Instagram</p>
                                                                <a href={`https://instagram.com/${extraData.instagram.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="font-bold text-pink-400 hover:underline">{extraData.instagram}</a>
                                                            </div>
                                                        )}
                                                        {extraData.occupation && (
                                                            <div className="bg-black p-3 rounded-lg border border-zinc-800">
                                                                <p className="text-xs text-zinc-500">💼 Profissão</p>
                                                                <p className="font-bold text-white">{extraData.occupation}</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    }
                                    return null;
                                })()}

                            </div>}
                        </div>

                        {/* Actions Footer */}
                        {(selectedRequest.status === LoanStatus.PENDING || selectedRequest.status === LoanStatus.WAITING_DOCS || selectedRequest.status === 'RETURNING_PENDING') && (
                            <div className="p-4 md:p-6 border-t border-zinc-800 bg-zinc-950 flex flex-col gap-3 md:gap-4 shrink-0">
                                <span className="text-xs text-zinc-500 text-center md:text-left">
                                    {selectedRequest.profileType === 'LIMPA_NOME'
                                        ? 'Ao aprovar, o serviço Limpa Nome será iniciado para este cliente.'
                                        : selectedRequest.profileType === 'MOTO'
                                            ? 'Ao aprovar, o financiamento da moto será confirmado. Verifique entrada e documentos.'
                                            : (selectedRequest.profileType === 'GARANTIA' || selectedRequest.profileType === 'GARANTIA_VEICULO')
                                                ? 'Ao aprovar, o empréstimo com garantia será liberado. Verifique os documentos.'
                                                : 'Se aprovar agora, o saldo será liberado na carteira.'
                                    }
                                </span>
                                <div className="flex flex-col md:flex-row gap-2 md:gap-4 w-full md:w-auto md:ml-auto">
                                    {/* Botão Ativar Contrato - Aparece quando APPROVED */}
                                    {selectedRequest.status === 'APPROVED' && (
                                        <Button
                                            variant="gold"
                                            className="w-full md:w-auto bg-green-600 text-white font-bold hover:bg-green-700"
                                            onClick={openActivationModal}
                                        >
                                            <Check size={18} className="mr-2" /> ATIVAR CONTRATO
                                        </Button>
                                    )}

                                    {/* Botões normais - Aparecem quando PENDING */}
                                    {selectedRequest.status === 'PENDING' && (
                                        <>
                                            {/* Request Doc Button */}
                                            <Button variant="secondary" className="w-full md:w-auto" onClick={() => setIsDocRequestOpen(true)}>
                                                <FileWarning size={18} className="mr-2" /> Solicitar Doc.
                                            </Button>

                                            <Button variant="danger" className="w-full md:w-auto" onClick={() => handleReject(selectedRequest.id)} isLoading={processing === selectedRequest.id}>
                                                <X size={18} className="mr-2" /> REPROVAR
                                            </Button>
                                            <Button variant="gold" className="w-full md:w-auto bg-[#D4AF37] text-black font-bold hover:bg-[#B5942F]" onClick={openApprovalModal} isLoading={processing === selectedRequest.id}>
                                                <Check size={18} className="mr-2" /> {selectedRequest.profileType === 'LIMPA_NOME' ? 'APROVAR SERVIÇO' :
                                                    selectedRequest.profileType === 'MOTO' ? 'APROVAR FINANC.' : 'APROVAR'}
                                            </Button>
                                        </>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Request Document Modal */}
            {isDocRequestOpen && (
                <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-[60] p-4">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md p-4 md:p-6 shadow-2xl animate-in zoom-in duration-200">
                        <div className="flex justify-between items-center mb-4 md:mb-6">
                            <h3 className="text-lg md:text-xl font-bold text-white flex items-center gap-2">
                                <FileWarning size={20} className="text-[#D4AF37]" /> Solicitar Documento
                            </h3>
                            <button onClick={() => setIsDocRequestOpen(false)}><X size={20} className="text-zinc-500 hover:text-white" /></button>
                        </div>

                        <p className="text-zinc-400 text-xs md:text-sm mb-4">
                            O processo mudará para "AGUARDANDO DOC". O cliente receberá uma notificação para enviar o anexo.
                        </p>

                        <textarea
                            value={docRequestDesc}
                            onChange={(e) => setDocRequestDesc(e.target.value)}
                            className="w-full h-32 bg-black border border-zinc-700 rounded-lg p-3 text-sm md:text-base text-white focus:border-[#D4AF37] outline-none resize-none mb-4"
                            placeholder="Ex: Por favor, envie um comprovante de residência atualizado (últimos 60 dias)..."
                        />

                        <Button onClick={handleRequestDoc} isLoading={!!processing} className="w-full">
                            <Send size={18} className="mr-2" /> Enviar Solicitação
                        </Button>
                    </div>
                </div>
            )}

            {/* Approval Modal with Counteroffer */}
            {isApprovalModalOpen && selectedRequest && (
                <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-[60] p-4">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg p-4 md:p-6 shadow-2xl animate-in zoom-in duration-200 max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-4 md:mb-6">
                            <h3 className="text-lg md:text-xl font-bold text-white flex items-center gap-2">
                                <Check size={20} className="text-[#D4AF37]" /> Aprovar Empréstimo
                            </h3>
                            <button onClick={() => setIsApprovalModalOpen(false)}>
                                <X size={20} className="text-zinc-500 hover:text-white" />
                            </button>
                        </div>

                        {/* Valor Solicitado */}
                        <div className="bg-black border border-zinc-800 rounded-xl p-3 md:p-4 mb-4">
                            <p className="text-xs text-zinc-500 mb-1">Valor Solicitado pelo Cliente</p>
                            <p className="text-xl md:text-2xl font-bold text-white">
                                R$ {selectedRequest.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </p>
                            <p className="text-xs text-zinc-500 mt-1">
                                Em {selectedRequest.installments}x parcelas
                            </p>
                        </div>

                        {/* Input Valor Aprovado */}
                        <div className="mb-4 md:mb-6">
                            <label className="block text-sm font-bold text-white mb-2">
                                💰 Valor a Aprovar (Contraproposta)
                            </label>
                            <input
                                type="number"
                                step="0.01"
                                value={approvedAmount}
                                onChange={(e) => setApprovedAmount(e.target.value)}
                                className="w-full bg-black border border-zinc-700 rounded-xl p-3 md:p-4 text-white text-xl md:text-2xl font-bold focus:border-[#D4AF37] outline-none"
                                placeholder="0.00"
                            />
                            <p className="text-xs text-zinc-500 mt-2">
                                💡 Dica: Você pode aprovar um valor menor que o solicitado. O cliente receberá uma notificação para aceitar a contraproposta.
                            </p>
                        </div>

                        {/* Preview da Contraproposta */}
                        {approvedAmount && parseFloat(approvedAmount) > 0 && (
                            <div className="bg-gradient-to-r from-[#D4AF37]/10 to-orange-500/10 border border-[#D4AF37] rounded-xl p-3 md:p-4 mb-4 md:mb-6">
                                <p className="text-xs text-zinc-400 mb-2">Preview da Notificação ao Cliente:</p>
                                <div className="bg-black rounded-lg p-3">
                                    <p className="text-[#D4AF37] font-bold text-sm">🎉 Crédito Pré-Aprovado!</p>
                                    <p className="text-white text-lg font-bold mt-1">
                                        R$ {parseFloat(approvedAmount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </p>
                                    <p className="text-xs text-zinc-500 mt-1">
                                        Cliente precisa aceitar o contrato para liberar o saldo
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Botões */}
                        <div className="flex flex-col md:flex-row gap-3">
                            <Button
                                variant="secondary"
                                className="w-full md:flex-1"
                                onClick={() => setIsApprovalModalOpen(false)}
                            >
                                Cancelar
                            </Button>
                            <Button
                                variant="gold"
                                className="w-full md:flex-1 bg-[#D4AF37] text-black font-bold hover:bg-[#B5942F]"
                                onClick={handleApproveWithCounteroffer}
                                isLoading={!!processing}
                                disabled={!approvedAmount || parseFloat(approvedAmount) <= 0}
                            >
                                <Check size={18} className="mr-2" /> Confirmar Aprovação
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Contract Activation Modal (FASE 2) */}
            {isActivationModalOpen && selectedRequest && (
                <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-[60] p-0 md:p-4 overflow-y-auto">
                    <div className="bg-zinc-900 border-0 md:border border-zinc-800 md:rounded-2xl w-full max-w-2xl h-full md:h-auto md:max-h-[90vh] p-4 md:p-6 shadow-2xl animate-in zoom-in duration-200 overflow-y-auto">
                        <div className="flex justify-between items-center mb-4 md:mb-6 sticky top-0 bg-zinc-900 pb-4 border-b border-zinc-800 md:static md:border-0">
                            <h3 className="text-lg md:text-xl font-bold text-white flex items-center gap-2">
                                <Check size={20} className="text-green-500" /> Ativar Contrato
                            </h3>
                            <button onClick={() => setIsActivationModalOpen(false)}>
                                <X size={20} className="text-zinc-500 hover:text-white" />
                            </button>
                        </div>

                        {/* Info da Solicitação */}
                        <div className="bg-black border border-zinc-800 rounded-xl p-3 md:p-4 mb-4 md:mb-6">
                            <p className="text-xs text-zinc-500 mb-2">Cliente</p>
                            <p className="text-base md:text-lg font-bold text-white">{selectedRequest.clientName}</p>
                            <p className="text-xs text-zinc-400 mt-1">{selectedRequest.email} • {selectedRequest.phone}</p>
                        </div>

                        <div className="space-y-4 pb-4">
                            {/* Valor Principal */}
                            <div>
                                <label className="block text-sm font-bold text-white mb-2">
                                    Valor Principal (R$) *
                                </label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={contractData.principalAmount}
                                    onChange={(e) => setContractData(prev => ({ ...prev, principalAmount: e.target.value }))}
                                    className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white focus:border-[#D4AF37] outline-none"
                                    placeholder="Ex: 5000.00"
                                />
                            </div>

                            {/* Frequência de Pagamento */}
                            <div>
                                <label className="block text-sm font-bold text-white mb-2">
                                    Frequência de Pagamento *
                                </label>
                                <select
                                    value={contractData.paymentFrequency}
                                    onChange={(e) => setContractData(prev => ({ ...prev, paymentFrequency: e.target.value }))}
                                    className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white focus:border-[#D4AF37] outline-none"
                                >
                                    <option value="MONTHLY">Mensal</option>
                                    <option value="WEEKLY">Semanal</option>
                                    <option value="DAILY">Diária (Comércio)</option>
                                </select>
                            </div>

                            {/* Valor da Diária (se DAILY) */}
                            {contractData.paymentFrequency === 'DAILY' && (
                                <div>
                                    <label className="block text-sm font-bold text-white mb-2">
                                        Valor da Diária (R$)
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={contractData.dailyInstallmentAmount}
                                        onChange={(e) => setContractData(prev => ({ ...prev, dailyInstallmentAmount: e.target.value }))}
                                        className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white focus:border-[#D4AF37] outline-none"
                                        placeholder="Ex: 166.67"
                                    />
                                </div>
                            )}

                            {/* Total de Parcelas */}
                            <div>
                                <label className="block text-sm font-bold text-white mb-2">
                                    Total de Parcelas/Diárias *
                                </label>
                                <input
                                    type="number"
                                    value={contractData.totalInstallments}
                                    onChange={(e) => setContractData(prev => ({ ...prev, totalInstallments: e.target.value }))}
                                    className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white focus:border-[#D4AF37] outline-none"
                                    placeholder="Ex: 30"
                                />
                            </div>

                            {/* Data do Primeiro Pagamento */}
                            <div>
                                <label className="block text-sm font-bold text-white mb-2">
                                    Data do Primeiro Pagamento *
                                </label>
                                <input
                                    type="date"
                                    value={contractData.firstPaymentDate}
                                    onChange={(e) => setContractData(prev => ({ ...prev, firstPaymentDate: e.target.value }))}
                                    className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white focus:border-[#D4AF37] outline-none"
                                />
                            </div>

                            {/* Dia de Vencimento (se MONTHLY) */}
                            {contractData.paymentFrequency === 'MONTHLY' && (
                                <div>
                                    <label className="block text-sm font-bold text-white mb-2">
                                        Dia de Vencimento
                                    </label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="31"
                                        value={contractData.dueDay}
                                        onChange={(e) => setContractData(prev => ({ ...prev, dueDay: e.target.value }))}
                                        className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white focus:border-[#D4AF37] outline-none"
                                        placeholder="Ex: 10"
                                    />
                                </div>
                            )}

                            {/* Taxa de Juros */}
                            <div>
                                <label className="block text-sm font-bold text-white mb-2">
                                    Taxa de Juros (% ao mês)
                                </label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={contractData.interestRate}
                                    onChange={(e) => setContractData(prev => ({ ...prev, interestRate: e.target.value }))}
                                    className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white focus:border-[#D4AF37] outline-none"
                                    placeholder="Ex: 30"
                                />
                            </div>

                            {/* Upload Comprovante PIX */}
                            <div>
                                <label className="block text-sm font-bold text-white mb-2">
                                    Comprovante de PIX * (OBRIGATÓRIO)
                                </label>
                                <div className="border-2 border-dashed border-zinc-700 rounded-lg p-6 text-center hover:border-[#D4AF37] transition-colors">
                                    {contractData.pixReceiptUrl ? (
                                        <div className="space-y-3">
                                            <img
                                                src={contractData.pixReceiptUrl}
                                                alt="Comprovante PIX"
                                                className="max-h-40 mx-auto rounded-lg border border-zinc-700"
                                            />
                                            <button
                                                onClick={() => setContractData(prev => ({ ...prev, pixReceiptUrl: '' }))}
                                                className="text-red-400 text-sm hover:text-red-300"
                                            >
                                                Remover
                                            </button>
                                        </div>
                                    ) : (
                                        <label className="cursor-pointer">
                                            <input
                                                type="file"
                                                accept="image/*,.pdf"
                                                onChange={handlePixUpload}
                                                className="hidden"
                                                disabled={uploadingPix}
                                            />
                                            <div className="flex flex-col items-center gap-2">
                                                <FileText size={32} className="text-zinc-500" />
                                                <p className="text-sm text-zinc-400">
                                                    {uploadingPix ? 'Carregando...' : 'Clique para anexar o comprovante'}
                                                </p>
                                                <p className="text-xs text-zinc-600">PNG, JPG ou PDF (máx 5MB)</p>
                                            </div>
                                        </label>
                                    )}
                                </div>
                            </div>

                            {/* Observações */}
                            <div>
                                <label className="block text-sm font-bold text-white mb-2">
                                    Observações do Admin
                                </label>
                                <textarea
                                    value={contractData.adminNotes}
                                    onChange={(e) => setContractData(prev => ({ ...prev, adminNotes: e.target.value }))}
                                    className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white focus:border-[#D4AF37] outline-none resize-none"
                                    rows={3}
                                    placeholder="Observações internas sobre o contrato..."
                                />
                            </div>
                        </div>

                        {/* Botões */}
                        <div className="flex gap-3 mt-6">
                            <Button
                                variant="secondary"
                                className="flex-1"
                                onClick={() => setIsActivationModalOpen(false)}
                            >
                                Cancelar
                            </Button>
                            <Button
                                variant="gold"
                                className="flex-1 bg-green-600 text-white font-bold hover:bg-green-700"
                                onClick={handleActivateContract}
                                isLoading={!!processing}
                                disabled={!contractData.principalAmount || !contractData.totalInstallments || !contractData.firstPaymentDate || !contractData.pixReceiptUrl}
                            >
                                <Check size={18} className="mr-2" /> Confirmar e Ativar Contrato
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Full Screen Image Viewer */}
            {viewingImage && (
                <ImageViewer
                    urls={viewingImage.urls}
                    title={viewingImage.title}
                    onClose={() => setViewingImage(null)}
                />
            )}
        </div>
    );
};

// --- Local Components (Reused/Shared logic) ---

const InfoBox = ({ label, value, highlight }: any) => (
    <div className={`p-3 md:p-4 rounded-xl border ${highlight ? 'bg-zinc-800 border-[#D4AF37]/50' : 'bg-black border-zinc-800'}`}>
        <p className="text-[10px] md:text-xs text-zinc-500 mb-1 uppercase tracking-wide">{label}</p>
        <p className={`font-bold text-sm md:text-base truncate ${highlight ? 'text-[#D4AF37]' : 'text-white'}`}>{value}</p>
    </div>
);

const VideoCard = ({ title, url }: { title: string, url: string }) => {
    // Validar se a URL é válida (começa com http/https)
    const isValidUrl = url && (url.startsWith('http://') || url.startsWith('https://'));

    return (
        <div className="space-y-2 group">
            <p className="text-xs text-zinc-400 pl-1">{title}</p>
            {!isValidUrl && url ? (
                <div className="rounded-xl border-2 border-red-600 bg-red-900/20 p-4">
                    <div className="flex items-center gap-2 text-red-400 mb-2">
                        <AlertTriangle size={20} />
                        <p className="font-bold text-sm">⚠️ Erro de Upload: Caminho Inválido</p>
                    </div>
                    <p className="text-xs text-red-300 mb-2">
                        O arquivo não foi enviado corretamente para o Cloudflare R2.
                    </p>
                    <p className="text-xs text-zinc-400 font-mono bg-black p-2 rounded break-all">
                        {url}
                    </p>
                </div>
            ) : (
                <div className="rounded-xl border border-zinc-800 bg-black overflow-hidden relative aspect-video">
                    {url ? (
                        <video
                            src={url}
                            controls
                            playsInline
                            preload="metadata"
                            className="w-full h-full object-contain"
                    onError={(e) => {
                        const target = e.target as HTMLVideoElement;
                        target.style.display = 'none';
                        if (target.parentElement) {
                            target.parentElement.innerHTML = `
                                <div class="w-full h-full flex items-center justify-center text-zinc-500 text-sm flex-col gap-3 p-4">
                                    <span>Vídeo não carregou</span>
                                    <a href="${url}" target="_blank" rel="noopener noreferrer" class="bg-[#D4AF37] text-black px-4 py-2 rounded-lg text-sm font-bold hover:opacity-80">📺 Abrir Vídeo</a>
                                    <span class="text-[10px] text-zinc-600">Se o vídeo não abrir, verifique se o arquivo foi enviado corretamente</span>
                                </div>
                            `;
                        }
                    }}
                />
            ) : (
                <div className="w-full h-full flex items-center justify-center text-zinc-600 text-sm">
                    Nenhum vídeo disponível
                </div>
            )}
        </div>
        {/* Link direto para baixar/abrir - sempre visível */}
        {url && (
            <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-[#D4AF37] hover:underline flex items-center gap-1"
            >
                📥 Baixar / Abrir em nova aba
            </a>
        )}
    </div>
);

const DocCard = ({ title, urls, isSignature, onView }: { title: string, urls: string[], isSignature?: boolean, onView: () => void }) => {
    // Validar URL
    const firstUrl = urls.length > 0 ? urls[0] : '';
    const isValidUrl = firstUrl && (firstUrl.startsWith('http://') || firstUrl.startsWith('https://'));

    // Detectar PDF: verifica extensão .pdf, content-type, ou se é work_card
    const isPdf = firstUrl && (
        firstUrl.toLowerCase().includes('.pdf') ||
        firstUrl.toLowerCase().includes('work_card') ||
        firstUrl.toLowerCase().includes('work-card') ||
        title.toLowerCase().includes('carteira') ||
        title.toLowerCase().includes('ctps')
    );

    // Debug log
    console.log('DocCard:', { title, url: firstUrl, isPdf, isValidUrl });

    return (
        <div className="space-y-2 group">
            <p className="text-xs text-zinc-400 pl-1">{title}</p>
            <div className={`rounded-xl border border-zinc-800 bg-black overflow-hidden relative ${isSignature ? 'h-24 bg-white/5' : 'aspect-[4/3]'}`}>
                {!isValidUrl && firstUrl ? (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-3 p-4 bg-red-900/20 border-2 border-red-600">
                        <AlertTriangle size={48} className="text-red-400" />
                        <div className="text-center space-y-2">
                            <p className="font-bold text-sm text-red-400">⚠️ Erro de Upload: Caminho Inválido</p>
                            <p className="text-xs text-red-300">
                                O arquivo não foi enviado corretamente para o Cloudflare R2.
                            </p>
                            <p className="text-xs text-zinc-500 mt-2">Caminho salvo:</p>
                            <p className="text-[10px] text-zinc-400 font-mono bg-black p-2 rounded break-all max-w-full">
                                {firstUrl}
                            </p>
                        </div>
                    </div>
                ) : urls.length > 0 ? (
                    isPdf ? (
                        <div className="w-full h-full flex flex-col items-center justify-center gap-3 p-4 bg-zinc-900">
                            <FileText size={48} className="text-red-500" />
                            <p className="text-xs text-zinc-400 text-center font-bold">Documento PDF</p>
                            <p className="text-[10px] text-zinc-600 text-center break-all px-2">{firstUrl.split('/').pop()}</p>
                            <a
                                href={firstUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm font-bold transition-all shadow-lg"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <ExternalLink size={14} /> Abrir PDF
                            </a>
                        </div>
                    ) : (
                        <img src={firstUrl} className={`w-full h-full ${isSignature ? 'object-contain p-2' : 'object-cover'} group-hover:scale-105 transition-transform duration-500 opacity-80 group-hover:opacity-100`} alt={title} />
                    )
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-zinc-600 text-xs">Pendente</div>
                )}

                {/* Multi-page badge */}
                {urls.length > 1 && (
                    <div className="absolute top-2 right-2 bg-black/70 border border-zinc-700 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-1 rounded-md flex items-center gap-1">
                        <Layers size={10} className="text-[#D4AF37]" /> +{urls.length - 1}
                    </div>
                )}

                {urls.length > 0 && !isPdf && isValidUrl && (
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer" onClick={onView}>
                        <Button size="sm" variant="secondary" className="shadow-xl"><Maximize size={14} className="mr-1" /> Ampliar</Button>
                    </div>
                )}
            </div>
        </div>
    );
};
