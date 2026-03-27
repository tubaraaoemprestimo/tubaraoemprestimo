/**
 * debtCollectionCronService.ts — CRON de Cobrança Omnichannel
 *
 * Executa 1× ao dia (preferencialmente 09:00 BRT).
 * Para cada parcela OPEN vencida:
 *   1. Calcula multa acumulada (R$20/dia corrido — inclusive domingo)
 *   2. Atualiza installments.late_fee_amount, fine_accumulated, days_overdue via API
 *   3. Dispara os 4 canais de notificação:
 *      a. In-app banner (notifications table)
 *      b. Push (Firebase / web-push)
 *      c. WhatsApp (Evolution API)
 *      d. Email (Resend)
 *
 * REGRA DO DOMINGO para inadimplentes AUTONOMO:
 *   - Não é gerada parcela no domingo
 *   - MAS multa acumula em dias corridos (domingo conta como D+N de atraso)
 *   - Exemplo: cliente AUTONOMO não paga parcela de sexta →
 *       sábado = D+1 (R$20), domingo = D+2 (R$40), segunda = D+3 (R$60)
 *
 * Ativação no App.tsx (modo produção):
 *   import { startDebtCollectionCron } from './services/debtCollectionCronService';
 *   if (userRole === 'ADMIN') startDebtCollectionCron();
 *
 * Em produção real este CRON deveria rodar no backend (Node.js + node-cron).
 * Esta implementação frontend é adequada para o contexto atual (admin sempre logado).
 */

import { api } from './apiService';
import { notificationService } from './notificationService';
import { calculateLateFee } from './installmentEngine';

// ── Configuração ──────────────────────────────────────────────────────────────

const LATE_FEE_DAILY_BRL = 20; // R$20 por dia de atraso
const CRON_INTERVAL_MS   = 24 * 60 * 60 * 1000; // 24h
const CRON_START_HOUR    = 9;  // 09:00 BRT
let   cronTimer: ReturnType<typeof setTimeout> | null = null;

// ── Tipos internos ────────────────────────────────────────────────────────────

interface OverdueInstallment {
  id: string;
  loan_id: string;
  due_date: string;
  amount: number;
  late_fee_amount: number;
  fine_accumulated: number;
  days_overdue: number;
  customer_id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  profile_type?: string;
}

// ── Canal 1: In-App Banner ────────────────────────────────────────────────────

async function sendInAppNotification(inst: OverdueInstallment, daysOverdue: number, fineTotal: number): Promise<void> {
  try {
    await api.post('/notifications', {
      customer_id: inst.customer_id,
      title: `⚠️ Parcela em atraso — ${daysOverdue} dia${daysOverdue > 1 ? 's' : ''}`,
      message: `Sua parcela de R$ ${inst.amount.toFixed(2)} está em atraso há ${daysOverdue} dia${daysOverdue > 1 ? 's' : ''}. Multa acumulada: R$ ${fineTotal.toFixed(2)}. Regularize agora pelo app!`,
      type: daysOverdue >= 7 ? 'ALERT' : 'WARNING',
    });
  } catch (e) {
    console.error('[CRON] Erro ao criar notificação in-app:', e);
  }
}

// ── Canal 2: Push (Firebase / web-push) ───────────────────────────────────────

async function sendPushNotification(inst: OverdueInstallment, daysOverdue: number, fineTotal: number): Promise<void> {
  try {
    await api.post('/push/send', {
      customer_id: inst.customer_id,
      title: `🦈 Parcela vencida há ${daysOverdue} dia${daysOverdue > 1 ? 's' : ''}`,
      body:  `Multa: R$ ${fineTotal.toFixed(2)}. Pague agora e evite mais encargos!`,
      data:  { screen: '/client/loans', loanId: inst.loan_id },
    });
  } catch (e) {
    console.error('[CRON] Erro ao enviar push:', e);
  }
}

// ── Canal 3: WhatsApp ─────────────────────────────────────────────────────────

