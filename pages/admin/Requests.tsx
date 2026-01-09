

import React, { useState, useEffect } from 'react';
import { Check, X, Eye, Maximize, Layers, Download, Filter, Video, Users, Phone, FileWarning, Send } from 'lucide-react';
import { Button } from '../../components/Button';
import { supabaseService } from '../../services/supabaseService';
import { LoanRequest, LoanStatus } from '../../types';
import { ImageViewer } from '../../components/ImageViewer';
import { useToast } from '../../components/Toast';

export const Requests: React.FC = () => {
  const { addToast } = useToast();
  const [requests, setRequests] = useState<LoanRequest[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<LoanRequest | null>(null);
  const [viewingImage, setViewingImage] = useState<{ urls: string[]; title: string } | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);
  
  // Document Request Modal
  const [isDocRequestOpen, setIsDocRequestOpen] = useState(false);
  const [docRequestDesc, setDocRequestDesc] = useState('');
  
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
    setProcessing(id);
    await supabaseService.approveLoan(id);
    setProcessing(null);
    setSelectedRequest(null);
    loadRequests();
    addToast("Solicitação aprovada e saldo liberado.", 'success');
  };

  const handleReject = async (id: string) => {
    setProcessing(id);
    await supabaseService.rejectLoan(id);
    setProcessing(null);
    setSelectedRequest(null);
    loadRequests();
    addToast("Solicitação reprovada.", 'info');
  };

  const handleRequestDoc = async () => {
     if (!selectedRequest || !docRequestDesc) return;
     
     setProcessing(selectedRequest.id);
     await supabaseService.requestSupplementalDoc(selectedRequest.id, docRequestDesc);
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
            <Download size={18} className="mr-2"/> Exportar CSV
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-6">
         {['ALL', LoanStatus.PENDING, LoanStatus.WAITING_DOCS, LoanStatus.APPROVED, LoanStatus.REJECTED].map((status) => (
             <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`px-4 py-2 rounded-full text-xs font-bold transition-colors border ${
                    filterStatus === status 
                    ? 'bg-[#D4AF37] text-black border-[#D4AF37]' 
                    : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white'
                }`}
             >
                {status === 'ALL' ? 'Todos' : status === 'WAITING_DOCS' ? 'Aguardando Doc.' : status}
             </button>
         ))}
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[800px]">
            <thead className="bg-zinc-950 text-zinc-400">
                <tr>
                <th className="p-4 font-medium">Cliente</th>
                <th className="p-4 font-medium">Valor</th>
                <th className="p-4 font-medium">Parcelas</th>
                <th className="p-4 font-medium">Status</th>
                <th className="p-4 font-medium">Data</th>
                <th className="p-4 font-medium">Ações</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
                {filteredRequests.length === 0 ? (
                    <tr><td colSpan={6} className="p-8 text-center text-zinc-500">Nenhuma solicitação encontrada com este filtro.</td></tr>
                ) : (
                    filteredRequests.map((req) => (
                    <tr key={req.id} className="hover:bg-zinc-800/50 transition-colors">
                        <td className="p-4">
                        <div className="font-medium text-white">{req.clientName}</div>
                        <div className="text-xs text-zinc-500">{req.cpf}</div>
                        </td>
                        <td className="p-4 font-bold text-[#D4AF37]">R$ {req.amount.toLocaleString()}</td>
                        <td className="p-4">{req.installments}x</td>
                        <td className="p-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                            req.status === LoanStatus.APPROVED ? 'bg-green-900/30 text-green-400' :
                            req.status === LoanStatus.REJECTED ? 'bg-red-900/30 text-red-400' :
                            req.status === LoanStatus.WAITING_DOCS ? 'bg-blue-900/30 text-blue-400' :
                            'bg-yellow-900/30 text-yellow-400'
                        }`}>
                            {req.status === LoanStatus.WAITING_DOCS ? 'AGUARDANDO DOC' : req.status}
                        </span>
                        </td>
                        <td className="p-4 text-zinc-500 text-sm">
                        {new Date(req.date).toLocaleDateString()}
                        </td>
                        <td className="p-4">
                        <Button variant="secondary" size="sm" className="py-1 px-3" onClick={() => setSelectedRequest(req)}>
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
                  Análise de Crédito
                  <span className={`text-xs px-2 py-1 rounded-full border ${
                    selectedRequest.status === LoanStatus.APPROVED ? 'bg-green-900/30 text-green-500 border-green-800' :
                    selectedRequest.status === LoanStatus.REJECTED ? 'bg-red-900/30 text-red-500 border-red-800' :
                    selectedRequest.status === LoanStatus.WAITING_DOCS ? 'bg-blue-900/30 text-blue-500 border-blue-800' :
                    'bg-yellow-900/30 text-yellow-500 border-yellow-800'
                  }`}>
                    {selectedRequest.status}
                  </span>
                </h2>
                <p className="text-zinc-400 text-sm mt-1">ID: {selectedRequest.id} • {selectedRequest.email}</p>
              </div>
              <button onClick={() => setSelectedRequest(null)} className="p-2 hover:bg-zinc-800 rounded-full text-zinc-500 hover:text-white transition-colors">
                <X size={24}/>
              </button>
            </div>

            {/* Content Scrollable Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-8">
              
              {/* Financial Summary */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <InfoBox label="Cliente" value={selectedRequest.clientName} />
                <InfoBox label="CPF" value={selectedRequest.cpf} />
                <InfoBox label="Valor Solicitado" value={`R$ ${selectedRequest.amount.toLocaleString()}`} highlight />
                <InfoBox label="Condição" value={`${selectedRequest.installments}x de R$ ${(selectedRequest.amount / selectedRequest.installments * 1.05).toLocaleString('pt-BR', {maximumFractionDigits: 2})}`} />
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

              {/* References Section */}
              {selectedRequest.references && (
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

              {/* Video Gallery */}
              <div className="space-y-4">
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
              </div>

              {/* Document Gallery */}
              <div className="space-y-6">
                
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
              </div>
            </div>

            {/* Actions Footer */}
            {(selectedRequest.status === LoanStatus.PENDING || selectedRequest.status === LoanStatus.WAITING_DOCS) && (
                <div className="p-6 border-t border-zinc-800 bg-zinc-950 flex flex-col md:flex-row justify-between items-center gap-4">
                <span className="text-xs text-zinc-500 text-center md:text-left">
                    Se aprovar agora, o saldo será liberado na carteira.
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
                       <Check size={18} className="mr-2" /> APROVAR EMPRÉSTIMO
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
            <video src={url} controls className="w-full h-full object-contain" />
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
                  <Button size="sm" variant="secondary" className="shadow-xl"><Maximize size={14} className="mr-1"/> Ampliar</Button>
               </div>
             )}
        </div>
    </div>
);
