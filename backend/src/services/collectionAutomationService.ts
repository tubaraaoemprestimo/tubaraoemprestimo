import { prisma } from './prisma';
import { templateService } from './templateService';

/** Busca a chave PIX configurada pelo admin no banco */
async function getAdminPixKey(): Promise<string> {
  try {
    const setting = await prisma.systemSetting.findFirst({ where: { key: 'pixKey' } });
    return setting?.value || process.env.PIX_KEY || '57.241.795/0001-47';
  } catch {
    return process.env.PIX_KEY || '57.241.795/0001-47';
  }
}

/**
 * Serviço de Automação de Réguas de Cobrança
 * Dispara automaticamente lembretes e cobranças via Email, WhatsApp e Notificações
 */

export interface CollectionStats {
  dueIn7Days: number;
  dueIn3Days: number;
  dueToday: number;
  overdue1Day: number;
  overdue3Days: number;
  overdue7Days: number;
  overdue15Days: number;
  overdue30Days: number;
  totalSent: number;
  errors: number;
}

/**
 * Formata valor para moeda brasileira
 */
function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Formata data para formato brasileiro
 */
function formatDate(date: Date): string {
  return date.toLocaleDateString('pt-BR');
}

/**
 * Calcula valor com juros (10% ao mês de atraso)
 */
function calculateOverdueAmount(originalAmount: number, daysOverdue: number): number {
  const monthsOverdue = daysOverdue / 30;
  const interestRate = 0.10; // 10% ao mês
  return originalAmount * (1 + (interestRate * monthsOverdue));
}

/**
 * Processa lembretes de vencimento (7 dias antes)
 */
async function processDueIn7Days(): Promise<number> {
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + 7);
  targetDate.setHours(0, 0, 0, 0);

  const nextDay = new Date(targetDate);
  nextDay.setDate(nextDay.getDate() + 1);

  const installments = await prisma.installment.findMany({
    where: {
      dueDate: {
        gte: targetDate,
        lt: nextDay
      },
      status: 'OPEN'
    },
    include: {
      loan: {
        include: {
          customer: true
        }
      }
    }
  });

  console.log(`[CollectionAutomation] Encontradas ${installments.length} parcelas vencendo em 7 dias`);

  let sent = 0;
  for (const installment of installments) {
    try {
      const customer = installment.loan.customer;

      await templateService.triggerTemplate(
        'INSTALLMENT_DUE_7_DAYS',
        {
          email: customer.email,
          phone: customer.phone,
          userId: customer.id,
          customerId: customer.id
        },
        {
          nome: customer.name,
          valor: formatCurrency(installment.amount),
          data_vencimento: formatDate(installment.dueDate),
          pix_key: await getAdminPixKey()
        }
      );

      sent++;
      await new Promise(resolve => setTimeout(resolve, 1500)); // Delay anti-spam
    } catch (error) {
      console.error('[CollectionAutomation] Erro ao enviar lembrete 7 dias:', error);
    }
  }

  return sent;
}

/**
 * Processa lembretes de vencimento (3 dias antes)
 */
async function processDueIn3Days(): Promise<number> {
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + 3);
  targetDate.setHours(0, 0, 0, 0);

  const nextDay = new Date(targetDate);
  nextDay.setDate(nextDay.getDate() + 1);

  const installments = await prisma.installment.findMany({
    where: {
      dueDate: {
        gte: targetDate,
        lt: nextDay
      },
      status: 'OPEN'
    },
    include: {
      loan: {
        include: {
          customer: true
        }
      }
    }
  });

  console.log(`[CollectionAutomation] Encontradas ${installments.length} parcelas vencendo em 3 dias`);

  let sent = 0;
  for (const installment of installments) {
    try {
      const customer = installment.loan.customer;

      await templateService.triggerTemplate(
        'INSTALLMENT_DUE_3_DAYS',
        {
          email: customer.email,
          phone: customer.phone,
          userId: customer.id,
          customerId: customer.id
        },
        {
          nome: customer.name,
          valor: formatCurrency(installment.amount),
          data_vencimento: formatDate(installment.dueDate),
          pix_key: await getAdminPixKey()
        }
      );

      sent++;
      await new Promise(resolve => setTimeout(resolve, 1500));
    } catch (error) {
      console.error('[CollectionAutomation] Erro ao enviar lembrete 3 dias:', error);
    }
  }

  return sent;
}

/**
 * Processa lembretes de vencimento (hoje)
 */
