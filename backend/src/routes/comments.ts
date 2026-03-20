import { Router, Request, Response } from 'express';
import { prisma } from '../services/prisma';
import { authenticate } from '../middleware/auth';

const requireAuth = authenticate;

const commentsRouter = Router();

/**
 * GET /api/comments/lesson/:lessonId
 * Lista comentários de uma aula
 */
commentsRouter.get('/lesson/:lessonId', requireAuth, async (req: Request, res: Response) => {
  try {
    const { lessonId } = req.params;

    const comments = await prisma.lessonComment.findMany({
      where: {
        lessonId,
        parentId: null // Apenas comentários principais (não replies)
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
            role: true
          }
        },
        replies: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                avatarUrl: true,
                role: true
              }
            }
          },
          orderBy: {
            createdAt: 'asc'
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.json(comments);

  } catch (error) {
    console.error('Erro ao listar comentários:', error);
    res.status(500).json({ error: 'Erro ao listar comentários' });
  }
});

/**
 * POST /api/comments/lesson/:lessonId
 * Cria um comentário em uma aula
 */
commentsRouter.post('/lesson/:lessonId', requireAuth, async (req: Request, res: Response) => {
  try {
    const { lessonId } = req.params;
    const { content, parentId } = req.body;
    const userId = req.user!.id;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: 'Conteúdo do comentário é obrigatório' });
    }

    // Verifica se a aula existe
    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId }
    });

    if (!lesson) {
      return res.status(404).json({ error: 'Aula não encontrada' });
    }

    // Se for reply, verifica se o comentário pai existe
    if (parentId) {
      const parentComment = await prisma.lessonComment.findUnique({
        where: { id: parentId }
      });

      if (!parentComment) {
        return res.status(404).json({ error: 'Comentário pai não encontrado' });
      }
    }

    const isAdmin = req.user!.role === 'ADMIN';

    const comment = await prisma.lessonComment.create({
      data: {
        lessonId,
        userId,
        content: content.trim(),
        parentId: parentId || null,
        isAdminReply: isAdmin && !!parentId
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
            role: true
          }
        }
      }
    });

    res.json(comment);

  } catch (error) {
    console.error('Erro ao criar comentário:', error);
    res.status(500).json({ error: 'Erro ao criar comentário' });
  }
});

/**
 * PUT /api/comments/:id
 * Edita um comentário (apenas o autor ou admin)
 */
commentsRouter.put('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    const userId = req.user!.id;
    const isAdmin = req.user!.role === 'ADMIN';

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: 'Conteúdo do comentário é obrigatório' });
    }

    const comment = await prisma.lessonComment.findUnique({
      where: { id }
    });

    if (!comment) {
      return res.status(404).json({ error: 'Comentário não encontrado' });
    }

    // Apenas o autor ou admin pode editar
    if (comment.userId !== userId && !isAdmin) {
      return res.status(403).json({ error: 'Sem permissão para editar este comentário' });
    }

    const updated = await prisma.lessonComment.update({
      where: { id },
      data: {
        content: content.trim()
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
            role: true
          }
        }
      }
    });

    res.json(updated);

  } catch (error) {
    console.error('Erro ao editar comentário:', error);
    res.status(500).json({ error: 'Erro ao editar comentário' });
  }
});

/**
 * DELETE /api/comments/:id
 * Deleta um comentário (apenas o autor ou admin)
 */
commentsRouter.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const isAdmin = req.user!.role === 'ADMIN';

    const comment = await prisma.lessonComment.findUnique({
      where: { id }
    });

    if (!comment) {
      return res.status(404).json({ error: 'Comentário não encontrado' });
    }

    // Apenas o autor ou admin pode deletar
    if (comment.userId !== userId && !isAdmin) {
      return res.status(403).json({ error: 'Sem permissão para deletar este comentário' });
    }

    await prisma.lessonComment.delete({
      where: { id }
    });

    res.json({ success: true });

  } catch (error) {
    console.error('Erro ao deletar comentário:', error);
    res.status(500).json({ error: 'Erro ao deletar comentário' });
  }
});

/**
 * GET /api/comments/pending
 * Lista comentários pendentes de resposta (ADMIN ONLY)
 */
commentsRouter.get('/pending', requireAuth, async (req: Request, res: Response) => {
  try {
    if (req.user!.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    // Comentários principais sem resposta do admin
    const pendingComments = await prisma.lessonComment.findMany({
      where: {
        parentId: null,
        replies: {
          none: {
            isAdminReply: true
          }
        }
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatarUrl: true
          }
        },
        lesson: {
          select: {
            id: true,
            title: true,
            module: {
              select: {
                title: true
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 50
    });

    res.json(pendingComments);

  } catch (error) {
    console.error('Erro ao listar comentários pendentes:', error);
    res.status(500).json({ error: 'Erro ao listar comentários pendentes' });
  }
});

export { commentsRouter };
