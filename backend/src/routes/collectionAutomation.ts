import { Router } from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import { runCollectionManually } from '../cron/collectionCron';
import { prisma } from '../services/prisma';

const router = Router();

/**
 * GET /api/collection-automation/stats
 * Retorna estatísticas das parcelas para réguas de cobrança
 */
router.get('/stats', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Vencendo em 7 dias
    const dueIn7Days = new Date(today);
    dueIn7Days.setDate(dueIn7Days.getDate() + 7);
    const dueIn7DaysNext = new Date(dueIn7Days);
    dueIn7DaysNext.setDate(dueIn7DaysNext.getDate() + 1);

    // Vencendo em 3 dias
    const dueIn3Days = new Date(today);
    dueIn3Days.setDate(dueIn3Days.getDate() + 3);
    const dueIn3DaysNext = new Date(dueIn3Days);
    dueIn3DaysNext.setDate(dueIn3DaysNext.getDate() + 1);

    // Vencendo hoje
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Atrasos
    const overdue1Day = new Date(today);
    overdue1Day.setDate(overdue1Day.getDate() - 1);

    const overdue3Days = new Date(today);
    overdue3Days.setDate(overdue3Days.getDate() - 3);
    const overdue3DaysNext = new Date(overdue3Days);
    overdue3DaysNext.setDate(overdue3DaysNext.getDate() + 1);

    const overdue7Days = new Date(today);
    overdue7Days.setDate(overdue7Days.getDate() - 7);
    const overdue7DaysNext = new Date(overdue7Days);
    overdue7DaysNext.setDate(overdue7DaysNext.getDate() + 1);

    const overdue15Days = new Date(today);
    overdue15Days.setDate(overdue15Days.getDate() - 15);
    const overdue15DaysNext = new Date(overdue15Days);
    overdue15DaysNext.setDate(overdue15DaysNext.getDate() + 1);

    const overdue30Days = new Date(today);
    overdue30Days.setDate(overdue30Days.getDate() - 30);
    const overdue30DaysNext = new Date(overdue30Days);
    overdue30DaysNext.setDate(overdue30DaysNext.getDate() + 1);

    const stats = {
      dueIn7Days: await prisma.installment.count({
        where: { dueDate: { gte: dueIn7Days, lt: dueIn7DaysNext }, status: 'PENDING' }
      }),
      dueIn3Days: await prisma.installment.count({
        where: { dueDate: { gte: dueIn3Days, lt: dueIn3DaysNext }, status: 'PENDING' }
      }),
      dueToday: await prisma.installment.count({
        where: { dueDate: { gte: today, lt: tomorrow }, status: 'PENDING' }
      }),
      overdue1Day: await prisma.installment.count({
        where: { dueDate: { gte: overdue1Day, lt: today }, status: 'PENDING' }
      }),
      overdue3Days: await prisma.installment.count({
        where: { dueDate: { gte: overdue3Days, lt: overdue3DaysNext }, status: 'PENDING' }
      }),
      overdue7Days: await prisma.installment.count({
        where: { dueDate: { gte: overdue7Days, lt: overdue7DaysNext }, status: 'PENDING' }
      }),
      overdue15Days: await prisma.installment.count({
        where: { dueDate: { gte: overdue15Days, lt: overdue15DaysNext }, status: 'PENDING' }
      }),
      overdue30Days: await prisma.installment.count({
        where: { dueDate: { gte: overdue30Days, lt: overdue30DaysNext }, status: 'PENDING' }
      }),
      totalOverdue: await prisma.installment.count({
        where: { dueDate: { lt: today }, status: 'PENDING' }
      })
    };

    res.json(stats);
  } catch (error) {
    console.error('Erro ao buscar estatísticas:', error);
    res.status(500).json({ error: 'Erro ao buscar estatísticas' });
  }
});

/**
 * POST /api/collection-automation/run
 * Executa manualmente as réguas de cobrança
 */
router.post('/run', authenticateToken, requireAdmin, async (req, res) => {
  try {
    console.log('[CollectionAutomation] Execução manual solicitada pelo admin');

    const result = await runCollectionManually();

    if (result.success) {
      res.json({
        success: true,
        message: 'Réguas de cobrança executadas com sucesso',
        stats: result.stats
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.message || 'Erro ao executar réguas de cobrança'
      });
    }
  } catch (error) {
    console.error('Erro ao executar réguas:', error);
    res.status(500).json({ error: 'Erro ao executar réguas de cobrança' });
  }
});

/**
 * GET /api/collection-automation/templates
 * Lista todos os templates de cobrança
 */
router.get('/templates', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const templates = await prisma.messageTemplate.findMany({
      where: {
        category: 'COBRANCA'
      },
      orderBy: {
        triggerEvent: 'asc'
      }
    });

    res.json(templates);
  } catch (error) {
    console.error('Erro ao buscar templates:', error);
    res.status(500).json({ error: 'Erro ao buscar templates' });
  }
});

/**
 * GET /api/collection-automation/history
 * Retorna histórico de envios de cobrança
 */
router.get('/history', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;

    const logs = await prisma.notificationLog.findMany({
      where: {
        type: 'TEMPLATE_AUTO',
        subject: {
          contains: 'INSTALLMENT'
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: Number(limit),
      skip: Number(offset)
    });

    const total = await prisma.notificationLog.count({
      where: {
        type: 'TEMPLATE_AUTO',
        subject: {
          contains: 'INSTALLMENT'
        }
      }
    });

    res.json({
      logs,
      total,
      limit: Number(limit),
      offset: Number(offset)
    });
  } catch (error) {
    console.error('Erro ao buscar histórico:', error);
    res.status(500).json({ error: 'Erro ao buscar histórico' });
  }
});

export default router;
