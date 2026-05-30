import { prisma } from './prisma';
import { emailService } from './email';
import axios from 'axios';

/**
 * Serviço de Automação de Templates
 * Dispara templates automaticamente via Email, WhatsApp e Notificações
 */

interface Recipient {
  email: string;
  phone?: string;
  userId?: string;
  customerId?: string;
}

interface TemplateVariables {
  [key: string]: string | number;
}

/**
 * Normaliza telefone para formato internacional
 */
function normalizePhone(phone: string): string {
  let number = phone.replace(/\D/g, '');
  if (!number.startsWith('55') && number.length >= 10) {
    number = '55' + number;
  }
  return number;
}

/**
 * Substitui variáveis no template
 * Exemplo: "Olá {nome}!" com { nome: "João" } => "Olá João!"
 */
export function replaceVariables(content: string, variables: TemplateVariables): string {
  let result = content;

  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`\\{${key}\\}`, 'g');
    result = result.replace(regex, String(value));
  }

  return result;
}

/**
 * Terminologia oficial de cobrança POR MODALIDADE (regra de negócio).
 *
 * Bugfix spec "correcao-calculo-juros-parcelas" — Task 3.5.
 *
 * Função pura, sem I/O — fonte única da terminologia exibida ao cliente para
 * manter sistema e WhatsApp coerentes:
 *  - CLT / GARANTIA / GARANTIA_VEICULO → "pagamento de juros de rolagem"
 *  - AUTONOMO                          → "diária amortizadora"
 *  - MOTO                              → "parcela" (única modalidade com parcelas reais)
 *  - demais/indefinido                 → "cobrança" (neutro, falha-segura)
 */
export function getModalityTerminology(profileType?: string | null): { tipo: string; label: string } {
  const p = (profileType || '').toUpperCase();

  if (['CLT', 'GARANTIA', 'GARANTIA_VEICULO'].includes(p)) {
    return { tipo: 'JUROS', label: 'pagamento de juros de rolagem' };
  }
  if (p === 'AUTONOMO') {
    return { tipo: 'DIARIA', label: 'diária amortizadora' };
  }
  if (p === 'MOTO') {
    return { tipo: 'PARCELA', label: 'parcela' };
  }
  return { tipo: 'COBRANCA', label: 'cobrança' };
}

/**
 * Busca template por trigger event e canal
 */
export async function getTemplateByTrigger(
  triggerEvent: string,
  channel?: 'email' | 'whatsapp' | 'notification'
): Promise<any | null> {
  try {
    const where: any = {
      triggerEvent,
      isActive: true
    };

    if (channel) {
      where.channel = channel;
    }

    const template = await prisma.messageTemplate.findFirst({
      where,
      orderBy: { createdAt: 'desc' }
    });

    return template;
  } catch (error) {
    console.error('[TemplateService] Erro ao buscar template:', error);
    return null;
  }
}

/**
 * Envia WhatsApp via Evolution API
 */
async function sendWhatsApp(phone: string, message: string): Promise<boolean> {
  try {
    const config = await prisma.whatsappConfig.findFirst();

    if (!config || !config.isConnected || !config.apiUrl || !config.apiKey) {
      console.log('[TemplateService] WhatsApp não configurado');
      return false;
    }

    const url = `${config.apiUrl}/message/sendText/${config.instanceName}`;

    await axios.post(url, {
      number: normalizePhone(phone),
      text: message,
      options: { delay: 1500, presence: 'composing', linkPreview: false }
    }, {
      headers: { apikey: config.apiKey },
      timeout: 15000
    });

    return true;
  } catch (error) {
    console.error('[TemplateService] Erro ao enviar WhatsApp:', error);
    return false;
  }
}

/**
 * Envia Email
 */
