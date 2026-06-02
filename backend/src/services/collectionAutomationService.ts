import { prisma } from './prisma';
import { templateService } from './templateService';
import {
  computeCharge,
  resolveMonthlyRate,
  resolveSundayPolicyForFine,
  type ChargeBreakdown,
  type SundayPolicyForFine,
} from './interestEngine';

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
 * Normaliza uma taxa que pode estar em percentual (ex.: 30 = 30%) ou já em
 * fração (ex.: 0.30). Heurística segura para o domínio (taxas mensais reais):
 *  - null/NaN/<= 0  → null (deixa a cascata cair para a próxima fonte/default)
 *  - valor  > 1     → trata como percentual e divide por 100 (30 → 0.30)
 *  - valor <= 1     → já é fração (0.30 → 0.30)
 * Alinhado ao uso existente no código (`Number(loan.interestRate || 30) / 100`
 * em `ensureInterestOnlyOpenInstallments` e `parseFloat(value||'30')/100` em
 * `routes/loans.ts`).
 */
function normalizeRate(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value) || value <= 0) return null;
  return value > 1 ? value / 100 : value;
}

/**
 * Lê a taxa mensal padrão do sistema (`SystemSetting("monthlyInterestRate")`),
 * normalizada para fração (ex.: "30" → 0.30). Lida UMA vez por processador de
 * atraso (não por parcela). Retorna null se ausente, deixando a cascata do
 * engine cair no próximo nível / default 0.30.
 */
export async function getSystemMonthlyRateSetting(): Promise<number | null> {
  try {
    const setting = await prisma.systemSetting.findFirst({ where: { key: 'monthlyInterestRate' } });
    return normalizeRate(setting?.value != null ? Number(setting.value) : null);
  } catch {
    return null;
  }
}

/**
 * Lê a política de domingo para a MULTA DIÁRIA do AUTONOMO a partir de
 * `SystemSetting("sundayPolicyForFine")`, de forma PURA na resolução.
 *
 * Bugfix spec "correcao-calculo-juros-parcelas" — Task 5.1 (OPCIONAL).
 *
 * Retrocompatível e falha-segura: ausência da config (ou qualquer valor que não
 * seja literalmente `'PULA_DOMINGO'`) resolve para o DEFAULT `'CORRIDO'`, que
 * preserva EXATAMENTE o comportamento atual (multa = D × R$ 20, dias corridos,
 * inclusive domingo). O negócio pode flipar para excluir domingos da multa
 * apenas gravando `SystemSetting("sundayPolicyForFine") = "PULA_DOMINGO"` —
 * SEM qualquer alteração de código.
 *
 * NOTA: esta política afeta SOMENTE a multa diária do AUTONOMO. O juros de mora
 * do AUTONOMO já exclui domingos por regra de negócio (req 2.6), e CLT/GARANTIA
 * cobram a multa diária sempre em dias corridos.
 */
export async function getSundayPolicyForFineSetting(): Promise<SundayPolicyForFine> {
  try {
    const setting = await prisma.systemSetting.findFirst({ where: { key: 'sundayPolicyForFine' } });
    return resolveSundayPolicyForFine(setting?.value ?? null);
  } catch {
    return resolveSundayPolicyForFine(null);
  }
}

/**
 * Monta a cobrança oficial de uma parcela em atraso usando o `interestEngine`
 * como ÚNICA fonte de verdade do `valor_com_juros` (substitui o antigo cálculo
 * hardcoded de 10% a.m. — `calculateOverdueAmount`).
 *
 * Exportada (Task 3.5) para reuso pelos demais pontos de disparo do WhatsApp
 * (ex.: cron de detecção de atraso em `cron/installmentReminders.ts`), garantindo
 * que TODO `valor_com_juros` enviado ao cliente venha da mesma fonte de cálculo.
 *
 * Resolução da taxa mensal (cascata oficial, req 2.1):
 *   contrato (`loan.interestRate`) → cliente (`Customer.lateInterestMonthly`
 *   ?? `Customer.monthlyInterestRate`) → `SystemSetting("monthlyInterestRate")`
 *   → default 0.30 (nunca 0.10).
 *
 * IMPORTANTE — evitar dupla contagem da multa diária: `applyDailyLateFees`
 * continua persistindo `lateFeeAmount`/`fineAccumulated`/`daysOverdue` para o
 * saldo/exibição, mas o engine já compõe a multa de R$ 20/dia DENTRO de
 * `result.total`. Portanto o `valor_com_juros` da MENSAGEM vem exclusivamente
 * do engine; NÃO somamos `installment.fineAccumulated` por cima do total.
 */
