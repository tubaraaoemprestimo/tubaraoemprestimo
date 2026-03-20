import { useState, useEffect } from 'react';
import { Book, Plus, Edit2, Trash2, Video, FileText, Save, X } from 'lucide-react';
import { apiService } from '../../services/apiService';
import { useToast } from '../../components/Toast';
import { Button } from '../../components/Button';

interface Course {
  id: string;
  title: string;
  description: string;
  thumbnailUrl?: string;
  isPublished: boolean;
  order: number;
  modules: Module[];
}

interface Module {
  id: string;
  title: string;
  description: string;
  order: number;
  lessons: Lesson[];
}

interface Lesson {
  id: string;
  title: string;
  description: string;
  videoUrl: string;
  duration: number;
  order: number;
  materials: Material[];
}

interface Material {
  id: string;
  title: string;
  fileUrl: string;
  fileType: string;
}

export function CourseManager() {
  const { addToast } = useToast();

  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [editingModule, setEditingModule] = useState<Module | null>(null);
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);
  const [loading, setLoading] = useState(true);

  // Form states
  const [moduleForm, setModuleForm] = useState({ title: '', description: '' });
  const [lessonForm, setLessonForm] = useState({
    title: '',
    description: '',
    videoUrl: '',
    duration: 0
  });

  useEffect(() => {
    loadCourses();
  }, []);

  const loadCourses = async () => {
    try {
      const data = await apiService.getCourses();
      setCourses(data);
    } catch (err: any) {
      addToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveModule = async () => {
    if (!selectedCourse) return;

    try {
      if (editingModule) {
        await apiService.updateModule(editingModule.id, moduleForm);
        addToast('Módulo atualizado!', 'success');
      } else {
        await apiService.createModule(selectedCourse.id, moduleForm);
        addToast('Módulo criado!', 'success');
      }
      setModuleForm({ title: '', description: '' });
      setEditingModule(null);
      loadCourses();
    } catch (err: any) {
      addToast(err.message, 'error');
    }
  };

  const handleDeleteModule = async (moduleId: string) => {
    if (!confirm('Deseja realmente excluir este módulo?')) return;

    try {
      await apiService.deleteModule(moduleId);
      addToast('Módulo excluído!', 'success');
      loadCourses();
    } catch (err: any) {
      addToast(err.message, 'error');
    }
  };

  const handleSaveLesson = async (moduleId: string) => {
    try {
      if (editingLesson) {
        await apiService.updateLesson(editingLesson.id, lessonForm);
        addToast('Aula atualizada!', 'success');
      } else {
        await apiService.createLesson(moduleId, lessonForm);
        addToast('Aula criada!', 'success');
      }
      setLessonForm({ title: '', description: '', videoUrl: '', duration: 0 });
      setEditingLesson(null);
      loadCourses();
    } catch (err: any) {
      addToast(err.message, 'error');
    }
  };

  const handleDeleteLesson = async (lessonId: string) => {
    if (!confirm('Deseja realmente excluir esta aula?')) return;

    try {
      await apiService.deleteLesson(lessonId);
      addToast('Aula excluída!', 'success');
      loadCourses();
    } catch (err: any) {
      addToast(err.message, 'error');
    }
  };

  const handleTogglePublish = async (courseId: string, isPublished: boolean) => {
    try {
      await apiService.updateCourse(courseId, { isPublished: !isPublished });
      addToast(isPublished ? 'Curso despublicado' : 'Curso publicado!', 'success');
      loadCourses();
    } catch (err: any) {
      addToast(err.message, 'error');
    }
  };

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">📚 Gerenciamento de Cursos</h1>
            <p className="text-zinc-400">Método Tubarão - Controle total de módulos, aulas e materiais</p>
          </div>
          <Button onClick={() => {/* TODO: Create course modal */}}>
            <Plus size={20} className="mr-2" /> Novo Curso
          </Button>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <p className="text-zinc-400">Carregando cursos...</p>
          </div>
        ) : courses.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-zinc-400">Nenhum curso encontrado</p>
          </div>
        ) : (
          <div className="grid gap-6">
            {courses.map(course => (
              <div key={course.id} className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
                {/* Course Header */}
                <div className="flex items-start justify-between mb-6">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h2 className="text-2xl font-bold text-white">{course.title}</h2>
                      <span className={`px-3 py-1 rounded-full text-white text-sm font-bold ${
                        course.isPublished ? 'bg-green-600' : 'bg-zinc-600'
                      }`}>
                        {course.isPublished ? '✅ Publicado' : '⏸️ Rascunho'}
                      </span>
                    </div>
                    <p className="text-zinc-400">{course.description}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      onClick={() => handleTogglePublish(course.id, course.isPublished)}
                    >
                      {course.isPublished ? 'Despublicar' : 'Publicar'}
                    </Button>
                    <Button onClick={() => setSelectedCourse(course)}>
                      <Edit2 size={16} className="mr-2" /> Gerenciar
                    </Button>
                  </div>
                </div>

                {/* Course Stats */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-black rounded-lg p-4">
                    <p className="text-zinc-500 text-sm">Módulos</p>
                    <p className="text-2xl font-bold text-white">{course.modules.length}</p>
                  </div>
                  <div className="bg-black rounded-lg p-4">
                    <p className="text-zinc-500 text-sm">Aulas</p>
                    <p className="text-2xl font-bold text-white">
                      {course.modules.reduce((acc, m) => acc + m.lessons.length, 0)}
                    </p>
                  </div>
                  <div className="bg-black rounded-lg p-4">
                    <p className="text-zinc-500 text-sm">Duração Total</p>
                    <p className="text-2xl font-bold text-white">
                      {Math.round(
                        course.modules.reduce(
                          (acc, m) => acc + m.lessons.reduce((a, l) => a + l.duration, 0),
                          0
                        ) / 60
                      )}h
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Course Detail Modal */}
        {selectedCourse && (
          <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-6xl p-8 my-8">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-white mb-2">{selectedCourse.title}</h2>
                  <p className="text-zinc-400">{selectedCourse.description}</p>
                </div>
                <button
                  onClick={() => setSelectedCourse(null)}
                  className="text-zinc-400 hover:text-white text-2xl"
                >
                  ×
                </button>
              </div>

              {/* Add Module Form */}
              <div className="bg-black border border-zinc-700 rounded-lg p-6 mb-6">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <Plus size={20} /> {editingModule ? 'Editar Módulo' : 'Novo Módulo'}
                </h3>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <input
                    type="text"
                    value={moduleForm.title}
                    onChange={e => setModuleForm({ ...moduleForm, title: e.target.value })}
                    placeholder="Título do módulo"
                    className="bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2 text-white"
                  />
                  <input
                    type="text"
                    value={moduleForm.description}
                    onChange={e => setModuleForm({ ...moduleForm, description: e.target.value })}
                    placeholder="Descrição"
                    className="bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2 text-white"
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleSaveModule}>
                    <Save size={16} className="mr-2" /> Salvar Módulo
                  </Button>
                  {editingModule && (
                    <Button variant="secondary" onClick={() => {
                      setEditingModule(null);
                      setModuleForm({ title: '', description: '' });
                    }}>
                      <X size={16} className="mr-2" /> Cancelar
                    </Button>
                  )}
                </div>
              </div>

              {/* Modules List */}
              <div className="space-y-6">
                {selectedCourse.modules.map((module, moduleIndex) => (
                  <div key={module.id} className="bg-black border border-zinc-700 rounded-lg p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h3 className="text-xl font-bold text-white mb-1">
                          Módulo {moduleIndex + 1}: {module.title}
                        </h3>
                        <p className="text-zinc-400 text-sm">{module.description}</p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setEditingModule(module);
                            setModuleForm({ title: module.title, description: module.description });
                          }}
                          className="text-zinc-400 hover:text-white"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleDeleteModule(module.id)}
                          className="text-red-400 hover:text-red-300"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>

                    {/* Add Lesson Form */}
                    <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-4 mb-4">
                      <h4 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                        <Video size={16} /> {editingLesson ? 'Editar Aula' : 'Nova Aula'}
                      </h4>
                      <div className="grid grid-cols-2 gap-3 mb-3">
                        <input
                          type="text"
                          value={lessonForm.title}
                          onChange={e => setLessonForm({ ...lessonForm, title: e.target.value })}
                          placeholder="Título da aula"
                          className="bg-black border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm"
                        />
                        <input
                          type="text"
                          value={lessonForm.videoUrl}
                          onChange={e => setLessonForm({ ...lessonForm, videoUrl: e.target.value })}
                          placeholder="URL do vídeo"
                          className="bg-black border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm"
                        />
                        <input
                          type="text"
                          value={lessonForm.description}
                          onChange={e => setLessonForm({ ...lessonForm, description: e.target.value })}
                          placeholder="Descrição"
                          className="bg-black border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm"
                        />
                        <input
                          type="number"
                          value={lessonForm.duration}
                          onChange={e => setLessonForm({ ...lessonForm, duration: parseInt(e.target.value) })}
                          placeholder="Duração (minutos)"
                          className="bg-black border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button onClick={() => handleSaveLesson(module.id)} size="sm">
                          <Save size={14} className="mr-2" /> Salvar Aula
                        </Button>
                        {editingLesson && (
                          <Button variant="secondary" size="sm" onClick={() => {
                            setEditingLesson(null);
                            setLessonForm({ title: '', description: '', videoUrl: '', duration: 0 });
                          }}>
                            <X size={14} className="mr-2" /> Cancelar
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Lessons List */}
                    <div className="space-y-2">
                      {module.lessons.map((lesson, lessonIndex) => (
                        <div key={lesson.id} className="bg-zinc-900 border border-zinc-700 rounded-lg p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <Video size={16} className="text-[#D4AF37]" />
                                <h4 className="font-bold text-white">
                                  Aula {lessonIndex + 1}: {lesson.title}
                                </h4>
                                <span className="text-zinc-500 text-sm">({lesson.duration} min)</span>
                              </div>
                              <p className="text-zinc-400 text-sm mb-2">{lesson.description}</p>
                              <a
                                href={lesson.videoUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[#D4AF37] text-sm hover:underline"
                              >
                                🔗 {lesson.videoUrl}
                              </a>
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => {
                                  setEditingLesson(lesson);
                                  setLessonForm({
                                    title: lesson.title,
                                    description: lesson.description,
                                    videoUrl: lesson.videoUrl,
                                    duration: lesson.duration
                                  });
                                }}
                                className="text-zinc-400 hover:text-white"
                              >
                                <Edit2 size={14} />
                              </button>
                              <button
                                onClick={() => handleDeleteLesson(lesson.id)}
                                className="text-red-400 hover:text-red-300"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
