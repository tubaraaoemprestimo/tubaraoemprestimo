import React, { useState, useEffect, useRef } from 'react';
import { AIGenerateCaption } from '../../components/AIGenerateCaption';
import {
    Camera, Plus, Trash2, Clock, CheckCircle, XCircle,
    AlertCircle, Calendar, Image as ImageIcon, Send, Loader2,
    RefreshCw, Play
} from 'lucide-react';
import { Button } from '../../components/Button';
import { supabase } from '../../services/supabaseClient';
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

const inputStyle = "w-full bg-black border border-zinc-700 rounded-lg p-3 text-white focus:border-[#D4AF37] outline-none transition-colors";

export const StatusScheduler: React.FC = () => {
    const { addToast } = useToast();
    const [scheduledStatus, setScheduledStatus] = useState<ScheduledStatus[]>([]);
    const [loading, setLoading] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Form state
    const [formData, setFormData] = useState({
        image_url: '',
        caption: '',
        scheduled_date: new Date().toISOString().split('T')[0],
        scheduled_time: '09:00'
    });

    useEffect(() => {
        loadScheduledStatus();
    }, []);

    const loadScheduledStatus = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('scheduled_status')
            .select('*')
            .order('scheduled_at', { ascending: false })
            .limit(50);

        if (!error && data) {
            setScheduledStatus(data);
        }
        setLoading(false);
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validar tamanho (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            addToast('Imagem muito grande. Máximo 5MB.', 'error');
            return;
        }

        // Validar tipo
        if (!file.type.startsWith('image/')) {
            addToast('Arquivo inválido. Apenas imagens são permitidas.', 'error');
            return;
        }

        setUploading(true);

        try {
            // Gerar nome único
            const fileName = `status_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${file.name.split('.').pop()}`;

            // Upload para Supabase Storage
            const { data, error } = await supabase.storage
                .from('status-images')
                .upload(fileName, file, { cacheControl: '3600', upsert: false });

            if (error) {
                // Se o bucket não existe, criar
                if (error.message.includes('not found')) {
                    addToast('Bucket de imagens não configurado. Configure o Storage.', 'error');
                } else {
                    throw error;
                }
                setUploading(false);
                return;
            }

            // Obter URL pública
            const { data: { publicUrl } } = supabase.storage
                .from('status-images')
                .getPublicUrl(fileName);

            setFormData({ ...formData, image_url: publicUrl });
            addToast('Imagem enviada!', 'success');
        } catch (err: any) {
            console.error('Upload error:', err);
            addToast(`Erro no upload: ${err.message}`, 'error');
        }

        setUploading(false);
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

        setLoading(true);

        try {
            // Combinar data e hora
            const scheduledAt = new Date(`${formData.scheduled_date}T${formData.scheduled_time}:00`);

            // Verificar se é no futuro
            if (scheduledAt <= new Date()) {
                addToast('A data/hora deve ser no futuro.', 'warning');
                setLoading(false);
                return;
            }

            const { error } = await supabase
                .from('scheduled_status')
                .insert({
                    image_url: formData.image_url,
                    caption: formData.caption || null,
                    scheduled_at: scheduledAt.toISOString(),
                    status: 'PENDING'
                });

            if (error) throw error;

            addToast('Status agendado com sucesso!', 'success');
            setIsModalOpen(false);
            setFormData({
                image_url: '',
                caption: '',
                scheduled_date: new Date().toISOString().split('T')[0],
                scheduled_time: '09:00'
            });
            loadScheduledStatus();
        } catch (err: any) {
            console.error('Schedule error:', err);
            addToast(`Erro: ${err.message}`, 'error');
        }

        setLoading(false);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Excluir este agendamento?')) return;

        const { error } = await supabase
            .from('scheduled_status')
            .delete()
            .eq('id', id);

        if (!error) {
            addToast('Agendamento excluído.', 'info');
            loadScheduledStatus();
        } else {
            addToast('Erro ao excluir.', 'error');
        }
    };

    const handlePostNow = async (id: string) => {
        if (!confirm('Postar este status agora?')) return;

        // Atualizar scheduled_at para agora
        const { error } = await supabase
            .from('scheduled_status')
            .update({ scheduled_at: new Date().toISOString() })
            .eq('id', id);

        if (!error) {
            addToast('Status será postado em instantes!', 'success');

            // Trigger a função manualmente
            try {
                const response = await fetch('https://cwhiujeragsethxjekkb.supabase.co/functions/v1/post-status', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN3aGl1amVyYWdzZXRoeGpla2tiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQ4MTMyNTQsImV4cCI6MjA1MDM4OTI1NH0.S1v7GGqx67lMplBGKMTfXGfqBP1o10R7FMitcqK1XEQ',
                        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN3aGl1amVyYWdzZXRoeGpla2tiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQ4MTMyNTQsImV4cCI6MjA1MDM4OTI1NH0.S1v7GGqx67lMplBGKMTfXGfqBP1o10R7FMitcqK1XEQ'
                    }
                });
                const data = await response.json();
                if (!response.ok) throw new Error(data.error || 'Erro ao postar');
                console.log('Post Status Result:', data);
            } catch (e) {
                console.error('Error invoking post-status:', e);
                addToast('Erro ao invocar função de postagem (ver console)', 'error');
            }

            setTimeout(() => loadScheduledStatus(), 3000);
        }
    };

    const handleRetry = async (id: string) => {
        const { error } = await supabase
            .from('scheduled_status')
            .update({
                status: 'PENDING',
                scheduled_at: new Date().toISOString(),
                error_message: null
            })
            .eq('id', id);

        if (!error) {
            addToast('Tentando novamente...', 'info');

            try {
                await fetch('https://cwhiujeragsethxjekkb.supabase.co/functions/v1/post-status', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN3aGl1amVyYWdzZXRoeGpla2tiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQ4MTMyNTQsImV4cCI6MjA1MDM4OTI1NH0.S1v7GGqx67lMplBGKMTfXGfqBP1o10R7FMitcqK1XEQ',
                        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN3aGl1amVyYWdzZXRoeGpla2tiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQ4MTMyNTQsImV4cCI6MjA1MDM4OTI1NH0.S1v7GGqx67lMplBGKMTfXGfqBP1o10R7FMitcqK1XEQ'
                    }
                });
            } catch (e) {
                console.log('Function triggered');
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

    // Estado do filtro
    const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'POSTED' | 'FAILED'>('ALL');

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
                            <div key={item.id} className="p-4 flex items-center gap-4 hover:bg-zinc-800/50 transition-colors">
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
                                        <button
                                            onClick={() => handlePostNow(item.id)}
                                            className="p-2 hover:bg-green-900/30 rounded text-green-500 hover:text-green-400"
                                            title="Postar agora"
                                        >
                                            <Play size={16} />
                                        </button>
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
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in zoom-in duration-200 max-h-[90vh] overflow-y-auto">
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
                                    onChange={handleImageUpload}
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

                            {/* Data e Hora */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm text-zinc-400 mb-1">Data *</label>
                                    <input
                                        type="date"
                                        value={formData.scheduled_date}
                                        onChange={(e) => setFormData({ ...formData, scheduled_date: e.target.value })}
                                        min={new Date().toISOString().split('T')[0]}
                                        className={inputStyle}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-zinc-400 mb-1">Hora *</label>
                                    <input
                                        type="time"
                                        value={formData.scheduled_time}
                                        onChange={(e) => setFormData({ ...formData, scheduled_time: e.target.value })}
                                        className={inputStyle}
                                    />
                                </div>
                            </div>

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
                                    Agendar
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
