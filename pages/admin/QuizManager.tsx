import { useState, useEffect } from 'react';
import { HelpCircle, Plus, Edit2, Trash2, Save, X, TrendingUp, Settings } from 'lucide-react';
import { apiService } from '../../services/apiService';
import { useToast } from '../../components/Toast';
import { Button } from '../../components/Button';

interface QuizQuestion {
  id: string;
  step: number;
  question: string;
  type: 'scale' | 'choice' | 'text';
  options?: string[];
  weight: number;
  category: string;
}

interface ScoringRule {
  id: string;
  condition: string;
  points: number;
  description: string;
}

export function QuizManager() {
  const { addToast } = useToast();

  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [scoringRules, setScoringRules] = useState<ScoringRule[]>([]);
  const [editingQuestion, setEditingQuestion] = useState<QuizQuestion | null>(null);
  const [editingRule, setEditingRule] = useState<ScoringRule | null>(null);
  const [loading, setLoading] = useState(true);

  // Form states
  const [questionForm, setQuestionForm] = useState({
    step: 1,
    question: '',
    type: 'choice' as 'scale' | 'choice' | 'text',
    options: [''],
    weight: 10,
    category: 'experience'
  });

  const [ruleForm, setRuleForm] = useState({
    condition: '',
    points: 0,
    description: ''
  });

  useEffect(() => {
    loadQuizData();
  }, []);

  const loadQuizData = async () => {
    try {
      const [questionsData, rulesData] = await Promise.all([
        apiService.getQuizQuestions(),
        apiService.getScoringRules()
      ]);
      setQuestions(questionsData);
      setScoringRules(rulesData);
    } catch (err: any) {
      addToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveQuestion = async () => {
    try {
      if (editingQuestion) {
        await apiService.updateQuizQuestion(editingQuestion.id, questionForm);
        addToast('Pergunta atualizada!', 'success');
      } else {
        await apiService.createQuizQuestion(questionForm);
        addToast('Pergunta criada!', 'success');
      }
      resetQuestionForm();
      loadQuizData();
    } catch (err: any) {
      addToast(err.message, 'error');
    }
  };

  const handleDeleteQuestion = async (id: string) => {
    if (!confirm('Deseja realmente excluir esta pergunta?')) return;

    try {
      await apiService.deleteQuizQuestion(id);
      addToast('Pergunta excluída!', 'success');
      loadQuizData();
    } catch (err: any) {
      addToast(err.message, 'error');
    }
  };

  const handleSaveRule = async () => {
    try {
      if (editingRule) {
        await apiService.updateScoringRule(editingRule.id, ruleForm);
        addToast('Regra atualizada!', 'success');
      } else {
        await apiService.createScoringRule(ruleForm);
        addToast('Regra criada!', 'success');
      }
      resetRuleForm();
      loadQuizData();
    } catch (err: any) {
      addToast(err.message, 'error');
    }
  };

  const handleDeleteRule = async (id: string) => {
    if (!confirm('Deseja realmente excluir esta regra?')) return;

    try {
      await apiService.deleteScoringRule(id);
      addToast('Regra excluída!', 'success');
      loadQuizData();
    } catch (err: any) {
      addToast(err.message, 'error');
    }
  };

  const resetQuestionForm = () => {
    setQuestionForm({
      step: 1,
      question: '',
      type: 'choice',
      options: [''],
      weight: 10,
      category: 'experience'
    });
    setEditingQuestion(null);
  };

  const resetRuleForm = () => {
    setRuleForm({
      condition: '',
      points: 0,
      description: ''
    });
    setEditingRule(null);
  };

  const addOption = () => {
    setQuestionForm({
      ...questionForm,
      options: [...(questionForm.options || []), '']
    });
  };

  const updateOption = (index: number, value: string) => {
    const newOptions = [...(questionForm.options || [])];
    newOptions[index] = value;
    setQuestionForm({ ...questionForm, options: newOptions });
  };

  const removeOption = (index: number) => {
    const newOptions = questionForm.options?.filter((_, i) => i !== index);
    setQuestionForm({ ...questionForm, options: newOptions });
  };

  const groupedQuestions = questions.reduce((acc, q) => {
    if (!acc[q.step]) acc[q.step] = [];
    acc[q.step].push(q);
    return acc;
  }, {} as Record<number, QuizQuestion[]>);

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">❓ Gerenciamento de Quiz</h1>
          <p className="text-zinc-400">Configure perguntas e regras de Lead Scoring</p>
        </div>

        <div className="grid grid-cols-2 gap-6">
          {/* Questions Section */}
          <div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 mb-6">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <HelpCircle size={20} /> {editingQuestion ? 'Editar Pergunta' : 'Nova Pergunta'}
              </h2>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-zinc-400 text-sm mb-2">Passo</label>
                    <input
                      type="number"
                      value={questionForm.step}
                      onChange={e => setQuestionForm({ ...questionForm, step: parseInt(e.target.value) })}
                      className="w-full bg-black border border-zinc-700 rounded-lg px-4 py-2 text-white"
                      min="1"
                      max="6"
                    />
                  </div>
                  <div>
                    <label className="block text-zinc-400 text-sm mb-2">Tipo</label>
                    <select
                      value={questionForm.type}
                      onChange={e => setQuestionForm({ ...questionForm, type: e.target.value as any })}
                      className="w-full bg-black border border-zinc-700 rounded-lg px-4 py-2 text-white"
                    >
                      <option value="scale">Escala (0-10)</option>
                      <option value="choice">Múltipla Escolha</option>
                      <option value="text">Texto Livre</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-zinc-400 text-sm mb-2">Pergunta</label>
                  <textarea
                    value={questionForm.question}
                    onChange={e => setQuestionForm({ ...questionForm, question: e.target.value })}
                    className="w-full bg-black border border-zinc-700 rounded-lg px-4 py-2 text-white"
                    rows={3}
                  />
                </div>

                {questionForm.type === 'choice' && (
                  <div>
                    <label className="block text-zinc-400 text-sm mb-2">Opções</label>
                    {questionForm.options?.map((option, index) => (
                      <div key={index} className="flex gap-2 mb-2">
                        <input
                          type="text"
                          value={option}
                          onChange={e => updateOption(index, e.target.value)}
                          placeholder={`Opção ${index + 1}`}
                          className="flex-1 bg-black border border-zinc-700 rounded-lg px-4 py-2 text-white"
                        />
                        <button
                          onClick={() => removeOption(index)}
                          className="text-red-400 hover:text-red-300"
                        >
                          <X size={20} />
                        </button>
                      </div>
                    ))}
                    <Button variant="secondary" onClick={addOption} size="sm">
                      <Plus size={16} className="mr-2" /> Adicionar Opção
                    </Button>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-zinc-400 text-sm mb-2">Peso (Pontos)</label>
                    <input
                      type="number"
                      value={questionForm.weight}
                      onChange={e => setQuestionForm({ ...questionForm, weight: parseInt(e.target.value) })}
                      className="w-full bg-black border border-zinc-700 rounded-lg px-4 py-2 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-zinc-400 text-sm mb-2">Categoria</label>
                    <select
                      value={questionForm.category}
                      onChange={e => setQuestionForm({ ...questionForm, category: e.target.value })}
                      className="w-full bg-black border border-zinc-700 rounded-lg px-4 py-2 text-white"
                    >
                      <option value="experience">Experiência</option>
                      <option value="transformation">Transformação</option>
                      <option value="intention">Intenção</option>
                      <option value="qualification">Qualificação</option>
                      <option value="sales">Venda Direta</option>
                      <option value="contact">Contato</option>
                    </select>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button onClick={handleSaveQuestion}>
                    <Save size={16} className="mr-2" /> Salvar Pergunta
                  </Button>
                  {editingQuestion && (
                    <Button variant="secondary" onClick={resetQuestionForm}>
                      <X size={16} className="mr-2" /> Cancelar
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Questions List */}
            <div className="space-y-4">
              {Object.entries(groupedQuestions).map(([step, stepQuestions]) => (
                <div key={step} className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
                  <h3 className="text-lg font-bold text-white mb-4">Passo {step}</h3>
                  <div className="space-y-3">
                    {stepQuestions.map(q => (
                      <div key={q.id} className="bg-black border border-zinc-700 rounded-lg p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <p className="text-white font-bold mb-1">{q.question}</p>
                            <div className="flex gap-2 text-sm">
                              <span className="text-zinc-500">Tipo: {q.type}</span>
                              <span className="text-zinc-500">•</span>
                              <span className="text-[#D4AF37]">Peso: {q.weight} pts</span>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                setEditingQuestion(q);
                                setQuestionForm({
                                  step: q.step,
                                  question: q.question,
                                  type: q.type,
                                  options: q.options || [''],
                                  weight: q.weight,
                                  category: q.category
                                });
                              }}
                              className="text-zinc-400 hover:text-white"
                            >
                              <Edit2 size={16} />
                            </button>
                            <button
                              onClick={() => handleDeleteQuestion(q.id)}
                              className="text-red-400 hover:text-red-300"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                        {q.options && q.options.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {q.options.map((opt, i) => (
                              <span key={i} className="bg-zinc-800 px-2 py-1 rounded text-xs text-zinc-400">
                                {opt}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Scoring Rules Section */}
          <div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 mb-6">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <TrendingUp size={20} /> {editingRule ? 'Editar Regra' : 'Nova Regra de Scoring'}
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-zinc-400 text-sm mb-2">Condição</label>
                  <input
                    type="text"
                    value={ruleForm.condition}
                    onChange={e => setRuleForm({ ...ruleForm, condition: e.target.value })}
                    placeholder="Ex: npsScore >= 8"
                    className="w-full bg-black border border-zinc-700 rounded-lg px-4 py-2 text-white"
                  />
                  <p className="text-zinc-600 text-xs mt-1">
                    Use: npsScore, wouldRecommend, investmentAmount, interestOnlineMentorship, etc.
                  </p>
                </div>

                <div>
                  <label className="block text-zinc-400 text-sm mb-2">Pontos</label>
                  <input
                    type="number"
                    value={ruleForm.points}
                    onChange={e => setRuleForm({ ...ruleForm, points: parseInt(e.target.value) })}
                    className="w-full bg-black border border-zinc-700 rounded-lg px-4 py-2 text-white"
                  />
                </div>

                <div>
                  <label className="block text-zinc-400 text-sm mb-2">Descrição</label>
                  <textarea
                    value={ruleForm.description}
                    onChange={e => setRuleForm({ ...ruleForm, description: e.target.value })}
                    placeholder="Ex: NPS excelente (8-10)"
                    className="w-full bg-black border border-zinc-700 rounded-lg px-4 py-2 text-white"
                    rows={2}
                  />
                </div>

                <div className="flex gap-2">
                  <Button onClick={handleSaveRule}>
                    <Save size={16} className="mr-2" /> Salvar Regra
                  </Button>
                  {editingRule && (
                    <Button variant="secondary" onClick={resetRuleForm}>
                      <X size={16} className="mr-2" /> Cancelar
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Scoring Rules List */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Settings size={20} /> Regras Ativas
              </h3>
              <div className="space-y-3">
                {scoringRules.map(rule => (
                  <div key={rule.id} className="bg-black border border-zinc-700 rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[#D4AF37] font-bold">+{rule.points} pts</span>
                          <span className="text-zinc-500">•</span>
                          <code className="text-sm text-zinc-400 bg-zinc-900 px-2 py-1 rounded">
                            {rule.condition}
                          </code>
                        </div>
                        <p className="text-white text-sm">{rule.description}</p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setEditingRule(rule);
                            setRuleForm({
                              condition: rule.condition,
                              points: rule.points,
                              description: rule.description
                            });
                          }}
                          className="text-zinc-400 hover:text-white"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleDeleteRule(rule.id)}
                          className="text-red-400 hover:text-red-300"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Scoring Thresholds */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 mt-6">
              <h3 className="text-lg font-bold text-white mb-4">🎯 Limites de Classificação</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between bg-red-900/20 border border-red-600 rounded-lg p-4">
                  <div>
                    <p className="text-white font-bold">🔥 Lead QUENTE (HOT)</p>
                    <p className="text-zinc-400 text-sm">Score ≥ 80 ou (Mentoria + Investimento Alto)</p>
                  </div>
                  <span className="text-2xl font-bold text-red-500">80+</span>
                </div>
                <div className="flex items-center justify-between bg-orange-900/20 border border-orange-600 rounded-lg p-4">
                  <div>
                    <p className="text-white font-bold">⚠️ Lead MORNO (WARM)</p>
                    <p className="text-zinc-400 text-sm">Score ≥ 50</p>
                  </div>
                  <span className="text-2xl font-bold text-orange-500">50-79</span>
                </div>
                <div className="flex items-center justify-between bg-blue-900/20 border border-blue-600 rounded-lg p-4">
                  <div>
                    <p className="text-white font-bold">❄️ Lead FRIO (COLD)</p>
                    <p className="text-zinc-400 text-sm">Score &lt; 50</p>
                  </div>
                  <span className="text-2xl font-bold text-blue-500">0-49</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
