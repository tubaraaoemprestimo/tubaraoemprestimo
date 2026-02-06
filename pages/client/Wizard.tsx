import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Check, ChevronLeft, User, MapPin,
  AlertCircle, FileText, ScanFace, X, Plus, Loader2,
  Phone, Users, Video, DollarSign, Shield, Clock, Landmark, CheckCircle2, FileCheck, Percent,
  Car, Smartphone, Tv, Home, Package, Camera as CameraIcon,
  Briefcase, Store, Bike, Banknote, Rocket
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

// Tipos de garantia
const guaranteeTypes = [
  { id: 'celular', label: 'Celular', icon: Smartphone },
  { id: 'tv', label: 'TV', icon: Tv },
  { id: 'carro', label: 'Carro', icon: Car },
  { id: 'casa', label: 'Casa/Imóvel', icon: Home },
  { id: 'eletrodomestico', label: 'Eletrodoméstico', icon: Package },
  { id: 'outro', label: 'Outro', icon: Package },
];

// Tipos de Perfil
type ProfileType = 'CLT' | 'AUTONOMO' | 'MOTO' | 'GARANTIA_VEICULO' | '';

// Steps
const steps = [
  { id: 1, title: 'Perfil', icon: Users },
  { id: 2, title: 'Valores', icon: DollarSign },
  { id: 3, title: 'Termos', icon: Shield },
  { id: 4, title: 'Dados', icon: User },
  { id: 5, title: 'Documentos', icon: FileText },
  { id: 6, title: 'Banco', icon: Landmark },
  { id: 7, title: 'Confirmar', icon: CheckCircle2 },
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

  // Perfil e Condicionais
  const [profileType, setProfileType] = useState<ProfileType>('');
  const [hasEntryValue, setHasEntryValue] = useState(false); // Para Moto

  // Cliente recorrente (já fez empréstimo antes do sistema)
  const [isReturningClient, setIsReturningClient] = useState<'sim' | 'nao' | ''>('');
  const [returningClientNote, setReturningClientNote] = useState('');

  // Aceites
  const [termsAccepted, setTermsAccepted] = useState(false);

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

    // STEP 1: Perfil
    if (currentStep === 1) {
      if (!profileType) {
        addToast("Qual é o seu perfil?", 'warning');
        return;
      }
      if (!isReturningClient) {
        addToast("Por favor, informe se já é nosso cliente.", 'warning');
        return;
      }
    }

    // STEP 2: Valores
    if (currentStep === 2) {
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

      // Validação Moto
      if (profileType === 'MOTO' && !hasEntryValue) {
        addToast("Para financiamento de moto, é necessário ter R$ 2.000,00 de entrada.", 'warning');
        return;
      }

      // Validação Garantia Veículo
      if (profileType === 'GARANTIA_VEICULO') {
        if (!guarantee.description.trim()) {
          addToast("Descreva o veículo (modelo, ano, cor).", 'warning');
          return;
        }
        if (guarantee.photos.length === 0) {
          addToast("Envie fotos do veículo.", 'warning');
          return;
        }
      }
    }

    // STEP 3: Termos
    if (currentStep === 3 && !termsAccepted) {
      addToast("Aceite os termos para continuar.", 'warning');
      return;
    }

    // STEP 4: Dados - TODOS OBRIGATÓRIOS
    if (currentStep === 4) {
      // Dados pessoais básicos
      if (!formData.name.trim()) {
        addToast("Informe seu nome completo.", 'warning');
        return;
      }
      if (!formData.cpf || formData.cpf.replace(/\D/g, '').length !== 11) {
        addToast("Informe um CPF válido.", 'warning');
        return;
      }
      if (!formData.phone || formData.phone.replace(/\D/g, '').length < 10) {
        addToast("Informe seu WhatsApp.", 'warning');
        return;
      }
      if (!formData.email.trim() || !formData.email.includes('@')) {
        addToast("Informe um email válido.", 'warning');
        return;
      }
      if (!formData.instagram.trim()) {
        addToast("Informe seu Instagram.", 'warning');
        return;
      }

      // Endereço
      if (!formData.cep || formData.cep.replace(/\D/g, '').length !== 8) {
        addToast("Informe seu CEP.", 'warning');
        return;
      }
      if (!formData.address.trim()) {
        addToast("Informe seu endereço.", 'warning');
        return;
      }
      if (!formData.number.trim()) {
        addToast("Informe o número da residência.", 'warning');
        return;
      }

      // Dados profissionais
      if (!formData.income.trim()) {
        addToast("Informe sua renda mensal.", 'warning');
        return;
      }

      // Específico por perfil
      if (profileType === 'AUTONOMO' && !formData.cnpj) {
        addToast("Informe seu CNPJ.", 'warning');
        return;
      }
    }

    // STEP 5: Documentos - TODOS OBRIGATÓRIOS SEM EXCEÇÃO
    if (currentStep === 5) {
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

      // Boleto em nome do cliente obrigatório
      if (formData.billInName.length === 0) {
        addToast("Envie um boleto em seu nome para confirmar endereço.", 'warning');
        return;
      }

      // CNH para todos que não são CLT puro
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

      // Fotos da casa obrigatórias para TODOS
      if (formData.housePhotos.length === 0) {
        addToast("Envie fotos da fachada da sua casa.", 'warning');
        return;
      }

      // Vídeo da casa obrigatório para TODOS
      if (!formData.videoHouse) {
        addToast("Grave o vídeo mostrando sua residência.", 'warning');
        return;
      }

      // Vídeo de aceite obrigatório para TODOS
      if (!formData.videoSelfie) {
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

    // STEP 6: Banco - TODOS OBRIGATÓRIOS
    if (currentStep === 6) {
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

    if (currentStep < 7) setCurrentStep(c => c + 1);
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

  // Função para upload de arquivo para Supabase Storage
  const uploadToStorage = async (dataUrl: string, folder: string, index: number = 0): Promise<string> => {
    // Se já for uma URL do Supabase, retornar diretamente
    if (dataUrl.startsWith('http')) {
      return dataUrl;
    }

    try {
      const timestamp = Date.now();
      const extension = dataUrl.includes('image/png') ? 'png' : dataUrl.includes('image/jpeg') ? 'jpg' : 'jpg';
      const fileName = `${folder}_${timestamp}_${index}.${extension}`;
      const filePath = `loan_documents/${formData.cpf.replace(/\D/g, '')}/${fileName}`;

      const file = dataURLtoFile(dataUrl, fileName);
      if (!file) {
        console.error('Falha ao converter dataURL para file');
        return dataUrl; // Fallback para URL original
      }

      const uploadedUrl = await supabaseService.uploadFile('documents', filePath, file);
      return uploadedUrl || dataUrl;
    } catch (error) {
      console.error('Erro no upload:', error);
      return dataUrl; // Fallback para URL original
    }
  };

  // Função para upload de array de arquivos
  const uploadMultiple = async (dataUrls: string[], folder: string): Promise<string[]> => {
    if (!dataUrls || dataUrls.length === 0) return [];
    const results = await Promise.all(dataUrls.map((url, index) => uploadToStorage(url, folder, index)));
    return results;
  };

  const handleSubmit = async () => {
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
      // Submeter o pedido
      // Concatenar Perfil e CNPJ na profissão para visualização no admin
      const finalOccupation = `[${profileType}] ${uploadedData.occupation || ''} ${uploadedData.cnpj ? '- CNPJ: ' + uploadedData.cnpj : ''}`;

      const success = await supabaseService.submitRequest({
        ...uploadedData,
        occupation: finalOccupation,
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
      }).catch(() => { });

      // 📱 Enviar WhatsApp e Notificação automática (silencioso)
      autoNotificationService.onLoanRequested(
        formData.email,
        getAmount(),
        formData.name
      ).catch(() => { });

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

          {/* STEP 1: Perfil (NOVO) */}
          {currentStep === 1 && (
            <div className="space-y-6 animate-in slide-in-from-right">
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold">Qual o seu perfil?</h2>
                <p className="text-zinc-400 text-sm mt-2">Selecione a opção que melhor se encaixa.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  onClick={() => setProfileType('CLT')}
                  className={`p-6 rounded-2xl border-2 flex flex-col items-center gap-4 transition-all ${profileType === 'CLT' ? 'border-[#D4AF37] bg-[#D4AF37]/10' : 'border-zinc-800 bg-black hover:border-zinc-600'}`}
                >
                  <Briefcase size={32} className={profileType === 'CLT' ? 'text-[#D4AF37]' : 'text-zinc-500'} />
                  <span className="font-bold">CLT / Assalariado</span>
                </button>

                <button
                  onClick={() => setProfileType('AUTONOMO')}
                  className={`p-6 rounded-2xl border-2 flex flex-col items-center gap-4 transition-all ${profileType === 'AUTONOMO' ? 'border-[#D4AF37] bg-[#D4AF37]/10' : 'border-zinc-800 bg-black hover:border-zinc-600'}`}
                >
                  <Store size={32} className={profileType === 'AUTONOMO' ? 'text-[#D4AF37]' : 'text-zinc-500'} />
                  <span className="font-bold">Autônomo / Comércio</span>
                </button>

                <button
                  onClick={() => setProfileType('MOTO')}
                  className={`p-6 rounded-2xl border-2 flex flex-col items-center gap-4 transition-all ${profileType === 'MOTO' ? 'border-[#D4AF37] bg-[#D4AF37]/10' : 'border-zinc-800 bg-black hover:border-zinc-600'}`}
                >
                  <Bike size={32} className={profileType === 'MOTO' ? 'text-[#D4AF37]' : 'text-zinc-500'} />
                  <span className="font-bold">Financiamento Moto</span>
                </button>

                <button
                  onClick={() => setProfileType('GARANTIA_VEICULO')}
                  className={`p-6 rounded-2xl border-2 flex flex-col items-center gap-4 transition-all ${profileType === 'GARANTIA_VEICULO' ? 'border-[#D4AF37] bg-[#D4AF37]/10' : 'border-zinc-800 bg-black hover:border-zinc-600'}`}
                >
                  <Car size={32} className={profileType === 'GARANTIA_VEICULO' ? 'text-[#D4AF37]' : 'text-zinc-500'} />
                  <span className="font-bold">Empréstimo c/ Veículo</span>
                </button>
              </div>

              {/* Pergunta sobre cliente recorrente - aparece após selecionar perfil */}
              {profileType && (
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

          {/* STEP 2: Valores */}
          {currentStep === 2 && (
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

          {/* STEP 3: Termos */}
          {currentStep === 3 && (
            <div className="space-y-6 animate-in slide-in-from-right">
              <div className="text-center mb-4">
                <Shield size={48} className="mx-auto text-[#D4AF37] mb-3" />
                <h2 className="text-xl font-bold">Termos e Condições</h2>
              </div>

              {/* Taxas REAIS do banco */}
              <div className="bg-red-900/20 border border-red-600/30 rounded-xl p-4 space-y-3">
                <h3 className="font-bold text-red-400 text-sm uppercase flex items-center gap-2">
                  <AlertCircle size={16} /> Transparência Total
                </h3>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="bg-black/30 p-3 rounded-lg">
                    <p className="text-zinc-500 text-xs">Juros ao Mês</p>
                    <p className="text-white font-bold text-lg">{settings.interestRateMonthly}%</p>
                  </div>
                  <div className="bg-black/30 p-3 rounded-lg">
                    <p className="text-zinc-500 text-xs">Aprovação</p>
                    <p className="text-white font-bold text-lg">Em até 72h</p>
                  </div>
                </div>
              </div>

              <div className="bg-black border border-zinc-800 rounded-xl p-4 space-y-3">
                <h3 className="font-bold text-[#D4AF37] text-sm uppercase flex items-center gap-2">
                  <FileCheck size={16} /> O que vamos precisar:
                </h3>
                {/* Lista dinâmica baseada no Perfil */}
                {(profileType === 'CLT' ? ['RG ou CNH', 'Comprovante Residência', 'Holerite/Extrato'] :
                  profileType === 'AUTONOMO' ? ['CNPJ e RG/CNH', 'Comp. Endereço (Res+Com)', 'Vídeo do Local'] :
                    profileType === 'MOTO' ? ['CNH A', 'Comprovante Residência', 'Entrada de R$ 2.000'] :
                      ['Dados do Veículo', 'Fotos e Vídeos', 'CNH', 'Documentão em dia']
                ).map((doc, idx) => (
                  <div key={idx} className="flex items-start gap-3 py-2 border-b border-zinc-900 last:border-0">
                    <CheckCircle2 size={16} className="text-green-500 mt-0.5 shrink-0" />
                    <span className="text-sm text-zinc-300">{doc}</span>
                  </div>
                ))}
              </div>

              <label className="flex items-start gap-4 p-4 bg-zinc-900 border border-zinc-800 rounded-xl cursor-pointer hover:border-[#D4AF37]">
                <input type="checkbox" checked={termsAccepted} onChange={(e) => setTermsAccepted(e.target.checked)} className="mt-1 accent-[#D4AF37] w-6 h-6" />
                <div>
                  <span className="text-white font-bold">Estou ciente e de acordo</span>
                  <p className="text-xs text-zinc-400 mt-1">
                    Declaro que estou ciente que o empréstimo possui <strong className="text-red-400">juros de {settings.interestRateMonthly || 30}% ao mês</strong> e aceito as taxas e condições informadas.
                  </p>
                </div>
              </label>
            </div>
          )}

          {/* STEP 4: Dados */}
          {currentStep === 4 && (
            <div className="space-y-5 animate-in slide-in-from-right">
              <h2 className="text-xl font-bold">Seus Dados Pessoais</h2>

              <div className="space-y-4">
                <Input label="Nome Completo" name="name" value={formData.name} onChange={handleChange} placeholder="Como no documento" />
                <Input label="CPF" name="cpf" value={formData.cpf} onChange={handleChange} placeholder="000.000.000-00" error={errors.cpf} />
                <Input label="WhatsApp Principal" name="phone" value={formData.phone} onChange={handleChange} placeholder="(00) 00000-0000" />
                <Input label="Email" type="email" name="email" value={formData.email} onChange={handleChange} />
                <Input label="Instagram" name="instagram" value={formData.instagram} onChange={handleChange} placeholder="@seu_usuario" />
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
            </div>
          )}

          {/* STEP 5: Documentos */}
          {currentStep === 5 && (
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
                <div className="bg-red-900/20 border border-red-600/30 rounded-lg p-3">
                  <p className="text-xs text-red-400">
                    <strong>⚠️ OBRIGATÓRIO:</strong> Envie também um boleto (banco, cartão, etc.) <strong>em seu nome</strong> para confirmar o endereço.
                  </p>
                </div>
                {renderUploadArea('billInName', 'Boleto em Seu Nome (OBRIGATÓRIO)', formData.billInName)}
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

              {/* VÍDEO E FOTOS DA RESIDÊNCIA - OBRIGATÓRIO PARA TODOS */}
              <div className="space-y-4 border-t border-zinc-800 pt-6">
                <h3 className="font-bold text-[#D4AF37] flex items-center gap-2">
                  <Home size={18} /> 🏠 Comprovação de Residência (OBRIGATÓRIO)
                </h3>
                <div className="bg-red-900/20 border border-red-600/30 rounded-lg p-3">
                  <p className="text-xs text-red-400">
                    <strong>⚠️ OBRIGATÓRIO:</strong> Envie fotos da fachada da sua casa e grave um vídeo mostrando a residência (de fora e de dentro).
                  </p>
                </div>

                {renderUploadArea('housePhotos', 'Fotos da Fachada/Frente da Casa (OBRIGATÓRIO)', formData.housePhotos)}

                <div className="bg-black p-4 rounded-xl border border-zinc-800">
                  <VideoUpload
                    label="🎥 Vídeo da sua Residência (OBRIGATÓRIO)"
                    subtitle="Mostre a fachada e entre na casa rapidamente"
                    videoUrl={formData.videoHouse}
                    onUpload={(url) => setFormData({ ...formData, videoHouse: url })}
                    onRemove={() => setFormData({ ...formData, videoHouse: '' })}
                  />
                </div>
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

              {/* Vídeo de confirmação com declaração de juros - OBRIGATÓRIO */}
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
            </div>
          )}

          {/* STEP 6: Banco */}
          {currentStep === 6 && (
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

          {/* STEP 7: Confirmar */}
          {currentStep === 7 && (
            <div className="space-y-6 animate-in slide-in-from-right">
              <div className="text-center">
                <CheckCircle2 size={48} className="mx-auto text-green-500 mb-3" />
                <h2 className="text-xl font-bold">Confirme sua Solicitação</h2>
              </div>

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
                <h3 className="font-bold text-[#D4AF37]">✍️ Sua Assinatura (OBRIGATÓRIO)</h3>
                <div className="bg-red-900/20 border border-red-600/30 rounded-lg p-3">
                  <p className="text-xs text-red-400">
                    <strong>⚠️ OBRIGATÓRIO:</strong> Assine no campo abaixo para confirmar sua solicitação. Sem assinatura, não será possível enviar.
                  </p>
                </div>
                <SignaturePad onSign={(sig) => setFormData({ ...formData, signature: sig })} />
              </div>
            </div>
          )}
        </div>

        {/* Buttons */}
        <div className="fixed bottom-0 left-0 w-full p-4 bg-black/90 border-t border-zinc-900 flex gap-4 z-40 backdrop-blur-md">
          {currentStep > 1 && <Button onClick={handleBack} variant="secondary" className="flex-1">Voltar</Button>}
          {currentStep < 7 ? (
            <Button onClick={handleNext} className="flex-1 font-bold text-lg">
              {currentStep === 1 ? 'Começar Simulação' : 'Continuar'}
            </Button>
          ) : (
            <Button onClick={handleSubmit} className="flex-1 bg-green-600 hover:bg-green-700 font-bold text-lg shadow-lg shadow-green-900/20" isLoading={loading} disabled={!formData.signature}>
              SOLICITAR MEU EMPRÉSTIMO
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