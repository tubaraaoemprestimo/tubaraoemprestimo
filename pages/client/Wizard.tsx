import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Check, ChevronRight, ChevronLeft, Upload, User, MapPin, Camera as CameraIcon, PenTool,
  AlertCircle, FileText, Image as ImageIcon, Car, ScanFace, X, Plus, Loader2, Sparkles, Scan,
  Phone, Users, Video, DollarSign, Shield, Clock, Landmark, CreditCard, CheckCircle2, FileCheck
} from 'lucide-react';
import { Button } from '../../components/Button';
import { Camera } from '../../components/Camera';
import { SignaturePad } from '../../components/SignaturePad';
import { VideoUpload } from '../../components/VideoUpload';
import { supabaseService } from '../../services/supabaseService';
import { aiService } from '../../services/aiService';
import { ocrService } from '../../services/ocrService';
import { useToast } from '../../components/Toast';
import { InstallPwaButton } from '../../components/InstallPwaButton';

// Novo fluxo de steps
const steps = [
  { id: 1, title: 'Valores', icon: DollarSign },
  { id: 2, title: 'Termos', icon: Shield },
  { id: 3, title: 'Dados', icon: User },
  { id: 4, title: 'Documentos', icon: FileText },
  { id: 5, title: 'Banco', icon: Landmark },
  { id: 6, title: 'Confirmar', icon: CheckCircle2 },
];

// Pacotes de empréstimo (configuráveis pelo admin)
const loanPackages = [
  { id: 1, amount: 500, label: 'R$ 500', popular: false },
  { id: 2, amount: 1000, label: 'R$ 1.000', popular: true },
  { id: 3, amount: 2000, label: 'R$ 2.000', popular: false },
  { id: 4, amount: 3000, label: 'R$ 3.000', popular: false },
  { id: 5, amount: 5000, label: 'R$ 5.000', popular: false },
];

const installmentOptions = [2, 3, 4, 5, 6, 8, 10, 12];

