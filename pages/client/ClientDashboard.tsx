
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, ChevronRight, Wallet, Plus, Calendar, FileText, TrendingUp, X, Percent, Eye, EyeOff, Gift, Tag, Sparkles, AlertTriangle, Upload, CheckCircle, Calculator, Ticket, Megaphone, Briefcase, Download, History, Clock } from 'lucide-react';
import { Button } from '../../components/Button';
import { Skeleton } from '../../components/Skeleton';
import { apiService } from '../../services/apiService';
import { useToast } from '../../components/Toast';
import { LoanTimeline } from '../../components/LoanTimeline';
import { LoanRequest, Campaign, LoanStatus } from '../../types';
import { api } from '../../services/apiClient';
import { MarketingPopup } from '../../components/MarketingPopup';
import { Logo } from '../../components/Logo';
import { referralService } from '../../services/referralService';
import { locationTrackingService } from '../../services/locationTrackingService';
import { antifraudService } from '../../services/antifraudService';

export const ClientDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { addToast } = useToast();
  // ... state declarations ...
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isNivelOuroOpen, setIsNivelOuroOpen] = useState(false);
  const [isPrivacyEnabled, setIsPrivacyEnabled] = useState(false);
  const [pendingRequest, setPendingRequest] = useState<LoanRequest | null>(null);
  const [activeCampaigns, setActiveCampaigns] = useState<Campaign[]>([]);
  const [preApprovedAmount, setPreApprovedAmount] = useState<number | null>(null);
  const [referralCode, setReferralCode] = useState<string>('');

  // ... other states ...
  const [installmentOffer, setInstallmentOffer] = useState<{
    amount: number;
    installments: number;
    interestRate: number;
    installmentValue: number;
    totalAmount: number;
    createdAt: string;
  } | null>(null);
  const [coupons, setCoupons] = useState<{
    id: string;
    code: string;
    discount: number;
    description: string;
    expiresAt: string;
    imageUrl?: string;
    partnerName?: string;
    partnerLogo?: string;
    usageLimit?: number;
    usageCount?: number;
  }[]>([]);
  const [realNotifications, setRealNotifications] = useState<{ id: string; title: string; message: string; type: string; created_at: string; read: boolean }[]>([]);

  // ... modals ...
  const [isCampaignsModalOpen, setIsCampaignsModalOpen] = useState(false);
  const [isCouponsModalOpen, setIsCouponsModalOpen] = useState(false);
  const [isOffersModalOpen, setIsOffersModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [selectedDocFiles, setSelectedDocFiles] = useState<File[]>([]);
  const [contractPdfUrl, setContractPdfUrl] = useState<string | null>(null);
const [pixReceiptUrl, setPixReceiptUrl] = useState<string | null>(null);
const [isPixReceiptOpen, setIsPixReceiptOpen] = useState(false);
const [loanHistory, setLoanHistory] = useState<LoanRequest[]>([]);
const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

  // Nível Ouro Tubarão
  const [nivelOuroEligibility, setNivelOuroEligibility] = useState<{
    eligible: boolean;
    reason: string;
  } | null>(null);
  const [activeLoanId, setActiveLoanId] = useState<string | null>(null);

  // ... userData ...
  const [userData, setUserData] = useState({
    name: '',
    balance: 0,
    nextDue: '--/--',
    nextInstallmentValue: 0
  });
  const [hasCourseAccess, setHasCourseAccess] = useState(false);

  useEffect(() => {
    loadDashboardData();

    // Capturar localização do cliente em background (silencioso)
    locationTrackingService.captureAndSave().catch(() => { });

    // Verificar se dispositivo é permitido (max 2 devices)
    antifraudService.checkDevice().then(({ allowed, message }) => {
      if (!allowed) {
        addToast(message || 'Acesso bloqueado: Limite de dispositivos atingido.', 'error');
        setTimeout(() => {
          apiService.auth.signOut().then(() => navigate('/login'));
        }, 3000);
      }
    });

    // Subscribe to Web Push Notifications
    import('../../services/webPushService').then(({ webPushService }) => {
      webPushService.subscribe();
    });

  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    const user = apiService.auth.getUser();

    // Buscar dados atualizados do usuário da API
    try {
      const { data: freshUser } = await api.get('/auth/me');
      const courseAccess = !!(freshUser as any)?.user?.hasCourseAccess;
      console.log('[ClientDashboard] hasCourseAccess:', courseAccess);
      setHasCourseAccess(courseAccess);
    } catch (err) {
      console.error('[ClientDashboard] Erro ao buscar dados do usuário:', err);
    }

    const loans = await apiService.getClientLoans() as any[];
    const pendingReq = await apiService.getClientPendingRequest();
    const campaigns = await apiService.getActiveCampaigns() as any[];
    const preApproved = await apiService.getPreApproval();

    // Buscar oferta de crédito e cupons
    const offer = await apiService.getClientInstallmentOffer();
    const clientCoupons = await apiService.getClientCoupons();

    // Buscar notificações reais do banco
    const notifs = await apiService.getClientNotifications();
    setRealNotifications(notifs);

    let totalDebt = 0;
    let nextInstDate = '--/--';
    let nextInstVal = 0;
    let activeLoan: string | null = null;

    if (loans.length > 0) {
      // Calcular saldo devedor apenas de empréstimos ativos (APPROVED)
      const activeLoans = loans.filter(l => l.status === 'APPROVED' || l.status === 'ACTIVE');

      // Buscar comprovante PIX do primeiro empréstimo ativo
      const activeLoanWithPix = activeLoans.find(l => l.pixReceiptUrl);
      if (activeLoanWithPix?.pixReceiptUrl) {
        setPixReceiptUrl(activeLoanWithPix.pixReceiptUrl);
      }

      // Calcular saldo devedor total (remainingAmount já vem atualizado do backend)
      totalDebt = activeLoans.reduce((acc, curr) => acc + (curr.remainingAmount || 0), 0);

      // Pegar o primeiro empréstimo ativo (não quitado) para verificar elegibilidade Nível Ouro
      const notPaidLoans = activeLoans.filter(l => l.status === 'APPROVED' || l.status === 'ACTIVE');
      if (notPaidLoans.length > 0) {
        activeLoan = notPaidLoans[0].id;
      }

      // Buscar próxima parcela em aberto (apenas de empréstimos não quitados)
      const allInstallments = notPaidLoans.flatMap(l => l.installments).filter(i => i.status === 'OPEN' || i.status === 'LATE');
      allInstallments.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

      if (allInstallments.length > 0) {
        const next = allInstallments[0];
        nextInstDate = new Date(next.dueDate).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        nextInstVal = next.amount;
      }
    }

    setUserData({
      name: user?.name || 'Cliente',
      balance: totalDebt,
      nextDue: nextInstDate,
      nextInstallmentValue: nextInstVal
    });

    setActiveLoanId(activeLoan);

    // Verificar elegibilidade para Nível Ouro
    if (activeLoan) {
      try {
        const { data } = await api.get(`/loans/${activeLoan}/nivel-ouro/eligibility`);
        setNivelOuroEligibility(data);
      } catch (err) {
        console.error('Erro ao verificar elegibilidade Nível Ouro:', err);
      }
    }

    setPendingRequest(pendingReq);
    setActiveCampaigns(campaigns);
    setPreApprovedAmount(preApproved);
    setInstallmentOffer(offer);
    setCoupons(clientCoupons);

    // Buscar URL do contrato PDF (se existir)
    try {
      const latestReq = await apiService.getClientLatestRequest();
      if (latestReq) {
        // Tentar campo dedicado primeiro, depois fallback para supplemental_description
        let pdfUrl = latestReq.contract_pdf_url;
        if (!pdfUrl && latestReq.supplemental_description) {
          try {
            const desc = JSON.parse(latestReq.supplemental_description);
            pdfUrl = desc.contractPdfUrl;
          } catch { }
        }
        if (pdfUrl) setContractPdfUrl(pdfUrl);
      }
    } catch { }

if (user) {
      const code = await referralService.getOrCreateCode(user.id, user.name);
      setReferralCode(code.code);

      // Buscar histórico de solicitações (GET /loan-requests filtra por JWT auth)
      const { data: historyData } = await api.get('/loan-requests');
      if (historyData) {
        setLoanHistory(historyData as LoanRequest[]);
      }
    }

    setLoading(false);
  };

  const handleNivelOuroSubmit = async () => {
    if (!activeLoanId) {
      addToast('Nenhum empréstimo ativo encontrado', 'error');
      return;
    }

    try {
      const { data } = await api.post(`/loans/${activeLoanId}/nivel-ouro`);
      addToast('🟢 Nível Ouro Tubarão ativado com sucesso!', 'success');
      setIsNivelOuroOpen(false);

      // Recarregar dados do dashboard
      setTimeout(() => {
        loadDashboardData();
      }, 1000);
    } catch (error: any) {
      const errorMsg = error.response?.data?.message || error.response?.data?.error || 'Erro ao ativar Nível Ouro';
      addToast(errorMsg, 'error');
    }
  };

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}?ref=${referralCode}`;
    const shareText = `Use meu código ${referralCode} no Tubarão Empréstimos e ganhe condições especiais!`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Tubarão Empréstimos',
          text: shareText,
          url: shareUrl
        });
        addToast('Obrigado por indicar!', 'success');
      } catch (error) {
        console.log('Share canceled');
      }
    } else {
      // Fallback
      navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
      addToast('Link e código copiados!', 'info');
    }
  };

  const handleDocFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      setSelectedDocFiles(prev => [...prev, ...files]);
    }
    // Reset input so same files can be re-selected if needed
    e.target.value = '';
  };

  const handleDocUploadSubmit = async () => {
    if (selectedDocFiles.length === 0 || !pendingRequest) return;
    setUploadingDoc(true);
    try {
      // Convert all files to base64 and upload
      const uploadPromises = selectedDocFiles.map(file =>
        new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        })
      );
      const base64Files = await Promise.all(uploadPromises);
      await apiService.uploadSupplementalDoc(pendingRequest.id, base64Files);
      setUploadingDoc(false);
      setIsUploadModalOpen(false);
      setSelectedDocFiles([]);
      addToast("Documentos enviados! Sua análise continuará.", 'success');
      loadDashboardData();
    } catch (err) {
      setUploadingDoc(false);
      addToast("Erro ao enviar. Tente novamente.", 'error');
    }
  };

  // Notificações dinâmicas (reais do banco + contextuais)
  const notifications = [
    // Ofertas pendentes
    ...(preApprovedAmount ? [{ id: 'pre-approved', title: '🎉 Crédito Pré-Aprovado', msg: `Você tem R$ ${preApprovedAmount.toLocaleString('pt-BR')} disponíveis!`, type: 'success', time: 'Agora' }] : []),
    ...(installmentOffer ? [{ id: 'installment-offer', title: '💰 Oferta de Crédito', msg: `R$ ${installmentOffer.amount.toLocaleString('pt-BR')} disponível`, type: 'success', time: 'Agora' }] : []),
    // Documentos pendentes
    ...(pendingRequest?.status === LoanStatus.WAITING_DOCS ? [{ id: 'waiting-docs', title: '⚠️ Ação Necessária', msg: 'Envie o documento solicitado.', type: 'warning', time: 'Agora' }] : []),
    // Notificações reais do banco
    ...realNotifications.filter(n => !n.read).map(n => ({
      id: n.id,
      title: n.title,
      msg: n.message,
      type: n.type?.toLowerCase() || 'info',
      time: new Date(n.created_at).toLocaleDateString('pt-BR')
    }))
  ];

  const formatCurrency = (val: number) => {
    if (isPrivacyEnabled) return 'R$ ****';
    return `R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
  };

  return (
    <div className="min-h-screen bg-black text-white pb-24 font-sans">
      <MarketingPopup />

      <header
        className="sticky top-0 z-20 bg-black/80 backdrop-blur-md border-b border-zinc-900 px-6 pb-4 flex items-center justify-between"
        style={{ paddingTop: 'max(1rem, calc(env(safe-area-inset-top, 0px) + 0.5rem))' }}
      >
        <div className="flex items-center gap-2">
          <Logo size="sm" />
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={() => setIsPrivacyEnabled(!isPrivacyEnabled)}
            className="text-zinc-400 hover:text-white transition-colors"
          >
            {isPrivacyEnabled ? <EyeOff size={20} /> : <Eye size={20} />}
          </button>

          <div className="relative">
            <button
              onClick={() => setIsNotifOpen(!isNotifOpen)}
              className={`relative p-2 rounded-full transition-colors ${isNotifOpen || notifications.length > 1 ? 'text-[#D4AF37] bg-zinc-900' : 'text-zinc-400 hover:text-white'}`}
            >
              <Bell size={20} />
              {notifications.length > 0 && <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-600 border-2 border-black rounded-full"></span>}
            </button>

            {isNotifOpen && (
              <div
                className="fixed md:absolute right-4 md:right-0 md:top-full md:mt-3 w-[calc(100vw-2rem)] md:w-80 max-h-[70vh] bg-zinc-950 border border-[#D4AF37]/50 rounded-2xl shadow-2xl overflow-hidden z-50"
                style={{ top: 'calc(max(1rem, calc(env(safe-area-inset-top, 0px) + 0.5rem)) + 3.5rem)' }}
              >
                <div className="flex items-center justify-between p-4 border-b border-zinc-900 bg-zinc-900/50 sticky top-0">
                  <span className="font-bold text-[#D4AF37] text-sm">Notificações</span>
                  <button onClick={() => setIsNotifOpen(false)}><X size={16} /></button>
                </div>
                <div className="overflow-y-auto max-h-[calc(70vh-60px)]">
                  {notifications.map((notif) => (
                    <div key={notif.id} className="p-4 border-b border-zinc-900 hover:bg-zinc-900/40">
                      <h4 className={`text-sm font-bold ${notif.type === 'success' ? 'text-green-500' : notif.type === 'warning' ? 'text-yellow-500' : 'text-white'}`}>{notif.title}</h4>
                      <p className="text-xs text-zinc-400 mt-1">{notif.msg}</p>
                    </div>
                  ))}
                  {notifications.length === 0 && <div className="p-4 text-xs text-zinc-500 text-center">Nenhuma notificação nova.</div>}
                </div>
              </div>
            )}
          </div>

          <div
            onClick={() => navigate('/client/profile')}
            className="w-10 h-10 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-gold font-bold shadow-inner cursor-pointer"
          >
            {loading ? <Skeleton className="w-full h-full rounded-full" /> : userData.name.split(' ').map(n => n[0]).join('')}
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto animate-in slide-in-from-bottom-4 duration-500">

        {/* Saudação */}
        <div className="px-5 pt-5 pb-3">
          {loading ? <Skeleton className="h-7 w-44" /> : (
            <h2 className="text-2xl font-bold text-white">Bem-vindo, {userData.name.split(' ')[0]}</h2>
          )}
        </div>

        {/* Alerts dinâmicos */}
        {preApprovedAmount && (
          <div className="mx-4 mb-3 bg-gradient-to-r from-[#D4AF37] to-[#FDB931] rounded-xl p-3.5 relative overflow-hidden">
            <div className="absolute right-3 top-2 opacity-20"><Sparkles size={40} className="text-black" /></div>
            <div className="text-black">
              <p className="text-[10px] font-bold uppercase tracking-wider mb-0.5">Oferta Especial</p>
              <p className="text-base font-bold mb-1">Crédito Pré-Aprovado — R$ {preApprovedAmount.toLocaleString()}</p>
              <button onClick={() => navigate(`/wizard?amount=${preApprovedAmount}`)} className="text-xs font-bold bg-black text-[#D4AF37] px-3 py-1.5 rounded-lg">
                Contratar Agora →
              </button>
            </div>
          </div>
        )}

        {pendingRequest && pendingRequest.status === LoanStatus.WAITING_DOCS && (
          <div className="mx-4 mb-3 bg-blue-900/20 border border-blue-500/40 rounded-xl p-3.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-blue-400">
              <AlertTriangle size={16} />
              <span className="text-sm font-bold">Documento pendente</span>
            </div>
            <button onClick={() => setIsUploadModalOpen(true)} className="text-xs font-bold bg-blue-600 text-white px-3 py-1.5 rounded-lg shrink-0">
              Enviar
            </button>
          </div>
        )}

        {/* Card de Contraproposta Aguardando Aceite */}
        {pendingRequest && pendingRequest.status === 'PENDING_ACCEPTANCE' && !pendingRequest.counterOfferAccepted && (
          <div className="mx-4 mb-4 bg-gradient-to-br from-[#D4AF37]/20 to-orange-500/20 border-2 border-[#D4AF37] rounded-2xl p-6 shadow-2xl animate-pulse">
            <div className="text-center mb-4">
              <div className="inline-block bg-[#D4AF37] text-black px-4 py-2 rounded-full font-bold text-sm mb-3">
                🎉 CRÉDITO PRÉ-APROVADO!
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">Seu crédito está liberado!</h3>
              <p className="text-zinc-400 text-sm">Aceite o contrato para receber o valor na sua conta</p>
            </div>

            <div className="bg-black/50 border border-[#D4AF37]/30 rounded-xl p-4 mb-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-zinc-500">Valor Solicitado</span>
                <span className="text-sm text-zinc-400 line-through">
                  R$ {(pendingRequest.requestedAmount || pendingRequest.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-[#D4AF37]">💰 Valor Liberado</span>
                <span className="text-3xl font-bold text-[#4CAF50]">
                  R$ {(pendingRequest.approvedAmount || pendingRequest.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="mt-2 pt-2 border-t border-zinc-800">
                <div className="flex items-center justify-between text-xs text-zinc-500">
                  <span>Parcelas</span>
                  {/* ✅ BUG 2 FIX: Renderização condicional baseada em installmentType */}
                  {pendingRequest.installmentType === 'DAILY' ? (
                    <span className="font-bold text-white">
                      {pendingRequest.installments} diárias de R$ {((pendingRequest.approvedAmount || pendingRequest.amount) / pendingRequest.installments).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  ) : (
                    <span className="font-bold text-white">
                      {pendingRequest.installments}x de R$ {((pendingRequest.approvedAmount || pendingRequest.amount) / pendingRequest.installments).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-black/30 border border-zinc-800 rounded-xl p-3 mb-4 space-y-2">
              <div className="flex items-center gap-2 text-green-400 text-xs">
                <CheckCircle size={14} />
                <span>Crédito disponível para saque</span>
              </div>
              <div className="flex items-center gap-2 text-green-400 text-xs">
                <CheckCircle size={14} />
                <span>Sem consulta ao SPC/Serasa</span>
              </div>
              <div className="flex items-center gap-2 text-green-400 text-xs">
                <CheckCircle size={14} />
                <span>Aprovação em minutos</span>
              </div>
            </div>

            <button
              onClick={async () => {
                try {
                  await apiService.acceptCounteroffer(pendingRequest.id);
                  addToast('Contrato aceito! Seu crédito está sendo processado.', 'success');
                } catch (error: any) {
                  console.error('Erro ao aceitar contraproposta:', error);
                  const errorMsg = error.response?.data?.error || error.message || 'Erro ao aceitar contrato';
                  addToast(errorMsg, 'error');
                } finally {
                  // ✅ BUG 1 FIX: Sempre recarregar dados (sucesso ou erro)
                  loadDashboardData();
                }
              }}
              className="w-full bg-[#D4AF37] hover:bg-[#B5942F] text-black font-bold py-4 rounded-xl transition-all transform hover:scale-105 flex items-center justify-center gap-2 shadow-lg"
            >
              <CheckCircle size={20} />
              ✍️ ACEITAR CONTRATO E LIBERAR SALDO
            </button>

            <p className="text-center text-xs text-zinc-500 mt-3">
              ⏰ Esta oferta é válida por 48 horas
            </p>
          </div>
        )}

        {/* Só mostrar timeline se houver solicitação em andamento (PENDING, WAITING_DOCS ou PENDING_ACCEPTANCE) */}
        {pendingRequest &&
         (pendingRequest.status === LoanStatus.PENDING || pendingRequest.status === LoanStatus.WAITING_DOCS || pendingRequest.status === LoanStatus.PENDING_ACCEPTANCE) &&
         pendingRequest.amount > 0 && (
          <div className="px-4 mb-3">
            <LoanTimeline
              status={pendingRequest.status}
              date={pendingRequest.date}
              amount={pendingRequest.amount}
              installments={pendingRequest.installments}
            />
          </div>
        )}

        {contractPdfUrl && (
          <div className="mx-4 mb-3 bg-zinc-900 border border-green-500/30 rounded-xl p-3 flex items-center gap-3">
            <div className="bg-green-500/20 p-2 rounded-lg"><FileText size={18} className="text-green-400" /></div>
            <p className="flex-1 text-xs font-bold text-white">Contrato disponível em PDF</p>
            <a href={contractPdfUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-bold bg-green-600 text-white px-3 py-1.5 rounded-lg shrink-0 flex items-center gap-1">
              <Download size={12} /> Baixar
            </a>
          </div>
        )}

        {/* ── COMPROVANTE PIX DO ADMIN ── */}
        {pixReceiptUrl && (
          <div className="mx-4 mb-3 bg-zinc-900 border border-[#D4AF37]/30 rounded-xl p-3 flex items-center gap-3">
            <div className="bg-[#D4AF37]/20 p-2 rounded-lg">
              <Wallet size={18} className="text-[#D4AF37]" />
            </div>
            <div className="flex-1">
              <p className="text-xs font-bold text-white">Comprovante de Transferência</p>
              <p className="text-[10px] text-zinc-400 mt-0.5">PIX enviado pelo Tubarão Empréstimos</p>
            </div>
            <button
              onClick={() => setIsPixReceiptOpen(true)}
              className="text-xs font-bold bg-[#D4AF37] text-black px-3 py-1.5 rounded-lg shrink-0 flex items-center gap-1"
            >
              <Eye size={12} /> Ver
            </button>
          </div>
        )}

        {/* ── CARD SALDO DEVEDOR ── */}
        <div className="mx-4 mb-4 bg-[#1a1a1a] rounded-2xl overflow-hidden border border-zinc-800 shadow-xl">
          {/* Topo do card */}
          <div className="p-5 pb-4">
            <div className="flex items-center gap-2 text-zinc-400 mb-2">
              <Wallet size={14} />
              <span className="text-[10px] font-bold uppercase tracking-widest">Saldo Devedor</span>
            </div>
            {loading ? <Skeleton className="h-10 w-36" /> : (
              <div className="text-[2.2rem] font-bold text-white leading-none">
                {isPrivacyEnabled ? 'R$ ••••••' : (
                  <>
                    <span className="text-xl font-semibold text-zinc-300">R$ </span>
                    {userData.balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Próximo vencimento */}
          <div className="mx-4 mb-4 bg-black/50 rounded-xl p-3.5 flex items-center justify-between">
            <div>
              <p className="text-[9px] text-zinc-500 uppercase tracking-widest mb-1">Próximo Vencimento</p>
              <div className="flex items-center gap-1.5">
                <Calendar size={13} className="text-[#FF0000]" />
                <span className="text-white font-bold text-sm">
                  {loading ? '...' : (() => {
                    const parts = userData.nextDue.split('/');
                    return parts.length >= 2 ? (
                      <><span className="text-white font-extrabold">{parts[0]}/{parts[1]}</span>{parts[2] ? `/${parts[2]}` : ''}</>
                    ) : userData.nextDue;
                  })()}
                </span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[9px] text-zinc-500 uppercase tracking-widest mb-1">Valor</p>
              <span className="text-white font-bold text-sm">
                {loading ? '...' : formatCurrency(userData.nextInstallmentValue)}
              </span>
            </div>
          </div>

          {/* Botão Pagar Agora */}
          <button
            onClick={() => navigate('/client/contracts')}
            disabled={loading || userData.balance === 0}
            className="w-full bg-[#FF0000] hover:bg-red-700 active:bg-red-800 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-sm tracking-widest uppercase py-4 flex items-center justify-center gap-2 transition-all"
          >
            PAGAR AGORA <ChevronRight size={18} />
          </button>
        </div>

        {/* ── MEUS SERVIÇOS ── */}
        <div className="px-4 mb-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">Meus Serviços</p>
        </div>

        <div className="mx-4 rounded-2xl overflow-hidden border border-zinc-800 bg-[#1a1a1a] mb-4">
          {/* Solicitar Crédito */}
          <button onClick={() => navigate('/client/wizard')} className="w-full flex items-center gap-4 px-4 py-3.5 hover:bg-zinc-800/50 active:bg-zinc-800 transition-all border-b border-zinc-800">
            <div className="w-9 h-9 rounded-lg bg-[#FF0000] flex items-center justify-center shrink-0">
              <Plus size={18} strokeWidth={2.5} className="text-white" />
            </div>
            <span className="flex-1 text-left text-sm font-semibold text-white">Solicitar Crédito</span>
            <ChevronRight size={16} className="text-zinc-500" />
          </button>

          {/* Meus Contratos */}
          <button onClick={() => navigate('/client/contracts')} className="w-full flex items-center gap-4 px-4 py-3.5 hover:bg-zinc-800/50 active:bg-zinc-800 transition-all border-b border-zinc-800">
            <div className="w-9 h-9 rounded-lg bg-zinc-800 flex items-center justify-center shrink-0">
              <FileText size={18} className="text-zinc-300" />
            </div>
            <span className="flex-1 text-left text-sm font-semibold text-white">Meus Contratos</span>
            <ChevronRight size={16} className="text-zinc-500" />
          </button>

          {/* Extrato */}
          <button onClick={() => navigate('/client/statement')} className="w-full flex items-center gap-4 px-4 py-3.5 hover:bg-zinc-800/50 active:bg-zinc-800 transition-all">
            <div className="w-9 h-9 rounded-lg bg-zinc-800 flex items-center justify-center shrink-0">
              <TrendingUp size={18} className="text-zinc-300" />
            </div>
            <span className="flex-1 text-left text-sm font-semibold text-white">Extrato</span>
            <ChevronRight size={16} className="text-zinc-500" />
          </button>
        </div>

        {/* ── OPORTUNIDADES ── */}
        <div className="px-4 mb-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">Oportunidades</p>
        </div>

        {/* Linha 1: Ofertas, Cupons, Campanhas */}
        <div className="mx-4 grid grid-cols-3 gap-2 mb-2">
          <button onClick={() => setIsOffersModalOpen(true)} className="relative flex items-center gap-2.5 px-3 py-3 rounded-xl bg-[#1a2a1e] border border-emerald-900/60 hover:border-emerald-600 active:scale-95 transition-all">
            <Calculator size={18} className="text-emerald-400 shrink-0" />
            <span className="text-xs font-bold text-white">Ofertas</span>
            {(preApprovedAmount || installmentOffer) && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 text-black text-[9px] font-bold rounded-full flex items-center justify-center">
                {(preApprovedAmount ? 1 : 0) + (installmentOffer ? 1 : 0)}
              </span>
            )}
          </button>
          <button onClick={() => setIsCouponsModalOpen(true)} className="relative flex items-center gap-2.5 px-3 py-3 rounded-xl bg-[#1e1a2a] border border-purple-900/60 hover:border-purple-600 active:scale-95 transition-all">
            <Ticket size={18} className="text-purple-400 shrink-0" />
            <span className="text-xs font-bold text-white">Cupons</span>
            {coupons.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-purple-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">{coupons.length}</span>
            )}
          </button>
          <button onClick={() => setIsCampaignsModalOpen(true)} className="relative flex items-center gap-2.5 px-3 py-3 rounded-xl bg-[#2a221a] border border-amber-900/60 hover:border-amber-600 active:scale-95 transition-all">
            <Megaphone size={18} className="text-amber-400 shrink-0" />
            <span className="text-xs font-bold text-white">Campanhas</span>
            {activeCampaigns.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 text-black text-[9px] font-bold rounded-full flex items-center justify-center">{activeCampaigns.length}</span>
            )}
          </button>
        </div>

        {/* Linha 2: Nível Ouro, Indicações, Histórico */}
        <div className="mx-4 bg-[#1a1a1a] border border-zinc-800 rounded-2xl overflow-hidden mb-2">
          <div className="grid grid-cols-3">
            <button
              onClick={() => {
                if (nivelOuroEligibility?.eligible) {
                  setIsNivelOuroOpen(true);
                } else {
                  addToast(nivelOuroEligibility?.reason || 'Você não está elegível para o Nível Ouro Tubarão', 'info');
                }
              }}
              disabled={!activeLoanId}
              className="flex flex-col items-center gap-2 py-4 hover:bg-zinc-800/50 disabled:opacity-40 transition-all border-r border-zinc-800 active:scale-95"
            >
              <div className={`w-5 h-5 rounded-full ${nivelOuroEligibility?.eligible ? 'bg-green-500' : 'bg-zinc-600'}`}></div>
              <span className="text-[10px] font-semibold text-zinc-300">Nível Ouro</span>
            </button>
            <button onClick={() => navigate('/client/referrals')} className="flex flex-col items-center gap-2 py-4 hover:bg-zinc-800/50 transition-all border-r border-zinc-800 active:scale-95">
              <Gift size={20} className="text-zinc-300" />
              <span className="text-[10px] font-semibold text-zinc-300">Indicações</span>
            </button>
            <button onClick={() => setIsHistoryModalOpen(true)} className="flex flex-col items-center gap-2 py-4 hover:bg-zinc-800/50 transition-all active:scale-95">
              <History size={20} className="text-zinc-300" />
              <span className="text-[10px] font-semibold text-zinc-300">Histórico</span>
            </button>
          </div>
        </div>

        {/* Banner Método Tubarão - Apenas para quem tem acesso */}
        {hasCourseAccess && (
          <div className="mx-4 mb-2">
            <button
              onClick={() => navigate('/acesso')}
              className="w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl bg-gradient-to-r from-[#1a1500] to-[#2a2000] border border-[#D4AF37]/40 hover:border-[#D4AF37] hover:brightness-110 active:scale-[0.98] transition-all"
            >
              <span className="text-2xl shrink-0">🦈</span>
              <div className="flex-1 text-left">
                <p className="text-sm font-black text-[#D4AF37] leading-tight">Método Tubarão</p>
                <p className="text-[10px] text-zinc-400 mt-0.5">
                  Continuar aprendendo →
                </p>
              </div>
              <ChevronRight size={16} className="text-[#D4AF37] shrink-0" />
            </button>
          </div>
        )}

        {/* Mensagem Fixa do Nível Ouro */}
        {activeLoanId && (
          <div className="mx-4 mb-6 bg-gradient-to-r from-[#D4AF37]/10 to-[#FDB931]/5 border border-[#D4AF37]/30 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-[#D4AF37]/20 flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-[#D4AF37] text-lg">🟢</span>
              </div>
              <div>
                <p className="text-xs font-bold text-[#D4AF37] mb-1">Nível Ouro Tubarão</p>
                <p className="text-[11px] text-zinc-300 leading-relaxed">
                  Apenas clientes disciplinados alcançam o Nível Ouro Tubarão. Complete 12 pagamentos consecutivos em dia para desbloquear essa oportunidade exclusiva.
                </p>
              </div>
            </div>
          </div>
        )}

      </main>

      {/* Upload Supplemental Doc Modal */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-6 border-b border-zinc-800 pb-4">
              <h3 className="text-xl font-bold text-white">Enviar Documento</h3>
              <button onClick={() => { setIsUploadModalOpen(false); setSelectedDocFiles([]); }}>
                <X className="text-zinc-500 hover:text-white" />
              </button>
            </div>

            <p className="text-sm text-zinc-400 mb-4">
              Selecione as fotos, PDFs ou vídeos solicitados:
            </p>
            {pendingRequest?.supplementalInfo?.description && (
              <div className="bg-blue-900/20 border border-blue-700/40 rounded-lg px-4 py-3 mb-5">
                <p className="text-sm text-blue-300">
                  <strong className="text-white">Admin pediu:</strong> "{pendingRequest.supplementalInfo.description}"
                </p>
              </div>
            )}

            {/* Drop zone / file selector */}
            <div className="relative mb-4">
              <input
                type="file"
                accept="image/*,application/pdf,video/mp4,video/quicktime,video/x-msvideo,video/webm,video/*"
                multiple
                onChange={handleDocFileSelect}
                className="hidden"
                id="supp-upload"
                disabled={uploadingDoc}
              />
              <label
                htmlFor="supp-upload"
                className={`flex flex-col items-center justify-center gap-2 w-full p-8 rounded-xl border-2 border-dashed cursor-pointer transition-all ${uploadingDoc
                  ? 'bg-zinc-800 border-zinc-700 opacity-50 cursor-not-allowed'
                  : 'bg-zinc-900/50 border-zinc-700 hover:border-[#D4AF37] hover:bg-zinc-800'
                  }`}
              >
                <Upload size={32} className="text-[#D4AF37]" />
                <span className="font-bold text-sm text-white">Toque para selecionar</span>
                <span className="text-xs text-zinc-500">Fotos, PDFs e Vídeos aceitos</span>
              </label>
            </div>

            {/* File preview list */}
            {selectedDocFiles.length > 0 && (
              <div className="mb-5 space-y-2">
                <p className="text-xs text-zinc-400 font-semibold uppercase tracking-wider">
                  {selectedDocFiles.length} arquivo{selectedDocFiles.length > 1 ? 's' : ''} selecionado{selectedDocFiles.length > 1 ? 's' : ''}:
                </p>
                <ul className="space-y-1 max-h-40 overflow-y-auto pr-1">
                  {selectedDocFiles.map((f, i) => (
                    <li key={i} className="flex items-center justify-between bg-zinc-800 rounded-lg px-3 py-2">
                      <span className="text-xs text-zinc-300 truncate max-w-[240px]">
                        {f.type.startsWith('video/') ? '🎥' : f.type === 'application/pdf' ? '📄' : '🖼️'} {f.name}
                      </span>
                      <button
                        onClick={() => setSelectedDocFiles(prev => prev.filter((_, idx) => idx !== i))}
                        className="ml-2 text-zinc-500 hover:text-red-400 shrink-0"
                      >
                        <X size={14} />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex gap-3">
              <Button onClick={() => { setIsUploadModalOpen(false); setSelectedDocFiles([]); }} variant="secondary" className="flex-1">
                Cancelar
              </Button>
              <Button
                onClick={handleDocUploadSubmit}
                disabled={selectedDocFiles.length === 0 || uploadingDoc}
                isLoading={uploadingDoc}
                className="flex-1 font-bold"
              >
                {uploadingDoc ? 'Enviando...' : `Enviar ${selectedDocFiles.length > 0 ? `(${selectedDocFiles.length})` : ''}`}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Nível Ouro Tubarão Modal */}
      {isNivelOuroOpen && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-[60] p-4 animate-in fade-in zoom-in duration-200">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-[#D4AF37]">🟢 Nível Ouro Tubarão</h3>
              <button onClick={() => setIsNivelOuroOpen(false)}><X size={24} className="text-zinc-500 hover:text-white" /></button>
            </div>

            <div className="mb-6 p-4 bg-gradient-to-r from-[#D4AF37]/20 to-[#FDB931]/10 rounded-xl border border-[#D4AF37]/50 text-center">
              <p className="text-sm text-white font-bold mb-2">🎉 Parabéns pela disciplina!</p>
              <p className="text-xs text-zinc-300">Você completou 12 pagamentos consecutivos em dia e desbloqueou o Nível Ouro Tubarão!</p>
            </div>

            <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-900 mb-6">
              <h4 className="text-sm font-bold text-[#D4AF37] mb-3">✨ Benefícios Exclusivos:</h4>
              <ul className="space-y-2 text-xs text-zinc-300">
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">✓</span>
                  <span>Condições especiais para quitar seu empréstimo</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">✓</span>
                  <span>Condições especiais de pagamento</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">✓</span>
                  <span>Reconhecimento pela sua pontualidade</span>
                </li>
              </ul>
            </div>

            <div className="bg-black/50 p-4 rounded-xl border border-zinc-800 mb-6">
              <p className="text-xs text-zinc-400 text-center leading-relaxed">
                Apenas clientes disciplinados alcançam o Nível Ouro Tubarão. Complete 12 pagamentos consecutivos em dia para desbloquear essa oportunidade exclusiva.
              </p>
            </div>

            <div className="flex gap-3">
              <Button variant="secondary" onClick={() => setIsNivelOuroOpen(false)} className="flex-1">
                Cancelar
              </Button>
              <Button onClick={handleNivelOuroSubmit} className="flex-1 bg-[#D4AF37] hover:bg-[#FDB931] text-black font-bold">
                Ativar Agora
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Ofertas/Propostas */}
      {isOffersModalOpen && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md p-5 shadow-2xl animate-in zoom-in duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4 border-b border-zinc-800 pb-3">
              <h3 className="text-lg font-bold text-emerald-400 flex items-center gap-2">
                <Calculator size={20} /> Suas Ofertas
              </h3>
              <button onClick={() => setIsOffersModalOpen(false)}><X className="text-zinc-500 hover:text-white" /></button>
            </div>

            <div className="space-y-4">
              {/* Oferta Pré-Aprovada */}
              {preApprovedAmount && (
                <div className="bg-gradient-to-r from-[#D4AF37]/20 to-[#FDB931]/10 border border-[#D4AF37]/50 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles size={16} className="text-[#D4AF37]" />
                    <span className="text-xs font-bold uppercase text-[#D4AF37]">Crédito Pré-Aprovado</span>
                  </div>
                  <div className="text-2xl font-bold text-white mb-3">
                    R$ {preApprovedAmount.toLocaleString('pt-BR')}
                  </div>
                  <p className="text-xs text-zinc-400 mb-3">
                    Valor disponível para contratação imediata!
                  </p>
                  <Button
                    onClick={() => {
                      setIsOffersModalOpen(false);
                      navigate(`/wizard?amount=${preApprovedAmount}`);
                    }}
                    className="w-full bg-[#D4AF37] hover:bg-[#FDB931] text-black font-bold border-none"
                  >
                    <CheckCircle size={16} className="mr-2" /> Contratar Agora
                  </Button>
                </div>
              )}

              {/* Oferta de Crédito */}
              {installmentOffer && (
                <div className="bg-gradient-to-r from-emerald-900/30 to-emerald-900/10 border border-emerald-600/50 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Calculator size={16} className="text-emerald-400" />
                    <span className="text-xs font-bold uppercase text-emerald-400">Oferta Especial</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div className="bg-black/30 p-3 rounded-xl">
                      <p className="text-xs text-zinc-500">Valor</p>
                      <p className="text-lg font-bold text-white">R$ {installmentOffer.amount.toLocaleString('pt-BR')}</p>
                    </div>
                    <div className="bg-black/30 p-3 rounded-xl">
                      <p className="text-xs text-zinc-500">Taxa</p>
                      <p className="text-lg font-bold text-white">{installmentOffer.interestRate}% a.m.</p>
                    </div>
                    <div className="bg-black/30 p-3 rounded-xl col-span-2">
                      <p className="text-xs text-zinc-500">Total a Pagar</p>
                      <p className="text-lg font-bold text-emerald-400">R$ {installmentOffer.totalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    </div>
                  </div>
                  <p className="text-xs text-zinc-500 text-center mb-3">
                    Proposta enviada em {new Date(installmentOffer.createdAt).toLocaleDateString('pt-BR')}
                  </p>
                  <Button
                    onClick={() => {
                      setIsOffersModalOpen(false);
                      navigate(`/wizard?amount=${installmentOffer.amount}&rate=${installmentOffer.interestRate}`);
                    }}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white border-none"
                  >
                    <CheckCircle size={16} className="mr-2" /> Aceitar Proposta
                  </Button>
                </div>
              )}

              {/* Nenhuma oferta */}
              {!preApprovedAmount && !installmentOffer && (
                <div className="text-center py-8 text-zinc-500">
                  <Calculator size={48} className="mx-auto mb-4 opacity-30" />
                  <p>Nenhuma oferta disponível no momento.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Cupons */}
      {isCouponsModalOpen && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md p-5 shadow-2xl animate-in zoom-in duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4 border-b border-zinc-800 pb-3">
              <h3 className="text-lg font-bold text-purple-400 flex items-center gap-2">
                <Ticket size={20} /> Seus Cupons
              </h3>
              <button onClick={() => setIsCouponsModalOpen(false)}><X className="text-zinc-500 hover:text-white" /></button>
            </div>

            {coupons.length > 0 ? (
              <div className="space-y-3">
                {coupons.map((coupon, idx) => (
                  <div
                    key={coupon.id || idx}
                    className="bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden"
                  >
                    {/* Imagem do Cupom */}
                    {coupon.imageUrl && (
                      <div className="w-full h-40 bg-zinc-900">
                        <img
                          src={coupon.imageUrl}
                          alt={coupon.partnerName || 'Cupom'}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}

                    <div className="p-4">
                      {/* Logo do Parceiro */}
                      {coupon.partnerLogo && (
                        <div className="mb-3">
                          <img
                            src={coupon.partnerLogo}
                            alt={coupon.partnerName || 'Parceiro'}
                            className="h-8 object-contain"
                          />
                        </div>
                      )}

                      {/* Nome do Parceiro */}
                      {coupon.partnerName && (
                        <h4 className="font-bold text-white mb-2">{coupon.partnerName}</h4>
                      )}

                      {/* Código e Desconto */}
                      <div className="bg-gradient-to-r from-[#D4AF37]/20 to-[#FDB931]/10 border border-[#D4AF37]/30 rounded-lg p-3 mb-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-mono font-bold text-[#D4AF37] text-lg">{coupon.code}</span>
                          <span className="text-white font-bold text-xl">{coupon.discount}% OFF</span>
                        </div>
                        <Button
                          size="sm"
                          className="w-full bg-[#D4AF37] text-black hover:bg-[#FDB931]"
                          onClick={() => {
                            navigator.clipboard.writeText(coupon.code);
                            addToast('Código copiado!', 'success');
                          }}
                        >
                          Copiar Código
                        </Button>
                      </div>

                      {/* Descrição */}
                      <p className="text-sm text-zinc-300 mb-2">{coupon.description}</p>

                      {/* Informações adicionais */}
                      <div className="flex items-center justify-between text-xs text-zinc-500">
                        <span>Válido até {new Date(coupon.expiresAt).toLocaleDateString('pt-BR')}</span>
                        {coupon.usageLimit && coupon.usageCount !== undefined && (
                          <span>{coupon.usageCount}/{coupon.usageLimit} usos</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-zinc-500">
                <Ticket size={48} className="mx-auto mb-4 opacity-30" />
                <p>Nenhum cupom disponível no momento.</p>
              </div>
            )}
          </div>
        </div>
      )}

{/* Modal de Histórico de Solicitações */}
      {isHistoryModalOpen && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg max-h-[80vh] overflow-hidden shadow-2xl animate-in zoom-in duration-200">
            <div className="flex justify-between items-center p-4 border-b border-zinc-800">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <History size={20} className="text-[#D4AF37]" />
                Histórico de Solicitações
              </h3>
              <button onClick={() => setIsHistoryModalOpen(false)}><X className="text-zinc-500 hover:text-white" /></button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[60vh]">
              {loanHistory.length > 0 ? (
                <div className="space-y-3">
                  {loanHistory.map((loan) => (
                    <div key={loan.id} className="bg-zinc-950 border border-zinc-800 rounded-xl p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="font-bold text-white">R$ {loan.amount?.toLocaleString('pt-BR')}</p>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                          loan.status === 'APPROVED' ? 'bg-green-900/50 text-green-400' :
                          loan.status === 'REJECTED' ? 'bg-red-900/50 text-red-400' :
                          loan.status === 'PENDING' ? 'bg-yellow-900/50 text-yellow-400' :
                          'bg-blue-900/50 text-blue-400'
                        }`}>
                          {loan.status === 'APPROVED' ? 'Aprovado' :
                           loan.status === 'REJECTED' ? 'Rejeitado' :
                           loan.status === 'PENDING' ? 'Pendente' :
                           loan.status === 'WAITING_DOCS' ? 'Aguardando Docs' :
                           loan.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-zinc-500">
                        <Clock size={12} />
                        {new Date(loan.date || loan.createdAt).toLocaleDateString('pt-BR')}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-zinc-500">
                  <History size={48} className="mx-auto mb-4 opacity-50" />
                  <p>Nenhuma solicitação encontrada</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Campanhas */}
      {isCampaignsModalOpen && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md p-5 shadow-2xl animate-in zoom-in duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4 border-b border-zinc-800 pb-3">
              <h3 className="text-lg font-bold text-amber-400 flex items-center gap-2">
                <Megaphone size={20} /> Campanhas & Parceiros
              </h3>
              <button onClick={() => setIsCampaignsModalOpen(false)}><X className="text-zinc-500 hover:text-white" /></button>
            </div>

            {activeCampaigns.length > 0 ? (
              <div className="space-y-4">
                {activeCampaigns.map(camp => (
                  <div
                    key={camp.id}
                    onClick={() => camp.link && window.open(camp.link, '_blank')}
                    className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden cursor-pointer hover:border-amber-500 transition-all"
                  >
                    {camp.imageUrl && (
                      <div className="h-32 bg-black relative">
                        <img src={camp.imageUrl} className="w-full h-full object-cover" alt={camp.title} />
                        <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 to-transparent"></div>
                      </div>
                    )}
                    <div className="p-4">
                      <h4 className="font-bold text-white mb-1">{camp.title}</h4>
                      <p className="text-xs text-zinc-400">{camp.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-zinc-500">
                <Megaphone size={48} className="mx-auto mb-4 opacity-30" />
                <p>Nenhuma campanha disponível no momento.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── MODAL COMPROVANTE PIX ── */}
      {isPixReceiptOpen && pixReceiptUrl && (
        <div
          className="fixed inset-0 bg-black/95 backdrop-blur-sm flex items-center justify-center z-[70] p-4"
          onClick={() => setIsPixReceiptOpen(false)}
        >
          <div
            className="bg-zinc-900 border border-[#D4AF37]/40 rounded-2xl w-full max-w-sm shadow-2xl animate-in zoom-in duration-200 overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-[#D4AF37]/20 flex items-center justify-center">
                  <Wallet size={16} className="text-[#D4AF37]" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">Comprovante PIX</p>
                  <p className="text-[10px] text-zinc-400">Transferência do Tubarão Empréstimos</p>
                </div>
              </div>
              <button
                onClick={() => setIsPixReceiptOpen(false)}
                className="text-zinc-500 hover:text-white p-1 rounded-full hover:bg-zinc-800 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Imagem */}
            <div className="p-4 bg-black/50">
              <img
                src={pixReceiptUrl}
                alt="Comprovante de transferência PIX"
                className="w-full rounded-xl border border-zinc-800 object-contain max-h-[60vh]"
                onError={e => {
                  (e.target as HTMLImageElement).style.display = 'none';
                  (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                }}
              />
              <div className="hidden text-center py-8 text-zinc-500">
                <p className="text-sm">Não foi possível carregar o comprovante.</p>
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-4 border-t border-zinc-800 flex gap-3">
              <a
                href={pixReceiptUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#D4AF37] text-black text-sm font-bold rounded-xl"
              >
                <Download size={16} /> Abrir / Baixar
              </a>
              <button
                onClick={() => setIsPixReceiptOpen(false)}
                className="flex-1 py-2.5 bg-zinc-800 text-white text-sm font-bold rounded-xl hover:bg-zinc-700 transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const ActionButton = ({ icon: Icon, label, onClick, disabled }: any) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-zinc-900 border border-zinc-800 hover:border-[#D4AF37] hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
  >
    <div className="w-10 h-10 rounded-full bg-black flex items-center justify-center text-zinc-400 group-hover:text-[#D4AF37]">
      <Icon size={20} />
    </div>
    <span className="text-[10px] font-bold text-white">{label}</span>
  </button>
);

// Botões Principais - Mais compactos e profissionais
const MainActionButton = ({ icon: Icon, label, onClick, disabled }: any) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className="flex flex-col items-center justify-center gap-2 p-3.5 rounded-xl bg-gradient-to-br from-zinc-900 to-zinc-800 border border-zinc-700 hover:border-[#FF0000] hover:shadow-md hover:shadow-[#FF0000]/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
  >
    <div className="w-11 h-11 rounded-xl bg-[#FF0000] flex items-center justify-center text-white shadow-md">
      <Icon size={22} strokeWidth={2.5} />
    </div>
    <span className="text-[10px] font-bold text-white text-center leading-tight">{label}</span>
  </button>
);

// Botões Secundários - Mais compactos
const SecondaryActionButton = ({ icon: Icon, label, onClick, disabled }: any) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-600 hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
  >
    <div className="w-9 h-9 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-400">
      <Icon size={18} strokeWidth={2} />
    </div>
    <span className="text-[9px] font-semibold text-zinc-300 text-center leading-tight">{label}</span>
  </button>
);
