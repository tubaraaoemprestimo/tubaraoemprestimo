
import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { DollarSign, Users, AlertTriangle, TrendingUp, Check, X, Maximize, Layers, Activity, BarChart3, LayoutGrid } from 'lucide-react';
import { Button } from '../../components/Button';
import { supabaseService } from '../../services/supabaseService';
import { whatsappService } from '../../services/whatsappService';
import { notificationService } from '../../services/notificationService';
import { LoanRequest, LoanStatus } from '../../types';
import { useToast } from '../../components/Toast';
import { ImageViewer } from '../../components/ImageViewer';
import { AdvancedKPIs } from '../../components/AdvancedKPIs';

const data = [
  { name: 'Jan', amt: 2400 },
  { name: 'Fev', amt: 1398 },
  { name: 'Mar', amt: 9800 },
  { name: 'Abr', amt: 3908 },
  { name: 'Mai', amt: 4800 },
  { name: 'Jun', amt: 3800 },
  { name: 'Jul', amt: 4300 },
];

export const Dashboard: React.FC = () => {
  const { addToast } = useToast();
  const [requests, setRequests] = useState<LoanRequest[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<LoanRequest | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);
  const [viewingImage, setViewingImage] = useState<{ urls: string[]; title: string } | null>(null);
  const [viewMode, setViewMode] = useState<'standard' | 'advanced'>('advanced');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const allRequests = await supabaseService.getRequests();
    // Filter only Pending for the dashboard
    setRequests(allRequests.filter(r => r.status === LoanStatus.PENDING));
  };

  const handleApprove = async (id: string) => {
    setProcessing(id);
    await supabaseService.approveLoan(id);

    // Automated WhatsApp Trigger
    const req = requests.find(r => r.id === id);
    if (req && req.phone) {
      const msg = `Olá ${req.clientName.split(' ')[0]}! Parabéns 🦈\n\nSeu empréstimo de *R$ ${req.amount.toLocaleString()}* foi APROVADO!\n\nO valor já está disponível em sua carteira digital. Acesse o app para conferir.`;

      // Fire and forget - don't block UI if whatsapp fails
      whatsappService.sendMessage(req.phone, msg).then(success => {
        if (success) console.log("Auto message sent");
      });

      // Create notification
      notificationService.notifyLoanApproved(req.clientName, req.amount);
    }

    setProcessing(null);
    setSelectedRequest(null);
    loadData();
    addToast("Empréstimo Aprovado! Cliente notificado via WhatsApp.", 'success');
  };

  const handleReject = async (id: string) => {
    setProcessing(id);
    const req = requests.find(r => r.id === id);
    await supabaseService.rejectLoan(id);

    // Create notification
    if (req) {
      notificationService.notifyLoanRejected(req.clientName);
    }

    setProcessing(null);
    setSelectedRequest(null);
    loadData();
    addToast("Solicitação Reprovada.", 'info');
  };

  const ensureArray = (src?: string | string[]): string[] => {
    if (!src) return [];
    if (Array.isArray(src)) return src;
    return [src];
  };

  return (
    <div className="p-4 md:p-8 bg-black min-h-screen text-white">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <h1 className="text-3xl font-bold text-[#D4AF37]">Visão Geral</h1>
        <div className="flex items-center gap-3">
          {/* View Mode Toggle */}
          <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-lg p-1">
            <button
              onClick={() => setViewMode('standard')}
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-xs font-semibold transition-all ${viewMode === 'standard'
                ? 'bg-[#D4AF37] text-black'
                : 'text-zinc-400 hover:text-white'
                }`}
            >
              <LayoutGrid size={14} /> Padrão
            </button>
            <button
              onClick={() => setViewMode('advanced')}
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-xs font-semibold transition-all ${viewMode === 'advanced'
                ? 'bg-[#D4AF37] text-black'
                : 'text-zinc-400 hover:text-white'
                }`}
            >
              <BarChart3 size={14} /> KPIs Avançados
            </button>
          </div>
          <div className="flex items-center gap-2 text-xs text-zinc-500 bg-zinc-900 border border-zinc-800 px-3 py-2 rounded-lg">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span> Sistema Online
          </div>
        </div>
      </div>

      {/* Advanced KPIs View */}
      {viewMode === 'advanced' ? (
        <AdvancedKPIs />
      ) : (
        <>
          {/* Layout Grid with Sidebar */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">

            {/* Main Content Area */}
            <div className="lg:col-span-3 space-y-8">
              {/* KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                <KPICard title="Total Emprestado" value={1250000} prefix="R$" icon={DollarSign} trend="+12%" />
                <KPICard title="Clientes Ativos" value={342} icon={Users} trend="+5%" />
                <KPICard title="Inadimplência" value={2.4} suffix="%" icon={AlertTriangle} trend="-0.5%" isBad={false} />
                <KPICard title="Receita Projetada" value={150000} prefix="R$" icon={TrendingUp} trend="+8%" />
              </div>

              {/* Pending Loans Table (Approval Interface) */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-white">
                  <AlertTriangle className="text-[#D4AF37]" /> Solicitações Pendentes
                </h2>

                <div className="overflow-x-auto -mx-6 md:mx-0 px-6 md:px-0">
                  <table className="w-full text-left min-w-[600px]">
                    <thead className="bg-zinc-950 text-zinc-400 text-sm uppercase tracking-wider">
                      <tr>
                        <th className="p-4 rounded-tl-xl">Cliente</th>
                        <th className="p-4">Valor</th>
                        <th className="p-4">Parcelas</th>
                        <th className="p-4">Data</th>
                        <th className="p-4 rounded-tr-xl text-right">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800 text-sm">
                      {requests.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-8 text-center text-zinc-500">Nenhuma solicitação pendente no momento.</td>
                        </tr>
                      ) : (
                        requests.map((req) => (
                          <tr key={req.id} className="hover:bg-zinc-800/50 transition-colors">
                            <td className="p-4 font-medium">
                              <div className="text-white">{req.clientName}</div>
                              <div className="text-xs text-zinc-500">{req.cpf}</div>
                            </td>
                            <td className="p-4 text-[#D4AF37] font-bold">R$ {req.amount.toLocaleString()}</td>
                            <td className="p-4">{req.installments}x</td>
                            <td className="p-4 text-zinc-400">{new Date(req.date).toLocaleDateString()}</td>
                            <td className="p-4 text-right">
                              <Button size="sm" onClick={() => setSelectedRequest(req)}>
                                Revisar
                              </Button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Existing Charts */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl">
                  <h3 className="text-lg font-semibold mb-6">Volume de Empréstimos</h3>
                  <div className="h-[250px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                        <XAxis dataKey="name" stroke="#666" axisLine={false} tickLine={false} />
                        <YAxis stroke="#666" axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={{ backgroundColor: '#000', borderColor: '#333' }} />
                        <Bar dataKey="amt" fill="#D4AF37" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl">
                  <h3 className="text-lg font-semibold mb-6">Novos Clientes</h3>
                  <div className="h-[250px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                        <XAxis dataKey="name" stroke="#666" axisLine={false} tickLine={false} />
                        <YAxis stroke="#666" axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={{ backgroundColor: '#000', borderColor: '#333' }} />
                        <Line type="monotone" dataKey="amt" stroke="#D4AF37" strokeWidth={2} dot={{ fill: '#D4AF37' }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>

            {/* Sidebar - Real-time Activity Feed */}
            <div className="lg:col-span-1">
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 h-full">
                <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                  <Activity size={20} className="text-[#D4AF37]" /> Feed de Atividade
                </h3>

                <div className="space-y-6 relative">
                  {/* Timeline line */}
                  <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-zinc-800"></div>

                  <ActivityItem
                    title="Pagamento Recebido"
                    desc="Ana Souza pagou R$ 450,00"
                    time="2 min atrás"
                    type="success"
                  />
                  <ActivityItem
                    title="Nova Solicitação"
                    desc="Pedro Santos solicitou R$ 2.000"
                    time="15 min atrás"
                    type="info"
                  />
                  <ActivityItem
                    title="Alerta de Risco"
                    desc="Carlos Pereira atrasou parcela"
                    time="1h atrás"
                    type="warning"
                  />
                  <ActivityItem
                    title="Pagamento Recebido"
                    desc="Marcos Vinícius pagou R$ 450,00"
                    time="2h atrás"
                    type="success"
                  />
                  <ActivityItem
                    title="Cliente Cadastrado"
                    desc="Julia Matos criou conta"
                    time="3h atrás"
                    type="info"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Review Modal */}
          {selectedRequest && (
            <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-50 p-0 md:p-4">
              <div className="bg-zinc-900 border border-zinc-800 md:rounded-2xl w-full max-w-5xl h-full md:max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-in fade-in zoom-in duration-200">
                {/* Modal Header */}
                <div className="flex justify-between items-center p-6 border-b border-zinc-800 bg-zinc-950">
                  <div>
                    <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                      Análise
                      <span className="text-xs bg-yellow-900/30 text-yellow-500 px-2 py-1 rounded-full border border-yellow-700/30">PENDENTE</span>
                    </h2>
                    <p className="text-zinc-400 text-sm mt-1">Solicitação: #{selectedRequest.id}</p>
                  </div>
                  <button onClick={() => setSelectedRequest(null)} className="p-2 hover:bg-zinc-800 rounded-full text-zinc-500 hover:text-white transition-colors">
                    <X size={24} />
                  </button>
                </div>

                {/* Modal Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-8">
                  {/* Client Info Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <InfoBox label="Cliente" value={selectedRequest.clientName} />
                    <InfoBox label="CPF" value={selectedRequest.cpf} />
                    <InfoBox label="Valor Solicitado" value={`R$ ${selectedRequest.amount.toLocaleString()}`} highlight />
                    <InfoBox label="Parcelas" value={`${selectedRequest.installments}x`} />
                  </div>

                  {/* Documents Gallery */}
                  <div className="space-y-4">
                    <h3 className="text-[#D4AF37] font-bold text-lg border-b border-zinc-800 pb-2">Documentação Enviada</h3>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <DocCard
                        title="Selfie (Prova de Vida)"
                        urls={ensureArray(selectedRequest.documents.selfieUrl)}
                        onView={() => setViewingImage({ urls: ensureArray(selectedRequest.documents.selfieUrl), title: "Selfie" })}
                      />
                      <DocCard
                        title="RG/CNH (Frente)"
                        urls={ensureArray(selectedRequest.documents.idCardUrl)}
                        onView={() => setViewingImage({ urls: ensureArray(selectedRequest.documents.idCardUrl), title: "RG/CNH" })}
                      />
                      <DocCard
                        title="Assinatura"
                        urls={ensureArray(selectedRequest.signatureUrl)}
                        isSignature
                        onView={() => setViewingImage({ urls: ensureArray(selectedRequest.signatureUrl), title: "Assinatura" })}
                      />
                    </div>

                    {selectedRequest.documents.vehicleUrl && ensureArray(selectedRequest.documents.vehicleUrl).length > 0 && (
                      <div className="mt-4">
                        <h4 className="text-zinc-400 text-sm mb-2 font-semibold">Garantia Veicular</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <DocCard
                            title="Veículo (Fotos)"
                            urls={ensureArray(selectedRequest.documents.vehicleUrl)}
                            onView={() => setViewingImage({ urls: ensureArray(selectedRequest.documents.vehicleUrl), title: "Veículo" })}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Modal Actions */}
                <div className="p-6 border-t border-zinc-800 bg-zinc-950 flex flex-col md:flex-row justify-between items-center gap-4">
                  <span className="text-xs text-zinc-500 text-center md:text-left">
                    Aprovar liberará o saldo imediatamente na carteira do usuário.
                  </span>
                  <div className="flex gap-4 w-full md:w-auto">
                    <Button variant="danger" className="flex-1 md:flex-initial" onClick={() => handleReject(selectedRequest.id)} isLoading={processing === selectedRequest.id}>
                      <X size={18} className="mr-2" /> REPROVAR
                    </Button>
                    <Button variant="gold" className="flex-1 md:flex-initial bg-[#D4AF37] text-black font-bold hover:bg-[#B5942F]" onClick={() => handleApprove(selectedRequest.id)} isLoading={processing === selectedRequest.id}>
                      <Check size={18} className="mr-2" /> APROVAR
                    </Button>
                  </div>
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
        </>
      )}
    </div>
  );
};

// --- Local Components ---

// Animated KPI Card
const KPICard = ({ title, value, prefix = "", suffix = "", icon: Icon, trend, isBad }: any) => {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    let start = 0;
    const duration = 2000;
    const increment = value / (duration / 16);
    const timer = setInterval(() => {
      start += increment;
      if (start >= value) {
        setDisplayValue(value);
        clearInterval(timer);
      } else {
        setDisplayValue(Math.floor(start));
      }
    }, 16);
    return () => clearInterval(timer);
  }, [value]);

  return (
    <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl hover:border-[#D4AF37]/30 transition-all hover:scale-105 duration-300">
      <div className="flex justify-between items-start mb-4">
        <div className="p-3 bg-black rounded-lg border border-zinc-800 text-[#D4AF37]">
          <Icon size={24} />
        </div>
        <span className={`text-xs font-bold px-2 py-1 rounded-full ${(trend.includes('-') && !isBad) || (!trend.includes('-') && isBad === undefined)
          ? 'bg-green-900/30 text-green-400'
          : 'bg-red-900/30 text-red-400'
          }`}>
          {trend}
        </span>
      </div>
      <div className="text-zinc-400 text-sm mb-1">{title}</div>
      <div className="text-2xl font-bold text-white">
        {prefix} {displayValue.toLocaleString()} {suffix}
      </div>
    </div>
  );
};

const ActivityItem = ({ title, desc, time, type }: any) => {
  const color = type === 'success' ? 'bg-green-500' : type === 'warning' ? 'bg-red-500' : 'bg-blue-500';
  return (
    <div className="relative pl-8">
      <div className={`absolute left-0 top-1.5 w-6 h-6 rounded-full border-4 border-zinc-900 ${color}`}></div>
      <div>
        <h4 className="text-white text-sm font-bold">{title}</h4>
        <p className="text-zinc-400 text-xs">{desc}</p>
        <span className="text-zinc-600 text-[10px] uppercase tracking-wide">{time}</span>
      </div>
    </div>
  );
};

const InfoBox = ({ label, value, highlight }: any) => (
  <div className={`p-4 rounded-xl border ${highlight ? 'bg-zinc-800 border-[#D4AF37]/50' : 'bg-black border-zinc-800'}`}>
    <p className="text-xs text-zinc-500 mb-1 uppercase tracking-wide">{label}</p>
    <p className={`font-bold truncate ${highlight ? 'text-[#D4AF37] text-lg' : 'text-white'}`}>{value}</p>
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