async function processDueToday(): Promise<number> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const installments = await prisma.installment.findMany({
    where: {
      dueDate: {
        gte: today,
        lt: tomorrow
      },
      status: 'OPEN'
    },
    include: {
      loan: {
        include: {
          customer: true
        }
      }
    }
  });

  console.log(`[CollectionAutomation] Encontradas ${installments.length} parcelas vencendo hoje`);

  let sent = 0;
  for (const installment of installments) {
    try {
      const customer = installment.loan.customer;

      await templateService.triggerTemplate(
        'INSTALLMENT_DUE_TODAY',
        {
          email: customer.email,
          phone: customer.phone,
          userId: customer.id,
          customerId: customer.id
        },
        {
          nome: customer.name,
          valor: formatCurrency(installment.amount),
          data_vencimento: formatDate(installment.dueDate),
          pix_key: await getAdminPixKey()
        }
      );

      sent++;
      await new Promise(resolve => setTimeout(resolve, 1500));
    } catch (error) {
      console.error('[CollectionAutomation] Erro ao enviar lembrete hoje:', error);
    }
  }

  return sent;
}

/**
 * Processa parcelas em atraso (1 dia)
 */
async function processOverdue1Day(): Promise<number> {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(0, 0, 0, 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const installments = await prisma.installment.findMany({
    where: {
      dueDate: {
        gte: yesterday,
        lt: today
      },
      status: 'OPEN'
    },
    include: {
      loan: {
        include: {
          customer: true
        }
      }
    }
  });

  console.log(`[CollectionAutomation] Encontradas ${installments.length} parcelas com 1 dia de atraso`);

  let sent = 0;
  for (const installment of installments) {
    try {
      const customer = installment.loan.customer;

      await templateService.triggerTemplate(
        'INSTALLMENT_OVERDUE_1_DAY',
        {
          email: customer.email,
          phone: customer.phone,
          userId: customer.id,
          customerId: customer.id
        },
        {
          nome: customer.name,
          valor: formatCurrency(installment.amount),
          data_vencimento: formatDate(installment.dueDate),
          pix_key: await getAdminPixKey()
        }
      );

      sent++;
      await new Promise(resolve => setTimeout(resolve, 1500));
    } catch (error) {
      console.error('[CollectionAutomation] Erro ao enviar cobrança 1 dia:', error);
    }
  }

  return sent;
}

/**
 * Processa parcelas em atraso (3 dias)
 */
async function processOverdue3Days(): Promise<number> {
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() - 3);
  targetDate.setHours(0, 0, 0, 0);

  const nextDay = new Date(targetDate);
  nextDay.setDate(nextDay.getDate() + 1);

  const installments = await prisma.installment.findMany({
    where: {
      dueDate: {
        gte: targetDate,
        lt: nextDay
      },
      status: 'OPEN'
    },
    include: {
      loan: {
        include: {
          customer: true
        }
      }
    }
  });

  console.log(`[CollectionAutomation] Encontradas ${installments.length} parcelas com 3 dias de atraso`);

  let sent = 0;
  for (const installment of installments) {
    try {
      const customer = installment.loan.customer;

      await templateService.triggerTemplate(
        'INSTALLMENT_OVERDUE_3_DAYS',
        {
          email: customer.email,
          phone: customer.phone,
          userId: customer.id,
          customerId: customer.id
        },
        {
          nome: customer.name,
          valor: formatCurrency(installment.amount),
          data_vencimento: formatDate(installment.dueDate),
          pix_key: await getAdminPixKey()
        }
      );

      sent++;
      await new Promise(resolve => setTimeout(resolve, 1500));
    } catch (error) {
      console.error('[CollectionAutomation] Erro ao enviar cobrança 3 dias:', error);
    }
  }

  return sent;
}

/**
 * Processa parcelas em atraso (7+ dias)
 */
async function processOverdue7Days(): Promise<number> {
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() - 7);
  targetDate.setHours(0, 0, 0, 0);

  const nextDay = new Date(targetDate);
  nextDay.setDate(nextDay.getDate() + 1);

  const installments = await prisma.installment.findMany({
    where: {
      dueDate: {
        gte: targetDate,
        lt: nextDay
      },
      status: 'OPEN'
    },
    include: {
      loan: {
        include: {
          customer: true
        }
      }
    }
  });

  console.log(`[CollectionAutomation] Encontradas ${installments.length} parcelas com 7 dias de atraso`);

  let sent = 0;
  for (const installment of installments) {
    try {
      const customer = installment.loan.customer;
      const daysOverdue = Math.floor((Date.now() - installment.dueDate.getTime()) / (1000 * 60 * 60 * 24));
      const overdueAmount = calculateOverdueAmount(installment.amount, daysOverdue);

      await templateService.triggerTemplate(
        'INSTALLMENT_OVERDUE_7_DAYS',
        {
          email: customer.email,
          phone: customer.phone,
          userId: customer.id,
          customerId: customer.id
        },
        {
          nome: customer.name,
          dias_atraso: daysOverdue.toString(),
          valor: formatCurrency(installment.amount),
          valor_com_juros: formatCurrency(overdueAmount),
          pix_key: await getAdminPixKey(),
          telefone_suporte: process.env.SUPPORT_PHONE || '(11) 99999-9999'
        }
      );

      sent++;
      await new Promise(resolve => setTimeout(resolve, 1500));
    } catch (error) {
      console.error('[CollectionAutomation] Erro ao enviar cobrança 7 dias:', error);
    }
  }

  return sent;
}