async function sendEmail(to: string, subject: string, content: string): Promise<boolean> {
  try {
    const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #000; color: #fff; padding: 30px; border-radius: 12px;">
      <div style="text-align: center; margin-bottom: 20px;">
        <h1 style="color: #D4AF37; font-size: 24px;">🦈 Tubarão Empréstimos</h1>
      </div>
      <div style="color: #ccc; font-size: 15px; line-height: 1.6; white-space: pre-line;">
        ${content}
      </div>
      <hr style="border-color: #333; margin: 25px 0;" />
      <p style="color: #666; font-size: 12px; text-align: center;">
        Tubarão Empréstimos — Plataforma de Crédito Premium<br/>
        <span style="color: #555;">Este é um email automático. Não responda.</span>
      </p>
    </div>`;

    return await emailService.send(to, subject, html);
  } catch (error) {
    console.error('[TemplateService] Erro ao enviar email:', error);
    return false;
  }
}

/**
 * Envia Notificação Push
 */
async function sendPushNotification(userId: string, title: string, body: string): Promise<boolean> {
  try {
    const customer = await prisma.customer.findUnique({
      where: { id: userId },
      select: { pushSubscriptions: true }
    });

    if (!customer || !customer.pushSubscriptions || customer.pushSubscriptions.length === 0) {
      console.log('[TemplateService] Cliente sem push subscription');
      return false;
    }

    const webpush = require('web-push');

    // Configurar VAPID se ainda não configurado
    if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
      webpush.setVapidDetails(
        process.env.VAPID_SUBJECT || 'mailto:admin@tubarao.com',
        process.env.VAPID_PUBLIC_KEY,
        process.env.VAPID_PRIVATE_KEY
      );
    }

    for (const sub of customer.pushSubscriptions) {
      try {
        const payload = JSON.stringify({
          title,
          body,
          icon: '/logo.png',
          url: '/client/dashboard'
        });

        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: sub.keys as any },
          payload
        );
      } catch (error) {
        console.error('[TemplateService] Erro ao enviar push:', error);
      }
    }

    return true;
  } catch (error) {
    console.error('[TemplateService] Erro ao enviar push notification:', error);
    return false;
  }
}

/**
 * Cria notificação no sistema
 */
async function createSystemNotification(
  customerId: string,
  customerEmail: string,
  title: string,
  message: string,
  type: string = 'INFO'
): Promise<boolean> {
  try {
    await prisma.notification.create({
      data: {
        customerId,
        customerEmail,
        title,
        message,
        type,
        read: false
      }
    });

    return true;
  } catch (error) {
    console.error('[TemplateService] Erro ao criar notificação:', error);
    return false;
  }
}

/**
 * Dispara template automaticamente via TODOS os canais (Email, WhatsApp, Notificação)
 *
 * @param triggerEvent - Evento que dispara o template (ex: 'INSTALLMENT_DUE_7_DAYS')
 * @param recipient - Dados do destinatário (email, phone, userId, customerId)
 * @param variables - Variáveis para substituir no template
 * @returns Promise<{ success: boolean, channels: { email: boolean, whatsapp: boolean, notification: boolean } }>
 */
export async function triggerTemplate(
  triggerEvent: string,
  recipient: Recipient,
  variables: TemplateVariables
): Promise<{ success: boolean; channels: { email: boolean; whatsapp: boolean; notification: boolean; system: boolean } }> {

  const result = {
    success: false,
    channels: {
      email: false,
      whatsapp: false,
      notification: false,
      system: false
    }
  };

  try {
    console.log(`[TemplateService] Disparando template: ${triggerEvent}`);

    // Buscar templates para cada canal
    const emailTemplate = await getTemplateByTrigger(triggerEvent, 'email');
    const whatsappTemplate = await getTemplateByTrigger(triggerEvent, 'whatsapp');
    const notificationTemplate = await getTemplateByTrigger(triggerEvent, 'notification');

    // Se não encontrou nenhum template, busca genérico (sem canal específico)
    const genericTemplate = await getTemplateByTrigger(triggerEvent);

    // 1. ENVIAR EMAIL
    if (emailTemplate && recipient.email) {
      const subject = emailTemplate.subject || 'Tubarão Empréstimos';
      const content = replaceVariables(emailTemplate.content, variables);

      result.channels.email = await sendEmail(recipient.email, subject, content);

      if (result.channels.email) {
        console.log(`[TemplateService] ✅ Email enviado para ${recipient.email}`);
      }
    }

    // 2. ENVIAR WHATSAPP
    if (whatsappTemplate && recipient.phone) {
      const message = replaceVariables(whatsappTemplate.content, variables);

      result.channels.whatsapp = await sendWhatsApp(recipient.phone, message);

      if (result.channels.whatsapp) {
        console.log(`[TemplateService] ✅ WhatsApp enviado para ${recipient.phone}`);
      }
    }

    // 3. ENVIAR PUSH NOTIFICATION
    if (notificationTemplate && recipient.userId) {
      const title = notificationTemplate.subject || 'Tubarão Empréstimos';
      const body = replaceVariables(notificationTemplate.content, variables);

      result.channels.notification = await sendPushNotification(recipient.userId, title, body);

      if (result.channels.notification) {
        console.log(`[TemplateService] ✅ Push notification enviado para userId ${recipient.userId}`);
      }
    }

    // 4. CRIAR NOTIFICAÇÃO NO SISTEMA (sempre cria se tiver customerId)
    if (recipient.customerId && recipient.email) {
      const template = notificationTemplate || whatsappTemplate || emailTemplate || genericTemplate;

      if (template) {
        const title = template.subject || template.name;
        const message = replaceVariables(template.content, variables);

        result.channels.system = await createSystemNotification(
          recipient.customerId,
          recipient.email,
          title,
          message,
          'INFO'
        );

        if (result.channels.system) {
          console.log(`[TemplateService] ✅ Notificação do sistema criada para customerId ${recipient.customerId}`);
        }
      }
    }

    // Considerar sucesso se pelo menos um canal funcionou
    result.success = result.channels.email || result.channels.whatsapp || result.channels.notification || result.channels.system;

    // Log no NotificationLog
    if (result.success) {
      await prisma.notificationLog.create({
        data: {
          type: 'TEMPLATE_AUTO',
          recipient: recipient.email,
          subject: triggerEvent,
          content: JSON.stringify(variables),
          status: 'SENT',
          metadata: {
            triggerEvent,
            channels: result.channels
          }
        }
      }).catch(() => {});
    }

    return result;

  } catch (error) {
    console.error('[TemplateService] Erro ao disparar template:', error);
    return result;
  }
}

/**
 * Dispara template para múltiplos destinatários
 */
export async function triggerTemplateMultiple(
  triggerEvent: string,
  recipients: Recipient[],
  variablesGenerator: (recipient: Recipient) => TemplateVariables
): Promise<{ total: number; success: number; failed: number }> {

  const stats = {
    total: recipients.length,
    success: 0,
    failed: 0
  };

  console.log(`[TemplateService] Disparando template ${triggerEvent} para ${recipients.length} destinatários`);

  for (const recipient of recipients) {
    try {
      const variables = variablesGenerator(recipient);
      const result = await triggerTemplate(triggerEvent, recipient, variables);

      if (result.success) {
        stats.success++;
      } else {
        stats.failed++;
      }

      // Delay para evitar rate limiting
      await new Promise(resolve => setTimeout(resolve, 1500));

    } catch (error) {
      console.error('[TemplateService] Erro ao processar destinatário:', error);
      stats.failed++;
    }
  }

  console.log(`[TemplateService] ✅ Concluído: ${stats.success} sucesso, ${stats.failed} falhas`);

  return stats;
}

export const templateService = {
  getTemplateByTrigger,
  replaceVariables,
  getModalityTerminology,
  triggerTemplate,
  triggerTemplateMultiple
};
