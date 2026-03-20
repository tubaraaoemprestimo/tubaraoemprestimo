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

/**
 * POST /api/comments/:id/rate
 * Avaliar um comentário (1-5 estrelas)
 */
commentsRouter.post('/:id/rate', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { rating } = req.body;
    const userId = req.user!.id;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Avaliação deve ser entre 1 e 5' });
    }

    // Verificar se comentário existe
    const comment = await prisma.lessonComment.findUnique({ where: { id } });
    if (!comment) {
      return res.status(404).json({ error: 'Comentário não encontrado' });
    }

    // Criar ou atualizar avaliação
    await prisma.commentRating.upsert({
      where: {
        commentId_userId: {
          commentId: id,
          userId
        }
      },
      create: {
        commentId: id,
        userId,
        rating
      },
      update: {
        rating
      }
    });

    // Recalcular média de avaliações
    const ratings = await prisma.commentRating.findMany({
      where: { commentId: id }
    });

    const avgRating = ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length;

    await prisma.lessonComment.update({
      where: { id },
      data: {
        rating: Math.round(avgRating * 10) / 10, // Arredondar para 1 casa decimal
        ratingCount: ratings.length
      }
    });

    res.json({ success: true, avgRating, ratingCount: ratings.length });

  } catch (error) {
    console.error('Erro ao avaliar comentário:', error);
    res.status(500).json({ error: 'Erro ao avaliar comentário' });
  }
});

/**
 * PUT /api/comments/:id/priority
 * Definir prioridade de um comentário (ADMIN ONLY)
 */
commentsRouter.put('/:id/priority', requireAuth, async (req: Request, res: Response) => {
  try {
    if (req.user!.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    const { id } = req.params;
    const { priority } = req.body;

    if (priority < 0 || priority > 10) {
      return res.status(400).json({ error: 'Prioridade deve ser entre 0 e 10' });
    }

    await prisma.lessonComment.update({
      where: { id },
      data: { priority }
    });

    res.json({ success: true });

  } catch (error) {
    console.error('Erro ao definir prioridade:', error);
    res.status(500).json({ error: 'Erro ao definir prioridade' });
  }
});

/**
 * PUT /api/comments/:id/pin
 * Fixar/desafixar comentário (ADMIN ONLY)
 */
commentsRouter.put('/:id/pin', requireAuth, async (req: Request, res: Response) => {
  try {
    if (req.user!.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    const { id } = req.params;
    const { isPinned } = req.body;

    await prisma.lessonComment.update({
      where: { id },
      data: { isPinned }
    });

    res.json({ success: true });

  } catch (error) {
    console.error('Erro ao fixar comentário:', error);
    res.status(500).json({ error: 'Erro ao fixar comentário' });
  }
});

/**
 * PUT /api/comments/:id/admin-notes
 * Adicionar notas internas do admin (ADMIN ONLY)
 */
commentsRouter.put('/:id/admin-notes', requireAuth, async (req: Request, res: Response) => {
  try {
    if (req.user!.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    const { id } = req.params;
    const { adminNotes } = req.body;

    await prisma.lessonComment.update({
      where: { id },
      data: { adminNotes }
    });

    res.json({ success: true });

  } catch (error) {
    console.error('Erro ao salvar notas:', error);
    res.status(500).json({ error: 'Erro ao salvar notas' });
  }
});

export { commentsRouter };
