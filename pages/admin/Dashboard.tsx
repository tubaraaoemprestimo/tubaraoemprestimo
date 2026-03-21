
import React, { useState, useEffect, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { DollarSign, Users, AlertTriangle, TrendingUp, Check, X, Maximize, Layers, Activity, BarChart3, LayoutGrid, Clock, Zap, Target, Timer } from 'lucide-react';
import { Button } from '../../components/Button';
import { apiService } from '../../services/apiService';
import { whatsappService } from '../../services/whatsappService';
import { notificationService } from '../../services/notificationService';
import { LoanRequest, LoanStatus } from '../../types';
import { useToast } from '../../components/Toast';
import { ImageViewer } from '../../components/ImageViewer';
import { AdvancedKPIs } from '../../components/AdvancedKPIs';
import { TodayFinancialDashboard } from '../../components/TodayFinancialDashboard';

const MONTH_NAMES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export const Dashboard: React.FC = () => {
  const { addToast } = useToast();
  const [allRequests, setAllRequests] = useState<LoanRequest[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<LoanRequest | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);
  const [viewingImage, setViewingImage] = useState<{ urls: string[]; title: string } | null>(null);
  const [viewMode, setViewMode] = useState<'standard' | 'advanced'>('advanced');
  const [settings, setSettings] = useState<{ monthlyInterestRate: number }>({ monthlyInterestRate: 5 });
  const [counterOfferStats, setCounterOfferStats] = useState<any>(null);
  const [activeLoansCount, setActiveLoansCount] = useState<number>(0);

  useEffect(() => {
    loadData();
    // Registrar Push Notifications para admin
    import('../../services/webPushService').then(({ webPushService }) => {
      webPushService.subscribe();
    }).catch(() => {});
  }, []);

  const loadData = async () => {
    const [reqs, sett] = await Promise.all([
      apiService.getRequests(),
      apiService.getSettings(),
    ]);
    setAllRequests(reqs);
    setSettings(sett);

    // Active loans count
    try {
      const loans = await apiService.getAdminLoans({ status: 'ACTIVE' });
      setActiveLoansCount(Array.isArray(loans) ? loans.length : 0);
    } catch {}

    // Load counteroffer analytics
    try {
      const analytics = await apiService.getCounterOfferAnalytics();
      if (analytics?.success) setCounterOfferStats(analytics.analytics);
    } catch {}
  };

  // Derived data
  const pendingRequests = useMemo(() =>
    allRequests.filter(r => r.status === LoanStatus.PENDING),
    [allRequests]
  );

  const approvedRequests = useMemo(() =>
    allRequests.filter(r => r.status === LoanStatus.APPROVED || r.status === LoanStatus.PAID),
    [allRequests]
  );

  const defaultedRequests = useMemo(() =>
    allRequests.filter(r => r.status === LoanStatus.DEFAULTED),
    [allRequests]
  );

  // KPIs
  const totalLent = useMemo(() =>
    approvedRequests.reduce((sum, r) => sum + r.amount, 0),
    [approvedRequests]
  );

  const activeClients = useMemo(() => {
    const cpfs = new Set(approvedRequests.map(r => r.cpf));
    return cpfs.size;
  }, [approvedRequests]);

  const defaultRate = useMemo(() => {
    const totalFinalized = approvedRequests.length + defaultedRequests.length;
    if (totalFinalized === 0) return 0;
    return Math.round((defaultedRequests.length / totalFinalized) * 100);
  }, [approvedRequests, defaultedRequests]);

  const projectedRevenue = useMemo(() => {
    return Math.round(totalLent * (settings.monthlyInterestRate / 100));
  }, [totalLent, settings.monthlyInterestRate]);

  // Chart data - group by month
  const loanVolumeData = useMemo(() => {
    const now = new Date();
    const months: { name: string; amt: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const total = approvedRequests
        .filter(r => {
          const rd = new Date(r.date);
          return `${rd.getFullYear()}-${String(rd.getMonth() + 1).padStart(2, '0')}` === monthKey;
        })
        .reduce((sum, r) => sum + r.amount, 0);
      months.push({ name: MONTH_NAMES[d.getMonth()], amt: total });
    }
    return months;
  }, [approvedRequests]);

  const newClientsData = useMemo(() => {
    const now = new Date();
    const months: { name: string; amt: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const cpfs = new Set(
        allRequests
          .filter(r => {
            const rd = new Date(r.date);
            return `${rd.getFullYear()}-${String(rd.getMonth() + 1).padStart(2, '0')}` === monthKey;
          })
          .map(r => r.cpf)
      );
      months.push({ name: MONTH_NAMES[d.getMonth()], amt: cpfs.size });
    }
    return months;
  }, [allRequests]);

  // Activity feed - last 10 requests of any status
  const recentActivity = useMemo(() => {
    return allRequests.slice(0, 10).map(r => {
      let type: 'success' | 'warning' | 'info' = 'info';
      let title = '';
      if (r.status === LoanStatus.APPROVED || r.status === LoanStatus.PAID) {
        type = 'success';
        title = 'Aprovado';
      } else if (r.status === LoanStatus.REJECTED) {
        type = 'warning';
        title = 'Reprovado';
      } else if (r.status === LoanStatus.DEFAULTED) {
        type = 'warning';
        title = 'Inadimplente';
      } else {
        type = 'info';
        title = 'Nova solicitação';
      }
      const dateObj = new Date(r.date);
      const now = new Date();
      const diffMs = now.getTime() - dateObj.getTime();
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      let timeAgo = '';
      if (diffHours < 1) timeAgo = 'Agora';
      else if (diffHours < 24) timeAgo = `${diffHours}h atrás`;
      else timeAgo = `${diffDays}d atrás`;

      return { id: r.id, title, desc: `${r.clientName} - R$ ${r.amount.toLocaleString()}`, time: timeAgo, type };
    });
  }, [allRequests]);

  const handleApprove = async (id: string) => {
    setProcessing(id);
    await apiService.approveLoan(id);

    const req = allRequests.find(r => r.id === id);
    if (req && req.phone) {
      const msg = `Olá ${req.clientName.split(' ')[0]}! Parabéns 🦈\n\nSeu empréstimo de *R$ ${req.amount.toLocaleString()}* foi APROVADO!\n\nO valor já está disponível em sua carteira digital. Acesse o app para conferir.`;
      whatsappService.sendMessage(req.phone, msg).then(success => {
        if (success) console.log("Auto message sent");
      });
      notificationService.notifyLoanApproved(req.email, req.clientName, req.amount);
    }

    setProcessing(null);
    setSelectedRequest(null);
    loadData();
    addToast("Empréstimo Aprovado! Cliente notificado via WhatsApp.", 'success');
  };

  const handleReject = async (id: string) => {
    setProcessing(id);
    const req = allRequests.find(r => r.id === id);
    await apiService.rejectLoan(id);

    if (req) {
      notificationService.notifyLoanRejected(req.email, req.clientName);
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

  // Trend calculation helpers
  const getCurrentMonthTotal = (reqs: LoanRequest[]) => {
    const now = new Date();
    return reqs.filter(r => {
      const d = new Date(r.date);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).reduce((s, r) => s + r.amount, 0);
  };

  const getLastMonthTotal = (reqs: LoanRequest[]) => {
    const now = new Date();
    const lastMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
    const lastYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
    return reqs.filter(r => {
      const d = new Date(r.date);
      return d.getMonth() === lastMonth && d.getFullYear() === lastYear;
    }).reduce((s, r) => s + r.amount, 0);
  };

  const trendPercent = (current: number, previous: number): string => {
    if (previous === 0) return current > 0 ? '+100%' : '0%';
    const pct = Math.round(((current - previous) / previous) * 100);
    return pct >= 0 ? `+${pct}%` : `${pct}%`;
  };

  const lentTrend = trendPercent(getCurrentMonthTotal(approvedRequests), getLastMonthTotal(approvedRequests));

  return (
    <div className="p-4 md:p-8 bg-black min-h-screen text-white">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <h1 className="text-3xl font-bold text-[#D4AF37]">Visão Geral</h1>
        <div className="flex items-center gap-3">
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

      {/* Dashboard Operacional do Dia */}
      <div className="mb-8">
        <TodayFinancialDashboard />
      </div>

      {viewMode === 'advanced' ? (
        <AdvancedKPIs />
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            <div className="lg:col-span-3 space-y-8">
              {/* KPI Cards - Dados reais */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                <KPICard title="Total Emprestado" value={totalLent} prefix="R$" icon={DollarSign} trend={lentTrend} />
                <KPICard title="Contratos Ativos" value={activeLoansCount} icon={Users} trend={`${pendingRequests.length} pendentes`} />
                <KPICard title="Inadimplência" value={defaultRate} suffix="%" icon={AlertTriangle} trend={`${defaultedRequests.length} casos`} isBad={defaultRate > 10} />
                <KPICard title="Receita Projetada" value={projectedRevenue} prefix="R$" icon={TrendingUp} trend={`${settings.monthlyInterestRate}% a.m.`} />
              </div>

              {/* Counteroffer Analytics Card */}
              {counterOfferStats && counterOfferStats.totalCounterOffers > 0 && (
                <div className="bg-gradient-to-r from-zinc-900 to-zinc-900 border border-orange-700/30 rounded-2xl p-6">
                  <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-orange-400">
                    <Target size={20} /> Analytics de Contrapropostas
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-black border border-zinc-800 rounded-xl p-4">
                      <p className="text-xs text-zinc-500 mb-1">Total Enviadas</p>
                      <p className="text-2xl font-bold text-white">{counterOfferStats.totalCounterOffers}</p>
                    </div>
                    <div className="bg-black border border-zinc-800 rounded-xl p-4">
                      <p className="text-xs text-zinc-500 mb-1">Taxa de Aceite</p>
                      <p className="text-2xl font-bold text-green-400">{counterOfferStats.acceptanceRate}%</p>
                      <p className="text-[10px] text-zinc-500">{counterOfferStats.totalAccepted} aceitas</p>
                    </div>
                    <div className="bg-black border border-zinc-800 rounded-xl p-4">
                      <p className="text-xs text-zinc-500 mb-1">Aguardando Aceite</p>
                      <p className="text-2xl font-bold text-orange-400">{counterOfferStats.pendingAcceptance}</p>
                    </div>
                    <div className="bg-black border border-zinc-800 rounded-xl p-4">
                      <p className="text-xs text-zinc-500 mb-1">Tempo Médio Aceite</p>
                      <p className="text-2xl font-bold text-white">{counterOfferStats.avgAcceptanceTimeHours}h</p>
                      {counterOfferStats.fastAcceptCount > 0 && (
                        <p className="text-[10px] text-yellow-400 flex items-center gap-1">
                          <Zap size={10} /> {counterOfferStats.fastAcceptCount} aceites rápidos (&lt;1h)
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div className="bg-black border border-zinc-800 rounded-xl p-4">
                      <p className="text-xs text-zinc-500 mb-1">Total Solicitado vs Aprovado</p>
                      <div className="flex items-center gap-3">
                        <span className="text-zinc-400 text-sm line-through">R$ {counterOfferStats.totalRequested?.toLocaleString('pt-BR')}</span>
                        <span className="text-green-400 font-bold">R$ {counterOfferStats.totalApproved?.toLocaleString('pt-BR')}</span>
                      </div>
                      <p className="text-[10px] text-zinc-500 mt-1">Desconto médio: {counterOfferStats.avgDiscountRate}%</p>
                    </div>
                    <div className="bg-black border border-zinc-800 rounded-xl p-4">
                      <p className="text-xs text-zinc-500 mb-2">Por Perfil</p>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(counterOfferStats.byProfile || {}).map(([profile, data]: [string, any]) => (
                          <span key={profile} className="text-[10px] bg-zinc-900 border border-zinc-700 rounded-full px-2 py-1">
                            {profile}: {data.rate}% ({data.accepted}/{data.total})
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Pending Loans Table */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-white">
                  <AlertTriangle className="text-[#D4AF37]" /> Solicitações Pendentes
                  {pendingRequests.length > 0 && (
                    <span className="text-xs bg-red-900/40 text-red-400 px-2 py-1 rounded-full ml-2">{pendingRequests.length}</span>
                  )}
                </h2>

                <div className="overflow-x-auto -mx-6 md:mx-0 px-6 md:px-0">
                  <table className="w-full text-left min-w-[500px]">
                    <thead className="bg-zinc-950 text-zinc-400 text-sm uppercase tracking-wider">
                      <tr>
                        <th className="p-4 rounded-tl-xl">Cliente</th>
                        <th className="p-4">Valor</th>
                        <th className="p-4">Tipo</th>
                        <th className="p-4">Data</th>
                        <th className="p-4 rounded-tr-xl text-right">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800 text-sm">
                      {pendingRequests.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-8 text-center text-zinc-500">Nenhuma solicitação pendente no momento.</td>
                        </tr>
                      ) : (
                        pendingRequests.map((req) => (
                          <tr key={req.id} className="hover:bg-zinc-800/50 transition-colors">
                            <td className="p-4 font-medium">
                              <div className="text-white">{req.clientName}</div>
                              <div className="text-xs text-zinc-500">{req.cpf}</div>
                            </td>
                            <td className="p-4 text-[#D4AF37] font-bold">R$ {req.amount.toLocaleString()}</td>
                            <td className="p-4">
                              <span className={`text-xs px-2 py-1 rounded-full font-semibold ${
                                req.profileType === 'GARANTIA' ? 'bg-purple-900/30 text-purple-400' :
                                req.profileType === 'MOTO' ? 'bg-blue-900/30 text-blue-400' :
                                req.profileType === 'AUTONOMO' ? 'bg-orange-900/30 text-orange-400' :
                                req.profileType === 'LIMPA_NOME' ? 'bg-cyan-900/30 text-cyan-400' :
                                'bg-zinc-800 text-zinc-300'
                              }`}>
                                {req.profileType || 'CLT'}
                              </span>
                            </td>
                            <td className="p-4 text-zinc-400">{new Date(req.date).toLocaleDateString('pt-BR')}</td>
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

              {/* Charts */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl">
                  <h3 className="text-lg font-semibold mb-6">Volume de Empréstimos</h3>
                  <div className="h-[250px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={loanVolumeData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                        <XAxis dataKey="name" stroke="#666" axisLine={false} tickLine={false} />
                        <YAxis stroke="#666" axisLine={false} tickLine={false} tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#000', borderColor: '#333', borderRadius: '8px' }}
                          formatter={(value: number) => [`R$ ${value.toLocaleString('pt-BR')}`, 'Volume']}
                        />
                        <Bar dataKey="amt" fill="#D4AF37" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl">
                  <h3 className="text-lg font-semibold mb-6">Novos Clientes</h3>
                  <div className="h-[250px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={newClientsData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                        <XAxis dataKey="name" stroke="#666" axisLine={false} tickLine={false} />
                        <YAxis stroke="#666" axisLine={false} tickLine={false} allowDecimals={false} />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#000', borderColor: '#333', borderRadius: '8px' }}
                          formatter={(value: number) => [value, 'Clientes']}
                        />
                        <Line type="monotone" dataKey="amt" stroke="#D4AF37" strokeWidth={2} dot={{ fill: '#D4AF37' }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>

            {/* Sidebar - Activity Feed */}
            <div className="lg:col-span-1">
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 h-full">
                <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                  <Activity size={20} className="text-[#D4AF37]" /> Feed de Atividade
                </h3>

                <div className="space-y-6 relative">
                  <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-zinc-800"></div>

                  {recentActivity.length === 0 ? (
                    <div className="text-center py-8 text-zinc-500">
                      <Activity size={32} className="mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Nenhuma atividade recente</p>
                    </div>
                  ) : (
                    recentActivity.map((act) => (
                      <ActivityItem key={act.id} title={act.title} desc={act.desc} time={act.time} type={act.type} />
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Review Modal */}
          {selectedRequest && (
            <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-50 p-0 md:p-4">
              <div className="bg-zinc-900 border border-zinc-800 md:rounded-2xl w-full max-w-5xl h-full md:max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-in fade-in zoom-in duration-200">
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

                <div className="flex-1 overflow-y-auto p-6 space-y-8">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <InfoBox label="Cliente" value={selectedRequest.clientName} />
                    <InfoBox label="CPF" value={selectedRequest.cpf} />
                    <InfoBox label="Valor Solicitado" value={`R$ ${selectedRequest.amount.toLocaleString()}`} highlight />
                    <InfoBox label="Tipo" value={selectedRequest.profileType || 'CLT'} />
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-[#D4AF37] font-bold text-lg border-b border-zinc-800 pb-2">Documentação Enviada</h3>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <DocCard
                        title="Selfie (Prova de Vida)"
                        urls={ensureArray(selectedRequest.documents?.selfieUrl)}
                        onView={() => setViewingImage({ urls: ensureArray(selectedRequest.documents?.selfieUrl), title: "Selfie" })}
                      />
                      <DocCard
                        title="RG/CNH (Frente)"
                        urls={ensureArray(selectedRequest.documents?.idCardUrl)}
                        onView={() => setViewingImage({ urls: ensureArray(selectedRequest.documents?.idCardUrl), title: "RG/CNH" })}
                      />
                      <DocCard
                        title="Assinatura"
                        urls={ensureArray(selectedRequest.signatureUrl)}
                        isSignature
                        onView={() => setViewingImage({ urls: ensureArray(selectedRequest.signatureUrl), title: "Assinatura" })}
                      />
                    </div>

                    {selectedRequest.documents?.vehicleUrl && ensureArray(selectedRequest.documents.vehicleUrl).length > 0 && (
                      <div className="mt-4">
                        <h4 className="text-zinc-400 text-sm mb-2 font-semibold">Garantia Veicular</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <DocCard
                            title="Veículo (Fotos)"
                            urls={ensureArray(selectedRequest.documents?.vehicleUrl)}
                            onView={() => setViewingImage({ urls: ensureArray(selectedRequest.documents?.vehicleUrl), title: "Veículo" })}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

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

const KPICard = ({ title, value, prefix = "", suffix = "", icon: Icon, trend, isBad }: any) => {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    if (value === 0) { setDisplayValue(0); return; }
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
        <span className={`text-xs font-bold px-2 py-1 rounded-full ${
          isBad ? 'bg-red-900/30 text-red-400' : 'bg-green-900/30 text-green-400'
        }`}>
          {trend}
        </span>
      </div>
      <div className="text-zinc-400 text-sm mb-1">{title}</div>
      <div className="text-2xl font-bold text-white">
        {prefix} {displayValue.toLocaleString('pt-BR')} {suffix}
      </div>
    </div>
  );
};

const ActivityItem = ({ title, desc, time, type }: any) => {
  const color = type === 'success' ? 'bg-green-500' : type === 'warning' ? 'bg-red-500' : 'bg-[#D4AF37]';
  return (
    <div className="relative pl-8">
      <div className={`absolute left-0 top-1.5 w-6 h-6 rounded-full border-4 border-zinc-900 ${color}`}></div>
      <div>
        <h4 className="text-white text-sm font-bold">{title}</h4>
        <p className="text-zinc-400 text-xs">{desc}</p>
        <span className="text-zinc-600 text-[10px] uppercase tracking-wide flex items-center gap-1 mt-1">
          <Clock size={9} /> {time}
        </span>
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
