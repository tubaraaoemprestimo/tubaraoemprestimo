import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Check, ChevronLeft, User, MapPin,
  AlertCircle, FileText, ScanFace, X, Plus, Loader2,
  Phone, Users, Video, DollarSign, Shield, Clock, Landmark, CheckCircle2, FileCheck, Percent,
  Car, Smartphone, Tv, Home, Package, Camera as CameraIcon,
  Briefcase, Store, Bike, Banknote, Rocket, CreditCard, FileSignature, Scale
} from 'lucide-react';
import { Button } from '../../components/Button';
import { Camera } from '../../components/Camera';
import { SignaturePad } from '../../components/SignaturePad';
import { VideoUpload } from '../../components/VideoUpload';
import { supabaseService } from '../../services/supabaseService';
import { loanSettingsService, LoanSettings } from '../../services/loanSettingsService';
import { antifraudService } from '../../services/antifraudService';
import { emailService } from '../../services/emailService';
import { autoNotificationService } from '../../services/autoNotificationService';
import { useToast } from '../../components/Toast';
import { InstallPwaButton } from '../../components/InstallPwaButton';
import { SERVICE_TERMS } from '../../constants/serviceTerms';

// Tipos de garantia (para CLT com valores altos)
const guaranteeTypes = [
  { id: 'celular', label: 'Celular', icon: Smartphone },
  { id: 'tv', label: 'TV', icon: Tv },
  { id: 'carro', label: 'Carro', icon: Car },
  { id: 'casa', label: 'Casa/Imóvel', icon: Home },
  { id: 'eletrodomestico', label: 'Eletrodoméstico', icon: Package },
  { id: 'outro', label: 'Outro', icon: Package },
];

// NOVOS Tipos de Perfil - Multi Sistema (6 Serviços)
type ProfileType = 'CLT' | 'AUTONOMO' | 'MOTO' | 'GARANTIA' | 'LIMPA_NOME' | 'INVESTIDOR' | '';

// Configuração dos perfis com descrições e cores para Admin
const profileOptions = [
  {
    id: 'CLT',
    label: 'CLT / Assalariado',
    icon: Briefcase,
    description: 'Empréstimo pessoal com juros de 30% ao mês',
    color: 'text-blue-400',
    adminColor: 'bg-gray-500'
  },
  {
    id: 'AUTONOMO',
    label: 'Autônomo / Comércio',
    icon: Store,
    description: 'Capital de giro com 30 diárias (seg-sáb)',
    color: 'text-green-400',
    adminColor: 'bg-green-500'
  },
  {
    id: 'MOTO',
    label: 'Financiamento Moto',
    icon: Bike,
    description: 'Compre sua moto: R$2.000 + 36x R$611',
    color: 'text-yellow-400',
    adminColor: 'bg-yellow-500'
  },
  {
    id: 'GARANTIA',
    label: 'Empréstimo c/ Garantia',
    icon: Car,
    description: 'Deixe um bem como garantia (veículo/eletrônico)',
    color: 'text-orange-400',
    adminColor: 'bg-orange-500'
  },
  {
    id: 'LIMPA_NOME',
    label: 'Limpa Nome',
    icon: CreditCard,
    description: 'Contestação administrativa de negativação',
    color: 'text-purple-400',
    adminColor: 'bg-purple-500'
  },
  {
    id: 'INVESTIDOR',
    label: 'Seja um Investidor',
    icon: Rocket,
    description: 'Invista a partir de R$10.000 e lucre até 6%/mês',
    color: 'text-cyan-400',
    adminColor: 'bg-cyan-600'
  },
];

