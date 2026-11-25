import { Router } from 'express';
import { authenticate, requireAdmin } from '../middleware/auth';
import { runCollectionManually } from '../cron/collectionCron';
import { prisma } from '../services/prisma';
import { getCollectionRules, saveCollectionRules, previewScheduled } from '../services/collectionRules';

const router = Router();

/**
 * GET /api/collection-automation/stats
 * Retorna estatísticas das parcelas para réguas de cobrança
 */
router.get('/stats', authenticate, requireAdmin, async (req, res) => {
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
        where: { dueDate: { gte: dueIn7Days, lt: dueIn7DaysNext }, status: { in: ['OPEN', 'LATE', 'AWAITING_CONFIRMATION'] }, loan: { status: 'ACTIVE' } }
      }),
      dueIn3Days: await prisma.installment.count({
        where: { dueDate: { gte: dueIn3Days, lt: dueIn3DaysNext }, status: { in: ['OPEN', 'LATE', 'AWAITING_CONFIRMATION'] }, loan: { status: 'ACTIVE' } }
      }),
      dueToday: await prisma.installment.count({
        where: { dueDate: { gte: today, lt: tomorrow }, status: { in: ['OPEN', 'LATE', 'AWAITING_CONFIRMATION'] }, loan: { status: 'ACTIVE' } }
      }),
      overdue1Day: await prisma.installment.count({
        where: { dueDate: { gte: overdue1Day, lt: today }, status: { in: ['OPEN', 'LATE', 'AWAITING_CONFIRMATION'] }, loan: { status: 'ACTIVE' } }
      }),
      overdue3Days: await prisma.installment.count({
        where: { dueDate: { gte: overdue3Days, lt: overdue3DaysNext }, status: { in: ['OPEN', 'LATE', 'AWAITING_CONFIRMATION'] }, loan: { status: 'ACTIVE' } }
      }),
      overdue7Days: await prisma.installment.count({
        where: { dueDate: { gte: overdue7Days, lt: overdue7DaysNext }, status: { in: ['OPEN', 'LATE', 'AWAITING_CONFIRMATION'] }, loan: { status: 'ACTIVE' } }
      }),
      overdue15Days: await prisma.installment.count({
        where: { dueDate: { gte: overdue15Days, lt: overdue15DaysNext }, status: { in: ['OPEN', 'LATE', 'AWAITING_CONFIRMATION'] }, loan: { status: 'ACTIVE' } }
      }),
      overdue30Days: await prisma.installment.count({
        where: { dueDate: { gte: overdue30Days, lt: overdue30DaysNext }, status: { in: ['OPEN', 'LATE', 'AWAITING_CONFIRMATION'] }, loan: { status: 'ACTIVE' } }
      }),
      totalOverdue: await prisma.installment.count({
        where: { dueDate: { lt: today }, status: { in: ['OPEN', 'LATE', 'AWAITING_CONFIRMATION'] }, loan: { status: 'ACTIVE' } }
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
router.post('/run', authenticate, requireAdmin, async (req, res) => {
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
router.get('/templates', authenticate, requireAdmin, async (req, res) => {
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
router.get('/history', authenticate, requireAdmin, async (req, res) => {
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

/** Regras configuráveis (liga/desliga, dias de antecedência, hora, templates). */
router.get('/rules', authenticate, requireAdmin, async (_req, res) => {
  const rules = await getCollectionRules();
  const triggers = await prisma.messageTemplate.findMany({ where: { isActive: true, triggerEvent: { startsWith: 'INSTALLMENT_' } }, select: { triggerEvent: true, channel: true, name: true }, orderBy: { triggerEvent: 'asc' } });
  const whatsapp = await prisma.whatsappConfig.findFirst({ select: { isConnected: true } }).catch(() => null);
  res.json({ rules, templates: triggers, whatsappConnected: !!whatsapp?.isConnected });
});

router.put('/rules', authenticate, requireAdmin, async (req, res) => {
  const before = await getCollectionRules();
  const rules = await saveCollectionRules({ ...before, ...req.body });
  await prisma.auditLog.create({ data: { userId: req.user!.id, userName: req.user!.name, action: 'COLLECTION_RULES_UPDATED', entity: 'SETTINGS', entityId: 'collection_rules', details: JSON.stringify({ before, after: rules }), ipAddress: req.ip } }).catch(() => {});
  res.json({ rules });
});

/** Mensagens programadas (próximos dias) com motivo quando não sairão. Somente leitura. */
router.get('/scheduled', authenticate, requireAdmin, async (req, res) => {
  const days = Math.min(30, Math.max(1, Number(req.query.days || 7)));
  res.json(await previewScheduled(days));
});

/** Envios registrados (enviados e falhas), com filtros. */
router.get('/dispatches', authenticate, requireAdmin, async (req, res) => {
  const status = ['SENT', 'FAILED'].includes(String(req.query.status)) ? String(req.query.status) : undefined;
  const loanId = typeof req.query.loanId === 'string' ? req.query.loanId : undefined;
  const take = Math.min(200, Math.max(1, Number(req.query.limit || 50)));
  const where: any = { ...(status ? { status } : {}), ...(loanId ? { loanId } : {}) };
  const [items, total, byStatus] = await Promise.all([
    prisma.collectionDispatch.findMany({ where, orderBy: { createdAt: 'desc' }, take }),
    prisma.collectionDispatch.count({ where }),
    prisma.collectionDispatch.groupBy({ by: ['status'], _count: true }),
  ]);
  const names = Object.fromEntries((await prisma.customer.findMany({ where: { id: { in: [...new Set(items.map(i => i.customerId))] } }, select: { id: true, name: true } })).map(c => [c.id, c.name]));
  res.json({ items: items.map(i => ({ ...i, customerName: names[i.customerId] || null })), total, byStatus: Object.fromEntries(byStatus.map(b => [b.status, b._count])) });
});

/** Pausar/retomar mensagens automáticas de um contrato (cobrança financeira não muda). */
router.patch('/loans/:loanId/messages', authenticate, requireAdmin, async (req, res) => {
  const suspended = req.body?.suspended === true;
  const loan = await prisma.loan.findUnique({ where: { id: String(req.params.loanId) }, select: { id: true } });
  if (!loan) { res.status(404).json({ error: 'Contrato não encontrado' }); return; }
  await prisma.loan.update({ where: { id: loan.id }, data: { messagesSuspended: suspended } });
  await prisma.auditLog.create({ data: { userId: req.user!.id, userName: req.user!.name, action: suspended ? 'COLLECTION_MESSAGES_PAUSED' : 'COLLECTION_MESSAGES_RESUMED', entity: 'LOAN', entityId: loan.id, details: JSON.stringify({ reason: String(req.body?.reason || '').slice(0, 300) || undefined }), ipAddress: req.ip } }).catch(() => {});
  res.json({ loanId: loan.id, messagesSuspended: suspended });
});

/** Opt-out de WhatsApp do titular (a pedido do cliente). */
router.patch('/customers/:customerId/whatsapp', authenticate, requireAdmin, async (req, res) => {
  const optOut = req.body?.optOut === true;
  const c = await prisma.customer.findUnique({ where: { id: String(req.params.customerId) }, select: { id: true } });
  if (!c) { res.status(404).json({ error: 'Cliente não encontrado' }); return; }
  await prisma.customer.update({ where: { id: c.id }, data: { whatsappOptOut: optOut } });
  await prisma.auditLog.create({ data: { userId: req.user!.id, userName: req.user!.name, action: optOut ? 'WHATSAPP_OPT_OUT' : 'WHATSAPP_OPT_IN', entity: 'CUSTOMER', entityId: c.id, ipAddress: req.ip } }).catch(() => {});
  res.json({ customerId: c.id, whatsappOptOut: optOut });
});

export default router;
