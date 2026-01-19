
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, ChevronRight, Wallet, Plus, Calendar, FileText, TrendingUp, X, Percent, Eye, EyeOff, Gift, Tag, Sparkles, AlertTriangle, Upload, CheckCircle, Calculator, Ticket, Megaphone } from 'lucide-react';
import { Button } from '../../components/Button';
import { Skeleton } from '../../components/Skeleton';
import { supabaseService } from '../../services/supabaseService';
import { useToast } from '../../components/Toast';
import { LoanTimeline } from '../../components/LoanTimeline';
import { LoanRequest, Campaign, LoanStatus } from '../../types';
import { MarketingPopup } from '../../components/MarketingPopup';
import { Logo } from '../../components/Logo';
import { referralService } from '../../services/referralService';
import { locationTrackingService } from '../../services/locationTrackingService';

export const ClientDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isRenegotiateOpen, setIsRenegotiateOpen] = useState(false);
  const [isPrivacyEnabled, setIsPrivacyEnabled] = useState(false);
  const [pendingRequest, setPendingRequest] = useState<LoanRequest | null>(null);
  const [activeCampaigns, setActiveCampaigns] = useState<Campaign[]>([]);
  const [preApprovedAmount, setPreApprovedAmount] = useState<number | null>(null);
  const [referralCode, setReferralCode] = useState<string>('');

  // Propostas e Cupons
  const [installmentOffer, setInstallmentOffer] = useState<{
    amount: number;
    installments: number;
    interestRate: number;
    installmentValue: number;
    totalAmount: number;
    createdAt: string;
  } | null>(null);
  const [coupons, setCoupons] = useState<{ code: string; discount: number; description: string; expiresAt: string }[]>([]);

  // Modais separados para Campanhas, Cupons e Ofertas
  const [isCampaignsModalOpen, setIsCampaignsModalOpen] = useState(false);
  const [isCouponsModalOpen, setIsCouponsModalOpen] = useState(false);
  const [isOffersModalOpen, setIsOffersModalOpen] = useState(false);

  // Upload Modal for Waiting Docs
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);

  // Renegotiation State
  const [renegotiateInstallments, setRenegotiateInstallments] = useState(12);
  const [simulationResult, setSimulationResult] = useState({ monthly: 0, total: 0 });

  // Dynamic Data State
  const [userData, setUserData] = useState({
    name: '',
    balance: 0,
    nextDue: '--/--',
    nextInstallmentValue: 0
  });

  useEffect(() => {
    loadDashboardData();

    // Capturar localização do cliente em background (silencioso)
    locationTrackingService.captureAndSave().catch(() => { });
  }, []);

  // Recalculate simulation when balance or installments change
  useEffect(() => {
    if (userData.balance > 0) {
      // Mock calculation: Balance * (1 + 0.05 rate)^months / months (Simplified amortization)
      const rate = 0.05; // 5% mock interest for renegotiation
      const totalWithInterest = userData.balance * (1 + (rate * (renegotiateInstallments / 12)));
      const monthly = totalWithInterest / renegotiateInstallments;
      setSimulationResult({
        monthly,
        total: totalWithInterest
      });
    }
  }, [renegotiateInstallments, userData.balance]);

  const loadDashboardData = async () => {
    setLoading(true);
    const user = supabaseService.auth.getUser();
    const loans = await supabaseService.getClientLoans();
    const pendingReq = await supabaseService.getClientPendingRequest();
    const campaigns = await supabaseService.getActiveCampaigns();
    const preApproved = await supabaseService.getPreApproval();

    // Buscar oferta de parcelamento e cupons
    const offer = await supabaseService.getClientInstallmentOffer();
    const clientCoupons = await supabaseService.getClientCoupons();

    let totalDebt = 0;
    let nextInstDate = '--/--';
    let nextInstVal = 0;

    if (loans.length > 0) {
      const activeLoans = loans.filter(l => l.status === 'APPROVED');
      totalDebt = activeLoans.reduce((acc, curr) => acc + curr.remainingAmount, 0);

      const allInstallments = activeLoans.flatMap(l => l.installments).filter(i => i.status === 'OPEN' || i.status === 'LATE');
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

    setPendingRequest(pendingReq);
    setActiveCampaigns(campaigns);
    setPreApprovedAmount(preApproved);
    setInstallmentOffer(offer);
    setCoupons(clientCoupons);

    if (user) {
      const code = await referralService.getOrCreateCode(user.id, user.name);
      setReferralCode(code.code);
    }

    setLoading(false);
  };

  const handleRenegotiateSubmit = () => {
    addToast(`Proposta de ${renegotiateInstallments}x de R$ ${simulationResult.monthly.toFixed(2)} enviada!`, 'success');
    setIsRenegotiateOpen(false);
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

  const handleDocUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && pendingRequest) {
      setUploadingDoc(true);
      const reader = new FileReader();
      reader.onloadend = async () => {
        const result = reader.result as string;
        await supabaseService.uploadSupplementalDoc(pendingRequest.id, result);
        setUploadingDoc(false);
        setIsUploadModalOpen(false);
        addToast("Documento enviado! Sua análise continuará.", 'success');
        loadDashboardData(); // Refresh state
      };
      reader.readAsDataURL(file);
    }
  };

  const notifications = [
    ...(preApprovedAmount ? [{ id: 99, title: 'Crédito Pré-Aprovado', msg: `Você tem R$ ${preApprovedAmount} disponíveis!`, type: 'success', time: 'Agora' }] : []),
    ...(pendingRequest?.status === LoanStatus.WAITING_DOCS ? [{ id: 98, title: 'Ação Necessária', msg: 'Envie o documento solicitado.', type: 'warning', time: 'Agora' }] : []),
    { id: 1, title: 'Parcela Vencendo', msg: 'Sua fatura vence em 3 dias. Evite juros.', type: 'warning', time: '2h' },
  ];

  const formatCurrency = (val: number) => {
    if (isPrivacyEnabled) return 'R$ ****';
    return `R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
  };

  return (
    <div className="min-h-screen bg-black text-white pb-24 font-sans">
      <MarketingPopup />

      <header className="sticky top-0 z-20 bg-black/80 backdrop-blur-md border-b border-zinc-900 px-6 py-4 flex items-center justify-between">
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
              <div className="absolute right-0 top-full mt-3 w-80 bg-zinc-950 border border-[#D4AF37]/50 rounded-2xl shadow-2xl overflow-hidden z-50">
                <div className="flex items-center justify-between p-4 border-b border-zinc-900 bg-zinc-900/50">
                  <span className="font-bold text-[#D4AF37] text-sm">Notificações</span>
                  <button onClick={() => setIsNotifOpen(false)}><X size={16} /></button>
                </div>
                <div>
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

      <main className="p-6 max-w-lg mx-auto space-y-8 animate-in slide-in-from-bottom-4 duration-500">
        <div className="pl-1">
          <h1 className="text-zinc-500 text-sm font-medium tracking-wide">Bem-vindo de volta,</h1>
          {loading ? <Skeleton className="h-8 w-48 mt-1" /> : <h2 className="text-2xl font-bold text-white tracking-tight">{userData.name}</h2>}
        </div>

        {/* Pre-Approved Offer Banner */}
        {preApprovedAmount && (
          <div className="bg-gradient-to-r from-[#D4AF37] to-[#FDB931] rounded-2xl p-4 shadow-lg shadow-[#D4AF37]/20 relative overflow-hidden animate-pulse">
            <div className="absolute top-0 right-0 p-4 opacity-20">
              <Sparkles size={64} className="text-black" />
            </div>
            <div className="relative z-10 text-black">
              <div className="flex items-center gap-2 mb-1">
                <Sparkles size={16} />
                <span className="text-xs font-bold uppercase tracking-wider">Oferta Especial</span>
              </div>
              <h3 className="text-lg font-bold leading-tight mb-2">Crédito Pré-Aprovado</h3>
              <div className="text-3xl font-extrabold mb-3">R$ {preApprovedAmount.toLocaleString()}</div>
              <Button className="w-full bg-black text-[#D4AF37] hover:bg-zinc-800 border-none">
                Contratar Agora
              </Button>
            </div>
          </div>
        )}

        {/* Waiting Docs Action Card */}
        {pendingRequest && pendingRequest.status === LoanStatus.WAITING_DOCS && (
          <div className="bg-blue-900/20 border border-blue-500/50 rounded-2xl p-4 flex flex-col gap-3">
            <div className="flex items-center gap-3 text-blue-400 font-bold">
              <AlertTriangle size={20} /> Pendência na Análise
            </div>
            <p className="text-sm text-zinc-300">
              Precisamos de um documento complementar: <br />
              <span className="text-white font-bold italic">"{pendingRequest.supplementalInfo?.description}"</span>
            </p>
            <Button onClick={() => setIsUploadModalOpen(true)} className="w-full bg-blue-600 hover:bg-blue-700 text-white border-none">
              <Upload size={16} className="mr-2" /> Enviar Documento
            </Button>
          </div>
        )}

        {/* Loan Progress Timeline */}
        {pendingRequest && (
          <LoanTimeline
            status={pendingRequest.status}
            date={pendingRequest.date}
            amount={pendingRequest.amount}
            installments={pendingRequest.installments}
          />
        )}

        {/* Main Debt Card */}
        <div className="bg-gradient-to-br from-zinc-900 via-zinc-900 to-[#D4AF37]/10 rounded-3xl p-6 border border-zinc-800 relative overflow-hidden shadow-2xl">
          <div className="relative z-10">
            <div className="flex items-center gap-2 text-zinc-400 mb-2">
              <Wallet size={16} />
              <span className="text-xs font-bold uppercase tracking-widest">Saldo Devedor</span>
            </div>

            {loading ? <Skeleton className="h-10 w-40 mb-8" /> : (
              <div className="text-4xl font-bold text-[#D4AF37] mb-8 transition-all">
                {formatCurrency(userData.balance)}
              </div>
            )}

            <div className="flex items-center justify-between p-4 bg-black/40 rounded-xl border border-zinc-800/50 mb-6">
              <div>
                <div className="text-[10px] text-zinc-500 uppercase">Próxima Parcela</div>
                <div className="text-white font-semibold flex items-center gap-2">
                  <Calendar size={14} className="text-shark" />
                  {loading ? <Skeleton className="h-4 w-16" /> : userData.nextDue}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] text-zinc-500 uppercase">Valor</div>
                <div className="text-white font-bold">
                  {loading ? <Skeleton className="h-4 w-20 ml-auto" /> : formatCurrency(userData.nextInstallmentValue)}
                </div>
              </div>
            </div>

            <Button onClick={() => navigate('/client/contracts')} className="w-full bg-shark hover:bg-red-600 shadow-lg" disabled={loading || userData.balance === 0}>
              Pagar Parcela <ChevronRight size={18} />
            </Button>
          </div>
        </div>

        {/* Quick Actions - Cleaned up */}
        <div className="grid grid-cols-3 gap-3">
          <ActionButton icon={FileText} label="Contratos" onClick={() => navigate('/client/contracts')} />
          <ActionButton icon={TrendingUp} label="Extrato" onClick={() => navigate('/client/statement')} />
          <ActionButton icon={Percent} label="Renegociar" onClick={() => setIsRenegotiateOpen(true)} disabled={userData.balance === 0} />
        </div>

        {/* Cards de Acesso: Ofertas, Cupons, Campanhas */}
        <div className="grid grid-cols-3 gap-3">
          {/* Ofertas/Propostas */}
          <button
            onClick={() => setIsOffersModalOpen(true)}
            className="relative flex flex-col items-center gap-2 p-4 rounded-2xl bg-gradient-to-br from-emerald-900/30 to-emerald-900/10 border border-emerald-600/50 hover:border-emerald-400 transition-all"
          >
            <Calculator size={24} className="text-emerald-400" />
            <span className="text-xs font-bold text-white">Ofertas</span>
            {installmentOffer && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-emerald-500 text-black text-xs font-bold rounded-full flex items-center justify-center">1</span>
            )}
          </button>

          {/* Cupons */}
          <button
            onClick={() => setIsCouponsModalOpen(true)}
            className="relative flex flex-col items-center gap-2 p-4 rounded-2xl bg-gradient-to-br from-purple-900/30 to-purple-900/10 border border-purple-600/50 hover:border-purple-400 transition-all"
          >
            <Ticket size={24} className="text-purple-400" />
            <span className="text-xs font-bold text-white">Cupons</span>
            {coupons.length > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-purple-500 text-white text-xs font-bold rounded-full flex items-center justify-center">{coupons.length}</span>
            )}
          </button>

          {/* Campanhas */}
          <button
            onClick={() => setIsCampaignsModalOpen(true)}
            className="relative flex flex-col items-center gap-2 p-4 rounded-2xl bg-gradient-to-br from-amber-900/30 to-amber-900/10 border border-amber-600/50 hover:border-amber-400 transition-all"
          >
            <Megaphone size={24} className="text-amber-400" />
            <span className="text-xs font-bold text-white">Campanhas</span>
            {activeCampaigns.length > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-amber-500 text-black text-xs font-bold rounded-full flex items-center justify-center">{activeCampaigns.length}</span>
            )}
          </button>
        </div>

        {/* Refer a Friend Banner */}
        <div onClick={handleShare} className="bg-gradient-to-r from-zinc-900 to-black border border-zinc-800 rounded-2xl p-4 flex items-center gap-4 cursor-pointer hover:border-[#D4AF37]/30 transition-colors active:scale-95">
          <div className="w-12 h-12 rounded-full bg-[#D4AF37]/10 flex items-center justify-center text-[#D4AF37] shrink-0">
            <Gift size={24} />
          </div>
          <div>
            <h3 className="font-bold text-white text-sm">Indique e Ganhe</h3>
            <p className="text-xs text-zinc-500">Ganhe descontos indicando amigos.</p>
          </div>
          <ChevronRight size={16} className="text-zinc-600 ml-auto" />
        </div>

        {/* FAB */}
        <div className="fixed bottom-20 right-6 md:right-[calc(50%-14rem)] z-30">
          <button onClick={() => navigate('/wizard')} className="bg-shark text-white px-6 py-4 rounded-full shadow-lg hover:bg-red-600 hover:scale-105 transition-all flex items-center gap-3 font-bold border border-white/10">
            <Plus size={24} /> <span>Novo Empréstimo</span>
          </button>
        </div>
      </main>

      {/* Upload Supplemental Doc Modal */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-6 border-b border-zinc-800 pb-4">
              <h3 className="text-xl font-bold text-white">Enviar Documento</h3>
              <button onClick={() => setIsUploadModalOpen(false)}><X className="text-zinc-500 hover:text-white" /></button>
            </div>

            <p className="text-sm text-zinc-400 mb-6">
              Selecione uma foto ou PDF do documento solicitado: <br />
              <strong className="text-white">"{pendingRequest?.supplementalInfo?.description}"</strong>
            </p>

            <div className="relative mb-6">
              <input
                type="file"
                accept="image/*,application/pdf"
                onChange={handleDocUpload}
                className="hidden"
                id="supp-upload"
                disabled={uploadingDoc}
              />
              <label
                htmlFor="supp-upload"
                className={`flex flex-col items-center justify-center gap-2 w-full p-8 rounded-xl border-2 border-dashed cursor-pointer transition-all ${uploadingDoc
                  ? 'bg-zinc-800 border-zinc-700 opacity-50'
                  : 'bg-zinc-900/50 border-zinc-700 hover:border-[#D4AF37] hover:bg-zinc-800'
                  }`}
              >
                <Upload size={32} className="text-[#D4AF37]" />
                <span className="font-bold text-sm text-white">{uploadingDoc ? "Enviando..." : "Toque para selecionar"}</span>
              </label>
            </div>

            <Button onClick={() => setIsUploadModalOpen(false)} variant="secondary" className="w-full">
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {/* Renegotiation Modal */}
      {isRenegotiateOpen && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-[60] p-4 animate-in fade-in zoom-in duration-200">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-[#D4AF37]">Renegociar Saldo</h3>
              <button onClick={() => setIsRenegotiateOpen(false)}><X size={24} className="text-zinc-500 hover:text-white" /></button>
            </div>

            <div className="mb-6 p-4 bg-black rounded-xl border border-zinc-800 text-center">
              <p className="text-zinc-500 text-xs uppercase mb-1">Saldo Atual</p>
              <p className="text-2xl font-bold text-white">{formatCurrency(userData.balance)}</p>
            </div>

            <div className="mb-8">
              <label className="block text-sm text-zinc-400 mb-2">Parcelar em quantas vezes?</label>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min="2"
                  max="24"
                  step="1"
                  value={renegotiateInstallments}
                  onChange={(e) => setRenegotiateInstallments(Number(e.target.value))}
                  className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-[#D4AF37]"
                />
                <span className="font-bold text-white w-12 text-center">{renegotiateInstallments}x</span>
              </div>
            </div>

            <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-900 mb-6">
              <div className="flex justify-between items-center mb-2">
                <span className="text-zinc-400 text-sm">Nova Parcela Estimada:</span>
                <span className="text-[#D4AF37] font-bold text-lg">{formatCurrency(simulationResult.monthly)}</span>
              </div>
              <div className="flex justify-between items-center text-xs text-zinc-500">
                <span>Total ao final:</span>
                <span>{formatCurrency(simulationResult.total)}</span>
              </div>
            </div>

            <Button className="w-full" onClick={handleRenegotiateSubmit}>Confirmar Renegociação</Button>
          </div>
        </div>
      )}

      {/* Modal de Ofertas/Propostas */}
      {isOffersModalOpen && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md p-5 shadow-2xl animate-in zoom-in duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4 border-b border-zinc-800 pb-3">
              <h3 className="text-lg font-bold text-emerald-400 flex items-center gap-2">
                <Calculator size={20} /> Ofertas de Parcelamento
              </h3>
              <button onClick={() => setIsOffersModalOpen(false)}><X className="text-zinc-500 hover:text-white" /></button>
            </div>

            {installmentOffer ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-black/30 p-3 rounded-xl">
                    <p className="text-xs text-zinc-500">Valor</p>
                    <p className="text-lg font-bold text-white">R$ {installmentOffer.amount.toLocaleString('pt-BR')}</p>
                  </div>
                  <div className="bg-black/30 p-3 rounded-xl">
                    <p className="text-xs text-zinc-500">Taxa</p>
                    <p className="text-lg font-bold text-white">{installmentOffer.interestRate}% a.m.</p>
                  </div>
                  <div className="bg-black/30 p-3 rounded-xl">
                    <p className="text-xs text-zinc-500">Total</p>
                    <p className="text-lg font-bold text-white">R$ {installmentOffer.totalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                  </div>
                  <div className="bg-black/30 p-3 rounded-xl">
                    <p className="text-xs text-zinc-500">Parcela</p>
                    <p className="text-lg font-bold text-emerald-400">{installmentOffer.installments}x R$ {installmentOffer.installmentValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                  </div>
                </div>
                <p className="text-xs text-zinc-500 text-center">
                  Proposta enviada em {new Date(installmentOffer.createdAt).toLocaleDateString('pt-BR')}
                </p>
                <Button
                  onClick={() => {
                    setIsOffersModalOpen(false);
                    navigate(`/wizard?amount=${installmentOffer.amount}&installments=${installmentOffer.installments}&rate=${installmentOffer.interestRate}`);
                  }}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white border-none"
                >
                  <CheckCircle size={16} className="mr-2" /> Aceitar Proposta
                </Button>
              </div>
            ) : (
              <div className="text-center py-8 text-zinc-500">
                <Calculator size={48} className="mx-auto mb-4 opacity-30" />
                <p>Nenhuma oferta disponível no momento.</p>
              </div>
            )}
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
                    key={idx}
                    className="bg-gradient-to-r from-purple-900/30 to-purple-900/10 border border-purple-600/50 rounded-xl p-4"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="bg-purple-600 text-white text-xs font-bold px-2 py-1 rounded">{coupon.code}</span>
                        <span className="text-purple-400 font-bold">{coupon.discount}% OFF</span>
                      </div>
                      <Button size="sm" variant="secondary" className="bg-purple-900/50 border-purple-700 text-purple-300">
                        Usar
                      </Button>
                    </div>
                    <p className="text-xs text-zinc-400">{coupon.description}</p>
                    <p className="text-[10px] text-zinc-600">Válido até {new Date(coupon.expiresAt).toLocaleDateString('pt-BR')}</p>
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
