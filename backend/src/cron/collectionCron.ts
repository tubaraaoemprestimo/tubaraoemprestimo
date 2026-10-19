import cron from 'node-cron';
import { collectionAutomationService, CollectionStats } from '../services/collectionAutomationService';

/**
 * Cron Job para Réguas de Cobrança Automatizadas
 *
 * Executa diariamente às 9h da manhã
 * Envia lembretes e cobranças via Email, WhatsApp e Notificações
 */

let isRunning = false;

export function startCollectionCron() {
  // Executa todos os dias às 9h da manhã
  cron.schedule('0 9 * * *', async () => {
    if (isRunning) {
      console.log('[CollectionCron] Já está executando, pulando...');
      return;
    }

    isRunning = true;
    console.log('[CollectionCron] ========== INICIANDO CRON DE COBRANÇA ==========');

    try {
      const stats = await collectionAutomationService.runCollectionAutomation();

      console.log('[CollectionCron] ========== CRON CONCLUÍDO ==========');
      console.log(`[CollectionCron] Total de mensagens enviadas: ${stats.totalSent}`);
      console.log(`[CollectionCron] Erros: ${stats.errors}`);

    } catch (error) {
      console.error('[CollectionCron] Erro ao executar cron de cobrança:', error);
    } finally {
      isRunning = false;
    }
  }, {
    timezone: 'America/Sao_Paulo'
  });

  console.log('[CollectionCron] ✅ Cron de cobrança iniciado - Executa diariamente às 9h');

  // Régua do financiamento de celulares: job separado, só roda com a flag ligada.
  // Não chama nem altera a régua de empréstimos acima.
  cron.schedule('10 9 * * *', async () => {
    const { getFlags } = require('../services/phoneFinancing/flags');
    if (!getFlags().phonePayment) return;
    try {
      const { runPhoneCollection } = require('../services/phoneFinancing/phoneCollection');
      const { prisma } = require('../services/prisma');
      const { sendWhatsAppMessage } = require('../services/whatsapp');
      const { sendPushToRole } = require('../routes/push');
      const r = await runPhoneCollection({
        prisma, sendWhatsApp: sendWhatsAppMessage,
        notifyAdmins: (t: string, b: string) => sendPushToRole('ADMIN', t, b).catch(() => {}),
        appUrl: process.env.FRONTEND_URL || 'https://www.tubaraoemprestimo.com.br', now: () => new Date(),
      });
      console.log(`[PhoneCollection] enviados=${r.sent} já_enviados=${r.skipped}`);
    } catch (error: any) {
      console.error('[PhoneCollection] erro:', error?.message);
    }
  }, { timezone: 'America/Sao_Paulo' });
}

/**
 * Executa manualmente as réguas de cobrança (para testes)
 */
export async function runCollectionManually() {
  if (isRunning) {
    console.log('[CollectionCron] Já está executando');
    return { success: false, message: 'Já está executando' };
  }

  isRunning = true;
  console.log('[CollectionCron] Executando manualmente...');

  try {
    const stats = await collectionAutomationService.runCollectionAutomation();
    return { success: true, stats };
  } catch (error) {
    console.error('[CollectionCron] Erro:', error);
    return { success: false, error };
  } finally {
    isRunning = false;
  }
}