// Steps dinâmicos baseados no perfil
const getStepsForProfile = (profile: ProfileType) => {
  // INVESTIDOR tem fluxo próprio: Info > Dados > Investimento > Banco > Termos > Confirmar
  if (profile === 'INVESTIDOR') {
    return [
      { id: 1, title: 'Serviço', icon: Users },
      { id: 2, title: 'Saiba Mais', icon: Shield },
      { id: 3, title: 'Dados', icon: User },
      { id: 4, title: 'Investimento', icon: DollarSign },
      { id: 5, title: 'Banco', icon: Landmark },
      { id: 6, title: 'Termos', icon: FileSignature },
      { id: 7, title: 'Confirmar', icon: CheckCircle2 },
    ];
  }
  // LIMPA_NOME é um SERVIÇO simples - não precisa de documentos
  if (profile === 'LIMPA_NOME') {
    return [
      { id: 1, title: 'Serviço', icon: Users },
      { id: 2, title: 'Termos', icon: Shield },
      { id: 3, title: 'Dados', icon: User },
      { id: 4, title: 'Contrato', icon: FileSignature },
      { id: 5, title: 'Confirmar', icon: CheckCircle2 },
    ];
  }
  if (profile === 'MOTO') {
    return [
      { id: 1, title: 'Serviço', icon: Users },
      { id: 2, title: 'Termos', icon: Shield },
      { id: 3, title: 'Dados', icon: User },
      { id: 4, title: 'Produto', icon: Car },
      { id: 5, title: 'Documentos', icon: FileText },
      { id: 6, title: 'Confirmar', icon: CheckCircle2 },
    ];
  }
  if (profile === 'GARANTIA') {
    return [
      { id: 1, title: 'Serviço', icon: Users },
      { id: 2, title: 'Valores', icon: DollarSign },
      { id: 3, title: 'Termos', icon: Shield },
      { id: 4, title: 'Garantia', icon: Car },
      { id: 5, title: 'Dados', icon: User },
      { id: 6, title: 'Documentos', icon: FileText },
      { id: 7, title: 'Banco', icon: Landmark },
      { id: 8, title: 'Confirmar', icon: CheckCircle2 },
    ];
  }
  // CLT e AUTONOMO usam o mesmo fluxo (7 etapas)
  return [
    { id: 1, title: 'Perfil', icon: Users },
    { id: 2, title: 'Valores', icon: DollarSign },
    { id: 3, title: 'Termos', icon: Shield },
    { id: 4, title: 'Dados', icon: User },
    { id: 5, title: 'Documentos', icon: FileText },
    { id: 6, title: 'Banco', icon: Landmark },
    { id: 7, title: 'Confirmar', icon: CheckCircle2 },
  ];
};

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

  // Perfil e Condicionais
  const [profileType, setProfileType] = useState<ProfileType>('');
  const [hasEntryValue, setHasEntryValue] = useState(false); // Para Moto

  // Steps dinâmicos baseados no perfil selecionado
  const steps = getStepsForProfile(profileType);

  // Cliente recorrente (já fez empréstimo antes do sistema)
  const [isReturningClient, setIsReturningClient] = useState<'sim' | 'nao' | ''>('');
  const [returningClientNote, setReturningClientNote] = useState('');

  // Aceites
  const [termsAccepted, setTermsAccepted] = useState(false);

  // Investidor - campos específicos
  const [investorData, setInvestorData] = useState({
    fullName: '', cpfCnpj: '', rgCnh: '', birthDate: '',
    email: '', phone: '',
    address: '', city: '', state: '', zipCode: '',
    bankName: '', pixKey: '', pixKeyType: 'cpf', accountHolderName: '',
    investmentAmount: 10000,
    customInvestmentAmount: '',
    investmentTier: 'STANDARD' as 'STANDARD' | 'PREMIUM',
    payoutMode: 'MONTHLY' as 'MONTHLY' | 'ANNUAL',
    monthlyRate: 2.5,
    showInfoPage: true,
  });

  // Valores
  const [selectedAmount, setSelectedAmount] = useState<number>(1000);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [needsGuarantee, setNeedsGuarantee] = useState(false);

  // Garantia Universal (usado para Garantia Veículo tb)
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
    // Autônomo
    cnpj: '', businessAddress: '',
    cep: '', address: '', number: '', income: '',
    selfie: '',
    idCardFront: [] as string[],
    idCardBack: [] as string[],
    proofAddress: [] as string[],
    proofIncome: [] as string[],
    workCard: [] as string[],
    billInName: [] as string[], // Boleto com nome do cliente
    bankStatement: [] as string[],
    // Moto / Veículo
    cnh: [] as string[],
    vehicleCRLV: [] as string[],
    vehicleFront: [] as string[],
    proofPurchase: [] as string[], // Nota fiscal para eletrônicos
    // Vídeos
    videoSelfie: '',
    videoHouse: '', // Vídeo mostrando a residência
    // Fotos da casa/fachada
    housePhotos: [] as string[],
    // Localização em tempo real
    location: null as { latitude: number; longitude: number; accuracy: number } | null,
    // Banco
    bankName: '',
    pixKey: '',
    pixKeyType: 'cpf',
    accountHolderName: '',
    accountHolderCpf: '',
    signature: '',
    // Limpa Nome
    limpaNomeContractSigned: false,
    // Moto - Cor selecionada
    motoColor: '',
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

      if (amountParam) {
        const amount = parseFloat(amountParam);
        setSelectedAmount(amount);
        setCustomAmount(amount.toString());
        setIsFromOffer(true);
        setTermsAccepted(true); // Marcar termos como aceitos (já veio da proposta)

        // Se vier de oferta, assumimos CLT por padrão ou deixamos ele escolher?
        // Vamos deixar ele escolher o perfil por segurança (STEP 1), mas com valores preenchidos.
        // Ou pulamos para Step 4 (Dados)? 
        // Vamos pular para Step 4 (Dados) e assumir CLT se não tiver info, mas ideal é forçar escolha.
        // Decisão: Forçar escolha de perfil no Step 1, mas já com valores preenchidos.
        setCurrentStep(1);

        addToast('Proposta iniciada! Confirme seu perfil e dados.', 'success');
      }
    };
    loadSettings();
  }, [searchParams]);

  // Verificar se precisa de garantia
  useEffect(() => {
    if (!settings) return;
    const amount = customAmount ? parseFloat(customAmount) || 0 : selectedAmount;
    // Se for perfil Garantia Veículo, sempre precisa de garantia
    if (profileType === 'GARANTIA_VEICULO') {
      setNeedsGuarantee(true);
      setGuarantee(prev => ({ ...prev, type: 'carro' }));
    } else {
      setNeedsGuarantee(amount > settings.maxLoanNoGuarantee);
    }
  }, [selectedAmount, customAmount, settings, profileType]);

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

    if (name === 'cpf' || name === 'accountHolderCpf' || name === 'cnpj') {
      const nums = value.replace(/\D/g, '');
      // Mascara simples
      if (nums.length <= 11) {
        newValue = nums.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
      } else {
        newValue = nums.replace(/^(\d{2})(\d)/, '$1.$2').replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d)/, '.$1/$2').replace(/(\d{4})(\d)/, '$1-$2');
      }
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

    // STEP 1: Perfil/Serviço
    if (currentStep === 1) {
      if (!profileType) {
        addToast("Selecione um serviço para continuar.", 'warning');
        return;
      }
      // INVESTIDOR não precisa de verificação de cliente recorrente
      // Cliente recorrente apenas para CLT, AUTONOMO e GARANTIA
      if ((profileType === 'CLT' || profileType === 'AUTONOMO' || profileType === 'GARANTIA') && !isReturningClient) {
        addToast("Por favor, informe se já é nosso cliente.", 'warning');
        return;
      }
    }

    // === INVESTIDOR: Validações específicas por step ===
    if (profileType === 'INVESTIDOR') {
      // Step 2: "Saiba Mais" - apenas informativo, sem validação
      // Step 3: Dados pessoais
      if (currentStep === 3) {
        if (!investorData.fullName.trim()) { addToast("Informe seu nome completo ou razão social.", 'warning'); return; }
        const cpfCnpjDigits = investorData.cpfCnpj.replace(/\D/g, '');
        if (!cpfCnpjDigits || (cpfCnpjDigits.length !== 11 && cpfCnpjDigits.length !== 14)) {
          addToast("Informe um CPF ou CNPJ válido.", 'warning'); return;
        }
        if (!investorData.phone || investorData.phone.replace(/\D/g, '').length < 10) {
          addToast("Informe seu telefone.", 'warning'); return;
        }
        if (!investorData.email.trim() || !investorData.email.includes('@')) {
          addToast("Informe um email válido.", 'warning'); return;
        }
      }
      // Step 4: Investimento (valor, modalidade)
      if (currentStep === 4) {
        const invAmount = investorData.customInvestmentAmount
          ? parseFloat(investorData.customInvestmentAmount.replace(/\D/g, '')) || 0
          : investorData.investmentAmount;
        if (invAmount < 10000) {
          addToast("O investimento mínimo é R$ 10.000,00.", 'warning'); return;
        }
        // Recalcular tier e rate
        const tier = invAmount >= 50000 ? 'PREMIUM' : 'STANDARD';
        const rate = tier === 'PREMIUM'
          ? (investorData.payoutMode === 'MONTHLY' ? 5.0 : 6.0)
          : (investorData.payoutMode === 'MONTHLY' ? 2.5 : 3.5);
        setInvestorData(prev => ({
          ...prev,
          investmentAmount: invAmount,
          investmentTier: tier,
          monthlyRate: rate,
        }));
      }
      // Step 5: Banco
      if (currentStep === 5) {
        if (!investorData.bankName.trim()) { addToast("Informe o nome do banco.", 'warning'); return; }
        if (!investorData.pixKey.trim()) { addToast("Informe sua chave PIX.", 'warning'); return; }
        if (!investorData.accountHolderName.trim()) { addToast("Informe o nome do titular.", 'warning'); return; }
      }
      // Step 6: Termos + Assinatura
      if (currentStep === 6) {
        if (!termsAccepted) { addToast("Aceite os termos para continuar.", 'warning'); return; }
        if (!formData.signature) { addToast("Assine para confirmar.", 'warning'); return; }
      }
    }

    // STEP 2: Valores - PARA CLT, AUTONOMO e GARANTIA
    if ((profileType === 'CLT' || profileType === 'AUTONOMO' || profileType === 'GARANTIA') && currentStep === 2) {
      const amount = getAmount();
      if (amount < settings.minLoanAmount) {
        addToast(`Valor mínimo é R$ ${settings.minLoanAmount}`, 'warning');
        return;
      }
      if (amount > settings.maxLoanAmount) {
        addToast(`Valor máximo é R$ ${settings.maxLoanAmount.toLocaleString('pt-BR')}`, 'warning');
        return;
      }
      // Garantia apenas para CLT com valores altos (não GARANTIA, pois esse tem step próprio)
      if (profileType === 'CLT' && needsGuarantee) {
        if (!guarantee.type) {
          addToast("Selecione um bem como garantia.", 'warning');
          return;
        }
        if (guarantee.photos.length === 0) {
          addToast("Envie fotos do bem em garantia.", 'warning');
          return;
        }
      }
    }

    // STEP TERMOS - Dinâmico (Step 3 para CLT/AUTONOMO/GARANTIA, Step 2 para MOTO/LIMPA_NOME)
    const termsStep = (profileType === 'MOTO' || profileType === 'LIMPA_NOME') ? 2 : 3;
    if (currentStep === termsStep && !termsAccepted) {
      addToast("Aceite os termos para continuar.", 'warning');
      return;
    }

    // STEP DADOS - Dinâmico (Step 4 para CLT/AUTONOMO, Step 3 para MOTO/LIMPA_NOME, Step 5 para GARANTIA)
    let dataStep = 4;
    if (profileType === 'MOTO' || profileType === 'LIMPA_NOME') dataStep = 3;
    if (profileType === 'GARANTIA') dataStep = 5;
    if (currentStep === dataStep) {
      // Dados pessoais básicos
      if (!formData.name.trim()) {
        addToast("Informe seu nome completo.", 'warning');
        return;
      }
      if (profileType === 'LIMPA_NOME') {
        // LIMPA_NOME aceita CPF (11 dígitos) ou CNPJ (14 dígitos)
        const cpfCnpjDigits = formData.cpf.replace(/\D/g, '');
        if (!cpfCnpjDigits || (cpfCnpjDigits.length !== 11 && cpfCnpjDigits.length !== 14)) {
          addToast("Informe um CPF ou CNPJ válido.", 'warning');
          return;
        }
      } else {
        if (!formData.cpf || formData.cpf.replace(/\D/g, '').length !== 11) {
          addToast("Informe um CPF válido.", 'warning');
          return;
        }
      }

      // 🚫 Verificar bloqueio de 30 dias após reprovação (funciona por CPF, independente do dispositivo)
      if (profileType !== 'LIMPA_NOME') {
        const cooldown = await antifraudService.checkRejectionCooldown(formData.cpf);
        if (cooldown.blocked) {
          addToast(cooldown.message || `Sua solicitação foi reprovada recentemente. Aguarde ${cooldown.daysRemaining} dias para tentar novamente.`, 'error');
          return;
        }
      }
      if (!formData.phone || formData.phone.replace(/\D/g, '').length < 10) {
        addToast("Informe seu WhatsApp.", 'warning');
        return;
      }
      if (!formData.email.trim() || !formData.email.includes('@')) {
        addToast("Informe um email válido.", 'warning');
        return;
      }

      // Instagram obrigatório para todos os perfis exceto LIMPA_NOME
      if (profileType !== 'LIMPA_NOME' && !formData.instagram.trim()) {
        addToast("Informe seu Instagram.", 'warning');
        return;
      }

      // LIMPA_NOME: validar data de nascimento, sem endereço
      if (profileType === 'LIMPA_NOME') {
        if (!formData.birthDate) {
          addToast("Informe sua data de nascimento.", 'warning');
          return;
        }
      } else {
        // Endereço obrigatório para outros perfis
        if (!formData.cep || formData.cep.replace(/\D/g, '').length !== 8) {
          addToast("Informe seu CEP.", 'warning');
          return;
        }
      }

      // Específico por perfil
      if (profileType === 'CLT') {
        if (!formData.income.trim()) {
          addToast("Informe sua renda mensal.", 'warning');
          return;
        }
      }

      if (profileType === 'AUTONOMO') {
        if (!formData.cnpj) {
          addToast("Informe seu CPF ou CNPJ do negócio.", 'warning');
          return;
        }
        if (!formData.businessAddress.trim()) {
          addToast("Informe o endereço do seu comércio.", 'warning');
          return;
        }
      }

      if (profileType === 'MOTO') {
        if (!formData.income.trim()) {
          addToast("Informe sua renda mensal.", 'warning');
          return;
        }
      }
    }

    // STEP PRODUTO (Info da Moto) - MOTO step 4 - não precisa validação, é apenas informativo

    // STEP GARANTIA - Dados do Bem (Step 4 para GARANTIA)
    if (profileType === 'GARANTIA' && currentStep === 4) {
      if (!guarantee.type) {
        addToast("Selecione o tipo de garantia.", 'warning');
        return;
      }
      if (!guarantee.description.trim()) {
        addToast("Descreva o bem (marca, modelo, ano).", 'warning');
        return;
      }
      if (!guarantee.estimatedValue.trim()) {
        addToast("Informe o valor estimado do bem.", 'warning');
        return;
      }
      if (guarantee.photos.length === 0) {
        addToast("Envie fotos do bem em garantia.", 'warning');
        return;
      }
      // Veículos precisam de CRLV
      if ((guarantee.type === 'carro' || guarantee.type === 'moto' || guarantee.type === 'jetski' || guarantee.type === 'outro') && formData.vehicleCRLV.length === 0) {
        addToast("Envie o documento do veículo (CRLV).", 'warning');
        return;
      }
      // Eletrônicos precisam de Nota Fiscal
      if ((guarantee.type === 'celular' || guarantee.type === 'notebook') && formData.proofPurchase.length === 0) {
        addToast("Envie a Nota Fiscal do aparelho.", 'warning');
        return;
      }
    }

    // STEP DOCUMENTOS - Dinâmico (Step 5 para CLT/AUTONOMO e MOTO, Step 6 para GARANTIA) - LIMPA_NOME não tem docs
    let docsStep = 5;
    if (profileType === 'MOTO') docsStep = 5;
    if (profileType === 'GARANTIA') docsStep = 6;
    // LIMPA_NOME pula validação de documentos (não tem esse step)
    if (profileType !== 'LIMPA_NOME' && currentStep === docsStep) {
      // Selfie obrigatória
      if (!formData.selfie) {
        addToast("Tire a selfie segurando o documento.", 'warning');
        return;
      }

      // RG/CNH Frente obrigatório
      if (formData.idCardFront.length === 0) {
        addToast("Envie a frente do RG ou CNH.", 'warning');
        return;
      }

      // RG/CNH Verso obrigatório
      if (formData.idCardBack.length === 0) {
        addToast("Envie o verso do RG ou CNH.", 'warning');
        return;
      }

      // Comprovante de endereço obrigatório
      if (formData.proofAddress.length === 0) {
        addToast("Envie o comprovante de residência (água ou luz).", 'warning');
        return;
      }

      // Boleto em nome do cliente obrigatório (não para MOTO)
      if (profileType !== 'MOTO' && formData.billInName.length === 0) {
        addToast("Envie um boleto em seu nome para confirmar endereço.", 'warning');
        return;
      }

      // Comprovante de Renda obrigatório
      if (formData.proofIncome.length === 0) {
        addToast("Envie o comprovante de renda (extrato, holerite ou pró-labore).", 'warning');
        return;
      }

      // CNH para MOTO, AUTONOMO e GARANTIA_VEICULO
      if ((profileType === 'MOTO' || profileType === 'AUTONOMO' || profileType === 'GARANTIA_VEICULO') && formData.cnh.length === 0) {
        addToast("Envie sua CNH.", 'warning');
        return;
      }

      // Carteira de Trabalho para CLT
      if (profileType === 'CLT' && formData.workCard.length === 0) {
        addToast("Envie sua Carteira de Trabalho (PDF do app oficial).", 'warning');
        return;
      }

      // Fotos do veículo para Garantia Veículo
      if (profileType === 'GARANTIA_VEICULO') {
        if (formData.vehicleCRLV.length === 0) {
          addToast("Envie o documento do veículo (CRLV).", 'warning');
          return;
        }
        if (formData.vehicleFront.length === 0) {
          addToast("Envie fotos do veículo.", 'warning');
          return;
        }
      }

      // Fotos da casa obrigatórias (para MOTO apenas fachada)
      if (formData.housePhotos.length === 0) {
        addToast("Envie fotos da fachada da sua casa.", 'warning');
        return;
      }

      // Vídeo da casa obrigatório (não para MOTO)
      if (profileType !== 'MOTO' && !formData.videoHouse) {
        addToast("Grave o vídeo mostrando sua residência.", 'warning');
        return;
      }

      // Vídeo de aceite obrigatório para empréstimos (NÃO para financiamento MOTO)
      if (profileType !== 'MOTO' && !formData.videoSelfie) {
        addToast("Grave o vídeo de confirmação dizendo que aceita os juros.", 'warning');
        return;
      }

      // Se tem garantia, vídeo e fotos da garantia são obrigatórios
      if (needsGuarantee) {
        if (guarantee.photos.length === 0) {
          addToast("Envie fotos do bem em garantia.", 'warning');
          return;
        }
        if (!guarantee.video) {
          addToast("Grave o vídeo mostrando o bem em garantia.", 'warning');
          return;
        }
      }

      // Capturar localização em tempo real - OBRIGATÓRIO
      addToast("Capturando sua localização...", 'info');
      try {
        const locationData = await antifraudService.requestLocation();
        if (locationData) {
          setFormData(prev => ({ ...prev, location: locationData }));
          addToast("Localização capturada com sucesso!", 'success');
        } else {
          addToast("Permita o acesso à localização para continuar.", 'error');
          return; // NÃO permite avançar sem localização
        }
      } catch (e) {
        console.log('Location capture failed', e);
        addToast("Permita o acesso à localização para continuar.", 'error');
        return; // NÃO permite avançar sem localização
      }
    }

    // STEP 4: Contrato - APENAS LIMPA_NOME (precisa de assinatura)
    if (profileType === 'LIMPA_NOME' && currentStep === 4) {
      if (!formData.signature) {
        addToast("Você precisa assinar o Termo de Autorização para continuar.", 'warning');
        return;
      }
    }

    // STEP BANCO - Apenas CLT (6), AUTONOMO (6) e GARANTIA (7) precisam
    const needsBankStep = profileType === 'CLT' || profileType === 'AUTONOMO' || profileType === 'GARANTIA';
    let bankStep = 6;
    if (profileType === 'GARANTIA') bankStep = 7;
    if (needsBankStep && currentStep === bankStep) {
      if (!formData.bankName.trim()) {
        addToast("Informe o nome do banco.", 'warning');
        return;
      }
      if (!formData.pixKey.trim()) {
        addToast("Informe sua chave PIX.", 'warning');
        return;
      }
      if (!formData.accountHolderName.trim()) {
        addToast("Informe o nome do titular da conta.", 'warning');
        return;
      }
    }

    // Avançar para próximo step - usando tamanho dinâmico
    const maxStep = steps.length;
    if (currentStep < maxStep) setCurrentStep(c => c + 1);
  };

  const handleBack = () => { if (currentStep > 1) setCurrentStep(c => c - 1); };

  // Função para converter base64/dataURL para File
  const dataURLtoFile = (dataurl: string, filename: string): File | null => {
    try {
      const arr = dataurl.split(',');
      const mimeMatch = arr[0].match(/:(.*?);/);
      if (!mimeMatch) return null;
      const mime = mimeMatch[1];
      const bstr = atob(arr[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      return new File([u8arr], filename, { type: mime });
    } catch {
      return null;
    }
  };

  // Função para converter blob: URL em File
  const blobURLtoFile = async (blobUrl: string, filename: string): Promise<File | null> => {
    try {
      const response = await fetch(blobUrl);
      const blob = await response.blob();
      const mimeType = blob.type || 'video/webm';
      return new File([blob], filename, { type: mimeType });
    } catch (err) {
      console.error('Falha ao converter blob URL para file:', err);
      return null;
    }
  };

  // Função para upload de arquivo para Supabase Storage
  const uploadToStorage = async (dataUrl: string, folder: string, index: number = 0): Promise<string> => {
    // Se já for uma URL do Supabase, retornar diretamente
    if (dataUrl.startsWith('http')) {
      return dataUrl;
    }

    try {
      const timestamp = Date.now();
      let file: File | null = null;
      let extension = 'jpg';

      // Tratar blob: URLs (vídeos gravados ou selecionados da galeria)
      if (dataUrl.startsWith('blob:')) {
        const blobFile = await blobURLtoFile(dataUrl, `${folder}_${timestamp}_${index}`);
        if (blobFile) {
          file = blobFile;
          // Determinar extensão pelo mime type do blob
          const mime = blobFile.type;
          if (mime.includes('video/webm')) extension = 'webm';
          else if (mime.includes('video/mp4')) extension = 'mp4';
          else if (mime.includes('video/')) extension = 'webm';
          else if (mime.includes('image/png')) extension = 'png';
          else if (mime.includes('image/jpeg')) extension = 'jpg';
          // Renomear com extensão correta
          file = new File([blobFile], `${folder}_${timestamp}_${index}.${extension}`, { type: mime });
        }
      } else {
        // Tratar data: URLs (base64 - imagens/selfie/assinatura)
        extension = dataUrl.includes('image/png') ? 'png' : dataUrl.includes('image/jpeg') ? 'jpg' : 'jpg';
        const fileName = `${folder}_${timestamp}_${index}.${extension}`;
        file = dataURLtoFile(dataUrl, fileName);
      }

      if (!file) {
        console.error('Falha ao converter URL para file');
        return dataUrl;
      }

      const filePath = `loan_documents/${formData.cpf.replace(/\D/g, '')}/${file.name}`;

      // Tentar upload com retry
      let uploadedUrl: string | null = null;
      let retries = 3;

      while (retries > 0 && !uploadedUrl) {
        uploadedUrl = await supabaseService.uploadFile('documents', filePath, file);
        if (!uploadedUrl) {
          retries--;
          if (retries > 0) {
            console.log(`Retry upload ${3 - retries}/3 para ${folder}...`);
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      }

      if (!uploadedUrl) {
        console.error(`❌ Falha no upload após 3 tentativas: ${folder}`);
        // Se for vídeo, alertar o usuário
        if (folder.includes('video')) {
          console.error('CRÍTICO: Vídeo não foi enviado para o storage!');
        }
        return ''; // Retornar vazio ao invés de blob: para não salvar URLs inválidas
      }

      console.log(`✅ Upload concluído: ${folder} -> ${uploadedUrl}`);
      return uploadedUrl;
    } catch (error) {
      console.error('Erro no upload:', error);
      return ''; // Retornar vazio ao invés de blob: URL local
    }
  };

  // Função para upload de array de arquivos
  const uploadMultiple = async (dataUrls: string[], folder: string): Promise<string[]> => {
    if (!dataUrls || dataUrls.length === 0) return [];
    const results = await Promise.all(dataUrls.map((url, index) => uploadToStorage(url, folder, index)));
    return results;
  };

  // === INVESTIDOR: Submit separado ===
  const handleInvestorSubmit = async () => {
    if (!formData.signature) {
      addToast("Assine para confirmar.", 'warning');
      return;
    }
    setLoading(true);
    addToast("Enviando sua solicitação de investimento... Aguarde.", 'info');

    try {
      // Upload da assinatura
      const signatureUrl = formData.signature ? await uploadToStorage(formData.signature, 'investor_signature') : '';

      const success = await supabaseService.submitInvestorRequest({
        fullName: investorData.fullName,
        cpfCnpj: investorData.cpfCnpj,
        rgCnh: investorData.rgCnh,
        birthDate: investorData.birthDate,
        email: investorData.email,
        phone: investorData.phone,
        address: investorData.address,
        city: investorData.city,
        state: investorData.state,
        zipCode: investorData.zipCode,
        bankName: investorData.bankName,
        pixKey: investorData.pixKey,
        pixKeyType: investorData.pixKeyType,
        accountHolderName: investorData.accountHolderName,
        investmentAmount: investorData.investmentAmount,
        investmentTier: investorData.investmentTier,
        payoutMode: investorData.payoutMode,
        monthlyRate: investorData.monthlyRate,
        termsAccepted: true,
        signatureUrl,
      });

      if (!success) throw new Error('Falha ao submeter');

      // Notificação automática para admin
      autoNotificationService.onLoanRequested(
        investorData.email,
        investorData.investmentAmount,
        investorData.fullName,
        'INVESTIDOR'
      ).catch(() => { });

      setLoading(false);
      addToast("Solicitação de investimento enviada com sucesso!", 'success');
      navigate('/client/dashboard');
    } catch (error: any) {
      console.error('Erro ao enviar solicitação de investidor:', error);
      setLoading(false);
      addToast('Erro ao enviar. Tente novamente.', 'error');
    }
  };

  const handleSubmit = async () => {
    // INVESTIDOR usa fluxo próprio
    if (profileType === 'INVESTIDOR') {
      return handleInvestorSubmit();
    }

    if (!formData.signature || !settings) {
      addToast("Assine para confirmar.", 'warning');
      return;
    }

    setLoading(true);
    addToast("Enviando documentos... Aguarde.", 'info');

    try {
      // Upload de todas as imagens para o Storage
      const [
        selfieUrl,
        idCardFrontUrls,
        idCardBackUrls,
        proofAddressUrls,
        proofIncomeUrls,
        workCardUrls,
        cnhUrls,
        vehicleFrontUrls,
        signatureUrl,
        videoSelfieUrl,
        videoHouseUrl,
        guaranteePhotos,
        // Novos campos
        housePhotosUrls,
        billInNameUrls,
        guaranteeVideoUrl
      ] = await Promise.all([
        formData.selfie ? uploadToStorage(formData.selfie, 'selfie') : Promise.resolve(''),
        uploadMultiple(formData.idCardFront, 'id_front'),
        uploadMultiple(formData.idCardBack, 'id_back'),
        uploadMultiple(formData.proofAddress, 'proof_address'),
        uploadMultiple(formData.proofIncome, 'proof_income'),
        uploadMultiple(formData.workCard, 'work_card'),
        uploadMultiple(formData.cnh, 'cnh'),
        uploadMultiple(formData.vehicleFront, 'vehicle'),
        formData.signature ? uploadToStorage(formData.signature, 'signature') : Promise.resolve(''),
        formData.videoSelfie ? uploadToStorage(formData.videoSelfie, 'video_selfie') : Promise.resolve(''),
        formData.videoHouse ? uploadToStorage(formData.videoHouse, 'video_house') : Promise.resolve(''),
        needsGuarantee && guarantee.photos.length > 0 ? uploadMultiple(guarantee.photos, 'guarantee') : Promise.resolve([]),
        // Novos campos
        uploadMultiple(formData.housePhotos, 'house_photos'),
        uploadMultiple(formData.billInName, 'bill_in_name'),
        needsGuarantee && guarantee.video ? uploadToStorage(guarantee.video, 'guarantee_video') : Promise.resolve('')
      ]);

      // Atualizar dados com URLs do Storage
      const uploadedData = {
        ...formData,
        selfie: selfieUrl,
        idCardFront: idCardFrontUrls,
        idCardBack: idCardBackUrls,
        proofAddress: proofAddressUrls,
        proofIncome: proofIncomeUrls,
        workCard: workCardUrls,
        cnh: cnhUrls,
        vehicleFront: vehicleFrontUrls,
        signature: signatureUrl,
        videoSelfie: videoSelfieUrl,
        videoHouse: videoHouseUrl,
        housePhotos: housePhotosUrls,
        billInName: billInNameUrls,
      };

      // Atualizar garantia se houver
      const uploadedGuarantee = needsGuarantee ? { ...guarantee, photos: guaranteePhotos, video: guaranteeVideoUrl } : null;

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
      // Marcar contrato como assinado para LIMPA_NOME
      if (profileType === 'LIMPA_NOME') {
        uploadedData.limpaNomeContractSigned = true;
      }

      // Concatenar Perfil e CNPJ na profissão para visualização no admin
      const finalOccupation = `[${profileType}] ${uploadedData.occupation || ''} ${uploadedData.cnpj ? '- CNPJ: ' + uploadedData.cnpj : ''}`;

      const success = await supabaseService.submitRequest({
        ...uploadedData,
        occupation: finalOccupation,
        profileType,
        // Para Moto, usar CNH como documento principal se disponível
        idCardFront: (profileType === 'MOTO' && cnhUrls.length > 0) ? cnhUrls : idCardFrontUrls,
        idCardBack: idCardBackUrls,
        proofAddress: proofAddressUrls,
        vehicleFront: vehicleFrontUrls,

        amount: getAmount(),
        installments: settings.defaultInstallments,
        totalAmount: calculateTotal(),
        installmentValue: calculateInstallment(),
        interestRate: settings.interestRateMonthly,
        lateFeeDaily: settings.lateFeeDaily,
        lateFeeMonthly: settings.lateFeeMonthly,
        lateFeeFixed: settings.lateFeeFixed,
        hasGuarantee: needsGuarantee,
        guarantee: uploadedGuarantee,
        // Cliente recorrente
        isReturningClient: isReturningClient === 'sim',
        returningClientNote: isReturningClient === 'sim' ? returningClientNote : '',
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
        profileType,
      }).catch(() => { });

      // 📱 Enviar WhatsApp e Notificação automática (silencioso)
      autoNotificationService.onLoanRequested(
        formData.email,
        getAmount(),
        formData.name,
        profileType
      ).catch(() => { });

      setLoading(false);
      addToast("Solicitação enviada!", 'success');
      navigate('/client/dashboard');
    } catch (error: any) {
      console.error('❌ Erro ao enviar solicitação:', error);
      console.error('❌ Detalhes:', error?.message || error);
      setLoading(false);
      const msg = error?.message === 'Falha ao submeter'
        ? 'Erro ao enviar. Verifique seus dados e tente novamente.'
        : 'Erro ao enviar. Tente novamente.';
      addToast(msg, 'error');
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
          <span className="font-bold">{profileType === 'INVESTIDOR' ? 'Área do Investidor' : profileType === 'LIMPA_NOME' ? 'Limpa Nome' : 'Solicitar Empréstimo'}</span>
        </div>
        <div className="flex items-center gap-3">
          <InstallPwaButton className="!py-1.5 !px-3" />
          <div className="text-sm font-medium text-[#D4AF37]">{currentStep}/{steps.length}</div>
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
                <div className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${isActive ? 'bg-[#D4AF37] text-black scale-110' : isCompleted ? 'bg-zinc-800 text-[#D4AF37] border border-[#D4AF37]' : 'bg-zinc-900 text-zinc-600 border border-zinc-800'
                  }`}>
                  {isCompleted ? <Check size={16} /> : <Icon size={16} />}
                </div>
              </div>
            );
          })}
        </div>

        <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden">

          {/* STEP 1: Perfil (NOVO MULTI SISTEMA) */}
          {currentStep === 1 && (
            <div className="space-y-6 animate-in slide-in-from-right">
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold">Qual serviço você precisa?</h2>
                <p className="text-zinc-400 text-sm mt-2">Selecione a opção que melhor se encaixa.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {profileOptions.map((option) => {
                  const Icon = option.icon;
                  const isSelected = profileType === option.id;
                  return (
                    <button
                      key={option.id}
                      onClick={() => setProfileType(option.id as ProfileType)}
                      className={`p-6 rounded-2xl border-2 flex flex-col items-center gap-3 transition-all ${isSelected
                        ? 'border-[#D4AF37] bg-[#D4AF37]/10 scale-[1.02]'
                        : 'border-zinc-800 bg-black hover:border-zinc-600'
                        }`}
                    >
                      <Icon size={36} className={isSelected ? 'text-[#D4AF37]' : option.color} />
                      <span className="font-bold text-lg">{option.label}</span>
                      <p className={`text-xs ${isSelected ? 'text-[#D4AF37]' : 'text-zinc-500'}`}>
                        {option.description}
                      </p>
                    </button>
                  );
                })}
              </div>

              {/* Pergunta sobre cliente recorrente - apenas CLT, AUTONOMO e GARANTIA */}
              {profileType && profileType !== 'MOTO' && profileType !== 'LIMPA_NOME' && profileType !== 'INVESTIDOR' && (
                <div className="mt-6 p-5 bg-zinc-800/50 rounded-2xl border border-zinc-700 animate-in fade-in slide-in-from-bottom-2">
                  <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                    <Users size={18} className="text-[#D4AF37]" />
                    Você já fez empréstimo conosco antes?
                  </h3>
                  <p className="text-zinc-400 text-sm mb-4">
                    Caso já tenha feito empréstimo antes do sistema existir, nos informe para agilizar o processo.
                  </p>

                  <div className="flex gap-3 mb-4">
                    <button
                      onClick={() => setIsReturningClient('sim')}
                      className={`flex-1 p-3 rounded-xl border-2 font-bold transition-all ${isReturningClient === 'sim'
                        ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
                        : 'border-zinc-700 bg-black text-zinc-400 hover:border-zinc-500'
                        }`}
                    >
                      ✅ Sim, já sou cliente
                    </button>
                    <button
                      onClick={() => { setIsReturningClient('nao'); setReturningClientNote(''); }}
                      className={`flex-1 p-3 rounded-xl border-2 font-bold transition-all ${isReturningClient === 'nao'
                        ? 'border-blue-500 bg-blue-500/10 text-blue-400'
                        : 'border-zinc-700 bg-black text-zinc-400 hover:border-zinc-500'
                        }`}
                    >
                      🆕 Primeiro empréstimo
                    </button>
                  </div>

                  {/* Campo de observação se for cliente recorrente */}
                  {isReturningClient === 'sim' && (
                    <div className="animate-in fade-in slide-in-from-top-2">
                      <label className="text-sm text-zinc-400 block mb-2">
                        Observação (opcional) - Ex: data aproximada do último empréstimo
                      </label>
                      <textarea
                        value={returningClientNote}
                        onChange={(e) => setReturningClientNote(e.target.value)}
                        placeholder="Ex: Fiz um empréstimo em dezembro de 2024, valor de R$ 2.000..."
                        className="w-full bg-black border border-zinc-700 rounded-xl p-3 text-white placeholder:text-zinc-600 focus:border-[#D4AF37] outline-none resize-none"
                        rows={3}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ========== INVESTIDOR STEPS (2-7) ========== */}

          {/* INVESTIDOR STEP 2: "Saiba Mais" - Página explicativa */}
          {currentStep === 2 && profileType === 'INVESTIDOR' && (
            <div className="space-y-6 animate-in slide-in-from-right">
              <div className="text-center mb-4">
                <div className="inline-flex items-center justify-center p-3 bg-cyan-500/10 rounded-full mb-4">
                  <Rocket size={32} className="text-cyan-400" />
                </div>
                <h2 className="text-2xl font-bold">Entenda como funciona</h2>
                <p className="text-zinc-400 text-sm mt-2">Conheça o programa Investidor Tubarão</p>
              </div>

              <div className="space-y-4">
                {(SERVICE_TERMS as any).INVESTIDOR?.infoPage?.sections?.map((section: any, idx: number) => (
                  <div key={idx} className="bg-black border border-zinc-800 rounded-xl p-4">
                    <h3 className="font-bold text-cyan-400 mb-2 flex items-center gap-2">
                      <Shield size={16} />
                      {section.title}
                    </h3>
                    <p className="text-sm text-zinc-300 whitespace-pre-line leading-relaxed">{section.content}</p>
                  </div>
                ))}
              </div>

              {/* Tabela de remuneração */}
              <div className="bg-gradient-to-br from-cyan-900/30 to-zinc-900 border border-cyan-600/30 rounded-xl p-5">
                <h3 className="font-bold text-cyan-400 mb-4 text-center">Tabela de Remuneração</h3>
                <div className="space-y-3 text-sm">
                  <div className="bg-black/50 rounded-lg p-3">
                    <p className="font-bold text-white mb-1">R$ 10.000 a R$ 49.999</p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-zinc-800/50 rounded p-2 text-center">
                        <p className="text-zinc-400">Mensal</p>
                        <p className="text-cyan-400 font-bold text-lg">2,5%</p>
                      </div>
                      <div className="bg-zinc-800/50 rounded p-2 text-center">
                        <p className="text-zinc-400">Anual Acumulado</p>
                        <p className="text-cyan-400 font-bold text-lg">3,5%</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-black/50 rounded-lg p-3">
                    <p className="font-bold text-white mb-1">R$ 50.000 ou mais</p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-zinc-800/50 rounded p-2 text-center">
                        <p className="text-zinc-400">Mensal</p>
                        <p className="text-[#D4AF37] font-bold text-lg">5%</p>
                      </div>
                      <div className="bg-zinc-800/50 rounded p-2 text-center">
                        <p className="text-zinc-400">Anual Acumulado</p>
                        <p className="text-[#D4AF37] font-bold text-lg">6%</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* INVESTIDOR STEP 3: Dados Pessoais */}
          {currentStep === 3 && profileType === 'INVESTIDOR' && (
            <div className="space-y-5 animate-in slide-in-from-right">
              <div className="text-center">
                <User size={48} className="mx-auto text-cyan-400 mb-3" />
                <h2 className="text-xl font-bold">Seus Dados</h2>
                <p className="text-zinc-400 text-sm mt-1">Preencha seus dados pessoais ou empresariais</p>
              </div>

              <Input label="Nome Completo / Razão Social" name="investorFullName" value={investorData.fullName}
                onChange={(e: any) => setInvestorData({ ...investorData, fullName: e.target.value })} placeholder="Seu nome completo" required />

              <Input label="CPF ou CNPJ" name="investorCpfCnpj" value={investorData.cpfCnpj}
                onChange={(e: any) => {
                  let v = e.target.value.replace(/\D/g, '');
                  if (v.length <= 11) v = v.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
                  else v = v.replace(/^(\d{2})(\d)/, '$1.$2').replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d)/, '.$1/$2').replace(/(\d{4})(\d)/, '$1-$2');
                  setInvestorData({ ...investorData, cpfCnpj: v });
                }} placeholder="000.000.000-00" required />

              <Input label="RG ou CNH" name="investorRgCnh" value={investorData.rgCnh}
                onChange={(e: any) => setInvestorData({ ...investorData, rgCnh: e.target.value })} placeholder="Número do documento" />

              <Input label="Data de Nascimento" name="investorBirthDate" type="date" value={investorData.birthDate}
                onChange={(e: any) => setInvestorData({ ...investorData, birthDate: e.target.value })} />

              <Input label="Telefone / WhatsApp" name="investorPhone" value={investorData.phone}
                onChange={(e: any) => {
                  let v = e.target.value.replace(/\D/g, '').slice(0, 11);
                  v = v.replace(/^(\d{2})(\d)/g, '($1) $2').replace(/(\d)(\d{4})$/, '$1-$2');
                  setInvestorData({ ...investorData, phone: v });
                }} placeholder="(11) 99999-9999" required />

              <Input label="Email" name="investorEmail" type="email" value={investorData.email}
                onChange={(e: any) => setInvestorData({ ...investorData, email: e.target.value })} placeholder="seu@email.com" required />

              <Input label="Endereço Completo" name="investorAddress" value={investorData.address}
                onChange={(e: any) => setInvestorData({ ...investorData, address: e.target.value })} placeholder="Rua, número, bairro" />

              <div className="grid grid-cols-2 gap-3">
                <Input label="Cidade" name="investorCity" value={investorData.city}
                  onChange={(e: any) => setInvestorData({ ...investorData, city: e.target.value })} placeholder="São Paulo" />
                <Input label="UF" name="investorState" value={investorData.state}
                  onChange={(e: any) => setInvestorData({ ...investorData, state: e.target.value.toUpperCase().slice(0, 2) })} placeholder="SP" />
              </div>

              <Input label="CEP" name="investorZipCode" value={investorData.zipCode}
                onChange={(e: any) => {
                  let v = e.target.value.replace(/\D/g, '').slice(0, 8);
                  if (v.length > 5) v = v.replace(/^(\d{5})(\d)/, '$1-$2');
                  setInvestorData({ ...investorData, zipCode: v });
                }} placeholder="00000-000" />
            </div>
          )}

          {/* INVESTIDOR STEP 4: Valor e Modalidade */}
          {currentStep === 4 && profileType === 'INVESTIDOR' && (
            <div className="space-y-6 animate-in slide-in-from-right">
              <div className="text-center">
                <DollarSign size={48} className="mx-auto text-cyan-400 mb-3" />
                <h2 className="text-xl font-bold">Quanto deseja investir?</h2>
                <p className="text-zinc-400 text-sm mt-1">Mínimo: R$ 10.000,00 | Prazo: 12 meses</p>
              </div>

              {/* Valores pré-definidos */}
              <div className="grid grid-cols-2 gap-3">
                {[10000, 20000, 30000, 50000, 100000, 200000].map((val) => (
                  <button key={val} onClick={() => {
                    const tier = val >= 50000 ? 'PREMIUM' : 'STANDARD';
                    const rate = tier === 'PREMIUM'
                      ? (investorData.payoutMode === 'MONTHLY' ? 5.0 : 6.0)
                      : (investorData.payoutMode === 'MONTHLY' ? 2.5 : 3.5);
                    setInvestorData({ ...investorData, investmentAmount: val, customInvestmentAmount: '', investmentTier: tier, monthlyRate: rate });
                  }}
                    className={`p-4 rounded-xl border-2 transition-all ${investorData.investmentAmount === val && !investorData.customInvestmentAmount
                      ? 'border-cyan-500 bg-cyan-500/10 scale-105'
                      : 'border-zinc-800 bg-black hover:border-zinc-600'
                      }`}>
                    <span className="text-lg font-bold">R$ {val.toLocaleString('pt-BR')}</span>
                    <p className="text-xs text-zinc-500 mt-1">{val >= 50000 ? 'Premium' : 'Standard'}</p>
                  </button>
                ))}
              </div>

              {/* Valor personalizado */}
              <div className="space-y-2">
                <label className="text-sm text-zinc-400">Ou digite o valor:</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500">R$</span>
                  <input type="number" value={investorData.customInvestmentAmount}
                    onChange={(e) => {
                      const val = e.target.value;
                      const numVal = parseFloat(val) || 0;
                      const tier = numVal >= 50000 ? 'PREMIUM' : 'STANDARD';
                      const rate = tier === 'PREMIUM'
                        ? (investorData.payoutMode === 'MONTHLY' ? 5.0 : 6.0)
                        : (investorData.payoutMode === 'MONTHLY' ? 2.5 : 3.5);
                      setInvestorData({ ...investorData, customInvestmentAmount: val, investmentAmount: numVal, investmentTier: tier, monthlyRate: rate });
                    }}
                    placeholder="10000" min="10000"
                    className="w-full bg-black border border-zinc-700 rounded-xl pl-12 pr-4 py-4 text-white text-xl font-bold focus:border-cyan-500 outline-none" />
                </div>
              </div>

              {/* Modalidade de remuneração */}
              <div className="space-y-3">
                <h3 className="font-bold text-white">Modalidade de Remuneração</h3>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => {
                    const rate = investorData.investmentTier === 'PREMIUM' ? 5.0 : 2.5;
                    setInvestorData({ ...investorData, payoutMode: 'MONTHLY', monthlyRate: rate });
                  }}
                    className={`p-4 rounded-xl border-2 transition-all text-center ${investorData.payoutMode === 'MONTHLY' ? 'border-cyan-500 bg-cyan-500/10' : 'border-zinc-800 bg-black hover:border-zinc-600'}`}>
                    <Banknote size={24} className="mx-auto text-cyan-400 mb-2" />
                    <span className="font-bold block">Mensal</span>
                    <span className="text-xs text-zinc-400">Receba todo mês</span>
                    <span className="block text-lg font-bold text-cyan-400 mt-1">
                      {investorData.investmentTier === 'PREMIUM' ? '5%' : '2,5%'}/mês
                    </span>
                  </button>
                  <button onClick={() => {
                    const rate = investorData.investmentTier === 'PREMIUM' ? 6.0 : 3.5;
                    setInvestorData({ ...investorData, payoutMode: 'ANNUAL', monthlyRate: rate });
                  }}
                    className={`p-4 rounded-xl border-2 transition-all text-center ${investorData.payoutMode === 'ANNUAL' ? 'border-[#D4AF37] bg-[#D4AF37]/10' : 'border-zinc-800 bg-black hover:border-zinc-600'}`}>
                    <Clock size={24} className="mx-auto text-[#D4AF37] mb-2" />
                    <span className="font-bold block">Anual Acumulado</span>
                    <span className="text-xs text-zinc-400">Receba ao final</span>
                    <span className="block text-lg font-bold text-[#D4AF37] mt-1">
                      {investorData.investmentTier === 'PREMIUM' ? '6%' : '3,5%'}/mês
                    </span>
                  </button>
                </div>
              </div>

              {/* Simulação de rendimento */}
              {(() => {
                const amount = investorData.investmentAmount || 10000;
                const rate = investorData.monthlyRate / 100;
                const monthlyReturn = amount * rate;
                const annualReturn = monthlyReturn * 12;
                return (
                  <div className="bg-gradient-to-br from-cyan-900/20 to-zinc-900 border border-cyan-600/30 rounded-xl p-5">
                    <h3 className="font-bold text-cyan-400 mb-3 text-center">Simulação de Rendimento</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between"><span className="text-zinc-400">Valor investido:</span><span className="font-bold">R$ {amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></div>
                      <div className="flex justify-between"><span className="text-zinc-400">Taxa:</span><span className="font-bold text-cyan-400">{investorData.monthlyRate}% ao mês</span></div>
                      <div className="flex justify-between"><span className="text-zinc-400">Rendimento mensal:</span><span className="font-bold text-green-400">R$ {monthlyReturn.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></div>
                      <div className="flex justify-between border-t border-zinc-700 pt-2"><span className="text-zinc-400">Rendimento em 12 meses:</span><span className="font-bold text-[#D4AF37]">R$ {annualReturn.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></div>
                      <div className="flex justify-between"><span className="text-zinc-400">Total ao final:</span><span className="font-bold text-white text-lg">R$ {(amount + annualReturn).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* INVESTIDOR STEP 5: Dados Bancários */}
          {currentStep === 5 && profileType === 'INVESTIDOR' && (
            <div className="space-y-6 animate-in slide-in-from-right">
              <div className="text-center">
                <Landmark size={48} className="mx-auto text-cyan-400 mb-3" />
                <h2 className="text-xl font-bold">Dados Bancários para Recebimento</h2>
                <p className="text-zinc-400 text-sm mt-1">Onde receberá seus rendimentos</p>
              </div>

              <Input label="Banco" name="investorBankName" value={investorData.bankName}
                onChange={(e: any) => setInvestorData({ ...investorData, bankName: e.target.value })} placeholder="Ex: Nubank" required />

              <div className="grid grid-cols-4 gap-2">
                {[{ v: 'cpf', l: 'CPF' }, { v: 'phone', l: 'Celular' }, { v: 'email', l: 'Email' }, { v: 'random', l: 'Aleatória' }].map(o => (
                  <button key={o.v} type="button" onClick={() => setInvestorData({ ...investorData, pixKeyType: o.v })}
                    className={`p-2 rounded-lg border text-sm ${investorData.pixKeyType === o.v ? 'border-cyan-500 text-cyan-400' : 'border-zinc-700 text-zinc-400'}`}>{o.l}</button>
                ))}
              </div>

              <Input label="Chave PIX" name="investorPixKey" value={investorData.pixKey}
                onChange={(e: any) => setInvestorData({ ...investorData, pixKey: e.target.value })} placeholder="Sua chave" required />

              <Input label="Nome do Titular da Conta" name="investorAccountHolder" value={investorData.accountHolderName}
                onChange={(e: any) => setInvestorData({ ...investorData, accountHolderName: e.target.value })} placeholder="Seu nome completo" required />
            </div>
          )}

          {/* INVESTIDOR STEP 6: Termos + Assinatura */}
          {currentStep === 6 && profileType === 'INVESTIDOR' && (
            <div className="space-y-6 animate-in slide-in-from-right">
              <div className="text-center">
                <FileSignature size={48} className="mx-auto text-cyan-400 mb-3" />
                <h2 className="text-xl font-bold">CONTRATO DE ALOCAÇÃO DE CAPITAL - ACEITE ELETRÔNICO</h2>
                <p className="text-zinc-400 text-sm mt-1">Leia atentamente antes de continuar.</p>
              </div>

              <div className="bg-cyan-900/20 border border-cyan-600/30 rounded-xl p-4">
                <p className="text-sm text-zinc-300">
                  {(SERVICE_TERMS as any).INVESTIDOR?.contractIntro}
                </p>
              </div>

              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                <h3 className="font-bold text-cyan-400 mb-3">Dados do Investidor (Cadastro)</h3>
                <ul className="space-y-2">
                  {(SERVICE_TERMS as any).INVESTIDOR?.registrationFields?.map((field: string, idx: number) => (
                    <li key={idx} className="text-sm text-zinc-300 flex items-start gap-2">
                      <CheckCircle2 size={14} className="text-cyan-500 mt-0.5 shrink-0" />
                      {field}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Condições */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 max-h-[350px] overflow-y-auto">
                <h3 className="font-bold text-cyan-400 mb-4 text-center">CONDIÇÕES DO INVESTIMENTO</h3>
                <ul className="space-y-2">
                  {(SERVICE_TERMS as any).INVESTIDOR?.conditions?.map((cond: string, idx: number) => (
                    <li key={idx} className="text-sm text-zinc-300 flex items-start gap-2">
                      <CheckCircle2 size={14} className="text-cyan-500 mt-0.5 shrink-0" />
                      {cond}
                    </li>
                  ))}
                </ul>

                <div className="mt-6 pt-4 border-t border-zinc-700">
                  <h4 className="font-bold text-white mb-2">Resumo do seu Investimento:</h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between"><span className="text-zinc-400">Valor:</span><span className="font-bold">R$ {investorData.investmentAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></div>
                    <div className="flex justify-between"><span className="text-zinc-400">Faixa:</span><span className="font-bold text-cyan-400">{investorData.investmentTier === 'PREMIUM' ? 'Premium (R$50k+)' : 'Standard (R$10k-49k)'}</span></div>
                    <div className="flex justify-between"><span className="text-zinc-400">Modalidade:</span><span className="font-bold">{investorData.payoutMode === 'MONTHLY' ? 'Mensal' : 'Anual Acumulado'}</span></div>
                    <div className="flex justify-between"><span className="text-zinc-400">Taxa:</span><span className="font-bold text-[#D4AF37]">{investorData.monthlyRate}% ao mês</span></div>
                    <div className="flex justify-between"><span className="text-zinc-400">Prazo:</span><span className="font-bold">12 meses</span></div>
                    <div className="flex justify-between"><span className="text-zinc-400">Aviso de Resgate:</span><span className="font-bold">3 meses antes</span></div>
                  </div>
                </div>
              </div>

              {/* Checkbox de aceite */}
              <label className="flex items-start gap-3 p-4 bg-zinc-900 border border-zinc-800 rounded-xl cursor-pointer hover:border-cyan-500 transition-all">
                <input type="checkbox" checked={termsAccepted} onChange={(e) => setTermsAccepted(e.target.checked)}
                  className="w-6 h-6 mt-0.5 accent-cyan-500 shrink-0" />
                <span className="text-xs text-zinc-300 leading-relaxed">
                  {(SERVICE_TERMS as any).INVESTIDOR?.finalCheckboxText || (SERVICE_TERMS as any).INVESTIDOR?.checkboxText}
                </span>
              </label>

              {/* Assinatura */}
              <div className="space-y-2">
                <h3 className="font-bold text-cyan-400">Confirmar e Assinar</h3>
                <div className="bg-red-900/20 border border-red-600/30 rounded-lg p-3">
                  <p className="text-xs text-red-400">
                    <strong>OBRIGATÓRIO:</strong> Assine no campo abaixo para confirmar sua adesão ao programa de investimento.
                  </p>
                </div>
                <SignaturePad onSign={(sig) => setFormData({ ...formData, signature: sig })} />
              </div>
            </div>
          )}

          {/* INVESTIDOR STEP 7: Confirmação Final */}
          {currentStep === 7 && profileType === 'INVESTIDOR' && (
            <div className="space-y-6 animate-in slide-in-from-right">
              <div className="text-center">
                <CheckCircle2 size={48} className="mx-auto text-green-500 mb-3" />
                <h2 className="text-xl font-bold">Confirme seu Investimento</h2>
              </div>

              <div className="bg-black border border-zinc-800 rounded-xl p-4 space-y-3 text-sm">
                <div className="flex justify-between"><span className="text-zinc-400">Serviço:</span><span className="font-bold text-cyan-400">Investidor Tubarão</span></div>
                <div className="flex justify-between"><span className="text-zinc-400">Nome:</span><span className="font-bold">{investorData.fullName}</span></div>
                <div className="flex justify-between"><span className="text-zinc-400">CPF/CNPJ:</span><span className="font-bold">{investorData.cpfCnpj}</span></div>
                <div className="flex justify-between"><span className="text-zinc-400">Valor:</span><span className="font-bold text-[#D4AF37]">R$ {investorData.investmentAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></div>
                <div className="flex justify-between"><span className="text-zinc-400">Faixa:</span><span className="font-bold">{investorData.investmentTier === 'PREMIUM' ? 'Premium' : 'Standard'}</span></div>
                <div className="flex justify-between"><span className="text-zinc-400">Modalidade:</span><span className="font-bold">{investorData.payoutMode === 'MONTHLY' ? 'Mensal' : 'Anual Acumulado'}</span></div>
                <div className="flex justify-between"><span className="text-zinc-400">Taxa:</span><span className="font-bold text-cyan-400">{investorData.monthlyRate}% ao mês</span></div>
                <div className="flex justify-between"><span className="text-zinc-400">Prazo:</span><span className="font-bold">12 meses</span></div>
                <div className="flex justify-between"><span className="text-zinc-400">Banco:</span><span className="font-bold">{investorData.bankName}</span></div>
                <div className="flex justify-between"><span className="text-zinc-400">PIX:</span><span className="font-bold">{investorData.pixKey}</span></div>
                <div className="flex justify-between"><span className="text-zinc-400">Termos:</span><span className="font-bold text-green-400">Aceito e Assinado</span></div>
              </div>

              <div className="bg-cyan-900/20 border border-cyan-600/30 rounded-xl p-4">
                <p className="text-sm text-zinc-300 text-center">
                  Ao confirmar, sua solicitação será enviada para análise pela equipe Tubarão. Você receberá um retorno em até 48 horas.
                </p>
              </div>
            </div>
          )}

          {/* ========== FIM INVESTIDOR STEPS ========== */}

          {/* STEP 2: Valores - APENAS para CLT, AUTONOMO e GARANTIA */}
          {currentStep === 2 && (profileType === 'CLT' || profileType === 'AUTONOMO' || profileType === 'GARANTIA') && (
            <div className="space-y-6 animate-in slide-in-from-right">
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center p-3 bg-[#D4AF37]/10 rounded-full mb-4">
                  <Rocket size={32} className="text-[#D4AF37]" />
                </div>
                <h2 className="text-2xl font-bold">Quanto você precisa?</h2>
                <p className="text-zinc-400 text-sm mt-2">Simule agora e receba em instantes.</p>
              </div>

              {/* Pacotes (Ocultar se for Moto/Garantia, ou mostrar valores maiores) */}
              {profileType !== 'GARANTIA_VEICULO' && (
                <div className="grid grid-cols-3 gap-3">
                  {settings.loanPackages.map((pkg, idx) => (
                    <button
                      key={idx}
                      onClick={() => { setSelectedAmount(pkg); setCustomAmount(''); }}
                      className={`p-4 rounded-xl border-2 transition-all ${selectedAmount === pkg && !customAmount ? 'border-[#D4AF37] bg-[#D4AF37]/10 scale-105' : 'border-zinc-800 bg-zinc-900 hover:border-zinc-600'
                        }`}
                    >
                      <span className="text-lg font-bold">R$ {pkg.toLocaleString('pt-BR')}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Valor personalizado */}
              <div className="space-y-2">
                <label className="text-sm text-zinc-400">Digite o valor desejado:</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500">R$</span>
                  <input
                    type="number"
                    value={customAmount}
                    onChange={(e) => setCustomAmount(e.target.value)}
                    placeholder={profileType === 'GARANTIA_VEICULO' ? "Ex: 15000" : "0,00"}
                    className="w-full bg-black border border-zinc-700 rounded-xl pl-12 pr-4 py-4 text-white text-xl font-bold focus:border-[#D4AF37] outline-none"
                  />
                </div>
              </div>

              {/* Checkbox Moto */}
              {profileType === 'MOTO' && (
                <label className="flex items-center gap-3 p-4 bg-zinc-900 border border-zinc-800 rounded-xl cursor-pointer hover:border-[#D4AF37] transition-all">
                  <input
                    type="checkbox"
                    checked={hasEntryValue}
                    onChange={(e) => setHasEntryValue(e.target.checked)}
                    className="w-6 h-6 accent-[#D4AF37]"
                  />
                  <span className="font-bold text-white">Tenho R$ 2.000,00 para entrada</span>
                </label>
              )}

              {/* Aviso de análise */}
              <div className="bg-blue-900/20 border border-blue-600/30 rounded-xl p-4">
                <p className="text-sm text-blue-400">
                  <AlertCircle size={16} className="inline mr-2" />
                  Todos os valores passam por <strong>análise de crédito</strong> imediata.
                </p>
              </div>

              {/* Aviso de garantia (Se não for Perfil Garantia que já tem isso implicito) */}
              {needsGuarantee && profileType !== 'GARANTIA_VEICULO' && (
                <div className="bg-yellow-900/20 border border-yellow-600/30 rounded-xl p-4 space-y-4 animate-in fade-in">
                  <p className="text-sm text-yellow-400 flex items-start gap-2">
                    <AlertCircle size={18} className="shrink-0 mt-0.5" />
                    <span>Valores acima de <strong>R$ {settings.maxLoanNoGuarantee.toLocaleString('pt-BR')}</strong> precisam de um <strong>bem como garantia</strong>.</span>
                  </p>

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

                  {/* Detalhes do bem (Geral) */}
                  {guarantee.type && (
                    <div className="space-y-3 pt-3 border-t border-zinc-800">
                      <Input label="Descrição do Bem" name="description" value={guarantee.description} onChange={(e) => setGuarantee(prev => ({ ...prev, description: e.target.value }))} placeholder="Ex: iPhone 13" />
                      {renderUploadArea('photos', 'Fotos do Bem', guarantee.photos, true)}
                    </div>
                  )}

                </div>
              )}

              {/* Seção de fotos para Garantia Veículo */}
              {profileType === 'GARANTIA_VEICULO' && (
                <div className="bg-yellow-900/20 border border-yellow-600/30 rounded-xl p-4 space-y-4 animate-in fade-in">
                  <p className="text-sm text-yellow-400 flex items-start gap-2">
                    <AlertCircle size={18} className="shrink-0 mt-0.5" />
                    <span>Para empréstimo com <strong>veículo como garantia</strong>, envie os dados e fotos abaixo.</span>
                  </p>

                  <div className="space-y-4 pt-3 border-t border-zinc-800">
                    <Input
                      label="Descrição do Veículo"
                      name="vehicleDescription"
                      value={guarantee.description}
                      onChange={(e) => setGuarantee(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Ex: Honda Civic 2020 Prata"
                    />
                    <Input
                      label="Valor Estimado do Veículo"
                      name="vehicleValue"
                      value={guarantee.estimatedValue}
                      onChange={(e) => setGuarantee(prev => ({ ...prev, estimatedValue: e.target.value }))}
                      placeholder="Ex: 50000"
                    />
                    {renderUploadArea('photos', 'Fotos do Veículo (Frente, Lateral, Traseira)', guarantee.photos, true)}
                  </div>
                </div>
              )}

              {/* Se for Garantia Veículo, mostramos inputs específicos aqui ou no STEP DADOS? */}
              {/* Vamos deixar para STEP DADOS/DOCS para não poluir valores */}

              <div className="bg-black border border-zinc-700 rounded-2xl p-5">
                <div className="text-center space-y-3">
                  <Clock size={32} className="mx-auto text-[#D4AF37]" />
                  <h3 className="font-bold text-white">Valor Solicitado</h3>
                  <p className="text-3xl font-bold text-[#D4AF37]">
                    R$ {getAmount().toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3 (para CLT/AUTONOMO/GARANTIA) ou STEP 2 (para MOTO/LIMPA_NOME): Termos */}
          {((profileType === 'CLT' || profileType === 'AUTONOMO' || profileType === 'GARANTIA') && currentStep === 3) ||
            ((profileType === 'MOTO' || profileType === 'LIMPA_NOME') && currentStep === 2) ? (
            <div className="space-y-6 animate-in slide-in-from-right">
              <div className="text-center mb-4">
                <Shield size={48} className="mx-auto text-[#D4AF37] mb-3" />
                <h2 className="text-xl font-bold">
                  {profileType === 'CLT' && 'Termos do Empréstimo CLT'}
                  {profileType === 'AUTONOMO' && 'Termos - Capital de Giro'}
                  {profileType === 'MOTO' && 'Termos - Financiamento de Moto'}
                  {profileType === 'GARANTIA' && 'Termos - Empréstimo com Garantia'}
                  {profileType === 'LIMPA_NOME' && 'Termos - Serviço Limpa Nome'}
                </h2>
              </div>

              {/* TERMOS CLT - Empréstimo para CLT */}
              {profileType === 'CLT' && (
                <>
                  <div className="bg-blue-900/20 border border-blue-600/30 rounded-xl p-4">
                    <h3 className="font-bold text-blue-400 mb-3">💼 EMPRÉSTIMO PARA CLT</h3>
                    <p className="text-sm text-zinc-300">
                      Destinado a pessoas com registro ativo em carteira, que possuam renda comprovada e vínculo empregatício mínimo para análise de crédito.
                    </p>
                  </div>

                  <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-4">
                    <h3 className="font-bold text-white mb-3">👤 QUEM PODE SOLICITAR</h3>
                    <ul className="text-sm text-zinc-300 space-y-2">
                      <li>• Ter <strong className="text-white">registro ativo em carteira (CLT)</strong></li>
                      <li>• Possuir <strong className="text-yellow-400">mínimo de 3 meses</strong> no emprego atual</li>
                      <li>• Ter renda compatível com o valor solicitado</li>
                    </ul>
                  </div>

                  <div className="bg-orange-900/20 border border-orange-600/30 rounded-xl p-4">
                    <h3 className="font-bold text-orange-400 mb-3">📄 DOCUMENTOS OBRIGATÓRIOS</h3>
                    <ul className="text-sm text-zinc-300 space-y-2">
                      <li>• <strong className="text-white">Carteira de Trabalho Digital em PDF</strong> (arquivo original exportado)</li>
                      <li>• Documento com foto (RG ou CNH)</li>
                      <li>• Selfie segurando o documento</li>
                      <li>• Comprovante de residência</li>
                    </ul>
                    <div className="mt-3 p-2 bg-red-900/30 border border-red-700 rounded-lg">
                      <p className="text-xs text-red-400">
                        ⚠️ <strong>NÃO</strong> aceitamos: carteira impressa, fotografada ou print de tela. Apenas <strong>ARQUIVO PDF</strong> da Carteira de Trabalho Digital.
                      </p>
                    </div>
                  </div>

                  <div className="bg-black border border-zinc-800 rounded-xl p-4">
                    <h3 className="font-bold text-[#D4AF37] mb-3">📌 COMO O VALOR É DEFINIDO</h3>
                    <p className="text-sm text-zinc-300 mb-2">
                      O valor não é fixo e será definido após análise, considerando:
                    </p>
                    <ul className="text-sm text-zinc-400 space-y-1 ml-2">
                      <li>• Salário registrado</li>
                      <li>• Tempo de empresa</li>
                      <li>• Histórico do cliente</li>
                      <li>• Se é cliente novo ou recorrente</li>
                    </ul>
                  </div>

                  <div className="bg-red-900/20 border border-red-600/30 rounded-xl p-4">
                    <h3 className="font-bold text-red-400 mb-3">💰 CONDIÇÕES E MULTAS</h3>
                    <div className="grid grid-cols-2 gap-3 text-sm mb-3">
                      <div className="bg-black/30 p-3 rounded-lg">
                        <p className="text-zinc-500 text-xs">Juros ao Mês</p>
                        <p className="text-white font-bold text-lg">30%</p>
                      </div>
                      <div className="bg-black/30 p-3 rounded-lg">
                        <p className="text-zinc-500 text-xs">Multa Inadimplência</p>
                        <p className="text-red-400 font-bold text-lg">7%</p>
                      </div>
                    </div>
                    <ul className="text-sm text-zinc-300 space-y-1">
                      <li>• Multa diária: <strong className="text-red-400">R$ 20,00</strong> por dia de atraso (cumulativo)</li>
                      <li>• Atraso caracteriza inadimplência imediata</li>
                    </ul>
                  </div>

                  <div className="bg-yellow-900/20 border border-yellow-600/30 rounded-xl p-4">
                    <h3 className="font-bold text-yellow-400 mb-3">⚠️ INFORMAÇÕES IMPORTANTES</h3>
                    <ul className="text-sm text-zinc-300 space-y-1">
                      <li>• A aprovação <strong>não é automática</strong></li>
                      <li>• Documento inválido resulta em <strong>reprovação</strong></li>
                      <li>• Informações falsas implicam cancelamento</li>
                    </ul>
                  </div>

                  <label className="flex items-start gap-4 p-4 bg-blue-900/30 border-2 border-blue-500 rounded-xl cursor-pointer">
                    <input type="checkbox" checked={termsAccepted} onChange={(e) => setTermsAccepted(e.target.checked)} className="mt-1 accent-blue-500 w-6 h-6" />
                    <div>
                      <span className="text-white font-bold">☑️ Declaro que li e compreendi</span>
                      <p className="text-xs text-zinc-400 mt-1">
                        Que é obrigatório possuir <strong>mínimo 3 meses de registro ativo</strong>, que devo enviar a Carteira de Trabalho Digital em <strong>ARQUIVO PDF</strong> (não sendo aceitos prints, fotos ou documentos impressos), que o valor varia conforme análise, que os juros são de <strong className="text-red-400">30%</strong>, que em caso de atraso haverá multa de <strong className="text-red-400">7%</strong> sobre o valor mais <strong className="text-red-400">R$ 20,00/dia</strong> de forma cumulativa, e que a liberação depende de análise.
                      </p>
                    </div>
                  </label>
                </>
              )}

              {/* TERMOS AUTÔNOMO - Capital de Giro com Diárias */}
              {profileType === 'AUTONOMO' && (
                <>
                  <div className="bg-green-900/20 border border-green-600/30 rounded-xl p-4">
                    <h3 className="font-bold text-green-400 mb-3">💰 CONDIÇÕES DO EMPRÉSTIMO</h3>
                    <ul className="text-sm text-zinc-300 space-y-2">
                      <li>• <strong>Finalidade:</strong> Capital de giro para comércio</li>
                      <li>• <strong>Modalidade:</strong> Pagamento diário</li>
                      <li>• <strong>Prazo:</strong> 30 (trinta) diárias</li>
                      <li>• <strong>Juros:</strong> 30% ao mês</li>
                      <li>• <strong>Dias de cobrança:</strong> Segunda a Sábado (feriados inclusos)</li>
                      <li>• <strong className="text-yellow-400">Domingos:</strong> Sem cobrança diária</li>
                    </ul>
                  </div>

                  <div className="bg-red-900/20 border border-red-600/30 rounded-xl p-4">
                    <h3 className="font-bold text-red-400 mb-3">🚨 MULTA E JUROS POR ATRASO</h3>
                    <ul className="text-sm text-zinc-300 space-y-2">
                      <li>• Multa de <strong className="text-red-400">R$ 20,00 por dia</strong> de atraso (cumulativo)</li>
                      <li>• A contagem ocorre em dias corridos (inclusive domingos e feriados)</li>
                      <li>• O domingo não possui cobrança diária, mas conta para juros e multa se houver inadimplência</li>
                    </ul>
                  </div>

                  <div className="bg-black border border-zinc-800 rounded-xl p-4 space-y-3">
                    <h3 className="font-bold text-[#D4AF37] text-sm uppercase">O que vamos precisar:</h3>
                    {['CNPJ e RG/CNH', 'Comprovante de Endereço Comercial', 'Vídeo do Estabelecimento', 'Análise do Comércio', 'Selfie com Documento'].map((doc, idx) => (
                      <div key={idx} className="flex items-start gap-3 py-2 border-b border-zinc-900 last:border-0">
                        <CheckCircle2 size={16} className="text-green-500 mt-0.5 shrink-0" />
                        <span className="text-sm text-zinc-300">{doc}</span>
                      </div>
                    ))}
                  </div>

                  <label className="flex items-start gap-4 p-4 bg-red-900/30 border-2 border-red-500 rounded-xl cursor-pointer">
                    <input type="checkbox" checked={termsAccepted} onChange={(e) => setTermsAccepted(e.target.checked)} className="mt-1 accent-red-500 w-6 h-6" />
                    <div>
                      <span className="text-white font-bold">☑️ Declaro que li e compreendi</span>
                      <p className="text-xs text-zinc-400 mt-1">
                        As condições do Empréstimo para Comerciante (Capital de Giro), incluindo análise do comércio, pagamento em <strong>30 diárias</strong>, juros de <strong className="text-red-400">30% ao mês</strong>, cobrança de segunda a sábado (feriados inclusos), sem cobrança aos domingos, e que em caso de inadimplência o domingo será contado para juros e multa de <strong className="text-red-400">R$ 20,00 por dia</strong> de atraso, de forma cumulativa.
                      </p>
                    </div>
                  </label>
                </>
              )}

              {/* TERMOS MOTO - Financiamento Próprio */}
              {profileType === 'MOTO' && (
                <>
                  <div className="bg-yellow-900/20 border border-yellow-600/30 rounded-xl p-4">
                    <h3 className="font-bold text-yellow-400 mb-3">💰 CONDIÇÕES FINANCEIRAS</h3>
                    <ul className="text-sm text-zinc-300 space-y-2">
                      <li>• <strong className="text-yellow-400">Entrada obrigatória:</strong> R$ 2.000,00 (não reembolsável)</li>
                      <li>• <strong>Parcelamento:</strong> 36 parcelas mensais de R$ 611,00</li>
                      <li>• <strong>Seguro obrigatório:</strong> R$ 150,00/mês</li>
                      <li>• <strong className="text-green-400">Valor mensal total:</strong> R$ 761,00</li>
                    </ul>
                  </div>

                  <div className="bg-red-900/20 border border-red-600/30 rounded-xl p-4">
                    <h3 className="font-bold text-red-400 mb-3">🚨 BUSCA E APREENSÃO</h3>
                    <ul className="text-sm text-zinc-300 space-y-2">
                      <li>• A moto <strong>permanece em nome da empresa</strong> até quitação total</li>
                      <li>• Atraso autoriza <strong className="text-red-400">busca e apreensão imediata</strong>, sem aviso prévio</li>
                      <li>• Em caso de apreensão, <strong>todos os valores pagos serão perdidos</strong></li>
                      <li>• Toda manutenção é de responsabilidade do cliente</li>
                    </ul>
                  </div>

                  <div className="bg-black border border-zinc-800 rounded-xl p-4 space-y-3">
                    <h3 className="font-bold text-[#D4AF37] text-sm uppercase">O que vamos precisar:</h3>
                    {['CNH Válida (categoria A)', 'Comprovante de Endereço (água/luz)', 'Foto da Fachada da Casa', 'Selfie do Cliente'].map((doc, idx) => (
                      <div key={idx} className="flex items-start gap-3 py-2 border-b border-zinc-900 last:border-0">
                        <CheckCircle2 size={16} className="text-green-500 mt-0.5 shrink-0" />
                        <span className="text-sm text-zinc-300">{doc}</span>
                      </div>
                    ))}
                  </div>

                  <div className="bg-blue-900/20 border border-blue-600/30 rounded-xl p-4">
                    <h3 className="font-bold text-blue-400 mb-3">📋 TRANSFERÊNCIA</h3>
                    <ul className="text-sm text-zinc-300 space-y-2">
                      <li>• A moto só será transferida para o nome do cliente <strong className="text-blue-400">após a quitação da 36ª parcela</strong></li>
                      <li>• Até lá, a moto permanece registrada em nome da empresa</li>
                    </ul>
                  </div>

                  <label className="flex items-start gap-4 p-4 bg-red-900/30 border-2 border-red-500 rounded-xl cursor-pointer">
                    <input type="checkbox" checked={termsAccepted} onChange={(e) => setTermsAccepted(e.target.checked)} className="mt-1 accent-red-500 w-6 h-6" />
                    <div>
                      <span className="text-white font-bold">☑️ Declaro que li e compreendi</span>
                      <p className="text-xs text-zinc-400 mt-1">
                        Todas as condições do financiamento próprio de motocicleta, incluindo a entrada obrigatória de <strong>R$ 2.000,00</strong>, o parcelamento em <strong>36x de R$ 611,00</strong> + seguro de <strong>R$ 150,00</strong> (total mensal: <strong>R$ 761,00</strong>), a cláusula de <strong className="text-red-400">busca e apreensão imediata</strong> em caso de atraso superior ao contrato com <strong className="text-red-400">perda total dos valores pagos</strong>, e que a transferência do veículo somente ocorrerá após a quitação da 36ª parcela.
                      </p>
                    </div>
                  </label>
                </>
              )}

              {/* TERMOS GARANTIA - Empréstimo com Bem */}
              {profileType === 'GARANTIA' && (
                <>
                  <div className="bg-orange-900/20 border border-orange-600/30 rounded-xl p-4">
                    <h3 className="font-bold text-orange-400 mb-3">📌 REGRA FUNDAMENTAL</h3>
                    <ul className="text-sm text-zinc-300 space-y-2">
                      <li>• Garantia deve valer <strong className="text-orange-400">NO MÍNIMO O DOBRO</strong> do valor solicitado</li>
                      <li>• Solicita R$ 2.000 → Garantia mínima de <strong>R$ 4.000</strong></li>
                      <li>• Solicita R$ 5.000 → Garantia mínima de <strong>R$ 10.000</strong></li>
                    </ul>
                  </div>

                  <div className="bg-red-900/30 border-2 border-red-500 rounded-xl p-4">
                    <h3 className="font-bold text-red-400 mb-3 text-lg">🚨 POSSE DO BEM (PONTO MAIS IMPORTANTE)</h3>
                    <div className="bg-black/40 p-3 rounded-lg mb-3">
                      <p className="text-white font-bold text-center">⚠️ TODA GARANTIA FICA EM POSSE DA EMPRESA DURANTE TODO O CONTRATO</p>
                    </div>
                    <ul className="text-sm text-zinc-300 space-y-2">
                      <li>❌ Não existe empréstimo onde o cliente continua usando o bem</li>
                      <li>❌ Não existe "transferir no documento e continuar com o veículo"</li>
                      <li>✅ O bem será <strong>entregue fisicamente</strong> à empresa até quitação total</li>
                    </ul>
                  </div>

                  <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-4">
                    <h3 className="font-bold text-white mb-3">🚗 Garantias Aceitas</h3>
                    <div className="grid grid-cols-2 gap-2 text-sm text-zinc-300">
                      <div>
                        <p className="font-bold text-yellow-400">Veículos:</p>
                        <ul className="ml-2">
                          <li>• Carro</li>
                          <li>• Moto</li>
                          <li>• Jet ski</li>
                          <li>• Carro elétrico</li>
                        </ul>
                      </div>
                      <div>
                        <p className="font-bold text-blue-400">Eletrônicos:</p>
                        <ul className="ml-2">
                          <li>• Celular</li>
                          <li>• Notebook</li>
                          <li>• Tablet</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  <div className="bg-black border border-zinc-800 rounded-xl p-4">
                    <h3 className="font-bold text-[#D4AF37] mb-3">💰 Condições Financeiras</h3>
                    <ul className="text-sm text-zinc-300 space-y-1">
                      <li>• Juros: <strong className="text-white">30% ao mês</strong></li>
                      <li>• Multa inadimplência: <strong className="text-red-400">7% sobre valor emprestado</strong></li>
                      <li>• Multa diária: <strong className="text-red-400">R$ 20,00 por dia</strong> (cumulativo)</li>
                    </ul>
                  </div>

                  <label className="flex items-start gap-4 p-4 bg-orange-900/30 border-2 border-orange-500 rounded-xl cursor-pointer">
                    <input type="checkbox" checked={termsAccepted} onChange={(e) => setTermsAccepted(e.target.checked)} className="mt-1 accent-orange-500 w-6 h-6" />
                    <div>
                      <span className="text-white font-bold">☑️ Declaro que li e compreendi</span>
                      <p className="text-xs text-zinc-400 mt-1">
                        Que no Empréstimo com Garantia, todo bem ficará <strong>obrigatoriamente em posse física da empresa</strong> durante todo o contrato; que a garantia deve valer <strong>no mínimo o dobro</strong> do valor solicitado; que veículos serão transferidos para nome da empresa; que os juros são de <strong className="text-red-400">30%</strong>, multa de 7% e R$ 20,00/dia de atraso; e que em caso de inadimplência, a garantia será usada como pagamento.
                      </p>
                    </div>
                  </label>
                </>
              )}

              {/* TERMOS LIMPA NOME - Serviço de Contestação */}
              {profileType === 'LIMPA_NOME' && (
                <>
                  <div className="bg-purple-900/20 border border-purple-600/30 rounded-xl p-4">
                    <h3 className="font-bold text-purple-400 mb-3">🔒 SOBRE O SERVIÇO LIMPA NOME</h3>
                    <p className="text-sm text-zinc-300 mb-3">
                      Consiste em <strong>análise e contestação administrativa</strong> de negativação indevida junto aos órgãos:
                    </p>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <span className="bg-black/30 px-3 py-1 rounded text-center">Serasa</span>
                      <span className="bg-black/30 px-3 py-1 rounded text-center">SPC Brasil</span>
                      <span className="bg-black/30 px-3 py-1 rounded text-center">Boa Vista</span>
                      <span className="bg-black/30 px-3 py-1 rounded text-center">Cartórios (IEPTB)</span>
                    </div>
                    <p className="text-xs text-zinc-400 mt-3">
                      Atuação mediante assinatura do <strong>Termo de Autorização e Representação</strong>.
                    </p>
                  </div>

                  <div className="bg-red-900/30 border-2 border-red-500 rounded-xl p-4">
                    <h3 className="font-bold text-red-400 mb-3 text-lg">⚠️ ESCLARECIMENTOS IMPORTANTES</h3>
                    <ul className="text-sm text-zinc-300 space-y-2">
                      <li>1. A empresa <strong className="text-red-400">NÃO paga dívidas</strong>, NÃO quita valores e NÃO negocia acordos</li>
                      <li>2. A dívida <strong>continua existindo</strong> junto ao credor original</li>
                      <li>3. O serviço atua sobre a <strong>forma de exposição</strong> da dívida</li>
                    </ul>
                  </div>

                  <div className="bg-green-900/20 border border-green-600/30 rounded-xl p-4">
                    <h3 className="font-bold text-green-400 mb-3">🛡️ SOBRE A BLINDAGEM DA NEGATIVAÇÃO</h3>
                    <p className="text-sm text-zinc-300 mb-2">
                      Desde que <strong>não haja atraso ou novas dívidas</strong>, o CPF pode:
                    </p>
                    <ul className="text-sm text-zinc-300 space-y-1 ml-2">
                      <li>• Permanecer sem exposição pública até <strong className="text-green-400">12 meses</strong></li>
                      <li>• Apresentar melhora progressiva de score</li>
                      <li>• Ter acesso a crédito em empresas sem histórico negativo</li>
                    </ul>
                    <div className="mt-3 p-2 bg-yellow-900/30 border border-yellow-700 rounded-lg">
                      <p className="text-xs text-yellow-400">
                        ⚠️ A empresa não garante score específico ou aprovação de crédito
                      </p>
                    </div>
                  </div>

                  <div className="bg-orange-900/20 border border-orange-600/30 rounded-xl p-4">
                    <h3 className="font-bold text-orange-400 mb-3">💳 RESPONSABILIDADE DO CLIENTE</h3>
                    <p className="text-sm text-zinc-300 mb-2">Durante o processo, qualquer:</p>
                    <ul className="text-sm text-zinc-300 space-y-1 ml-2">
                      <li>• Atraso ou não pagamento de obrigações</li>
                      <li>• Descumprimento de acordos existentes</li>
                      <li>• Criação de novas dívidas</li>
                    </ul>
                    <p className="text-sm text-red-400 mt-2">
                      Pode resultar no <strong>retorno imediato</strong> da exposição da dívida.
                    </p>
                  </div>

                  <div className="bg-black border border-zinc-800 rounded-xl p-4">
                    <h3 className="font-bold text-white mb-3">🔍 VISUALIZAÇÃO DA DÍVIDA</h3>
                    <ul className="text-sm text-zinc-400 space-y-1">
                      <li>• A dívida permanece registrada internamente junto ao credor</li>
                      <li>• Pode ser visualizada em consultas específicas pelo titular</li>
                      <li>• O serviço não elimina a obrigação financeira existente</li>
                    </ul>
                  </div>

                  <label className="flex items-start gap-4 p-4 bg-purple-900/30 border-2 border-purple-500 rounded-xl cursor-pointer">
                    <input type="checkbox" checked={termsAccepted} onChange={(e) => setTermsAccepted(e.target.checked)} className="mt-1 accent-purple-500 w-6 h-6" />
                    <div>
                      <span className="text-white font-bold">☑️ Declaro que li e compreendi</span>
                      <p className="text-xs text-zinc-400 mt-1">
                        Que o serviço <strong>não paga dívidas</strong>, que a dívida continua existindo, que o processo pode durar até <strong>12 meses</strong>, podendo manter a negativação sem exposição pública enquanto não houver atraso, e que qualquer inadimplência pode fazer a restrição <strong className="text-red-400">retornar imediatamente</strong>.
                      </p>
                    </div>
                  </label>
                </>
              )}
            </div>
          ) : null}

          {/* STEP DADOS - Dinâmico (Step 4 para CLT/AUTONOMO, Step 3 para MOTO/LIMPA_NOME, Step 5 para GARANTIA) */}
          {((currentStep === 4 && (profileType === 'CLT' || profileType === 'AUTONOMO')) ||
            (currentStep === 3 && (profileType === 'MOTO' || profileType === 'LIMPA_NOME')) ||
            (currentStep === 5 && profileType === 'GARANTIA')) && (
              <div className="space-y-5 animate-in slide-in-from-right">
                <h2 className="text-xl font-bold">Seus Dados Pessoais</h2>

                {/* LIMPA_NOME: Formulário simplificado - apenas dados essenciais */}
                {profileType === 'LIMPA_NOME' ? (
                  <div className="space-y-4">
                    <Input label="Nome Completo" name="name" value={formData.name} onChange={handleChange} placeholder="Como no documento" />
                    <Input label="Telefone" name="phone" value={formData.phone} onChange={handleChange} placeholder="(00) 00000-0000" />
                    <Input label="CPF ou CNPJ" name="cpf" value={formData.cpf} onChange={handleChange} placeholder="000.000.000-00 ou 00.000.000/0000-00" error={errors.cpf} />
                    <Input label="Data de Nascimento" type="date" name="birthDate" value={formData.birthDate} onChange={handleChange} />
                    <Input label="Email" type="email" name="email" value={formData.email} onChange={handleChange} placeholder="seu@email.com" />
                  </div>
                ) : (
                  <>
                    <div className="space-y-4">
                      <Input label="Nome Completo" name="name" value={formData.name} onChange={handleChange} placeholder="Como no documento" />
                      <Input label="CPF" name="cpf" value={formData.cpf} onChange={handleChange} placeholder="000.000.000-00" error={errors.cpf} />
                      <Input label="WhatsApp Principal" name="phone" value={formData.phone} onChange={handleChange} placeholder="(00) 00000-0000" />
                      <Input label="Email" type="email" name="email" value={formData.email} onChange={handleChange} />
                      <Input label="Instagram" name="instagram" value={formData.instagram} onChange={handleChange} placeholder="@seu_usuario" required />
                    </div>

                    {/* Dados Específicos por Perfil */}
                    {profileType === 'AUTONOMO' && (
                      <div className="pt-4 border-t border-zinc-800 space-y-4">
                        <h3 className="text-sm font-bold text-[#D4AF37]">Dados do Negócio</h3>
                        <Input label="CNPJ" name="cnpj" value={formData.cnpj} onChange={handleChange} placeholder="00.000.000/0000-00" />
                        <Input label="Endereço Comercial" name="businessAddress" value={formData.businessAddress} onChange={handleChange} />
                        <Input label="Renda Mensal Média" name="income" value={formData.income} onChange={handleChange} placeholder="0,00" />
                      </div>
                    )}

                    {(profileType === 'MOTO' || profileType === 'GARANTIA_VEICULO' || profileType === 'CLT') && (
                      <div className="pt-4 border-t border-zinc-800 space-y-4">
                        <h3 className="text-sm font-bold text-[#D4AF37]">Dados Profissionais</h3>
                        <Input label="Profissão" name="occupation" value={formData.occupation} onChange={handleChange} />
                        <div className="grid grid-cols-2 gap-4">
                          <Input label="Renda Mensal" name="income" value={formData.income} onChange={handleChange} />
                          <Input label="Dia Pagamento" name="workTime" value={formData.workTime} onChange={handleChange} placeholder="Dia 05" />
                        </div>
                      </div>
                    )}

                    <div className="pt-4 border-t border-zinc-800 space-y-4">
                      <h3 className="text-sm font-bold text-[#D4AF37]">Endereço Residencial</h3>
                      <Input label="CEP" name="cep" value={formData.cep} onChange={handleChange} placeholder="00000-000" />
                      <Input label="Endereço" name="address" value={formData.address} readOnly className="opacity-60" />
                      <Input label="Número" name="number" value={formData.number} onChange={handleChange} placeholder="123" />
                    </div>

                    {/* Referências / Pessoas Próximas */}
                    {profileType !== 'LIMPA_NOME' && (
                      <div className="pt-4 border-t border-zinc-800 space-y-4">
                        <h3 className="text-sm font-bold text-[#D4AF37]">Referências (Pessoas Próximas)</h3>
                        <p className="text-xs text-zinc-500">Informe 2 contatos de pessoas próximas para referência.</p>
                        <div className="grid grid-cols-2 gap-4">
                          <Input label="Nome da Referência 1" name="contactTrust1Name" value={formData.contactTrust1Name} onChange={handleChange} placeholder="Nome completo" />
                          <Input label="WhatsApp Referência 1" name="contactTrust1" value={formData.contactTrust1} onChange={handleChange} placeholder="(99) 99999-9999" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <Input label="Nome da Referência 2" name="contactTrust2Name" value={formData.contactTrust2Name} onChange={handleChange} placeholder="Nome completo" />
                          <Input label="WhatsApp Referência 2" name="contactTrust2" value={formData.contactTrust2} onChange={handleChange} placeholder="(99) 99999-9999" />
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

          {/* STEP PRODUTO - Informação da Moto (Step 4 MOTO) */}
          {currentStep === 4 && profileType === 'MOTO' && (
            <div className="space-y-6 animate-in slide-in-from-right">
              <div className="text-center">
                <Car size={48} className="mx-auto text-blue-400 mb-3" />
                <h2 className="text-xl font-bold">Honda Pop 110i 2026</h2>
                <p className="text-zinc-400 text-sm mt-2">Financiamento próprio Tubarão</p>
              </div>

              <div className="bg-blue-900/20 border border-blue-600/30 rounded-xl p-6 text-center">
                <p className="text-blue-400 font-bold text-lg mb-2">🏍️ Honda Pop 110i 2026</p>
                <p className="text-zinc-300 text-sm mb-4">Cor conforme disponibilidade de estoque</p>
                <div className="bg-black/30 rounded-lg p-4">
                  <p className="text-[#D4AF37] font-bold">Entrada: R$ 2.000,00</p>
                  <p className="text-white font-bold text-lg mt-1">36x R$ 611,00 + Seguro R$ 150,00</p>
                  <p className="text-zinc-400 text-xs mt-2">Total mensal: R$ 761,00</p>
                </div>
              </div>

              <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-4">
                <h3 className="font-bold text-white mb-2">📋 Informações Importantes</h3>
                <ul className="text-sm text-zinc-300 space-y-2">
                  <li>• A moto será entregue ZERADA, 0km</li>
                  <li>• Cor será definida conforme disponibilidade no estoque</li>
                  <li>• Transferência somente após quitação da 36ª parcela</li>
                </ul>
              </div>
            </div>
          )}

          {/* STEP GARANTIA - Dados do Bem (Step 4 para GARANTIA) */}
          {currentStep === 4 && profileType === 'GARANTIA' && (
            <div className="space-y-6 animate-in slide-in-from-right">
              <div className="text-center">
                <Car size={48} className="mx-auto text-orange-400 mb-3" />
                <h2 className="text-xl font-bold">Dados da Garantia</h2>
                <p className="text-zinc-400 text-sm mt-2">Informe detalhes do bem que ficará em garantia</p>
              </div>

              {/* Lembrete importante */}
              <div className="bg-red-900/30 border border-red-500 rounded-xl p-4">
                <p className="text-red-400 text-sm font-bold text-center">
                  ⚠️ LEMBRETE: O bem será ENTREGUE FISICAMENTE e ficará em posse da empresa até quitação total
                </p>
              </div>

              {/* Tipo de Garantia */}
              <div className="space-y-3">
                <h3 className="font-bold text-[#D4AF37]">Selecione o tipo de garantia:</h3>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { id: 'carro', label: 'Carro', icon: Car, color: 'text-yellow-400' },
                    { id: 'moto', label: 'Moto', icon: Car, color: 'text-blue-400' },
                    { id: 'celular', label: 'Celular', icon: Smartphone, color: 'text-green-400' },
                    { id: 'notebook', label: 'Notebook/Tablet', icon: Tv, color: 'text-purple-400' },
                    { id: 'jetski', label: 'Jet Ski', icon: Car, color: 'text-cyan-400' },
                    { id: 'outro', label: 'Outro Veículo', icon: Package, color: 'text-gray-400' },
                  ].map((tipo) => (
                    <button
                      key={tipo.id}
                      onClick={() => setGuarantee({ ...guarantee, type: tipo.id })}
                      className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${guarantee.type === tipo.id
                        ? 'border-[#D4AF37] bg-[#D4AF37]/10 ring-2 ring-[#D4AF37]'
                        : 'border-zinc-700 hover:border-zinc-500'
                        }`}
                    >
                      <tipo.icon size={28} className={tipo.color} />
                      <span className="text-sm font-bold">{tipo.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Descrição do Bem */}
              {guarantee.type && (
                <div className="space-y-4 border-t border-zinc-800 pt-4">
                  <div className="space-y-2">
                    <label className="block text-sm font-bold text-[#D4AF37]">
                      Descreva o bem (marca, modelo, ano):
                    </label>
                    <textarea
                      value={guarantee.description}
                      onChange={(e) => setGuarantee({ ...guarantee, description: e.target.value })}
                      placeholder={
                        guarantee.type === 'carro' ? 'Ex: Honda Civic 2020 Preto' :
                          guarantee.type === 'moto' ? 'Ex: Honda CG 160 2022' :
                            guarantee.type === 'celular' ? 'Ex: iPhone 14 Pro 256GB' :
                              guarantee.type === 'notebook' ? 'Ex: MacBook Air M2 2023' :
                                'Descreva marca, modelo e ano'
                      }
                      className="w-full bg-black border border-zinc-700 rounded-xl p-3 text-white focus:border-[#D4AF37] outline-none min-h-[80px]"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-bold text-[#D4AF37]">
                      Valor Estimado do Bem (R$):
                    </label>
                    <input
                      type="text"
                      value={guarantee.estimatedValue}
                      onChange={(e) => setGuarantee({ ...guarantee, estimatedValue: e.target.value })}
                      placeholder="Ex: 15.000,00"
                      className="w-full bg-black border border-zinc-700 rounded-xl p-3 text-white focus:border-[#D4AF37] outline-none"
                    />
                    <p className="text-xs text-zinc-500">
                      Lembre-se: o valor deve ser NO MÍNIMO O DOBRO do empréstimo (R$ {(getAmount() * 2).toLocaleString('pt-BR', { minimumFractionDigits: 2 })})
                    </p>
                  </div>

                  {/* Condição do bem */}
                  <div className="space-y-2">
                    <label className="block text-sm font-bold text-[#D4AF37]">
                      Condição do Bem:
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {['Ótimo', 'Bom', 'Regular'].map((cond) => (
                        <button
                          key={cond}
                          onClick={() => setGuarantee({ ...guarantee, condition: cond })}
                          className={`p-3 rounded-lg border text-sm font-bold transition-all ${guarantee.condition === cond
                            ? 'border-[#D4AF37] bg-[#D4AF37]/10 text-[#D4AF37]'
                            : 'border-zinc-700 text-zinc-400 hover:border-zinc-500'
                            }`}
                        >
                          {cond}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Fotos do Bem */}
                  <div className="space-y-2">
                    <h3 className="font-bold text-[#D4AF37]">📷 Fotos do Bem (OBRIGATÓRIO)</h3>
                    <p className="text-xs text-zinc-500">
                      {guarantee.type === 'carro' || guarantee.type === 'moto' || guarantee.type === 'jetski'
                        ? 'Envie fotos: frente, lateral, traseira, interior e documento (CRLV)'
                        : 'Envie fotos de todos os ângulos mostrando a condição do aparelho'}
                    </p>
                    {renderUploadArea('photos', 'Fotos do Bem em Garantia', guarantee.photos, true)}
                  </div>

                  {/* Documento do veículo (CRLV) - apenas para veículos */}
                  {(guarantee.type === 'carro' || guarantee.type === 'moto' || guarantee.type === 'jetski' || guarantee.type === 'outro') && (
                    <div className="space-y-2 border-t border-zinc-800 pt-4">
                      <h3 className="font-bold text-[#D4AF37]">📄 Documento do Veículo (CRLV)</h3>
                      <p className="text-xs text-zinc-500">O veículo deve estar quitado e sem débitos.</p>
                      {renderUploadArea('vehicleCRLV', 'CRLV do Veículo', formData.vehicleCRLV)}
                    </div>
                  )}

                  {/* Nota Fiscal - para eletrônicos (OBRIGATÓRIO) */}
                  {(guarantee.type === 'celular' || guarantee.type === 'notebook') && (
                    <div className="space-y-2 border-t border-zinc-800 pt-4">
                      <h3 className="font-bold text-[#D4AF37]">📄 Nota Fiscal do Aparelho (OBRIGATÓRIO)</h3>
                      <p className="text-xs text-zinc-500">Envie a nota fiscal ou comprovante de compra do aparelho.</p>
                      {renderUploadArea('proofPurchase', 'Nota Fiscal ou Comprovante de Compra', formData.proofPurchase)}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}


          {/* STEP DOCUMENTOS - Dinâmico (Step 5 para CLT/AUTONOMO/MOTO, Step 6 para GARANTIA) - NÃO para LIMPA_NOME */}
          {((currentStep === 5 && (profileType === 'CLT' || profileType === 'AUTONOMO' || profileType === 'MOTO')) ||
            (currentStep === 6 && profileType === 'GARANTIA')) && (
              <div className="space-y-6 animate-in slide-in-from-right">
                <h2 className="text-xl font-bold">Documentação</h2>
                <p className="text-zinc-400 text-sm">Envie fotos legíveis para agilizar a aprovação.</p>

                {/* Obrigatórios para todos */}
                <div className="bg-black p-4 rounded-xl border border-zinc-800">
                  <Camera label="Selfie Segurando Documento" onCapture={(img) => setFormData({ ...formData, selfie: img })} />
                </div>

                {renderUploadArea('idCardFront', 'RG ou CNH (Frente)', formData.idCardFront)}
                {renderUploadArea('idCardBack', 'RG ou CNH (Verso)', formData.idCardBack)}

                {/* Comprovante de Endereço - OBRIGATÓRIO */}
                <div className="space-y-2">
                  {renderUploadArea('proofAddress', 'Comprovante de Endereço - Água ou Luz (OBRIGATÓRIO)', formData.proofAddress)}
                  {/* Boleto em nome - não exigido para MOTO */}
                  {profileType !== 'MOTO' && (
                    <>
                      <div className="bg-red-900/20 border border-red-600/30 rounded-lg p-3">
                        <p className="text-xs text-red-400">
                          <strong>⚠️ OBRIGATÓRIO:</strong> Envie também um boleto (banco, cartão, etc.) <strong>em seu nome</strong> para confirmar o endereço.
                        </p>
                      </div>
                      {renderUploadArea('billInName', 'Boleto em Seu Nome (OBRIGATÓRIO)', formData.billInName)}
                    </>
                  )}
                </div>

                {/* Comprovante de Renda - OBRIGATÓRIO */}
                <div className="space-y-2 border-t border-zinc-800 pt-6">
                  <h3 className="font-bold text-[#D4AF37]">💰 Comprovante de Renda (OBRIGATÓRIO)</h3>
                  <div className="bg-blue-900/20 border border-blue-600/30 rounded-lg p-3">
                    <p className="text-xs text-blue-400">
                      <strong>📄 Aceitos:</strong> Extrato bancário, holerite, declaração de faturamento, pró-labore, ou comprovante de recebimento de PIX/transferências.
                    </p>
                  </div>
                  {renderUploadArea('proofIncome', 'Comprovante de Renda (OBRIGATÓRIO)', formData.proofIncome)}
                </div>

                {/* CNH - Obrigatório para MOTO, AUTONOMO e GARANTIA_VEICULO */}
                {(profileType === 'MOTO' || profileType === 'AUTONOMO' || profileType === 'GARANTIA_VEICULO') && (
                  <div className="space-y-6 border-t border-zinc-800 pt-6">
                    <h3 className="font-bold text-[#D4AF37]">📄 Habilitação (OBRIGATÓRIO)</h3>
                    {renderUploadArea('cnh', 'Foto da CNH - Frente e Verso (OBRIGATÓRIO)', formData.cnh || [])}
                  </div>
                )}

                {profileType === 'GARANTIA_VEICULO' && (
                  <div className="space-y-6 border-t border-zinc-800 pt-6">
                    <h3 className="font-bold text-[#D4AF37]">🚗 Dados do Veículo (OBRIGATÓRIO)</h3>
                    {renderUploadArea('vehicleCRLV', 'Documento do Carro - CRLV (OBRIGATÓRIO)', formData.vehicleCRLV)}
                    {renderUploadArea('vehicleFront', 'Fotos do Veículo - Frente, Lateral, Traseira (OBRIGATÓRIO)', formData.vehicleFront)}
                  </div>
                )}

                {profileType === 'AUTONOMO' && (
                  <div className="space-y-6 border-t border-zinc-800 pt-6">
                    <h3 className="font-bold text-[#D4AF37]">💼 Comprovantes do Negócio (OBRIGATÓRIO)</h3>
                    <div className="bg-black p-4 rounded-xl border border-zinc-800">
                      <VideoUpload label="🎥 Vídeo do Estabelecimento (OBRIGATÓRIO)" subtitle="Mostre seu local de trabalho"
                        videoUrl={formData.videoHouse} onUpload={(url) => setFormData({ ...formData, videoHouse: url })}
                        onRemove={() => setFormData({ ...formData, videoHouse: '' })} />
                    </div>
                  </div>
                )}

                {/* Carteira de Trabalho para CLT - APENAS PDF - OBRIGATÓRIO */}
                {profileType === 'CLT' && (
                  <div className="space-y-4 border-t border-zinc-800 pt-6">
                    <h3 className="font-bold text-[#D4AF37]">📋 Comprovante de Vínculo Empregatício (OBRIGATÓRIO)</h3>
                    <div className="bg-blue-900/20 border border-blue-600/30 rounded-lg p-4">
                      <p className="text-sm text-blue-400 mb-2">
                        <strong>📄 Carteira de Trabalho Digital (PDF)</strong>
                      </p>
                      <p className="text-xs text-zinc-400">
                        Exporte sua Carteira de Trabalho Digital pelo app oficial do governo:
                      </p>
                      <ol className="text-xs text-zinc-500 mt-2 space-y-1 list-decimal list-inside">
                        <li>Abra o app "Carteira de Trabalho Digital"</li>
                        <li>Vá em "Contratos de Trabalho"</li>
                        <li>Clique em "Exportar PDF"</li>
                        <li>Envie o arquivo aqui</li>
                      </ol>
                    </div>
                    {renderUploadArea('workCard', 'Carteira de Trabalho - PDF (OBRIGATÓRIO)', formData.workCard)}
                    <p className="text-xs text-red-400">❌ Não aceitamos foto da carteira física. Apenas PDF do app oficial.</p>
                  </div>
                )}

                {/* VÍDEO E FOTOS DA RESIDÊNCIA - OBRIGATÓRIO */}
                <div className="space-y-4 border-t border-zinc-800 pt-6">
                  <h3 className="font-bold text-[#D4AF37] flex items-center gap-2">
                    <Home size={18} /> 🏠 {profileType === 'MOTO' ? 'Foto da Fachada (OBRIGATÓRIO)' : 'Comprovação de Residência (OBRIGATÓRIO)'}
                  </h3>
                  <div className="bg-red-900/20 border border-red-600/30 rounded-lg p-3">
                    <p className="text-xs text-red-400">
                      <strong>⚠️ OBRIGATÓRIO:</strong> {profileType === 'MOTO'
                        ? 'Envie fotos da fachada da sua casa.'
                        : 'Envie fotos da fachada da sua casa e grave um vídeo mostrando a residência (de fora e de dentro).'
                      }
                    </p>
                  </div>

                  {renderUploadArea('housePhotos', 'Fotos da Fachada/Frente da Casa (OBRIGATÓRIO)', formData.housePhotos)}

                  {/* Vídeo da residência - não obrigatório para MOTO */}
                  {profileType !== 'MOTO' && (
                    <div className="bg-black p-4 rounded-xl border border-zinc-800">
                      <VideoUpload
                        label="🎥 Vídeo da sua Residência (OBRIGATÓRIO)"
                        subtitle="Mostre a fachada e entre na casa rapidamente"
                        videoUrl={formData.videoHouse}
                        onUpload={(url) => setFormData({ ...formData, videoHouse: url })}
                        onRemove={() => setFormData({ ...formData, videoHouse: '' })}
                      />
                    </div>
                  )}
                </div>

                {/* VÍDEO DA GARANTIA - OBRIGATÓRIO se tiver garantia */}
                {needsGuarantee && (
                  <div className="space-y-4 border-t border-zinc-800 pt-6">
                    <h3 className="font-bold text-[#D4AF37] flex items-center gap-2">
                      <Shield size={18} /> 🔒 Vídeo do Bem em Garantia (OBRIGATÓRIO)
                    </h3>
                    <div className="bg-red-900/20 border border-red-600/30 rounded-lg p-3">
                      <p className="text-xs text-red-400">
                        <strong>⚠️ OBRIGATÓRIO:</strong> Grave um vídeo mostrando o bem que será usado como garantia (carro, moto, celular, etc). Mostre todos os lados e detalhes.
                      </p>
                    </div>

                    {renderUploadArea('guaranteePhotos', 'Fotos do Bem em Garantia (OBRIGATÓRIO)', guarantee.photos)}

                    <div className="bg-black p-4 rounded-xl border border-zinc-800">
                      <VideoUpload
                        label="🎥 Vídeo do Bem em Garantia (OBRIGATÓRIO)"
                        subtitle="Mostre o bem por completo, frente, lateral, traseira"
                        videoUrl={guarantee.video}
                        onUpload={(url) => setGuarantee({ ...guarantee, video: url })}
                        onRemove={() => setGuarantee({ ...guarantee, video: '' })}
                      />
                    </div>
                  </div>
                )}

                {/* Vídeo de confirmação com declaração de juros - OBRIGATÓRIO (não para MOTO) */}
                {profileType !== 'MOTO' && (
                  <div className="space-y-4 border-t border-zinc-800 pt-6">
                    <h3 className="font-bold text-[#D4AF37]">🎬 Vídeo de Aceite (OBRIGATÓRIO)</h3>
                    <div className="bg-red-900/20 border border-red-600/30 rounded-lg p-3">
                      <p className="text-xs text-red-400">
                        <strong>⚠️ OBRIGATÓRIO:</strong> Grave um vídeo dizendo seu nome e confirmando que aceita os juros de {settings?.interestRateMonthly || 30}% ao mês.
                      </p>
                    </div>
                    <div className="bg-black p-4 rounded-xl border border-zinc-800">
                      <VideoUpload
                        label="🎥 Vídeo de Aceite (OBRIGATÓRIO)"
                        subtitle={`Diga seu nome e: "Estou ciente do empréstimo e dos juros de ${settings?.interestRateMonthly || 30}%"`}
                        videoUrl={formData.videoSelfie}
                        onUpload={(url) => setFormData({ ...formData, videoSelfie: url })}
                        onRemove={() => setFormData({ ...formData, videoSelfie: '' })}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

          {/* STEP 4: Contrato/Assinatura - APENAS LIMPA_NOME */}
          {currentStep === 4 && profileType === 'LIMPA_NOME' && (
            <div className="space-y-6 animate-in slide-in-from-right">
              <div className="text-center">
                <FileSignature size={48} className="mx-auto text-purple-400 mb-3" />
                <h2 className="text-xl font-bold">Termo de Autorização e Representação</h2>
                <p className="text-zinc-400 text-sm mt-2">Leia e assine o contrato para prosseguir</p>
              </div>

              {/* CONTRATO - TERMO DE AUTORIZAÇÃO E REPRESENTAÇÃO */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 max-h-[450px] overflow-y-auto">
                <h3 className="font-bold text-purple-400 mb-4 text-center text-lg">TERMO DE AUTORIZAÇÃO E REPRESENTAÇÃO</h3>

                <div className="text-sm text-zinc-300 space-y-3 mb-4">
                  <p><strong className="text-white">CPF OU CNPJ:</strong> {formData.cpf || '_______________'}</p>
                </div>

                <div className="text-sm text-zinc-300 space-y-4 whitespace-pre-line leading-relaxed">
                  {SERVICE_TERMS.LIMPA_NOME.contractText}
                </div>

                <div className="mt-6 pt-4 border-t border-zinc-700">
                  <p className="text-sm text-zinc-300">
                    <strong className="text-white">ASSINATURA DO CLIENTE:</strong> ___________________________________________
                  </p>
                  <div className="text-center text-zinc-500 text-xs mt-3">
                    <p>Data: {new Date().toLocaleDateString('pt-BR')}</p>
                  </div>
                </div>
              </div>

              {/* ASSINATURA DO CLIENTE - OBRIGATÓRIO */}
              <div className="space-y-3">
                <h3 className="font-bold text-purple-400">ASSINATURA DO CLIENTE (OBRIGATÓRIO)</h3>
                <div className="bg-red-900/20 border border-red-600/30 rounded-lg p-3">
                  <p className="text-xs text-red-400">
                    <strong>OBRIGATÓRIO:</strong> Assine no campo abaixo para confirmar sua adesão ao serviço. Sem assinatura, não será possível prosseguir.
                  </p>
                </div>
                <SignaturePad onSign={(sig) => setFormData({ ...formData, signature: sig })} />
              </div>
            </div>
          )}

          {/* STEP BANCO - Apenas CLT (6), AUTONOMO (6) e GARANTIA (7) precisam de conta bancária */}
          {((currentStep === 6 && (profileType === 'CLT' || profileType === 'AUTONOMO')) ||
            (currentStep === 7 && profileType === 'GARANTIA')) && (
              <div className="space-y-6 animate-in slide-in-from-right">
                <div className="text-center">
                  <Landmark size={48} className="mx-auto text-[#D4AF37] mb-3" />
                  <h2 className="text-xl font-bold">Onde depositamos o dinheiro?</h2>
                </div>

                {/* AVISO IMPORTANTE DE TITULARIDADE */}
                <div className="bg-red-900/30 border-2 border-red-500 rounded-xl p-4">
                  <p className="text-sm text-red-400 font-bold flex items-start gap-2">
                    <AlertCircle size={20} className="shrink-0 mt-0.5" />
                    <span>
                      ⚠️ ATENÇÃO: A conta bancária <strong className="text-white">DEVE SER DO MESMO TITULAR</strong> que está solicitando o empréstimo. Não depositamos em contas de terceiros.
                    </span>
                  </p>
                </div>

                <Input label="Banco (OBRIGATÓRIO)" name="bankName" value={formData.bankName} onChange={handleChange} placeholder="Ex: Nubank" />
                <div className="grid grid-cols-4 gap-2">
                  {[{ v: 'cpf', l: 'CPF' }, { v: 'phone', l: 'Celular' }, { v: 'email', l: 'Email' }, { v: 'random', l: 'Aleatória' }].map(o => (
                    <button key={o.v} type="button" onClick={() => setFormData({ ...formData, pixKeyType: o.v })}
                      className={`p-2 rounded-lg border text-sm ${formData.pixKeyType === o.v ? 'border-[#D4AF37] text-[#D4AF37]' : 'border-zinc-700 text-zinc-400'}`}>{o.l}</button>
                  ))}
                </div>
                <Input label="Chave PIX (OBRIGATÓRIO)" name="pixKey" value={formData.pixKey} onChange={handleChange} placeholder="Sua chave" />
                <Input label="Nome do Titular da Conta (OBRIGATÓRIO)" name="accountHolderName" value={formData.accountHolderName} onChange={handleChange} placeholder="Seu nome completo" />
              </div>
            )}


          {/* STEP CONFIRMAR - Último step de cada perfil */}
          {((currentStep === 7 && (profileType === 'CLT' || profileType === 'AUTONOMO')) ||
            (currentStep === 6 && profileType === 'MOTO') ||
            (currentStep === 5 && profileType === 'LIMPA_NOME') ||
            (currentStep === 8 && profileType === 'GARANTIA')) && (
              <div className="space-y-6 animate-in slide-in-from-right">
                <div className="text-center">
                  <CheckCircle2 size={48} className="mx-auto text-green-500 mb-3" />
                  <h2 className="text-xl font-bold">Confirme sua Solicitação</h2>
                </div>

                {profileType === 'LIMPA_NOME' ? (
                  <>
                    {/* Resumo simplificado para Limpa Nome */}
                    <div className="bg-black border border-zinc-800 rounded-xl p-4 space-y-3 text-sm">
                      <div className="flex justify-between"><span className="text-zinc-400">Serviço:</span><span className="font-bold text-purple-400">Limpa Nome</span></div>
                      <div className="flex justify-between"><span className="text-zinc-400">Nome:</span><span className="font-bold">{formData.name}</span></div>
                      <div className="flex justify-between"><span className="text-zinc-400">CPF/CNPJ:</span><span className="font-bold">{formData.cpf}</span></div>
                      <div className="flex justify-between"><span className="text-zinc-400">Telefone:</span><span className="font-bold">{formData.phone}</span></div>
                      <div className="flex justify-between"><span className="text-zinc-400">Email:</span><span className="font-bold">{formData.email}</span></div>
                      <div className="flex justify-between"><span className="text-zinc-400">Contrato:</span><span className="font-bold text-green-400">Assinado</span></div>
                    </div>

                    <div className="bg-purple-900/20 border border-purple-600/30 rounded-xl p-4">
                      <p className="text-sm text-zinc-300 text-center">
                        Ao confirmar, sua solicitação será enviada para análise. Você receberá um retorno em breve.
                      </p>
                    </div>
                  </>
                ) : profileType === 'MOTO' ? (
                  <>
                    {/* Resumo para Financiamento Moto */}
                    <div className="bg-black border border-zinc-800 rounded-xl p-4 space-y-3 text-sm">
                      <div className="flex justify-between"><span className="text-zinc-400">Produto:</span><span className="font-bold text-blue-400">Honda Pop 110i 2026</span></div>
                      <div className="flex justify-between"><span className="text-zinc-400">Cor:</span><span className="font-bold capitalize">{formData.motoColor}</span></div>
                      <div className="flex justify-between"><span className="text-zinc-400">Entrada:</span><span className="font-bold">R$ 2.000,00</span></div>
                      <div className="flex justify-between"><span className="text-zinc-400">Parcelas:</span><span className="font-bold">36x R$ 611,00</span></div>
                      <div className="flex justify-between"><span className="text-zinc-400">Seguro:</span><span className="font-bold">R$ 150,00/mês</span></div>
                      <div className="flex justify-between"><span className="text-zinc-400">Mensal Total:</span><span className="font-bold text-[#D4AF37]">R$ 761,00</span></div>
                      <div className="flex justify-between"><span className="text-zinc-400">Nome:</span><span className="font-bold">{formData.name}</span></div>
                    </div>

                    <div className="bg-red-900/20 border border-red-600/30 rounded-xl p-4 space-y-2">
                      <h3 className="font-bold text-red-400 text-xs uppercase">TERMO DE FINANCIAMENTO (OBRIGATÓRIO)</h3>
                      <p className="text-xs text-zinc-400">Ao assinar, declaro que li e concordo com todas as condições do financiamento próprio, incluindo busca e apreensão em caso de inadimplência e transferência somente após a 36ª parcela.</p>
                    </div>

                    <div className="space-y-2">
                      <h3 className="font-bold text-[#D4AF37]">Sua Assinatura (OBRIGATÓRIO)</h3>
                      <div className="bg-red-900/20 border border-red-600/30 rounded-lg p-3">
                        <p className="text-xs text-red-400">
                          <strong>OBRIGATÓRIO:</strong> Assine no campo abaixo para confirmar seu financiamento.
                        </p>
                      </div>
                      <SignaturePad onSign={(sig) => setFormData({ ...formData, signature: sig })} />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="bg-black border border-zinc-800 rounded-xl p-4 space-y-2 text-sm">
                      <div className="flex justify-between"><span className="text-zinc-400">Tempo de Análise:</span><span className="font-bold text-[#D4AF37]">Até 72 Horas</span></div>
                      <div className="flex justify-between"><span className="text-zinc-400">Valor Solicitado:</span><span className="font-bold">R$ {getAmount().toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></div>
                      <div className="flex justify-between"><span className="text-zinc-400">Perfil:</span><span className="font-bold">{profileType}</span></div>
                      <div className="flex justify-between"><span className="text-zinc-400">Juros Mensais:</span><span className="font-bold text-[#D4AF37]">{settings.interestRateMonthly}% ao mês</span></div>
                    </div>

                    {/* TERMO FINAL */}
                    <div className="bg-red-900/20 border border-red-600/30 rounded-xl p-4 space-y-2">
                      <h3 className="font-bold text-red-400 text-xs uppercase">TERMO DE COMPROMISSO (OBRIGATÓRIO)</h3>
                      <p className="text-xs text-zinc-400">Ao assinar, declaro que as informações são verdadeiras e autorizo a emissão de CCB (Cédula de Crédito Bancário).</p>
                    </div>

                    <div className="space-y-2">
                      <h3 className="font-bold text-[#D4AF37]">Sua Assinatura (OBRIGATÓRIO)</h3>
                      <div className="bg-red-900/20 border border-red-600/30 rounded-lg p-3">
                        <p className="text-xs text-red-400">
                          <strong>OBRIGATÓRIO:</strong> Assine no campo abaixo para confirmar sua solicitação. Sem assinatura, não será possível enviar.
                        </p>
                      </div>
                      <SignaturePad onSign={(sig) => setFormData({ ...formData, signature: sig })} />
                    </div>
                  </>
                )}
              </div>
            )}
        </div>

        {/* Buttons */}
        <div className="fixed bottom-0 left-0 w-full p-4 bg-black/90 border-t border-zinc-900 flex gap-4 z-40 backdrop-blur-md">
          {currentStep > 1 && <Button onClick={handleBack} variant="secondary" className="flex-1">Voltar</Button>}
          {currentStep < steps.length ? (
            <Button onClick={handleNext} className="flex-1 font-bold text-lg">
              {currentStep === 1 ? 'Começar Simulação' : 'Continuar'}
            </Button>
          ) : (
            <Button onClick={handleSubmit} className="flex-1 bg-green-600 hover:bg-green-700 font-bold text-lg shadow-lg shadow-green-900/20" isLoading={loading} disabled={!formData.signature}>
              {profileType === 'INVESTIDOR' ? 'QUERO SER INVESTIDOR' :
                profileType === 'LIMPA_NOME' ? 'SOLICITAR SERVIÇO' :
                profileType === 'MOTO' ? 'SOLICITAR FINANCIAMENTO' : 'SOLICITAR MEU EMPRÉSTIMO'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

const Input = ({ label, error, className = "", required, ...props }: any) => (
  <div>
    <label className="block text-xs text-zinc-400 mb-1.5 ml-1">
      {label}{required && <span className="text-red-500 ml-1">*</span>}
    </label>
    <input className={`w-full bg-black border rounded-lg p-3 text-white text-sm focus:border-[#D4AF37] outline-none ${error ? 'border-red-900' : 'border-zinc-700'} ${className}`} {...props} />
    {error && <p className="text-xs text-red-500 mt-1 ml-1">{error}</p>}
  </div>
);