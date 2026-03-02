import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight, CheckCircle2, Briefcase, DollarSign, GraduationCap,
  Clock, Target, ChevronLeft, Loader2, MapPin, Mail, Phone as PhoneIcon,
  User, Rocket, TrendingUp
} from 'lucide-react';
import { Logo } from '../../components/Logo';
import { apiService } from '../../services/apiService';

interface FormData {
  // Filtro inicial
  mainInterest: 'EMPRESTIMO' | 'APRENDER' | '';

  // Etapa 2 - Perfil
  creditExperience: string;
  hasCapital: string;
  intention: string;

  // Etapa 3 - Capacidade de investimento
  investmentCapacity: string;

  // Etapa 4 - Interesse em soluções (múltipla escolha)
  interests: string[];

  // Etapa 5 - Compromisso
  weeklyTime: string;

  // Dados básicos
  name: string;
  whatsapp: string;
  email: string;
  city: string;
  state: string;
}

export const QualificationPage: React.FC = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(0); // 0 = filtro inicial
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    mainInterest: '',
    creditExperience: '',
    hasCapital: '',
    intention: '',
    investmentCapacity: '',
    interests: [],
    weeklyTime: '',
    name: '',
    whatsapp: '',
    email: '',
    city: '',
    state: ''
  });

  const totalSteps = 6; // 0=filtro, 1-5=etapas, 6=dados

  const handleNext = () => {
    if (step < totalSteps) {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 0) {
      setStep(step - 1);
    }
  };

  const toggleInterest = (interest: string) => {
    if (formData.interests.includes(interest)) {
      setFormData({
        ...formData,
        interests: formData.interests.filter(i => i !== interest)
      });
    } else {
      setFormData({
        ...formData,
        interests: [...formData.interests, interest]
      });
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      // Gerar tags automáticas
      const tags = generateTags(formData);

      await apiService.post('/qualification-leads', {
        ...formData,
        tags,
        createdAt: new Date().toISOString()
      });

      // Redirecionar para página de sucesso
      navigate('/qualificacao/sucesso');
    } catch (error) {
      console.error('Erro ao enviar formulário:', error);
      alert('Erro ao enviar formulário. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  // Gerar tags automáticas baseado nas respostas
  const generateTags = (data: FormData): string[] => {
    const tags: string[] = [];

    // TAG por interesse
    if (data.interests.includes('curso')) tags.push('TAG_CURSO');
    if (data.interests.includes('mentoria_online')) tags.push('TAG_MENTORIA_ONLINE');
    if (data.interests.includes('mentoria_presencial')) tags.push('TAG_MENTORIA_PRESENCIAL');
    if (data.interests.includes('app')) tags.push('TAG_APP');
    if (data.interests.includes('leads')) tags.push('TAG_LEADS');
    if (data.interests.includes('estrutura')) tags.push('TAG_ESTRUTURA');

    // TAG por capital
    if (data.hasCapital === 'nao_possuo') tags.push('CAPITAL_ZERO');
    if (data.hasCapital === 'ate_10k') tags.push('CAPITAL_BAIXO');
    if (data.hasCapital === '10_50k') tags.push('CAPITAL_MEDIO');
    if (data.hasCapital === '50k_mais') tags.push('CAPITAL_ALTO');

    // TAG por perfil
    if (data.creditExperience === 'nunca') tags.push('INICIANTE');
    if (data.creditExperience === 'ja_indiquei') tags.push('INDICADOR');
    if (data.creditExperience === 'ja_emprestei') tags.push('OPERADOR');
    if (data.creditExperience === 'ja_tenho_operacao') tags.push('AVANCADO');

    return tags;
  };

  const renderStep = () => {
    switch (step) {
      // ETAPA 0 - FILTRO INICIAL
      case 0:
        return (
          <div className="space-y-8 animate-in slide-in-from-right">
            <div className="text-center mb-12">
              <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
                Você quer pegar dinheiro ou aprender a operar no mercado de crédito?
              </h1>
              <p className="text-xl text-zinc-400">
                Preencha o formulário abaixo para participar da próxima etapa do Ecossistema Tubarão.
              </p>
            </div>

            <div className="space-y-4">
              <button
                onClick={() => {
                  // Redirecionar para página de cliente comum
                  navigate('/wizard');
                }}
                className="w-full p-8 bg-gradient-to-r from-red-900/30 to-red-800/30 hover:from-red-900/50 hover:to-red-800/50 border-2 border-red-600/50 hover:border-red-500 rounded-2xl text-white font-bold transition-all text-left group"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-2xl mb-2 flex items-center gap-3">
                      <DollarSign size={32} className="text-red-400" />
                      Quero fazer empréstimo
                    </div>
                    <div className="text-sm text-zinc-400 font-normal">
                      Solicitar crédito pessoal agora
                    </div>
                  </div>
                  <ArrowRight className="text-red-400 group-hover:translate-x-2 transition-transform" size={32} />
                </div>
              </button>

              <button
                onClick={() => {
                  setFormData({ ...formData, mainInterest: 'APRENDER' });
                  handleNext();
                }}
                className="w-full p-8 bg-gradient-to-r from-[#D4AF37]/20 to-yellow-600/20 hover:from-[#D4AF37]/30 hover:to-yellow-600/30 border-2 border-[#D4AF37]/50 hover:border-[#D4AF37] rounded-2xl text-white font-bold transition-all text-left group"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-2xl mb-2 flex items-center gap-3">
                      <GraduationCap size={32} className="text-[#D4AF37]" />
                      Quero aprender a trabalhar com crédito
                    </div>
                    <div className="text-sm text-zinc-400 font-normal">
                      Estruturar meu negócio no mercado de crédito
                    </div>
                  </div>
                  <ArrowRight className="text-[#D4AF37] group-hover:translate-x-2 transition-transform" size={32} />
                </div>
              </button>
            </div>
          </div>
        );

      // ETAPA 1 - PERFIL (Pergunta 1)
      case 1:
        return (
          <div className="space-y-6 animate-in slide-in-from-right">
            <div className="text-center mb-8">
              <Briefcase className="w-16 h-16 text-[#D4AF37] mx-auto mb-4" />
              <h2 className="text-3xl font-bold text-white mb-3">Você já trabalhou com crédito?</h2>
              <p className="text-zinc-400">Queremos entender seu nível de experiência</p>
            </div>

            <div className="space-y-3">
              {[
                { value: 'nunca', label: 'Nunca', desc: 'Estou começando do zero' },
                { value: 'ja_indiquei', label: 'Já indiquei clientes', desc: 'Fiz indicações para outras empresas' },
                { value: 'ja_emprestei', label: 'Já emprestei dinheiro próprio', desc: 'Operei com capital próprio' },
                { value: 'ja_tenho_operacao', label: 'Já tenho operação estruturada', desc: 'Tenho negócio estabelecido' }
              ].map((option) => (
                <button
                  key={option.value}
                  onClick={() => {
                    setFormData({ ...formData, creditExperience: option.value });
                    handleNext();
                  }}
                  className="w-full p-6 bg-zinc-900 hover:bg-zinc-800 border-2 border-zinc-800 hover:border-[#D4AF37] rounded-xl text-white font-medium transition-all text-left group"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-bold mb-1">{option.label}</div>
                      <div className="text-sm text-zinc-400">{option.desc}</div>
                    </div>
                    <ArrowRight className="text-[#D4AF37] opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        );

      // ETAPA 2 - PERFIL (Perguntas 2 e 3)
      case 2:
        return (
          <div className="space-y-8 animate-in slide-in-from-right">
            {/* Pergunta 2 */}
            <div className="space-y-6">
              <div className="text-center mb-8">
                <DollarSign className="w-16 h-16 text-[#D4AF37] mx-auto mb-4" />
                <h2 className="text-3xl font-bold text-white mb-3">Você possui capital disponível?</h2>
              </div>

              <div className="space-y-3">
                {[
                  { value: 'nao_possuo', label: 'Não possuo' },
                  { value: 'ate_10k', label: 'Até 10 mil' },
                  { value: '10_50k', label: '10 a 50 mil' },
                  { value: '50k_mais', label: '50 mil ou mais' }
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setFormData({ ...formData, hasCapital: option.value })}
                    className={`w-full p-5 border-2 rounded-xl font-medium transition-all text-left ${
                      formData.hasCapital === option.value
                        ? 'bg-[#D4AF37]/20 border-[#D4AF37] text-white'
                        : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:border-zinc-700'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Pergunta 3 */}
            {formData.hasCapital && (
              <div className="space-y-6">
                <div className="text-center mb-8">
                  <Target className="w-16 h-16 text-[#D4AF37] mx-auto mb-4" />
                  <h2 className="text-3xl font-bold text-white mb-3">Você pretende:</h2>
                </div>

                <div className="space-y-3">
                  {[
                    { value: 'apenas_indicar', label: 'Apenas indicar clientes' },
                    { value: 'operar_capital', label: 'Operar com capital próprio' },
                    { value: 'estruturar_negocio', label: 'Estruturar negócio no ramo' },
                    { value: 'escalar_operacao', label: 'Escalar operação existente' }
                  ].map((option) => (
                    <button
                      key={option.value}
                      onClick={() => {
                        setFormData({ ...formData, intention: option.value });
                        handleNext();
                      }}
                      className="w-full p-5 bg-zinc-900 hover:bg-zinc-800 border-2 border-zinc-800 hover:border-[#D4AF37] rounded-xl text-white font-medium transition-all text-left group"
                    >
                      <div className="flex items-center justify-between">
                        <span>{option.label}</span>
                        <ArrowRight className="text-[#D4AF37] opacity-0 group-hover:opacity-100 transition-all" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {formData.hasCapital && !formData.intention && (
              <div className="text-center">
                <p className="text-zinc-500 text-sm">Selecione uma opção acima para continuar</p>
              </div>
            )}
          </div>
        );

      // ETAPA 3 - CAPACIDADE DE INVESTIMENTO
      case 3:
        return (
          <div className="space-y-6 animate-in slide-in-from-right">
            <div className="text-center mb-8">
              <TrendingUp className="w-16 h-16 text-[#D4AF37] mx-auto mb-4" />
              <h2 className="text-3xl font-bold text-white mb-3">Capacidade de Investimento</h2>
              <p className="text-zinc-400">Quanto você estaria disposto a investir para estruturar seu negócio?</p>
            </div>

            <div className="space-y-3">
              {[
                { value: 'nao_investir', label: 'Não pretendo investir agora' },
                { value: 'ate_1k', label: 'Até 1.000' },
                { value: '1k_5k', label: '1.000 a 5.000' },
                { value: '5k_10k', label: '5.000 a 10.000' },
                { value: 'acima_10k', label: 'Acima de 10.000' }
              ].map((option) => (
                <button
                  key={option.value}
                  onClick={() => {
                    setFormData({ ...formData, investmentCapacity: option.value });
                    handleNext();
                  }}
                  className="w-full p-6 bg-zinc-900 hover:bg-zinc-800 border-2 border-zinc-800 hover:border-[#D4AF37] rounded-xl text-white font-medium transition-all text-left group"
                >
                  <div className="flex items-center justify-between">
                    <span>{option.label}</span>
                    <ArrowRight className="text-[#D4AF37] opacity-0 group-hover:opacity-100 transition-all" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        );

      // ETAPA 4 - INTERESSE EM SOLUÇÕES (Múltipla escolha)
      case 4:
        return (
          <div className="space-y-6 animate-in slide-in-from-right">
            <div className="text-center mb-8">
              <Rocket className="w-16 h-16 text-[#D4AF37] mx-auto mb-4" />
              <h2 className="text-3xl font-bold text-white mb-3">Qual formato mais te interessa?</h2>
              <p className="text-zinc-400">Você pode selecionar múltiplas opções</p>
            </div>

            <div className="space-y-3">
              {[
                { value: 'curso', label: 'Curso gravado', icon: GraduationCap },
                { value: 'mentoria_online', label: 'Mentoria online', icon: Target },
                { value: 'mentoria_presencial', label: 'Mentoria presencial', icon: Briefcase },
                { value: 'app', label: 'Aplicativo próprio', icon: Rocket },
                { value: 'leads', label: 'Receber leads qualificados', icon: TrendingUp },
                { value: 'estrutura', label: 'Estrutura completa (logo + Instagram + marketing)', icon: CheckCircle2 }
              ].map((option) => {
                const Icon = option.icon;
                const isSelected = formData.interests.includes(option.value);

                return (
                  <button
                    key={option.value}
                    onClick={() => toggleInterest(option.value)}
                    className={`w-full p-5 border-2 rounded-xl font-medium transition-all text-left ${
                      isSelected
                        ? 'bg-[#D4AF37]/20 border-[#D4AF37] text-white'
                        : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon size={24} className={isSelected ? 'text-[#D4AF37]' : 'text-zinc-500'} />
                      <span>{option.label}</span>
                      {isSelected && <CheckCircle2 size={20} className="ml-auto text-[#D4AF37]" />}
                    </div>
                  </button>
                );
              })}
            </div>

            <button
              onClick={handleNext}
              disabled={formData.interests.length === 0}
              className="w-full bg-[#D4AF37] hover:bg-[#b5952f] text-black font-bold py-4 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              Continuar <ArrowRight size={20} />
            </button>
          </div>
        );

      // ETAPA 5 - COMPROMISSO
      case 5:
        return (
          <div className="space-y-6 animate-in slide-in-from-right">
            <div className="text-center mb-8">
              <Clock className="w-16 h-16 text-[#D4AF37] mx-auto mb-4" />
              <h2 className="text-3xl font-bold text-white mb-3">Disponibilidade de Tempo</h2>
              <p className="text-zinc-400">Quanto tempo pode dedicar por semana?</p>
            </div>

            <div className="space-y-3">
              {[
                { value: 'ate_5h', label: 'Até 5h', desc: 'Poucas horas por semana' },
                { value: '5_10h', label: '5 a 10h', desc: 'Algumas horas por semana' },
                { value: 'meio_periodo', label: 'Meio período', desc: '20h por semana' },
                { value: 'integral', label: 'Integral', desc: 'Dedicação exclusiva' }
              ].map((option) => (
                <button
                  key={option.value}
                  onClick={() => {
                    setFormData({ ...formData, weeklyTime: option.value });
                    handleNext();
                  }}
                  className="w-full p-6 bg-zinc-900 hover:bg-zinc-800 border-2 border-zinc-800 hover:border-[#D4AF37] rounded-xl text-white font-medium transition-all text-left group"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-bold mb-1">{option.label}</div>
                      <div className="text-sm text-zinc-400">{option.desc}</div>
                    </div>
                    <ArrowRight className="text-[#D4AF37] opacity-0 group-hover:opacity-100 transition-all" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        );

      // ETAPA 6 - DADOS BÁSICOS
      case 6:
        return (
          <div className="space-y-6 animate-in slide-in-from-right">
            <div className="text-center mb-8">
              <User className="w-16 h-16 text-[#D4AF37] mx-auto mb-4" />
              <h2 className="text-3xl font-bold text-white mb-3">Seus Dados</h2>
              <p className="text-zinc-400">Para finalizarmos sua qualificação</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">Nome completo *</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={20} />
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full pl-11 pr-4 py-3 bg-zinc-900 border border-zinc-800 rounded-lg text-white focus:outline-none focus:border-[#D4AF37]"
                    placeholder="Seu nome completo"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">WhatsApp *</label>
                <div className="relative">
                  <PhoneIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={20} />
                  <input
                    type="tel"
                    value={formData.whatsapp}
                    onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                    className="w-full pl-11 pr-4 py-3 bg-zinc-900 border border-zinc-800 rounded-lg text-white focus:outline-none focus:border-[#D4AF37]"
                    placeholder="(11) 99999-9999"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">Email *</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={20} />
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full pl-11 pr-4 py-3 bg-zinc-900 border border-zinc-800 rounded-lg text-white focus:outline-none focus:border-[#D4AF37]"
                    placeholder="seu@email.com"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">Cidade *</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={20} />
                    <input
                      type="text"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      className="w-full pl-11 pr-4 py-3 bg-zinc-900 border border-zinc-800 rounded-lg text-white focus:outline-none focus:border-[#D4AF37]"
                      placeholder="São Paulo"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">Estado *</label>
                  <select
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    className="w-full px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-lg text-white focus:outline-none focus:border-[#D4AF37]"
                  >
                    <option value="">Selecione</option>
                    <option value="AC">AC</option>
                    <option value="AL">AL</option>
                    <option value="AP">AP</option>
                    <option value="AM">AM</option>
                    <option value="BA">BA</option>
                    <option value="CE">CE</option>
                    <option value="DF">DF</option>
                    <option value="ES">ES</option>
                    <option value="GO">GO</option>
                    <option value="MA">MA</option>
                    <option value="MT">MT</option>
                    <option value="MS">MS</option>
                    <option value="MG">MG</option>
                    <option value="PA">PA</option>
                    <option value="PB">PB</option>
                    <option value="PR">PR</option>
                    <option value="PE">PE</option>
                    <option value="PI">PI</option>
                    <option value="RJ">RJ</option>
                    <option value="RN">RN</option>
                    <option value="RS">RS</option>
                    <option value="RO">RO</option>
                    <option value="RR">RR</option>
                    <option value="SC">SC</option>
                    <option value="SP">SP</option>
                    <option value="SE">SE</option>
                    <option value="TO">TO</option>
                  </select>
                </div>
              </div>
            </div>

            <button
              onClick={handleSubmit}
              disabled={!formData.name || !formData.whatsapp || !formData.email || !formData.city || !formData.state || loading}
              className="w-full bg-[#D4AF37] hover:bg-[#b5952f] text-black font-bold py-4 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin" size={20} />
                  Enviando...
                </>
              ) : (
                <>
                  Finalizar Qualificação <CheckCircle2 size={20} />
                </>
              )}
            </button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Background Gradients */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-[#D4AF37]/10 rounded-full blur-[128px]" />
        <div className="absolute bottom-[20%] right-[-10%] w-[400px] h-[400px] bg-[#D4AF37]/5 rounded-full blur-[128px]" />
      </div>

      {/* Header */}
      <nav className="relative z-50 border-b border-zinc-800 bg-black/80 backdrop-blur-md">
        <div className="container mx-auto px-6 h-20 flex items-center justify-between">
          <Logo size="md" />
          {step > 0 && (
            <div className="text-zinc-400 text-sm">
              Etapa {step} de {totalSteps}
            </div>
          )}
        </div>
      </nav>

      {/* Progress Bar */}
      {step > 0 && (
        <div className="relative z-40 bg-zinc-900">
          <div
            className="h-1 bg-[#D4AF37] transition-all duration-300"
            style={{ width: `${(step / totalSteps) * 100}%` }}
          />
        </div>
      )}

      {/* Content */}
      <div className="relative z-10 container mx-auto px-6 py-12">
        <div className="max-w-3xl mx-auto">
          {renderStep()}

          {/* Back Button */}
          {step > 0 && (
            <button
              onClick={handleBack}
              className="mt-6 w-full flex items-center justify-center gap-2 text-zinc-400 hover:text-white transition-colors py-3"
            >
              <ChevronLeft size={20} />
              Voltar
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
