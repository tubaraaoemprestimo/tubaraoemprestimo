import React, { useState, useEffect, useRef } from 'react';
import { AIGenerateCaption } from '../../components/AIGenerateCaption';
import {
    Camera, Plus, Trash2, Clock, CheckCircle, XCircle,
    AlertCircle, Calendar, Image as ImageIcon, Send, Loader2,
    RefreshCw, Play, Edit, Repeat, CalendarDays, CheckSquare, Square
} from 'lucide-react';
import { Button } from '../../components/Button';
import { api } from '../../services/apiClient';
import { useToast } from '../../components/Toast';

interface ScheduledStatus {
    id: string;
    image_url: string;
    caption: string | null;
    scheduled_at: string;
    status: 'PENDING' | 'POSTED' | 'FAILED';
    error_message: string | null;
    posted_at: string | null;
    created_at: string;
}

type RecurrenceType = 'single' | 'daily' | 'weekly' | 'monthly';

const inputStyle = "w-full bg-black border border-zinc-700 rounded-lg p-3 text-white focus:border-[#D4AF37] outline-none transition-colors";

const WEEK_DAYS = [
    { key: 'sun', label: 'Dom', value: 0 },
    { key: 'mon', label: 'Seg', value: 1 },
    { key: 'tue', label: 'Ter', value: 2 },
    { key: 'wed', label: 'Qua', value: 3 },
    { key: 'thu', label: 'Qui', value: 4 },
    { key: 'fri', label: 'Sex', value: 5 },
    { key: 'sat', label: 'Sáb', value: 6 }
];

const COMMON_TIMES = ['09:00', '12:00', '14:00', '18:00', '20:00'];

