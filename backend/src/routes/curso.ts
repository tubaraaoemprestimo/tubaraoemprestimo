/**
 * /api/curso — Micro-LMS routes
 *
 * Endpoints:
 *   POST   /api/curso/upload/presigned          → Gera presigned PUT URL para Cloudflare R2
 *   POST   /api/curso/lessons                   → Salva aula no banco após upload concluído
 *   PUT    /api/curso/lessons/:id               → Atualiza aula
 *   DELETE /api/curso/lessons/:id               → Remove aula
 *
 *   POST   /api/curso/modules                   → Cria módulo
 *   PUT    /api/curso/modules/:id               → Atualiza módulo
 *   DELETE /api/curso/modules/:id               → Remove módulo
 *
 *   GET    /api/curso/player                    → Retorna curso completo (módulos + aulas) para o aluno
 *   POST   /api/curso/progress/:lessonId        → Marca/desmarca aula como concluída
 *   GET    /api/curso/progress                  → Retorna progresso do usuário autenticado
 *
 *   GET    /api/curso/admin/lessons             → Lista todas as aulas (admin)
 *   GET    /api/curso/admin/users               → Lista usuários com/sem acesso (admin)
 *   PATCH  /api/curso/admin/users/:userId/access → Liga/desliga acesso de um usuário
 */

import { Router, Request, Response, RequestHandler } from 'express';
import { PrismaClient } from '@prisma/client';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';
import { authenticate, requireAdmin } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// ─── Cloudflare R2 client ────────────────────────────────────────────────────
//
// Variáveis de ambiente necessárias no .env do backend:
//   R2_ACCOUNT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
//   R2_ACCESS_KEY_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
//   R2_SECRET_ACCESS_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
//   R2_BUCKET_NAME=tubarao-videos
//   R2_PUBLIC_URL=https://pub-<hash>.r2.dev   (URL pública do bucket)
//
const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId:     process.env.R2_ACCESS_KEY_ID     ?? '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? '',
  },
});