export function buildOverdueCharge(
  installment: any,
  daysOverdue: number,
  chargeAmount: number,
  systemSettingRate: number | null,
  sundayPolicyForFine: SundayPolicyForFine = 'CORRIDO'
): ChargeBreakdown {
  const loan = installment.loan;
  const profileType = loan?.loanRequest?.profileType || '';
  const customer = loan?.customer;

  const monthlyRate = resolveMonthlyRate({
    contractRate: normalizeRate(loan?.interestRate),
    customerRate: normalizeRate(customer?.lateInterestMonthly ?? customer?.monthlyInterestRate),
    systemSettingRate,
  });

  // principal = base dos 30% (juros do mês). loanAmount = base dos 7%.
  const principal = Number(loan?.principalAmount ?? loan?.amount ?? installment.amount);
  const loanAmount = Number(loan?.amount ?? principal);

  return computeCharge({
    profileType,
    principal,
    loanAmount,
    daysOverdue,
    base: chargeAmount, // usado por AUTONOMO/MOTO; rollover ignora (usa principal×taxa)
    dueDate: installment.dueDate,
    today: new Date(), // AUTONOMO: exclusão de domingos da contagem de juros
    monthlyRate,
    sundayPolicyForFine, // AUTONOMO: política de domingo p/ a multa diária (default CORRIDO)
  });
}

/**
 * Deriva as variáveis EXTRAS de template (transparência) a partir do breakdown
 * do `interestEngine`, formatadas no MESMO padrão BRL de `valor_com_juros`
 * (via `formatCurrency`).
 *
 * Bugfix spec "correcao-calculo-juros-parcelas" — Task 3.5.1 (OPCIONAL).
 *
 * Aditiva e retrocompatível: NÃO substitui nem renomeia `valor_com_juros`;
 * apenas acrescenta `juros_mes`, `multa_7` e `multa_diaria` para que a mensagem
 * possa detalhar a composição do valor cobrado.
 *
 * Coerência por modalidade/cenário (já garantida pelo engine):
 *  - AUTONOMO: `multa_7` = "0,00" (modalidade sem os 7% de inadimplência).
 *  - D = 0 (não vencido) em CLT/GARANTIA: `multa_7` e `multa_diaria` = "0,00".
 *  - `juros_mes` reflete o juros do mês (rollover) ou o juros de mora (AUTONOMO).
 */
export function buildChargeTemplateVars(charge: ChargeBreakdown): {
  juros_mes: string;
  multa_7: string;
  multa_diaria: string;
} {
  return {
    juros_mes: formatCurrency(charge.jurosMes),
    multa_7: formatCurrency(charge.multa7),
    multa_diaria: formatCurrency(charge.multaDiaria),
  };
}

function getNextMonthlyDueDate(lastDueDate: Date): Date {
  const nextDueDate = new Date(lastDueDate);
  nextDueDate.setMonth(nextDueDate.getMonth() + 1);
  return nextDueDate;
}

async function ensureInterestOnlyOpenInstallments(): Promise<number> {
  const loans = await prisma.loan.findMany({
    where: {
      status: 'ACTIVE',
      remainingAmount: { gt: 0 },
      loanRequest: { profileType: { in: ['CLT', 'GARANTIA', 'GARANTIA_VEICULO'] } },
      installments: { none: { status: { in: ['OPEN', 'LATE', 'AWAITING_CONFIRMATION'] } } }
    },
    include: {
      installments: { orderBy: { dueDate: 'desc' }, take: 1 }
    }
  });

  let created = 0;
  for (const loan of loans) {
    const lastInstallment = loan.installments[0];
    if (!lastInstallment || lastInstallment.status !== 'PAID') continue;

    const interestRate = Number(loan.interestRate || 30) / 100;
    const amount = Number(loan.principalAmount || loan.remainingAmount) * interestRate;
    await prisma.installment.create({
      data: {
        loanId: loan.id,
        amount,
        dueDate: getNextMonthlyDueDate(lastInstallment.dueDate),
        status: { in: ['OPEN', 'LATE', 'AWAITING_CONFIRMATION'] },
        isInterestPayment: true
      }
    });
    created++;
  }

  if (created > 0) {
    console.log(`[CollectionAutomation] Auto-heal: ${created} parcela(s) de juros criada(s) para contratos CLT/Garantia sem cobrança aberta`);
  }
  return created;
}

