import { useState, useEffect } from 'react';
import {
  BookOpen, BarChart2, MessageCircle, Users, Phone, MessageSquare,
  Play, FileText, Trash2, Edit2, Plus, Save, X, Upload, RefreshCw,
  Send, CheckCircle, XCircle, Clock, TrendingUp, Eye, Settings
} from 'lucide-react';
import { apiService } from '../../services/apiService';
import { useToast } from '../../hooks/useToast';
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
  const [quizTemplate, setQuizTemplate] = useState<any>({
    step1: {
      title: 'Sua Experiência',
      questions: [
        { key: 'npsScore', label: 'Nota do curso (0-10)', type: 'scale', visible: true },
        { key: 'wouldRecommend', label: 'Recomendaria?', type: 'choice', options: ['Sim', 'Talvez', 'Não'], visible: true },
        { key: 'whatCaughtAttention', label: 'O que mais chamou atenção?', type: 'text', visible: true },
      ]
    },
    step2: {
      title: 'Transformação',
      questions: [
        { key: 'situationBefore', label: 'Situação antes do curso', type: 'choice', options: ['Endividado', 'Apertado', 'Estável', 'Confortável'], visible: true },
        { key: 'clarityNow', label: 'Clareza depois do curso', type: 'choice', options: ['Muito mais claro', 'Um pouco mais claro', 'Igual', 'Mais confuso'], visible: true },
      ]
    },
    step3: {
      title: 'Intenção',
      questions: [
        { key: 'interestMotos', label: 'Interesse em motos?', type: 'choice', options: ['Sim', 'Talvez', 'Não'], visible: true },
        { key: 'interestCredit', label: 'Interesse em crédito?', type: 'choice', options: ['Sim', 'Talvez', 'Não'], visible: true },
      ]
    },
    step4: {
      title: 'Qualificação',
      questions: [
        { key: 'wouldStartSteps', label: 'Começaria os passos?', type: 'choice', options: ['Sim', 'Talvez', 'Não'], visible: true },
        { key: 'investmentAmount', label: 'Quanto pode investir?', type: 'choice', options: ['Até 500', '500-1k', '1k-3k', '+3k'], visible: true },
      ]
    },
    step5: {
      title: 'Mentoria',
      questions: [
        { key: 'interestOnlineMentorship', label: 'Interesse mentoria online?', type: 'choice', options: ['Sim', 'Talvez', 'Não'], visible: true },
        { key: 'interestPresentialMentorship', label: 'Interesse mentoria presencial?', type: 'choice', options: ['Sim', 'Talvez', 'Não'], visible: true },
      ]
    },
    step6: {
      title: 'Contato',
      questions: [
        { key: 'fullName', label: 'Nome completo *', type: 'text', visible: true },
        { key: 'whatsapp', label: 'WhatsApp *', type: 'text', visible: true },
        { key: 'city', label: 'Cidade', type: 'text', visible: true },
        { key: 'state', label: 'Estado', type: 'text', visible: true },
        { key: 'suggestions', label: 'Sugestões (opcional)', type: 'text', visible: true },
      ]
    }
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
          const templates = await apiService.getWhatsappTemplates();
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
              <div>
                <h2 className="text-2xl font-bold mb-6">❓ Quiz & Lead Scoring</h2>

                {/* Quiz Steps Preview */}
                <div className="grid gap-4 mb-8">
                  {Object.entries(quizTemplate).map(([stepKey, stepData]: any) => (
                    <div key={stepKey} className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold text-white">
                          {stepKey.replace('step', 'Passo ')} — {stepData.title}
                        </h3>
                      </div>
                      <div className="space-y-3">
                        {stepData.questions.map((q: any, i: number) => (
                          <div key={i} className="flex items-center gap-4 bg-black border border-zinc-700 rounded-lg p-4">
                            <div className="flex-1">
                              <p className="text-white font-bold text-sm mb-1">{q.label}</p>
                              <div className="flex gap-2 text-xs text-zinc-500">
                                <span>Tipo: {q.type}</span>
                                {q.options && (
                                  <>
                                    <span>•</span>
                                    <span>Opções: {q.options.join(', ')}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Lead Scoring Thresholds */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 mb-8">
                  <h3 className="text-xl font-bold text-white mb-4">🎯 Regras de Lead Scoring</h3>
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="space-y-3">
                      <h4 className="text-zinc-400 font-bold text-sm uppercase">Pontuação por Resposta</h4>
                      {[
                        { label: 'NPS 8-10', points: '+30' },
                        { label: 'NPS 6-7', points: '+15' },
                        { label: 'Recomendaria (Sim)', points: '+20' },
                        { label: 'Quer mentoria', points: '+40 ⚠️ CRÍTICO' },
                        { label: 'Investimento +3k', points: '+30 ⚠️ CRÍTICO' },
                        { label: 'Investimento 1k-3k', points: '+25' },
                        { label: 'Começaria (Sim)', points: '+15' },
                        { label: 'Interesse produtos', points: '+10' },
                        { label: 'Clareza total', points: '+10' },
                        { label: 'Situação financeira ruim', points: '+5' },
                      ].map((rule, i) => (
                        <div key={i} className="flex items-center justify-between bg-black border border-zinc-700 rounded-lg px-4 py-3">
                          <span className="text-white text-sm">{rule.label}</span>
                          <span className="text-[#D4AF37] font-bold text-sm">{rule.points}</span>
                        </div>
                      ))}
                    </div>
                    <div className="space-y-3">
                      <h4 className="text-zinc-400 font-bold text-sm uppercase">Classificação Final</h4>
                      <div className="bg-red-900/20 border border-red-600 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-white font-bold">🔥 QUENTE (HOT)</span>
                          <span className="text-red-400 font-bold">Score ≥ 80</span>
                        </div>
                        <p className="text-zinc-400 text-sm">OU quer mentoria + investimento alto</p>
                        <p className="text-red-400 text-xs mt-2 font-bold">→ Notifica admin + Dispara WhatsApp em 3min</p>
                      </div>
                      <div className="bg-orange-900/20 border border-orange-600 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-white font-bold">⚠️ MORNO (WARM)</span>
                          <span className="text-orange-400 font-bold">Score 50-79</span>
                        </div>
                        <p className="text-zinc-400 text-sm">Interessado, precisa de nutrição</p>
                        <p className="text-orange-400 text-xs mt-2 font-bold">→ Dispara WhatsApp em 3min</p>
                      </div>
                      <div className="bg-blue-900/20 border border-blue-600 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-white font-bold">❄️ FRIO (COLD)</span>
                          <span className="text-blue-400 font-bold">Score &lt; 50</span>
                        </div>
                        <p className="text-zinc-400 text-sm">Sem interesse real</p>
                        <p className="text-blue-400 text-xs mt-2 font-bold">→ Salvo na base, sem disparo</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* WhatsApp Message Templates */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
                  <h3 className="text-xl font-bold text-white mb-4">📱 Templates de Mensagens WhatsApp</h3>
                  <p className="text-zinc-500 text-sm mb-6">Use <code className="bg-zinc-800 px-1 rounded">{'{nome}'}</code> para inserir o nome do cliente automaticamente</p>

                  <div className="space-y-6">
                    <div>
                      <label className="block text-red-400 font-bold mb-2">🔥 Lead QUENTE (HOT)</label>
                      <textarea
                        value={whatsappTemplates.HOT}
                        onChange={e => setWhatsappTemplates({ ...whatsappTemplates, HOT: e.target.value })}
                        className="w-full bg-black border border-red-600 rounded-lg px-4 py-3 text-white"
                        rows={6}
                      />
                    </div>

                    <div>
                      <label className="block text-orange-400 font-bold mb-2">⚠️ Lead MORNO (WARM)</label>
                      <textarea
                        value={whatsappTemplates.WARM}
                        onChange={e => setWhatsappTemplates({ ...whatsappTemplates, WARM: e.target.value })}
                        className="w-full bg-black border border-orange-600 rounded-lg px-4 py-3 text-white"
                        rows={6}
                      />
                    </div>

                    <div>
                      <label className="block text-blue-400 font-bold mb-2">❄️ Lead FRIO (COLD)</label>
                      <textarea
                        value={whatsappTemplates.COLD}
                        onChange={e => setWhatsappTemplates({ ...whatsappTemplates, COLD: e.target.value })}
                        className="w-full bg-black border border-blue-600 rounded-lg px-4 py-3 text-white"
                        rows={4}
                      />
                    </div>

                    <Button onClick={handleSaveTemplates} disabled={savingTemplates} className="w-full">
                      <Save size={20} className="mr-2" />
                      {savingTemplates ? 'Salvando...' : 'Salvar Templates'}
                    </Button>
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
                            </div>
                            <p className="text-zinc-300 mb-3">{comment.content}</p>
                            <p className="text-zinc-600 text-xs mb-4">
                              {new Date(comment.createdAt).toLocaleString('pt-BR')}
                            </p>

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
