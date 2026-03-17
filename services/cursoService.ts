/**
 * cursoService.ts — Micro-LMS API client
 * Todos os métodos usam o api (ApiClient) autenticado via JWT.
 */
import { api } from './apiClient';

export interface Lesson {
  id: string;
  moduleId: string;
  title: string;
  description?: string;
  descriptionHtml?: string;
  videoUrl?: string;
  materialUrl?: string;
  attachments?: Array<{
    name: string;
    url: string;
    type: string;
    size: number;
  }>;
  order: number;
  duration?: number;
  progress?: { isCompleted: boolean; completedAt?: string }[];
}

export interface Module {
  id: string;
  courseId: string;
  title: string;
  description?: string;
  order: number;
  lessons: Lesson[];
}

export interface Course {
  id: string;
  title: string;
  description?: string;
  modules: Module[];
}

export interface PlayerData {
  course: Course;
  stats: {
    totalLessons: number;
    completedLessons: number;
    progressPercent: number;
  };
}

export interface PresignedResult {
  presignedUrl: string;
  key: string;
  publicUrl: string;
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  phone?: string;
  hasCourseAccess: boolean;
  createdAt: string;
}

const BASE = '/curso';

export const cursoService = {
  // ── Aluno ──────────────────────────────────────────────────────────────────

  /** Retorna curso completo com progresso do usuário autenticado */
  getPlayer: (): Promise<PlayerData> =>
    api.get(`${BASE}/player`).then(r => r.data),

  /** Retorna apenas o progresso (ids das aulas concluídas) */
  getProgress: (): Promise<{ lessonId: string; isCompleted: boolean; completedAt?: string }[]> =>
    api.get(`${BASE}/progress`).then(r => r.data),

  /** Marca ou desmarca uma aula como concluída */
  markLesson: (lessonId: string, isCompleted = true): Promise<void> =>
    api.post(`${BASE}/progress/${lessonId}`, { isCompleted }).then(r => r.data),

  // ── Admin — Upload ─────────────────────────────────────────────────────────

  /**
   * Passo 1: Solicita uma Presigned URL ao backend.
   * O backend gera um nome único (uuid) e retorna a URL de upload direto para o R2.
   */
  getPresignedUrl: (fileName: string, contentType: string): Promise<PresignedResult> =>
    api.post(`${BASE}/upload/presigned`, { fileName, contentType }).then(r => r.data),

  /**
   * Passo 2: Faz o PUT do arquivo diretamente para a URL do R2.
   * NÃO passa pelo nosso backend — vai direto para o Cloudflare.
   * Retorna um AbortController para permitir cancelamento.
   */
  uploadToR2: (
    presignedUrl: string,
    file: File,
    onProgress: (pct: number) => void
  ): { promise: Promise<void>; abort: () => void } => {
    const xhr = new XMLHttpRequest();
    const abort = () => xhr.abort();

    const promise = new Promise<void>((resolve, reject) => {
      xhr.open('PUT', presignedUrl, true);
      xhr.setRequestHeader('Content-Type', file.type);

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          reject(new Error(`Upload falhou: HTTP ${xhr.status}`));
        }
      };

      xhr.onerror = () => reject(new Error('Erro de rede durante o upload.'));
      xhr.onabort = () => reject(new Error('Upload cancelado.'));

      xhr.send(file);
    });

    return { promise, abort };
  },

  // ── Admin — Módulos ────────────────────────────────────────────────────────

  createModule: (data: { title: string; description?: string; order?: number }): Promise<Module> =>
    api.post(`${BASE}/modules`, data).then(r => r.data),

  updateModule: (id: string, data: Partial<{ title: string; description: string; order: number }>): Promise<Module> =>
    api.put(`${BASE}/modules/${id}`, data).then(r => r.data),

  deleteModule: (id: string): Promise<void> =>
    api.delete(`${BASE}/modules/${id}`).then(r => r.data),

  // ── Admin — Aulas ──────────────────────────────────────────────────────────

  createLesson: (data: {
    moduleId: string;
    title: string;
    description?: string;
    descriptionHtml?: string;
    videoUrl?: string;
    materialUrl?: string;
    attachments?: Array<{ name: string; url: string; type: string; size: number }>;
    order?: number;
    duration?: number;
  }): Promise<Lesson> =>
    api.post(`${BASE}/lessons`, data).then(r => r.data),

  updateLesson: (id: string, data: Partial<{
    title: string;
    description: string;
    descriptionHtml: string;
    videoUrl: string;
    materialUrl: string;
    attachments: Array<{ name: string; url: string; type: string; size: number }>;
    order: number;
    duration: number;
  }>): Promise<Lesson> =>
    api.put(`${BASE}/lessons/${id}`, data).then(r => r.data),

  deleteLesson: (id: string): Promise<void> =>
    api.delete(`${BASE}/lessons/${id}`).then(r => r.data),

  // ── Admin — Usuários ───────────────────────────────────────────────────────

  /** Retorna curso completo para admin (sem verificar hasCourseAccess) */
  getAdminCourse: (): Promise<{ course: Course }> =>
    api.get(`${BASE}/admin/course`).then(r => r.data),

  getAdminUsers: (): Promise<AdminUser[]> =>
    api.get(`${BASE}/admin/users`).then(r => r.data),

  setUserAccess: (userId: string, hasCourseAccess: boolean): Promise<AdminUser> =>
    api.patch(`${BASE}/admin/users/${userId}/access`, { hasCourseAccess }).then(r => r.data),
};