export const Wizard: React.FC = () => {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [verifyingBiometrics, setVerifyingBiometrics] = useState(false);
  const [analyzingDocs, setAnalyzingDocs] = useState(false);
  const [scanningOCR, setScanningOCR] = useState(false);
  const [scannedImage, setScannedImage] = useState<string | null>(null);
  const [errors, setErrors] = useState<{ cpf?: string; cep?: string; biometrics?: string; doc?: string }>({});

  // Termos aceitos
  const [termsAccepted, setTermsAccepted] = useState(false);

  // Valores do empréstimo
  const [selectedAmount, setSelectedAmount] = useState<number>(1000);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [selectedInstallments, setSelectedInstallments] = useState<number>(4);

  const [formData, setFormData] = useState({
    // Dados Pessoais
    name: '', cpf: '', email: '', phone: '', birthDate: '',

    // Contatos
    whatsappPersonal: '',
    contactTrust1: '', contactTrust1Name: '',
    contactTrust2: '', contactTrust2Name: '',
    instagram: '',

    // Trabalho
    occupation: '', companyName: '', companyAddress: '', workTime: '',

    // Endereço
    cep: '', address: '', number: '', income: '',

    // Documentos
    selfie: '',
    idCardFront: [] as string[],
    idCardBack: [] as string[],
    proofAddress: [] as string[],
    proofIncome: [] as string[],
    workCard: [] as string[],
    billInName: [] as string[],
    bankStatement: [] as string[],

    // Veículo
    hasVehicle: false,
    vehicleCRLV: [] as string[],
    vehicleFront: [] as string[],
    vehicleBack: [] as string[],
    vehicleSide: [] as string[],

    // Vídeos
    videoSelfie: '',
    videoHouse: '',
    videoVehicle: '',

    // Dados Bancários (NOVO)
    bankName: '',
    pixKey: '',
    pixKeyType: 'cpf', // cpf, phone, email, random
    accountHolderName: '',
    accountHolderCpf: '',

    // Finalização
    signature: '',
  });

  // Calcular parcela com juros de 30%
  const calculateInstallment = () => {
    const amount = customAmount ? parseFloat(customAmount) : selectedAmount;
    const totalWithInterest = amount * 1.30; // 30% de juros
    return totalWithInterest / selectedInstallments;
  };

  const getTotalAmount = () => {
    const amount = customAmount ? parseFloat(customAmount) : selectedAmount;
    return amount * 1.30;
  };

  // CPF Validation
  const validateCPF = (cpf: string) => {
    const cleanCPF = cpf.replace(/\D/g, '');
    if (cleanCPF.length === 0) return undefined;
    if (cleanCPF.length < 11) return "CPF incompleto";
    if (/^(\d)\1+$/.test(cleanCPF)) return "CPF inválido";
    return undefined;
  };

  const fetchAddress = async (cleanCep: string) => {
    setErrors(prev => ({ ...prev, cep: undefined }));
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      const data = await res.json();
      if (data.erro) {
        setErrors(prev => ({ ...prev, cep: "CEP não encontrado." }));
        setFormData(prev => ({ ...prev, address: '' }));
      } else {
        setFormData(prev => ({
          ...prev,
          address: `${data.logradouro}, ${data.bairro}, ${data.localidade} - ${data.uf}`
        }));
      }
    } catch (e) {
      setErrors(prev => ({ ...prev, cep: "Erro ao buscar CEP." }));
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    let newValue = value;

    if (name === 'cpf' || name === 'accountHolderCpf') {
      const nums = value.replace(/\D/g, '').slice(0, 11);
      newValue = nums.replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
      if (name === 'cpf') {
        const error = validateCPF(newValue);
        setErrors(prev => ({ ...prev, cpf: error }));
      }
    }

    if (name === 'cep') {
      let v = value.replace(/\D/g, '').slice(0, 8);
      if (v.length > 5) v = v.replace(/^(\d{5})(\d)/, '$1-$2');
      newValue = v;
      const cleanCep = v.replace(/\D/g, '');
      if (cleanCep.length === 8) fetchAddress(cleanCep);
    }

    if (['phone', 'whatsappPersonal', 'contactTrust1', 'contactTrust2'].includes(name)) {
      let v = value.replace(/\D/g, '').slice(0, 11);
      v = v.replace(/^(\d{2})(\d)/g, '($1) $2');
      v = v.replace(/(\d)(\d{4})$/, '$1-$2');
      newValue = v;
    }

    setFormData({ ...formData, [name]: newValue });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, fieldName: string) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const newFiles: string[] = [];
      const promises = Array.from(files).map((file: File) => {
        return new Promise<void>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            newFiles.push(reader.result as string);
            resolve();
          };
          reader.readAsDataURL(file);
        });
      });

      Promise.all(promises).then(() => {
        setFormData(prev => ({
          ...prev,
          [fieldName]: [...(prev[fieldName as keyof typeof prev] as string[]), ...newFiles]
        }));
      });
    }
  };

  const removeFile = (fieldName: string, index: number) => {
    setFormData(prev => {
      const currentFiles = prev[fieldName as keyof typeof prev] as string[];
      const newFiles = currentFiles.filter((_, i) => i !== index);
      return { ...prev, [fieldName]: newFiles };
    });
  };

  const handleNext = async () => {
    // Validações por step
    if (currentStep === 1) {
      const amount = customAmount ? parseFloat(customAmount) : selectedAmount;
      if (!amount || amount < 300) {
        addToast("Selecione um valor mínimo de R$ 300", 'warning');
        return;
      }
    }

    if (currentStep === 2) {
      if (!termsAccepted) {
        addToast("Você precisa aceitar os termos para continuar.", 'warning');
        return;
      }
    }

    if (currentStep === 3) {
      if (!formData.name || !formData.cpf || !formData.email || !formData.phone) {
        addToast("Preencha todos os dados pessoais.", 'warning');
        return;
      }
      if (!formData.whatsappPersonal || !formData.contactTrust1 || !formData.contactTrust2) {
        addToast("Preencha os contatos de confiança.", 'warning');
        return;
      }
      if (!formData.occupation || !formData.companyName) {
        addToast("Informe seus dados profissionais.", 'warning');
        return;
      }
    }

    if (currentStep === 4) {
      if (!formData.selfie || formData.idCardFront.length === 0) {
        addToast("Envie a selfie e documento de identificação.", 'warning');
        return;
      }
      if (!formData.videoSelfie) {
        addToast("Grave o vídeo de confirmação.", 'warning');
        return;
      }
    }

    if (currentStep === 5) {
      if (!formData.bankName || !formData.pixKey || !formData.accountHolderName) {
        addToast("Preencha os dados bancários para depósito.", 'warning');
        return;
      }
    }

    if (currentStep < 6) setCurrentStep(c => c + 1);
  };

  const handleBack = () => {
    if (currentStep > 1) setCurrentStep(c => c - 1);
  };

  const handleSubmit = async () => {
    if (!formData.signature) {
      addToast("Assine para confirmar a solicitação.", 'warning');
      return;
    }

    setLoading(true);

    const requestData = {
      ...formData,
      amount: customAmount ? parseFloat(customAmount) : selectedAmount,
      installments: selectedInstallments,
      totalAmount: getTotalAmount(),
      installmentValue: calculateInstallment(),
    };

    await supabaseService.submitRequest(requestData);
    setLoading(false);
    addToast("Solicitação enviada com sucesso!", 'success');
    navigate('/client/dashboard');
  };

  const renderUploadArea = (name: string, label: string, files: string[]) => (
    <div className="space-y-3">
      <label className="text-sm text-zinc-400 font-medium block">{label}</label>
      <div className="grid grid-cols-3 gap-2">
        {files.map((file, idx) => (
          <div key={idx} className="relative aspect-square rounded-lg overflow-hidden border border-zinc-700 bg-black group">
            <img src={file} alt="Preview" className="w-full h-full object-cover" />
            <button
              onClick={() => removeFile(name, idx)}
              className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X size={12} />
            </button>
          </div>
        ))}
        <div className="relative group">
          <input
            type="file"
            id={name}
            multiple
            accept="image/*,application/pdf"
            onChange={(e) => handleFileChange(e, name)}
            className="hidden"
          />
          <label
            htmlFor={name}
            className="flex flex-col items-center justify-center w-full aspect-square rounded-lg border border-dashed border-zinc-700 bg-zinc-900/50 hover:bg-zinc-800 hover:border-[#D4AF37] cursor-pointer transition-all"
          >
            <Plus size={24} className="text-zinc-500 group-hover:text-[#D4AF37]" />
            <span className="text-[10px] text-zinc-500 mt-1">Adicionar</span>
          </label>
        </div>
      </div>
    </div>
  );

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
          <div className="text-sm font-medium text-[#D4AF37]">Passo {currentStep}/6</div>
        </div>
      </div>

      <div className="max-w-xl mx-auto px-4 pt-6">
        {/* Progress Steps */}
        <div className="flex justify-between mb-8 px-2 relative">
          <div className="absolute top-1/2 left-0 w-full h-0.5 bg-zinc-800 -z-10 -translate-y-1/2"></div>
          {steps.map((step) => {
            const Icon = step.icon;
            const isActive = step.id === currentStep;
            const isCompleted = step.id < currentStep;
            return (
              <div key={step.id} className="flex flex-col items-center gap-2 bg-black px-1 z-10">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${isActive ? 'bg-[#D4AF37] text-black shadow-[0_0_15px_rgba(212,175,55,0.4)]' :
                    isCompleted ? 'bg-zinc-800 text-[#D4AF37] border border-[#D4AF37]' :
                      'bg-zinc-900 text-zinc-600 border border-zinc-800'
                  }`}>
                  {isCompleted ? <Check size={16} /> : <Icon size={16} />}
                </div>
              </div>
            );
          })}
        </div>

        {/* Content Area */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-6 shadow-2xl">

          {/* STEP 1: Valores */}
          {currentStep === 1 && (
            <div className="space-y-6 animate-in slide-in-from-right">
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-white">Quanto você precisa?</h2>
                <p className="text-zinc-400 text-sm mt-2">Escolha o valor do seu empréstimo</p>
              </div>

              {/* Pacotes */}
              <div className="grid grid-cols-3 gap-3">
                {loanPackages.map(pkg => (
                  <button
                    key={pkg.id}
                    onClick={() => { setSelectedAmount(pkg.amount); setCustomAmount(''); }}
                    className={`relative p-4 rounded-xl border-2 transition-all ${selectedAmount === pkg.amount && !customAmount
                        ? 'border-[#D4AF37] bg-[#D4AF37]/10'
                        : 'border-zinc-800 bg-zinc-900 hover:border-zinc-600'
                      }`}
                  >
                    {pkg.popular && (
                      <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-[#D4AF37] text-black text-[10px] px-2 py-0.5 rounded-full font-bold">
                        POPULAR
                      </span>
                    )}
                    <span className="text-lg font-bold text-white">{pkg.label}</span>
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

              {/* Parcelas */}
              <div className="space-y-3">
                <label className="text-sm text-zinc-400">Em quantas vezes?</label>
                <div className="grid grid-cols-4 gap-2">
                  {installmentOptions.map(opt => (
                    <button
                      key={opt}
                      onClick={() => setSelectedInstallments(opt)}
                      className={`p-3 rounded-lg border-2 font-bold transition-all ${selectedInstallments === opt
                          ? 'border-[#D4AF37] bg-[#D4AF37]/10 text-[#D4AF37]'
                          : 'border-zinc-800 text-zinc-400 hover:border-zinc-600'
                        }`}
                    >
                      {opt}x
                    </button>
                  ))}
                </div>
              </div>

              {/* Simulação */}
              <div className="bg-black border border-[#D4AF37]/30 rounded-2xl p-5">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-zinc-400">Valor solicitado:</span>
                  <span className="text-xl font-bold text-white">
                    R$ {(customAmount ? parseFloat(customAmount) : selectedAmount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between items-center mb-4">
                  <span className="text-zinc-400">Total a pagar (30% juros):</span>
                  <span className="text-lg font-bold text-zinc-300">
                    R$ {getTotalAmount().toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-4 border-t border-zinc-800">
                  <span className="text-zinc-400">Parcela mensal:</span>
                  <span className="text-2xl font-bold text-[#D4AF37]">
                    {selectedInstallments}x de R$ {calculateInstallment().toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Termos */}
          {currentStep === 2 && (
            <div className="space-y-6 animate-in slide-in-from-right">
              <div className="text-center mb-4">
                <Shield size={48} className="mx-auto text-[#D4AF37] mb-3" />
                <h2 className="text-xl font-bold text-white">Termos de Contratação</h2>
                <p className="text-zinc-400 text-sm mt-2">Para seguir com a contratação, você precisará:</p>
              </div>

              {/* Lista de Documentos */}
              <div className="bg-black border border-zinc-800 rounded-xl p-4 space-y-3">
                <h3 className="font-bold text-[#D4AF37] text-sm uppercase flex items-center gap-2">
                  <FileCheck size={16} /> Documentos Necessários
                </h3>

                {[
                  'Nome completo',
                  'Tempo de registro em carteira (mínimo 3 meses)',
                  'Profissão e nome da empresa',
                  'Endereço da empresa',
                  'Holerite ou extrato recente',
                  'Selfie segurando RG ou CNH',
                  'Localização em tempo real',
                  'Comprovante de endereço (água/luz) + boleto em seu nome',
                  'Carteira de Trabalho Digital (PDF ou print dos vínculos)',
                  'Vídeo dizendo que está ciente do empréstimo e dos juros de 30%',
                ].map((doc, idx) => (
                  <div key={idx} className="flex items-start gap-3 py-2 border-b border-zinc-900 last:border-0">
                    <CheckCircle2 size={16} className="text-green-500 mt-0.5 shrink-0" />
                    <span className="text-sm text-zinc-300">{doc}</span>
                  </div>
                ))}
              </div>

              {/* Aviso */}
              <div className="bg-yellow-900/20 border border-yellow-600/30 rounded-xl p-4">
                <p className="text-sm text-yellow-400 flex items-start gap-2">
                  <AlertCircle size={18} className="shrink-0 mt-0.5" />
                  <span>
                    <strong>Importante:</strong> Após enviar todos os documentos, analisaremos sua solicitação.
                    Se aprovado, o dinheiro estará em sua conta em até <strong>72 horas</strong>.
                  </span>
                </p>
              </div>

              {/* Aceite */}
              <label className="flex items-start gap-4 p-4 bg-zinc-900 border border-zinc-800 rounded-xl cursor-pointer hover:border-[#D4AF37] transition-colors">
                <input
                  type="checkbox"
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                  className="mt-1 accent-[#D4AF37] w-6 h-6"
                />
                <div>
                  <span className="text-white font-bold">Li e concordo com os termos</span>
                  <p className="text-xs text-zinc-500 mt-1">
                    Declaro que fornecerei informações verdadeiras e estou ciente dos juros de 30%.
                  </p>
                </div>
              </label>
            </div>
          )}

          {/* STEP 3: Dados Pessoais */}
          {currentStep === 3 && (
            <div className="space-y-5 animate-in slide-in-from-right">
              <h2 className="text-xl font-bold text-white">Seus Dados</h2>

              <div className="space-y-4">
                <Input label="Nome Completo" name="name" value={formData.name} onChange={handleChange} placeholder="Seu nome completo" />
                <Input label="CPF" name="cpf" value={formData.cpf} onChange={handleChange} placeholder="000.000.000-00" error={errors.cpf} />
                <Input label="Email" type="email" name="email" value={formData.email} onChange={handleChange} placeholder="seu@email.com" />
                <Input label="Data de Nascimento" type="date" name="birthDate" value={formData.birthDate} onChange={handleChange} />
                <Input label="WhatsApp Pessoal" name="phone" value={formData.phone} onChange={handleChange} placeholder="(00) 00000-0000" />
              </div>

              {/* Contatos de Confiança */}
              <div className="pt-4 border-t border-zinc-800 space-y-4">
                <h3 className="font-bold text-[#D4AF37] flex items-center gap-2 text-sm">
                  <Phone size={16} /> Contatos de Confiança
                </h3>
                <Input label="WhatsApp (outro número)" name="whatsappPersonal" value={formData.whatsappPersonal} onChange={handleChange} placeholder="(00) 00000-0000" />

                <div className="bg-black/50 border border-zinc-800 rounded-xl p-4 space-y-3">
                  <p className="text-xs text-zinc-500">Informe 2 contatos de referência</p>
                  <Input label="Nome do Contato 1" name="contactTrust1Name" value={formData.contactTrust1Name} onChange={handleChange} placeholder="Ex: João (Irmão)" />
                  <Input label="Telefone Contato 1" name="contactTrust1" value={formData.contactTrust1} onChange={handleChange} placeholder="(00) 00000-0000" />
                  <Input label="Nome do Contato 2" name="contactTrust2Name" value={formData.contactTrust2Name} onChange={handleChange} placeholder="Ex: Maria (Amiga)" />
                  <Input label="Telefone Contato 2" name="contactTrust2" value={formData.contactTrust2} onChange={handleChange} placeholder="(00) 00000-0000" />
                </div>

                <Input label="Instagram (opcional)" name="instagram" value={formData.instagram} onChange={handleChange} placeholder="@seuinstagram" />
              </div>

              {/* Dados Profissionais */}
              <div className="pt-4 border-t border-zinc-800 space-y-4">
                <h3 className="font-bold text-[#D4AF37] flex items-center gap-2 text-sm">
                  <Users size={16} /> Dados Profissionais
                </h3>
                <Input label="Profissão" name="occupation" value={formData.occupation} onChange={handleChange} placeholder="Ex: Vendedor" />
                <Input label="Nome da Empresa" name="companyName" value={formData.companyName} onChange={handleChange} placeholder="Nome da empresa" />
                <Input label="Endereço da Empresa" name="companyAddress" value={formData.companyAddress} onChange={handleChange} placeholder="Endereço completo" />
                <Input label="Tempo de Carteira Assinada" name="workTime" value={formData.workTime} onChange={handleChange} placeholder="Ex: 6 meses, 2 anos" />
              </div>

              {/* Endereço */}
              <div className="pt-4 border-t border-zinc-800 space-y-4">
                <h3 className="font-bold text-[#D4AF37] flex items-center gap-2 text-sm">
                  <MapPin size={16} /> Seu Endereço
                </h3>
                <Input label="CEP" name="cep" value={formData.cep} onChange={handleChange} placeholder="00000-000" error={errors.cep} />
                <Input label="Endereço" name="address" value={formData.address} readOnly className="opacity-60" />
                <div className="grid grid-cols-2 gap-4">
                  <Input label="Número" name="number" value={formData.number} onChange={handleChange} placeholder="123" />
                  <Input label="Renda Mensal" name="income" type="number" value={formData.income} onChange={handleChange} placeholder="0,00" />
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: Documentos */}
          {currentStep === 4 && (
            <div className="space-y-6 animate-in slide-in-from-right">
              <h2 className="text-xl font-bold text-white">Documentos e Vídeos</h2>

              {/* Selfie */}
              <div className="bg-black p-4 rounded-xl border border-zinc-800">
                <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                  <ScanFace className="text-[#D4AF37]" size={18} /> Selfie com Documento
                </h3>
                <Camera
                  label="Tire uma selfie segurando seu RG ou CNH"
                  onCapture={(img) => setFormData({ ...formData, selfie: img })}
                />
              </div>

              {/* Vídeo de Confirmação */}
              <div className="bg-black p-4 rounded-xl border border-zinc-800">
                <h3 className="font-semibold text-sm mb-1 flex items-center gap-2">
                  <Video className="text-[#D4AF37]" size={18} /> Vídeo Obrigatório
                </h3>
                <VideoUpload
                  label="Vídeo de Confirmação"
                  subtitle="Diga seu nome e que está ciente do empréstimo com juros de 30%"
                  videoUrl={formData.videoSelfie}
                  onUpload={(url) => setFormData({ ...formData, videoSelfie: url })}
                  onRemove={() => setFormData({ ...formData, videoSelfie: '' })}
                />
              </div>

              {/* Documentos */}
              <div className="space-y-4">
                <h3 className="font-semibold text-sm flex items-center gap-2 text-[#D4AF37]">
                  <FileText size={18} /> Documentos
                </h3>

                <div className="bg-black/30 border border-zinc-800 rounded-xl p-4 space-y-4">
                  <p className="text-xs text-zinc-400 font-bold uppercase">📄 Identificação</p>
                  {renderUploadArea('idCardFront', 'RG ou CNH (Frente)', formData.idCardFront)}
                  {renderUploadArea('idCardBack', 'RG ou CNH (Verso)', formData.idCardBack)}
                </div>

                <div className="bg-black/30 border border-zinc-800 rounded-xl p-4 space-y-4">
                  <p className="text-xs text-zinc-400 font-bold uppercase">🏠 Comprovante de Residência</p>
                  {renderUploadArea('proofAddress', 'Conta de Água ou Luz', formData.proofAddress)}
                  {renderUploadArea('billInName', 'Boleto em seu Nome', formData.billInName)}
                </div>

                <div className="bg-black/30 border border-zinc-800 rounded-xl p-4 space-y-4">
                  <p className="text-xs text-zinc-400 font-bold uppercase">💼 Comprovante de Renda</p>
                  {renderUploadArea('proofIncome', 'Holerite ou Contracheque', formData.proofIncome)}
                  {renderUploadArea('workCard', 'Carteira de Trabalho Digital', formData.workCard)}
                </div>

                <div className="bg-black/30 border border-zinc-800 rounded-xl p-4 space-y-4">
                  <p className="text-xs text-zinc-400 font-bold uppercase">🏦 Comprovante Bancário</p>
                  {renderUploadArea('bankStatement', 'Extrato Bancário Recente', formData.bankStatement)}
                </div>
              </div>

              {/* Vídeo da Casa (Opcional) */}
              <div className="bg-black p-4 rounded-xl border border-zinc-800">
                <VideoUpload
                  label="Vídeo da Casa (Opcional)"
                  subtitle="Mostre a frente ou interior da sua residência"
                  videoUrl={formData.videoHouse}
                  onUpload={(url) => setFormData({ ...formData, videoHouse: url })}
                  onRemove={() => setFormData({ ...formData, videoHouse: '' })}
                />
              </div>
            </div>
          )}

          {/* STEP 5: Dados Bancários */}
          {currentStep === 5 && (
            <div className="space-y-6 animate-in slide-in-from-right">
              <div className="text-center mb-4">
                <Landmark size={48} className="mx-auto text-[#D4AF37] mb-3" />
                <h2 className="text-xl font-bold text-white">Dados para Depósito</h2>
                <p className="text-zinc-400 text-sm mt-2">Informe onde deseja receber o valor</p>
              </div>

              <div className="space-y-4">
                <Input label="Nome do Banco" name="bankName" value={formData.bankName} onChange={handleChange} placeholder="Ex: Nubank, Itaú, Bradesco" />

                <div className="space-y-2">
                  <label className="block text-xs text-zinc-400 mb-1.5 ml-1">Tipo de Chave PIX</label>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { value: 'cpf', label: 'CPF' },
                      { value: 'phone', label: 'Celular' },
                      { value: 'email', label: 'Email' },
                      { value: 'random', label: 'Aleatória' },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setFormData({ ...formData, pixKeyType: opt.value })}
                        className={`p-2 rounded-lg border text-sm font-medium transition-all ${formData.pixKeyType === opt.value
                            ? 'border-[#D4AF37] bg-[#D4AF37]/10 text-[#D4AF37]'
                            : 'border-zinc-700 text-zinc-400 hover:border-zinc-500'
                          }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <Input
                  label="Chave PIX"
                  name="pixKey"
                  value={formData.pixKey}
                  onChange={handleChange}
                  placeholder={
                    formData.pixKeyType === 'cpf' ? '000.000.000-00' :
                      formData.pixKeyType === 'phone' ? '(00) 00000-0000' :
                        formData.pixKeyType === 'email' ? 'seu@email.com' :
                          'Chave aleatória'
                  }
                />

                <Input label="Nome Completo do Titular" name="accountHolderName" value={formData.accountHolderName} onChange={handleChange} placeholder="Nome como está no banco" />
                <Input label="CPF do Titular" name="accountHolderCpf" value={formData.accountHolderCpf} onChange={handleChange} placeholder="000.000.000-00" />
              </div>

              <div className="bg-green-900/20 border border-green-600/30 rounded-xl p-4">
                <p className="text-sm text-green-400 flex items-start gap-2">
                  <CheckCircle2 size={18} className="shrink-0 mt-0.5" />
                  <span>O valor será depositado na conta informada em até <strong>72 horas</strong> após aprovação.</span>
                </p>
              </div>
            </div>
          )}

          {/* STEP 6: Confirmação */}
          {currentStep === 6 && (
            <div className="space-y-6 animate-in slide-in-from-right">
              <div className="text-center mb-4">
                <CheckCircle2 size={48} className="mx-auto text-green-500 mb-3" />
                <h2 className="text-xl font-bold text-white">Confirme sua Solicitação</h2>
              </div>

              {/* Resumo */}
              <div className="bg-black border border-zinc-800 rounded-xl p-4 space-y-3">
                <h3 className="font-bold text-[#D4AF37] text-sm">RESUMO DO PEDIDO</h3>
                <div className="flex justify-between py-2 border-b border-zinc-900">
                  <span className="text-zinc-400">Valor solicitado:</span>
                  <span className="text-white font-bold">R$ {(customAmount ? parseFloat(customAmount) : selectedAmount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-zinc-900">
                  <span className="text-zinc-400">Total a pagar:</span>
                  <span className="text-white font-bold">R$ {getTotalAmount().toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-zinc-900">
                  <span className="text-zinc-400">Parcela:</span>
                  <span className="text-[#D4AF37] font-bold">{selectedInstallments}x de R$ {calculateInstallment().toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-zinc-400">Depósito via PIX:</span>
                  <span className="text-green-400 font-bold">{formData.bankName}</span>
                </div>
              </div>

              {/* Assinatura */}
              <div>
                <h3 className="font-bold text-white mb-3">Assinatura Digital</h3>
                <SignaturePad onSign={(sig) => setFormData({ ...formData, signature: sig })} />
              </div>

              {/* Aviso Final */}
              <div className="bg-[#D4AF37]/10 border border-[#D4AF37]/30 rounded-xl p-4">
                <p className="text-sm text-[#D4AF37] text-center">
                  <Clock size={16} className="inline mr-2" />
                  Após aprovação, o valor será depositado em até <strong>72 horas</strong>.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="fixed bottom-0 left-0 w-full p-4 bg-black/90 border-t border-zinc-900 flex gap-4 z-40 backdrop-blur-md">
          {currentStep > 1 && (
            <Button onClick={handleBack} variant="secondary" className="flex-1">
              Voltar
            </Button>
          )}

          {currentStep < 6 ? (
            <Button onClick={handleNext} className="flex-1">
              Continuar
            </Button>
          ) : (
            <Button onClick={handleSubmit} className="flex-1 bg-green-600 hover:bg-green-700" isLoading={loading}>
              Enviar Solicitação
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

// Input Component
const Input = ({ label, error, className = "", ...props }: any) => (
  <div>
    <label className="block text-xs text-zinc-400 mb-1.5 ml-1">{label}</label>
    <input
      className={`w-full bg-black border rounded-lg p-3 text-white text-sm focus:border-[#D4AF37] outline-none transition-colors ${error ? 'border-red-900 focus:border-red-500' : 'border-zinc-700'} ${className}`}
      {...props}
    />
    {error && <p className="text-xs text-red-500 mt-1 ml-1">{error}</p>}
  </div>
);