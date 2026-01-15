import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Check, ChevronLeft, User, MapPin,
  AlertCircle, FileText, ScanFace, X, Plus, Loader2,
  Phone, Users, Video, DollarSign, Shield, Clock, Landmark, CheckCircle2, FileCheck, Percent,
  Car, Smartphone, Tv, Home, Package, Camera as CameraIcon
} from 'lucide-react';
import { Button } from '../../components/Button';
import { Camera } from '../../components/Camera';
import { SignaturePad } from '../../components/SignaturePad';
import { VideoUpload } from '../../components/VideoUpload';
import { supabaseService } from '../../services/supabaseService';
import { loanSettingsService, LoanSettings } from '../../services/loanSettingsService';
import { antifraudService } from '../../services/antifraudService';
import { emailService } from '../../services/emailService';
import { useToast } from '../../components/Toast';
import { InstallPwaButton } from '../../components/InstallPwaButton';

// Tipos de garantia
const guaranteeTypes = [
  { id: 'celular', label: 'Celular', icon: Smartphone },
  { id: 'tv', label: 'TV', icon: Tv },
  { id: 'carro', label: 'Carro', icon: Car },
  { id: 'casa', label: 'Casa/Imóvel', icon: Home },
  { id: 'eletrodomestico', label: 'Eletrodoméstico', icon: Package },
  { id: 'outro', label: 'Outro', icon: Package },
];

// Steps
const steps = [
  { id: 1, title: 'Valores', icon: DollarSign },
  { id: 2, title: 'Termos', icon: Shield },
  { id: 3, title: 'Dados', icon: User },
  { id: 4, title: 'Documentos', icon: FileText },
  { id: 5, title: 'Banco', icon: Landmark },
  { id: 6, title: 'Confirmar', icon: CheckCircle2 },
];