const BUCKET  = process.env.R2_BUCKET_NAME ?? 'tubarao-videos';
const R2_BASE = (process.env.R2_PUBLIC_URL ?? '').replace(/\/$/, '');

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildPublicUrl(key: string): string {
  return `${R2_BASE}/${key}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// UPLOAD — Gerar Presigned URL para PUT direto do browser → R2
// POST /api/curso/upload/presigned
// Body: { fileName: string; contentType: string }
// Auth: requireAdmin
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  '/upload/presigned',
  authenticate,
  requireAdmin,
  async (req: Request, res: Response) => {
    const { fileName, contentType } = req.body as {
      fileName: string;
      contentType: string;
    };

    if (!fileName || !contentType) {
      return res.status(400).json({ error: 'fileName e contentType são obrigatórios.' });
    }

    // Normaliza extensão para aceitar apenas mp4
    const ext = fileName.split('.').pop()?.toLowerCase() ?? 'mp4';
    if (!['mp4', 'mov', 'webm'].includes(ext)) {
      return res.status(400).json({ error: 'Apenas arquivos de vídeo (mp4, mov, webm) são aceitos.' });
    }

    // Chave única no bucket: videos/<uuid>.ext
    const key = `videos/${uuidv4()}.${ext}`;

    const command = new PutObjectCommand({
      Bucket:      BUCKET,
      Key:         key,
      ContentType: contentType,
    });

    // Presigned URL válida por 5 minutos
    const presignedUrl = await getSignedUrl(r2, command, { expiresIn: 300 });

    return res.json({
      presignedUrl,          // URL para o browser fazer PUT diretamente
      key,                   // Guarda para enviar na etapa 2 (salvar aula)
      publicUrl: buildPublicUrl(key), // URL final pública do vídeo
    });
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN — Criar módulo
// POST /api/curso/modules
// Body: { courseId?, title, description?, order? }
// Auth: requireAdmin
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  '/modules',
  authenticate,
  requireAdmin,
  async (req: Request, res: Response) => {
    const { title, description, order } = req.body as {
      title: string;
      description?: string;
      order?: number;
    };

    if (!title) {
      return res.status(400).json({ error: 'title é obrigatório.' });
    }

    // Garante que existe exatamente 1 curso (single-product LMS)
    let course = await prisma.course.findFirst();
    if (!course) {
      course = await prisma.course.create({
        data: {
          title:       'Método Tubarão',
          description: 'O sistema completo para construir um negócio de empréstimos.',
          isPublished:  true,
        },
      });
    }

    const module = await prisma.module.create({
      data: {
        courseId:    course.id,
        title,
        description: description ?? null,
        order:       order ?? 0,
      },
    });

    return res.status(201).json(module);
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN — Atualizar módulo
// PUT /api/curso/modules/:id
// ─────────────────────────────────────────────────────────────────────────────
router.put(
  '/modules/:id',
  authenticate,
  requireAdmin,
  async (req: Request, res: Response) => {
    const id = String(req.params.id);
    const { title, description, order } = req.body as {
      title?: string;
      description?: string;
      order?: number;
    };

    const module = await prisma.module.update({
      where: { id },
      data: {
        ...(title       !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(order       !== undefined && { order }),
      },
    });

    return res.json(module);
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN — Deletar módulo (cascade deleta aulas + progresso)
// DELETE /api/curso/modules/:id
// ─────────────────────────────────────────────────────────────────────────────
router.delete(
  '/modules/:id',
  authenticate,
  requireAdmin,
  async (req: Request, res: Response) => {
    await prisma.module.delete({ where: { id: String(req.params.id) } });
    return res.json({ ok: true });
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN — Salvar aula após upload concluído no R2
// POST /api/curso/lessons
// Body: { moduleId, title, description?, videoUrl, materialUrl?, order?, duration? }
// Auth: requireAdmin
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  '/lessons',
  authenticate,
  requireAdmin,
  async (req: Request, res: Response) => {
    const { moduleId, title, description, descriptionHtml, videoUrl, materialUrl, attachments, order, duration } = req.body as {
      moduleId:         string;
      title:            string;
      description?:     string;
      descriptionHtml?: string;
      videoUrl?:        string;
      materialUrl?:     string;
      attachments?:     any[];
      order?:           number;
      duration?:        number;
    };

    if (!moduleId || !title) {
      return res.status(400).json({ error: 'moduleId e title são obrigatórios.' });
    }

    const lesson = await prisma.lesson.create({
      data: {
        moduleId,
        title,
        description:     description     ?? null,
        descriptionHtml: descriptionHtml ?? null,
        videoUrl:        videoUrl        ?? null,
        materialUrl:     materialUrl     ?? null,
        attachments:     attachments     ?? [],
        order:           order           ?? 0,
        duration:        duration        ?? null,
      },
    });

    return res.status(201).json(lesson);
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN — Atualizar aula
// PUT /api/curso/lessons/:id
// ─────────────────────────────────────────────────────────────────────────────
router.put(
  '/lessons/:id',
  authenticate,
  requireAdmin,
  async (req: Request, res: Response) => {
    const id = String(req.params.id);
    const { title, description, descriptionHtml, videoUrl, materialUrl, attachments, order, duration } = req.body as {
      title?:           string;
      description?:     string;
      descriptionHtml?: string;
      videoUrl?:        string;
      materialUrl?:     string;
      attachments?:     any[];
      order?:           number;
      duration?:        number;
    };

    const lesson = await prisma.lesson.update({
      where: { id },
      data: {
        ...(title           !== undefined && { title }),
        ...(description     !== undefined && { description }),
        ...(descriptionHtml !== undefined && { descriptionHtml }),
        ...(videoUrl        !== undefined && { videoUrl }),
        ...(materialUrl     !== undefined && { materialUrl }),
        ...(attachments     !== undefined && { attachments }),
        ...(order           !== undefined && { order }),
        ...(duration        !== undefined && { duration }),
      },
    });

    return res.json(lesson);
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN — Deletar aula
// DELETE /api/curso/lessons/:id
// ─────────────────────────────────────────────────────────────────────────────
router.delete(
  '/lessons/:id',
  authenticate,
  requireAdmin,
  async (req: Request, res: Response) => {
    await prisma.lesson.delete({ where: { id: String(req.params.id) } });
    return res.json({ ok: true });
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN — Buscar curso completo (sem verificar hasCourseAccess)
// GET /api/curso/admin/course
// ─────────────────────────────────────────────────────────────────────────────
router.get(
  '/admin/course',
  authenticate,
  requireAdmin,
  async (_req: Request, res: Response) => {
    // Busca curso com módulos e aulas (sem verificar acesso do usuário)
    const course = await prisma.course.findFirst({
      where: { isPublished: true },
      include: {
        modules: {
          orderBy: { order: 'asc' },
          include: {
            lessons: {
              orderBy: { order: 'asc' },
            },
          },
        },
      },
    });

    if (!course) {
      return res.status(404).json({ error: 'Nenhum curso encontrado.' });
    }

    return res.json({ course });
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN — Listar usuários com/sem acesso ao curso
// GET /api/curso/admin/users
// ─────────────────────────────────────────────────────────────────────────────
router.get(
  '/admin/users',
  authenticate,
  requireAdmin,
  async (_req: Request, res: Response) => {
    const users = await prisma.user.findMany({
      select: {
        id:              true,
        name:            true,
        email:           true,
        phone:           true,
        hasCourseAccess: true,
        createdAt:       true,
      },
      orderBy: { createdAt: 'desc' },
    });
    return res.json(users);
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN — Ligar/desligar acesso ao curso para um usuário
// PATCH /api/curso/admin/users/:userId/access
// Body: { hasCourseAccess: boolean }
// ─────────────────────────────────────────────────────────────────────────────
router.patch(
  '/admin/users/:userId/access',
  authenticate,
  requireAdmin,
  async (req: Request, res: Response) => {
    const userId = String(req.params.userId);
    const { hasCourseAccess } = req.body as { hasCourseAccess: boolean };

    if (typeof hasCourseAccess !== 'boolean') {
      return res.status(400).json({ error: 'hasCourseAccess deve ser boolean.' });
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data:  { hasCourseAccess },
      select: { id: true, name: true, email: true, hasCourseAccess: true },
    });

    return res.json(user);
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// ALUNO — Buscar curso completo com progresso do usuário
// GET /api/curso/player
// Auth: authenticate (qualquer usuário autenticado com acesso)
// ─────────────────────────────────────────────────────────────────────────────
router.get(
  '/player',
  authenticate,
  async (req: Request, res: Response) => {
    const userId = req.user!.id;

    // Verifica acesso
    const user = await prisma.user.findUnique({
      where:  { id: userId },
      select: { hasCourseAccess: true },
    });

    if (!user?.hasCourseAccess) {
      return res.status(403).json({ error: 'Acesso ao curso não autorizado.' });
    }

    // Busca curso com módulos, aulas e progresso do usuário
    const course = await prisma.course.findFirst({
      where: { isPublished: true },
      include: {
        modules: {
          orderBy: { order: 'asc' },
          include: {
            lessons: {
              orderBy: { order: 'asc' },
              include: {
                progress: {
                  where: { userId },
                  select: { isCompleted: true, completedAt: true },
                },
              },
            },
          },
        },
      },
    });

    if (!course) {
      return res.status(404).json({ error: 'Nenhum curso publicado encontrado.' });
    }

    // Calcula totais de progresso
    const allLessons  = course.modules.flatMap(m => m.lessons);
    const totalLessons     = allLessons.length;
    const completedLessons = allLessons.filter(l => l.progress[0]?.isCompleted).length;
    const progressPercent  = totalLessons > 0
      ? Math.round((completedLessons / totalLessons) * 100)
      : 0;

    return res.json({
      course,
      stats: { totalLessons, completedLessons, progressPercent },
    });
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// ALUNO — Marcar / desmarcar aula como concluída
// POST /api/curso/progress/:lessonId
// Body: { isCompleted: boolean }
// Auth: authenticate
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  '/progress/:lessonId',
  authenticate,
  async (req: Request, res: Response) => {
    const userId   = (req as any).user?.id as string;
    const lessonId = String(req.params.lessonId);
    const { isCompleted = true } = req.body as { isCompleted?: boolean };

    // Verifica acesso
    const user = await prisma.user.findUnique({
      where:  { id: userId },
      select: { hasCourseAccess: true },
    });

    if (!user?.hasCourseAccess) {
      return res.status(403).json({ error: 'Acesso ao curso não autorizado.' });
    }

    // Upsert do progresso
    const progress = await prisma.userProgress.upsert({
      where: { userId_lessonId: { userId, lessonId } },
      create: {
        userId,
        lessonId,
        isCompleted,
        completedAt: isCompleted ? new Date() : null,
      },
      update: {
        isCompleted,
        completedAt: isCompleted ? new Date() : null,
      },
    });

    return res.json(progress);
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// ALUNO — Retorna apenas o progresso do usuário (para sidebar)
// GET /api/curso/progress
// ─────────────────────────────────────────────────────────────────────────────
router.get(
  '/progress',
  authenticate,
  async (req: Request, res: Response) => {
    const userId = req.user!.id;

    const progress = await prisma.userProgress.findMany({
      where: { userId },
      select: { lessonId: true, isCompleted: true, completedAt: true },
    });

    return res.json(progress);
  }
);

export { router as cursoRouter };