function buildWhatsAppMessage(inst: OverdueInstallment, daysOverdue: number, fineTotal: number): string {
  const firstName = inst.customer_name.split(' ')[0];
  const dueFormatted = new Date(inst.due_date).toLocaleDateString('pt-BR');

  if (daysOverdue === 1) {
    return `Olá ${firstName}! ⚠️\n\nSua parcela de *R$ ${inst.amount.toFixed(2)}* (venc. ${dueFormatted}) venceu ontem e ainda não foi paga.\n\nJá incide multa de *R$ ${fineTotal.toFixed(2)}*. Pague agora pelo app e evite mais encargos!\n\n🦈 Tubarão Empréstimos`;
  }
  if (daysOverdue <= 3) {
    return `${firstName}, atenção! 🚨\n\nSua parcela de *R$ ${inst.amount.toFixed(2)}* está em atraso há *${daysOverdue} dias*.\n\nMulta acumulada: *R$ ${fineTotal.toFixed(2)}*\n\nRegularize pelo app ou responda esta mensagem para negociar.\n\n🦈 Tubarão Empréstimos`;
  }
  if (daysOverdue <= 7) {
    return `⚠️ ATENÇÃO ${firstName.toUpperCase()}\n\nSua parcela de *R$ ${inst.amount.toFixed(2)}* está em atraso há *${daysOverdue} dias*.\n\nMulta acumulada: *R$ ${fineTotal.toFixed(2)}*\n\n❌ O não pagamento pode resultar em:\n- Negativação nos órgãos de proteção\n- Bloqueio de novos empréstimos\n\nEntre em contato URGENTE!\n\n🦈 Tubarão Empréstimos`;
  }
  // 8+ dias
  return `🚨 ÚLTIMO AVISO — ${firstName.toUpperCase()}\n\nSua dívida de *R$ ${inst.amount.toFixed(2)}* está em atraso há *${daysOverdue} dias*.\nTotal com multa: *R$ ${(inst.amount + fineTotal).toFixed(2)}*\n\n⚠️ AÇÃO NECESSÁRIA HOJE para evitar negativação.\n\nResponda esta mensagem ou acesse o app agora.\n\n🦈 Tubarão Empréstimos`;
}

async function sendWhatsAppMessage(inst: OverdueInstallment, daysOverdue: number, fineTotal: number): Promise<void> {
  try {
    const message = buildWhatsAppMessage(inst, daysOverdue, fineTotal);
    await api.post('/whatsapp/send', {
      phone:   inst.customer_phone,
      message,
    });
  } catch (e) {
    console.error('[CRON] Erro ao enviar WhatsApp:', e);
  }
}

// ── Canal 4: Email ────────────────────────────────────────────────────────────

async function sendEmailNotification(inst: OverdueInstallment, daysOverdue: number, fineTotal: number): Promise<void> {
  try {
    await api.post('/email/send-overdue', {
      to:          inst.customer_email,
      customer_name: inst.customer_name,
      days_overdue: daysOverdue,
      amount:       inst.amount,
      fine_total:   fineTotal,
      due_date:     inst.due_date,
      loan_id:      inst.loan_id,
    });
  } catch (e) {
    console.error('[CRON] Erro ao enviar email:', e);
  }
}

// ── Lógica principal do CRON ──────────────────────────────────────────────────

/**
 * Frequência de envio por canal por dia de atraso.
 * Evita spam: WhatsApp e Push só disparam em marcos específicos.
 */
function shouldSendChannel(channel: 'inapp' | 'push' | 'whatsapp' | 'email', daysOverdue: number): boolean {
  switch (channel) {
    case 'inapp':
      return true; // Sempre — banner in-app todo dia
    case 'push':
      return [1, 3, 7, 15, 30].includes(daysOverdue); // Marcos
    case 'whatsapp':
      return [1, 3, 7, 10, 15, 30].includes(daysOverdue); // Marcos
    case 'email':
      return [1, 7, 15, 30].includes(daysOverdue); // Mais espaçado
    default:
      return false;
  }
}

