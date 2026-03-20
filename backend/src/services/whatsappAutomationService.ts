import axios from 'axios';
import { createAutomationLog, updateAutomationLog } from './automationLogService';

// ============================================
// 🔥 EVOLUTION API - WHATSAPP AUTOMATION
// ============================================

interface EvolutionConfig {
  apiUrl: string;
  apiKey: string;
  instanceName: string;
}

interface WhatsAppMessage {
  number: string; // Formato: 5511999999999 (DDI + DDD + Número)
  text: string;
}

interface AutomationResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * 🎯 CONFIGURAÇÃO DA EVOLUTION API
 * Carrega credenciais do .env com segurança
 */
function getEvolutionConfig(): EvolutionConfig {
  const apiUrl = process.env.EVOLUTION_API_URL;
  const apiKey = process.env.EVOLUTION_API_KEY;
  const instanceName = process.env.EVOLUTION_INSTANCE; // Usando EVOLUTION_INSTANCE (sem _NAME)

  if (!apiUrl || !apiKey || !instanceName) {
    throw new Error('Evolution API não configurada. Verifique as variáveis de ambiente.');
  }

  return { apiUrl, apiKey, instanceName };
}

/**
 * 📱 FORMATA NÚMERO DE TELEFONE PARA WHATSAPP
 * Entrada: "(11) 99999-9999" ou "11999999999"
 * Saída: "5511999999999" (DDI + DDD + Número)
 */
function formatPhoneNumber(phone: string): string {
  // Remove tudo que não é número
  const cleaned = phone.replace(/\D/g, '');

  // Se já tem DDI (55), retorna
  if (cleaned.startsWith('55') && cleaned.length >= 12) {
    return cleaned;
  }

  // Se não tem DDI, adiciona 55 (Brasil)
  return `55${cleaned}`;
}

/**
 * 🔥 TEMPLATES DE MENSAGENS PERSONALIZADAS
 */
const MESSAGE_TEMPLATES = {
  HOT: (clientName: string) => `Opa, *${clientName}*! Tudo bem? Aqui é o Bruninho, da equipe VIP do Tubarão Empréstimos. Você tá podendo falar rapidinho?

Acabei de ver suas respostas aqui na pesquisa do curso e seu perfil chamou muito a nossa atenção para a nossa Mentoria Exclusiva. Tenho uma janela na agenda hoje para te explicar como funciona.

Fica melhor eu te ligar de manhã ou de tarde?`,

  WARM: (clientName: string) => `Fala *${clientName}*, aqui é o Bruninho da equipe do Tubarão Empréstimos! Parabéns por finalizar o curso!

Vi na sua pesquisa que você gostou muito do conteúdo, mas colocou que "talvez" participaria da mentoria. Qual foi a sua maior dúvida durante o curso que te deixou na incerteza de dar o próximo passo?

Quero te ajudar a destravar isso!`,

  COLD: (clientName: string) => `Olá *${clientName}*! Parabéns por concluir o Método Tubarão! 🦈

Obrigado pelo seu feedback na pesquisa. Qualquer dúvida, estamos à disposição!

Continue acompanhando nossos conteúdos. 💪`
};

/**
 * 📤 ENVIA MENSAGEM VIA EVOLUTION API
 */
async function sendEvolutionMessage(
  phone: string,
  text: string
): Promise<AutomationResult> {
  try {
    const config = getEvolutionConfig();
    const formattedPhone = formatPhoneNumber(phone);

    const url = `${config.apiUrl}/message/sendText/${config.instanceName}`;

    const payload: WhatsAppMessage = {
      number: formattedPhone,
      text
    };

    const response = await axios.post(url, payload, {
      headers: {
        'Content-Type': 'application/json',
        'apikey': config.apiKey
      },
      timeout: 10000 // 10 segundos
    });

    console.log('✅ Mensagem WhatsApp enviada:', {
      phone: formattedPhone,
      messageId: response.data?.key?.id,
      timestamp: new Date().toISOString()
    });

    return {
      success: true,
      messageId: response.data?.key?.id
    };

  } catch (error: any) {
    console.error('❌ Falha ao disparar automação WhatsApp:', {
      phone,
      error: error.message,
      response: error.response?.data,
      timestamp: new Date().toISOString()
    });

    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * ⏰ DELAY HUMANIZADO (3 minutos)
 * Simula comportamento humano - não responde instantaneamente
 */
function delay(minutes: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, minutes * 60 * 1000));
}

