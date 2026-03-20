import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Send } from 'lucide-react';
import { apiService } from '../../services/apiService';
import { useToast } from '../../components/Toast';
import { Button } from '../../components/Button';

interface QuizData {
  courseId: string;
  // Passo 1
  npsScore: number;
  wouldRecommend: string;
  whatCaughtAttention: string;
  // Passo 2
  situationBefore: string;
  clarityNow: string;
  // Passo 3
  interestMotos: string;
  interestCredit: string;
  // Passo 4
  wouldStartSteps: string;
  investmentAmount: string;
  // Passo 5
  interestOnlineMentorship: string;
  interestPresentialMentorship: string;
  // Passo 6
  fullName: string;
  whatsapp: string;
  city: string;
  state: string;
  suggestions: string;
}

export function QuizForm() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [currentStep, setCurrentStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState<QuizData>({
    courseId: courseId!,
    npsScore: 0,
    wouldRecommend: '',
    whatCaughtAttention: '',
    situationBefore: '',
    clarityNow: '',
    interestMotos: '',
    interestCredit: '',
    wouldStartSteps: '',
    investmentAmount: '',
    interestOnlineMentorship: '',
    interestPresentialMentorship: '',
    fullName: '',
    whatsapp: '',
    city: '',
    state: '',
    suggestions: ''
  });

  const updateField = (field: keyof QuizData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return formData.npsScore > 0 && formData.wouldRecommend;
      case 2:
        return formData.situationBefore && formData.clarityNow;
      case 3:
        return formData.interestMotos && formData.interestCredit;
      case 4:
        return formData.wouldStartSteps && formData.investmentAmount;
      case 5:
        return formData.interestOnlineMentorship && formData.interestPresentialMentorship;
      case 6:
        return formData.fullName && formData.whatsapp;
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (canProceed()) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handleBack = () => {
    setCurrentStep(prev => prev - 1);
  };

  const handleSubmit = async () => {
    if (!canProceed()) return;

    setSubmitting(true);
    try {
      const response = await apiService.submitQuiz(formData);
      addToast(response.message, 'success');
      navigate(`/client/course/${courseId}/certificate`);
    } catch (err: any) {
      addToast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-white mb-4">
              📊 Passo 1: Sua Experiência
            </h2>

            <div>
              <label className="block text-white font-bold mb-3">
                De 0 a 10, quanto você recomendaria este curso?
              </label>
              <div className="flex gap-2">
                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(score => (
                  <button
                    key={score}
                    onClick={() => updateField('npsScore', score)}
                    className={`w-12 h-12 rounded-lg font-bold transition-all ${
                      formData.npsScore === score
                        ? 'bg-gradient-to-br from-[#D4AF37] to-[#8B4513] text-white scale-110'
                        : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                    }`}
                  >
                    {score}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-white font-bold mb-3">
                Você recomendaria este curso para outras pessoas?
              </label>
              <div className="grid grid-cols-3 gap-3">
                {['Sim', 'Talvez', 'Não'].map(option => (
                  <button
                    key={option}
                    onClick={() => updateField('wouldRecommend', option)}
                    className={`py-3 rounded-lg font-bold transition-all ${
                      formData.wouldRecommend === option
                        ? 'bg-gradient-to-br from-[#D4AF37] to-[#8B4513] text-white'
                        : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-white font-bold mb-3">
                O que mais chamou sua atenção no curso? (Opcional)
              </label>
              <textarea
                value={formData.whatCaughtAttention}
                onChange={e => updateField('whatCaughtAttention', e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white"
                rows={4}
                placeholder="Compartilhe sua opinião..."
              />
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-white mb-4">
              💡 Passo 2: Transformação
            </h2>

            <div>
              <label className="block text-white font-bold mb-3">
                Como estava sua situação financeira antes do curso?
              </label>
              <div className="grid grid-cols-2 gap-3">
                {['Endividado', 'Apertado', 'Estável', 'Confortável'].map(option => (
                  <button
                    key={option}
                    onClick={() => updateField('situationBefore', option)}
                    className={`py-3 rounded-lg font-bold transition-all ${
                      formData.situationBefore === option
                        ? 'bg-gradient-to-br from-[#D4AF37] to-[#8B4513] text-white'
                        : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-white font-bold mb-3">
                Após o curso, você tem mais clareza sobre como melhorar sua situação?
              </label>
              <div className="grid grid-cols-2 gap-3">
                {['Muito mais claro', 'Um pouco mais claro', 'Igual', 'Mais confuso'].map(option => (
                  <button
                    key={option}
                    onClick={() => updateField('clarityNow', option)}
                    className={`py-3 rounded-lg font-bold transition-all ${
                      formData.clarityNow === option
                        ? 'bg-gradient-to-br from-[#D4AF37] to-[#8B4513] text-white'
                        : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-white mb-4">
              🎯 Passo 3: Seus Interesses
            </h2>

            <div>
              <label className="block text-white font-bold mb-3">
                Você tem interesse em trabalhar com motos (delivery, transporte)?
              </label>
              <div className="grid grid-cols-3 gap-3">
                {['Sim', 'Talvez', 'Não'].map(option => (
                  <button
                    key={option}
                    onClick={() => updateField('interestMotos', option)}
                    className={`py-3 rounded-lg font-bold transition-all ${
                      formData.interestMotos === option
                        ? 'bg-gradient-to-br from-[#D4AF37] to-[#8B4513] text-white'
                        : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-white font-bold mb-3">
                Você tem interesse em crédito para empreender?
              </label>
              <div className="grid grid-cols-3 gap-3">
                {['Sim', 'Talvez', 'Não'].map(option => (
                  <button
                    key={option}
                    onClick={() => updateField('interestCredit', option)}
                    className={`py-3 rounded-lg font-bold transition-all ${
                      formData.interestCredit === option
                        ? 'bg-gradient-to-br from-[#D4AF37] to-[#8B4513] text-white'
                        : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-white mb-4">
              🚀 Passo 4: Prontidão para Ação
            </h2>

            <div>
              <label className="block text-white font-bold mb-3">
                Você começaria a dar os passos ensinados no curso agora?
              </label>
              <div className="grid grid-cols-3 gap-3">
                {['Sim', 'Talvez', 'Não'].map(option => (
                  <button
                    key={option}
                    onClick={() => updateField('wouldStartSteps', option)}
                    className={`py-3 rounded-lg font-bold transition-all ${
                      formData.wouldStartSteps === option
                        ? 'bg-gradient-to-br from-[#D4AF37] to-[#8B4513] text-white'
                        : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-white font-bold mb-3">
                Quanto você poderia investir para começar seu negócio?
              </label>
              <div className="grid grid-cols-2 gap-3">
                {['Até 500', '500-1k', '1k-3k', '+3k'].map(option => (
                  <button
                    key={option}
                    onClick={() => updateField('investmentAmount', option)}
                    className={`py-3 rounded-lg font-bold transition-all ${
                      formData.investmentAmount === option
                        ? 'bg-gradient-to-br from-[#D4AF37] to-[#8B4513] text-white'
                        : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                    }`}
                  >
                    R$ {option}
                  </button>
                ))}
              </div>
            </div>
          </div>
        );

      case 5:
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-white mb-4">
              🎓 Passo 5: Mentoria Personalizada
            </h2>

            <div className="bg-zinc-900 border border-[#D4AF37] rounded-lg p-6 mb-6">
              <p className="text-white text-lg">
                💡 <strong>Quer acelerar seus resultados?</strong>
              </p>
              <p className="text-zinc-400 mt-2">
                Oferecemos mentoria personalizada para te ajudar a implementar tudo que você aprendeu!
              </p>
            </div>

            <div>
              <label className="block text-white font-bold mb-3">
                Você teria interesse em uma mentoria online?
              </label>
              <div className="grid grid-cols-3 gap-3">
                {['Sim', 'Talvez', 'Não'].map(option => (
                  <button
                    key={option}
                    onClick={() => updateField('interestOnlineMentorship', option)}
                    className={`py-3 rounded-lg font-bold transition-all ${
                      formData.interestOnlineMentorship === option
                        ? 'bg-gradient-to-br from-[#D4AF37] to-[#8B4513] text-white'
                        : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-white font-bold mb-3">
                Você teria interesse em uma mentoria presencial?
              </label>
              <div className="grid grid-cols-3 gap-3">
                {['Sim', 'Talvez', 'Não'].map(option => (
                  <button
                    key={option}
                    onClick={() => updateField('interestPresentialMentorship', option)}
                    className={`py-3 rounded-lg font-bold transition-all ${
                      formData.interestPresentialMentorship === option
                        ? 'bg-gradient-to-br from-[#D4AF37] to-[#8B4513] text-white'
                        : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          </div>
        );

      case 6:
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-white mb-4">
              📞 Passo 6: Seus Dados de Contato
            </h2>

            <div className="bg-zinc-900 border border-[#D4AF37] rounded-lg p-6 mb-6">
              <p className="text-white text-lg">
                🎉 <strong>Quase lá!</strong>
              </p>
              <p className="text-zinc-400 mt-2">
                Deixe seus dados para que possamos entrar em contato e te ajudar a dar os próximos passos!
              </p>
            </div>

            <div>
              <label className="block text-white font-bold mb-2">Nome Completo *</label>
              <input
                type="text"
                value={formData.fullName}
                onChange={e => updateField('fullName', e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white"
                placeholder="Seu nome completo"
              />
            </div>

            <div>
              <label className="block text-white font-bold mb-2">WhatsApp *</label>
              <input
                type="tel"
                value={formData.whatsapp}
                onChange={e => updateField('whatsapp', e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white"
                placeholder="(00) 00000-0000"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-white font-bold mb-2">Cidade</label>
                <input
                  type="text"
                  value={formData.city}
                  onChange={e => updateField('city', e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white"
                  placeholder="Sua cidade"
                />
              </div>
              <div>
                <label className="block text-white font-bold mb-2">Estado</label>
                <input
                  type="text"
                  value={formData.state}
                  onChange={e => updateField('state', e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white"
                  placeholder="UF"
                  maxLength={2}
                />
              </div>
            </div>

            <div>
              <label className="block text-white font-bold mb-2">
                Sugestões ou comentários (Opcional)
              </label>
              <textarea
                value={formData.suggestions}
                onChange={e => updateField('suggestions', e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white"
                rows={4}
                placeholder="Deixe suas sugestões para melhorarmos..."
              />
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <div className="max-w-3xl mx-auto">
        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex justify-between mb-2">
            <span className="text-zinc-400 text-sm">Passo {currentStep} de 6</span>
            <span className="text-zinc-400 text-sm">{Math.round((currentStep / 6) * 100)}%</span>
          </div>
          <div className="w-full bg-zinc-800 rounded-full h-2">
            <div
              className="bg-gradient-to-r from-[#D4AF37] to-[#8B4513] h-2 rounded-full transition-all duration-300"
              style={{ width: `${(currentStep / 6) * 100}%` }}
            />
          </div>
        </div>

        {/* Form Content */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8">
          {renderStep()}

          {/* Navigation */}
          <div className="flex justify-between mt-8 pt-6 border-t border-zinc-800">
            {currentStep > 1 ? (
              <Button variant="secondary" onClick={handleBack}>
                <ChevronLeft size={20} className="mr-2" /> Voltar
              </Button>
            ) : (
              <div />
            )}

            {currentStep < 6 ? (
              <Button onClick={handleNext} disabled={!canProceed()}>
                Próximo <ChevronRight size={20} className="ml-2" />
              </Button>
            ) : (
              <Button onClick={handleSubmit} disabled={!canProceed() || submitting}>
                <Send size={20} className="mr-2" />
                {submitting ? 'Enviando...' : 'Finalizar'}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