export const Wizard: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { addToast } = useToast();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [errors, setErrors] = useState<{ cpf?: string; cep?: string }>({});

  // Flag para quando vem de uma oferta aceita
  const [isFromOffer, setIsFromOffer] = useState(false);

  // Configurações do banco
  const [settings, setSettings] = useState<LoanSettings | null>(null);

  // Aceites
  const [termsAccepted, setTermsAccepted] = useState(false);

  // Valores
  const [selectedAmount, setSelectedAmount] = useState<number>(1000);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [needsGuarantee, setNeedsGuarantee] = useState(false);

  // Garantia
  const [guarantee, setGuarantee] = useState({
    type: '',
    description: '',
    condition: '',
    estimatedValue: '',
    photos: [] as string[],
    video: '',
  });

  const [formData, setFormData] = useState({
    name: '', cpf: '', email: '', phone: '', birthDate: '',
    whatsappPersonal: '',
    contactTrust1: '', contactTrust1Name: '',
    contactTrust2: '', contactTrust2Name: '',
    instagram: '',
    occupation: '', companyName: '', companyAddress: '', workTime: '',
    cep: '', address: '', number: '', income: '',
    selfie: '',
    idCardFront: [] as string[],
    idCardBack: [] as string[],
    proofAddress: [] as string[],
    proofIncome: [] as string[],
    workCard: [] as string[],
    billInName: [] as string[],
    bankStatement: [] as string[],
    hasVehicle: false,
    vehicleCRLV: [] as string[],
    vehicleFront: [] as string[],
    videoSelfie: '',
    videoHouse: '',
    bankName: '',
    pixKey: '',
    pixKeyType: 'cpf',
    accountHolderName: '',
    accountHolderCpf: '',
    signature: '',
  });

  // Carregar configurações REAIS do banco e registrar visita (antifraude)
  useEffect(() => {
    const loadSettings = async () => {
      setLoadingSettings(true);

      // Registrar início do wizard (antifraude - silencioso)
      antifraudService.initSession();
      antifraudService.logRiskEvent('wizard_start').catch(() => { });

      const data = await loanSettingsService.getSettings();
      setSettings(data);
      setLoadingSettings(false);

      // Verificar se veio de uma oferta aceita (via URL params)
      const amountParam = searchParams.get('amount');
      const installmentsParam = searchParams.get('installments');
      const rateParam = searchParams.get('rate');

      if (amountParam) {
        const amount = parseFloat(amountParam);
        setSelectedAmount(amount);
        setCustomAmount(amount.toString());
        setIsFromOffer(true);
        setTermsAccepted(true); // Marcar termos como aceitos (já veio da proposta)

        // Pular diretamente para o step 3 (Dados)
        setCurrentStep(3);

        addToast('Proposta aceita! Complete seus dados para finalizar.', 'success');
      }
    };
    loadSettings();
  }, [searchParams]);

  // Verificar se precisa de garantia
  useEffect(() => {
    if (!settings) return;
    const amount = customAmount ? parseFloat(customAmount) || 0 : selectedAmount;
    setNeedsGuarantee(amount > settings.maxLoanNoGuarantee);
  }, [selectedAmount, customAmount, settings]);

  // Cálculos com taxas REAIS do banco
  const getAmount = () => customAmount ? parseFloat(customAmount) || 0 : selectedAmount;

  const calculateTotal = () => {
    if (!settings) return 0;
    return loanSettingsService.calculateTotal(getAmount(), settings.interestRateMonthly);
  };

  const calculateInstallment = () => {
    if (!settings) return 0;
    return loanSettingsService.calculateInstallment(getAmount(), settings.defaultInstallments, settings.interestRateMonthly);
  };

  // Validação CPF
  const validateCPF = (cpf: string) => {
    const cleanCPF = cpf.replace(/\D/g, '');
    if (cleanCPF.length === 0) return undefined;
    if (cleanCPF.length < 11) return "CPF incompleto";
    if (/^(\d)\1+$/.test(cleanCPF)) return "CPF inválido";
    return undefined;
  };

  const fetchAddress = async (cleanCep: string) => {
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setFormData(prev => ({
          ...prev,
          address: `${data.logradouro}, ${data.bairro}, ${data.localidade} - ${data.uf}`
        }));
      }
    } catch (e) { }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    let newValue = value;

    if (name === 'cpf' || name === 'accountHolderCpf') {
      const nums = value.replace(/\D/g, '').slice(0, 11);
      newValue = nums.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
      if (name === 'cpf') setErrors(prev => ({ ...prev, cpf: validateCPF(newValue) }));
    }

    if (name === 'cep') {
      let v = value.replace(/\D/g, '').slice(0, 8);
      if (v.length > 5) v = v.replace(/^(\d{5})(\d)/, '$1-$2');
      newValue = v;
      if (v.replace(/\D/g, '').length === 8) fetchAddress(v.replace(/\D/g, ''));
    }

    if (['phone', 'whatsappPersonal', 'contactTrust1', 'contactTrust2'].includes(name)) {
      let v = value.replace(/\D/g, '').slice(0, 11);
      v = v.replace(/^(\d{2})(\d)/g, '($1) $2').replace(/(\d)(\d{4})$/, '$1-$2');
      newValue = v;
    }

    setFormData({ ...formData, [name]: newValue });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, fieldName: string, isGuarantee = false) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const newFiles: string[] = [];
      const promises = Array.from(files).map((file: File) => {
        return new Promise<void>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => { newFiles.push(reader.result as string); resolve(); };
          reader.readAsDataURL(file);
        });
      });

      Promise.all(promises).then(() => {
        if (isGuarantee) {
          setGuarantee(prev => ({ ...prev, [fieldName]: [...(prev[fieldName as keyof typeof prev] as string[]), ...newFiles] }));
        } else {
          setFormData(prev => ({ ...prev, [fieldName]: [...(prev[fieldName as keyof typeof prev] as string[]), ...newFiles] }));
        }
      });
    }
  };

  const removeFile = (fieldName: string, index: number, isGuarantee = false) => {
    if (isGuarantee) {
      setGuarantee(prev => {
        const files = prev[fieldName as keyof typeof prev] as string[];
        return { ...prev, [fieldName]: files.filter((_, i) => i !== index) };
      });
    } else {
      setFormData(prev => {
        const files = prev[fieldName as keyof typeof prev] as string[];
        return { ...prev, [fieldName]: files.filter((_, i) => i !== index) };
      });
    }
  };

  const handleNext = async () => {
    if (!settings) return;

    if (currentStep === 1) {
      const amount = getAmount();
      if (amount < settings.minLoanAmount) {
        addToast(`Valor mínimo é R$ ${settings.minLoanAmount}`, 'warning');
        return;
      }
      if (amount > settings.maxLoanAmount) {
        addToast(`Valor máximo é R$ ${settings.maxLoanAmount.toLocaleString('pt-BR')}`, 'warning');
        return;
      }
      if (needsGuarantee && !guarantee.type) {
        addToast("Selecione um bem como garantia.", 'warning');
        return;
      }
      if (needsGuarantee && guarantee.photos.length === 0) {
        addToast("Envie fotos do bem em garantia.", 'warning');
        return;
      }
    }

    if (currentStep === 2 && !termsAccepted) {
      addToast("Aceite os termos para continuar.", 'warning');
      return;
    }

    if (currentStep === 3) {
      if (!formData.name || !formData.cpf || !formData.email || !formData.phone) {
        addToast("Preencha todos os dados pessoais.", 'warning');
        return;
      }
      if (!formData.whatsappPersonal || !formData.contactTrust1 || !formData.contactTrust2) {
        addToast("Preencha os contatos.", 'warning');
        return;
      }
      if (!formData.occupation || !formData.companyName) {
        addToast("Informe dados profissionais.", 'warning');
        return;
      }
    }

    if (currentStep === 4) {
      if (!formData.selfie || formData.idCardFront.length === 0) {
        addToast("Envie selfie e documento.", 'warning');
        return;
      }
      if (!formData.videoSelfie) {
        addToast("Grave o vídeo de confirmação.", 'warning');
        return;
      }
    }

    if (currentStep === 5) {
      if (!formData.bankName || !formData.pixKey || !formData.accountHolderName) {
        addToast("Preencha dados bancários.", 'warning');
        return;
      }
    }

    if (currentStep < 6) setCurrentStep(c => c + 1);
  };

  const handleBack = () => { if (currentStep > 1) setCurrentStep(c => c - 1); };

  const handleSubmit = async () => {
    if (!formData.signature || !settings) {
      addToast("Assine para confirmar.", 'warning');
      return;
    }

    setLoading(true);

    try {
      // Registrar evento de submissão (antifraude)
      const riskData = await antifraudService.logRiskEvent('form_submit', undefined, {
        amount: getAmount(),
        hasGuarantee: needsGuarantee,
      });

      // Verificar se é alto risco
      if (riskData && antifraudService.isHighRisk(riskData.riskScore)) {
        addToast("Sua solicitação será analisada manualmente.", 'info');
      }

      // Submeter o pedido
      const success = await supabaseService.submitRequest({
        ...formData,
        amount: getAmount(),
        installments: settings.defaultInstallments,
        totalAmount: calculateTotal(),
        installmentValue: calculateInstallment(),
        interestRate: settings.interestRateMonthly,
        lateFeeDaily: settings.lateFeeDaily,
        lateFeeMonthly: settings.lateFeeMonthly,
        lateFeeFixed: settings.lateFeeFixed,
        hasGuarantee: needsGuarantee,
        guarantee: needsGuarantee ? guarantee : null,
        // Dados antifraude
        sessionId: antifraudService.getSessionId(),
        riskScore: riskData?.riskScore || 0,
        riskFactors: riskData?.riskFactors || [],
      });

      if (!success) {
        throw new Error('Falha ao submeter');
      }

      // Registrar assinatura (antifraude - silencioso)
      antifraudService.logRiskEvent('contract_signed', undefined, {
        signature: true,
        termsAccepted: true,
      }).catch(() => { });

      // Enviar emails de notificação (silencioso)
      // Envia para admin E para o cliente automaticamente
      emailService.notifyNewRequest({
        clientName: formData.name,
        clientEmail: formData.email,
        amount: getAmount(),
        installments: settings.defaultInstallments,
      }).catch(() => { });

      setLoading(false);
      addToast("Solicitação enviada!", 'success');
      navigate('/client/dashboard');
    } catch (error) {
      setLoading(false);
      addToast("Erro ao enviar. Tente novamente.", 'error');
    }
  };

  const renderUploadArea = (name: string, label: string, files: string[], isGuarantee = false) => (
    <div className="space-y-3">
      <label className="text-sm text-zinc-400 font-medium block">{label}</label>
      <div className="grid grid-cols-3 gap-2">
        {files.map((file, idx) => (
          <div key={idx} className="relative aspect-square rounded-lg overflow-hidden border border-zinc-700 bg-black group">
            <img src={file} alt="" className="w-full h-full object-cover" />
            <button onClick={() => removeFile(name, idx, isGuarantee)} className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <X size={12} />
            </button>
          </div>
        ))}
        <div className="relative group">
          <input type="file" id={`${isGuarantee ? 'g-' : ''}${name}`} multiple accept="image/*" onChange={(e) => handleFileChange(e, name, isGuarantee)} className="hidden" />
          <label htmlFor={`${isGuarantee ? 'g-' : ''}${name}`} className="flex flex-col items-center justify-center w-full aspect-square rounded-lg border border-dashed border-zinc-700 bg-zinc-900/50 hover:border-[#D4AF37] cursor-pointer">
            <Plus size={24} className="text-zinc-500" />
          </label>
        </div>
      </div>
    </div>
  );

  if (loadingSettings) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 size={48} className="animate-spin text-[#D4AF37]" />
      </div>
    );
  }

  if (!settings) return null;

  return (
    <div className="min-h-screen bg-black text-white font-sans pb-32">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-black/80 backdrop-blur-md border-b border-zinc-900 p-4 flex items-center justify-between">
        <div className="flex items-center gap-2" onClick={() => navigate('/')}>
          <ChevronLeft className="text-zinc-400" />
          <span className="font-bold">Solicitar Empréstimo</span>
        </div>
        <div className="flex items-center gap-3">
          <InstallPwaButton className="!py-1.5 !px-3" />
          <div className="text-sm font-medium text-[#D4AF37]">{currentStep}/6</div>
        </div>
      </div>

      <div className="max-w-xl mx-auto px-4 pt-6">
        {/* Progress */}
        <div className="flex justify-between mb-8 relative">
          <div className="absolute top-1/2 left-0 w-full h-0.5 bg-zinc-800 -z-10 -translate-y-1/2"></div>
          {steps.map((step) => {
            const Icon = step.icon;
            const isActive = step.id === currentStep;
            const isCompleted = step.id < currentStep;
            return (
              <div key={step.id} className="bg-black px-1 z-10">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center ${isActive ? 'bg-[#D4AF37] text-black' : isCompleted ? 'bg-zinc-800 text-[#D4AF37] border border-[#D4AF37]' : 'bg-zinc-900 text-zinc-600 border border-zinc-800'
                  }`}>
                  {isCompleted ? <Check size={16} /> : <Icon size={16} />}
                </div>
              </div>
            );
          })}
        </div>

        <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-6 shadow-2xl">

          {/* STEP 1: Valores */}
          {currentStep === 1 && (
            <div className="space-y-6 animate-in slide-in-from-right">
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold">Quanto você precisa?</h2>
                <p className="text-zinc-400 text-sm mt-2">Valores até R$ {settings.maxLoanNoGuarantee.toLocaleString('pt-BR')}</p>
              </div>

              {/* Pacotes */}
              <div className="grid grid-cols-3 gap-3">
                {settings.loanPackages.map((pkg, idx) => (
                  <button
                    key={idx}
                    onClick={() => { setSelectedAmount(pkg); setCustomAmount(''); }}
                    className={`p-4 rounded-xl border-2 transition-all ${selectedAmount === pkg && !customAmount ? 'border-[#D4AF37] bg-[#D4AF37]/10' : 'border-zinc-800 bg-zinc-900 hover:border-zinc-600'
                      }`}
                  >
                    <span className="text-lg font-bold">R$ {pkg.toLocaleString('pt-BR')}</span>
                  </button>
                ))}
              </div>

              {/* Valor personalizado */}
              <div className="space-y-2">
                <label className="text-sm text-zinc-400">Ou digite outro valor:</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500">R$</span>
                  <input
                    type="number"
                    value={customAmount}
                    onChange={(e) => setCustomAmount(e.target.value)}
                    placeholder="0,00"
                    className="w-full bg-black border border-zinc-700 rounded-xl pl-12 pr-4 py-4 text-white text-xl font-bold focus:border-[#D4AF37] outline-none"
                  />
                </div>
              </div>

              {/* Aviso de análise */}
              <div className="bg-blue-900/20 border border-blue-600/30 rounded-xl p-4">
                <p className="text-sm text-blue-400">
                  <AlertCircle size={16} className="inline mr-2" />
                  Todos os valores passam por <strong>análise de crédito</strong>.
                </p>
              </div>

              {/* Aviso de garantia */}
              {needsGuarantee && (
                <div className="bg-yellow-900/20 border border-yellow-600/30 rounded-xl p-4 space-y-4">
                  <p className="text-sm text-yellow-400 flex items-start gap-2">
                    <AlertCircle size={18} className="shrink-0 mt-0.5" />
                    <span>Valores acima de <strong>R$ {settings.maxLoanNoGuarantee.toLocaleString('pt-BR')}</strong> precisam de um <strong>bem como garantia</strong>.</span>
                  </p>

                  {/* Tipo de garantia */}
                  <div className="space-y-3">
                    <label className="text-sm text-zinc-400">Selecione o tipo de bem:</label>
                    <div className="grid grid-cols-3 gap-2">
                      {guaranteeTypes.map((g) => {
                        const Icon = g.icon;
                        return (
                          <button
                            key={g.id}
                            onClick={() => setGuarantee(prev => ({ ...prev, type: g.id }))}
                            className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${guarantee.type === g.id ? 'border-[#D4AF37] bg-[#D4AF37]/10' : 'border-zinc-700 bg-black hover:border-zinc-500'
                              }`}
                          >
                            <Icon size={24} className={guarantee.type === g.id ? 'text-[#D4AF37]' : 'text-zinc-500'} />
                            <span className="text-xs">{g.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Detalhes do bem */}
                  {guarantee.type && (
                    <div className="space-y-3 pt-3 border-t border-zinc-800">
                      <Input label="Descrição do Bem" name="description" value={guarantee.description}
                        onChange={(e) => setGuarantee(prev => ({ ...prev, description: e.target.value }))}
                        placeholder="Ex: iPhone 13 Pro Max 256GB" />

                      <Input label="Condições do Bem" name="condition" value={guarantee.condition}
                        onChange={(e) => setGuarantee(prev => ({ ...prev, condition: e.target.value }))}
                        placeholder="Ex: Excelente, com nota fiscal" />

                      <Input label="Valor Estimado (R$)" name="estimatedValue" type="number"
                        value={guarantee.estimatedValue}
                        onChange={(e) => setGuarantee(prev => ({ ...prev, estimatedValue: e.target.value }))}
                        placeholder="0,00" />

                      {/* Fotos do bem */}
                      {renderUploadArea('photos', 'Fotos do Bem (obrigatório)', guarantee.photos, true)}

                      {/* Vídeo do bem */}
                      <div className="bg-black p-4 rounded-xl border border-zinc-800">
                        <VideoUpload
                          label="Vídeo do Bem (opcional)"
                          subtitle="Mostre o bem funcionando"
                          videoUrl={guarantee.video}
                          onUpload={(url) => setGuarantee(prev => ({ ...prev, video: url }))}
                          onRemove={() => setGuarantee(prev => ({ ...prev, video: '' }))}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Informação sobre próximos passos */}
              <div className="bg-black border border-zinc-700 rounded-2xl p-5">
                <div className="text-center space-y-3">
                  <Clock size={32} className="mx-auto text-[#D4AF37]" />
                  <h3 className="font-bold text-white">Valor Solicitado</h3>
                  <p className="text-3xl font-bold text-[#D4AF37]">
                    R$ {getAmount().toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-sm text-zinc-400">
                    Após a análise, apresentaremos as condições de pagamento.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Termos */}
          {currentStep === 2 && (
            <div className="space-y-6 animate-in slide-in-from-right">
              <div className="text-center mb-4">
                <Shield size={48} className="mx-auto text-[#D4AF37] mb-3" />
                <h2 className="text-xl font-bold">Termos e Condições</h2>
              </div>

              {/* Taxas REAIS do banco */}
              <div className="bg-red-900/20 border border-red-600/30 rounded-xl p-4 space-y-3">
                <h3 className="font-bold text-red-400 text-sm uppercase flex items-center gap-2">
                  <AlertCircle size={16} /> Taxas e Juros
                </h3>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="bg-black/30 p-3 rounded-lg">
                    <p className="text-zinc-500 text-xs">Juros ao Dia</p>
                    <p className="text-white font-bold text-lg">{settings.interestRateDaily.toFixed(2)}%</p>
                  </div>
                  <div className="bg-black/30 p-3 rounded-lg">
                    <p className="text-zinc-500 text-xs">Juros ao Mês</p>
                    <p className="text-white font-bold text-lg">{settings.interestRateMonthly}%</p>
                  </div>
                  <div className="bg-black/30 p-3 rounded-lg">
                    <p className="text-zinc-500 text-xs">Juros ao Ano</p>
                    <p className="text-white font-bold text-lg">{settings.interestRateYearly}%</p>
                  </div>
                  <div className="bg-black/30 p-3 rounded-lg">
                    <p className="text-zinc-500 text-xs">Multa Fixa Atraso</p>
                    <p className="text-white font-bold text-lg">R$ {settings.lateFeeFixed.toFixed(2)}</p>
                  </div>
                </div>

                <div className="pt-3 border-t border-red-900/50 text-xs text-red-300 space-y-1">
                  <p>• Em atraso: <strong>{settings.lateFeeDaily}% ao dia</strong> + multa fixa</p>
                  <p>• Juros moratórios: <strong>{settings.lateFeeMonthly}% ao mês</strong></p>
                </div>
              </div>

              {/* Documentos */}
              <div className="bg-black border border-zinc-800 rounded-xl p-4 space-y-3">
                <h3 className="font-bold text-[#D4AF37] text-sm uppercase flex items-center gap-2">
                  <FileCheck size={16} /> Documentos Necessários
                </h3>
                {['Nome completo', 'Tempo de carteira (mín. 3 meses)', 'Profissão e empresa', 'Holerite ou extrato', 'Selfie com RG ou CNH', 'Comprovante de endereço + boleto', 'Carteira de Trabalho Digital', 'Vídeo confirmando juros'].map((doc, idx) => (
                  <div key={idx} className="flex items-start gap-3 py-2 border-b border-zinc-900 last:border-0">
                    <CheckCircle2 size={16} className="text-green-500 mt-0.5 shrink-0" />
                    <span className="text-sm text-zinc-300">{doc}</span>
                  </div>
                ))}
              </div>

              <div className="bg-green-900/20 border border-green-600/30 rounded-xl p-4">
                <p className="text-sm text-green-400 flex items-center gap-2">
                  <Clock size={18} /> Liberação em até <strong>{settings.releaseTimeHours}h</strong> após aprovação.
                </p>
              </div>

              <label className="flex items-start gap-4 p-4 bg-zinc-900 border border-zinc-800 rounded-xl cursor-pointer hover:border-[#D4AF37]">
                <input type="checkbox" checked={termsAccepted} onChange={(e) => setTermsAccepted(e.target.checked)} className="mt-1 accent-[#D4AF37] w-6 h-6" />
                <div>
                  <span className="text-white font-bold">Li e aceito os termos</span>
                  <p className="text-xs text-zinc-500 mt-1">Estou ciente dos juros de {settings.interestRateMonthly}% a.m. e multas.</p>
                </div>
              </label>
            </div>
          )}

          {/* STEP 3-6: Dados, Documentos, Banco, Confirmação */}
          {currentStep === 3 && (
            <div className="space-y-5 animate-in slide-in-from-right">
              <h2 className="text-xl font-bold">Seus Dados</h2>
              <div className="space-y-4">
                <Input label="Nome Completo" name="name" value={formData.name} onChange={handleChange} placeholder="Seu nome" />
                <Input label="CPF" name="cpf" value={formData.cpf} onChange={handleChange} placeholder="000.000.000-00" error={errors.cpf} />
                <Input label="Email" type="email" name="email" value={formData.email} onChange={handleChange} placeholder="email@email.com" />
                <Input label="Nascimento" type="date" name="birthDate" value={formData.birthDate} onChange={handleChange} />
                <Input label="WhatsApp" name="phone" value={formData.phone} onChange={handleChange} placeholder="(00) 00000-0000" />
              </div>
              <div className="pt-4 border-t border-zinc-800 space-y-4">
                <h3 className="text-sm font-bold text-[#D4AF37]">Contatos</h3>
                <Input label="Outro WhatsApp" name="whatsappPersonal" value={formData.whatsappPersonal} onChange={handleChange} placeholder="(00) 00000-0000" />
                <Input label="Contato 1 - Nome" name="contactTrust1Name" value={formData.contactTrust1Name} onChange={handleChange} placeholder="Nome" />
                <Input label="Contato 1 - Tel" name="contactTrust1" value={formData.contactTrust1} onChange={handleChange} placeholder="(00) 00000-0000" />
                <Input label="Contato 2 - Nome" name="contactTrust2Name" value={formData.contactTrust2Name} onChange={handleChange} placeholder="Nome" />
                <Input label="Contato 2 - Tel" name="contactTrust2" value={formData.contactTrust2} onChange={handleChange} placeholder="(00) 00000-0000" />
                <Input label="Instagram" name="instagram" value={formData.instagram} onChange={handleChange} placeholder="@usuario" />
              </div>
              <div className="pt-4 border-t border-zinc-800 space-y-4">
                <h3 className="text-sm font-bold text-[#D4AF37]">Profissional</h3>
                <Input label="Profissão" name="occupation" value={formData.occupation} onChange={handleChange} placeholder="Ex: Vendedor" />
                <Input label="Empresa" name="companyName" value={formData.companyName} onChange={handleChange} placeholder="Nome" />
                <Input label="Endereço Empresa" name="companyAddress" value={formData.companyAddress} onChange={handleChange} placeholder="Endereço" />
                <Input label="Tempo Carteira" name="workTime" value={formData.workTime} onChange={handleChange} placeholder="Ex: 6 meses" />
              </div>
              <div className="pt-4 border-t border-zinc-800 space-y-4">
                <h3 className="text-sm font-bold text-[#D4AF37]">Endereço</h3>
                <Input label="CEP" name="cep" value={formData.cep} onChange={handleChange} placeholder="00000-000" />
                <Input label="Endereço" name="address" value={formData.address} readOnly className="opacity-60" />
                <div className="grid grid-cols-2 gap-4">
                  <Input label="Número" name="number" value={formData.number} onChange={handleChange} placeholder="123" />
                  <Input label="Renda" name="income" type="number" value={formData.income} onChange={handleChange} placeholder="0,00" />
                </div>
              </div>
            </div>
          )}

          {currentStep === 4 && (
            <div className="space-y-6 animate-in slide-in-from-right">
              <h2 className="text-xl font-bold">Documentos</h2>
              <div className="bg-black p-4 rounded-xl border border-zinc-800">
                <Camera label="Selfie com Documento" onCapture={(img) => setFormData({ ...formData, selfie: img })} />
              </div>
              <div className="bg-black p-4 rounded-xl border border-zinc-800">
                <VideoUpload label="Vídeo Confirmação" subtitle={`Diga seu nome e que está ciente dos juros de ${settings.interestRateMonthly}%`}
                  videoUrl={formData.videoSelfie} onUpload={(url) => setFormData({ ...formData, videoSelfie: url })}
                  onRemove={() => setFormData({ ...formData, videoSelfie: '' })} />
              </div>
              {renderUploadArea('idCardFront', 'RG/CNH Frente', formData.idCardFront)}
              {renderUploadArea('idCardBack', 'RG/CNH Verso', formData.idCardBack)}
              {renderUploadArea('proofAddress', 'Comprovante Endereço', formData.proofAddress)}
              {renderUploadArea('billInName', 'Boleto em seu Nome', formData.billInName)}
              {renderUploadArea('proofIncome', 'Holerite/Extrato', formData.proofIncome)}
              {renderUploadArea('workCard', 'Carteira de Trabalho', formData.workCard)}
              {renderUploadArea('bankStatement', 'Extrato Bancário', formData.bankStatement)}
            </div>
          )}

          {currentStep === 5 && (
            <div className="space-y-6 animate-in slide-in-from-right">
              <div className="text-center">
                <Landmark size={48} className="mx-auto text-[#D4AF37] mb-3" />
                <h2 className="text-xl font-bold">Dados para Depósito</h2>
              </div>
              <Input label="Banco" name="bankName" value={formData.bankName} onChange={handleChange} placeholder="Ex: Nubank" />
              <div className="grid grid-cols-4 gap-2">
                {[{ v: 'cpf', l: 'CPF' }, { v: 'phone', l: 'Celular' }, { v: 'email', l: 'Email' }, { v: 'random', l: 'Aleatória' }].map(o => (
                  <button key={o.v} type="button" onClick={() => setFormData({ ...formData, pixKeyType: o.v })}
                    className={`p-2 rounded-lg border text-sm ${formData.pixKeyType === o.v ? 'border-[#D4AF37] text-[#D4AF37]' : 'border-zinc-700 text-zinc-400'}`}>{o.l}</button>
                ))}
              </div>
              <Input label="Chave PIX" name="pixKey" value={formData.pixKey} onChange={handleChange} placeholder="Sua chave" />
              <Input label="Nome Titular" name="accountHolderName" value={formData.accountHolderName} onChange={handleChange} placeholder="Nome no banco" />
              <Input label="CPF Titular" name="accountHolderCpf" value={formData.accountHolderCpf} onChange={handleChange} placeholder="000.000.000-00" />
            </div>
          )}

          {currentStep === 6 && (
            <div className="space-y-6 animate-in slide-in-from-right">
              <div className="text-center">
                <CheckCircle2 size={48} className="mx-auto text-green-500 mb-3" />
                <h2 className="text-xl font-bold">Confirme sua Solicitação</h2>
              </div>

              <div className="bg-black border border-zinc-800 rounded-xl p-4 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-zinc-400">Valor:</span><span className="font-bold">R$ {getAmount().toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></div>
                <div className="flex justify-between"><span className="text-zinc-400">Taxa:</span><span className="font-bold">{settings.interestRateMonthly}% a.m.</span></div>
                <div className="flex justify-between"><span className="text-zinc-400">Total:</span><span className="font-bold">R$ {calculateTotal().toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></div>
                <div className="flex justify-between"><span className="text-zinc-400">Parcela:</span><span className="font-bold text-[#D4AF37]">{settings.defaultInstallments}x R$ {calculateInstallment().toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></div>
                {needsGuarantee && <div className="flex justify-between"><span className="text-zinc-400">Garantia:</span><span className="font-bold text-yellow-400">{guarantee.description}</span></div>}
              </div>

              {/* TERMO FINAL */}
              <div className="bg-red-900/20 border border-red-600/30 rounded-xl p-4 space-y-2">
                <h3 className="font-bold text-red-400 text-xs uppercase">TERMO DE COMPROMISSO</h3>
                <ul className="text-xs text-zinc-400 space-y-1 ml-4 list-disc">
                  <li>Juros: <strong className="text-white">{settings.interestRateMonthly}% ao mês</strong> ({settings.interestRateDaily.toFixed(2)}%/dia | {settings.interestRateYearly}%/ano)</li>
                  <li>Atraso: <strong className="text-white">{settings.lateFeeDaily}% ao dia</strong></li>
                  <li>Multa fixa: <strong className="text-white">R$ {settings.lateFeeFixed.toFixed(2)}</strong></li>
                  <li>Mora: <strong className="text-white">{settings.lateFeeMonthly}% ao mês</strong></li>
                </ul>
              </div>

              <div>
                <h3 className="font-bold mb-3">Assinatura Digital</h3>
                <SignaturePad onSign={(sig) => setFormData({ ...formData, signature: sig })} />
              </div>

              <div className="bg-[#D4AF37]/10 border border-[#D4AF37]/30 rounded-xl p-4 text-center">
                <p className="text-sm text-[#D4AF37]">
                  <Clock size={16} className="inline mr-2" />
                  Depósito em até <strong>{settings.releaseTimeHours}h</strong> após aprovação.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Buttons */}
        <div className="fixed bottom-0 left-0 w-full p-4 bg-black/90 border-t border-zinc-900 flex gap-4 z-40 backdrop-blur-md">
          {currentStep > 1 && <Button onClick={handleBack} variant="secondary" className="flex-1">Voltar</Button>}
          {currentStep < 6 ? (
            <Button onClick={handleNext} className="flex-1">Continuar</Button>
          ) : (
            <Button onClick={handleSubmit} className="flex-1 bg-green-600 hover:bg-green-700" isLoading={loading} disabled={!formData.signature}>
              Enviar Solicitação
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

const Input = ({ label, error, className = "", ...props }: any) => (
  <div>
    <label className="block text-xs text-zinc-400 mb-1.5 ml-1">{label}</label>
    <input className={`w-full bg-black border rounded-lg p-3 text-white text-sm focus:border-[#D4AF37] outline-none ${error ? 'border-red-900' : 'border-zinc-700'} ${className}`} {...props} />
    {error && <p className="text-xs text-red-500 mt-1 ml-1">{error}</p>}
  </div>
);