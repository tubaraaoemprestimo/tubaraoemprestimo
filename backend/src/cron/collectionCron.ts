import cron from 'node-cron';
import { collectionAutomationService } from '../services/collectionAutomationService';

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
