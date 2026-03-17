/**
 * CursoAdmin — Painel de Gestão do Micro-LMS
 * Rota: /admin/curso
 *
 * Fluxo de upload (sem passar pelo backend):
 *   1. Admin seleciona arquivo .mp4
 *   2. Frontend pede Presigned URL ao backend  (POST /api/curso/upload/presigned)
 *   3. Frontend faz PUT direto para o R2       (XHR com barra de progresso)
 *   4. Frontend salva título + publicUrl        (POST /api/curso/lessons)
 *   5. Aluno vê a aula no exato momento        (API /player atualizada)
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  Plus, Trash2, Edit2, Upload, CheckCircle2, AlertCircle,
  ChevronDown, ChevronRight, GripVertical, Users, BookOpen,
  X, Loader2, Play, FileText
} from 'lucide-react';
import { cursoService, Module, Lesson, AdminUser } from '../../services/cursoService';
import { useToast } from '../../components/Toast';
import { RichTextEditor } from '../../components/RichTextEditor';

// ─── Tipos locais ─────────────────────────────────────────────────────────────

type UploadStatus = 'idle' | 'requesting' | 'uploading' | 'saving' | 'done' | 'error';

// ─── Modal de Nova / Editar Aula ──────────────────────────────────────────────

function LessonModal({
  moduleId,
  modules,
  editLesson,
  onClose,
  onSaved,
}: {
  moduleId: string;
  modules: Module[];
  editLesson?: Lesson;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { addToast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const attachmentRef = useRef<HTMLInputElement>(null);

  const [title, setTitle]           = useState(editLesson?.title ?? '');
  const [description, setDesc]      = useState(editLesson?.description ?? '');
  const [descriptionHtml, setDescHtml] = useState(editLesson?.descriptionHtml ?? '');
  const [selModuleId, setModuleId]  = useState(editLesson?.moduleId ?? moduleId);
  const [file, setFile]             = useState<File | null>(null);
  const [attachments, setAttachments] = useState<Array<{name: string; url: string; type: string; size: number}>>(
    editLesson?.attachments ?? []
  );
  const [uploadingAttachments, setUploadingAttachments] = useState(false);
  const [status, setStatus]         = useState<UploadStatus>('idle');
  const [progress, setProgress]     = useState(0);
  const [errorMsg, setError]        = useState('');
  const abortRef = useRef<(() => void) | null>(null);

  const isEdit = !!editLesson;

  const handleAttachmentSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setUploadingAttachments(true);
    try {
      const uploaded: Array<{name: string; url: string; type: string; size: number}> = [];

      for (const file of files) {
        // Solicitar presigned URL para attachment
        const { presignedUrl, publicUrl } = await cursoService.getPresignedUrl(
          file.name,
          file.type
        );

        // Upload direto para R2
        const { promise } = cursoService.uploadToR2(presignedUrl, file, () => {});
        await promise;

        uploaded.push({
          name: file.name,
          url: publicUrl,
          type: file.type,
          size: file.size,
        });
      }

      setAttachments(prev => [...prev, ...uploaded]);
      addToast(`${uploaded.length} arquivo(s) adicionado(s)`, 'success');
    } catch (err: any) {
      addToast(`Erro ao fazer upload: ${err.message}`, 'error');
    } finally {
      setUploadingAttachments(false);
      if (attachmentRef.current) attachmentRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { setError('Título obrigatório.'); return; }
    if (!isEdit && !file) { setError('Selecione um arquivo de vídeo.'); return; }
    setError('');

    try {
      let videoUrl = editLesson?.videoUrl;

      if (file) {
        // ── PASSO 1: Pede a Presigned URL ao backend ──────────────────────
        setStatus('requesting');
        const { presignedUrl, publicUrl } = await cursoService.getPresignedUrl(
          file.name,
          file.type || 'video/mp4'
        );

        // ── PASSO 2: PUT direto para o Cloudflare R2 ─────────────────────
        setStatus('uploading');
        setProgress(0);
        const { promise, abort } = cursoService.uploadToR2(
          presignedUrl,
          file,
          pct => setProgress(pct)
        );
        abortRef.current = abort;
        await promise;

        videoUrl = publicUrl;
      }

      // ── PASSO 3: Salva (ou atualiza) a aula no banco ──────────────────
      setStatus('saving');
      if (isEdit) {
        await cursoService.updateLesson(editLesson.id, {
          title: title.trim(),
          description: description.trim() || undefined,
          descriptionHtml: descriptionHtml.trim() || undefined,
          attachments,
          videoUrl,
        });
      } else {
        await cursoService.createLesson({
          moduleId: selModuleId,
          title: title.trim(),
          description: description.trim() || undefined,
          descriptionHtml: descriptionHtml.trim() || undefined,
          attachments,
          videoUrl,
        });
      }

      setStatus('done');
      addToast(isEdit ? 'Aula atualizada!' : 'Aula publicada com sucesso!', 'success');
      setTimeout(onSaved, 800);

    } catch (err: any) {
      setStatus('error');
      setError(err.message ?? 'Erro desconhecido.');
    }
  };

  const handleCancel = () => {
    abortRef.current?.();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-3xl bg-zinc-900 border border-zinc-700 rounded-2xl overflow-hidden my-8">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 sticky top-0 bg-zinc-900 z-10">
          <h2 className="font-black text-lg">{isEdit ? 'Editar Aula' : 'Nova Aula'}</h2>
          <button onClick={handleCancel} className="p-1.5 hover:bg-zinc-800 rounded-lg transition-all">
            <X size={18} className="text-zinc-400" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[calc(100vh-200px)] overflow-y-auto">
          {/* Módulo */}
          <div>
            <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
              Módulo
            </label>
            <select
              value={selModuleId}
              onChange={e => setModuleId(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#D4AF37]"
              disabled={isEdit}
            >
              {modules.map(m => (
                <option key={m.id} value={m.id}>{m.title}</option>
              ))}
            </select>
          </div>

          {/* Título */}
          <div>
            <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
              Título da Aula *
            </label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Ex: Como analisar crédito"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-[#D4AF37]"
            />
          </div>

          {/* Descrição */}
          <div>
            <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
              Descrição da Aula <span className="text-zinc-600 font-normal">(opcional)</span>
            </label>
            <RichTextEditor
              value={descriptionHtml}
              onChange={setDescHtml}
              placeholder="O que o aluno vai aprender nesta aula… Use formatação rica, links, tabelas, etc."
            />
          </div>

          {/* Upload de Vídeo */}
          <div>
            <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
              Arquivo de Vídeo {!isEdit && '*'}
            </label>

            {/* Preview do vídeo atual (edição) */}
            {isEdit && editLesson?.videoUrl && !file && (
              <div className="flex items-center gap-2 mb-2 px-3 py-2 bg-zinc-800/50 rounded-xl border border-zinc-700">
                <Play size={14} className="text-[#D4AF37] shrink-0" />
                <span className="text-xs text-zinc-400 truncate">Vídeo atual carregado</span>
              </div>
            )}

            {/* Barra de progresso durante upload */}
            {status === 'uploading' && (
              <div className="mb-3">
                <div className="flex justify-between text-xs text-zinc-400 mb-1">
                  <span>Enviando para Cloudflare R2…</span>
                  <span>{progress}%</span>
                </div>
                <div className="w-full bg-zinc-800 rounded-full h-2 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#D4AF37] to-[#FFD700] transition-all duration-100"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Input de arquivo */}
            <input
              ref={fileRef}
              type="file"
              accept="video/mp4,video/mov,video/webm"
              className="hidden"
              onChange={e => {
                const f = e.target.files?.[0];
                if (f) setFile(f);
              }}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={status === 'uploading' || status === 'saving'}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-zinc-800 hover:bg-zinc-700 border border-dashed border-zinc-600 hover:border-[#D4AF37]/60 rounded-xl text-sm text-zinc-400 hover:text-white transition-all disabled:opacity-50"
            >
              <Upload size={16} />
              {file ? file.name : isEdit ? 'Trocar vídeo (opcional)' : 'Selecionar vídeo (.mp4)'}
            </button>
            {file && (
              <p className="text-[11px] text-zinc-500 mt-1">
                {(file.size / 1024 / 1024).toFixed(1)} MB
              </p>
            )}
          </div>

          {/* Materiais Complementares */}
          <div>
            <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
              Materiais Complementares <span className="text-zinc-600 font-normal">(opcional)</span>
            </label>
            <input
              ref={attachmentRef}
              type="file"
              multiple
              accept=".pdf,.xlsx,.xls,.doc,.docx,.ppt,.pptx,.jpg,.jpeg,.png,.gif"
              className="hidden"
              onChange={handleAttachmentSelect}
            />
            <button
              type="button"
              onClick={() => attachmentRef.current?.click()}
              disabled={uploadingAttachments || status === 'uploading' || status === 'saving'}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-zinc-800 hover:bg-zinc-700 border border-dashed border-zinc-600 hover:border-[#D4AF37]/60 rounded-xl text-sm text-zinc-400 hover:text-white transition-all disabled:opacity-50"
            >
              <Upload size={16} />
              {uploadingAttachments ? 'Enviando...' : 'Adicionar PDFs, planilhas, imagens…'}
            </button>

            {/* Lista de attachments */}
            {attachments.length > 0 && (
              <div className="space-y-2 mt-3">
                {attachments.map((att, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2">
                    <FileText size={14} className="text-[#D4AF37] shrink-0" />
                    <span className="text-xs text-white flex-1 truncate">{att.name}</span>
                    <span className="text-[10px] text-zinc-500">{(att.size / 1024).toFixed(0)} KB</span>
                    <button
                      type="button"
                      onClick={() => setAttachments(prev => prev.filter((_, i) => i !== idx))}
                      className="text-red-400 hover:text-red-300 transition-colors"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Erro */}
          {errorMsg && (
            <div className="flex items-center gap-2 text-red-400 text-sm bg-red-400/10 px-4 py-3 rounded-xl">
              <AlertCircle size={16} className="shrink-0" />
              {errorMsg}
            </div>
          )}

          {/* Status de sucesso */}
          {status === 'done' && (
            <div className="flex items-center gap-2 text-green-400 text-sm bg-green-400/10 px-4 py-3 rounded-xl">
              <CheckCircle2 size={16} />
              {isEdit ? 'Aula atualizada com sucesso!' : 'Aula publicada! O aluno já pode assistir.'}
            </div>
          )}

          {/* Botões */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={handleCancel}
              disabled={status === 'uploading' || status === 'saving'}
              className="flex-1 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold rounded-xl transition-all disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={status === 'uploading' || status === 'saving' || status === 'requesting' || status === 'done'}
              className="flex-1 py-2.5 bg-gradient-to-r from-[#D4AF37] to-[#B8860B] text-black font-black rounded-xl hover:brightness-110 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {(status === 'requesting' || status === 'uploading' || status === 'saving') && (
                <Loader2 size={16} className="animate-spin" />
              )}
              {status === 'idle' && (isEdit ? 'Salvar Alterações' : 'Publicar Aula')}
              {status === 'requesting' && 'Preparando upload…'}
              {status === 'uploading' && `Enviando ${progress}%`}
              {status === 'saving' && 'Salvando no banco…'}
              {status === 'done' && '✓ Publicado!'}
              {status === 'error' && 'Tentar novamente'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Modal de Novo Módulo ─────────────────────────────────────────────────────

function ModuleModal({
  editModule,
  onClose,
  onSaved,
}: {
  editModule?: Module;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { addToast } = useToast();
  const [title, setTitle] = useState(editModule?.title ?? '');
  const [desc, setDesc]   = useState(editModule?.description ?? '');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      if (editModule) {
        await cursoService.updateModule(editModule.id, { title: title.trim(), description: desc.trim() || undefined });
      } else {
        await cursoService.createModule({ title: title.trim(), description: desc.trim() || undefined });
      }
      addToast(editModule ? 'Módulo atualizado!' : 'Módulo criado!', 'success');
      onSaved();
    } catch {
      addToast('Erro ao salvar módulo.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-md bg-zinc-900 border border-zinc-700 rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <h2 className="font-black text-lg">{editModule ? 'Editar Módulo' : 'Novo Módulo'}</h2>
          <button onClick={onClose}><X size={18} className="text-zinc-400" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Título do módulo"
            required
            className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-[#D4AF37]"
          />
          <textarea
            value={desc}
            onChange={e => setDesc(e.target.value)}
            rows={2}
            placeholder="Descrição (opcional)"
            className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-[#D4AF37] resize-none"
          />
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 bg-zinc-800 text-zinc-300 font-bold rounded-xl">Cancelar</button>
            <button type="submit" disabled={saving || !title.trim()} className="flex-1 py-2.5 bg-[#D4AF37] text-black font-black rounded-xl hover:brightness-110 disabled:opacity-60 flex items-center justify-center gap-2">
              {saving && <Loader2 size={14} className="animate-spin" />}
              {editModule ? 'Salvar' : 'Criar Módulo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Aba de Acesso dos Usuários ───────────────────────────────────────────────

function UsersTab() {
  const { addToast } = useToast();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [toggling, setToggling] = useState<string | null>(null);

  useEffect(() => {
    cursoService.getAdminUsers().then(u => { setUsers(u); setLoading(false); });
  }, []);

  const toggle = async (user: AdminUser) => {
    setToggling(user.id);
    try {
      const updated = await cursoService.setUserAccess(user.id, !user.hasCourseAccess);
      setUsers(prev => prev.map(u => u.id === updated.id ? { ...u, hasCourseAccess: updated.hasCourseAccess } : u));
      addToast(`Acesso ${updated.hasCourseAccess ? 'liberado' : 'removido'} para ${updated.name}`, 'success');
    } catch (err: any) {
      console.error('[CursoAdmin] Erro ao alterar acesso:', err);
      console.error('[CursoAdmin] Response:', err?.response?.data);
      addToast(`Erro ao alterar acesso: ${err?.response?.data?.error || err.message}`, 'error');
    } finally {
      setToggling(null);
    }
  };

  const filtered = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar usuário por nome ou email…"
          className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-[#D4AF37]"
        />
        <div className="text-xs text-zinc-500">
          {users.filter(u => u.hasCourseAccess).length} com acesso
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-[#D4AF37]" /></div>
      ) : (
        <div className="space-y-2">
          {filtered.map(user => (
            <div key={user.id} className="flex items-center gap-4 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3">
              <div className="w-9 h-9 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center shrink-0">
                <span className="text-sm font-bold text-[#D4AF37]">
                  {user.name.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white truncate">{user.name}</p>
                <p className="text-xs text-zinc-500 truncate">{user.email}</p>
              </div>
              <button
                onClick={() => toggle(user)}
                disabled={toggling === user.id}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0
                  ${user.hasCourseAccess ? 'bg-green-500' : 'bg-zinc-700'}
                  ${toggling === user.id ? 'opacity-50' : ''}`}
              >
                <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform
                  ${user.hasCourseAccess ? 'translate-x-6' : 'translate-x-1'}`}
                />
              </button>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="text-center py-8 text-zinc-600 text-sm">Nenhum usuário encontrado.</div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Componente Principal ─────────────────────────────────────────────────────

export const CursoAdmin: React.FC = () => {
  const { addToast } = useToast();
  const [tab, setTab] = useState<'conteudo' | 'usuarios'>('conteudo');
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Modais
  const [moduleModal, setModuleModal] = useState<{ open: boolean; edit?: Module }>({ open: false });
  const [lessonModal, setLessonModal] = useState<{ open: boolean; moduleId: string; edit?: Lesson }>({ open: false, moduleId: '' });

  const loadCourse = async () => {
    setLoading(true);
    try {
      const data = await cursoService.getAdminCourse();
      setModules(data.course.modules);
    } catch (err: any) {
      if (err?.response?.status !== 404) {
        addToast('Erro ao carregar curso.', 'error');
      }
      setModules([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadCourse(); }, []);

  const toggleExpand = (id: string) =>
    setExpandedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const deleteModule = async (id: string) => {
    if (!confirm('Excluir este módulo e todas as suas aulas?')) return;
    try {
      await cursoService.deleteModule(id);
      await loadCourse();
      addToast('Módulo excluído.', 'success');
    } catch {
      addToast('Erro ao excluir módulo.', 'error');
    }
  };

  const deleteLesson = async (id: string) => {
    if (!confirm('Excluir esta aula?')) return;
    try {
      await cursoService.deleteLesson(id);
      await loadCourse();
      addToast('Aula excluída.', 'success');
    } catch {
      addToast('Erro ao excluir aula.', 'error');
    }
  };

  const totalLessons = modules.reduce((acc, m) => acc + m.lessons.length, 0);

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black flex items-center gap-2">
            <BookOpen size={24} className="text-[#D4AF37]" />
            Método Tubarão — Curso
          </h1>
          <p className="text-zinc-500 text-sm mt-0.5">
            {modules.length} módulos · {totalLessons} aulas
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-zinc-900 border border-zinc-800 rounded-xl p-1">
        {[
          { key: 'conteudo', label: 'Conteúdo', icon: <BookOpen size={14} /> },
          { key: 'usuarios', label: 'Acesso dos Alunos', icon: <Users size={14} /> },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as any)}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-sm font-bold transition-all
              ${tab === t.key
                ? 'bg-[#D4AF37] text-black'
                : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* ── ABA CONTEÚDO ── */}
      {tab === 'conteudo' && (
        <div>
          {/* Botão novo módulo */}
          <button
            onClick={() => setModuleModal({ open: true })}
            className="flex items-center gap-2 mb-4 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 hover:border-[#D4AF37]/50 text-zinc-300 hover:text-white text-sm font-bold rounded-xl transition-all"
          >
            <Plus size={16} />
            Novo Módulo
          </button>

          {loading ? (
            <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin text-[#D4AF37]" /></div>
          ) : modules.length === 0 ? (
            <div className="text-center py-16 text-zinc-600">
              <BookOpen size={48} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">Nenhum módulo criado ainda.</p>
              <p className="text-xs mt-1">Crie um módulo para começar a adicionar aulas.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {modules.map(module => (
                <div key={module.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
                  {/* Header do Módulo */}
                  <div className="flex items-center gap-3 px-4 py-3.5 hover:bg-zinc-800/40 transition-all">
                    <button onClick={() => toggleExpand(module.id)} className="flex-1 flex items-center gap-3 text-left">
                      {expandedIds.has(module.id)
                        ? <ChevronDown size={16} className="text-zinc-500 shrink-0" />
                        : <ChevronRight size={16} className="text-zinc-500 shrink-0" />}
                      <div>
                        <p className="font-bold text-white">{module.title}</p>
                        <p className="text-xs text-zinc-500">{module.lessons.length} aulas</p>
                      </div>
                    </button>
                    {/* Ações módulo */}
                    <div className="flex gap-1">
                      <button
                        onClick={() => setLessonModal({ open: true, moduleId: module.id })}
                        className="p-2 hover:bg-[#D4AF37]/10 rounded-lg transition-all group"
                        title="Nova aula"
                      >
                        <Plus size={15} className="text-zinc-500 group-hover:text-[#D4AF37]" />
                      </button>
                      <button
                        onClick={() => setModuleModal({ open: true, edit: module })}
                        className="p-2 hover:bg-zinc-700 rounded-lg transition-all"
                        title="Editar módulo"
                      >
                        <Edit2 size={15} className="text-zinc-500" />
                      </button>
                      <button
                        onClick={() => deleteModule(module.id)}
                        className="p-2 hover:bg-red-500/10 rounded-lg transition-all group"
                        title="Excluir módulo"
                      >
                        <Trash2 size={15} className="text-zinc-500 group-hover:text-red-400" />
                      </button>
                    </div>
                  </div>

                  {/* Lista de Aulas */}
                  {expandedIds.has(module.id) && (
                    <div className="border-t border-zinc-800">
                      {module.lessons.length === 0 ? (
                        <div className="px-4 py-3 text-xs text-zinc-600 text-center">
                          Nenhuma aula ainda.{' '}
                          <button
                            className="text-[#D4AF37] underline"
                            onClick={() => setLessonModal({ open: true, moduleId: module.id })}
                          >
                            Adicionar aula
                          </button>
                        </div>
                      ) : (
                        module.lessons.map(lesson => (
                          <div
                            key={lesson.id}
                            className="flex items-center gap-3 px-6 py-3 border-b border-zinc-800/60 last:border-0 hover:bg-zinc-800/30 transition-all"
                          >
                            <GripVertical size={14} className="text-zinc-700 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-zinc-200 truncate">{lesson.title}</p>
                              {lesson.videoUrl && (
                                <p className="text-[10px] text-green-500 mt-0.5 flex items-center gap-1">
                                  <CheckCircle2 size={10} />
                                  Vídeo carregado
                                </p>
                              )}
                            </div>
                            <div className="flex gap-1">
                              <button
                                onClick={() => setLessonModal({ open: true, moduleId: module.id, edit: lesson })}
                                className="p-1.5 hover:bg-zinc-700 rounded-lg transition-all"
                              >
                                <Edit2 size={13} className="text-zinc-500" />
                              </button>
                              <button
                                onClick={() => deleteLesson(lesson.id)}
                                className="p-1.5 hover:bg-red-500/10 rounded-lg transition-all group"
                              >
                                <Trash2 size={13} className="text-zinc-600 group-hover:text-red-400" />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── ABA USUÁRIOS ── */}
      {tab === 'usuarios' && <UsersTab />}

      {/* ── Modais ── */}
      {moduleModal.open && (
        <ModuleModal
          editModule={moduleModal.edit}
          onClose={() => setModuleModal({ open: false })}
          onSaved={() => { setModuleModal({ open: false }); loadCourse(); }}
        />
      )}

      {lessonModal.open && (
        <LessonModal
          moduleId={lessonModal.moduleId}
          modules={modules}
          editLesson={lessonModal.edit}
          onClose={() => setLessonModal({ open: false, moduleId: '' })}
          onSaved={() => { setLessonModal({ open: false, moduleId: '' }); loadCourse(); }}
        />
      )}
    </div>
  );
};
