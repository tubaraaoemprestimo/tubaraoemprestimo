import { prisma } from './prisma';

/**
 * 📊 MODELO DE LOG DE AUTOMAÇÃO WHATSAPP
 *
 * Execute esta migration para criar a tabela de rastreamento
 */

// Adicione ao schema.prisma:
/*
model WhatsAppAutomation {
  id          String   @id @default(uuid())
  leadId      String   @map("lead_id")
  leadStatus  String   @map("lead_status") // HOT, WARM, COLD
  clientName  String   @map("client_name")
  phone       String
  messageText String   @db.Text @map("message_text")
  status      String   @default("PENDING") // PENDING, SENT, FAILED
  messageId   String?  @map("message_id")
  error       String?  @db.Text
  sentAt      DateTime? @map("sent_at")
  createdAt   DateTime @default(now()) @map("created_at")

  @@map("whatsapp_automations")
}
*/

interface AutomationLog {
  leadId: string;
  leadStatus: 'HOT' | 'WARM' | 'COLD';
  clientName: string;
  phone: string;
  messageText: string;
  status: 'PENDING' | 'SENT' | 'FAILED';
  messageId?: string;
  error?: string;
  sentAt?: Date;
}

/**
 * 📝 CRIA LOG DE AUTOMAÇÃO
 */
export async function createAutomationLog(data: AutomationLog) {
  try {
    return await prisma.whatsAppAutomation.create({
      data: {
        leadId: data.leadId,
        leadStatus: data.leadStatus,
        clientName: data.clientName,
        phone: data.phone,
        messageText: data.messageText,
        status: data.status,
        messageId: data.messageId,
        error: data.error,
        sentAt: data.sentAt
      }
    });
  } catch (error) {
    console.error('Erro ao criar log de automação:', error);
    return null;
  }
}

/**
 * ✅ ATUALIZA STATUS DO LOG
 */
export async function updateAutomationLog(
  id: string,
  status: 'SENT' | 'FAILED',
  messageId?: string,
  error?: string
) {
  try {
    return await prisma.whatsAppAutomation.update({
      where: { id },
      data: {
        status,
        messageId,
        error,
        sentAt: status === 'SENT' ? new Date() : undefined
      }
    });
  } catch (error) {
    console.error('Erro ao atualizar log de automação:', error);
    return null;
  }
}

/**
 * 📊 BUSCA LOGS DE AUTOMAÇÃO
 */
export async function getAutomationLogs(filters?: {
  leadStatus?: string;
  status?: string;
  startDate?: Date;
  endDate?: Date;
}) {
  try {
    const where: any = {};

    if (filters?.leadStatus) {
      where.leadStatus = filters.leadStatus;
    }

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.startDate || filters?.endDate) {
      where.createdAt = {};
      if (filters.startDate) {
        where.createdAt.gte = filters.startDate;
      }
      if (filters.endDate) {
        where.createdAt.lte = filters.endDate;
      }
    }

    return await prisma.whatsAppAutomation.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100
    });
  } catch (error) {
    console.error('Erro ao buscar logs de automação:', error);
    return [];
  }
}

/**
 * 📈 ESTATÍSTICAS DE AUTOMAÇÃO
 */
export async function getAutomationStats() {
  try {
    const [total, sent, failed, pending] = await Promise.all([
      prisma.whatsAppAutomation.count(),
      prisma.whatsAppAutomation.count({ where: { status: 'SENT' } }),
      prisma.whatsAppAutomation.count({ where: { status: 'FAILED' } }),
      prisma.whatsAppAutomation.count({ where: { status: 'PENDING' } })
    ]);

    const successRate = total > 0 ? ((sent / total) * 100).toFixed(2) : '0';

    return {
      total,
      sent,
      failed,
      pending,
      successRate: `${successRate}%`
    };
  } catch (error) {
    console.error('Erro ao buscar estatísticas:', error);
    return {
      total: 0,
      sent: 0,
      failed: 0,
      pending: 0,
      successRate: '0%'
    };
  }
}

/**
 * 🔄 RETRY DE AUTOMAÇÕES FALHADAS
 */
export async function getFailedAutomations(limit = 10) {
  try {
    return await prisma.whatsAppAutomation.findMany({
      where: {
        status: 'FAILED',
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Últimas 24h
        }
      },
      orderBy: { createdAt: 'desc' },
      take: limit
    });
  } catch (error) {
    console.error('Erro ao buscar automações falhadas:', error);
    return [];
  }
}
