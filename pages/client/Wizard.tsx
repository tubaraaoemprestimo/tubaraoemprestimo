import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Check, ChevronLeft, ChevronDown, User, MapPin,
  AlertCircle, FileText, ScanFace, X, Plus, Loader2,
  Phone, Users, Video, DollarSign, Shield, Clock, Landmark, CheckCircle2, FileCheck, Percent,
  Car, Smartphone, Tv, Home, Package, Camera as CameraIcon, Trash2,
  Briefcase, Store, Bike, Banknote, Rocket, CreditCard, FileSignature, Scale, Gift
} from 'lucide-react';
import { Button } from '../../components/Button';
import { Camera } from '../../components/Camera';
import { SignaturePad } from '../../components/SignaturePad';
import { VideoUpload } from '../../components/VideoUpload';
import { apiService } from '../../services/apiService';
import { loanSettingsService, LoanSettings } from '../../services/loanSettingsService';
import { antifraudService } from '../../services/antifraudService';
import { emailService } from '../../services/emailService';
import { autoNotificationService } from '../../services/autoNotificationService';
import { useToast } from '../../components/Toast';
import { InstallPwaButton } from '../../components/InstallPwaButton';
import { SERVICE_TERMS } from '../../constants/serviceTerms';
import { contractPdfService } from '../../services/contractPdfService';

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
  // INVESTIDOR tem fluxo simplificado: Info > Dados > Investimento > Segurança > Confirmar
  if (profile === 'INVESTIDOR') {
    return [
      { id: 1, title: 'Serviço', icon: Users },
      { id: 2, title: 'Saiba Mais', icon: Shield },
      { id: 3, title: 'Dados', icon: User },
      { id: 4, title: 'Investimento', icon: DollarSign },
      { id: 5, title: 'Segurança', icon: Shield },
      { id: 6, title: 'Confirmar', icon: CheckCircle2 },
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
    email: '', phone: '', preferredContactTime: '',
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
  const [isDraggingSlider, setIsDraggingSlider] = useState(false);

  // Garantia (single item - CLT, MOTO, CAPITAL_GIRO)
  const [guarantee, setGuarantee] = useState({
    type: '',
    description: '',
    condition: '',
    estimatedValue: '',
    photos: [] as string[],
    video: ''
  });

  // Refs para auto-scroll
  const returningClientSectionRef = useRef<HTMLDivElement>(null);
  const referralSectionRef = useRef<HTMLDivElement>(null);
  const stepTopRef = useRef<HTMLDivElement>(null);

  // Handler interativo: seleciona perfil e rola a página para mostrar próxima ação
  const handleProfileSelect = (profileId: ProfileType) => {
    setProfileType(profileId);
    setTimeout(() => {
      // Para perfis com seção "já sou cliente", scroll até lá
      if (profileId !== 'MOTO' && profileId !== 'LIMPA_NOME' && profileId !== 'INVESTIDOR') {
        returningClientSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        referralSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 150);
  };

  // Interface para itens de garantia
  interface CollateralItem {
    id: string;
    type: string;
    description: string;
    condition: string;
    estimatedValue: string;
    hasInvoice: boolean;
    photos: string[];
    invoiceUrl: string | null;
    video: string;
  }

  // Garantia Universal - Múltiplos Itens
  const [collateralItems, setCollateralItems] = useState<CollateralItem[]>([{
    id: crypto.randomUUID(),
    type: '',
    description: '',
    condition: '',
    estimatedValue: '',
    hasInvoice: false,
    photos: [],
    invoiceUrl: null,
    video: ''
  }]);

  // Funções de gerenciamento de itens de garantia
  const addCollateralItem = () => {
    setCollateralItems([...collateralItems, {
      id: crypto.randomUUID(),
      type: '',
      description: '',
      condition: '',
      estimatedValue: '',
      hasInvoice: false,
      photos: [],
      invoiceUrl: null,
      video: ''
    }]);
  };

  const removeCollateralItem = (id: string) => {
    if (collateralItems.length === 1) {
      addToast('Você precisa ter pelo menos 1 item de garantia.', 'warning');
      return;
    }
    setCollateralItems(collateralItems.filter(item => item.id !== id));
  };

  const updateCollateralItem = (id: string, field: keyof CollateralItem, value: any) => {
    setCollateralItems(collateralItems.map(item =>
      item.id === id ? { ...item, [field]: value } : item
    ));
  };

  const getTotalCollateralValue = () => {
    return collateralItems.reduce((sum, item) => {
      const value = parseFloat(item.estimatedValue.replace(/\./g, '').replace(',', '.')) || 0;
      return sum + value;
    }, 0);
  };

  const [formData, setFormData] = useState({
    name: '', cpf: '', email: '', phone: '', birthDate: '', referralCode: '',
    whatsappPersonal: '',
    contactTrust1: '', contactTrust1Name: '', contactTrust1Relationship: '',
    contactTrust2: '', contactTrust2Name: '', contactTrust2Relationship: '',
    instagram: '',
    occupation: '', companyName: '', companyAddress: '', workTime: '',
    // Endereço da empresa
    companyCep: '', companyStreet: '', companyNumber: '', companyNeighborhood: '', companyCity: '', companyState: '',
    // Indicação
    referredByCode: '',
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
    // Declaração de veracidade
    declarationAccepted: false,
  });

  // Carregar configurações REAIS do banco e registrar visita (antifraude)
  useEffect(() => {
    const loadSettings = async () => {
      setLoadingSettings(true);

      // Registrar início do wizard (antifraude - silencioso)
      antifraudService.initSession();
      antifraudService.logRiskEvent('wizard_start').catch(() => { });

      // Verifica limite de dispositivos antes de iniciar o fluxo
      const deviceCheck = await antifraudService.checkDevice();
      if (!deviceCheck.allowed) {
        addToast(deviceCheck.message || 'Acesso bloqueado por segurança do dispositivo.', 'error');
        navigate('/client/dashboard');
        setLoadingSettings(false);
        return;
      }

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

  // ── FASE 1: Strict Validation — pode avançar no step atual? ──────────────
  const canProceedOnCurrentStep = (() => {
    // LIMPA_NOME step 4: assinatura obrigatória
    if (profileType === 'LIMPA_NOME' && currentStep === 4) {
      return !!formData.signature;
    }
    // Step de documentos (vídeos obrigatórios)
    const docsStep = profileType === 'GARANTIA' ? 6 : 5;
    if (
      profileType !== 'LIMPA_NOME' &&
      profileType !== 'INVESTIDOR' &&
      currentStep === docsStep
    ) {
      if (profileType !== 'MOTO' && !formData.videoHouse) return false;
      if (profileType !== 'MOTO' && !formData.videoSelfie) return false;
      if (needsGuarantee && !guarantee.video) return false;
    }
    return true;
  })();

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

  const fetchCompanyAddress = async (cleanCep: string) => {
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setFormData(prev => ({
          ...prev,
          companyStreet: data.logradouro || '',
          companyNeighborhood: data.bairro || '',
          companyCity: data.localidade || '',
          companyState: data.uf || '',
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

    if (name === 'cep' || name === 'companyCep') {
      let v = value.replace(/\D/g, '').slice(0, 8);
      if (v.length > 5) v = v.replace(/^(\d{5})(\d)/, '$1-$2');
      newValue = v;
      if (v.replace(/\D/g, '').length === 8) {
        if (name === 'cep') fetchAddress(v.replace(/\D/g, ''));
        if (name === 'companyCep') fetchCompanyAddress(v.replace(/\D/g, ''));
      }
    }

    if (['phone', 'whatsappPersonal', 'contactTrust1', 'contactTrust2'].includes(name)) {
      let v = value.replace(/\D/g, '').slice(0, 11);
      v = v.replace(/^(\d{2})(\d)/g, '($1) $2').replace(/(\d)(\d{4})$/, '$1-$2');
      newValue = v;
    }

    setFormData({ ...formData, [name]: newValue });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, fieldName: string, isGuarantee = false) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    try {
      const newFiles: string[] = [];

      for (const file of Array.from(files)) {
        const isPdf = file.type === 'application/pdf';
        const maxSize = isPdf ? 20 * 1024 * 1024 : 5 * 1024 * 1024;

        if (file.size > maxSize) {
          addToast(`Arquivo muito grande: ${file.name}. Máximo ${isPdf ? '20MB' : '5MB'}.`, 'warning');
          continue;
        }

        if (isPdf) {
          // PDF: converter para base64 diretamente, sem canvas
          const dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (ev) => resolve(ev.target?.result as string);
            reader.onerror = () => reject(new Error('Erro ao ler PDF'));
            reader.readAsDataURL(file);
          });
          newFiles.push(dataUrl);
        } else {
          // Imagem: comprimir via canvas
          const compressed = await compressImage(file);
          newFiles.push(compressed);
        }
      }

      if (newFiles.length === 0) return;

      // Verificar se é campo de collateralItems (invoice_${id} ou photos_${id})
      if (fieldName.startsWith('invoice_') || fieldName.startsWith('photos_')) {
        const itemId = fieldName.split('_')[1];
        const field = fieldName.startsWith('invoice_') ? 'invoiceUrl' : 'photos';

        setCollateralItems(prev => prev.map(item => {
          if (item.id === itemId) {
            if (field === 'invoiceUrl') {
              return { ...item, invoiceUrl: newFiles[0] };
            } else {
              return { ...item, photos: [...item.photos, ...newFiles] };
            }
          }
          return item;
        }));
      } else if (isGuarantee) {
        setGuarantee(prev => ({
          ...prev,
          [fieldName]: [...(prev[fieldName as keyof typeof prev] as string[]), ...newFiles]
        }));
      } else {
        setFormData(prev => ({
          ...prev,
          [fieldName]: [...(prev[fieldName as keyof typeof prev] as string[]), ...newFiles]
        }));
      }

      const hasPdf = Array.from(files).some(f => f.type === 'application/pdf');
      addToast(hasPdf ? `PDF adicionado com sucesso` : `${newFiles.length} foto(s) adicionada(s)`, 'success');
    } catch (error) {
      console.error('Erro ao processar arquivo:', error);
      addToast('Erro ao processar arquivo. Tente novamente.', 'error');
    }
  };

  // Função para comprimir imagem
  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onerror = () => reject(new Error('Erro ao ler arquivo'));

      reader.onload = (e) => {
        const img = new Image();

        img.onerror = () => reject(new Error('Erro ao carregar imagem'));

        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          // Redimensionar se muito grande (max 1920px)
          const maxDimension = 1920;
          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = (height / width) * maxDimension;
              width = maxDimension;
            } else {
              width = (width / height) * maxDimension;
              height = maxDimension;
            }
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Erro ao criar canvas'));
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);

          // Comprimir para JPEG com qualidade 0.8
          const compressed = canvas.toDataURL('image/jpeg', 0.8);
          resolve(compressed);
        };

        img.src = e.target?.result as string;
      };

      reader.readAsDataURL(file);
    });
  };

  const removeFile = (fieldName: string, index: number, isGuarantee = false) => {
    // Verificar se é campo de collateralItems (invoice_${id} ou photos_${id})
    if (fieldName.startsWith('invoice_') || fieldName.startsWith('photos_')) {
      const itemId = fieldName.split('_')[1];
      const field = fieldName.startsWith('invoice_') ? 'invoiceUrl' : 'photos';

      setCollateralItems(prev => prev.map(item => {
        if (item.id === itemId) {
          if (field === 'invoiceUrl') {
            // invoiceUrl é string | null
            return { ...item, invoiceUrl: null };
          } else {
            // photos é array
            return { ...item, photos: item.photos.filter((_, i) => i !== index) };
          }
        }
        return item;
      }));
    } else if (isGuarantee) {
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
      // Cliente recorrente apenas para CLT, AUTONOMO e GARANTIA (nao INVESTIDOR, MOTO, LIMPA_NOME)
      if ((profileType === 'CLT' || profileType === 'AUTONOMO' || profileType === 'GARANTIA') && !isReturningClient) {
        addToast("Por favor, informe se já é nosso cliente.", 'warning');
        return;
      }
    }

    // === INVESTIDOR: Validações específicas por step ===
    if (profileType === 'INVESTIDOR') {
      // Step 2: "Saiba Mais" - validar aceite dos termos
      if (currentStep === 2) {
        if (!termsAccepted) { addToast("Você precisa aceitar os termos para continuar.", 'warning'); return; }
      }
      // Step 3: Dados pessoais
      if (currentStep === 3) {
        if (!investorData.fullName.trim()) { addToast("Informe seu nome completo ou razão social.", 'warning'); return; }
        if (!investorData.birthDate) { addToast("Informe sua data de nascimento.", 'warning'); return; }
        if (!investorData.phone || investorData.phone.replace(/\D/g, '').length < 10) {
          addToast("Informe seu telefone.", 'warning'); return;
        }
        if (!investorData.email.trim() || !investorData.email.includes('@')) {
          addToast("Informe um email válido.", 'warning'); return;
        }
        if (!investorData.preferredContactTime) {
          addToast("Selecione o melhor horário para contato.", 'warning'); return;
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
      // Step 6: Visualizar Termos (sem validação, apenas leitura)
      // Step 7: Assinatura
      if (currentStep === 7) {
        if (!formData.signature) { addToast("Assine o contrato para confirmar.", 'warning'); return; }
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
    // Validação Específica INVESTIDOR
    if (profileType === 'INVESTIDOR' && currentStep === 3) {
      if (!investorData.fullName.trim()) { addToast("Informe seu nome completo.", 'warning'); return; }
      if (!investorData.birthDate) { addToast("Informe sua data de nascimento.", 'warning'); return; }
      if (!investorData.phone.trim()) { addToast("Informe seu telefone.", 'warning'); return; }
      if (!investorData.email.trim()) { addToast("Informe seu email.", 'warning'); return; }
      if (!investorData.preferredContactTime) { addToast("Selecione o melhor horário para contato.", 'warning'); return; }
    }

    if (currentStep === dataStep && profileType !== 'INVESTIDOR') {
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

      // Data de nascimento obrigatória para TODOS os perfis
      if (!formData.birthDate) {
        addToast("Informe sua data de nascimento.", 'warning');
        return;
      }

      // LIMPA_NOME não precisa de endereço
      if (profileType !== 'LIMPA_NOME') {
        // Endereço obrigatório
        if (!formData.cep || formData.cep.replace(/\D/g, '').length !== 8) {
          addToast("Informe seu CEP.", 'warning');
          return;
        }
        if (!formData.address.trim()) {
          addToast("Informe seu endereço (rua/avenida).", 'warning');
          return;
        }
        if (!formData.number.trim()) {
          addToast("Informe o número da residência.", 'warning');
          return;
        }
      }

      // Renda obrigatória para CLT, AUTONOMO, MOTO e GARANTIA
      if (profileType === 'CLT' || profileType === 'AUTONOMO' || profileType === 'MOTO' || profileType === 'GARANTIA') {
        if (!formData.income.trim()) {
          addToast("Informe sua renda mensal.", 'warning');
          return;
        }
      }

      // Contatos de confiança obrigatórios (exceto LIMPA_NOME)
      if (profileType !== 'LIMPA_NOME') {
        if (!formData.contactTrust1Name.trim()) {
          addToast("Informe o nome do 1º contato de confiança.", 'warning');
          return;
        }
        if (!formData.contactTrust1 || formData.contactTrust1.replace(/\D/g, '').length < 10) {
          addToast("Informe o telefone do 1º contato de confiança.", 'warning');
          return;
        }
        if (!formData.contactTrust2Name.trim()) {
          addToast("Informe o nome do 2º contato de confiança.", 'warning');
          return;
        }
        if (!formData.contactTrust2 || formData.contactTrust2.replace(/\D/g, '').length < 10) {
          addToast("Informe o telefone do 2º contato de confiança.", 'warning');
          return;
        }
      }

      // Específico por perfil - CLT
      if (profileType === 'CLT') {
        if (!formData.occupation.trim()) {
          addToast("Informe sua profissão/cargo.", 'warning');
          return;
        }
        if (!formData.companyName.trim()) {
          addToast("Informe o nome da empresa onde trabalha.", 'warning');
          return;
        }
      }

      // Específico por perfil - AUTONOMO
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
    }

    // STEP PRODUTO (Info da Moto) - MOTO step 4 - não precisa validação, é apenas informativo

    // STEP GARANTIA - Dados do Bem (Step 4 para GARANTIA)
    if (profileType === 'GARANTIA' && currentStep === 4) {
      // Validar cada item
      for (let i = 0; i < collateralItems.length; i++) {
        const item = collateralItems[i];

        if (!item.type) {
          addToast(`Item ${i + 1}: Selecione o tipo de garantia.`, 'warning');
          return;
        }
        if (!item.description.trim()) {
          addToast(`Item ${i + 1}: Descreva o bem (marca, modelo, ano).`, 'warning');
          return;
        }
        if (!item.estimatedValue.trim()) {
          addToast(`Item ${i + 1}: Informe o valor estimado.`, 'warning');
          return;
        }
        if (item.photos.length === 0) {
          addToast(`Item ${i + 1}: Envie fotos do bem.`, 'warning');
          return;
        }

        // Se marcou que tem nota fiscal, a nota é obrigatória
        if (item.hasInvoice && !item.invoiceUrl) {
          addToast(`Item ${i + 1}: Envie a nota fiscal (você marcou que possui).`, 'warning');
          return;
        }
      }

      // Validar valor total mínimo
      const totalValue = getTotalCollateralValue();
      const minRequired = getAmount() * 2;
      if (totalValue < minRequired) {
        addToast(`Valor total insuficiente. Mínimo: R$ ${minRequired.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 'warning');
        return;
      }
    }

    // STEP DOCUMENTOS - Dinâmico (Step 5 para CLT/AUTONOMO e MOTO, Step 6 para GARANTIA) - LIMPA_NOME não tem docs
    let docsStep = 5;
    if (profileType === 'MOTO') docsStep = 5;
    if (profileType === 'GARANTIA') docsStep = 6;
    // LIMPA_NOME e INVESTIDOR pulam validação de documentos (não tem esse step)
    if (profileType !== 'LIMPA_NOME' && profileType !== 'INVESTIDOR' && currentStep === docsStep) {
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
      if (!formData.accountHolderCpf || formData.accountHolderCpf.replace(/\D/g, '').length !== 11) {
        addToast("Informe o CPF do titular da conta.", 'warning');
        return;
      }
    }

    // Avançar para próximo step - usando tamanho dinâmico
    const maxStep = steps.length;
    if (currentStep < maxStep) {
      setCurrentStep(c => c + 1);
      setTimeout(() => stepTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(c => c - 1);
      setTimeout(() => stepTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
    }
  };

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
        // Tratar data: URLs (base64 - imagens/selfie/assinatura/PDF)
        if (dataUrl.includes('application/pdf')) {
          extension = 'pdf';
        } else if (dataUrl.includes('image/png')) {
          extension = 'png';
        } else if (dataUrl.includes('image/jpeg') || dataUrl.includes('image/jpg')) {
          extension = 'jpg';
        } else {
          extension = 'jpg';
        }
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
        uploadedUrl = await apiService.uploadFile('documents', filePath, file);
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

      const success = await apiService.submitInvestorRequest({
        fullName: investorData.fullName,
        clientName: investorData.fullName,
        cpf: '', // Campo obrigatório no backend
        cpfCnpj: '', // Campo removido do formulário mas pode ser necessário no backend
        rgCnh: '', // Campo removido do formulário mas pode ser necessário no backend
        birthDate: investorData.birthDate,
        email: investorData.email,
        phone: investorData.phone,
        preferredContactTime: investorData.preferredContactTime,
        bankName: investorData.bankName,
        pixKey: investorData.pixKey,
        pixKeyType: investorData.pixKeyType,
        accountHolderName: investorData.accountHolderName,
        amount: investorData.investmentAmount, // Backend espera 'amount', não 'investmentAmount'
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
      console.error('Detalhes completos:', error?.response?.data || error?.message || error);
      setLoading(false);

      let errorMsg = 'Erro ao enviar. Tente novamente.';
      if (error?.response?.data?.error) {
        errorMsg = error.response.data.error;
      } else if (error?.response?.data?.message) {
        errorMsg = error.response.data.message;
      } else if (error?.message) {
        errorMsg = error.message;
      }

      addToast(`Erro: ${errorMsg}`, 'error');
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

      // Separar location para enviar como campos separados ao backend
      const { location, ...formDataWithoutLocation } = formData;

      // Atualizar dados com URLs do Storage
      const uploadedData = {
        ...formDataWithoutLocation,
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
        // Enviar localização como campos planos
        latitude: location?.latitude ?? null,
        longitude: location?.longitude ?? null,
        accuracy: location?.accuracy ?? null,
        locationCapturedAt: location ? new Date().toISOString() : null,
      };

      // Enviar múltiplos itens de garantia (GARANTIA profile) - fazer upload das fotos
      let uploadedCollateralItems = null;
      if (profileType === 'GARANTIA' && collateralItems.length > 0) {
        uploadedCollateralItems = await Promise.all(
          collateralItems.map(async (item) => {
            // Upload das fotos do item
            const photoUrls = item.photos.length > 0
              ? await uploadMultiple(item.photos, `collateral_${item.id}`)
              : [];
            // Upload da nota fiscal se existir
            const invoiceUrl = item.invoiceUrl
              ? await uploadToStorage(item.invoiceUrl, `invoice_${item.id}`)
              : null;
            return {
              ...item,
              photos: photoUrls,
              invoiceUrl,
            };
          })
        );
      }

      // Montar objeto de garantia para envio (CLT, MOTO, etc.)
      const uploadedGuarantee = needsGuarantee ? {
        type: guarantee.type,
        description: guarantee.description,
        condition: guarantee.condition,
        estimatedValue: guarantee.estimatedValue,
        photos: guaranteePhotos,
        video: guaranteeVideoUrl
      } : null;

      // Registrar evento de submissão (antifraude)
      const user = apiService.auth.getUser();
      const riskData = await antifraudService.logRiskEvent('form_submit', user?.id || undefined, {
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

      const success = await apiService.submitRequest({
        ...uploadedData,
        occupation: finalOccupation,
        profileType,
        // Para Moto, usar CNH como documento principal se disponível
        idCardFront: (profileType === 'MOTO' && cnhUrls.length > 0) ? cnhUrls : idCardFrontUrls,
        idCardBack: idCardBackUrls,
        proofAddress: proofAddressUrls,
        vehicleFront: vehicleFrontUrls,

        // Valores por tipo de serviço
        amount: profileType === 'LIMPA_NOME' ? 0 : profileType === 'MOTO' ? 21996 : getAmount(),
        installments: profileType === 'LIMPA_NOME' ? 0 : profileType === 'MOTO' ? 36 : settings.defaultInstallments,
        totalAmount: profileType === 'LIMPA_NOME' ? 0 : profileType === 'MOTO' ? 29396 : calculateTotal(),
        installmentValue: profileType === 'LIMPA_NOME' ? 0 : profileType === 'MOTO' ? 611 : calculateInstallment(),
        interestRate: profileType === 'LIMPA_NOME' ? 0 : profileType === 'MOTO' ? 0 : settings.interestRateMonthly,
        lateFeeDaily: settings.lateFeeDaily,
        lateFeeMonthly: settings.lateFeeMonthly,
        lateFeeFixed: settings.lateFeeFixed,
        hasGuarantee: needsGuarantee,
        guarantee: uploadedGuarantee,
        collateralItems: uploadedCollateralItems,
        // Cliente recorrente
        isReturningClient: isReturningClient === 'sim',
        returningClientNote: isReturningClient === 'sim' ? returningClientNote : '',
        // Código de indicação
        referralCode: formData.referredByCode || undefined,
        // Dados antifraude
        sessionId: antifraudService.getSessionId(),
        riskScore: riskData?.riskScore || 0,
        riskFactors: riskData?.riskFactors || [],
      });

      if (!success) {
        throw new Error('Falha ao submeter');
      }

      // Gerar PDF do contrato assinado (silencioso - não bloqueia fluxo)
      (async () => {
        try {
          const brandData = await apiService.getBrandSettings() as any;
          const pdfUrl = await contractPdfService.generateAndUploadContract(
            profileType,
            {
              name: formData.name,
              cpf: formData.cpf,
              phone: formData.phone,
              email: formData.email,
              amount: profileType === 'MOTO' ? 21996 : getAmount(),
              installments: profileType === 'MOTO' ? 36 : settings.defaultInstallments,
              installmentValue: profileType === 'MOTO' ? 611 : calculateInstallment(),
              interestRate: profileType === 'MOTO' ? 0 : settings.interestRateMonthly,
              totalAmount: profileType === 'MOTO' ? 29396 : calculateTotal(),
            },
            signatureUrl,
            brandData ? {
              companyName: brandData.companyName,
              cnpj: brandData.cnpj,
              logoUrl: brandData.logoUrl,
              address: brandData.address,
            } : undefined
          );

          // Buscar request mais recente do cliente para atualizar com o PDF URL
          const latestReq = await apiService.getClientLatestRequest();
          if (latestReq?.id && pdfUrl) {
            await apiService.updateContractPdfUrl(latestReq.id, pdfUrl);
            console.log('✅ Contrato PDF salvo com sucesso!');
          }
        } catch (pdfErr) {
          console.error('⚠️ Erro ao gerar PDF do contrato (não bloqueia):', pdfErr);
        }
      })();

      // Registrar assinatura (antifraude - silencioso)
      antifraudService.logRiskEvent('contract_signed', undefined, {
        signature: true,
        termsAccepted: true,
      }).catch(() => { });

      // Enviar emails de notificação
      // Envia para admin E para o cliente automaticamente
      emailService.notifyNewRequest({
        clientName: formData.name,
        clientEmail: formData.email,
        amount: profileType === 'LIMPA_NOME' ? 0
          : profileType === 'MOTO' ? 21996
            : profileType === 'INVESTIDOR' ? (investorData.customInvestmentAmount ? Number(investorData.customInvestmentAmount) : investorData.investmentAmount)
              : getAmount(),
        installments: profileType === 'LIMPA_NOME' ? 0
          : profileType === 'MOTO' ? 36
            : profileType === 'INVESTIDOR' ? 0
              : settings.defaultInstallments,
        profileType,
      }).catch((err) => { console.error('Erro ao enviar email de notificação:', err); });

      // 📱 Enviar WhatsApp e Notificação automática (silencioso)
      autoNotificationService.onLoanRequested(
        formData.email,
        profileType === 'MOTO' ? 21996 : getAmount(),
        formData.name,
        profileType
      ).catch(() => { });

      setLoading(false);
      addToast("Solicitação enviada!", 'success');
      navigate('/client/dashboard');
    } catch (error: any) {
      console.error('❌ Erro ao enviar solicitação:', error);
      console.error('❌ Detalhes completos:', error?.response?.data || error?.message || error);
      setLoading(false);

      // Mostrar erro real do servidor para debug
      let errorMsg = 'Erro ao enviar. Tente novamente.';

      if (error?.response?.data?.error) {
        errorMsg = error.response.data.error;
      } else if (error?.response?.data?.message) {
        errorMsg = error.response.data.message;
      } else if (error?.message) {
        errorMsg = error.message;
      }

      // Se for erro de tamanho de payload
      if (errorMsg.includes('payload') || errorMsg.includes('too large') || errorMsg.includes('413')) {
        errorMsg = 'Arquivo muito grande. Tente tirar fotos com menor resolução.';
      }

      addToast(`Erro: ${errorMsg}`, 'error');
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

  // Upload area que aceita APENAS PDF (para CTPS Digital)
  const renderPdfUploadArea = (name: string, label: string, files: string[], isGuarantee = false) => (
    <div className="space-y-3">
      <label className="text-sm text-zinc-400 font-medium block">{label}</label>
      <div className="grid grid-cols-3 gap-2">
        {files.map((file, idx) => (
          <div key={idx} className="relative aspect-square rounded-lg overflow-hidden border border-green-700 bg-black group">
            <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-900">
              <FileText size={32} className="text-red-500 mb-1" />
              <span className="text-xs text-zinc-400">PDF</span>
              <span className="text-[10px] text-green-500 mt-1">✓ Adicionado</span>
            </div>
            <button onClick={() => removeFile(name, idx, isGuarantee)} className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <X size={12} />
            </button>
          </div>
        ))}
        {files.length === 0 && (
          <div className="relative group col-span-3">
            <input
              type="file"
              id={`${isGuarantee ? 'g-' : ''}${name}`}
              accept="application/pdf"
              onChange={(e) => handleFileChange(e, name, isGuarantee)}
              className="hidden"
            />
            <label
              htmlFor={`${isGuarantee ? 'g-' : ''}${name}`}
              className="flex flex-col items-center justify-center w-full py-8 rounded-xl border-2 border-dashed border-[#D4AF37]/50 bg-zinc-900/50 hover:border-[#D4AF37] hover:bg-zinc-900 cursor-pointer transition-all"
            >
              <FileText size={36} className="text-red-500 mb-2" />
              <span className="text-sm font-bold text-white">Selecionar PDF</span>
              <span className="text-xs text-zinc-500 mt-1">Apenas arquivo .PDF (máx. 20MB)</span>
            </label>
          </div>
        )}
        {files.length > 0 && (
          <div className="relative group">
            <input
              type="file"
              id={`${isGuarantee ? 'g-' : ''}${name}-add`}
              accept="application/pdf"
              onChange={(e) => handleFileChange(e, name, isGuarantee)}
              className="hidden"
            />
            <label htmlFor={`${isGuarantee ? 'g-' : ''}${name}-add`} className="flex flex-col items-center justify-center w-full aspect-square rounded-lg border border-dashed border-zinc-700 bg-zinc-900/50 hover:border-[#D4AF37] cursor-pointer">
              <Plus size={24} className="text-zinc-500" />
              <span className="text-[10px] text-zinc-600 mt-1">+ PDF</span>
            </label>
          </div>
        )}
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
      <div
        className="sticky top-0 z-30 bg-black/80 backdrop-blur-md border-b border-zinc-900 px-4 pb-4 flex items-center justify-between"
        style={{ paddingTop: 'max(1rem, calc(env(safe-area-inset-top, 0px) + 0.5rem))' }}
      >
        <div className="flex items-center gap-2" onClick={() => navigate('/client/dashboard')}>
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
        <div ref={stepTopRef} className="mb-6">
          {/* Título do step atual */}
          <div className="text-center mb-4">
            <p className="text-xs text-zinc-500 uppercase tracking-widest mb-1">Etapa {currentStep} de {steps.length}</p>
            <h3 className="text-lg font-bold text-white">{steps[currentStep - 1]?.title}</h3>
          </div>

          {/* Barra de progresso preenchida */}
          <div className="w-full h-2 bg-zinc-800 rounded-full mb-4 overflow-hidden">
            <div
              className="h-2 bg-[#D4AF37] rounded-full transition-all duration-500"
              style={{ width: `${((currentStep - 1) / (steps.length - 1)) * 100}%` }}
            />
          </div>

          {/* Ícones dos steps */}
          <div className="flex justify-between relative">
            <div className="absolute top-1/2 left-0 w-full h-0.5 bg-zinc-800 -z-10 -translate-y-1/2"></div>
            {steps.map((step) => {
              const Icon = step.icon;
              const isActive = step.id === currentStep;
              const isCompleted = step.id < currentStep;
              return (
                <div key={step.id} className="bg-black px-1 z-10 flex flex-col items-center gap-1">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${isActive ? 'bg-[#D4AF37] text-black scale-110 shadow-lg shadow-[#D4AF37]/40' : isCompleted ? 'bg-zinc-800 text-[#D4AF37] border border-[#D4AF37]' : 'bg-zinc-900 text-zinc-600 border border-zinc-800'
                    }`}>
                    {isCompleted ? <Check size={16} /> : <Icon size={16} />}
                  </div>
                </div>
              );
            })}
          </div>
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
                      onClick={() => handleProfileSelect(option.id as ProfileType)}
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

              {/* Seta animada guiando o usuário para baixo após selecionar serviço */}
              {profileType && (
                <div className="flex justify-center animate-bounce mt-1 mb-0">
                  <ChevronDown size={28} className="text-[#D4AF37] opacity-70" />
                </div>
              )}

              {/* Campo de Código de Indicação */}
              {profileType && (
                <div ref={referralSectionRef} className="mt-6 p-5 bg-gradient-to-r from-emerald-900/30 to-zinc-900/50 rounded-2xl border border-emerald-700/50 animate-in fade-in slide-in-from-bottom-2">
                  <h3 className="font-bold text-emerald-400 mb-3 flex items-center gap-2">
                    <Gift size={18} />
                    Código de Indicação (Opcional)
                  </h3>
                  <p className="text-sm text-zinc-400 mb-3">
                    Se você foi indicado por alguém, digite o código para ganhar pontos e descontos!
                  </p>
                  <div className="relative">
                    <input
                      type="text"
                      value={formData.referredByCode}
                      onChange={(e) => setFormData({ ...formData, referredByCode: e.target.value.toUpperCase() })}
                      placeholder="Ex: IND-JOAO-1234"
                      className="w-full bg-black border border-emerald-700 rounded-xl px-4 py-3 text-white placeholder:text-zinc-600 focus:border-emerald-500 outline-none uppercase"
                    />
                  </div>
                </div>
              )}

              {/* Pergunta sobre cliente recorrente - apenas CLT, AUTONOMO e GARANTIA */}
              {profileType && profileType !== 'MOTO' && profileType !== 'LIMPA_NOME' && profileType !== 'INVESTIDOR' && (
                <div ref={returningClientSectionRef} className="mt-6 p-5 bg-zinc-800/50 rounded-2xl border border-zinc-700 animate-in fade-in slide-in-from-bottom-2">
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

              {/* Checkbox de aceite dos termos */}
              <label className="flex items-start gap-3 p-4 bg-zinc-900 border border-zinc-800 rounded-xl cursor-pointer hover:border-cyan-500 transition-all">
                <input type="checkbox" checked={termsAccepted} onChange={(e) => setTermsAccepted(e.target.checked)}
                  className="w-6 h-6 mt-0.5 accent-cyan-500 shrink-0" />
                <span className="text-xs text-zinc-300 leading-relaxed">
                  Li e aceito os termos e condições do programa de investimento Tubarão. Estou ciente das condições de remuneração, prazo de contrato e aviso prévio para resgate.
                </span>
              </label>
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

              <DateInput label="Data de Nascimento" name="investorBirthDate" value={investorData.birthDate}
                onChange={(e: any) => setInvestorData({ ...investorData, birthDate: e.target.value })} />

              <Input label="Telefone / WhatsApp" name="investorPhone" value={investorData.phone}
                onChange={(e: any) => {
                  let v = e.target.value.replace(/\D/g, '').slice(0, 11);
                  v = v.replace(/^(\d{2})(\d)/g, '($1) $2').replace(/(\d)(\d{4})$/, '$1-$2');
                  setInvestorData({ ...investorData, phone: v });
                }} placeholder="(11) 99999-9999" required />

              <Input label="Email" name="investorEmail" type="email" value={investorData.email}
                onChange={(e: any) => setInvestorData({ ...investorData, email: e.target.value })} placeholder="seu@email.com" required />

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">Melhor horário para contato</label>
                <select
                  value={investorData.preferredContactTime || ''}
                  onChange={(e: any) => setInvestorData({ ...investorData, preferredContactTime: e.target.value })}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 text-white focus:border-cyan-500 focus:outline-none"
                  required
                >
                  <option value="">Selecione o melhor horário</option>
                  <option value="manha">Manhã (08h - 12h)</option>
                  <option value="tarde">Tarde (12h - 18h)</option>
                  <option value="noite">Noite (18h - 22h)</option>
                  <option value="qualquer">Qualquer horário</option>
                </select>
              </div>
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

              {/* Slider de Valor do Investimento */}
              <div className="space-y-4">
                <div className="bg-gradient-to-br from-cyan-500/10 to-zinc-900 border border-cyan-600/30 rounded-2xl p-6">
                  <div className="text-center mb-6">
                    <p className="text-sm text-zinc-400 mb-2">Valor do investimento</p>
                    <p className="text-4xl font-bold text-cyan-400">
                      R$ {investorData.investmentAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <p className="text-xs text-zinc-500 mt-2">
                      Faixa: <span className={investorData.investmentTier === 'PREMIUM' ? 'text-[#D4AF37] font-bold' : 'text-cyan-400 font-bold'}>
                        {investorData.investmentTier === 'PREMIUM' ? 'Premium (≥ R$ 50.000)' : 'Standard (R$ 10.000 - R$ 49.999)'}
                      </span>
                    </p>
                  </div>

                  {/* Slider */}
                  <div className="space-y-3">
                    <input
                      type="range"
                      min={10000}
                      max={500000}
                      step={1000}
                      value={investorData.investmentAmount}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        const tier = val >= 50000 ? 'PREMIUM' : 'STANDARD';
                        const rate = tier === 'PREMIUM'
                          ? (investorData.payoutMode === 'MONTHLY' ? 5.0 : 6.0)
                          : (investorData.payoutMode === 'MONTHLY' ? 2.5 : 3.5);
                        setInvestorData({ ...investorData, investmentAmount: val, customInvestmentAmount: '', investmentTier: tier, monthlyRate: rate });
                      }}
                      className="w-full h-3 bg-zinc-800 rounded-lg appearance-none cursor-pointer slider-thumb"
                      style={{
                        background: `linear-gradient(to right, #06b6d4 0%, #06b6d4 ${(investorData.investmentAmount - 10000) / (500000 - 10000) * 100}%, #27272a ${(investorData.investmentAmount - 10000) / (500000 - 10000) * 100}%, #27272a 100%)`
                      }}
                    />
                    <div className="flex justify-between text-xs text-zinc-500">
                      <span>R$ 10.000</span>
                      <span>R$ 500.000</span>
                    </div>
                  </div>
                </div>

                {/* Valores Rápidos */}
                <div>
                  <p className="text-sm text-zinc-400 mb-3 text-center">Ou escolha um valor rápido:</p>
                  <div className="grid grid-cols-3 gap-2">
                    {[10000, 20000, 30000, 50000, 100000, 200000].map((val) => (
                      <button key={val} onClick={() => {
                        const tier = val >= 50000 ? 'PREMIUM' : 'STANDARD';
                        const rate = tier === 'PREMIUM'
                          ? (investorData.payoutMode === 'MONTHLY' ? 5.0 : 6.0)
                          : (investorData.payoutMode === 'MONTHLY' ? 2.5 : 3.5);
                        setInvestorData({ ...investorData, investmentAmount: val, customInvestmentAmount: '', investmentTier: tier, monthlyRate: rate });
                      }}
                        className={`p-3 rounded-xl border-2 transition-all ${investorData.investmentAmount === val && !investorData.customInvestmentAmount
                          ? 'border-cyan-500 bg-cyan-500/10 scale-105'
                          : 'border-zinc-800 bg-black hover:border-zinc-600'
                          }`}>
                        <span className="text-sm font-bold">R$ {val.toLocaleString('pt-BR')}</span>
                      </button>
                    ))}
                  </div>
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
                  <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
                    <h3 className="font-bold text-cyan-400 text-center mb-4">Simulação de Rendimento</h3>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-black/50 rounded-xl p-4 text-center">
                        <p className="text-xs text-zinc-400 mb-1">Rendimento Mensal</p>
                        <p className="text-2xl font-bold text-green-400">
                          R$ {monthlyReturn.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                        <p className="text-xs text-zinc-500 mt-1">{investorData.monthlyRate}% a.m.</p>
                      </div>

                      <div className="bg-black/50 rounded-xl p-4 text-center">
                        <p className="text-xs text-zinc-400 mb-1">Rendimento em 12 meses</p>
                        <p className="text-2xl font-bold text-[#D4AF37]">
                          R$ {annualReturn.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                        <p className="text-xs text-zinc-500 mt-1">Total de juros</p>
                      </div>
                    </div>

                    <div className="bg-gradient-to-r from-cyan-900/30 to-blue-900/30 border border-cyan-600/30 rounded-xl p-4 text-center">
                      <p className="text-xs text-zinc-400 mb-1">Valor Total ao Final</p>
                      <p className="text-3xl font-bold text-cyan-300">
                        R$ {(amount + annualReturn).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                      <p className="text-xs text-zinc-500 mt-1">Capital + Rendimentos</p>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* INVESTIDOR STEP 5: Segurança e Transparência */}
          {currentStep === 5 && profileType === 'INVESTIDOR' && (
            <div className="space-y-6 animate-in slide-in-from-right">
              <div className="text-center">
                <Shield size={48} className="mx-auto text-cyan-400 mb-3" />
                <h2 className="text-xl font-bold">🔒 Segurança e Transparência</h2>
              </div>

              <div className="bg-cyan-900/20 border border-cyan-600/30 rounded-xl p-6 space-y-4">
                <p className="text-zinc-300 leading-relaxed">
                  Para emissão do contrato oficial, nossos especialistas entram em contato via WhatsApp
                  para validar os dados e enviar o contrato digital com assinatura pelo GOV.BR.
                </p>
                <p className="text-zinc-300 leading-relaxed">
                  Seus dados são tratados conforme a LGPD e só são solicitados após confirmação do investimento.
                </p>
              </div>

              <div className="bg-gradient-to-r from-green-900/30 to-emerald-900/30 border border-green-600/30 rounded-xl p-4">
                <div className="flex items-center gap-3 mb-3">
                  <CheckCircle2 size={24} className="text-green-400 shrink-0" />
                  <h3 className="font-bold text-white">Processo Seguro</h3>
                </div>
                <ul className="space-y-2 text-sm text-zinc-300">
                  <li className="flex items-start gap-2">
                    <span className="text-green-400 mt-0.5">✓</span>
                    <span>Validação de dados via WhatsApp</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-400 mt-0.5">✓</span>
                    <span>Contrato digital com assinatura GOV.BR</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-400 mt-0.5">✓</span>
                    <span>Conformidade total com LGPD</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-400 mt-0.5">✓</span>
                    <span>Dados solicitados apenas após confirmação</span>
                  </li>
                </ul>
              </div>
            </div>
          )}


          {/* INVESTIDOR STEP 6: Confirmação Final */}
          {currentStep === 6 && profileType === 'INVESTIDOR' && (
            <div className="space-y-6 animate-in slide-in-from-right">
              <div className="text-center">
                <CheckCircle2 size={48} className="mx-auto text-green-500 mb-3" />
                <h2 className="text-xl font-bold">Confirme seu Investimento</h2>
              </div>

              <div className="bg-black border border-zinc-800 rounded-xl p-4 space-y-3 text-sm">
                <div className="flex justify-between"><span className="text-zinc-400">Serviço:</span><span className="font-bold text-cyan-400">Investidor Tubarão</span></div>
                <div className="flex justify-between"><span className="text-zinc-400">Nome:</span><span className="font-bold">{investorData.fullName}</span></div>
                <div className="flex justify-between"><span className="text-zinc-400">CPF/CNPJ:</span><span className="font-bold">{investorData.cpfCnpj}</span></div>
                <div className="flex justify-between"><span className="text-zinc-400">Email:</span><span className="font-bold">{investorData.email}</span></div>
                <div className="flex justify-between"><span className="text-zinc-400">Telefone:</span><span className="font-bold">{investorData.phone}</span></div>
                <div className="flex justify-between"><span className="text-zinc-400">Valor:</span><span className="font-bold text-[#D4AF37]">R$ {investorData.investmentAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></div>
                <div className="flex justify-between"><span className="text-zinc-400">Faixa:</span><span className="font-bold">{investorData.investmentTier === 'PREMIUM' ? 'Premium' : 'Standard'}</span></div>
                <div className="flex justify-between"><span className="text-zinc-400">Modalidade:</span><span className="font-bold">{investorData.payoutMode === 'MONTHLY' ? 'Mensal' : 'Anual Acumulado'}</span></div>
                <div className="flex justify-between"><span className="text-zinc-400">Taxa:</span><span className="font-bold text-cyan-400">{investorData.monthlyRate}% ao mês</span></div>
                <div className="flex justify-between"><span className="text-zinc-400">Prazo:</span><span className="font-bold">12 meses</span></div>
              </div>

              <div className="bg-cyan-900/20 border border-cyan-600/30 rounded-xl p-4">
                <p className="text-sm text-zinc-300 text-center">
                  Ao confirmar, sua solicitação será enviada para análise pela equipe Tubarão. Você receberá um retorno em até 48 horas.
                </p>
              </div>

              {/* Botão WhatsApp */}
              <a
                href={`https://wa.me/5511999999999?text=${encodeURIComponent(`Olá! Gostaria de falar sobre meu investimento de R$ ${investorData.investmentAmount.toLocaleString('pt-BR')}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-3 w-full bg-green-600 hover:bg-green-700 text-white font-bold py-4 rounded-xl transition-all"
              >
                <Phone size={20} />
                🟢 Falar no WhatsApp
              </a>
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

              {/* Slider de Valor — Simulador Interativo */}
              <div className="space-y-4">
                {(() => {
                  const amount = customAmount ? parseFloat(customAmount) : selectedAmount;
                  const validAmount = (!amount || isNaN(amount)) ? 0 : amount;
                  const monthlyRate = (Number(settings?.interestRateMonthly) || 0) / 100;
                  const annualRate = (Math.pow(1 + monthlyRate, 12) - 1) * 100;
                  // Lógica agiota: juros simples mensais sobre o principal
                  const jurosMensais = validAmount * monthlyRate;
                  const totalWithInterest = validAmount + jurosMensais;
                  const totalInterest = jurosMensais;
                  const progress = settings ? ((validAmount - settings.minLoanAmount) / (settings.maxLoanAmount - settings.minLoanAmount)) * 100 : 0;
                  const fmt = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                  // Encargos por atraso vindos do settings — forçar conversão para Number (banco retorna strings decimais)
                  const multaFixaPct = Number(settings?.lateFeeFixed ?? 0);      // % do valor
                  const jurosDiarioFixo = Number(settings?.lateFeeDaily ?? 0);   // R$ por dia
                  const multaReais = validAmount > 0 ? (multaFixaPct / 100) * validAmount : 0;
                  const custoPor7Dias = multaReais + (jurosDiarioFixo * 7);

                  return (
                    <div className={`rounded-3xl border-2 overflow-hidden transition-all duration-300 ${isDraggingSlider ? 'border-[#D4AF37] shadow-[0_0_30px_rgba(212,175,55,0.25)]' : 'border-[#D4AF37]/30'}`} style={{ background: 'linear-gradient(160deg, #0f0f0f 0%, #1a1800 100%)' }}>

                      {/* Cabeçalho — Valor escolhido */}
                      <div className="px-6 pt-6 pb-4 text-center relative">
                        <p className="text-xs uppercase tracking-widest text-zinc-500 mb-1">Você quer solicitar</p>
                        <p className={`font-black text-[#D4AF37] transition-all duration-150 leading-none ${isDraggingSlider ? 'text-6xl' : 'text-5xl'}`}>
                          R$ {fmt(validAmount)}
                        </p>
                        {isDraggingSlider && (
                          <span className="inline-block mt-2 text-[11px] text-[#D4AF37]/60 animate-pulse">← deslize para ajustar →</span>
                        )}
                      </div>

                      {/* Slider */}
                      <div className="px-6 pb-3">
                        <input
                          type="range"
                          min={settings?.minLoanAmount ?? 500}
                          max={settings?.maxLoanAmount ?? 10000}
                          step={100}
                          value={validAmount || (settings?.minLoanAmount ?? 500)}
                          onMouseDown={() => setIsDraggingSlider(true)}
                          onMouseUp={() => setIsDraggingSlider(false)}
                          onTouchStart={() => setIsDraggingSlider(true)}
                          onTouchEnd={() => setIsDraggingSlider(false)}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            setCustomAmount(val.toString());
                            setSelectedAmount(val);
                          }}
                          className="w-full h-4 rounded-full appearance-none cursor-pointer slider-thumb"
                          style={{
                            background: `linear-gradient(to right, #D4AF37 0%, #f0d060 ${progress}%, #2a2a2a ${progress}%, #1a1a1a 100%)`,
                            boxShadow: isDraggingSlider ? '0 0 12px rgba(212,175,55,0.5)' : 'none'
                          }}
                        />
                        <div className="flex justify-between text-xs text-zinc-600 mt-1.5 px-0.5">
                          <span>R$ {(settings?.minLoanAmount ?? 500).toLocaleString('pt-BR')}</span>
                          <span>R$ {(settings?.maxLoanAmount ?? 10000).toLocaleString('pt-BR')}</span>
                        </div>
                      </div>

                      {/* Linha divisória */}
                      <div className="mx-6 border-t border-zinc-800/80 mb-4" />

                      {/* Grid de dados financeiros — atualizam em tempo real */}
                      <div className="px-4 pb-4 grid grid-cols-2 gap-3">

                        {/* Taxa mensal */}
                        <div className={`rounded-2xl p-4 flex flex-col gap-1 transition-all duration-200 ${isDraggingSlider ? 'bg-yellow-500/10 border border-yellow-500/40' : 'bg-zinc-900/80 border border-zinc-800'}`}>
                          <span className="text-[10px] uppercase tracking-wider text-zinc-500">Taxa mensal</span>
                          <span className={`text-xl font-black transition-colors ${isDraggingSlider ? 'text-yellow-400' : 'text-yellow-300'}`}>
                            {(Number(settings?.interestRateMonthly) ?? 0).toFixed(1)}%
                          </span>
                          <span className="text-[10px] text-zinc-600">ao mês</span>
                        </div>

                        {/* Juros do Mês — valor em R$ */}
                        <div className={`rounded-2xl p-4 flex flex-col gap-1 transition-all duration-200 ${isDraggingSlider ? 'bg-green-500/15 border border-green-500/50' : 'bg-zinc-900/80 border border-zinc-800'}`}>
                          <span className="text-[10px] uppercase tracking-wider text-zinc-500">Juros mensais</span>
                          <span className={`text-xl font-black transition-colors ${isDraggingSlider ? 'text-green-300' : 'text-green-400'}`}>
                            R$ {fmt(jurosMensais)}
                          </span>
                          <span className="text-[10px] text-zinc-600">por mês</span>
                        </div>

                        {/* Custo em 3 meses */}
                        <div className={`rounded-2xl p-4 flex flex-col gap-1 transition-all duration-200 ${isDraggingSlider ? 'bg-orange-500/15 border border-orange-500/50' : 'bg-zinc-900/80 border border-zinc-800'}`}>
                          <span className="text-[10px] uppercase tracking-wider text-zinc-500">Juros em 3 meses</span>
                          <span className={`text-xl font-black transition-colors ${isDraggingSlider ? 'text-orange-300' : 'text-orange-400'}`}>
                            R$ {fmt(jurosMensais * 3)}
                          </span>
                          <span className="text-[10px] text-zinc-600">se renovar 3x</span>
                        </div>

                        {/* Custo diário equivalente */}
                        <div className={`rounded-2xl p-4 flex flex-col gap-1 transition-all duration-200 ${isDraggingSlider ? 'bg-purple-500/15 border border-purple-500/50' : 'bg-zinc-900/80 border border-zinc-800'}`}>
                          <span className="text-[10px] uppercase tracking-wider text-zinc-500">Custo por dia</span>
                          <span className={`text-xl font-black transition-colors ${isDraggingSlider ? 'text-purple-300' : 'text-purple-400'}`}>
                            R$ {fmt(jurosMensais / 30)}
                          </span>
                          <span className="text-[10px] text-zinc-600">equivalente diário</span>
                        </div>

                      </div>

                      {/* Destaque — 1º Vencimento */}
                      <div className={`mx-4 mb-4 rounded-2xl p-4 text-center transition-all duration-200 ${isDraggingSlider ? 'bg-cyan-500/20 border-2 border-cyan-400/60 shadow-[0_0_20px_rgba(6,182,212,0.2)]' : 'bg-cyan-900/20 border border-cyan-800/40'}`}>
                        <p className="text-[10px] uppercase tracking-widest text-zinc-500 mb-1">1º Vencimento</p>
                        <p className={`font-black leading-none transition-all duration-150 ${isDraggingSlider ? 'text-4xl text-cyan-300' : 'text-3xl text-cyan-400'}`}>
                          R$ {fmt(totalWithInterest)}
                        </p>
                        <p className="text-xs text-zinc-500 mt-1.5">
                          Capital de <span className="text-white font-semibold">R$ {fmt(validAmount)}</span> + juros de <span className="text-orange-400 font-semibold">R$ {fmt(totalInterest)}</span>
                        </p>
                      </div>

                      {/* Barra de progresso de juros */}
                      <div className="px-4 pb-5">
                        <div className="flex justify-between text-[10px] text-zinc-500 mb-1.5">
                          <span>Capital: {validAmount > 0 ? ((validAmount / totalWithInterest) * 100).toFixed(0) : 0}%</span>
                          <span>Juros: {validAmount > 0 ? ((totalInterest / totalWithInterest) * 100).toFixed(0) : 0}%</span>
                        </div>
                        <div className="h-2 rounded-full overflow-hidden bg-zinc-800 flex">
                          <div
                            className="h-full bg-[#D4AF37] transition-all duration-300"
                            style={{ width: validAmount > 0 ? `${(validAmount / totalWithInterest) * 100}%` : '0%' }}
                          />
                          <div
                            className="h-full bg-orange-500 transition-all duration-300"
                            style={{ width: validAmount > 0 ? `${(totalInterest / totalWithInterest) * 100}%` : '0%' }}
                          />
                        </div>
                        <div className="flex gap-4 mt-1.5 text-[10px]">
                          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#D4AF37] inline-block" /> Capital</span>
                          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-500 inline-block" /> Juros</span>
                        </div>
                      </div>

                      {/* Encargos por Atraso */}
                      {validAmount > 0 && (
                        <div className="mx-4 mb-5 rounded-2xl border border-red-800/40 bg-red-950/20 p-4">
                          <p className="text-[10px] uppercase tracking-widest text-red-400/80 mb-3 font-bold flex items-center gap-1.5">
                            <span>⚠️</span> Encargos por Atraso
                          </p>
                          <div className="grid grid-cols-3 gap-3">

                            {/* Multa fixa */}
                            <div className="flex flex-col gap-0.5">
                              <span className="text-[9px] text-zinc-500 uppercase tracking-wider">Multa</span>
                              <span className="text-base font-black text-red-400">
                                {multaFixaPct.toFixed(0)}%
                              </span>
                              <span className="text-[9px] text-zinc-600">= R$ {fmt(multaReais)}</span>
                            </div>

                            {/* Juros por dia */}
                            <div className="flex flex-col gap-0.5">
                              <span className="text-[9px] text-zinc-500 uppercase tracking-wider">Por dia</span>
                              <span className="text-base font-black text-red-400">
                                R$ {fmt(jurosDiarioFixo)}
                              </span>
                              <span className="text-[9px] text-zinc-600">a cada dia</span>
                            </div>

                            {/* Estimativa 7 dias */}
                            <div className="flex flex-col gap-0.5">
                              <span className="text-[9px] text-zinc-500 uppercase tracking-wider">7 dias</span>
                              <span className="text-base font-black text-red-300">
                                R$ {fmt(custoPor7Dias)}
                              </span>
                              <span className="text-[9px] text-zinc-600">estimado</span>
                            </div>

                          </div>
                          <p className="text-[9px] text-zinc-600 mt-2.5 leading-relaxed">
                            Juros mensais: {Number(settings?.interestRateMonthly ?? 0).toFixed(0)}% · Multa: {multaFixaPct.toFixed(0)}% · Diário: R$ {fmt(jurosDiarioFixo)}
                          </p>
                        </div>
                      )}

                    </div>
                  );
                })()}

                {/* Pacotes Rápidos */}
                {profileType !== 'GARANTIA_VEICULO' && (
                  <div>
                    <p className="text-sm text-zinc-400 mb-3 text-center">Ou escolha um valor rápido:</p>
                    <div className="grid grid-cols-3 gap-3">
                      {settings.loanPackages.map((pkg, idx) => (
                        <button
                          key={idx}
                          onClick={() => { setSelectedAmount(pkg); setCustomAmount(''); }}
                          className={`p-3 rounded-xl border-2 transition-all ${selectedAmount === pkg && !customAmount ? 'border-[#D4AF37] bg-[#D4AF37]/10 scale-105' : 'border-zinc-800 bg-zinc-900 hover:border-zinc-600'
                            }`}
                        >
                          <span className="text-sm font-bold">R$ {pkg.toLocaleString('pt-BR')}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
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
                      <li>• <strong>Financiamento:</strong> 36 prestações mensais de R$ 611,00</li>
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
                      <li>• A moto só será transferida para o nome do cliente <strong className="text-blue-400">após a quitação da 36ª prestação</strong></li>
                      <li>• Até lá, a moto permanece registrada em nome da empresa</li>
                    </ul>
                  </div>

                  <label className="flex items-start gap-4 p-4 bg-red-900/30 border-2 border-red-500 rounded-xl cursor-pointer">
                    <input type="checkbox" checked={termsAccepted} onChange={(e) => setTermsAccepted(e.target.checked)} className="mt-1 accent-red-500 w-6 h-6" />
                    <div>
                      <span className="text-white font-bold">☑️ Declaro que li e compreendi</span>
                      <p className="text-xs text-zinc-400 mt-1">
                        Todas as condições do financiamento próprio de motocicleta, incluindo a entrada obrigatória de <strong>R$ 2.000,00</strong>, o financiamento em <strong>36x de R$ 611,00</strong> + seguro de <strong>R$ 150,00</strong> (total mensal: <strong>R$ 761,00</strong>), a cláusula de <strong className="text-red-400">busca e apreensão imediata</strong> em caso de atraso superior ao contrato com <strong className="text-red-400">perda total dos valores pagos</strong>, e que a transferência do veículo somente ocorrerá após a quitação da 36ª prestação.
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
                    <DateInput label="Data de Nascimento" name="birthDate" value={formData.birthDate} onChange={handleChange} />
                    <Input label="Email" type="email" name="email" value={formData.email} onChange={handleChange} placeholder="seu@email.com" />
                    <Input label="Cupom de Indicação (Opcional)" name="referralCode" value={formData.referralCode} onChange={handleChange} placeholder="Código ou CPF de quem indicou" />
                  </div>
                ) : (
                  <>
                    <div className="space-y-4">
                      <Input label="Nome Completo" name="name" value={formData.name} onChange={handleChange} placeholder="Como no documento" />
                      <Input label="CPF" name="cpf" value={formData.cpf} onChange={handleChange} placeholder="000.000.000-00" error={errors.cpf} />
                      <DateInput label="Data de Nascimento" name="birthDate" value={formData.birthDate} onChange={handleChange} />
                      <Input label="WhatsApp Principal" name="phone" value={formData.phone} onChange={handleChange} placeholder="(00) 00000-0000" />
                      <Input label="Email" type="email" name="email" value={formData.email} onChange={handleChange} />
                      <Input label="Cupom de Indicação (Opcional)" name="referralCode" value={formData.referralCode} onChange={handleChange} placeholder="Insira seu cupom aqui" />
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

                    {(profileType === 'MOTO' || profileType === 'GARANTIA' || profileType === 'CLT') && (
                      <div className="pt-4 border-t border-zinc-800 space-y-4">
                        <h3 className="text-sm font-bold text-[#D4AF37]">Dados Profissionais</h3>
                        <Input label="Profissão" name="occupation" value={formData.occupation} onChange={handleChange} />
                        {(profileType === 'CLT' || profileType === 'MOTO') && (
                          <Input label="Nome da Empresa" name="companyName" value={formData.companyName} onChange={handleChange} placeholder="Empresa onde trabalha" />
                        )}
                        <div className="grid grid-cols-2 gap-4">
                          <Input label="Renda Mensal" name="income" value={formData.income} onChange={handleChange} />
                          <Input label="Dia Pagamento" name="workTime" value={formData.workTime} onChange={handleChange} placeholder="Dia 05" />
                        </div>

                        {/* Endereço da Empresa */}
                        {(profileType === 'CLT' || profileType === 'MOTO') && (
                          <div className="pt-3 space-y-3">
                            <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wide">Endereço da Empresa</h4>
                            <div className="grid grid-cols-2 gap-3">
                              <Input label="CEP da Empresa" name="companyCep" value={formData.companyCep} onChange={handleChange} placeholder="00000-000" />
                              <Input label="Número" name="companyNumber" value={formData.companyNumber} onChange={handleChange} placeholder="123" />
                            </div>
                            <Input label="Logradouro" name="companyStreet" value={formData.companyStreet} onChange={handleChange} placeholder="Rua, Av, etc." />
                            <div className="grid grid-cols-3 gap-3">
                              <Input label="Bairro" name="companyNeighborhood" value={formData.companyNeighborhood} onChange={handleChange} placeholder="Bairro" />
                              <Input label="Cidade" name="companyCity" value={formData.companyCity} onChange={handleChange} placeholder="Cidade" />
                              <div>
                                <label className="text-sm text-zinc-400 font-medium block mb-1">UF</label>
                                <select name="companyState" value={formData.companyState} onChange={handleChange as any}
                                  className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2.5 text-white text-sm focus:border-[#D4AF37] outline-none">
                                  <option value="">UF</option>
                                  {['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'].map(uf => (
                                    <option key={uf} value={uf}>{uf}</option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          </div>
                        )}
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
                        <h3 className="text-sm font-bold text-[#D4AF37]">👥 Referências (2 pessoas próximas)</h3>
                        <p className="text-xs text-zinc-500">Informe 2 pessoas que te conhecem bem e que podemos contatar.</p>

                        {/* Referência 1 */}
                        <div className="bg-zinc-900/60 border border-zinc-700 rounded-2xl p-4 space-y-3">
                          <p className="text-xs font-bold text-[#D4AF37] uppercase tracking-wide">Referência 1</p>
                          <Input label="Nome completo" name="contactTrust1Name" value={formData.contactTrust1Name} onChange={handleChange} placeholder="Ex: Maria da Silva" />
                          <Input label="WhatsApp (com DDD)" name="contactTrust1" value={formData.contactTrust1} onChange={handleChange} placeholder="(99) 99999-9999" />
                          <div>
                            <label className="text-xs text-zinc-400 font-medium block mb-1.5 ml-1">Grau de parentesco</label>
                            <select name="contactTrust1Relationship" value={formData.contactTrust1Relationship} onChange={handleChange as any}
                              className="w-full bg-black border border-zinc-700 rounded-lg px-3 py-3 text-white text-sm focus:border-[#D4AF37] outline-none">
                              <option value="">Selecione o grau de parentesco</option>
                              <option value="pai">Pai</option>
                              <option value="mae">Mãe</option>
                              <option value="irmao">Irmão(ã)</option>
                              <option value="conjuge">Cônjuge / Companheiro(a)</option>
                              <option value="filho">Filho(a)</option>
                              <option value="tio">Tio(a)</option>
                              <option value="primo">Primo(a)</option>
                              <option value="amigo">Amigo(a)</option>
                              <option value="colega">Colega de trabalho</option>
                              <option value="vizinho">Vizinho(a)</option>
                              <option value="outro">Outro</option>
                            </select>
                          </div>
                        </div>

                        {/* Referência 2 */}
                        <div className="bg-zinc-900/60 border border-zinc-700 rounded-2xl p-4 space-y-3">
                          <p className="text-xs font-bold text-[#D4AF37] uppercase tracking-wide">Referência 2</p>
                          <Input label="Nome completo" name="contactTrust2Name" value={formData.contactTrust2Name} onChange={handleChange} placeholder="Ex: João Carlos" />
                          <Input label="WhatsApp (com DDD)" name="contactTrust2" value={formData.contactTrust2} onChange={handleChange} placeholder="(99) 99999-9999" />
                          <div>
                            <label className="text-xs text-zinc-400 font-medium block mb-1.5 ml-1">Grau de parentesco</label>
                            <select name="contactTrust2Relationship" value={formData.contactTrust2Relationship} onChange={handleChange as any}
                              className="w-full bg-black border border-zinc-700 rounded-lg px-3 py-3 text-white text-sm focus:border-[#D4AF37] outline-none">
                              <option value="">Selecione o grau de parentesco</option>
                              <option value="pai">Pai</option>
                              <option value="mae">Mãe</option>
                              <option value="irmao">Irmão(ã)</option>
                              <option value="conjuge">Cônjuge / Companheiro(a)</option>
                              <option value="filho">Filho(a)</option>
                              <option value="tio">Tio(a)</option>
                              <option value="primo">Primo(a)</option>
                              <option value="amigo">Amigo(a)</option>
                              <option value="colega">Colega de trabalho</option>
                              <option value="vizinho">Vizinho(a)</option>
                              <option value="outro">Outro</option>
                            </select>
                          </div>
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
                  <li>• Transferência somente após quitação da 36ª prestação</li>
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
                <p className="text-zinc-400 text-sm mt-2">Cadastre todos os bens que ficam em garantia</p>
              </div>

              {/* Lembrete importante */}
              <div className="bg-red-900/30 border border-red-500 rounded-xl p-4">
                <p className="text-red-400 text-sm font-bold text-center">
                  ⚠️ LEMBRETE: Os bens serão ENTREGUES FISICAMENTE e ficarão em posse da empresa até quitação total
                </p>
              </div>

              {/* Contador de Valor Total */}
              <div className="bg-gradient-to-r from-[#D4AF37]/20 to-orange-500/20 border-2 border-[#D4AF37] rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-zinc-400">Valor Total em Garantia</p>
                    <p className="text-2xl font-bold text-[#D4AF37]">
                      R$ {getTotalCollateralValue().toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-zinc-400">Mínimo Necessário</p>
                    <p className="text-lg font-bold text-white">
                      R$ {(getAmount() * 2).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
                {getTotalCollateralValue() < (getAmount() * 2) && (
                  <p className="text-xs text-red-400 mt-2 text-center">
                    ⚠️ Valor insuficiente. Adicione mais itens ou aumente os valores.
                  </p>
                )}
              </div>

              {/* Lista de Itens */}
              {collateralItems.map((item, index) => (
                <div key={item.id} className="border-2 border-zinc-800 rounded-xl p-5 space-y-4 relative">
                  {/* Header do Item */}
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-[#D4AF37] flex items-center gap-2">
                      <Package size={20} />
                      Item {index + 1}
                    </h3>
                    {collateralItems.length > 1 && (
                      <button
                        onClick={() => removeCollateralItem(item.id)}
                        className="text-red-400 hover:text-red-300 transition-colors"
                      >
                        <Trash2 size={20} />
                      </button>
                    )}
                  </div>

                  {/* Tipo de Garantia */}
                  <div className="space-y-3">
                    <label className="block text-sm font-bold text-white">Tipo do Bem:</label>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { id: 'carro', label: 'Carro', icon: Car, color: 'text-yellow-400' },
                        { id: 'moto', label: 'Moto', icon: Car, color: 'text-blue-400' },
                        { id: 'celular', label: 'Celular', icon: Smartphone, color: 'text-green-400' },
                        { id: 'notebook', label: 'Notebook/Tablet', icon: Tv, color: 'text-purple-400' },
                        { id: 'tv', label: 'TV', icon: Tv, color: 'text-pink-400' },
                        { id: 'eletrodomestico', label: 'Eletrodoméstico', icon: Package, color: 'text-orange-400' },
                      ].map((tipo) => (
                        <button
                          key={tipo.id}
                          onClick={() => updateCollateralItem(item.id, 'type', tipo.id)}
                          className={`p-3 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${
                            item.type === tipo.id
                              ? 'border-[#D4AF37] bg-[#D4AF37]/10 ring-2 ring-[#D4AF37]'
                              : 'border-zinc-700 hover:border-zinc-500'
                          }`}
                        >
                          <tipo.icon size={24} className={tipo.color} />
                          <span className="text-xs font-bold">{tipo.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {item.type && (
                    <>
                      {/* Descrição */}
                      <div className="space-y-2">
                        <label className="block text-sm font-bold text-white">
                          Descreva o bem (marca, modelo, ano):
                        </label>
                        <textarea
                          value={item.description}
                          onChange={(e) => updateCollateralItem(item.id, 'description', e.target.value)}
                          placeholder="Ex: iPhone 14 Pro 256GB Preto"
                          className="w-full bg-black border border-zinc-700 rounded-xl p-3 text-white focus:border-[#D4AF37] outline-none min-h-[60px]"
                        />
                      </div>

                      {/* Valor Estimado */}
                      <div className="space-y-2">
                        <label className="block text-sm font-bold text-white">
                          Valor Estimado (R$):
                        </label>
                        <input
                          type="text"
                          value={item.estimatedValue}
                          onChange={(e) => updateCollateralItem(item.id, 'estimatedValue', e.target.value)}
                          placeholder="Ex: 3.500,00"
                          className="w-full bg-black border border-zinc-700 rounded-xl p-3 text-white focus:border-[#D4AF37] outline-none"
                        />
                      </div>

                      {/* Condição */}
                      <div className="space-y-2">
                        <label className="block text-sm font-bold text-white">Condição:</label>
                        <div className="grid grid-cols-3 gap-2">
                          {['Ótimo', 'Bom', 'Regular'].map((cond) => (
                            <button
                              key={cond}
                              onClick={() => updateCollateralItem(item.id, 'condition', cond)}
                              className={`p-3 rounded-lg border text-sm font-bold transition-all ${
                                item.condition === cond
                                  ? 'border-[#D4AF37] bg-[#D4AF37]/10 text-[#D4AF37]'
                                  : 'border-zinc-700 text-zinc-400 hover:border-zinc-500'
                              }`}
                            >
                              {cond}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Checkbox Nota Fiscal */}
                      <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-4 space-y-3">
                        <label className="flex items-center gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={item.hasInvoice}
                            onChange={(e) => {
                              updateCollateralItem(item.id, 'hasInvoice', e.target.checked);
                              if (!e.target.checked) {
                                updateCollateralItem(item.id, 'invoiceUrl', null);
                              }
                            }}
                            className="w-5 h-5 rounded border-zinc-600 text-[#D4AF37] focus:ring-[#D4AF37]"
                          />
                          <span className="font-bold text-white">Possuo a Nota Fiscal deste item</span>
                        </label>

                        {item.hasInvoice ? (
                          <div className="space-y-2 border-t border-zinc-800 pt-3">
                            <p className="text-xs text-green-400">
                              ✅ Ótimo! Envie a nota fiscal ou comprovante de compra.
                            </p>
                            {renderUploadArea(`invoice_${item.id}`, 'Nota Fiscal', item.invoiceUrl ? [item.invoiceUrl] : [], true)}
                          </div>
                        ) : (
                          <div className="bg-yellow-900/20 border border-yellow-600/40 rounded-lg p-3">
                            <p className="text-xs text-yellow-400">
                              ⚠️ Bens sem nota fiscal passarão por uma avaliação de valor mais rigorosa.
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Fotos (múltiplas) */}
                      <div className="space-y-2">
                        <h3 className="font-bold text-[#D4AF37]">📷 Fotos do Bem</h3>
                        <p className="text-xs text-zinc-500">
                          Envie várias fotos de diferentes ângulos (frente, verso, laterais, detalhes)
                        </p>
                        {renderUploadArea(`photos_${item.id}`, 'Fotos do Item', item.photos, true)}
                      </div>
                    </>
                  )}
                </div>
              ))}

              {/* Botão Adicionar Item */}
              <button
                onClick={addCollateralItem}
                className="w-full p-4 rounded-xl border-2 border-dashed border-[#D4AF37] bg-[#D4AF37]/5 hover:bg-[#D4AF37]/10 transition-all flex items-center justify-center gap-2 text-[#D4AF37] font-bold"
              >
                <Plus size={24} />
                Adicionar outro bem
              </button>
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
                      {!formData.videoHouse && (
                        <p className="text-red-500 text-xs mt-2">⚠️ O envio do vídeo do estabelecimento é obrigatório para prosseguir.</p>
                      )}
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
                    {renderPdfUploadArea('workCard', 'Carteira de Trabalho - PDF (OBRIGATÓRIO)', formData.workCard)}
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
                  {profileType !== 'MOTO' && profileType !== 'AUTONOMO' && (
                    <div className="bg-black p-4 rounded-xl border border-zinc-800">
                      <VideoUpload
                        label="🎥 Vídeo da sua Residência (OBRIGATÓRIO)"
                        subtitle="Mostre a fachada e entre na casa rapidamente"
                        videoUrl={formData.videoHouse}
                        onUpload={(url) => setFormData({ ...formData, videoHouse: url })}
                        onRemove={() => setFormData({ ...formData, videoHouse: '' })}
                      />
                      {!formData.videoHouse && (
                        <p className="text-red-500 text-xs mt-2">⚠️ O envio do vídeo da residência é obrigatório para prosseguir.</p>
                      )}
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
                      {!guarantee.video && (
                        <p className="text-red-500 text-xs mt-2">⚠️ O envio do vídeo do bem em garantia é obrigatório para prosseguir.</p>
                      )}
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
                      {!formData.videoSelfie && (
                        <p className="text-red-500 text-xs mt-2">⚠️ O envio do vídeo de aceite é obrigatório para prosseguir.</p>
                      )}
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
                {!formData.signature && (
                  <p className="text-red-500 text-xs mt-1">⚠️ A assinatura é obrigatória para prosseguir.</p>
                )}
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
                <Input label="Chave PIX (OBRIGATÓRIO)" name="pixKey" value={formData.pixKey} onChange={handleChange}
                  placeholder={formData.pixKeyType === 'cpf' ? '000.000.000-00' : formData.pixKeyType === 'phone' ? '(00) 00000-0000' : formData.pixKeyType === 'email' ? 'seu@email.com' : 'Chave aleatória'} />
                <Input label="Nome do Titular da Conta (OBRIGATÓRIO)" name="accountHolderName" value={formData.accountHolderName} onChange={handleChange} placeholder="Seu nome completo" />
                <Input label="CPF do Titular da Conta (OBRIGATÓRIO)" name="accountHolderCpf" value={formData.accountHolderCpf} onChange={handleChange} placeholder="000.000.000-00" />
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
                      <div className="flex justify-between"><span className="text-zinc-400">Prestações:</span><span className="font-bold">36x R$ 611,00</span></div>
                      <div className="flex justify-between"><span className="text-zinc-400">Seguro:</span><span className="font-bold">R$ 150,00/mês</span></div>
                      <div className="flex justify-between"><span className="text-zinc-400">Mensal Total:</span><span className="font-bold text-[#D4AF37]">R$ 761,00</span></div>
                      <div className="flex justify-between"><span className="text-zinc-400">Nome:</span><span className="font-bold">{formData.name}</span></div>
                    </div>

                    <div className="bg-red-900/20 border border-red-600/30 rounded-xl p-4 space-y-2">
                      <h3 className="font-bold text-red-400 text-xs uppercase">TERMO DE FINANCIAMENTO (OBRIGATÓRIO)</h3>
                      <p className="text-xs text-zinc-400">Ao assinar, declaro que li e concordo com todas as condições do financiamento próprio, incluindo busca e apreensão em caso de inadimplência e transferência somente após a 36ª prestação.</p>
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

                    {/* DECLARAÇÃO DE VERACIDADE - OBRIGATÓRIA */}
                    <label className="flex items-start gap-3 p-4 bg-yellow-900/20 border-2 border-yellow-600/50 rounded-xl cursor-pointer hover:border-[#D4AF37] transition-all">
                      <input type="checkbox" checked={formData.declarationAccepted} onChange={(e) => setFormData({ ...formData, declarationAccepted: e.target.checked })}
                        className="w-6 h-6 mt-0.5 accent-yellow-500 shrink-0" />
                      <div>
                        <span className="text-white font-bold text-sm">📜 DECLARAÇÃO DE VERACIDADE</span>
                        <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                          Declaro que <strong className="text-white">TODAS</strong> as informações fornecidas neste formulário são <strong className="text-white">verdadeiras e corretas</strong>, incluindo dados pessoais, profissionais, referências e documentos. Estou ciente de que a <strong className="text-red-400">falsidade ideológica</strong> configura crime previsto no Art. 299 do Código Penal, sujeito a pena de reclusão de 1 a 5 anos, e que informações falsas resultarão no <strong className="text-red-400">cancelamento imediato</strong> da solicitação e possíveis medidas judiciais.
                        </p>
                      </div>
                    </label>

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
        <div className="fixed bottom-0 left-0 w-full z-40 bg-black/95 backdrop-blur-md border-t border-zinc-800">
          {/* Mini barra de progresso no topo dos botões */}
          <div className="w-full h-1 bg-zinc-800">
            <div
              className="h-1 bg-[#D4AF37] transition-all duration-500"
              style={{ width: `${((currentStep - 1) / Math.max(steps.length - 1, 1)) * 100}%` }}
            />
          </div>
          <div className="p-4 flex gap-3">
            {currentStep > 1 && (
              <Button onClick={handleBack} variant="secondary" className="w-24 shrink-0 font-bold">
                ← Voltar
              </Button>
            )}
            {currentStep < steps.length ? (
              <Button
                onClick={handleNext}
                disabled={!canProceedOnCurrentStep}
                className="flex-1 font-bold text-base py-4 rounded-2xl"
              >
                {currentStep === 1 ? '🚀 Começar' : 'Continuar →'}
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                className="flex-1 bg-green-600 hover:bg-green-700 font-bold text-base py-4 rounded-2xl shadow-lg shadow-green-900/30"
                isLoading={loading}
                disabled={
                  profileType === 'INVESTIDOR' ? false :
                  profileType === 'LIMPA_NOME' ? !formData.signature :
                  (!formData.signature || !formData.declarationAccepted)
                }
              >
                {loading ? 'Enviando...' :
                  profileType === 'INVESTIDOR' ? '✅ QUERO SER INVESTIDOR' :
                  profileType === 'LIMPA_NOME' ? '✅ SOLICITAR SERVIÇO' :
                  profileType === 'MOTO' ? '✅ SOLICITAR FINANCIAMENTO' : '✅ SOLICITAR MEU EMPRÉSTIMO'}
              </Button>
            )}
          </div>
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

const DateInput = ({ label, error, className = "", required, value, onChange, name }: any) => {
  const toDisplay = (v: string) => {
    if (!v) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
      const [y, m, d] = v.split('-');
      return `${d}/${m}/${y}`;
    }
    return v;
  };

  const [display, setDisplay] = React.useState(() => toDisplay(value));

  React.useEffect(() => {
    setDisplay(toDisplay(value || ''));
  }, [value]);

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 8);
    let masked = raw;
    if (raw.length > 4) masked = raw.replace(/^(\d{2})(\d{2})(\d{1,4})/, '$1/$2/$3');
    else if (raw.length > 2) masked = raw.replace(/^(\d{2})(\d{1,2})/, '$1/$2');
    setDisplay(masked);
    let isoValue = raw;
    if (raw.length === 8) {
      isoValue = `${raw.slice(4, 8)}-${raw.slice(2, 4)}-${raw.slice(0, 2)}`;
    }
    if (onChange) onChange({ target: { name, value: isoValue } });
  };

  return (
    <div>
      <label className="block text-xs text-zinc-400 mb-1.5 ml-1">
        {label}{required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <input
        type="text"
        inputMode="numeric"
        placeholder="DD/MM/AAAA"
        value={display}
        onChange={handleInput}
        name={name}
        className={`w-full bg-black border rounded-lg p-3 text-white text-sm focus:border-[#D4AF37] outline-none ${error ? 'border-red-900' : 'border-zinc-700'} ${className}`}
      />
      {error && <p className="text-xs text-red-500 mt-1 ml-1">{error}</p>}
    </div>
  );
};

// CSS para o slider customizado
const sliderStyles = `
  input[type="range"].slider-thumb::-webkit-slider-thumb {
    appearance: none;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: #D4AF37;
    cursor: pointer;
    box-shadow: 0 0 10px rgba(212, 175, 55, 0.5);
    transition: all 0.2s ease;
  }

  input[type="range"].slider-thumb::-webkit-slider-thumb:hover {
    transform: scale(1.2);
    box-shadow: 0 0 15px rgba(212, 175, 55, 0.8);
  }

  input[type="range"].slider-thumb::-moz-range-thumb {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: #D4AF37;
    cursor: pointer;
    border: none;
    box-shadow: 0 0 10px rgba(212, 175, 55, 0.5);
    transition: all 0.2s ease;
  }

  input[type="range"].slider-thumb::-moz-range-thumb:hover {
    transform: scale(1.2);
    box-shadow: 0 0 15px rgba(212, 175, 55, 0.8);
  }
`;

// Injetar estilos
if (typeof document !== 'undefined') {
  const styleElement = document.getElementById('slider-styles');
  if (!styleElement) {
    const style = document.createElement('style');
    style.id = 'slider-styles';
    style.textContent = sliderStyles;
    document.head.appendChild(style);
  }
}