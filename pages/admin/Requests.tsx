


import React, { useState, useEffect } from 'react';
import { Check, X, Eye, Maximize, Layers, Download, Filter, Video, Users, Phone, FileWarning, Send, AlertTriangle } from 'lucide-react';
import { Button } from '../../components/Button';
import { supabaseService } from '../../services/supabaseService';
import { emailService } from '../../services/emailService';
import { LoanRequest, LoanStatus } from '../../types';
import { ImageViewer } from '../../components/ImageViewer';
import { useToast } from '../../components/Toast';

// Cores dos perfis para badges coloridas
const PROFILE_COLORS: Record<string, { bg: string; text: string; label: string }> = {
    CLT: { bg: 'bg-gray-600', text: 'text-white', label: 'CLT' },
    AUTONOMO: { bg: 'bg-green-600', text: 'text-white', label: 'Comércio' },
    MOTO: { bg: 'bg-yellow-500', text: 'text-black', label: 'Moto' },
    GARANTIA: { bg: 'bg-orange-500', text: 'text-white', label: '🔒 Garantia' },
    LIMPA_NOME: { bg: 'bg-purple-600', text: 'text-white', label: 'Limpa Nome' },
    GARANTIA_VEICULO: { bg: 'bg-orange-500', text: 'text-white', label: '🚗 Veículo' },
};

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

    // Editing Values
    const [isEditing, setIsEditing] = useState(false);
    const [editAmount, setEditAmount] = useState(0);
    const [editInstallments, setEditInstallments] = useState(0);

    // Filters
    const [filterStatus, setFilterStatus] = useState<string>('ALL');

    useEffect(() => {
        loadRequests();
    }, []);

    const loadRequests = async () => {
        const data = await supabaseService.getRequests();
        setRequests(data);
    };

    const handleApprove = async (id: string) => {
        if (!selectedRequest) return;
        setProcessing(id);
        await supabaseService.approveLoan(id);

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

    const handleReject = async (id: string) => {
        if (!selectedRequest) return;
        setProcessing(id);
        await supabaseService.rejectLoan(id);

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
        await supabaseService.requestSupplementalDoc(selectedRequest.id, docRequestDesc);

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

    const filteredRequests = requests.filter(req =>
        filterStatus === 'ALL' ? true : req.status === filterStatus
    );

    return (
        <div className="p-4 md:p-8 bg-black min-h-screen text-white">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <h1 className="text-3xl font-bold text-[#D4AF37]">Histórico</h1>
                <Button onClick={handleExportCSV} variant="secondary" className="w-full md:w-auto bg-zinc-900 border border-zinc-800 hover:border-[#D4AF37]">
                    <Download size={18} className="mr-2" /> Exportar CSV
                </Button>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-2 mb-6">
                {['ALL', LoanStatus.RETURNING_PENDING, LoanStatus.PENDING, LoanStatus.WAITING_DOCS, LoanStatus.APPROVED, LoanStatus.REJECTED].map((status) => (
                    <button
                        key={status}
                        onClick={() => setFilterStatus(status)}
                        className={`px-4 py-2 rounded-full text-xs font-bold transition-colors border ${filterStatus === status
                            ? 'bg-[#D4AF37] text-black border-[#D4AF37]'
                            : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white'
                            }`}
                    >
                        {status === 'ALL' ? 'Todos' :
                            status === LoanStatus.RETURNING_PENDING ? '🔄 Cliente Antigo' :
                                status === LoanStatus.WAITING_DOCS ? 'Aguardando Doc.' : status}
                    </button>
                ))}
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-left min-w-[800px]">
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
                                    <tr key={req.id} className={`hover:bg-zinc-800/50 transition-colors ${(req as any).profileType === 'GARANTIA' ? 'border-l-4 border-l-orange-500' : ''}`}>
                                        <td className="p-4">
                                            <div className="font-medium text-white">{req.clientName}</div>
                                            <div className="text-xs text-zinc-500">{req.cpf}</div>
                                        </td>
                                        <td className="p-4">
                                            {getProfileBadge((req as any).profileType)}
                                            {(req as any).profileType === 'GARANTIA' && (
                                                <div className="mt-1">
                                                    <AlertTriangle size={12} className="inline text-orange-400" />
                                                    <span className="text-xs text-orange-400 ml-1">Conferir docs</span>
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-4 font-bold text-[#D4AF37]">
                                            {(req as any).profileType === 'LIMPA_NOME'
                                                ? <span className="text-purple-400">Serviço</span>
                                                : `R$ ${req.amount?.toLocaleString() || '0'}`
                                            }
                                        </td>

                                        <td className="p-4">
                                            <span className={`px-2 py-1 rounded-full text-xs font-bold ${req.status === LoanStatus.APPROVED ? 'bg-green-900/30 text-green-400' :
                                                req.status === LoanStatus.REJECTED ? 'bg-red-900/30 text-red-400' :
                                                    req.status === LoanStatus.WAITING_DOCS ? 'bg-blue-900/30 text-blue-400' :
                                                        req.status === 'RETURNING_PENDING' ? 'bg-emerald-900/30 text-emerald-400 border border-emerald-700' :
                                                            'bg-yellow-900/30 text-yellow-400'
                                                }`}>
                                                {req.status === LoanStatus.WAITING_DOCS ? 'AGUARDANDO DOC' :
                                                    req.status === 'RETURNING_PENDING' ? '🔄 CLIENTE ANTIGO' : req.status}
                                            </span>
                                        </td>
                                        <td className="p-4 text-zinc-500 text-sm">
                                            {new Date(req.date).toLocaleDateString()}
                                        </td>
                                        <td className="p-4">
                                            <Button variant="secondary" size="sm" className="py-1 px-3" onClick={() => {
                                                setSelectedRequest(req);
                                                setEditAmount(req.amount);
                                                setEditInstallments(req.installments);
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

            {/* Advanced Review Modal */}
            {selectedRequest && (
                <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-50 p-0 md:p-4">
                    <div className="bg-zinc-900 border border-zinc-800 md:rounded-2xl w-full max-w-6xl h-full md:max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-in fade-in zoom-in duration-200">

                        {/* Header */}
                        <div className="flex justify-between items-center p-6 border-b border-zinc-800 bg-zinc-950">
                            <div>
                                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                                    {(selectedRequest as any).profileType === 'LIMPA_NOME' ? 'Análise de Serviço' : 'Análise de Crédito'}
                                    <span className={`text-xs px-2 py-1 rounded-full border ${selectedRequest.status === LoanStatus.APPROVED ? 'bg-green-900/30 text-green-500 border-green-800' :
                                        selectedRequest.status === LoanStatus.REJECTED ? 'bg-red-900/30 text-red-500 border-red-800' :
                                            selectedRequest.status === LoanStatus.WAITING_DOCS ? 'bg-blue-900/30 text-blue-500 border-blue-800' :
                                                selectedRequest.status === 'RETURNING_PENDING' ? 'bg-emerald-900/30 text-emerald-400 border-emerald-800' :
                                                    'bg-yellow-900/30 text-yellow-500 border-yellow-800'
                                        }`}>
                                        {selectedRequest.status === 'RETURNING_PENDING' ? '🔄 CLIENTE ANTIGO' : selectedRequest.status}
                                    </span>
                                </h2>
                                <p className="text-zinc-400 text-sm mt-1 flex items-center gap-2">
                                    ID: {selectedRequest.id} • {selectedRequest.email} {getProfileBadge((selectedRequest as any).profileType)}
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                {!isEditing && (selectedRequest as any).profileType !== 'LIMPA_NOME' && (selectedRequest.status === LoanStatus.PENDING || selectedRequest.status === 'RETURNING_PENDING') && (
                                    <Button size="sm" variant="secondary" onClick={() => setIsEditing(true)}>
                                        ✏️ Editar Valores
                                    </Button>
                                )}
                                {isEditing && (
                                    <>
                                        <Button size="sm" variant="danger" onClick={() => setIsEditing(false)}>Cancelar</Button>
                                        <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={async () => {
                                            if (editAmount <= 0 || editInstallments <= 0) {
                                                addToast('Valores inválidos', 'error');
                                                return;
                                            }
                                            setProcessing('saving');
                                            const success = await supabaseService.updateLoanRequestValues(selectedRequest.id, editAmount, editInstallments);
                                            if (success) {
                                                addToast('Proposta atualizada!', 'success');
                                                setSelectedRequest({ ...selectedRequest, amount: editAmount, installments: editInstallments });
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
                        <div className="flex-1 overflow-y-auto p-6 space-y-8">

                            {/* Financial Summary */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <InfoBox label="Cliente" value={selectedRequest.clientName} />
                                <InfoBox label="CPF" value={selectedRequest.cpf} />

                                {(selectedRequest as any).profileType === 'LIMPA_NOME' ? (
                                    <>
                                        <InfoBox label="Serviço" value="Limpa Nome" highlight />
                                        <InfoBox label="Contrato Assinado" value={(selectedRequest as any).limpaNomeContractSigned ? '✅ Sim' : '❌ Não'} />
                                    </>
                                ) : (
                                    <>
                                        {isEditing ? (
                                            <div className="p-4 rounded-xl border bg-zinc-800 border-[#D4AF37]">
                                                <p className="text-xs text-[#D4AF37] mb-1 uppercase tracking-wide">Valor (R$)</p>
                                                <input
                                                    type="number"
                                                    value={editAmount}
                                                    onChange={e => setEditAmount(Number(e.target.value))}
                                                    className="w-full bg-black border border-zinc-700 rounded p-2 text-white font-bold text-lg"
                                                />
                                            </div>
                                        ) : (
                                            <InfoBox label="Valor Solicitado" value={`R$ ${selectedRequest.amount.toLocaleString()}`} highlight />
                                        )}

                                        {isEditing && (
                                            <div className="p-4 rounded-xl border bg-zinc-800 border-[#D4AF37]">
                                                <p className="text-xs text-[#D4AF37] mb-1 uppercase tracking-wide">Parcelas (opcional)</p>
                                                <input
                                                    type="number"
                                                    value={editInstallments}
                                                    onChange={e => setEditInstallments(Number(e.target.value))}
                                                    className="w-full bg-black border border-zinc-700 rounded p-2 text-white font-bold text-lg"
                                                    placeholder="Ex: 4"
                                                />
                                                <p className="text-xs text-zinc-500 mt-1">Deixe 0 se não quiser propor parcelamento</p>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>

                            {/* Supplemental Docs Section (If Active or Completed) */}
                            {selectedRequest.supplementalInfo && (
                                <div className="bg-blue-900/10 border border-blue-800/50 p-4 rounded-xl">
                                    <h3 className="text-blue-400 font-bold text-sm uppercase tracking-wider mb-2 flex items-center gap-2">
                                        <FileWarning size={16} /> Solicitação de Documento Extra
                                    </h3>
                                    <p className="text-zinc-300 text-sm mb-4">
                                        <strong>Admin pediu:</strong> "{selectedRequest.supplementalInfo.description}"
                                    </p>

                                    {selectedRequest.supplementalInfo.docUrl ? (
                                        <div className="bg-black p-4 rounded-lg border border-zinc-800 w-fit">
                                            <p className="text-xs text-zinc-500 mb-2">Documento Enviado pelo Cliente:</p>
                                            <DocCard
                                                title="Doc. Complementar"
                                                urls={[selectedRequest.supplementalInfo.docUrl]}
                                                onView={() => setViewingImage({ urls: [selectedRequest.supplementalInfo.docUrl!], title: "Doc. Complementar" })}
                                            />
                                        </div>
                                    ) : (
                                        <div className="text-yellow-500 text-sm italic">
                                            Aguardando envio do cliente...
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* References Section - hide for LIMPA_NOME */}
                            {(selectedRequest as any).profileType !== 'LIMPA_NOME' && selectedRequest.references && (
                                <div className="bg-zinc-950 border border-zinc-800 p-4 rounded-xl">
                                    <h3 className="text-[#D4AF37] font-bold text-sm uppercase tracking-wider mb-4 flex items-center gap-2">
                                        <Users size={16} /> Referências Pessoais
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div className="flex items-center gap-2 bg-black p-3 rounded-lg border border-zinc-800">
                                            <Phone size={16} className="text-zinc-500" />
                                            <div>
                                                <p className="text-xs text-zinc-500 uppercase">Pai</p>
                                                <p className="font-bold text-white">{selectedRequest.references.fatherPhone || 'N/A'}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 bg-black p-3 rounded-lg border border-zinc-800">
                                            <Phone size={16} className="text-zinc-500" />
                                            <div>
                                                <p className="text-xs text-zinc-500 uppercase">Mãe</p>
                                                <p className="font-bold text-white">{selectedRequest.references.motherPhone || 'N/A'}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 bg-black p-3 rounded-lg border border-zinc-800">
                                            <Phone size={16} className="text-zinc-500" />
                                            <div>
                                                <p className="text-xs text-zinc-500 uppercase">Cônjuge</p>
                                                <p className="font-bold text-white">{selectedRequest.references.spousePhone || 'N/A'}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Video Gallery - hide for LIMPA_NOME */}
                            {(selectedRequest as any).profileType !== 'LIMPA_NOME' && <div className="space-y-4">
                                <h3 className="text-[#D4AF37] font-bold text-sm uppercase tracking-wider border-b border-zinc-800 pb-2 mb-4 flex items-center gap-2">
                                    <Video size={16} /> Validação por Vídeo
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    {selectedRequest.documents.videoSelfieUrl && (
                                        <VideoCard title="Vídeo do Usuário" url={selectedRequest.documents.videoSelfieUrl} />
                                    )}
                                    {selectedRequest.documents.videoHouseUrl && (
                                        <VideoCard title="Vídeo da Casa" url={selectedRequest.documents.videoHouseUrl} />
                                    )}
                                    {selectedRequest.documents.videoVehicleUrl && (
                                        <VideoCard title="Vídeo do Veículo" url={selectedRequest.documents.videoVehicleUrl} />
                                    )}
                                    {!selectedRequest.documents.videoSelfieUrl && (
                                        <div className="text-zinc-500 italic text-sm p-4">Nenhum vídeo anexado.</div>
                                    )}
                                </div>
                            </div>}

                            {/* Document Gallery - hide for LIMPA_NOME */}
                            {(selectedRequest as any).profileType !== 'LIMPA_NOME' && <div className="space-y-6">

                                {/* Personal Documents */}
                                <div>
                                    <h3 className="text-[#D4AF37] font-bold text-sm uppercase tracking-wider border-b border-zinc-800 pb-2 mb-4">Documentação Pessoal</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                        <DocCard
                                            title="Selfie (Prova de Vida)"
                                            urls={ensureArray(selectedRequest.documents.selfieUrl)}
                                            onView={() => setViewingImage({ urls: ensureArray(selectedRequest.documents.selfieUrl), title: "Selfie" })}
                                        />
                                        <DocCard
                                            title="RG/CNH (Frente)"
                                            urls={ensureArray(selectedRequest.documents.idCardUrl)}
                                            onView={() => setViewingImage({ urls: ensureArray(selectedRequest.documents.idCardUrl), title: "RG/CNH Frente" })}
                                        />
                                        <DocCard
                                            title="RG/CNH (Verso)"
                                            urls={ensureArray(selectedRequest.documents.idCardBackUrl || selectedRequest.documents.idCardUrl)}
                                            onView={() => setViewingImage({ urls: ensureArray(selectedRequest.documents.idCardBackUrl || selectedRequest.documents.idCardUrl), title: "RG/CNH Verso" })}
                                        />
                                    </div>
                                </div>

                                {/* Financial Documents */}
                                <div>
                                    <h3 className="text-[#D4AF37] font-bold text-sm uppercase tracking-wider border-b border-zinc-800 pb-2 mb-4">Comprovantes</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                        <DocCard
                                            title="Comp. Residência"
                                            urls={ensureArray(selectedRequest.documents.proofOfAddressUrl)}
                                            onView={() => setViewingImage({ urls: ensureArray(selectedRequest.documents.proofOfAddressUrl), title: "Comp. Residência" })}
                                        />
                                        <DocCard
                                            title="Comp. Renda"
                                            urls={ensureArray(selectedRequest.documents.proofIncomeUrl)}
                                            onView={() => setViewingImage({ urls: ensureArray(selectedRequest.documents.proofIncomeUrl), title: "Comp. Renda" })}
                                        />
                                        <DocCard
                                            title="Assinatura Digital"
                                            urls={ensureArray(selectedRequest.signatureUrl)}
                                            isSignature
                                            onView={() => setViewingImage({ urls: ensureArray(selectedRequest.signatureUrl), title: "Assinatura" })}
                                        />
                                    </div>
                                </div>

                                {/* Vehicle Documents (Conditional) */}
                                {selectedRequest.documents.vehicleUrl && ensureArray(selectedRequest.documents.vehicleUrl).length > 0 && (
                                    <div>
                                        <h3 className="text-[#D4AF37] font-bold text-sm uppercase tracking-wider border-b border-zinc-800 pb-2 mb-4">Garantia Veicular</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                                            <DocCard
                                                title="Veículo (Fotos)"
                                                urls={ensureArray(selectedRequest.documents.vehicleUrl)}
                                                onView={() => setViewingImage({ urls: ensureArray(selectedRequest.documents.vehicleUrl), title: "Veículo (Galeria)" })}
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
                            <div className="p-6 border-t border-zinc-800 bg-zinc-950 flex flex-col md:flex-row justify-between items-center gap-4">
                                <span className="text-xs text-zinc-500 text-center md:text-left">
                                    {(selectedRequest as any).profileType === 'LIMPA_NOME'
                                        ? 'Ao aprovar, o serviço Limpa Nome será iniciado para este cliente.'
                                        : 'Se aprovar agora, o saldo será liberado na carteira.'
                                    }
                                </span>
                                <div className="flex gap-4 w-full md:w-auto">
                                    {/* Request Doc Button */}
                                    <Button variant="secondary" className="flex-1 md:flex-initial" onClick={() => setIsDocRequestOpen(true)}>
                                        <FileWarning size={18} className="mr-2" /> Solicitar Doc.
                                    </Button>

                                    <Button variant="danger" className="flex-1 md:flex-initial" onClick={() => handleReject(selectedRequest.id)} isLoading={processing === selectedRequest.id}>
                                        <X size={18} className="mr-2" /> REPROVAR
                                    </Button>
                                    <Button variant="gold" className="flex-1 md:flex-initial bg-[#D4AF37] text-black font-bold hover:bg-[#B5942F]" onClick={() => handleApprove(selectedRequest.id)} isLoading={processing === selectedRequest.id}>
                                        <Check size={18} className="mr-2" /> {(selectedRequest as any).profileType === 'LIMPA_NOME' ? 'APROVAR SERVIÇO' : 'APROVAR EMPRÉSTIMO'}
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Request Document Modal */}
            {isDocRequestOpen && (
                <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-[60] p-4">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in zoom-in duration-200">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                <FileWarning className="text-[#D4AF37]" /> Solicitar Documento
                            </h3>
                            <button onClick={() => setIsDocRequestOpen(false)}><X className="text-zinc-500 hover:text-white" /></button>
                        </div>

                        <p className="text-zinc-400 text-sm mb-4">
                            O processo mudará para "AGUARDANDO DOC". O cliente receberá uma notificação para enviar o anexo.
                        </p>

                        <textarea
                            value={docRequestDesc}
                            onChange={(e) => setDocRequestDesc(e.target.value)}
                            className="w-full h-32 bg-black border border-zinc-700 rounded-lg p-3 text-white focus:border-[#D4AF37] outline-none resize-none mb-4"
                            placeholder="Ex: Por favor, envie um comprovante de residência atualizado (últimos 60 dias)..."
                        />

                        <Button onClick={handleRequestDoc} isLoading={!!processing} className="w-full">
                            <Send size={18} className="mr-2" /> Enviar Solicitação
                        </Button>
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
    <div className={`p-4 rounded-xl border ${highlight ? 'bg-zinc-800 border-[#D4AF37]/50' : 'bg-black border-zinc-800'}`}>
        <p className="text-xs text-zinc-500 mb-1 uppercase tracking-wide">{label}</p>
        <p className={`font-bold truncate ${highlight ? 'text-[#D4AF37] text-lg' : 'text-white'}`}>{value}</p>
    </div>
);

const VideoCard = ({ title, url }: { title: string, url: string }) => (
    <div className="space-y-2 group">
        <p className="text-xs text-zinc-400 pl-1">{title}</p>
        <div className="rounded-xl border border-zinc-800 bg-black overflow-hidden relative aspect-video">
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
                        target.parentElement.innerHTML = `<div class="w-full h-full flex items-center justify-center text-zinc-500 text-sm flex-col gap-2"><span>Vídeo indisponível</span><a href="${url}" target="_blank" class="text-[#D4AF37] text-xs underline">Abrir em nova aba</a></div>`;
                    }
                }}
            />
        </div>
    </div>
);

const DocCard = ({ title, urls, isSignature, onView }: { title: string, urls: string[], isSignature?: boolean, onView: () => void }) => (
    <div className="space-y-2 group">
        <p className="text-xs text-zinc-400 pl-1">{title}</p>
        <div className={`rounded-xl border border-zinc-800 bg-black overflow-hidden relative ${isSignature ? 'h-24 bg-white/5' : 'aspect-[4/3]'}`}>
            {urls.length > 0 ? (
                <img src={urls[0]} className={`w-full h-full ${isSignature ? 'object-contain p-2' : 'object-cover'} group-hover:scale-105 transition-transform duration-500 opacity-80 group-hover:opacity-100`} alt={title} />
            ) : (
                <div className="w-full h-full flex items-center justify-center text-zinc-600 text-xs">Pendente</div>
            )}

            {/* Multi-page badge */}
            {urls.length > 1 && (
                <div className="absolute top-2 right-2 bg-black/70 border border-zinc-700 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-1 rounded-md flex items-center gap-1">
                    <Layers size={10} className="text-[#D4AF37]" /> +{urls.length - 1}
                </div>
            )}

            {urls.length > 0 && (
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer" onClick={onView}>
                    <Button size="sm" variant="secondary" className="shadow-xl"><Maximize size={14} className="mr-1" /> Ampliar</Button>
                </div>
            )}
        </div>
    </div>
);