/**
 * 🎯 FUNÇÃO PRINCIPAL - AUTOMAÇÃO DE VENDAS
 *
 * Dispara mensagem personalizada baseada no Lead Status
 * com delay de 3 minutos para humanizar
 */
export async function sendWhatsAppAutomation(
  leadStatus: 'HOT' | 'WARM' | 'COLD',
  clientName: string,
  clientPhone: string,
  leadId?: string
): Promise<AutomationResult> {

  // 🚫 Não envia para leads frios (opcional)
  if (leadStatus === 'COLD') {
    console.log('⏭️ Lead COLD - Automação desabilitada');
    return { success: true }; // Retorna sucesso mas não envia
  }

  let logId: string | null = null;

  try {
    console.log('🎯 Iniciando automação WhatsApp:', {
      leadStatus,
      clientName,
      clientPhone,
      timestamp: new Date().toISOString()
    });

    // 📝 Seleciona template baseado no status
    const messageText = MESSAGE_TEMPLATES[leadStatus](clientName);

    // 💾 Cria log PENDING no banco
    if (leadId) {
      const log = await createAutomationLog({
        leadId,
        leadStatus,
        clientName,
        phone: clientPhone,
        messageText,
        status: 'PENDING'
      });
      logId = log?.id || null;
    }

    // ⏰ AGUARDA 3 MINUTOS (Humanização)
    console.log('⏰ Aguardando 3 minutos para humanizar...');
    await delay(3);

    // 📤 Envia mensagem
    const result = await sendEvolutionMessage(clientPhone, messageText);

    // 💾 Atualiza log com resultado
    if (logId) {
      if (result.success) {
        await updateAutomationLog(logId, 'SENT', result.messageId);
      } else {
        await updateAutomationLog(logId, 'FAILED', undefined, result.error);
      }
    }

    if (result.success) {
      console.log('🎉 Automação concluída com sucesso!');
    } else {
      console.error('⚠️ Automação falhou:', result.error);
    }

    return result;

  } catch (error: any) {
    console.error('💥 Erro crítico na automação:', error);

    // 💾 Atualiza log como FAILED
    if (logId) {
      await updateAutomationLog(logId, 'FAILED', undefined, error.message);
    }

    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 🔄 VERSÃO COM FILA (RECOMENDADO PARA PRODUÇÃO)
 *
 * Para ambientes serverless (Vercel, Netlify), use uma fila como:
 * - BullMQ + Redis
 * - AWS SQS
 * - Vercel Cron Jobs
 *
 * Exemplo com BullMQ:
 */
/*
import { Queue } from 'bullmq';

const whatsappQueue = new Queue('whatsapp-automation', {
  connection: {
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT || '6379')
  }
});

export async function queueWhatsAppAutomation(
  leadStatus: 'HOT' | 'WARM' | 'COLD',
  clientName: string,
  clientPhone: string
) {
  await whatsappQueue.add(
    'send-message',
    { leadStatus, clientName, clientPhone },
    { delay: 3 * 60 * 1000 } // 3 minutos
  );
}
*/

/**
 * 📊 LOG DE AUTOMAÇÃO NO BANCO (OPCIONAL)
 *
 * Crie uma tabela para rastrear disparos:
 */
/*
model WhatsAppAutomation {
  id          String   @id @default(uuid())
  leadId      String
  leadStatus  String
  phone       String
  messageText String   @db.Text
  status      String   // PENDING, SENT, FAILED
  messageId   String?
  error       String?
  sentAt      DateTime?
  createdAt   DateTime @default(now())
}
*/
