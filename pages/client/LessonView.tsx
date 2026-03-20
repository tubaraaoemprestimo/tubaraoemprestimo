import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Play, Download, MessageCircle, Send, Edit2, Trash2, CheckCircle } from 'lucide-react';
import { apiService } from '../../services/apiService';
import { useToast } from '../../components/Toast';
import { Button } from '../../components/Button';

interface Comment {
  id: string;
  content: string;
  createdAt: string;
  user: {
    id: string;
    name: string;
    avatarUrl?: string;
    role: string;
  };
  isAdminReply: boolean;
  replies: Comment[];
}

interface Material {
  id: string;
  title: string;
  fileUrl: string;
  fileType: string;
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

export function LessonView() {
  const { lessonId } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [editingComment, setEditingComment] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadLesson();
    loadComments();
  }, [lessonId]);

  const loadLesson = async () => {
    try {
      const data = await apiService.getLesson(lessonId!);
      setLesson(data);
    } catch (err: any) {
      addToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadComments = async () => {
    try {
      const data = await apiService.getLessonComments(lessonId!);
      setComments(data);
    } catch (err: any) {
      addToast(err.message, 'error');
    }
  };

  const handleSubmitComment = async () => {
    if (!newComment.trim()) return;
    setSubmitting(true);
    try {
      await apiService.createComment(lessonId!, { content: newComment });
      setNewComment('');
      loadComments();
      addToast('Comentário enviado!', 'success');
    } catch (err: any) {
      addToast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitReply = async (parentId: string) => {
    if (!replyContent.trim()) return;
    setSubmitting(true);
    try {
      await apiService.createComment(lessonId!, { content: replyContent, parentId });
      setReplyContent('');
      setReplyingTo(null);
      loadComments();
      addToast('Resposta enviada!', 'success');
    } catch (err: any) {
      addToast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditComment = async (commentId: string) => {
    if (!editContent.trim()) return;
    setSubmitting(true);
    try {
      await apiService.updateComment(commentId, { content: editContent });
      setEditContent('');
      setEditingComment(null);
      loadComments();
      addToast('Comentário atualizado!', 'success');
    } catch (err: any) {
      addToast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm('Deseja realmente excluir este comentário?')) return;
    try {
      await apiService.deleteComment(commentId);
      loadComments();
      addToast('Comentário excluído!', 'success');
    } catch (err: any) {
      addToast(err.message, 'error');
    }
  };

  const handleMarkComplete = async () => {
    try {
      await apiService.markLessonComplete(lessonId!);
      addToast('Aula concluída!', 'success');
    } catch (err: any) {
      addToast(err.message, 'error');
    }
  };

  const renderComment = (comment: Comment, isReply = false) => (
    <div key={comment.id} className={`${isReply ? 'ml-12 mt-4' : 'mt-6'}`}>
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#D4AF37] to-[#8B4513] flex items-center justify-center text-white font-bold">
              {comment.user.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="font-bold text-white flex items-center gap-2">
                {comment.user.name}
                {comment.user.role === 'ADMIN' && (
                  <span className="text-xs bg-[#D4AF37] text-black px-2 py-0.5 rounded">ADMIN</span>
                )}
              </p>
              <p className="text-xs text-zinc-500">
                {new Date(comment.createdAt).toLocaleString('pt-BR')}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setReplyingTo(comment.id)}
              className="text-zinc-400 hover:text-white text-sm"
            >
              <MessageCircle size={16} />
            </button>
            <button
              onClick={() => {
                setEditingComment(comment.id);
                setEditContent(comment.content);
              }}
              className="text-zinc-400 hover:text-white text-sm"
            >
              <Edit2 size={16} />
            </button>
            <button
              onClick={() => handleDeleteComment(comment.id)}
              className="text-red-400 hover:text-red-300 text-sm"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>

        {editingComment === comment.id ? (
          <div className="mt-4">
            <textarea
              value={editContent}
              onChange={e => setEditContent(e.target.value)}
              className="w-full bg-black border border-zinc-700 rounded-lg px-4 py-2 text-white"
              rows={3}
            />
            <div className="flex gap-2 mt-2">
              <Button onClick={() => handleEditComment(comment.id)} disabled={submitting}>
                Salvar
              </Button>
              <Button variant="secondary" onClick={() => setEditingComment(null)}>
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-zinc-300 mt-3">{comment.content}</p>
        )}

        {replyingTo === comment.id && (
          <div className="mt-4">
            <textarea
              value={replyContent}
              onChange={e => setReplyContent(e.target.value)}
              placeholder="Escreva sua resposta..."
              className="w-full bg-black border border-zinc-700 rounded-lg px-4 py-2 text-white"
              rows={3}
            />
            <div className="flex gap-2 mt-2">
              <Button onClick={() => handleSubmitReply(comment.id)} disabled={submitting}>
                <Send size={16} className="mr-2" /> Responder
              </Button>
              <Button variant="secondary" onClick={() => setReplyingTo(null)}>
                Cancelar
              </Button>
            </div>
          </div>
        )}

        {comment.replies.length > 0 && (
          <div className="mt-4">
            {comment.replies.map(reply => renderComment(reply, true))}
          </div>
        )}
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white">Carregando...</div>
      </div>
    );
  }

  if (!lesson) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white">Aula não encontrada</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <div className="max-w-6xl mx-auto">
        {/* Video Player */}
        <div className="bg-zinc-900 rounded-2xl overflow-hidden mb-6">
          <video
            src={lesson.videoUrl}
            controls
            className="w-full aspect-video"
            onEnded={handleMarkComplete}
          />
        </div>

        {/* Lesson Info */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 mb-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">{lesson.title}</h1>
              <p className="text-zinc-400">{lesson.description}</p>
            </div>
            <Button onClick={handleMarkComplete}>
              <CheckCircle size={20} className="mr-2" /> Marcar como Concluída
            </Button>
          </div>
        </div>

        {/* Materials */}
        {lesson.materials.length > 0 && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 mb-6">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Download size={20} /> Materiais de Apoio
            </h2>
            <div className="grid gap-3">
              {lesson.materials.map(material => (
                <a
                  key={material.id}
                  href={material.fileUrl}
                  download
                  className="flex items-center justify-between bg-black border border-zinc-700 rounded-lg px-4 py-3 hover:border-[#D4AF37] transition-all"
                >
                  <span className="text-white">{material.title}</span>
                  <Download size={18} className="text-[#D4AF37]" />
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Comments Section */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <MessageCircle size={20} /> Comentários ({comments.length})
          </h2>

          {/* New Comment */}
          <div className="mb-6">
            <textarea
              value={newComment}
              onChange={e => setNewComment(e.target.value)}
              placeholder="Deixe seu comentário ou dúvida..."
              className="w-full bg-black border border-zinc-700 rounded-lg px-4 py-3 text-white"
              rows={4}
            />
            <Button onClick={handleSubmitComment} disabled={submitting} className="mt-3">
              <Send size={16} className="mr-2" /> Enviar Comentário
            </Button>
          </div>

          {/* Comments List */}
          <div>
            {comments.length === 0 ? (
              <p className="text-zinc-500 text-center py-8">
                Nenhum comentário ainda. Seja o primeiro!
              </p>
            ) : (
              comments.map(comment => renderComment(comment))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
