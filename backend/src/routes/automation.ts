import { Router, Request, Response } from 'express';
import { authenticate, requireAdmin } from '../middleware/auth';
import { getAutomationLogs, getAutomationStats, getFailedAutomations } from '../services/automationLogService';
import { sendWhatsAppAutomation } from '../services/whatsappAutomationService';
import { prisma } from '../services/prisma';

const automationRouter = Router();

/**
 * GET /api/automation/logs
 * Lista logs de automação WhatsApp (ADMIN ONLY)
 */
automationRouter.get('/logs', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { leadStatus, status, startDate, endDate } = req.query;

    const filters: any = {};
    if (leadStatus) filters.leadStatus = leadStatus as string;
    if (status) filters.status = status as string;
    if (startDate) filters.startDate = new Date(startDate as string);
    if (endDate) filters.endDate = new Date(endDate as string);

    const logs = await getAutomationLogs(filters);
    res.json(logs);

  } catch (error) {
    console.error('Erro ao listar logs de automação:', error);
    res.status(500).json({ error: 'Erro ao listar logs' });
  }
});

/**
 * GET /api/automation/stats
 * Estatísticas de automação (ADMIN ONLY)
 */
automationRouter.get('/stats', requireAdmin, async (req: Request, res: Response) => {
  try {
    const stats = await getAutomationStats();
    res.json(stats);

  } catch (error) {
    console.error('Erro ao buscar estatísticas:', error);
    res.status(500).json({ error: 'Erro ao buscar estatísticas' });
  }
});

/**
 * GET /api/automation/failed
 * Lista automações falhadas (ADMIN ONLY)
 */
automationRouter.get('/failed', requireAdmin, async (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
    const failed = await getFailedAutomations(limit);
    res.json(failed);

  } catch (error) {
    console.error('Erro ao buscar automações falhadas:', error);
    res.status(500).json({ error: 'Erro ao buscar automações falhadas' });
  }
});

/**
 * POST /api/automation/retry/:id
 * Reenviar automação falhada (ADMIN ONLY)
 */
automationRouter.post('/retry/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Buscar log da automação
    const log = await getFailedAutomations(100);
    const automation = log.find(l => l.id === id);

    if (!automation) {
      return res.status(404).json({ error: 'Automação não encontrada' });
    }

    // Reenviar mensagem
    const result = await sendWhatsAppAutomation(
      automation.leadStatus as 'HOT' | 'WARM' | 'COLD',
      automation.clientName,
      automation.phone,
      automation.leadId
    );

    res.json({
      success: result.success,
      message: result.success ? 'Mensagem reenviada com sucesso' : 'Falha ao reenviar',
      error: result.error
    });

  } catch (error: any) {
    console.error('Erro ao reenviar automação:', error);
    res.status(500).json({ error: 'Erro ao reenviar automação' });
  }
});

/**
 * POST /api/automation/test
 * Testar envio de mensagem (ADMIN ONLY)
 */
automationRouter.post('/test', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { phone, name, leadStatus } = req.body;

    if (!phone || !name || !leadStatus) {
      return res.status(400).json({ error: 'Campos obrigatórios: phone, name, leadStatus' });
    }

    const result = await sendWhatsAppAutomation(
      leadStatus as 'HOT' | 'WARM' | 'COLD',
      name,
      phone
    );

    res.json({
      success: result.success,
      message: result.success ? 'Mensagem de teste enviada' : 'Falha no envio',
      messageId: result.messageId,
      error: result.error
    });

  } catch (error: any) {
    console.error('Erro ao enviar mensagem de teste:', error);
    res.status(500).json({ error: 'Erro ao enviar mensagem de teste' });
  }
});

/**
 * GET /api/automation/templates
 * Retorna templates de mensagem WhatsApp (ADMIN ONLY)
 */
automationRouter.get('/templates', requireAdmin, async (_req: Request, res: Response) => {
  try {
    const keys = ['whatsapp_template_hot', 'whatsapp_template_warm', 'whatsapp_template_cold'];
    const settings = await prisma.systemSetting.findMany({ where: { key: { in: keys } } });

    const map: Record<string, string> = {};
    settings.forEach(s => { map[s.key] = s.value; });

    res.json({
      HOT: map['whatsapp_template_hot'] || '',
      WARM: map['whatsapp_template_warm'] || '',
      COLD: map['whatsapp_template_cold'] || '',
    });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar templates' });
  }
});

/**
 * PUT /api/automation/templates
 * Salva templates de mensagem WhatsApp (ADMIN ONLY)
 */
automationRouter.put('/templates', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { HOT, WARM, COLD } = req.body as { HOT: string; WARM: string; COLD: string };

    const upserts = [
      { key: 'whatsapp_template_hot', value: HOT || '' },
      { key: 'whatsapp_template_warm', value: WARM || '' },
      { key: 'whatsapp_template_cold', value: COLD || '' },
    ];

    for (const { key, value } of upserts) {
      await prisma.systemSetting.upsert({
        where: { key },
        create: { key, value },
        update: { value },
      });
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao salvar templates' });
  }
});

export { automationRouter };
