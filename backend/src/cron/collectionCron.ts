import cron from 'node-cron';
import { collectionAutomationService, CollectionStats } from '../services/collectionAutomationService';
import { prisma } from '../services/prisma';

// Trava no PostgreSQL (vale entre processos e servidores, não só neste Node).
// Chave fixa e exclusiva da régua de empréstimos.
const COLLECTION_LOCK_KEY = 72016001;

/**
 * Executa `fn` só se conseguir a trava; sem a trava, não roda.
 * Trava de transação (pg_try_advisory_xact_lock): liberada sozinha no fim da
 * transação, inclusive se o processo cair — não fica presa.
 * ponytail: ocupa 1 conexão do pool durante a régua (minutos, 1×/dia).
 */
export async function withCollectionLock<T>(fn: () => Promise<T>, db: any = prisma): Promise<{ ran: true; value: T } | { ran: false }> {
  return db.$transaction(async (tx: any) => {
    const rows = await tx.$queryRawUnsafe(`SELECT pg_try_advisory_xact_lock(${COLLECTION_LOCK_KEY}) AS ok`);
    if (!rows?.[0]?.ok) return { ran: false as const };
    // A régua usa o cliente normal (várias transações próprias); a trava fica
    // presa nesta transação até `fn` terminar e é liberada no commit/rollback.
    return { ran: true as const, value: await fn() };
  }, { timeout: 30 * 60 * 1000, maxWait: 10000 });
}

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
      const r = await withCollectionLock(() => collectionAutomationService.runCollectionAutomation());
      if (!r.ran) {
        console.log('[CollectionCron] Outra execução (outro processo) já está rodando; pulando.');
        return;
      }
      const stats = r.value;

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
    const r = await withCollectionLock(() => collectionAutomationService.runCollectionAutomation());
    if (!r.ran) return { success: false, message: 'Outra execução já está rodando' };
    return { success: true, stats: r.value };
  } catch (error) {
    console.error('[CollectionCron] Erro:', error);
    return { success: false, error };
  } finally {
    isRunning = false;
  }
}
