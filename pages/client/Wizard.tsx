import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, ChevronRight, ChevronLeft, Upload, User, MapPin, Camera as CameraIcon, PenTool, AlertCircle, FileText, Image as ImageIcon, Car, ScanFace, X, Plus, Loader2, Sparkles, Scan, Phone, Users, Video } from 'lucide-react';
import { Button } from '../../components/Button';
import { Camera } from '../../components/Camera';
import { SignaturePad } from '../../components/SignaturePad';
import { VideoUpload } from '../../components/VideoUpload';
import { supabaseService } from '../../services/supabaseService';
import { aiService } from '../../services/aiService';
import { ocrService } from '../../services/ocrService';
import { useToast } from '../../components/Toast';
import { InstallPwaButton } from '../../components/InstallPwaButton';

const steps = [
  { id: 1, title: 'Pessoal', icon: User },
  { id: 2, title: 'Endereço', icon: MapPin },
  { id: 3, title: 'Garantias', icon: CameraIcon },
  { id: 4, title: 'Finalizar', icon: PenTool },
];

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
  const [showTerms, setShowTerms] = useState(false);
  
  // Approval Chance State
  const [approvalChance, setApprovalChance] = useState(10);

  const [formData, setFormData] = useState({
    name: '', cpf: '', email: '', phone: '', birthDate: '',
    // References
    fatherPhone: '', motherPhone: '', spousePhone: '',
    
    cep: '', address: '', number: '', income: '', occupation: '',
    selfie: '', 
    idCardFront: [] as string[], 
    idCardBack: [] as string[], 
    proofAddress: [] as string[], 
    proofIncome: [] as string[],
    
    // Vehicle Data
    hasVehicle: false,
    vehicleCRLV: [] as string[],
    vehicleFront: [] as string[],
    vehicleBack: [] as string[],
    vehicleSide: [] as string[],

    // Videos
    videoSelfie: '',
    videoHouse: '',
    videoVehicle: '',

    signature: '', 
    termsAccepted: false
  });

  // Effect to calculate probability
  useEffect(() => {
    let score = 10;
    
    // Step 1: Personal
    if (formData.name && formData.cpf && formData.email) score += 5;
    if (formData.fatherPhone && formData.motherPhone && formData.spousePhone) score += 15;

    // Step 2: Address/Income
    if (formData.address && formData.income) score += 10;

    // Step 3: Docs
    if (formData.selfie) score += 5;
    if (formData.idCardFront.length > 0) score += 5;
    if (formData.proofIncome.length > 0) score += 5;
    
    // Videos (High Value)
    if (formData.videoSelfie) score += 15;
    if (formData.videoHouse) score += 15;
    if (formData.hasVehicle && formData.videoVehicle) score += 10;
    else if (!formData.hasVehicle) score += 5; // Bonus for not needing extra verification

    // Step 4: Sig
    if (formData.signature) score += 5;

    setApprovalChance(Math.min(98, score));
  }, [formData]);

  // CPF Validation Helper
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
      console.error("Erro CEP", e);
      setErrors(prev => ({ ...prev, cep: "Erro ao buscar CEP." }));
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    let newValue = value;

    if (name === 'cpf') {
      const nums = value.replace(/\D/g, '').slice(0, 11);
      newValue = nums.replace(/(\d{3})(\d)/, '$1.$2')
                     .replace(/(\d{3})(\d)/, '$1.$2')
                     .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
      const error = validateCPF(newValue);
      setErrors(prev => ({ ...prev, cpf: error }));
    }

    if (name === 'cep') {
      let v = value.replace(/\D/g, '').slice(0, 8);
      if (v.length > 5) v = v.replace(/^(\d{5})(\d)/, '$1-$2');
      newValue = v;
      const cleanCep = v.replace(/\D/g, '');
      if (cleanCep.length === 8) fetchAddress(cleanCep);
      else setErrors(prev => ({ ...prev, cep: undefined }));
    }

    // Phone masking for references
    if (['phone', 'fatherPhone', 'motherPhone', 'spousePhone'].includes(name)) {
        let v = value.replace(/\D/g, '').slice(0, 11);
        v = v.replace(/^(\d{2})(\d)/g, '($1) $2');
        v = v.replace(/(\d)(\d{4})$/, '$1-$2');
        newValue = v;
    }

    setFormData({ ...formData, [name]: newValue });
  };

  // Magic Fill / OCR Handler
  const handleMagicFill = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onloadend = async () => {
          const imageSrc = reader.result as string;
          setScannedImage(imageSrc);
          setScanningOCR(true); 
          
          try {
              const result = await ocrService.scanDocument(imageSrc);
              
              if (result.success) {
                  setFormData(prev => ({
                      ...prev,
                      name: result.name || prev.name,
                      cpf: result.cpf || prev.cpf,
                      birthDate: result.birthDate ? result.birthDate.split('/').reverse().join('-') : prev.birthDate,
                      idCardFront: [imageSrc, ...prev.idCardFront] 
                  }));

                  let msg = "Leitura concluída!";
                  if(result.name) msg += " Nome encontrado.";
                  if(result.cpf) msg += " CPF encontrado.";
                  addToast(msg, 'success');
              } else {
                  addToast("Não foi possível ler os dados. Tente uma foto mais clara.", 'warning');
              }
          } catch (error) {
              console.error(error);
              addToast("Erro ao processar imagem.", 'error');
          } finally {
              setTimeout(() => {
                  setScanningOCR(false);
                  setScannedImage(null);
              }, 2000);
          }
      };
      reader.readAsDataURL(file);
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

  const validateDocuments = async (): Promise<boolean> => {
    setAnalyzingDocs(true);
    setErrors(prev => ({ ...prev, doc: undefined }));
    
    if (formData.idCardFront.length > 0) {
        try {
            const result = await aiService.analyzeDocument(formData.idCardFront[0]);
            
            if (!result.valid) {
                console.warn("AI OCR failed to read document");
                setAnalyzingDocs(false);
                return true; 
            }

            const cleanInputCPF = formData.cpf.replace(/\D/g, '');
            const cleanDocCPF = result.cpf.replace(/\D/g, '');
            
            const inputNameParts = formData.name.toUpperCase().split(' ');
            const docName = result.name.toUpperCase();
            const nameMatch = inputNameParts.some(part => docName.includes(part) && part.length > 2);

            if (cleanDocCPF && cleanInputCPF !== cleanDocCPF) {
                const msg = `CPF do documento (${result.cpf}) não confere com o digitado.`;
                setErrors(prev => ({ ...prev, doc: msg }));
                addToast(msg, 'error');
                setAnalyzingDocs(false);
                return false;
            }

            if (!nameMatch && result.name.length > 5) {
                 const msg = `Nome no documento (${result.name}) parece diferente do cadastro.`;
                 addToast(msg, 'warning');
            }

        } catch (e) {
            console.error("Validation error", e);
        }
    }
    
    setAnalyzingDocs(false);
    return true;
  };

  const validateBiometrics = async (): Promise<boolean> => {
    setVerifyingBiometrics(true);
    setErrors(prev => ({ ...prev, biometrics: undefined }));
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const isMatch = formData.selfie.length > 100 && formData.idCardFront.length > 0;
    setVerifyingBiometrics(false);

    if (isMatch) return true;
    else {
      const msg = "A selfie não corresponde ao documento. Tente novamente.";
      setErrors(prev => ({ ...prev, biometrics: msg }));
      addToast(msg, 'error');
      return false;
    }
  };

  const handleNext = async () => {
    if (currentStep === 1) {
      if (errors.cpf || !formData.cpf || !formData.name || !formData.email) {
        addToast("Preencha os dados pessoais obrigatórios.", 'warning');
        return;
      }
      if (!formData.fatherPhone || !formData.motherPhone || !formData.spousePhone) {
        addToast("Todas as referências (Pai, Mãe, Cônjuge) são obrigatórias.", 'warning');
        return;
      }
    }
    if (currentStep === 2) {
       if (errors.cep || !formData.cep || !formData.address || !formData.number || !formData.income || formData.proofIncome.length === 0) {
          addToast("Endereço e Comprovante de Renda são obrigatórios.", 'warning');
          return;
       }
    }
    if (currentStep === 3) {
      // New validations for videos
      if (!formData.selfie || formData.idCardFront.length === 0 || formData.idCardBack.length === 0 || formData.proofAddress.length === 0) {
        addToast("Documentos básicos (Selfie, RG, Endereço) são obrigatórios.", 'warning');
        return;
      }
      
      if (!formData.videoSelfie || !formData.videoHouse) {
          addToast("Vídeos da Selfie e da Casa são obrigatórios.", 'warning');
          return;
      }

      if (formData.hasVehicle) {
        if (formData.vehicleCRLV.length === 0 || formData.vehicleFront.length === 0) {
           addToast("Fotos do veículo são obrigatórias.", 'warning');
           return;
        }
        if (!formData.videoVehicle) {
           addToast("Vídeo do veículo é obrigatório.", 'warning');
           return;
        }
      }
      
      const docsValid = await validateDocuments();
      if (!docsValid) return;

      const bioValid = await validateBiometrics();
      if (!bioValid) return;
    }
    if (currentStep < 4) setCurrentStep(c => c + 1);
  };

  const handleBack = () => {
    if (currentStep > 1) setCurrentStep(c => c - 1);
  };

  const handleSubmit = async () => {
    setLoading(true);
    await supabaseService.submitRequest(formData);
    setLoading(false);
    addToast("Solicitação enviada com sucesso!", 'success');
    navigate('/');
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

  const isFormComplete = 
    formData.termsAccepted && 
    formData.signature && 
    formData.selfie && 
    formData.videoSelfie &&
    formData.videoHouse &&
    formData.idCardFront.length > 0;

  return (
    <div className="min-h-screen bg-black text-white font-sans pb-32">
      {/* OCR Scanner Overlay */}
      {scanningOCR && (
        <div className="fixed inset-0 z-[100] bg-black/90 flex flex-col items-center justify-center animate-in fade-in">
             <div className="relative w-full max-w-sm aspect-[3/4] border-2 border-[#D4AF37] rounded-xl overflow-hidden shadow-[0_0_50px_rgba(212,175,55,0.3)] bg-black">
                 {scannedImage && <img src={scannedImage} className="w-full h-full object-contain opacity-50" />}
                 
                 <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-transparent via-green-500 to-transparent shadow-[0_0_20px_#22c55e] animate-[scan-vertical_2s_linear_infinite]"></div>
                 
                 <div className="absolute top-4 left-4 w-8 h-8 border-t-2 border-l-2 border-green-500"></div>
                 <div className="absolute top-4 right-4 w-8 h-8 border-t-2 border-r-2 border-green-500"></div>
                 <div className="absolute bottom-4 left-4 w-8 h-8 border-b-2 border-l-2 border-green-500"></div>
                 <div className="absolute bottom-4 right-4 w-8 h-8 border-b-2 border-r-2 border-green-500"></div>

                 <div className="absolute bottom-10 left-0 w-full text-center">
                     <p className="text-green-500 font-mono text-sm animate-pulse">PROCESSANDO OCR...</p>
                 </div>
             </div>
             <style>{`
                @keyframes scan-vertical {
                    0% { top: 0%; }
                    100% { top: 100%; }
                }
             `}</style>
        </div>
      )}

      {/* Header Mobile */}
      <div className="sticky top-0 z-30 bg-black/80 backdrop-blur-md border-b border-zinc-900 p-4 flex items-center justify-between">
         <div className="flex items-center gap-2" onClick={() => navigate('/')}>
             <ChevronLeft className="text-zinc-400" />
             <span className="font-bold">Solicitação</span>
         </div>
         <div className="flex items-center gap-3">
             <InstallPwaButton className="!py-1.5 !px-3" />
             <div className="text-sm font-medium text-[#D4AF37]">Passo {currentStep}/4</div>
         </div>
      </div>

      <div className="max-w-xl mx-auto px-4 pt-6">
        
        {/* Dynamic Approval Gauge (Gamification) */}
        <div className="mb-6 bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex items-center justify-between shadow-lg">
            <div>
                <p className="text-xs text-zinc-500 uppercase tracking-wide font-bold">Chance de Aprovação</p>
                <p className={`text-2xl font-bold ${approvalChance > 70 ? 'text-green-500' : approvalChance > 40 ? 'text-yellow-500' : 'text-red-500'}`}>
                    {approvalChance}%
                </p>
            </div>
            <div className="w-32 h-3 bg-zinc-800 rounded-full overflow-hidden border border-zinc-700">
                <div 
                    className={`h-full transition-all duration-1000 ease-out ${approvalChance > 70 ? 'bg-green-500' : approvalChance > 40 ? 'bg-yellow-500' : 'bg-red-500'}`}
                    style={{ width: `${approvalChance}%` }}
                ></div>
            </div>
        </div>

        {/* Progress Steps */}
        <div className="flex justify-between mb-8 px-2 relative">
           <div className="absolute top-1/2 left-0 w-full h-0.5 bg-zinc-800 -z-10 -translate-y-1/2 rounded-full"></div>
           
           {steps.map((step) => {
            const Icon = step.icon;
            const isActive = step.id === currentStep;
            const isCompleted = step.id < currentStep;
            
            return (
              <div key={step.id} className="flex flex-col items-center gap-2 bg-black px-2 z-10">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                  isActive ? 'bg-[#D4AF37] text-black shadow-[0_0_15px_rgba(212,175,55,0.4)]' : 
                  isCompleted ? 'bg-zinc-800 text-[#D4AF37] border border-[#D4AF37]' : 
                  'bg-zinc-900 text-zinc-600 border border-zinc-800'
                }`}>
                  {isCompleted ? <Check size={18} /> : <Icon size={18} />}
                </div>
              </div>
            );
          })}
        </div>

        <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
          
          {(verifyingBiometrics || analyzingDocs) && (
             <div className="absolute inset-0 bg-black/90 z-50 flex flex-col items-center justify-center text-center p-6 animate-in fade-in">
                <div className="w-16 h-16 border-4 border-zinc-800 border-t-[#D4AF37] rounded-full animate-spin mb-6"></div>
                <h3 className="text-xl font-bold text-white mb-2">
                    {analyzingDocs ? 'Validando Documento...' : 'Analisando Biometria'}
                </h3>
                <p className="text-zinc-400 text-sm">
                    {analyzingDocs ? 'Verificando autenticidade.' : 'Aguarde enquanto validamos sua identidade.'}
                </p>
             </div>
          )}

          {currentStep === 1 && (
            <div className="space-y-5 animate-in slide-in-from-right fade-in duration-300">
              <div className="flex justify-between items-center mb-2">
                 <h2 className="text-xl font-bold text-white">Dados Pessoais</h2>
              </div>

              {/* Magic Fill Button */}
              <div className="relative mb-6">
                 <input 
                    type="file" 
                    id="ocr-upload" 
                    accept="image/*"
                    onChange={handleMagicFill}
                    className="hidden"
                 />
                 <label 
                    htmlFor="ocr-upload"
                    className="flex items-center justify-center gap-3 w-full p-4 bg-gradient-to-r from-[#D4AF37]/20 to-[#D4AF37]/5 border border-[#D4AF37] rounded-xl cursor-pointer hover:bg-[#D4AF37]/30 transition-all group"
                 >
                    <div className="p-2 bg-[#D4AF37] rounded-full text-black shadow-[0_0_15px_rgba(212,175,55,0.5)] group-hover:scale-110 transition-transform">
                        <Scan size={20} />
                    </div>
                    <div className="text-left">
                        <span className="block font-bold text-[#D4AF37] flex items-center gap-2"><Sparkles size={14}/> Preenchimento Mágico</span>
                        <span className="text-xs text-zinc-400">Envie foto da CNH para preencher tudo.</span>
                    </div>
                 </label>
              </div>
              
              <div className="space-y-4">
                <Input label="Nome Completo" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} placeholder="Seu nome" />
                
                <div>
                  <Input 
                     label="CPF" 
                     name="cpf" 
                     value={formData.cpf} 
                     onChange={handleChange} 
                     placeholder="000.000.000-00"
                     error={errors.cpf} 
                  />
                </div>

                <Input label="Email" type="email" name="email" value={formData.email} onChange={handleChange} placeholder="nome@email.com" />
                <Input label="Data de Nascimento" type="date" name="birthDate" value={formData.birthDate} onChange={handleChange} />
                <Input label="Seu Celular" name="phone" value={formData.phone} onChange={handleChange} placeholder="(00) 00000-0000" />
              
                <div className="pt-4 border-t border-zinc-800 space-y-4">
                    <h3 className="font-bold text-[#D4AF37] flex items-center gap-2 text-sm uppercase tracking-wide">
                        <Users size={16} /> Referências (Obrigatório)
                    </h3>
                    <Input label="Telefone do Pai" name="fatherPhone" value={formData.fatherPhone} onChange={handleChange} placeholder="(00) 00000-0000" />
                    <Input label="Telefone da Mãe" name="motherPhone" value={formData.motherPhone} onChange={handleChange} placeholder="(00) 00000-0000" />
                    <Input label="Telefone Cônjuge/Esposa" name="spousePhone" value={formData.spousePhone} onChange={handleChange} placeholder="(00) 00000-0000" />
                </div>
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-5 animate-in slide-in-from-right fade-in duration-300">
              <h2 className="text-xl font-bold text-white mb-2">Localização & Renda</h2>
              
              <div className="space-y-4">
                <Input label="CEP" name="cep" value={formData.cep} onChange={handleChange} placeholder="00000-000" error={errors.cep} />
                <Input label="Endereço" name="address" value={formData.address} onChange={()=>{}} readOnly className="opacity-60 cursor-not-allowed" />
                
                <div className="grid grid-cols-2 gap-4">
                    <Input label="Número" name="number" value={formData.number} onChange={handleChange} placeholder="123" />
                    <Input label="Renda Mensal" name="income" type="number" value={formData.income} onChange={handleChange} placeholder="R$ 0,00" />
                </div>
                
                <div className="pt-2 border-t border-zinc-800 mt-4">
                    {renderUploadArea('proofIncome', 'Comprovante de Renda (PDF/Foto)', formData.proofIncome)}
                </div>
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-6 animate-in slide-in-from-right fade-in duration-300">
              <h2 className="text-xl font-bold text-white">Garantias & Vídeos</h2>
              
              {errors.biometrics && (
                <div className="p-3 bg-red-900/20 border border-red-500/50 rounded-lg flex items-center gap-3 text-red-200 text-sm">
                  <AlertCircle size={18} className="text-red-500 shrink-0" />
                  {errors.biometrics}
                </div>
              )}
              
              {errors.doc && (
                <div className="p-3 bg-red-900/20 border border-red-500/50 rounded-lg flex items-center gap-3 text-red-200 text-sm">
                  <AlertCircle size={18} className="text-red-500 shrink-0" />
                  {errors.doc}
                </div>
              )}

              <div className="space-y-6">
                
                {/* Selfie Photo */}
                <div className="bg-black p-4 rounded-xl border border-zinc-800">
                   <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><ScanFace className="text-[#D4AF37]" size={18}/> Selfie (Foto)</h3>
                   <Camera 
                     label="Tirar Selfie" 
                     onCapture={(img) => setFormData({...formData, selfie: img})} 
                   />
                </div>

                {/* Videos Section */}
                <div className="bg-black p-4 rounded-xl border border-zinc-800 space-y-4">
                    <h3 className="font-semibold text-sm mb-1 flex items-center gap-2"><Video className="text-[#D4AF37]" size={18}/> Vídeos Obrigatórios</h3>
                    <p className="text-xs text-zinc-500 mb-2">Grave vídeos curtos de 30 segundos para validação.</p>
                    
                    <VideoUpload 
                        label="Vídeo do Usuário (Rosto)"
                        subtitle="Fale seu nome e data de hoje."
                        videoUrl={formData.videoSelfie}
                        onUpload={(url) => setFormData({...formData, videoSelfie: url})}
                        onRemove={() => setFormData({...formData, videoSelfie: ''})}
                    />

                    <VideoUpload 
                        label="Vídeo da Casa"
                        subtitle="Mostre a frente ou interior."
                        videoUrl={formData.videoHouse}
                        onUpload={(url) => setFormData({...formData, videoHouse: url})}
                        onRemove={() => setFormData({...formData, videoHouse: ''})}
                    />
                </div>

                <div className="space-y-6">
                   {renderUploadArea('idCardFront', 'RG/CNH (Frente)', formData.idCardFront)}
                   {renderUploadArea('idCardBack', 'RG/CNH (Verso)', formData.idCardBack)}
                   {renderUploadArea('proofAddress', 'Comp. Residência', formData.proofAddress)}
                </div>

                <div className="pt-4 border-t border-zinc-800">
                   <label className="flex items-center gap-3 p-4 bg-black border border-zinc-800 rounded-xl cursor-pointer hover:border-[#D4AF37] transition-colors">
                      <input 
                        type="checkbox" 
                        checked={formData.hasVehicle}
                        onChange={(e) => setFormData(prev => ({ ...prev, hasVehicle: e.target.checked }))}
                        className="accent-[#D4AF37] w-5 h-5"
                      />
                      <div className="flex-1">
                          <span className="block text-sm font-bold text-white">Possui Veículo?</span>
                          <span className="text-xs text-zinc-500">Aumente suas chances de aprovação.</span>
                      </div>
                      <Car size={24} className={formData.hasVehicle ? "text-[#D4AF37]" : "text-zinc-600"} />
                   </label>

                   {formData.hasVehicle && (
                      <div className="mt-4 space-y-4 animate-in slide-in-from-top-2">
                          <div className="bg-black p-4 rounded-xl border border-zinc-800">
                             <VideoUpload 
                                label="Vídeo do Carro"
                                subtitle="Mostre o veículo e a placa."
                                videoUrl={formData.videoVehicle}
                                onUpload={(url) => setFormData({...formData, videoVehicle: url})}
                                onRemove={() => setFormData({...formData, videoVehicle: ''})}
                             />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            {renderUploadArea('vehicleCRLV', 'Doc. (CRLV)', formData.vehicleCRLV)}
                            {renderUploadArea('vehicleFront', 'Foto Frente', formData.vehicleFront)}
                          </div>
                      </div>
                   )}
                </div>
              </div>
            </div>
          )}

          {currentStep === 4 && (
            <div className="space-y-6 animate-in slide-in-from-right fade-in duration-300">
              <h2 className="text-xl font-bold text-white">Assinatura</h2>
              
              <SignaturePad onSign={(sig) => setFormData({...formData, signature: sig})} />
              
              <div className="flex items-start gap-3 p-4 bg-black border border-zinc-800 rounded-xl">
                <input 
                  type="checkbox" 
                  id="terms" 
                  checked={formData.termsAccepted}
                  onChange={(e) => setFormData({...formData, termsAccepted: e.target.checked})}
                  className="mt-1 accent-[#D4AF37] w-5 h-5 cursor-pointer shrink-0"
                />
                <label htmlFor="terms" className="text-sm text-zinc-400 select-none">
                  Li e concordo com os <span onClick={(e) => { e.preventDefault(); setShowTerms(true); }} className="text-[#D4AF37] font-bold cursor-pointer hover:underline">Termos de Uso</span>. Declaro que as informações enviadas são verdadeiras.
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="fixed bottom-0 left-0 w-full p-4 bg-black/90 border-t border-zinc-900 flex gap-4 z-40 backdrop-blur-md">
           {currentStep > 1 && (
             <Button onClick={handleBack} variant="secondary" className="flex-1" disabled={verifyingBiometrics || analyzingDocs}>
                Voltar
             </Button>
           )}
           
           {currentStep < 4 ? (
             <Button onClick={handleNext} className="flex-1" isLoading={verifyingBiometrics || analyzingDocs}>
                {verifyingBiometrics || analyzingDocs ? 'Validando...' : 'Continuar'}
             </Button>
           ) : (
             <Button onClick={handleSubmit} className="flex-1" isLoading={loading} disabled={!isFormComplete}>
                Finalizar Pedido
             </Button>
           )}
        </div>

      </div>

      {/* Terms Modal */}
      {showTerms && (
        <div className="fixed inset-0 z-[60] bg-black/95 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg max-h-[80vh] flex flex-col shadow-2xl">
                <div className="p-6 border-b border-zinc-800 flex justify-between items-center">
                    <h3 className="text-xl font-bold text-white">Termos de Uso</h3>
                    <button onClick={() => setShowTerms(false)}><X className="text-zinc-500 hover:text-white" /></button>
                </div>
                <div className="p-6 overflow-y-auto text-sm text-zinc-300 space-y-4">
                    <p><strong>1. ACEITAÇÃO</strong><br/>Ao utilizar a plataforma Tubarão Empréstimos, você concorda com a coleta e processamento de seus dados para fins de análise de crédito.</p>
                    <p><strong>2. VERACIDADE</strong><br/>Você declara que todas as informações, documentos e biometria fornecidos são verdadeiros e autênticos, sob pena de responsabilidade civil e criminal.</p>
                    <p><strong>3. VÍDEOS E REFERÊNCIAS</strong><br/>Autorizo o uso dos vídeos enviados (casa, veículo, rosto) para validação cadastral e contato com as referências fornecidas (pai, mãe, cônjuge) em caso de necessidade.</p>
                    <p><strong>4. CONSULTA</strong><br/>Autorizo a consulta de meu CPF em órgãos de proteção ao crédito (SPC/Serasa) e no Sistema de Informações de Crédito (SCR) do Banco Central.</p>
                    <p><strong>5. BIOMETRIA</strong><br/>Consinto com a coleta da minha imagem facial (selfie) para fins de prevenção à fraude e validação de identidade (Liveness Check).</p>
                    <p><strong>6. JUROS E MULTAS</strong><br/>Estou ciente das taxas de juros aplicadas e que o atraso no pagamento acarretará multas e juros moratórios conforme contrato.</p>
                </div>
                <div className="p-6 border-t border-zinc-800 bg-black/50 rounded-b-2xl">
                    <Button onClick={() => { setFormData({...formData, termsAccepted: true}); setShowTerms(false); }} className="w-full">
                        Li e Concordo
                    </Button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

// Reusable Input Component for Wizard
const Input = ({ label, error, className = "", ...props }: any) => (
    <div>
        <label className="block text-xs text-zinc-400 mb-1.5 ml-1">{label}</label>
        <input 
            className={`w-full bg-black border rounded-lg p-3 text-white text-sm focus:border-[#D4AF37] outline-none transition-colors ${error ? 'border-red-900 focus:border-red-500' : 'border-zinc-700'} ${className}`}
            {...props}
        />
        {error && <p className="text-xs text-red-500 mt-1 ml-1 font-medium">{error}</p>}
    </div>
);