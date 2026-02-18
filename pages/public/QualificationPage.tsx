import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight, CheckCircle2, Briefcase, DollarSign, GraduationCap,
  Clock, Handshake, ChevronLeft, Loader2
} from 'lucide-react';
import { Logo } from '../../components/Logo';
import { apiService } from '../../services/apiService';

interface FormData {
  name: string;
  email: string;
  phone: string;
  hasExperience: boolean | null;
  experienceLevel: string;
  hasCapital: boolean | null;
  capitalAmount: string;
  wantsToLearn: boolean | null;
  learningInterest: string;
  hasTime: boolean | null;
  timeAvailability: string;
  wantsPartnership: boolean | null;
  partnershipType: string;
}

export const QualificationPage: React.FC = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    name: '',
    email: '',
    phone: '',
    hasExperience: null,
    experienceLevel: '',
    hasCapital: null,
    capitalAmount: '',
    wantsToLearn: null,
    learningInterest: '',
    hasTime: null,
    timeAvailability: '',
    wantsPartnership: null,
    partnershipType: ''
  });

  const totalSteps = 7;

  const handleNext = () => {
    if (step < totalSteps) {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await apiService.post('/qualification-leads', formData);

      // Redirecionar para grupo WhatsApp
      const whatsappGroup = 'https://chat.whatsapp.com/SEU_LINK_DO_GRUPO';
      window.location.href = whatsappGroup;
    } catch (error) {
      console.error('Erro ao enviar formulário:', error);
      alert('Erro ao enviar formulário. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-white mb-3">Vamos começar!</h2>
              <p className="text-zinc-400">Primeiro, precisamos de algumas informações básicas</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">Nome completo</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-lg text-white focus:outline-none focus:border-[#D4AF37]"
                  placeholder="Seu nome"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">E-mail</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-lg text-white focus:outline-none focus:border-[#D4AF37]"
                  placeholder="seu@email.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">WhatsApp</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-lg text-white focus:outline-none focus:border-[#D4AF37]"
                  placeholder="(11) 99999-9999"
                />
              </div>
            </div>

            <button
              onClick={handleNext}
              disabled={!formData.name || !formData.email || !formData.phone}
              className="w-full bg-[#D4AF37] hover:bg-[#b5952f] text-black font-bold py-4 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              Continuar <ArrowRight size={20} />
            </button>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <Briefcase className="w-16 h-16 text-[#D4AF37] mx-auto mb-4" />
              <h2 className="text-3xl font-bold text-white mb-3">Experiência no mercado</h2>
              <p className="text-zinc-400">Você já trabalha ou trabalhou com crédito/empréstimos?</p>
            </div>

            <div className="space-y-3">
              <button
                onClick={() => {
                  setFormData({ ...formData, hasExperience: true });
                  handleNext();
                }}
                className="w-full p-6 bg-zinc-900 hover:bg-zinc-800 border-2 border-zinc-800 hover:border-[#D4AF37] rounded-lg text-white font-medium transition-all text-left"
              >
                <div className="flex items-center justify-between">
                  <span>Sim, tenho experiência</span>
                  <ArrowRight className="text-[#D4AF37]" />
                </div>
              </button>

              <button
                onClick={() => {
                  setFormData({ ...formData, hasExperience: false, experienceLevel: '' });
                  handleNext();
                }}
                className="w-full p-6 bg-zinc-900 hover:bg-zinc-800 border-2 border-zinc-800 hover:border-[#D4AF37] rounded-lg text-white font-medium transition-all text-left"
              >
                <div className="flex items-center justify-between">
                  <span>Não, estou começando agora</span>
                  <ArrowRight className="text-[#D4AF37]" />
                </div>
              </button>
            </div>
          </div>
        );

      case 3:
        if (formData.hasExperience) {
          return (
            <div className="space-y-6">
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-white mb-3">Nível de experiência</h2>
                <p className="text-zinc-400">Qual seu nível de conhecimento no mercado?</p>
              </div>

              <div className="space-y-3">
                <button
                  onClick={() => {
                    setFormData({ ...formData, experienceLevel: 'iniciante' });
                    handleNext();
                  }}
                  className="w-full p-6 bg-zinc-900 hover:bg-zinc-800 border-2 border-zinc-800 hover:border-[#D4AF37] rounded-lg text-white font-medium transition-all text-left"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-bold mb-1">Iniciante</div>
                      <div className="text-sm text-zinc-400">Menos de 1 ano de experiência</div>
                    </div>
                    <ArrowRight className="text-[#D4AF37]" />
                  </div>
                </button>

                <button
                  onClick={() => {
                    setFormData({ ...formData, experienceLevel: 'intermediario' });
                    handleNext();
                  }}
                  className="w-full p-6 bg-zinc-900 hover:bg-zinc-800 border-2 border-zinc-800 hover:border-[#D4AF37] rounded-lg text-white font-medium transition-all text-left"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-bold mb-1">Intermediário</div>
                      <div className="text-sm text-zinc-400">1 a 3 anos de experiência</div>
                    </div>
                    <ArrowRight className="text-[#D4AF37]" />
                  </div>
                </button>

                <button
                  onClick={() => {
                    setFormData({ ...formData, experienceLevel: 'avancado' });
                    handleNext();
                  }}
                  className="w-full p-6 bg-zinc-900 hover:bg-zinc-800 border-2 border-zinc-800 hover:border-[#D4AF37] rounded-lg text-white font-medium transition-all text-left"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-bold mb-1">Avançado</div>
                      <div className="text-sm text-zinc-400">Mais de 3 anos de experiência</div>
                    </div>
                    <ArrowRight className="text-[#D4AF37]" />
                  </div>
                </button>
              </div>
            </div>
          );
        } else {
          return renderCapitalStep();
        }

      case 4:
        return renderCapitalStep();

      case 5:
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <GraduationCap className="w-16 h-16 text-[#D4AF37] mx-auto mb-4" />
              <h2 className="text-3xl font-bold text-white mb-3">Interesse em aprender</h2>
              <p className="text-zinc-400">Você gostaria de aprender mais sobre o mercado de crédito?</p>
            </div>

            <div className="space-y-3">
              <button
                onClick={() => {
                  setFormData({ ...formData, wantsToLearn: true });
                  handleNext();
                }}
                className="w-full p-6 bg-zinc-900 hover:bg-zinc-800 border-2 border-zinc-800 hover:border-[#D4AF37] rounded-lg text-white font-medium transition-all text-left"
              >
                <div className="flex items-center justify-between">
                  <span>Sim, quero aprender</span>
                  <ArrowRight className="text-[#D4AF37]" />
                </div>
              </button>

              <button
                onClick={() => {
                  setFormData({ ...formData, wantsToLearn: false, learningInterest: '' });
                  handleNext();
                }}
                className="w-full p-6 bg-zinc-900 hover:bg-zinc-800 border-2 border-zinc-800 hover:border-[#D4AF37] rounded-lg text-white font-medium transition-all text-left"
              >
                <div className="flex items-center justify-between">
                  <span>Não, já tenho conhecimento suficiente</span>
                  <ArrowRight className="text-[#D4AF37]" />
                </div>
              </button>
            </div>
          </div>
        );

      case 6:
        if (formData.wantsToLearn) {
          return (
            <div className="space-y-6">
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-white mb-3">Formato de aprendizado</h2>
                <p className="text-zinc-400">Como você prefere aprender?</p>
              </div>

              <div className="space-y-3">
                <button
                  onClick={() => {
                    setFormData({ ...formData, learningInterest: 'curso' });
                    handleNext();
                  }}
                  className="w-full p-6 bg-zinc-900 hover:bg-zinc-800 border-2 border-zinc-800 hover:border-[#D4AF37] rounded-lg text-white font-medium transition-all text-left"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-bold mb-1">Curso online</div>
                      <div className="text-sm text-zinc-400">Aprenda no seu ritmo</div>
                    </div>
                    <ArrowRight className="text-[#D4AF37]" />
                  </div>
                </button>

                <button
                  onClick={() => {
                    setFormData({ ...formData, learningInterest: 'mentoria' });
                    handleNext();
                  }}
                  className="w-full p-6 bg-zinc-900 hover:bg-zinc-800 border-2 border-zinc-800 hover:border-[#D4AF37] rounded-lg text-white font-medium transition-all text-left"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-bold mb-1">Mentoria online</div>
                      <div className="text-sm text-zinc-400">Acompanhamento personalizado</div>
                    </div>
                    <ArrowRight className="text-[#D4AF37]" />
                  </div>
                </button>

                <button
                  onClick={() => {
                    setFormData({ ...formData, learningInterest: 'presencial' });
                    handleNext();
                  }}
                  className="w-full p-6 bg-zinc-900 hover:bg-zinc-800 border-2 border-zinc-800 hover:border-[#D4AF37] rounded-lg text-white font-medium transition-all text-left"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-bold mb-1">Mentoria presencial</div>
                      <div className="text-sm text-zinc-400">Aprendizado imersivo</div>
                    </div>
                    <ArrowRight className="text-[#D4AF37]" />
                  </div>
                </button>
              </div>
            </div>
          );
        } else {
          return renderTimeStep();
        }

      case 7:
        return renderPartnershipStep();

      default:
        return null;
    }
  };

  const renderCapitalStep = () => (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <DollarSign className="w-16 h-16 text-[#D4AF37] mx-auto mb-4" />
        <h2 className="text-3xl font-bold text-white mb-3">Capital disponível</h2>
        <p className="text-zinc-400">Você tem capital para investir no negócio?</p>
      </div>

      <div className="space-y-3">
        <button
          onClick={() => {
            setFormData({ ...formData, hasCapital: true });
            handleNext();
          }}
          className="w-full p-6 bg-zinc-900 hover:bg-zinc-800 border-2 border-zinc-800 hover:border-[#D4AF37] rounded-lg text-white font-medium transition-all text-left"
        >
          <div className="flex items-center justify-between">
            <span>Sim, tenho capital</span>
            <ArrowRight className="text-[#D4AF37]" />
          </div>
        </button>

        <button
          onClick={() => {
            setFormData({ ...formData, hasCapital: false, capitalAmount: '' });
            handleNext();
          }}
          className="w-full p-6 bg-zinc-900 hover:bg-zinc-800 border-2 border-zinc-800 hover:border-[#D4AF37] rounded-lg text-white font-medium transition-all text-left"
        >
          <div className="flex items-center justify-between">
            <span>Não tenho capital no momento</span>
            <ArrowRight className="text-[#D4AF37]" />
          </div>
        </button>
      </div>
    </div>
  );

  const renderTimeStep = () => (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <Clock className="w-16 h-16 text-[#D4AF37] mx-auto mb-4" />
        <h2 className="text-3xl font-bold text-white mb-3">Disponibilidade de tempo</h2>
        <p className="text-zinc-400">Quanto tempo você pode dedicar ao negócio?</p>
      </div>

      <div className="space-y-3">
        <button
          onClick={() => {
            setFormData({ ...formData, hasTime: true, timeAvailability: 'integral' });
            handleNext();
          }}
          className="w-full p-6 bg-zinc-900 hover:bg-zinc-800 border-2 border-zinc-800 hover:border-[#D4AF37] rounded-lg text-white font-medium transition-all text-left"
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="font-bold mb-1">Tempo integral</div>
              <div className="text-sm text-zinc-400">Dedicação exclusiva</div>
            </div>
            <ArrowRight className="text-[#D4AF37]" />
          </div>
        </button>

        <button
          onClick={() => {
            setFormData({ ...formData, hasTime: true, timeAvailability: 'parcial' });
            handleNext();
          }}
          className="w-full p-6 bg-zinc-900 hover:bg-zinc-800 border-2 border-zinc-800 hover:border-[#D4AF37] rounded-lg text-white font-medium transition-all text-left"
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="font-bold mb-1">Meio período</div>
              <div className="text-sm text-zinc-400">4-6 horas por dia</div>
            </div>
            <ArrowRight className="text-[#D4AF37]" />
          </div>
        </button>

        <button
          onClick={() => {
            setFormData({ ...formData, hasTime: false, timeAvailability: 'limitado' });
            handleNext();
          }}
          className="w-full p-6 bg-zinc-900 hover:bg-zinc-800 border-2 border-zinc-800 hover:border-[#D4AF37] rounded-lg text-white font-medium transition-all text-left"
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="font-bold mb-1">Poucas horas</div>
              <div className="text-sm text-zinc-400">Menos de 4 horas por dia</div>
            </div>
            <ArrowRight className="text-[#D4AF37]" />
          </div>
        </button>
      </div>
    </div>
  );

  const renderPartnershipStep = () => (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <Handshake className="w-16 h-16 text-[#D4AF37] mx-auto mb-4" />
        <h2 className="text-3xl font-bold text-white mb-3">Interesse em parceria</h2>
        <p className="text-zinc-400">Você tem interesse em fazer parceria conosco?</p>
      </div>

      <div className="space-y-3">
        <button
          onClick={() => {
            setFormData({ ...formData, wantsPartnership: true, partnershipType: 'investidor' });
            handleSubmit();
          }}
          disabled={loading}
          className="w-full p-6 bg-zinc-900 hover:bg-zinc-800 border-2 border-zinc-800 hover:border-[#D4AF37] rounded-lg text-white font-medium transition-all text-left disabled:opacity-50"
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="font-bold mb-1">Investidor</div>
              <div className="text-sm text-zinc-400">Quero investir capital</div>
            </div>
            {loading ? <Loader2 className="animate-spin text-[#D4AF37]" /> : <ArrowRight className="text-[#D4AF37]" />}
          </div>
        </button>

        <button
          onClick={() => {
            setFormData({ ...formData, wantsPartnership: true, partnershipType: 'operacional' });
            handleSubmit();
          }}
          disabled={loading}
          className="w-full p-6 bg-zinc-900 hover:bg-zinc-800 border-2 border-zinc-800 hover:border-[#D4AF37] rounded-lg text-white font-medium transition-all text-left disabled:opacity-50"
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="font-bold mb-1">Parceiro operacional</div>
              <div className="text-sm text-zinc-400">Quero trabalhar ativamente</div>
            </div>
            {loading ? <Loader2 className="animate-spin text-[#D4AF37]" /> : <ArrowRight className="text-[#D4AF37]" />}
          </div>
        </button>

        <button
          onClick={() => {
            setFormData({ ...formData, wantsPartnership: true, partnershipType: 'correspondente' });
            handleSubmit();
          }}
          disabled={loading}
          className="w-full p-6 bg-zinc-900 hover:bg-zinc-800 border-2 border-zinc-800 hover:border-[#D4AF37] rounded-lg text-white font-medium transition-all text-left disabled:opacity-50"
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="font-bold mb-1">Correspondente bancário</div>
              <div className="text-sm text-zinc-400">Quero intermediar operações</div>
            </div>
            {loading ? <Loader2 className="animate-spin text-[#D4AF37]" /> : <ArrowRight className="text-[#D4AF37]" />}
          </div>
        </button>

        <button
          onClick={() => {
            setFormData({ ...formData, wantsPartnership: false, partnershipType: '' });
            handleSubmit();
          }}
          disabled={loading}
          className="w-full p-6 bg-zinc-900 hover:bg-zinc-800 border-2 border-zinc-800 hover:border-zinc-700 rounded-lg text-zinc-400 font-medium transition-all text-left disabled:opacity-50"
        >
          <div className="flex items-center justify-between">
            <span>Não tenho interesse no momento</span>
            {loading ? <Loader2 className="animate-spin" /> : <ArrowRight />}
          </div>
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Background Gradients */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-[#D4AF37]/10 rounded-full blur-[128px]" />
        <div className="absolute bottom-[20%] right-[-10%] w-[400px] h-[400px] bg-red-900/10 rounded-full blur-[128px]" />
      </div>

      {/* Header */}
      <nav className="relative z-50 border-b border-zinc-800 bg-black/80 backdrop-blur-md">
        <div className="container mx-auto px-6 h-20 flex items-center justify-between">
          <Logo size="md" />
          <div className="text-zinc-400 text-sm">
            Etapa {step} de {totalSteps}
          </div>
        </div>
      </nav>

      {/* Progress Bar */}
      <div className="relative z-40 bg-zinc-900">
        <div
          className="h-1 bg-[#D4AF37] transition-all duration-300"
          style={{ width: `${(step / totalSteps) * 100}%` }}
        />
      </div>

      {/* Content */}
      <div className="relative z-10 container mx-auto px-6 py-12">
        <div className="max-w-2xl mx-auto">
          {renderStep()}

          {/* Back Button */}
          {step > 1 && (
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