async function processOverdueInstallment(inst: OverdueInstallment): Promise<void> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { daysOverdue, fineTotal } = calculateLateFee(
    new Date(inst.due_date),
    today,
    LATE_FEE_DAILY_BRL
  );

  if (daysOverdue === 0) return;

  // 1. Atualiza multa no banco via API
  try {
    await api.put(`/installments/${inst.id}/late-fee`, {
      late_fee_amount:  fineTotal,
      fine_accumulated: fineTotal,
      days_overdue:     daysOverdue,
    });
  } catch (e) {
    console.error('[CRON] Erro ao atualizar multa parcela', inst.id, e);
  }

  // 2. Dispara 4 canais conforme marcos de dias
  const ops: Promise<void>[] = [];

  if (shouldSendChannel('inapp', daysOverdue))
    ops.push(sendInAppNotification(inst, daysOverdue, fineTotal));

  if (shouldSendChannel('push', daysOverdue))
    ops.push(sendPushNotification(inst, daysOverdue, fineTotal));

  if (shouldSendChannel('whatsapp', daysOverdue))
    ops.push(sendWhatsAppMessage(inst, daysOverdue, fineTotal));

  if (shouldSendChannel('email', daysOverdue))
    ops.push(sendEmailNotification(inst, daysOverdue, fineTotal));

  // Dispara em paralelo, aguarda todos (sem travar se um falhar)
  await Promise.allSettled(ops);

  // Delay entre clientes para não saturar Evolution API
  await new Promise(r => setTimeout(r, 1500));
}

async function runCollectionCron(): Promise<void> {
  console.log('[CRON] 🦈 Iniciando régua de cobrança omnichannel —', new Date().toLocaleString('pt-BR'));

  try {
    // Busca todas as parcelas OPEN com due_date <= hoje
    const overdueList: OverdueInstallment[] = await api.get('/installments/overdue');

    if (!Array.isArray(overdueList) || overdueList.length === 0) {
      console.log('[CRON] ✅ Nenhuma parcela em atraso encontrada.');
      return;
    }

    console.log(`[CRON] 📋 ${overdueList.length} parcela(s) em atraso para processar.`);

    for (const inst of overdueList) {
      await processOverdueInstallment(inst);
    }

    notificationService.create({
      type: 'success',
      title: '✅ Régua de Cobrança Executada',
      message: `${overdueList.length} parcela(s) processada(s). Notificações enviadas.`,
    });

    console.log('[CRON] ✅ Régua de cobrança concluída.');
  } catch (e) {
    console.error('[CRON] ❌ Erro na régua de cobrança:', e);
    notificationService.create({
      type: 'error',
      title: '❌ Erro na Régua de Cobrança',
      message: 'Verifique os logs do console para detalhes.',
    });
  }
}

// ── Agenda para 09:00 do próximo dia ─────────────────────────────────────────

function msUntilNextRun(): number {
  const now = new Date();
  const next = new Date(now);
  next.setHours(CRON_START_HOUR, 0, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  return next.getTime() - now.getTime();
}

function scheduleNext(): void {
  const delay = msUntilNextRun();
  console.log(`[CRON] ⏰ Próxima execução em ${Math.round(delay / 60000)} minutos.`);
  cronTimer = setTimeout(async () => {
    await runCollectionCron();
    scheduleNext(); // reagenda para o próximo dia
  }, delay);
}

// ── API pública ───────────────────────────────────────────────────────────────

/** Inicia o CRON. Chamar 1× após login do admin. */
export function startDebtCollectionCron(): void {
  if (cronTimer) return; // já iniciado
  console.log('[CRON] 🚀 Régua de cobrança iniciada.');
  scheduleNext();
}

/** Para o CRON (ex: logout do admin). */
export function stopDebtCollectionCron(): void {
  if (cronTimer) {
    clearTimeout(cronTimer);
    cronTimer = null;
    console.log('[CRON] ⛔ Régua de cobrança parada.');
  }
}

/** Executa manualmente (botão "Executar Agora" no painel). */
export async function runCollectionNow(): Promise<void> {
  return runCollectionCron();
}