export const StatusScheduler: React.FC = () => {
    const { addToast } = useToast();
    const [scheduledStatus, setScheduledStatus] = useState<ScheduledStatus[]>([]);
    const [loading, setLoading] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const editFileInputRef = useRef<HTMLInputElement>(null);

    // Estado do status sendo editado
    const [editingStatus, setEditingStatus] = useState<ScheduledStatus | null>(null);
    const [editFormData, setEditFormData] = useState({
        image_url: '',
        caption: '',
        scheduled_date: '',
        scheduled_time: ''
    });

    // Form state
    const [formData, setFormData] = useState({
        image_url: '',
        caption: '',
        scheduled_date: new Date().toISOString().split('T')[0],
        scheduled_time: '09:00'
    });

    // Recurrence state
    const [recurrence, setRecurrence] = useState<RecurrenceType>('single');
    const [selectedDays, setSelectedDays] = useState<number[]>([1, 3, 5]); // Seg, Qua, Sex
    const [selectedTimes, setSelectedTimes] = useState<string[]>(['09:00', '18:00']);
    const [recurrenceEndDate, setRecurrenceEndDate] = useState('');
    const [customTime, setCustomTime] = useState('');

    useEffect(() => {
        loadScheduledStatus();
        // Definir data final padrão (1 mês à frente)
        const endDate = new Date();
        endDate.setMonth(endDate.getMonth() + 1);
        setRecurrenceEndDate(endDate.toISOString().split('T')[0]);
    }, []);

    const loadScheduledStatus = async () => {
        setLoading(true);
        const { data } = await api.get('/whatsapp/status-queue?limit=50');

        if (data) {
            const resp = data as any;
            // The API returns { statuses, summary } format
            const statuses = resp.statuses || resp;
            if (Array.isArray(statuses)) {
                setScheduledStatus(statuses.map((s: any) => ({
                    id: s.id,
                    image_url: s.imageUrl || s.image_url,
                    caption: s.caption || null,
                    scheduled_at: s.scheduledAt || s.scheduled_at,
                    status: s.status,
                    error_message: s.errorMessage || s.error_message || null,
                    posted_at: s.postedAt || s.posted_at || null,
                    created_at: s.createdAt || s.created_at
                })));
            }
        }
        setLoading(false);
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, isEdit = false) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 5 * 1024 * 1024) {
            addToast('Imagem muito grande. Máximo 5MB.', 'error');
            return;
        }

        if (!file.type.startsWith('image/')) {
            addToast('Arquivo inválido. Apenas imagens são permitidas.', 'error');
            return;
        }

        setUploading(true);

        try {
            // Upload via API
            const { data, error } = await api.upload(file, file.name);

            if (error || !data) {
                addToast('Erro ao fazer upload da imagem', 'error');
                setUploading(false);
                return;
            }

            const publicUrl = (data as any).url;

            if (isEdit) {
                setEditFormData({ ...editFormData, image_url: publicUrl });
            } else {
                setFormData({ ...formData, image_url: publicUrl });
            }
            addToast('Imagem enviada!', 'success');
        } catch (err: any) {
            console.error('Upload error:', err);
            addToast(`Erro no upload: ${err.message}`, 'error');
        }

        setUploading(false);
    };

    const generateRecurringDates = (): Date[] => {
        const dates: Date[] = [];
        const startDate = new Date(`${formData.scheduled_date}T${formData.scheduled_time}:00`);
        const endDate = new Date(recurrenceEndDate);
        endDate.setHours(23, 59, 59);

        if (recurrence === 'single') {
            return [startDate];
        }

        let currentDate = new Date(startDate);

        while (currentDate <= endDate) {
            if (recurrence === 'daily') {
                // Para cada horário selecionado
                selectedTimes.forEach(time => {
                    const [hours, minutes] = time.split(':').map(Number);
                    const scheduleDate = new Date(currentDate);
                    scheduleDate.setHours(hours, minutes, 0, 0);
                    if (scheduleDate >= new Date() && scheduleDate <= endDate) {
                        dates.push(new Date(scheduleDate));
                    }
                });
                currentDate.setDate(currentDate.getDate() + 1);
            } else if (recurrence === 'weekly') {
                // Verificar se é um dos dias selecionados
                if (selectedDays.includes(currentDate.getDay())) {
                    selectedTimes.forEach(time => {
                        const [hours, minutes] = time.split(':').map(Number);
                        const scheduleDate = new Date(currentDate);
                        scheduleDate.setHours(hours, minutes, 0, 0);
                        if (scheduleDate >= new Date() && scheduleDate <= endDate) {
                            dates.push(new Date(scheduleDate));
                        }
                    });
                }
                currentDate.setDate(currentDate.getDate() + 1);
            } else if (recurrence === 'monthly') {
                // Mesmo dia todo mês
                selectedTimes.forEach(time => {
                    const [hours, minutes] = time.split(':').map(Number);
                    const scheduleDate = new Date(currentDate);
                    scheduleDate.setHours(hours, minutes, 0, 0);
                    if (scheduleDate >= new Date() && scheduleDate <= endDate) {
                        dates.push(new Date(scheduleDate));
                    }
                });
                currentDate.setMonth(currentDate.getMonth() + 1);
            }
        }

        return dates.sort((a, b) => a.getTime() - b.getTime());
    };

    const handleSchedule = async () => {
        if (!formData.image_url) {
            addToast('Selecione uma imagem.', 'warning');
            return;
        }

        if (!formData.scheduled_date || !formData.scheduled_time) {
            addToast('Escolha data e hora.', 'warning');
            return;
        }

        if (recurrence !== 'single' && selectedTimes.length === 0) {
            addToast('Selecione pelo menos um horário.', 'warning');
            return;
        }

        if (recurrence === 'weekly' && selectedDays.length === 0) {
            addToast('Selecione pelo menos um dia da semana.', 'warning');
            return;
        }

        setLoading(true);

        try {
            const dates = generateRecurringDates();

            if (dates.length === 0) {
                addToast('Nenhuma data válida para agendar.', 'warning');
                setLoading(false);
                return;
            }

            if (dates.length > 100) {
                addToast(`Muitas datas (${dates.length}). Reduza o período.`, 'warning');
                setLoading(false);
                return;
            }

            // Criar registros para todas as datas via API
            const records = dates.map(date => ({
                image_url: formData.image_url,
                caption: formData.caption || null,
                scheduled_at: date.toISOString(),
                status: 'PENDING'
            }));

            if (records.length === 1) {
                // Single schedule
                const { error } = await api.post('/whatsapp/schedule-status', {
                    imageUrl: records[0].image_url,
                    caption: records[0].caption,
                    scheduledAt: records[0].scheduled_at
                });
                if (error) throw new Error('Erro ao agendar status');
            } else {
                // Bulk schedule
                const { error } = await api.post('/whatsapp/schedule-bulk', { records });
                if (error) throw new Error('Erro ao agendar status em massa');
            }

            addToast(`${records.length} status agendado(s) com sucesso!`, 'success');
            setIsModalOpen(false);
            setFormData({
                image_url: '',
                caption: '',
                scheduled_date: new Date().toISOString().split('T')[0],
                scheduled_time: '09:00'
            });
            setRecurrence('single');
            loadScheduledStatus();
        } catch (err: any) {
            console.error('Schedule error:', err);
            addToast(`Erro: ${err.message}`, 'error');
        }

        setLoading(false);
    };

    const handleEdit = (item: ScheduledStatus) => {
        setEditingStatus(item);
        const date = new Date(item.scheduled_at);
        setEditFormData({
            image_url: item.image_url,
            caption: item.caption || '',
            scheduled_date: date.toISOString().split('T')[0],
            scheduled_time: date.toTimeString().slice(0, 5)
        });
        setIsEditModalOpen(true);
    };

    const handleSaveEdit = async () => {
        if (!editingStatus) return;

        if (!editFormData.image_url) {
            addToast('Selecione uma imagem.', 'warning');
            return;
        }

        setLoading(true);

        try {
            const scheduledAt = new Date(`${editFormData.scheduled_date}T${editFormData.scheduled_time}:00`);

            const { error } = await api.put(`/whatsapp/status/${editingStatus.id}`, {
                imageUrl: editFormData.image_url,
                caption: editFormData.caption || null,
                scheduledAt: scheduledAt.toISOString()
            });

            if (error) throw new Error('Erro ao atualizar');

            addToast('Status atualizado com sucesso!', 'success');
            setIsEditModalOpen(false);
            setEditingStatus(null);
            loadScheduledStatus();
        } catch (err: any) {
            console.error('Update error:', err);
            addToast(`Erro: ${err.message}`, 'error');
        }

        setLoading(false);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Excluir este agendamento?')) return;

        const { error } = await api.delete(`/whatsapp/status/${id}`);

        if (!error) {
            addToast('Agendamento excluído.', 'info');
            loadScheduledStatus();
        } else {
            addToast('Erro ao excluir.', 'error');
        }
    };

    const handlePostNow = async (id: string) => {
        if (!confirm('Postar este status agora?')) return;

        const { error } = await api.post(`/whatsapp/post-now/${id}`, {});

        if (!error) {
            addToast('Status postado com sucesso!', 'success');
            setTimeout(() => loadScheduledStatus(), 2000);
        } else {
            addToast('Erro ao postar status', 'error');
        }
    };

    const handleRetry = async (id: string) => {
        const { error } = await api.put(`/whatsapp/status/${id}`, {
            status: 'PENDING',
            scheduledAt: new Date().toISOString(),
            errorMessage: null
        });

        if (!error) {
            addToast('Tentando novamente...', 'info');

            // Trigger the queue processor
            try {
                await api.post('/whatsapp/process-queue', {});
            } catch {
                console.log('Queue process triggered');
            }

            setTimeout(() => loadScheduledStatus(), 3000);
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'POSTED':
                return <span className="bg-green-900/30 text-green-400 text-xs px-2 py-1 rounded flex items-center gap-1"><CheckCircle size={12} /> Postado</span>;
            case 'FAILED':
                return <span className="bg-red-900/30 text-red-400 text-xs px-2 py-1 rounded flex items-center gap-1"><XCircle size={12} /> Falhou</span>;
            default:
                return <span className="bg-yellow-900/30 text-yellow-400 text-xs px-2 py-1 rounded flex items-center gap-1"><Clock size={12} /> Pendente</span>;
        }
    };

    const toggleDay = (day: number) => {
        setSelectedDays(prev =>
            prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
        );
    };

    const toggleTime = (time: string) => {
        setSelectedTimes(prev =>
            prev.includes(time) ? prev.filter(t => t !== time) : [...prev, time]
        );
    };

    const addCustomTime = () => {
        if (customTime && !selectedTimes.includes(customTime)) {
            setSelectedTimes([...selectedTimes, customTime].sort());
            setCustomTime('');
        }
    };

    // Estado do filtro
    const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'POSTED' | 'FAILED'>('ALL');

    // Estado de seleção múltipla
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [isDeleting, setIsDeleting] = useState(false);

    // Estatísticas
    const stats = {
        total: scheduledStatus.length,
        pending: scheduledStatus.filter(s => s.status === 'PENDING').length,
        posted: scheduledStatus.filter(s => s.status === 'POSTED').length,
        failed: scheduledStatus.filter(s => s.status === 'FAILED').length
    };

    // Filtrar status
    const filteredStatus = filter === 'ALL'
        ? scheduledStatus
        : scheduledStatus.filter(s => s.status === filter);

    // Pendentes filtrados (para selecionar todos)
    const pendingItems = scheduledStatus.filter(s => s.status === 'PENDING');

    // Toggle seleção individual
    const toggleSelect = (id: string) => {
        setSelectedIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) {
                newSet.delete(id);
            } else {
                newSet.add(id);
            }
            return newSet;
        });
    };

    // Selecionar todos os pendentes
    const selectAllPending = () => {
        const pendingIds = pendingItems.map(s => s.id);
        setSelectedIds(new Set(pendingIds));
        addToast(`${pendingIds.length} itens pendentes selecionados.`, 'info');
    };

    // Limpar seleção
    const clearSelection = () => {
        setSelectedIds(new Set());
    };

    // Excluir todos selecionados
    const handleDeleteSelected = async () => {
        if (selectedIds.size === 0) {
            addToast('Nenhum item selecionado.', 'warning');
            return;
        }

        if (!confirm(`Excluir ${selectedIds.size} agendamento(s) selecionado(s)?`)) return;

        setIsDeleting(true);

        try {
            const { error } = await api.delete('/whatsapp/status-bulk', { data: { ids: Array.from(selectedIds) } });

            if (error) throw new Error('Erro ao excluir');

            addToast(`${selectedIds.size} agendamento(s) excluído(s).`, 'success');
            setSelectedIds(new Set());
            loadScheduledStatus();
        } catch (err: any) {
            console.error('Delete error:', err);
            addToast(`Erro ao excluir: ${err.message}`, 'error');
        }

        setIsDeleting(false);
    };

    const previewDatesCount = recurrence !== 'single' ? generateRecurringDates().length : 1;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                        <Camera className="text-green-500" size={28} />
                        Status do WhatsApp
                    </h1>
                    <p className="text-zinc-400 text-sm">Agende postagens automáticas no Status</p>
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="secondary"
                        onClick={loadScheduledStatus}
                        className="flex items-center gap-2"
                    >
                        <RefreshCw size={16} /> Atualizar
                    </Button>
                    <Button
                        onClick={() => setIsModalOpen(true)}
                        className="bg-green-600 hover:bg-green-700 flex items-center gap-2"
                    >
                        <Plus size={16} /> Agendar Status
                    </Button>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                    <p className="text-zinc-400 text-sm">Total</p>
                    <p className="text-2xl font-bold text-white">{stats.total}</p>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                    <p className="text-zinc-400 text-sm">Pendentes</p>
                    <p className="text-2xl font-bold text-yellow-400">{stats.pending}</p>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                    <p className="text-zinc-400 text-sm">Postados</p>
                    <p className="text-2xl font-bold text-green-400">{stats.posted}</p>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                    <p className="text-zinc-400 text-sm">Falhas</p>
                    <p className="text-2xl font-bold text-red-400">{stats.failed}</p>
                </div>
            </div>

            {/* Lista de Status Agendados */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                <div className="p-4 border-b border-zinc-800 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <h3 className="text-white font-semibold flex items-center gap-2">
                        <Calendar size={18} className="text-green-500" />
                        Histórico de Status
                    </h3>
                    {/* Filtros */}
                    <div className="flex gap-2 flex-wrap">
                        <button
                            onClick={() => setFilter('ALL')}
                            className={`px-3 py-1 text-xs rounded-full transition-colors ${filter === 'ALL' ? 'bg-zinc-700 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-white'}`}
                        >
                            Todos ({stats.total})
                        </button>
                        <button
                            onClick={() => setFilter('PENDING')}
                            className={`px-3 py-1 text-xs rounded-full transition-colors ${filter === 'PENDING' ? 'bg-yellow-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-yellow-400'}`}
                        >
                            Pendentes ({stats.pending})
                        </button>
                        <button
                            onClick={() => setFilter('POSTED')}
                            className={`px-3 py-1 text-xs rounded-full transition-colors ${filter === 'POSTED' ? 'bg-green-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-green-400'}`}
                        >
                            Postados ({stats.posted})
                        </button>
                        <button
                            onClick={() => setFilter('FAILED')}
                            className={`px-3 py-1 text-xs rounded-full transition-colors ${filter === 'FAILED' ? 'bg-red-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-red-400'}`}
                        >
                            Falhas ({stats.failed})
                        </button>
                    </div>
                </div>

                {/* Barra de Ações em Massa */}
                <div className="p-3 border-b border-zinc-800 bg-zinc-950 flex flex-wrap items-center gap-3">
                    <button
                        onClick={selectAllPending}
                        disabled={pendingItems.length === 0}
                        className="px-4 py-2 text-sm rounded-lg bg-yellow-600/20 text-yellow-400 border border-yellow-700 hover:bg-yellow-600/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
                    >
                        <CheckSquare size={16} />
                        Selecionar Todos Pendentes ({stats.pending})
                    </button>

                    {selectedIds.size > 0 && (
                        <>
                            <button
                                onClick={clearSelection}
                                className="px-4 py-2 text-sm rounded-lg bg-zinc-800 text-zinc-400 hover:text-white flex items-center gap-2 transition-colors"
                            >
                                <Square size={16} />
                                Limpar Seleção
                            </button>

                            <button
                                onClick={handleDeleteSelected}
                                disabled={isDeleting}
                                className="px-4 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 flex items-center gap-2 transition-colors"
                            >
                                {isDeleting ? (
                                    <Loader2 size={16} className="animate-spin" />
                                ) : (
                                    <Trash2 size={16} />
                                )}
                                Excluir {selectedIds.size} Selecionado(s)
                            </button>
                        </>
                    )}

                    {selectedIds.size > 0 && (
                        <span className="text-sm text-zinc-400 ml-auto">
                            {selectedIds.size} item(s) selecionado(s)
                        </span>
                    )}
                </div>

                {loading ? (
                    <div className="p-8 text-center text-zinc-400">
                        <Loader2 className="animate-spin mx-auto mb-2" />
                        Carregando...
                    </div>
                ) : filteredStatus.length === 0 ? (
                    <div className="p-8 text-center text-zinc-500">
                        <Camera size={48} className="mx-auto mb-3 opacity-30" />
                        <p>{filter === 'ALL' ? 'Nenhum status agendado.' : `Nenhum status ${filter === 'PENDING' ? 'pendente' : filter === 'POSTED' ? 'postado' : 'com falha'}.`}</p>
                        <p className="text-sm">Clique em "Agendar Status" para começar.</p>
                    </div>
                ) : (
                    <div className="divide-y divide-zinc-800">
                        {filteredStatus.map((item) => (
                            <div key={item.id} className={`p-4 flex items-center gap-4 hover:bg-zinc-800/50 transition-colors ${selectedIds.has(item.id) ? 'bg-yellow-900/20' : ''}`}>
                                {/* Checkbox de Seleção */}
                                <button
                                    onClick={() => toggleSelect(item.id)}
                                    className={`flex-shrink-0 w-6 h-6 rounded border-2 flex items-center justify-center transition-colors ${selectedIds.has(item.id)
                                        ? 'bg-yellow-500 border-yellow-500 text-black'
                                        : 'border-zinc-600 hover:border-yellow-500'
                                        }`}
                                >
                                    {selectedIds.has(item.id) && <CheckCircle size={14} />}
                                </button>

                                {/* Thumbnail */}
                                <div className="w-16 h-16 rounded-lg overflow-hidden bg-zinc-800 flex-shrink-0">
                                    <img
                                        src={item.image_url}
                                        alt="Status"
                                        className="w-full h-full object-cover"
                                        onError={(e) => {
                                            (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="%23333" width="100" height="100"/><text x="50" y="55" text-anchor="middle" fill="%23666" font-size="40">?</text></svg>';
                                        }}
                                    />
                                </div>

                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                    <p className="text-white font-medium truncate">
                                        {item.caption || '(Sem legenda)'}
                                    </p>
                                    <p className="text-zinc-400 text-sm flex items-center gap-1">
                                        <Clock size={12} />
                                        Agendado: {new Date(item.scheduled_at).toLocaleString('pt-BR')}
                                    </p>
                                    {item.posted_at && (
                                        <p className="text-green-400 text-xs mt-1 flex items-center gap-1">
                                            <CheckCircle size={12} />
                                            Postado em: {new Date(item.posted_at).toLocaleString('pt-BR')}
                                        </p>
                                    )}
                                    {item.error_message && (
                                        <p className="text-red-400 text-xs mt-1 flex items-center gap-1">
                                            <AlertCircle size={12} />
                                            {item.error_message.substring(0, 100)}
                                        </p>
                                    )}
                                </div>

                                {/* Status */}
                                <div className="flex-shrink-0">
                                    {getStatusBadge(item.status)}
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-1 flex-shrink-0">
                                    {item.status === 'PENDING' && (
                                        <>
                                            <button
                                                onClick={() => handleEdit(item)}
                                                className="p-2 hover:bg-blue-900/30 rounded text-blue-500 hover:text-blue-400"
                                                title="Editar"
                                            >
                                                <Edit size={16} />
                                            </button>
                                            <button
                                                onClick={() => handlePostNow(item.id)}
                                                className="p-2 hover:bg-green-900/30 rounded text-green-500 hover:text-green-400"
                                                title="Postar agora"
                                            >
                                                <Play size={16} />
                                            </button>
                                        </>
                                    )}
                                    {item.status === 'FAILED' && (
                                        <button
                                            onClick={() => handleRetry(item.id)}
                                            className="p-2 hover:bg-yellow-900/30 rounded text-yellow-500 hover:text-yellow-400"
                                            title="Tentar novamente"
                                        >
                                            <RefreshCw size={16} />
                                        </button>
                                    )}
                                    <button
                                        onClick={() => handleDelete(item.id)}
                                        className="p-2 hover:bg-red-900/30 rounded text-zinc-400 hover:text-red-400"
                                        title="Excluir"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Modal de Agendamento */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl animate-in zoom-in duration-200 max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-6 border-b border-zinc-800 pb-4">
                            <h3 className="text-xl font-bold text-green-400 flex items-center gap-2">
                                <Camera size={20} />
                                Agendar Status
                            </h3>
                            <button onClick={() => setIsModalOpen(false)}>
                                <XCircle className="text-zinc-500 hover:text-white" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            {/* Upload de Imagem */}
                            <div>
                                <label className="block text-sm text-zinc-400 mb-2">Imagem *</label>
                                {formData.image_url ? (
                                    <div className="relative">
                                        <img
                                            src={formData.image_url}
                                            alt="Preview"
                                            className="w-full h-48 object-cover rounded-lg"
                                        />
                                        <button
                                            onClick={() => setFormData({ ...formData, image_url: '' })}
                                            className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full hover:bg-red-600"
                                        >
                                            <XCircle size={16} />
                                        </button>
                                    </div>
                                ) : (
                                    <div
                                        onClick={() => fileInputRef.current?.click()}
                                        className="border-2 border-dashed border-zinc-700 rounded-lg p-8 text-center cursor-pointer hover:border-green-500 transition-colors"
                                    >
                                        {uploading ? (
                                            <Loader2 className="animate-spin mx-auto mb-2 text-green-500" size={32} />
                                        ) : (
                                            <ImageIcon className="mx-auto mb-2 text-zinc-500" size={32} />
                                        )}
                                        <p className="text-zinc-400 text-sm">
                                            {uploading ? 'Enviando...' : 'Clique para selecionar uma imagem'}
                                        </p>
                                        <p className="text-zinc-600 text-xs mt-1">
                                            JPG, PNG ou GIF (máx. 5MB)
                                        </p>
                                    </div>
                                )}
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => handleImageUpload(e)}
                                    className="hidden"
                                />
                            </div>

                            {/* AIGenerateCaption Button */}
                            <div className="flex justify-end mb-1">
                                <AIGenerateCaption
                                    imageBase64={formData.image_url}
                                    onCaptionGenerated={(caption) => setFormData({ ...formData, caption })}
                                />
                            </div>

                            {/* Legenda */}
                            <div>
                                <label className="block text-sm text-zinc-400 mb-1">Legenda (opcional)</label>
                                <textarea
                                    value={formData.caption}
                                    onChange={(e) => setFormData({ ...formData, caption: e.target.value })}
                                    placeholder="Escreva uma legenda..."
                                    rows={3}
                                    maxLength={500}
                                    className={inputStyle + " resize-none"}
                                />
                                <p className="text-xs text-zinc-600 mt-1 text-right">{formData.caption.length}/500</p>
                            </div>

                            {/* Tipo de Recorrência */}
                            <div>
                                <label className="block text-sm text-zinc-400 mb-2 flex items-center gap-2">
                                    <Repeat size={14} /> Repetição
                                </label>
                                <div className="grid grid-cols-4 gap-2">
                                    {[
                                        { value: 'single', label: 'Único' },
                                        { value: 'daily', label: 'Diário' },
                                        { value: 'weekly', label: 'Semanal' },
                                        { value: 'monthly', label: 'Mensal' }
                                    ].map(opt => (
                                        <button
                                            key={opt.value}
                                            onClick={() => setRecurrence(opt.value as RecurrenceType)}
                                            className={`p-2 text-xs rounded-lg border transition-colors ${recurrence === opt.value
                                                ? 'bg-green-600 border-green-500 text-white'
                                                : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-green-500'
                                                }`}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Data inicial */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm text-zinc-400 mb-1">
                                        {recurrence === 'single' ? 'Data *' : 'Data Início *'}
                                    </label>
                                    <input
                                        type="date"
                                        value={formData.scheduled_date}
                                        onChange={(e) => setFormData({ ...formData, scheduled_date: e.target.value })}
                                        min={new Date().toISOString().split('T')[0]}
                                        className={inputStyle}
                                    />
                                </div>
                                {recurrence === 'single' && (
                                    <div>
                                        <label className="block text-sm text-zinc-400 mb-1">Hora *</label>
                                        <input
                                            type="time"
                                            value={formData.scheduled_time}
                                            onChange={(e) => setFormData({ ...formData, scheduled_time: e.target.value })}
                                            className={inputStyle}
                                        />
                                    </div>
                                )}
                                {recurrence !== 'single' && (
                                    <div>
                                        <label className="block text-sm text-zinc-400 mb-1">Data Fim *</label>
                                        <input
                                            type="date"
                                            value={recurrenceEndDate}
                                            onChange={(e) => setRecurrenceEndDate(e.target.value)}
                                            min={formData.scheduled_date}
                                            className={inputStyle}
                                        />
                                    </div>
                                )}
                            </div>

                            {/* Dias da Semana (para semanal) */}
                            {recurrence === 'weekly' && (
                                <div>
                                    <label className="block text-sm text-zinc-400 mb-2 flex items-center gap-2">
                                        <CalendarDays size={14} /> Dias da Semana
                                    </label>
                                    <div className="flex gap-2 flex-wrap">
                                        {WEEK_DAYS.map(day => (
                                            <button
                                                key={day.key}
                                                onClick={() => toggleDay(day.value)}
                                                className={`w-10 h-10 rounded-lg text-xs font-medium transition-colors ${selectedDays.includes(day.value)
                                                    ? 'bg-green-600 text-white'
                                                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                                                    }`}
                                            >
                                                {day.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Horários (para recorrência) */}
                            {recurrence !== 'single' && (
                                <div>
                                    <label className="block text-sm text-zinc-400 mb-2 flex items-center gap-2">
                                        <Clock size={14} /> Horários
                                    </label>
                                    <div className="flex gap-2 flex-wrap mb-2">
                                        {COMMON_TIMES.map(time => (
                                            <button
                                                key={time}
                                                onClick={() => toggleTime(time)}
                                                className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${selectedTimes.includes(time)
                                                    ? 'bg-green-600 text-white'
                                                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                                                    }`}
                                            >
                                                {time}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="flex gap-2">
                                        <input
                                            type="time"
                                            value={customTime}
                                            onChange={(e) => setCustomTime(e.target.value)}
                                            className={inputStyle + " flex-1"}
                                            placeholder="Horário personalizado"
                                        />
                                        <Button onClick={addCustomTime} variant="secondary" className="px-4">
                                            <Plus size={16} />
                                        </Button>
                                    </div>
                                    {selectedTimes.length > 0 && (
                                        <div className="mt-2 flex flex-wrap gap-1">
                                            {selectedTimes.map(time => (
                                                <span
                                                    key={time}
                                                    className="bg-green-900/30 text-green-400 text-xs px-2 py-1 rounded flex items-center gap-1"
                                                >
                                                    {time}
                                                    <button onClick={() => toggleTime(time)} className="hover:text-red-400">
                                                        <XCircle size={12} />
                                                    </button>
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Preview de quantidade */}
                            {recurrence !== 'single' && (
                                <div className="bg-zinc-800 rounded-lg p-3 text-center">
                                    <p className="text-zinc-400 text-sm">
                                        Serão criados <span className="text-green-400 font-bold">{previewDatesCount}</span> agendamentos
                                    </p>
                                </div>
                            )}

                            {/* Botões */}
                            <div className="pt-4 flex gap-3">
                                <Button
                                    variant="secondary"
                                    onClick={() => setIsModalOpen(false)}
                                    className="flex-1"
                                >
                                    Cancelar
                                </Button>
                                <Button
                                    onClick={handleSchedule}
                                    isLoading={loading}
                                    className="flex-1 bg-green-600 hover:bg-green-700"
                                >
                                    <Send size={16} className="mr-2" />
                                    Agendar {recurrence !== 'single' && `(${previewDatesCount})`}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Edição */}
            {isEditModalOpen && editingStatus && (
                <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in zoom-in duration-200 max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-6 border-b border-zinc-800 pb-4">
                            <h3 className="text-xl font-bold text-blue-400 flex items-center gap-2">
                                <Edit size={20} />
                                Editar Status
                            </h3>
                            <button onClick={() => setIsEditModalOpen(false)}>
                                <XCircle className="text-zinc-500 hover:text-white" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            {/* Upload de Imagem */}
                            <div>
                                <label className="block text-sm text-zinc-400 mb-2">Imagem *</label>
                                <div className="relative">
                                    <img
                                        src={editFormData.image_url}
                                        alt="Preview"
                                        className="w-full h-48 object-cover rounded-lg"
                                    />
                                    <button
                                        onClick={() => editFileInputRef.current?.click()}
                                        className="absolute bottom-2 right-2 bg-blue-500 text-white p-2 rounded-full hover:bg-blue-600"
                                    >
                                        <Camera size={16} />
                                    </button>
                                </div>
                                <input
                                    ref={editFileInputRef}
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => handleImageUpload(e, true)}
                                    className="hidden"
                                />
                            </div>

                            {/* Legenda */}
                            <div>
                                <label className="block text-sm text-zinc-400 mb-1">Legenda</label>
                                <textarea
                                    value={editFormData.caption}
                                    onChange={(e) => setEditFormData({ ...editFormData, caption: e.target.value })}
                                    placeholder="Escreva uma legenda..."
                                    rows={3}
                                    maxLength={500}
                                    className={inputStyle + " resize-none"}
                                />
                            </div>

                            {/* Data e Hora */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm text-zinc-400 mb-1">Data *</label>
                                    <input
                                        type="date"
                                        value={editFormData.scheduled_date}
                                        onChange={(e) => setEditFormData({ ...editFormData, scheduled_date: e.target.value })}
                                        className={inputStyle}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-zinc-400 mb-1">Hora *</label>
                                    <input
                                        type="time"
                                        value={editFormData.scheduled_time}
                                        onChange={(e) => setEditFormData({ ...editFormData, scheduled_time: e.target.value })}
                                        className={inputStyle}
                                    />
                                </div>
                            </div>

                            {/* Botões */}
                            <div className="pt-4 flex gap-3">
                                <Button
                                    variant="secondary"
                                    onClick={() => setIsEditModalOpen(false)}
                                    className="flex-1"
                                >
                                    Cancelar
                                </Button>
                                <Button
                                    onClick={handleSaveEdit}
                                    isLoading={loading}
                                    className="flex-1 bg-blue-600 hover:bg-blue-700"
                                >
                                    <CheckCircle size={16} className="mr-2" />
                                    Salvar
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StatusScheduler;