/**
 * Processa parcelas em atraso (15 dias)
 */
async function processOverdue15Days(): Promise<number> {
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() - 15);
  targetDate.setHours(0, 0, 0, 0);

  const nextDay = new Date(targetDate);
  nextDay.setDate(nextDay.getDate() + 1);

  const installments = await prisma.installment.findMany({
    where: {
      dueDate: {
        gte: targetDate,
        lt: nextDay
      },
      status: 'OPEN'
    },
    include: {
      loan: {
        include: {
          customer: true
        }
      }
    }
  });

  console.log(`[CollectionAutomation] Encontradas ${installments.length} parcelas com 15 dias de atraso`);

  let sent = 0;
  for (const installment of installments) {
    try {
      const customer = installment.loan.customer;
      const overdueAmount = calculateOverdueAmount(installment.amount, 15);

      await templateService.triggerTemplate(
        'INSTALLMENT_OVERDUE_15_DAYS',
        {
          email: customer.email,
          phone: customer.phone,
          userId: customer.id,
          customerId: customer.id
        },
        {
          nome: customer.name,
          valor: formatCurrency(installment.amount),
          valor_com_juros: formatCurrency(overdueAmount),
          pix_key: await getAdminPixKey(),
          telefone_suporte: process.env.SUPPORT_PHONE || '(11) 99999-9999'
        }
      );

      sent++;
      await new Promise(resolve => setTimeout(resolve, 1500));
    } catch (error) {
      console.error('[CollectionAutomation] Erro ao enviar cobrança 15 dias:', error);
    }
  }

  return sent;
}

/**
 * Processa parcelas em atraso (30 dias)
 */
async function processOverdue30Days(): Promise<number> {
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() - 30);
  targetDate.setHours(0, 0, 0, 0);

  const nextDay = new Date(targetDate);
  nextDay.setDate(nextDay.getDate() + 1);

  const installments = await prisma.installment.findMany({
    where: {
      dueDate: {
        gte: targetDate,
        lt: nextDay
      },
      status: 'OPEN'
    },
    include: {
      loan: {
        include: {
          customer: true
        }
      }
    }
  });

  console.log(`[CollectionAutomation] Encontradas ${installments.length} parcelas com 30 dias de atraso`);

  let sent = 0;
  for (const installment of installments) {
    try {
      const customer = installment.loan.customer;
      const overdueAmount = calculateOverdueAmount(installment.amount, 30);

      await templateService.triggerTemplate(
        'INSTALLMENT_OVERDUE_30_DAYS',
        {
          email: customer.email,
          phone: customer.phone,
          userId: customer.id,
          customerId: customer.id
        },
        {
          nome: customer.name,
          valor: formatCurrency(installment.amount),
          valor_com_juros: formatCurrency(overdueAmount),
          pix_key: await getAdminPixKey(),
          telefone_suporte: process.env.SUPPORT_PHONE || '(11) 99999-9999'
        }
      );

      sent++;
      await new Promise(resolve => setTimeout(resolve, 1500));
    } catch (error) {
      console.error('[CollectionAutomation] Erro ao enviar cobrança 30 dias:', error);
    }
  }

  return sent;
}

/**
 * Executa todas as réguas de cobrança
 */
