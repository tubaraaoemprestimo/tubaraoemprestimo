import { useState, useEffect } from 'react';
import {
  BookOpen, BarChart2, MessageCircle, Users, Phone, MessageSquare,
  Play, FileText, Trash2, Edit2, Plus, Save, X, Upload, RefreshCw,
  Send, CheckCircle, XCircle, Clock, TrendingUp, Eye, Settings, Star, Pin, AlertCircle
} from 'lucide-react';
import { apiService } from '../../services/apiService';
import { useToast } from '../../components/Toast';
import { Button } from '../../components/Button';

type ActiveTab = 'courses' | 'quiz' | 'leads' | 'comments' | 'automation';

export function MetodoTubarao() {
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState<ActiveTab>('courses');

  // ============================
  // COURSES STATE
  // ============================
  const [courses, setCourses] = useState<any[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<any | null>(null);
  const [selectedModule, setSelectedModule] = useState<any | null>(null);
  const [lessonModal, setLessonModal] = useState<any | null>(null);
  const [uploading, setUploading] = useState(false);

  const [courseForm, setCourseForm] = useState({ title: '', description: '', thumbnailUrl: '' });
  const [moduleForm, setModuleForm] = useState({ title: '', description: '' });
  const [lessonForm, setLessonForm] = useState({ title: '', description: '', videoUrl: '', duration: 0 });

  // ============================
  // QUIZ STATE
  // ============================
  const [quizQuestions, setQuizQuestions] = useState<any[]>([]);
  const [scoringRules, setScoringRules] = useState<any[]>([]);
  const [editingQuestion, setEditingQuestion] = useState<any | null>(null);
  const [editingRule, setEditingRule] = useState<any | null>(null);
  const [questionForm, setQuestionForm] = useState({
    step: 1,
    question: '',
    type: 'choice' as 'scale' | 'choice' | 'text',
    options: [''],
    weight: 10,
    category: 'experience',
    order: 1
  });
  const [ruleForm, setRuleForm] = useState({
    condition: '',
    points: 0,
    description: ''
  });

  const [whatsappTemplates, setWhatsappTemplates] = useState({
    HOT: `Opa, *{nome}*! Tudo bem? Aqui é o Bruninho, da equipe VIP do Tubarão Empréstimos. Você tá podendo falar rapidinho?\n\nAcabei de ver suas respostas aqui na pesquisa do curso e seu perfil chamou muito a nossa atenção para a nossa Mentoria Exclusiva. Tenho uma janela na agenda hoje para te explicar como funciona.\n\nFica melhor eu te ligar de manhã ou de tarde?`,
    WARM: `Fala *{nome}*, aqui é o Bruninho da equipe do Tubarão Empréstimos! Parabéns por finalizar o curso!\n\nVi na sua pesquisa que você gostou muito do conteúdo, mas colocou que "talvez" participaria da mentoria. Qual foi a sua maior dúvida durante o curso que te deixou na incerteza de dar o próximo passo?\n\nQuero te ajudar a destravar isso!`,
    COLD: `Olá *{nome}*! Parabéns por concluir o Método Tubarão! 🦈\n\nObrigado pelo seu feedback. Qualquer dúvida, estamos à disposição!`
  });

  const [savingTemplates, setSavingTemplates] = useState(false);

  // ============================
  // LEADS STATE
  // ============================
  const [leads, setLeads] = useState<any[]>([]);
  const [leadFilter, setLeadFilter] = useState<'ALL' | 'HOT' | 'WARM' | 'COLD'>('HOT');
  const [selectedLead, setSelectedLead] = useState<any | null>(null);
  const [contactNotes, setContactNotes] = useState('');

  // ============================
  // COMMENTS STATE
  // ============================
  const [pendingComments, setPendingComments] = useState<any[]>([]);
  const [replyContent, setReplyContent] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [selectedComment, setSelectedComment] = useState<any | null>(null);
  const [commentPriority, setCommentPriority] = useState<number>(0);
  const [commentNotes, setCommentNotes] = useState<string>('');

  // ============================
  // AUTOMATION STATE
  // ============================
  const [automationLogs, setAutomationLogs] = useState<any[]>([]);
  const [automationStats, setAutomationStats] = useState<any>(null);
  const [testPhone, setTestPhone] = useState('');
  const [testName, setTestName] = useState('');
  const [testStatus, setTestStatus] = useState<'HOT' | 'WARM' | 'COLD'>('HOT');
  const [testing, setTesting] = useState(false);

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadTabData();
  }, [activeTab]);

  const loadTabData = async () => {
    setLoading(true);
    try {
      switch (activeTab) {
        case 'courses': {
          const coursesData = await apiService.getCourses();
          setCourses(coursesData || []);
          break;
        }
        case 'quiz': {
          const [questions, rules, templates] = await Promise.all([
            apiService.getQuizQuestions(),
            apiService.getScoringRules(),
            apiService.getWhatsappTemplates()
          ]);
          setQuizQuestions(questions || []);
          setScoringRules(rules || []);
          if (templates && (templates.HOT || templates.WARM || templates.COLD)) {
            setWhatsappTemplates(prev => ({
              HOT: templates.HOT || prev.HOT,
              WARM: templates.WARM || prev.WARM,
              COLD: templates.COLD || prev.COLD,
            }));
          }
          break;
        }
        case 'leads': {
          const leadsData = await apiService.getLeads(leadFilter === 'ALL' ? undefined : leadFilter);
          setLeads(leadsData || []);
          break;
        }
        case 'comments': {
          const commentsData = await apiService.getPendingComments();
          setPendingComments(commentsData || []);
          break;
        }
        case 'automation': {
          const [logsData, statsData] = await Promise.all([
            apiService.getAutomationLogs(),
            apiService.getAutomationStats()
          ]);
          setAutomationLogs(logsData || []);
          setAutomationStats(statsData);
          break;
        }
      }
    } catch (err: any) {
      addToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'leads') loadTabData();
  }, [leadFilter]);

  // ============================
  // COURSE HANDLERS
  // ============================

  const handleCreateModule = async () => {
    if (!selectedCourse || !moduleForm.title) return;
    try {
      await apiService.createModule(selectedCourse.id, moduleForm);
      addToast('Módulo criado!', 'success');
      setModuleForm({ title: '', description: '' });
      loadTabData();
    } catch (err: any) {
      addToast(err.message, 'error');
    }
  };

  const handleCreateLesson = async () => {
    if (!selectedModule || !lessonForm.title || !lessonForm.videoUrl) {
      addToast('Preencha título e URL do vídeo', 'warning');
      return;
    }
    try {
      await apiService.createLesson(selectedModule.id, lessonForm);
      addToast('Aula criada!', 'success');
      setLessonForm({ title: '', description: '', videoUrl: '', duration: 0 });
      setLessonModal(null);
      loadTabData();
    } catch (err: any) {
      addToast(err.message, 'error');
    }
  };

  const handleDeleteLesson = async (lessonId: string) => {
    if (!confirm('Excluir esta aula?')) return;
    try {
      await apiService.deleteLesson(lessonId);
      addToast('Aula excluída!', 'success');
      loadTabData();
    } catch (err: any) {
      addToast(err.message, 'error');
    }
  };

  const handleDeleteModule = async (moduleId: string) => {
    if (!confirm('Excluir este módulo e todas as aulas?')) return;
    try {
      await apiService.deleteModule(moduleId);
      addToast('Módulo excluído!', 'success');
      loadTabData();
    } catch (err: any) {
      addToast(err.message, 'error');
    }
  };

  // ============================
  // QUIZ HANDLERS
  // ============================

  const handleSaveTemplates = async () => {
    setSavingTemplates(true);
    try {
      await apiService.saveWhatsappTemplates(whatsappTemplates);
      addToast('Templates salvos!', 'success');
    } catch (err: any) {
      addToast(err.message, 'error');
    } finally {
      setSavingTemplates(false);
    }
  };

  // ============================
  // LEAD HANDLERS
  // ============================

  const handleMarkContacted = async () => {
    if (!selectedLead) return;
    try {
      await apiService.markLeadContacted(selectedLead.id, contactNotes);
      addToast('Marcado como contatado!', 'success');
      setSelectedLead(null);
      setContactNotes('');
      loadTabData();
    } catch (err: any) {
      addToast(err.message, 'error');
    }
  };

  // ============================
  // QUIZ HANDLERS
  // ============================

  const loadQuizData = async () => {
    try {
      const [questions, rules] = await Promise.all([
        apiService.getQuizQuestions(),
        apiService.getScoringRules()
      ]);
      setQuizQuestions(questions);
      setScoringRules(rules);
    } catch (err: any) {
      addToast(err.message, 'error');
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
    if (!confirm('Excluir esta pergunta?')) return;
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
    if (!confirm('Excluir esta regra?')) return;
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
      category: 'experience',
      order: 1
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

  // ============================
  // COMMENT HANDLERS
  // ============================

  const handleReply = async (commentId: string, lessonId: string) => {
    if (!replyContent.trim()) return;
    try {
      await apiService.createComment(lessonId, { content: replyContent, parentId: commentId });
      addToast('Resposta enviada!', 'success');
      setReplyContent('');
      setReplyingTo(null);
      loadTabData();
    } catch (err: any) {
      addToast(err.message, 'error');
    }
  };

  const handleRateComment = async (commentId: string, rating: number) => {
    try {
      await apiService.rateComment(commentId, rating);
      addToast('Avaliação salva!', 'success');
      loadTabData();
    } catch (err: any) {
      addToast(err.message, 'error');
    }
  };

  const handleSetPriority = async (commentId: string, priority: number) => {
    try {
      await apiService.setCommentPriority(commentId, priority);
      addToast('Prioridade atualizada!', 'success');
      loadTabData();
    } catch (err: any) {
      addToast(err.message, 'error');
    }
  };

  const handlePinComment = async (commentId: string, isPinned: boolean) => {
    try {
      await apiService.pinComment(commentId, isPinned);
      addToast(isPinned ? 'Comentário fixado!' : 'Comentário desfixado!', 'success');
      loadTabData();
    } catch (err: any) {
      addToast(err.message, 'error');
    }
  };

  const handleSaveAdminNotes = async (commentId: string, notes: string) => {
    try {
      await apiService.setAdminNotes(commentId, notes);
      addToast('Notas salvas!', 'success');
      loadTabData();
    } catch (err: any) {
      addToast(err.message, 'error');
    }
  };

  // ============================
  // AUTOMATION HANDLERS
  // ============================

  const handleTest = async () => {
    if (!testPhone || !testName) {
      addToast('Preencha nome e telefone', 'warning');
      return;
    }
    setTesting(true);
    try {
      await apiService.testAutomation(testPhone, testName, testStatus);
      addToast('Teste enviado! Aguarde 3 minutos.', 'success');
      setTestPhone('');
      setTestName('');
    } catch (err: any) {
      addToast(err.message, 'error');
    } finally {
      setTesting(false);
    }
  };

  const handleRetry = async (id: string) => {
    try {
      await apiService.retryAutomation(id);
      addToast('Mensagem reenviada!', 'success');
      loadTabData();
    } catch (err: any) {
      addToast(err.message, 'error');
    }
  };

  // ============================
  // RENDER
  // ============================

  const tabs = [
    { id: 'courses' as ActiveTab, label: '📚 Cursos', icon: BookOpen },
    { id: 'quiz' as ActiveTab, label: '❓ Quiz & Scoring', icon: Settings },
    { id: 'leads' as ActiveTab, label: '🎯 Leads', icon: Users },
    { id: 'comments' as ActiveTab, label: '💬 Comentários', icon: MessageCircle },
    { id: 'automation' as ActiveTab, label: '📱 WhatsApp', icon: Phone },
  ];

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="bg-zinc-950 border-b border-zinc-800 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">🦈 Método Tubarão</h1>
            <p className="text-zinc-400 text-sm">Administração Completa</p>
          </div>
          <div className="flex gap-2">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${
                  activeTab === tab.id
                    ? 'bg-gradient-to-br from-[#D4AF37] to-[#8B4513] text-white'
                    : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        {loading ? (
          <div className="text-center py-20">
            <div className="text-zinc-400">Carregando...</div>
          </div>
        ) : (
          <>
            {/* ==================== COURSES TAB ==================== */}
            {activeTab === 'courses' && (
              <div>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold">📚 Cursos e Aulas</h2>
                </div>

                {courses.map(course => (
                  <div key={course.id} className="bg-zinc-900 border border-zinc-800 rounded-lg mb-6">
                    {/* Course Header */}
                    <div className="p-6 border-b border-zinc-800">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-xl font-bold text-white">{course.title}</h3>
                          <p className="text-zinc-400 text-sm mt-1">{course.description}</p>
                          <div className="flex gap-4 mt-3 text-sm text-zinc-500">
                            <span>📦 {course.modules?.length || 0} módulos</span>
                            <span>🎬 {course.modules?.reduce((a: number, m: any) => a + (m.lessons?.length || 0), 0)} aulas</span>
                          </div>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                          course.isPublished ? 'bg-green-600 text-white' : 'bg-zinc-700 text-zinc-300'
                        }`}>
                          {course.isPublished ? '✅ Publicado' : '⏸️ Rascunho'}
                        </span>
                      </div>
                    </div>

                    {/* Modules */}
                    <div className="p-6">
                      {/* New Module Form */}
                      {selectedCourse?.id === course.id && (
                        <div className="bg-black border border-zinc-700 rounded-lg p-4 mb-4">
                          <p className="text-white font-bold mb-3">+ Novo Módulo</p>
                          <div className="grid grid-cols-2 gap-3 mb-3">
                            <input
                              type="text"
                              value={moduleForm.title}
                              onChange={e => setModuleForm({ ...moduleForm, title: e.target.value })}
                              placeholder="Título do módulo"
                              className="bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2 text-white text-sm"
                            />
                            <input
                              type="text"
                              value={moduleForm.description}
                              onChange={e => setModuleForm({ ...moduleForm, description: e.target.value })}
                              placeholder="Descrição"
                              className="bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2 text-white text-sm"
                            />
                          </div>
                          <div className="flex gap-2">
                            <Button onClick={handleCreateModule} size="sm">
                              <Save size={14} className="mr-2" /> Salvar
                            </Button>
                            <Button variant="secondary" size="sm" onClick={() => setSelectedCourse(null)}>
                              Cancelar
                            </Button>
                          </div>
                        </div>
                      )}

                      {course.modules?.map((module: any, mIdx: number) => (
                        <div key={module.id} className="border border-zinc-700 rounded-lg mb-4">
                          {/* Module Header */}
                          <div className="flex items-center justify-between p-4 bg-zinc-800 rounded-t-lg">
                            <div>
                              <span className="text-zinc-500 text-sm">Módulo {mIdx + 1}</span>
                              <h4 className="text-white font-bold">{module.title}</h4>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => {
                                  setSelectedModule(module);
                                  setLessonModal('new');
                                }}
                              >
                                <Plus size={14} className="mr-1" /> Aula
                              </Button>
                              <button
                                onClick={() => handleDeleteModule(module.id)}
                                className="text-red-400 hover:text-red-300 p-1"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>

                          {/* Lessons */}
                          <div className="p-4 space-y-2">
                            {module.lessons?.map((lesson: any, lIdx: number) => (
                              <div key={lesson.id} className="flex items-start gap-4 bg-black border border-zinc-700 rounded-lg p-4">
                                <div className="bg-zinc-800 rounded-lg p-3">
                                  <Play size={20} className="text-[#D4AF37]" />
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="text-zinc-500 text-xs">Aula {lIdx + 1}</span>
                                    <span className="text-zinc-500 text-xs">•</span>
                                    <span className="text-zinc-500 text-xs">{lesson.duration} min</span>
                                  </div>
                                  <h5 className="text-white font-bold mb-1">{lesson.title}</h5>
                                  <p className="text-zinc-400 text-sm mb-2">{lesson.description}</p>
                                  <a
                                    href={lesson.videoUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[#D4AF37] text-xs hover:underline truncate block max-w-md"
                                  >
                                    🔗 {lesson.videoUrl}
                                  </a>
                                  {lesson.materials?.length > 0 && (
                                    <div className="flex gap-2 mt-2">
                                      {lesson.materials.map((m: any) => (
                                        <span key={m.id} className="text-xs bg-zinc-800 px-2 py-1 rounded flex items-center gap-1">
                                          <FileText size={12} /> {m.title}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => {
                                      setSelectedModule(module);
                                      setLessonForm({
                                        title: lesson.title,
                                        description: lesson.description,
                                        videoUrl: lesson.videoUrl,
                                        duration: lesson.duration
                                      });
                                      setLessonModal(lesson.id);
                                    }}
                                    className="text-zinc-400 hover:text-white"
                                  >
                                    <Edit2 size={16} />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteLesson(lesson.id)}
                                    className="text-red-400 hover:text-red-300"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </div>
                              </div>
                            ))}

                            {(!module.lessons || module.lessons.length === 0) && (
                              <div className="text-center py-4">
                                <p className="text-zinc-500 text-sm">Nenhuma aula. Clique em "+ Aula" para adicionar.</p>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}

                      <Button
                        variant="secondary"
                        onClick={() => setSelectedCourse(course)}
                        className="w-full mt-2"
                      >
                        <Plus size={16} className="mr-2" /> Adicionar Módulo
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ==================== QUIZ & SCORING TAB ==================== */}
            {activeTab === 'quiz' && (
              <div className="grid grid-cols-2 gap-6">
                {/* LEFT COLUMN - Questions Management */}
                <div>
                  <h2 className="text-2xl font-bold mb-6">❓ Gerenciar Perguntas do Quiz</h2>

                  {/* Question Form */}
                  <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 mb-6">
                    <h3 className="text-lg font-bold text-white mb-4">
                      {editingQuestion ? '✏️ Editar Pergunta' : '➕ Nova Pergunta'}
                    </h3>

                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-zinc-400 text-sm mb-2">Passo (1-6)</label>
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
                          placeholder="Digite a pergunta..."
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
                                className="text-red-400 hover:text-red-300 px-3"
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
                    {[1, 2, 3, 4, 5, 6].map(step => {
                      const stepQuestions = quizQuestions.filter(q => q.step === step);
                      if (stepQuestions.length === 0) return null;

                      return (
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
                                          category: q.category,
                                          order: q.order || 1
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
                                    {q.options.map((opt: string, i: number) => (
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
                      );
                    })}
                  </div>
                </div>

                {/* RIGHT COLUMN - Scoring Rules & Templates */}
                <div>
                  <h2 className="text-2xl font-bold mb-6">🎯 Lead Scoring & Templates</h2>

                  {/* Scoring Rules */}
                  <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 mb-6">
                    <h3 className="text-lg font-bold text-white mb-4">
                      {editingRule ? '✏️ Editar Regra' : '➕ Nova Regra de Scoring'}
                    </h3>

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
                          Use: npsScore, wouldRecommend, investmentAmount, etc.
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

                  {/* Rules List */}
                  <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 mb-6">
                    <h3 className="text-lg font-bold text-white mb-4">Regras Ativas</h3>
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
                  <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 mb-6">
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

                  {/* WhatsApp Templates */}
                  <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
                    <h3 className="text-lg font-bold text-white mb-4">📱 Templates WhatsApp</h3>
                    <p className="text-zinc-500 text-sm mb-4">Use <code className="bg-zinc-800 px-1 rounded">{'{nome}'}</code> para nome do cliente</p>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-red-400 font-bold mb-2 text-sm">🔥 HOT</label>
                        <textarea
                          value={whatsappTemplates.HOT}
                          onChange={e => setWhatsappTemplates({ ...whatsappTemplates, HOT: e.target.value })}
                          className="w-full bg-black border border-red-600 rounded-lg px-4 py-2 text-white text-sm"
                          rows={4}
                        />
                      </div>

                      <div>
                        <label className="block text-orange-400 font-bold mb-2 text-sm">⚠️ WARM</label>
                        <textarea
                          value={whatsappTemplates.WARM}
                          onChange={e => setWhatsappTemplates({ ...whatsappTemplates, WARM: e.target.value })}
                          className="w-full bg-black border border-orange-600 rounded-lg px-4 py-2 text-white text-sm"
                          rows={4}
                        />
                      </div>

                      <div>
                        <label className="block text-blue-400 font-bold mb-2 text-sm">❄️ COLD</label>
                        <textarea
                          value={whatsappTemplates.COLD}
                          onChange={e => setWhatsappTemplates({ ...whatsappTemplates, COLD: e.target.value })}
                          className="w-full bg-black border border-blue-600 rounded-lg px-4 py-2 text-white text-sm"
                          rows={3}
                        />
                      </div>

                      <Button onClick={handleSaveTemplates} disabled={savingTemplates} className="w-full">
                        <Save size={16} className="mr-2" />
                        {savingTemplates ? 'Salvando...' : 'Salvar Templates'}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ==================== LEADS TAB ==================== */}
            {activeTab === 'leads' && (
              <div>
                <h2 className="text-2xl font-bold mb-6">🎯 Gestão de Leads</h2>

                {/* Filters */}
                <div className="flex gap-2 mb-6">
                  {(['HOT', 'WARM', 'COLD', 'ALL'] as const).map(status => (
                    <button
                      key={status}
                      onClick={() => setLeadFilter(status)}
                      className={`px-6 py-3 rounded-lg font-bold transition-all ${
                        leadFilter === status
                          ? 'bg-gradient-to-br from-[#D4AF37] to-[#8B4513] text-white'
                          : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800'
                      }`}
                    >
                      {status === 'HOT' && '🔥 '}
                      {status === 'WARM' && '⚠️ '}
                      {status === 'COLD' && '❄️ '}
                      {status}
                      {status !== 'ALL' && ` (${leads.filter(l => l.leadStatus === status).length})`}
                    </button>
                  ))}
                </div>

                <div className="grid gap-4">
                  {leads.map(lead => (
                    <div
                      key={lead.id}
                      className={`bg-zinc-900 border-2 rounded-lg p-6 cursor-pointer transition-all hover:border-[#D4AF37] ${
                        lead.leadStatus === 'HOT' ? 'border-red-600' : 'border-zinc-800'
                      }`}
                      onClick={() => setSelectedLead(lead)}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-3 mb-2">
                            <span className={`px-3 py-1 rounded-full text-white text-sm font-bold ${
                              lead.leadStatus === 'HOT' ? 'bg-red-600' :
                              lead.leadStatus === 'WARM' ? 'bg-orange-600' : 'bg-blue-600'
                            }`}>
                              {lead.leadStatus === 'HOT' ? '🔥' : lead.leadStatus === 'WARM' ? '⚠️' : '❄️'} {lead.leadStatus}
                            </span>
                            <span className="text-2xl font-bold text-white">{lead.leadScore}/100</span>
                            {lead.contactedAt && (
                              <span className="px-2 py-1 rounded bg-green-600 text-white text-xs font-bold">✅ Contatado</span>
                            )}
                          </div>
                          <h3 className="text-xl font-bold text-white mb-1">{lead.fullName}</h3>
                          <div className="flex gap-4 text-sm text-zinc-400">
                            <span>📱 {lead.whatsapp}</span>
                            <span>💰 R$ {lead.investmentAmount}</span>
                            <span>📚 Mentoria: {lead.interestPresentialMentorship === 'Sim' ? 'Presencial' : lead.interestOnlineMentorship === 'Sim' ? 'Online' : 'Talvez'}</span>
                          </div>
                        </div>
                        <div className="text-zinc-500 text-sm">
                          {new Date(lead.createdAt).toLocaleDateString('pt-BR')}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Lead Detail Modal */}
                {selectedLead && (
                  <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-2xl p-8">
                      <div className="flex items-start justify-between mb-6">
                        <div>
                          <h2 className="text-2xl font-bold text-white">{selectedLead.fullName}</h2>
                          <span className={`px-3 py-1 rounded-full text-white text-sm font-bold mt-2 inline-block ${
                            selectedLead.leadStatus === 'HOT' ? 'bg-red-600' :
                            selectedLead.leadStatus === 'WARM' ? 'bg-orange-600' : 'bg-blue-600'
                          }`}>
                            {selectedLead.leadStatus} — {selectedLead.leadScore}/100
                          </span>
                        </div>
                        <button onClick={() => setSelectedLead(null)} className="text-zinc-400 hover:text-white text-2xl">×</button>
                      </div>

                      <div className="grid grid-cols-2 gap-4 mb-6">
                        <div><p className="text-zinc-500 text-sm">WhatsApp</p><p className="text-white font-bold">{selectedLead.whatsapp}</p></div>
                        <div><p className="text-zinc-500 text-sm">Email</p><p className="text-white font-bold">{selectedLead.user?.email}</p></div>
                        <div><p className="text-zinc-500 text-sm">Localização</p><p className="text-white font-bold">{selectedLead.city || '-'}/{selectedLead.state || '-'}</p></div>
                        <div><p className="text-zinc-500 text-sm">Investimento</p><p className="text-white font-bold">R$ {selectedLead.investmentAmount}</p></div>
                        <div><p className="text-zinc-500 text-sm">NPS</p><p className="text-white font-bold">{selectedLead.npsScore}/10</p></div>
                        <div><p className="text-zinc-500 text-sm">Data</p><p className="text-white font-bold">{new Date(selectedLead.createdAt).toLocaleString('pt-BR')}</p></div>
                      </div>

                      {!selectedLead.contactedAt ? (
                        <div>
                          <label className="block text-white font-bold mb-2">Notas do Contato</label>
                          <textarea
                            value={contactNotes}
                            onChange={e => setContactNotes(e.target.value)}
                            className="w-full bg-black border border-zinc-700 rounded-lg px-4 py-3 text-white mb-4"
                            rows={3}
                            placeholder="Resultado do contato..."
                          />
                          <div className="flex gap-3">
                            <Button onClick={handleMarkContacted} className="flex-1">✅ Marcar como Contatado</Button>
                            <Button variant="secondary" onClick={() => setSelectedLead(null)}>Cancelar</Button>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-green-900/20 border border-green-600 rounded-lg p-4">
                          <p className="text-green-400 font-bold">✅ Contatado por {selectedLead.contactedBy}</p>
                          <p className="text-zinc-400 text-sm mt-1">{selectedLead.notes}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ==================== COMMENTS TAB ==================== */}
            {activeTab === 'comments' && (
              <div>
                <h2 className="text-2xl font-bold mb-6">💬 Comentários Pendentes ({pendingComments.length})</h2>

                {pendingComments.length === 0 ? (
                  <div className="text-center py-12">
                    <CheckCircle size={48} className="text-green-500 mx-auto mb-4" />
                    <p className="text-zinc-400">Todos os comentários foram respondidos!</p>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {pendingComments.map(comment => (
                      <div key={comment.id} className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
                        <div className="flex items-start gap-4">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#D4AF37] to-[#8B4513] flex items-center justify-center text-white font-bold flex-shrink-0">
                            {comment.user?.name?.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-white font-bold">{comment.user?.name}</span>
                              <span className="text-zinc-500 text-sm">•</span>
                              <span className="text-zinc-500 text-sm">
                                {comment.lesson?.module?.title} › {comment.lesson?.title}
                              </span>
                              {comment.isPinned && (
                                <span className="ml-2 px-2 py-0.5 bg-yellow-600 text-white text-xs rounded-full flex items-center gap-1">
                                  <Pin size={10} /> Fixado
                                </span>
                              )}
                              {comment.priority > 0 && (
                                <span className="ml-2 px-2 py-0.5 bg-red-600 text-white text-xs rounded-full flex items-center gap-1">
                                  <AlertCircle size={10} /> P{comment.priority}
                                </span>
                              )}
                            </div>
                            <p className="text-zinc-300 mb-3">{comment.content}</p>

                            {/* Rating Display */}
                            {comment.rating > 0 && (
                              <div className="flex items-center gap-2 mb-2">
                                <div className="flex">
                                  {[1, 2, 3, 4, 5].map(star => (
                                    <Star
                                      key={star}
                                      size={14}
                                      className={star <= comment.rating ? 'text-yellow-500 fill-yellow-500' : 'text-zinc-600'}
                                    />
                                  ))}
                                </div>
                                <span className="text-zinc-500 text-xs">({comment.ratingCount} avaliações)</span>
                              </div>
                            )}

                            <p className="text-zinc-600 text-xs mb-4">
                              {new Date(comment.createdAt).toLocaleString('pt-BR')}
                            </p>

                            {/* Admin Controls */}
                            <div className="flex flex-wrap gap-2 mb-4">
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => {
                                  setSelectedComment(comment);
                                  setCommentPriority(comment.priority || 0);
                                  setCommentNotes(comment.adminNotes || '');
                                }}
                              >
                                <Settings size={14} className="mr-1" /> Gerenciar
                              </Button>
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => handlePinComment(comment.id, !comment.isPinned)}
                              >
                                <Pin size={14} className="mr-1" /> {comment.isPinned ? 'Desafixar' : 'Fixar'}
                              </Button>
                            </div>

                            {replyingTo === comment.id ? (
                              <div>
                                <textarea
                                  value={replyContent}
                                  onChange={e => setReplyContent(e.target.value)}
                                  placeholder="Sua resposta..."
                                  className="w-full bg-black border border-zinc-700 rounded-lg px-4 py-2 text-white mb-2"
                                  rows={3}
                                />
                                <div className="flex gap-2">
                                  <Button onClick={() => handleReply(comment.id, comment.lesson?.id)} size="sm">
                                    <Send size={14} className="mr-2" /> Responder
                                  </Button>
                                  <Button variant="secondary" size="sm" onClick={() => {
                                    setReplyingTo(null);
                                    setReplyContent('');
                                  }}>
                                    Cancelar
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <Button size="sm" onClick={() => setReplyingTo(comment.id)}>
                                <MessageCircle size={14} className="mr-2" /> Responder
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Comment Management Modal */}
                {selectedComment && (
                  <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-2xl p-6">
                      <div className="flex items-center justify-between mb-6">
                        <h3 className="text-xl font-bold text-white">Gerenciar Comentário</h3>
                        <button onClick={() => setSelectedComment(null)} className="text-zinc-400 hover:text-white">
                          <X size={24} />
                        </button>
                      </div>

                      <div className="space-y-6">
                        {/* User Rating */}
                        <div>
                          <label className="block text-sm font-bold text-white mb-2">Avaliar Comentário</label>
                          <div className="flex gap-2">
                            {[1, 2, 3, 4, 5].map(star => (
                              <button
                                key={star}
                                onClick={() => handleRateComment(selectedComment.id, star)}
                                className="transition-transform hover:scale-110"
                              >
                                <Star
                                  size={32}
                                  className={star <= (selectedComment.rating || 0) ? 'text-yellow-500 fill-yellow-500' : 'text-zinc-600 hover:text-yellow-500'}
                                />
                              </button>
                            ))}
                          </div>
                          {selectedComment.ratingCount > 0 && (
                            <p className="text-zinc-500 text-sm mt-2">
                              Média: {selectedComment.rating.toFixed(1)} ({selectedComment.ratingCount} avaliações)
                            </p>
                          )}
                        </div>

                        {/* Priority */}
                        <div>
                          <label className="block text-sm font-bold text-white mb-2">
                            Prioridade (0-10): {commentPriority}
                          </label>
                          <input
                            type="range"
                            min="0"
                            max="10"
                            value={commentPriority}
                            onChange={e => setCommentPriority(parseInt(e.target.value))}
                            className="w-full"
                          />
                          <div className="flex justify-between text-xs text-zinc-500 mt-1">
                            <span>Baixa</span>
                            <span>Média</span>
                            <span>Alta</span>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => handleSetPriority(selectedComment.id, commentPriority)}
                            className="mt-2"
                          >
                            Salvar Prioridade
                          </Button>
                        </div>

                        {/* Admin Notes */}
                        <div>
                          <label className="block text-sm font-bold text-white mb-2">Notas Internas (Admin)</label>
                          <textarea
                            value={commentNotes}
                            onChange={e => setCommentNotes(e.target.value)}
                            placeholder="Notas privadas sobre este comentário..."
                            className="w-full bg-black border border-zinc-700 rounded-lg px-4 py-2 text-white"
                            rows={4}
                          />
                          <Button
                            size="sm"
                            onClick={() => handleSaveAdminNotes(selectedComment.id, commentNotes)}
                            className="mt-2"
                          >
                            Salvar Notas
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ==================== AUTOMATION TAB ==================== */}
            {activeTab === 'automation' && (
              <div>
                <h2 className="text-2xl font-bold mb-6">📱 Automação WhatsApp</h2>

                {/* Stats */}
                {automationStats && (
                  <div className="grid grid-cols-5 gap-4 mb-6">
                    {[
                      { label: 'Total', value: automationStats.total, color: 'border-zinc-600', text: 'text-white' },
                      { label: '✅ Enviadas', value: automationStats.sent, color: 'border-green-600', text: 'text-green-500' },
                      { label: '❌ Falhadas', value: automationStats.failed, color: 'border-red-600', text: 'text-red-500' },
                      { label: '⏰ Pendentes', value: automationStats.pending, color: 'border-yellow-600', text: 'text-yellow-500' },
                      { label: 'Taxa Sucesso', value: automationStats.successRate, color: 'border-[#D4AF37]', text: 'text-[#D4AF37]' },
                    ].map((stat, i) => (
                      <div key={i} className={`bg-zinc-900 border ${stat.color} rounded-lg p-5`}>
                        <p className="text-zinc-400 text-sm mb-1">{stat.label}</p>
                        <p className={`text-3xl font-bold ${stat.text}`}>{stat.value}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Test Form */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 mb-6">
                  <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <Send size={20} /> Testar Envio Manual
                  </h3>
                  <div className="grid grid-cols-4 gap-4">
                    <input
                      type="text"
                      value={testName}
                      onChange={e => setTestName(e.target.value)}
                      placeholder="Nome do cliente"
                      className="bg-black border border-zinc-700 rounded-lg px-4 py-2 text-white"
                    />
                    <input
                      type="tel"
                      value={testPhone}
                      onChange={e => setTestPhone(e.target.value)}
                      placeholder="(11) 99999-9999"
                      className="bg-black border border-zinc-700 rounded-lg px-4 py-2 text-white"
                    />
                    <select
                      value={testStatus}
                      onChange={e => setTestStatus(e.target.value as any)}
                      className="bg-black border border-zinc-700 rounded-lg px-4 py-2 text-white"
                    >
                      <option value="HOT">🔥 Lead Quente</option>
                      <option value="WARM">⚠️ Lead Morno</option>
                      <option value="COLD">❄️ Lead Frio</option>
                    </select>
                    <Button onClick={handleTest} disabled={testing}>
                      {testing ? 'Enviando...' : 'Enviar Teste'}
                    </Button>
                  </div>
                  <p className="text-zinc-500 text-xs mt-2">⏰ Mensagem enviada após 3 minutos</p>
                </div>

                {/* Logs */}
                <div className="grid gap-3">
                  {automationLogs.map(log => (
                    <div key={log.id} className="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          {log.status === 'SENT' && <CheckCircle size={20} className="text-green-500" />}
                          {log.status === 'FAILED' && <XCircle size={20} className="text-red-500" />}
                          {log.status === 'PENDING' && <Clock size={20} className="text-yellow-500" />}
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                                log.status === 'SENT' ? 'bg-green-600' :
                                log.status === 'FAILED' ? 'bg-red-600' : 'bg-yellow-600'
                              } text-white`}>{log.status}</span>
                              <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                                log.leadStatus === 'HOT' ? 'bg-red-600' :
                                log.leadStatus === 'WARM' ? 'bg-orange-600' : 'bg-blue-600'
                              } text-white`}>{log.leadStatus}</span>
                              <span className="text-white font-bold">{log.clientName}</span>
                              <span className="text-zinc-500 text-sm">|</span>
                              <span className="text-zinc-400 text-sm">{log.phone}</span>
                            </div>
                            <span className="text-zinc-500 text-xs">{new Date(log.createdAt).toLocaleString('pt-BR')}</span>
                            {log.error && <p className="text-red-400 text-xs mt-1">Erro: {log.error}</p>}
                          </div>
                        </div>
                        {log.status === 'FAILED' && (
                          <Button size="sm" variant="secondary" onClick={() => handleRetry(log.id)}>
                            <RefreshCw size={14} className="mr-2" /> Reenviar
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Lesson Modal */}
      {lessonModal && selectedModule && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-2xl p-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white">
                {lessonModal === 'new' ? '+ Nova Aula' : '✏️ Editar Aula'} — {selectedModule.title}
              </h3>
              <button onClick={() => {
                setLessonModal(null);
                setLessonForm({ title: '', description: '', videoUrl: '', duration: 0 });
              }} className="text-zinc-400 hover:text-white text-2xl">×</button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-zinc-400 text-sm mb-2">Título *</label>
                <input
                  type="text"
                  value={lessonForm.title}
                  onChange={e => setLessonForm({ ...lessonForm, title: e.target.value })}
                  className="w-full bg-black border border-zinc-700 rounded-lg px-4 py-3 text-white"
                  placeholder="Ex: Introdução ao Método Tubarão"
                />
              </div>

              <div>
                <label className="block text-zinc-400 text-sm mb-2">URL do Vídeo *</label>
                <input
                  type="text"
                  value={lessonForm.videoUrl}
                  onChange={e => setLessonForm({ ...lessonForm, videoUrl: e.target.value })}
                  className="w-full bg-black border border-zinc-700 rounded-lg px-4 py-3 text-white"
                  placeholder="https://..."
                />
                <p className="text-zinc-500 text-xs mt-1">
                  Suporta: MP4 direto, YouTube, Vimeo, Google Drive, Panda Video, etc.
                </p>
              </div>

              <div>
                <label className="block text-zinc-400 text-sm mb-2">Descrição</label>
                <textarea
                  value={lessonForm.description}
                  onChange={e => setLessonForm({ ...lessonForm, description: e.target.value })}
                  className="w-full bg-black border border-zinc-700 rounded-lg px-4 py-3 text-white"
                  rows={3}
                  placeholder="Descrição da aula..."
                />
              </div>

              <div>
                <label className="block text-zinc-400 text-sm mb-2">Duração (minutos)</label>
                <input
                  type="number"
                  value={lessonForm.duration}
                  onChange={e => setLessonForm({ ...lessonForm, duration: parseInt(e.target.value) || 0 })}
                  className="w-full bg-black border border-zinc-700 rounded-lg px-4 py-3 text-white"
                  placeholder="30"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <Button onClick={handleCreateLesson} className="flex-1">
                  <Save size={20} className="mr-2" /> Salvar Aula
                </Button>
                <Button variant="secondary" onClick={() => {
                  setLessonModal(null);
                  setLessonForm({ title: '', description: '', videoUrl: '', duration: 0 });
                }}>
                  Cancelar
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