function getCollectionContext(installment: any) {
  const loan = installment.loan;
  const profileType = loan?.loanRequest?.profileType || '';
  const isInterestOnly = ['CLT', 'GARANTIA', 'GARANTIA_VEICULO'].includes(profileType);
  const openInstallments = loan?.installments?.filter((i: any) => ['OPEN', 'LATE', 'AWAITING_CONFIRMATION'].includes(i.status)) || [];
  const isLastOpenInstallment = openInstallments.length <= 1 || openInstallments.every((i: any) => i.id === installment.id || new Date(i.dueDate) <= new Date(installment.dueDate));
  const shouldChargeTotal = !isInterestOnly && isLastOpenInstallment;
  const chargeAmount = shouldChargeTotal ? Number(loan.remainingAmount || installment.amount) : Number(installment.amount);

  // Terminologia oficial por modalidade (CLT/GARANTIA → juros de rolagem;
  // AUTONOMO → diária amortizadora; MOTO → parcela). Fonte única no templateService.
  const modalidade = templateService.getModalityTerminology(profileType);

  return {
    chargeAmount,
    valor: formatCurrency(chargeAmount),
    valor_parcela: formatCurrency(installment.amount),
    valor_total: formatCurrency(Number(loan.remainingAmount || installment.amount)),
    termo_cobranca: modalidade.label,
    tipo_cobranca: shouldChargeTotal ? 'QUITAÇÃO TOTAL' : (isInterestOnly ? 'JUROS' : modalidade.tipo),
    instrucao_cobranca: shouldChargeTotal
      ? 'Cobrar o valor total em aberto para quitação do contrato.'
      : isInterestOnly
        ? 'Cobrar apenas os juros/parcela do período. Não cobrar o principal agora.'
        : 'Cobrar a parcela do período.'
  };
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
      status: { in: ['OPEN', 'LATE', 'AWAITING_CONFIRMATION'] },
      loan: { status: 'ACTIVE' }
    },
    include: {
      loan: {
        include: {
          customer: true,
          loanRequest: { select: { profileType: true } },
          installments: { where: { status: { in: ['OPEN', 'LATE', 'AWAITING_CONFIRMATION'] } }, orderBy: { dueDate: 'asc' } }
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
          ...getCollectionContext(installment),
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
      status: { in: ['OPEN', 'LATE', 'AWAITING_CONFIRMATION'] },
      loan: { status: 'ACTIVE' }
    },
    include: {
      loan: {
        include: {
          customer: true,
          loanRequest: { select: { profileType: true } },
          installments: { where: { status: { in: ['OPEN', 'LATE', 'AWAITING_CONFIRMATION'] } }, orderBy: { dueDate: 'asc' } }
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
          ...getCollectionContext(installment),
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
      status: { in: ['OPEN', 'LATE', 'AWAITING_CONFIRMATION'] },
      loan: { status: 'ACTIVE' }
    },
    include: {
      loan: {
        include: {
          customer: true,
          loanRequest: { select: { profileType: true } },
          installments: { where: { status: { in: ['OPEN', 'LATE', 'AWAITING_CONFIRMATION'] } }, orderBy: { dueDate: 'asc' } }
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
          ...getCollectionContext(installment),
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
      status: { in: ['OPEN', 'LATE', 'AWAITING_CONFIRMATION'] },
      loan: { status: 'ACTIVE' }
    },
    include: {
      loan: {
        include: {
          customer: true,
          loanRequest: { select: { profileType: true } },
          installments: { where: { status: { in: ['OPEN', 'LATE', 'AWAITING_CONFIRMATION'] } }, orderBy: { dueDate: 'asc' } }
        }
      }
    }
  });

  console.log(`[CollectionAutomation] Encontradas ${installments.length} parcelas com 1 dia de atraso`);

  const systemSettingRate = await getSystemMonthlyRateSetting();
  const sundayFinePolicy = await getSundayPolicyForFineSetting();

  let sent = 0;
  for (const installment of installments) {
    try {
      const customer = installment.loan.customer;
      const daysOverdue = Math.max(1, calcDaysOverdue(installment.dueDate, new Date()));
      const collectionContext = getCollectionContext(installment);
      const charge = buildOverdueCharge(installment, daysOverdue, collectionContext.chargeAmount, systemSettingRate, sundayFinePolicy);

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
          dias_atraso: daysOverdue.toString(),
          ...collectionContext,
          valor_com_juros: formatCurrency(charge.total),
          ...buildChargeTemplateVars(charge),
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
      status: { in: ['OPEN', 'LATE', 'AWAITING_CONFIRMATION'] },
      loan: { status: 'ACTIVE' }
    },
    include: {
      loan: {
        include: {
          customer: true,
          loanRequest: { select: { profileType: true } },
          installments: { where: { status: { in: ['OPEN', 'LATE', 'AWAITING_CONFIRMATION'] } }, orderBy: { dueDate: 'asc' } }
        }
      }
    }
  });

  console.log(`[CollectionAutomation] Encontradas ${installments.length} parcelas com 3 dias de atraso`);

  const systemSettingRate = await getSystemMonthlyRateSetting();
  const sundayFinePolicy = await getSundayPolicyForFineSetting();

  let sent = 0;
  for (const installment of installments) {
    try {
      const customer = installment.loan.customer;
      const daysOverdue = Math.max(3, calcDaysOverdue(installment.dueDate, new Date()));
      const collectionContext = getCollectionContext(installment);
      const charge = buildOverdueCharge(installment, daysOverdue, collectionContext.chargeAmount, systemSettingRate, sundayFinePolicy);

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
          dias_atraso: daysOverdue.toString(),
          ...collectionContext,
          valor_com_juros: formatCurrency(charge.total),
          ...buildChargeTemplateVars(charge),
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
      status: { in: ['OPEN', 'LATE', 'AWAITING_CONFIRMATION'] },
      loan: { status: 'ACTIVE' }
    },
    include: {
      loan: {
        include: {
          customer: true,
          loanRequest: { select: { profileType: true } },
          installments: { where: { status: { in: ['OPEN', 'LATE', 'AWAITING_CONFIRMATION'] } }, orderBy: { dueDate: 'asc' } }
        }
      }
    }
  });

  console.log(`[CollectionAutomation] Encontradas ${installments.length} parcelas com 7 dias de atraso`);

  const systemSettingRate = await getSystemMonthlyRateSetting();
  const sundayFinePolicy = await getSundayPolicyForFineSetting();

  let sent = 0;
  for (const installment of installments) {
    try {
      const customer = installment.loan.customer;
      const daysOverdue = Math.floor((Date.now() - installment.dueDate.getTime()) / (1000 * 60 * 60 * 24));
      const collectionContext = getCollectionContext(installment);
      // Engine = única fonte de verdade do valor_com_juros (substitui o 10% antigo).
      const charge = buildOverdueCharge(installment, daysOverdue, collectionContext.chargeAmount, systemSettingRate, sundayFinePolicy);

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
          ...collectionContext,
          valor_com_juros: formatCurrency(charge.total),
          ...buildChargeTemplateVars(charge),
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
      status: { in: ['OPEN', 'LATE', 'AWAITING_CONFIRMATION'] },
      loan: { status: 'ACTIVE' }
    },
    include: {
      loan: {
        include: {
          customer: true,
          loanRequest: { select: { profileType: true } },
          installments: { where: { status: { in: ['OPEN', 'LATE', 'AWAITING_CONFIRMATION'] } }, orderBy: { dueDate: 'asc' } }
        }
      }
    }
  });

  console.log(`[CollectionAutomation] Encontradas ${installments.length} parcelas com 15 dias de atraso`);

  const systemSettingRate = await getSystemMonthlyRateSetting();
  const sundayFinePolicy = await getSundayPolicyForFineSetting();

  let sent = 0;
  for (const installment of installments) {
    try {
      const customer = installment.loan.customer;
      const daysOverdue = Math.floor((Date.now() - installment.dueDate.getTime()) / (1000 * 60 * 60 * 24));
      const collectionContext = getCollectionContext(installment);
      // Engine = única fonte de verdade do valor_com_juros (substitui o 10% antigo).
      const charge = buildOverdueCharge(installment, daysOverdue, collectionContext.chargeAmount, systemSettingRate, sundayFinePolicy);

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
          dias_atraso: daysOverdue.toString(),
          ...collectionContext,
          valor_com_juros: formatCurrency(charge.total),
          ...buildChargeTemplateVars(charge),
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
      status: { in: ['OPEN', 'LATE', 'AWAITING_CONFIRMATION'] },
      loan: { status: 'ACTIVE' }
    },
    include: {
      loan: {
        include: {
          customer: true,
          loanRequest: { select: { profileType: true } },
          installments: { where: { status: { in: ['OPEN', 'LATE', 'AWAITING_CONFIRMATION'] } }, orderBy: { dueDate: 'asc' } }
        }
      }
    }
  });

  console.log(`[CollectionAutomation] Encontradas ${installments.length} parcelas com 30 dias de atraso`);

  const systemSettingRate = await getSystemMonthlyRateSetting();
  const sundayFinePolicy = await getSundayPolicyForFineSetting();

  let sent = 0;
  for (const installment of installments) {
    try {
      const customer = installment.loan.customer;
      const daysOverdue = Math.floor((Date.now() - installment.dueDate.getTime()) / (1000 * 60 * 60 * 24));
      const collectionContext = getCollectionContext(installment);
      // Engine = única fonte de verdade do valor_com_juros (substitui o 10% antigo).
      const charge = buildOverdueCharge(installment, daysOverdue, collectionContext.chargeAmount, systemSettingRate, sundayFinePolicy);

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
          dias_atraso: daysOverdue.toString(),
          ...collectionContext,
          valor_com_juros: formatCurrency(charge.total),
          ...buildChargeTemplateVars(charge),
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
    // 0. Auto-heal: garante que CLT/Garantia ativos tenham próxima parcela de juros aberta
    await ensureInterestOnlyOpenInstallments();

    // 1. MULTA CUMULATIVA R$20/dia — atualiza saldo devedor ANTES dos disparos
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
  runCollectionAutomation,
  buildOverdueCharge,
  buildChargeTemplateVars,
  getSystemMonthlyRateSetting,
  getSundayPolicyForFineSetting
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
      status: { in: ['OPEN', 'LATE', 'AWAITING_CONFIRMATION'] },
      loan: { status: 'ACTIVE' },
      dueDate: { lte: today },
    },
    include: {
      loan: {
        include: {
          customer: true,
          loanRequest: { select: { profileType: true } }
        }
      }
    },
  });

  console.log(`[CollectionAutomation] 💰 Aplicando multa em ${overdueInstallments.length} parcela(s) em atraso`);

  let updated = 0;
  const now = new Date();

  for (const inst of overdueInstallments) {
    const daysOverdue = calcDaysOverdue(inst.dueDate, now);
    if (daysOverdue === 0) continue;

    const profileType = inst.loan?.loanRequest?.profileType || '';
    const loanAmount = Number(inst.loan?.amount ?? inst.loan?.principalAmount ?? inst.amount);
    const isMonthlyLoan = ['CLT', 'GARANTIA', 'GARANTIA_VEICULO'].includes(profileType) || inst.loan?.paymentFrequency === 'MONTHLY' || inst.isInterestPayment;
    const fineAccumulated = isMonthlyLoan
      ? +((loanAmount * 0.07) + (daysOverdue * LATE_FEE_DAILY)).toFixed(2)
      : +(daysOverdue * LATE_FEE_DAILY).toFixed(2);

    try {
      await prisma.installment.update({
        where: { id: inst.id },
        data: {
          daysOverdue,
          lateFeeAmount: fineAccumulated,
          fineAccumulated,
        },
      });
      updated++;
    } catch (err) {
      console.error(`[CollectionAutomation] Erro ao atualizar multa parcela ${inst.id}:`, err);
    }
  }

  console.log(`[CollectionAutomation] ✅ Multa aplicada em ${updated} parcela(s). R$ ${LATE_FEE_DAILY}/dia`);
  return updated;
}