export async function runCollectionAutomation(): Promise<CollectionStats> {
  console.log('[CollectionAutomation] ========== INICIANDO RÉGUAS DE COBRANÇA ==========');
  console.log(`[CollectionAutomation] Data/Hora: ${new Date().toLocaleString('pt-BR')}`);

  const stats: CollectionStats = {
    dueIn7Days: 0,
    dueIn3Days: 0,
    dueToday: 0,
    overdue1Day: 0,
    overdue3Days: 0,
    overdue7Days: 0,
    overdue15Days: 0,
    overdue30Days: 0,
    totalSent: 0,
    errors: 0
  };

  try {
    // 0. MULTA CUMULATIVA R$20/dia — atualiza saldo devedor ANTES dos disparos
    await applyDailyLateFees();

    // Lembretes de vencimento
    stats.dueIn7Days = await processDueIn7Days();
    stats.dueIn3Days = await processDueIn3Days();
    stats.dueToday = await processDueToday();

    // Cobranças de atraso
    stats.overdue1Day = await processOverdue1Day();
    stats.overdue3Days = await processOverdue3Days();
    stats.overdue7Days = await processOverdue7Days();
    stats.overdue15Days = await processOverdue15Days();
    stats.overdue30Days = await processOverdue30Days();

    stats.totalSent = stats.dueIn7Days + stats.dueIn3Days + stats.dueToday +
                      stats.overdue1Day + stats.overdue3Days + stats.overdue7Days +
                      stats.overdue15Days + stats.overdue30Days;

    console.log('[CollectionAutomation] ========== RESUMO ==========');
    console.log(`[CollectionAutomation] Vencendo em 7 dias: ${stats.dueIn7Days}`);
    console.log(`[CollectionAutomation] Vencendo em 3 dias: ${stats.dueIn3Days}`);
    console.log(`[CollectionAutomation] Vencendo hoje: ${stats.dueToday}`);
    console.log(`[CollectionAutomation] Atraso 1 dia: ${stats.overdue1Day}`);
    console.log(`[CollectionAutomation] Atraso 3 dias: ${stats.overdue3Days}`);
    console.log(`[CollectionAutomation] Atraso 7 dias: ${stats.overdue7Days}`);
    console.log(`[CollectionAutomation] Atraso 15 dias: ${stats.overdue15Days}`);
    console.log(`[CollectionAutomation] Atraso 30 dias: ${stats.overdue30Days}`);
    console.log(`[CollectionAutomation] TOTAL ENVIADO: ${stats.totalSent}`);
    console.log('[CollectionAutomation] ========== CONCLUÍDO ==========');

  } catch (error) {
    console.error('[CollectionAutomation] Erro ao executar réguas:', error);
    stats.errors++;
  }

  return stats;
}

export const collectionAutomationService = {
  runCollectionAutomation
};

// ══════════════════════════════════════════════════════════════════════════════
// MULTA CUMULATIVA R$20/DIA — Atualiza saldo devedor das parcelas em atraso
// Roda diariamente pelo cron ANTES dos disparos de notificação
// Regra do Domingo: multa acumula em dias CORRIDOS (inclusive domingo)
// ══════════════════════════════════════════════════════════════════════════════

const LATE_FEE_DAILY = 20; // R$20 por dia corrido de atraso

/**
 * Calcula dias de atraso em dias corridos (inclusive domingos).
 */
function calcDaysOverdue(dueDate: Date, today: Date): number {
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  const ref = new Date(today);
  ref.setHours(0, 0, 0, 0);
  if (ref <= due) return 0;
  return Math.floor((ref.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Atualiza lateFeeAmount e daysOverdue de TODAS as parcelas OPEN vencidas.
 * Chamado diariamente pelo cron ANTES do envio de notificações.
 * Retorna quantidade de parcelas atualizadas.
 */
export async function applyDailyLateFees(): Promise<number> {
  const today = new Date();
  today.setHours(23, 59, 59, 999);

  // Busca todas parcelas OPEN com vencimento até hoje
  const overdueInstallments = await prisma.installment.findMany({
    where: {
      status: 'OPEN',
      dueDate: { lte: today },
    },
    select: {
      id: true,
      dueDate: true,
      amount: true,
    },
  });

  console.log(`[CollectionAutomation] 💰 Aplicando multa em ${overdueInstallments.length} parcela(s) em atraso`);

  let updated = 0;
  const now = new Date();

  for (const inst of overdueInstallments) {
    const daysOverdue = calcDaysOverdue(inst.dueDate, now);
    if (daysOverdue === 0) continue;

    const fineAccumulated = +(daysOverdue * LATE_FEE_DAILY).toFixed(2);

    try {
      await prisma.installment.update({
        where: { id: inst.id },
        data: {
          daysOverdue,
          lateFeeAmount: fineAccumulated,
          fineAccumulated,
        } as any,
      });
      updated++;
    } catch (err) {
      console.error(`[CollectionAutomation] Erro ao atualizar multa parcela ${inst.id}:`, err);
    }
  }

  console.log(`[CollectionAutomation] ✅ Multa aplicada em ${updated} parcela(s). R$ ${LATE_FEE_DAILY}/dia`);
  return updated;
}
