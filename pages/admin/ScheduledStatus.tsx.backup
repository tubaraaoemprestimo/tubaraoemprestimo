import React, { useEffect, useState } from 'react';
import { Calendar, Clock, Image, Video, Link as LinkIcon, Type, Sparkles, Plus, Trash2, Edit, Play, Pause } from 'lucide-react';
import { Button } from '../../components/Button';
import { useToast } from '../../components/Toast';
import { apiService } from '../../services/apiService';

type MediaType = 'IMAGE' | 'VIDEO' | 'LINK' | 'TEXT';
type RecurrenceType = 'ONCE' | 'DAILY' | 'WEEKLY' | 'CUSTOM';
type StatusType = 'SCHEDULED' | 'POSTED' | 'FAILED' | 'CANCELLED';

type ScheduledStatusItem = {
  id: string;
  title: string;
  content: string;
  mediaType: MediaType;
  mediaUrl: string | null;
  caption: string | null;
  aiGeneratedCaption: boolean;
  recurrence: RecurrenceType;
  selectedDays: string[];
  postsPerDay: number;
  totalDays: number;
  startDate: string;
  endDate: string | null;
  postTimes: string[];
  status: StatusType;
  lastPostedAt: string | null;
  nextPostAt: string | null;
  postsCount: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

const mediaTypeIcons = {
  IMAGE: Image,
  VIDEO: Video,
  LINK: LinkIcon,
  TEXT: Type,
};

const statusStyles = {
  SCHEDULED: 'bg-blue-500/20 text-blue-300 border-blue-600/40',
  POSTED: 'bg-green-500/20 text-green-300 border-green-600/40',
  FAILED: 'bg-red-500/20 text-red-300 border-red-600/40',
  CANCELLED: 'bg-zinc-700/40 text-zinc-300 border-zinc-600/40',
};

const statusLabels = {
  SCHEDULED: 'Agendado',
  POSTED: 'Publicado',
  FAILED: 'Falhou',
  CANCELLED: 'Cancelado',
};

const weekDays = [
  { value: 'monday', label: 'Segunda' },
  { value: 'tuesday', label: 'Terça' },
  { value: 'wednesday', label: 'Quarta' },
  { value: 'thursday', label: 'Quinta' },
  { value: 'friday', label: 'Sexta' },
  { value: 'saturday', label: 'Sábado' },
  { value: 'sunday', label: 'Domingo' },
];

export const ScheduledStatus: React.FC = () => {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ScheduledStatusItem[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [generatingCaption, setGeneratingCaption] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    content: '',
    mediaType: 'IMAGE' as MediaType,
    mediaUrl: '',
    caption: '',
    recurrence: 'ONCE' as RecurrenceType,
    selectedDays: [] as string[],
    postsPerDay: 1,
    totalDays: 1,
    startDate: '',
    postTimes: ['09:00'],
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await apiService.getScheduledStatus();
      setItems(data || []);
    } catch (error) {
      addToast('Erro ao carregar status agendados', 'error');
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleGenerateCaption = async () => {
    if (!formData.mediaUrl) {
      addToast('Adicione uma imagem primeiro', 'error');
      return;
    }

    setGeneratingCaption(true);
    try {
      const caption = await apiService.generateCaptionFromImage(formData.mediaUrl);
      setFormData({ ...formData, caption });
      addToast('Legenda gerada com sucesso!', 'success');
    } catch (error) {
      addToast('Erro ao gerar legenda', 'error');
    }
    setGeneratingCaption(false);
  };

  const handleSubmit = async () => {
    if (!formData.title || !formData.content) {
      addToast('Preencha título e conteúdo', 'error');
      return;
    }

    if (formData.recurrence === 'CUSTOM' && formData.selectedDays.length === 0) {
      addToast('Selecione pelo menos um dia da semana', 'error');
      return;
    }

    try {
      await apiService.createScheduledStatus(formData);
      addToast('Status agendado com sucesso!', 'success');
      setShowForm(false);
      setFormData({
        title: '',
        content: '',
        mediaType: 'IMAGE',
        mediaUrl: '',
        caption: '',
        recurrence: 'ONCE',
        selectedDays: [],
        postsPerDay: 1,
        totalDays: 1,
        startDate: '',
        postTimes: ['09:00'],
      });
      loadData();
    } catch (error) {
      addToast('Erro ao agendar status', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja realmente excluir este agendamento?')) return;

    try {
      await apiService.deleteScheduledStatus(id);
      addToast('Agendamento excluído', 'success');
      loadData();
    } catch (error) {
      addToast('Erro ao excluir', 'error');
    }
  };

  const handleToggleDay = (day: string) => {
    const days = formData.selectedDays.includes(day)
      ? formData.selectedDays.filter(d => d !== day)
      : [...formData.selectedDays, day];
    setFormData({ ...formData, selectedDays: days });
  };

  const handleAddTime = () => {
    setFormData({ ...formData, postTimes: [...formData.postTimes, '12:00'] });
  };

  const handleRemoveTime = (index: number) => {
    setFormData({ ...formData, postTimes: formData.postTimes.filter((_, i) => i !== index) });
  };

  const handleTimeChange = (index: number, value: string) => {
    const times = [...formData.postTimes];
    times[index] = value;
    setFormData({ ...formData, postTimes: times });
  };

  return (
    <div className="p-4 md:p-8 bg-black min-h-screen text-white">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-cyan-400">Agendar Status</h1>
          <p className="text-zinc-400 text-sm mt-1">Agende posts automáticos com legendas geradas por IA</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={loadData}>Atualizar</Button>
          <Button onClick={() => setShowForm(true)}><Plus size={16} /> Novo Agendamento</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
          <p className="text-zinc-400 text-xs">Total agendado</p>
          <p className="text-2xl font-bold mt-1">{items.filter(i => i.status === 'SCHEDULED').length}</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
          <p className="text-zinc-400 text-xs">Publicados</p>
          <p className="text-2xl font-bold text-green-300 mt-1">{items.filter(i => i.status === 'POSTED').length}</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
          <p className="text-zinc-400 text-xs">Falharam</p>
          <p className="text-2xl font-bold text-red-300 mt-1">{items.filter(i => i.status === 'FAILED').length}</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
          <p className="text-zinc-400 text-xs">Total de posts</p>
          <p className="text-2xl font-bold text-cyan-300 mt-1">{items.reduce((sum, i) => sum + i.postsCount, 0)}</p>
        </div>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
        {loading ? (
          <p className="text-zinc-400 text-center py-8">Carregando...</p>
        ) : items.length === 0 ? (
          <p className="text-zinc-400 text-center py-8">Nenhum status agendado</p>
        ) : (
          <div className="space-y-3">
            {items.map((item) => {
              const Icon = mediaTypeIcons[item.mediaType];
              return (
                <div key={item.id} className="bg-black border border-zinc-800 rounded-lg p-4 flex items-start gap-4">
                  <div className="bg-zinc-800 rounded-lg p-3">
                    <Icon size={24} className="text-cyan-400" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="font-semibold text-lg">{item.title}</h3>
                        <p className="text-sm text-zinc-400 mt-1">{item.content}</p>
                        {item.caption && (
                          <p className="text-xs text-zinc-500 mt-2 flex items-center gap-1">
                            {item.aiGeneratedCaption && <Sparkles size={12} className="text-cyan-400" />}
                            {item.caption}
                          </p>
                        )}
                      </div>
                      <span className={`px-2 py-1 rounded-md border text-xs font-bold whitespace-nowrap ${statusStyles[item.status]}`}>
                        {statusLabels[item.status]}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-zinc-400">
                      <span className="flex items-center gap-1"><Calendar size={12} /> {item.recurrence}</span>
                      <span className="flex items-center gap-1"><Clock size={12} /> {item.postsPerDay}x/dia</span>
                      <span>📅 {item.totalDays} dias</span>
                      <span>📊 {item.postsCount} posts</span>
                      {item.nextPostAt && <span>⏰ Próximo: {new Date(item.nextPostAt).toLocaleString('pt-BR')}</span>}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleDelete(item.id)} className="text-red-400 hover:text-red-300">
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm p-4 flex items-center justify-center">
          <div className="w-full max-w-3xl bg-zinc-950 border border-zinc-800 rounded-2xl p-6 max-h-[90vh] overflow-auto">
            <h2 className="text-xl font-bold text-cyan-400 mb-4">Novo Agendamento</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-zinc-400 mb-1">Título</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full bg-black border border-zinc-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-cyan-500"
                  placeholder="Ex: Promoção de Empréstimo"
                />
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-1">Tipo de mídia</label>
                <div className="grid grid-cols-4 gap-2">
                  {(['IMAGE', 'VIDEO', 'LINK', 'TEXT'] as MediaType[]).map((type) => {
                    const Icon = mediaTypeIcons[type];
                    return (
                      <button
                        key={type}
                        onClick={() => setFormData({ ...formData, mediaType: type })}
                        className={`border rounded-lg p-3 flex flex-col items-center gap-2 ${formData.mediaType === type ? 'border-cyan-500 bg-cyan-500/10' : 'border-zinc-700'}`}
                      >
                        <Icon size={20} />
                        <span className="text-xs">{type}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {formData.mediaType !== 'TEXT' && (
                <div>
                  <label className="block text-sm text-zinc-400 mb-1">URL da mídia</label>
                  <input
                    type="text"
                    value={formData.mediaUrl}
                    onChange={(e) => setFormData({ ...formData, mediaUrl: e.target.value })}
                    className="w-full bg-black border border-zinc-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-cyan-500"
                    placeholder="https://..."
                  />
                </div>
              )}

              <div>
                <label className="block text-sm text-zinc-400 mb-1">Conteúdo</label>
                <textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  rows={3}
                  className="w-full bg-black border border-zinc-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-cyan-500"
                  placeholder="Texto do post..."
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm text-zinc-400">Legenda</label>
                  {formData.mediaType === 'IMAGE' && (
                    <Button size="sm" variant="outline" onClick={handleGenerateCaption} isLoading={generatingCaption}>
                      <Sparkles size={14} /> Gerar com IA
                    </Button>
                  )}
                </div>
                <textarea
                  value={formData.caption}
                  onChange={(e) => setFormData({ ...formData, caption: e.target.value })}
                  rows={2}
                  className="w-full bg-black border border-zinc-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-cyan-500"
                  placeholder="Legenda opcional..."
                />
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-1">Recorrência</label>
                <select
                  value={formData.recurrence}
                  onChange={(e) => setFormData({ ...formData, recurrence: e.target.value as RecurrenceType })}
                  className="w-full bg-black border border-zinc-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-cyan-500"
                >
                  <option value="ONCE">Uma vez</option>
                  <option value="DAILY">Diariamente</option>
                  <option value="WEEKLY">Semanalmente</option>
                  <option value="CUSTOM">Personalizado</option>
                </select>
              </div>

              {formData.recurrence === 'CUSTOM' && (
                <div>
                  <label className="block text-sm text-zinc-400 mb-2">Dias da semana</label>
                  <div className="grid grid-cols-7 gap-2">
                    {weekDays.map((day) => (
                      <button
                        key={day.value}
                        onClick={() => handleToggleDay(day.value)}
                        className={`border rounded-lg p-2 text-xs ${formData.selectedDays.includes(day.value) ? 'border-cyan-500 bg-cyan-500/10' : 'border-zinc-700'}`}
                      >
                        {day.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-zinc-400 mb-1">Posts por dia</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={formData.postsPerDay}
                    onChange={(e) => setFormData({ ...formData, postsPerDay: parseInt(e.target.value) || 1 })}
                    className="w-full bg-black border border-zinc-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-zinc-400 mb-1">Total de dias</label>
                  <input
                    type="number"
                    min="1"
                    max="365"
                    value={formData.totalDays}
                    onChange={(e) => setFormData({ ...formData, totalDays: parseInt(e.target.value) || 1 })}
                    className="w-full bg-black border border-zinc-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-1">Data de início</label>
                <input
                  type="datetime-local"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  className="w-full bg-black border border-zinc-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm text-zinc-400">Horários de postagem</label>
                  <Button size="sm" variant="outline" onClick={handleAddTime}>
                    <Plus size={14} /> Adicionar
                  </Button>
                </div>
                <div className="space-y-2">
                  {formData.postTimes.map((time, index) => (
                    <div key={index} className="flex gap-2">
                      <input
                        type="time"
                        value={time}
                        onChange={(e) => handleTimeChange(index, e.target.value)}
                        className="flex-1 bg-black border border-zinc-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-cyan-500"
                      />
                      {formData.postTimes.length > 1 && (
                        <button onClick={() => handleRemoveTime(index)} className="text-red-400 hover:text-red-300">
                          <Trash2 size={18} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <Button variant="secondary" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button onClick={handleSubmit}>Agendar</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
