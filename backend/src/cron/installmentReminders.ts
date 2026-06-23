import { CronJob } from 'cron';
import { prisma } from '../services/prisma';
import { emailService } from '../services/email';
import { sendWhatsAppMessage } from '../services/whatsapp';
import { sendPushToUser, sendPushToRole } from '../routes/push';
import { buildChargeTemplateVars, buildOverdueCharge, getSystemMonthlyRateSetting, getSundayPolicyForFineSetting } from '../services/collectionAutomationService';
import { getModalityTerminology } from '../services/templateService';

function brDate(d: Date | string) {
  return new Date(d).toLocaleDateString('pt-BR');
}

function brMoney(value: number): string {
  return `R$ ${Number(value).toFixed(2)}`;
}

function brandedHtml(body: string): string {
  return `
  <div style="font-family:Arial;max-width:600px;margin:0 auto;background:#000;color:#fff;padding:30px;border-radius:12px;">
    <div style="text-align:center;margin-bottom:20px;">
      <h1 style="color:#D4AF37;font-size:24px;">🦈 Tubarão Empréstimos</h1>
    </div>
    <div style="color:#ccc;font-size:15px;line-height:1.6;">${body}</div>
    <hr style="border-color:#333;margin:25px 0;" />
    <p style="color:#666;font-size:12px;text-align:center;">Tubarão Empréstimos — Plataforma de Crédito Premium</p>
  </div>`;
}

async function getPixKey(): Promise<string> {
  try {
    const pk = await (prisma as any).systemSettings?.findFirst?.({ where: { key: 'pix_key' } })
      || await (prisma as any).systemSetting?.findFirst?.({ where: { key: 'pix_key' } });
    return pk?.value || '';
  } catch {
    try {
      // Fallback: tenta o outro nome
      const pk = await (prisma as any).systemSetting?.findFirst?.({ where: { key: 'pix_key' } });
      return pk?.value || '';
    } catch {
      return '';
    }
  }
}

// ============ CRON 1: Lembretes de parcelas (3 dias antes + no dia) ============
export const scheduleInstallmentReminders = () => {
  const job = new CronJob('0 8 * * *', async () => {
    try {
      const now = new Date();
      const in3 = new Date(now);
      in3.setDate(in3.getDate() + 3);

      const start3 = new Date(in3); start3.setHours(0, 0, 0, 0);
      const end3 = new Date(in3); end3.setHours(23, 59, 59, 999);
      const start0 = new Date(now); start0.setHours(0, 0, 0, 0);
      const end0 = new Date(now); end0.setHours(23, 59, 59, 999);

      const dueIn3 = await prisma.installment.findMany({
        where: { status: 'OPEN', dueDate: { gte: start3, lte: end3 } },
        include: { loan: { include: { customer: true } } }
      });

      const dueToday = await prisma.installment.findMany({
        where: { status: 'OPEN', dueDate: { gte: start0, lte: end0 } },
        include: { loan: { include: { customer: true } } }
      });

      const pixKey = await getPixKey();

      // Lembrete 3 dias antes
      for (const inst of dueIn3) {
        const c = inst.loan?.customer;
        if (!c) continue;

        const amtFmt = `R$ ${Number(inst.amount).toFixed(2)}`;
        const pixInfo = inst.pixCode ? `\n\n📱 *PIX Copia e Cola:*\n${inst.pixCode}` : (pixKey ? `\n\n📱 *Chave PIX:* ${pixKey}` : '');

        if (c.email) {
          const html = brandedHtml(`
            <h2 style="color:#FFD700;">⏰ Lembrete de Pagamento</h2>
            <p>Olá, <strong>${c.name}</strong>!</p>
            <p>Sua parcela de <strong style="color:#D4AF37;">${amtFmt}</strong> vence em <strong>${brDate(inst.dueDate)}</strong> (3 dias).</p>
            ${pixKey ? `<div style="background:#111;border:1px solid #333;border-radius:8px;padding:15px;margin:15px 0;">
              <p style="margin:5px 0;color:#ccc;"><strong style="color:#D4AF37;">Chave PIX:</strong> ${pixKey}</p>
              ${inst.pixCode ? `<p style="margin:5px 0;color:#ccc;word-break:break-all;"><strong style="color:#D4AF37;">PIX Copia e Cola:</strong> ${inst.pixCode}</p>` : ''}
            </div>` : ''}
            <div style="text-align:center;margin:20px 0;">
              <a href="https://www.tubaraoemprestimo.com.br" style="background:#D4AF37;color:#000;padding:12px 30px;border-radius:8px;text-decoration:none;font-weight:bold;">Acessar App</a>
            </div>
          `);
          emailService.send(c.email, `⏰ Parcela vence em 3 dias — ${amtFmt}`, html).catch(err => console.error('[Cron] Email 3d failed:', err.message));
        }

        if (c.phone) {
          sendWhatsAppMessage(c.phone,
            `⏰ *Lembrete de Pagamento*\n\nOlá, ${c.name.split(' ')[0]}!\n\nSua parcela de *${amtFmt}* vence em *${brDate(inst.dueDate)}* (3 dias).${pixInfo}\n\nAcesse o app para mais detalhes.\n\n_Tubarão Empréstimos 🦈_`
          ).catch(err => console.error('[Cron] WA 3d failed:', err));
        }

        if (c.userId) {
          sendPushToUser(c.userId, '⏰ Parcela vence em 3 dias', `Sua parcela de ${amtFmt} vence em ${brDate(inst.dueDate)}`).catch(() => { });
        }

        await prisma.notification.create({
          data: {
            customerId: c.id,
            customerEmail: c.email,
            title: '⏰ Parcela vence em 3 dias',
            message: `Sua parcela de ${amtFmt} vence em ${brDate(inst.dueDate)}.`,
            type: 'WARNING'
          }
        }).catch(() => { });
      }

      // Lembrete no dia
      for (const inst of dueToday) {
        const c = inst.loan?.customer;
        if (!c) continue;

        const amtFmt = `R$ ${Number(inst.amount).toFixed(2)}`;
        const pixInfo = inst.pixCode ? `\n\n📱 *PIX Copia e Cola:*\n${inst.pixCode}` : (pixKey ? `\n\n📱 *Chave PIX:* ${pixKey}` : '');

        if (c.email) {
          const html = brandedHtml(`
            <h2 style="color:#FF6B6B;">⚠️ Parcela Vence HOJE!</h2>
            <p>Olá, <strong>${c.name}</strong>!</p>
            <p>Sua parcela de <strong style="color:#FF6B6B;">${amtFmt}</strong> vence <strong>HOJE</strong>.</p>
            ${pixKey ? `<div style="background:#111;border:1px solid #333;border-radius:8px;padding:15px;margin:15px 0;">
              <p style="margin:5px 0;color:#ccc;"><strong style="color:#D4AF37;">Chave PIX:</strong> ${pixKey}</p>
              ${inst.pixCode ? `<p style="margin:5px 0;color:#ccc;word-break:break-all;"><strong style="color:#D4AF37;">PIX Copia e Cola:</strong> ${inst.pixCode}</p>` : ''}
            </div>` : ''}
            <p style="color:#aaa;">Evite juros e multas pagando em dia.</p>
            <div style="text-align:center;margin:20px 0;">
              <a href="https://www.tubaraoemprestimo.com.br" style="background:#D4AF37;color:#000;padding:12px 30px;border-radius:8px;text-decoration:none;font-weight:bold;">Pagar Agora</a>
            </div>
          `);
          emailService.send(c.email, `⚠️ Parcela vence HOJE — ${amtFmt}`, html).catch(err => console.error('[Cron] Email today failed:', err.message));
        }

        if (c.phone) {
          sendWhatsAppMessage(c.phone,
            `⚠️ *PARCELA VENCE HOJE!*\n\nOlá, ${c.name.split(' ')[0]}!\n\nSua parcela de *${amtFmt}* vence *HOJE*.${pixInfo}\n\nEvite juros e multas pagando em dia.\n\nAcesse o app para mais detalhes.\n\n_Tubarão Empréstimos 🦈_`
          ).catch(err => console.error('[Cron] WA today failed:', err));
        }

        if (c.userId) {
          sendPushToUser(c.userId, '⚠️ Parcela vence HOJE', `Sua parcela de ${amtFmt} vence hoje!`).catch(() => { });
        }

        await prisma.notification.create({
          data: {
            customerId: c.id,
            customerEmail: c.email,
            title: '⚠️ Parcela vence HOJE',
            message: `Sua parcela de ${amtFmt} vence hoje. Evite juros!`,
            type: 'WARNING'
          }
        }).catch(() => { });
      }

      console.log(`[Cron] reminders ok: +3d=${dueIn3.length}, today=${dueToday.length}`);
    } catch (e) {
      console.error('[Cron] installment reminders error:', e);
    }
  });

  job.start();
};

// ============ CRON 2: Detecção de parcelas ATRASADAS ============
export const scheduleLatePaymentDetection = () => {
  // Roda todo dia às 9h (1h após lembretes)
  const job = new CronJob('0 9 * * *', async () => {
    try {
      const now = new Date();
      now.setHours(0, 0, 0, 0);

      // Encontrar parcelas OPEN com vencimento no passado
      const overdueInstallments = await prisma.installment.findMany({
        where: {
          status: 'OPEN',
          dueDate: { lt: now }
        },
        include: {
          loan: {
            include: {
              customer: true,
              loanRequest: { select: { profileType: true } }
            }
          }
        }
      });

      if (overdueInstallments.length === 0) {
        console.log('[Cron] No overdue installments found');
        return;
      }

      const pixKey = await getPixKey();
      // Configs lidas UMA vez por execução (cascata oficial no engine).
      const systemSettingRate = await getSystemMonthlyRateSetting();
      const sundayFinePolicy = await getSundayPolicyForFineSetting();

      for (const inst of overdueInstallments) {
        const c = inst.loan?.customer;
        if (!c) continue;

        const daysOverdue = Math.floor((Date.now() - new Date(inst.dueDate).getTime()) / (1000 * 60 * 60 * 24));

        // Enviar apenas para atrasos de 1, 3, 7, 15, 30 dias (não bombardear diariamente)
        if (![1, 3, 7, 15, 30].includes(daysOverdue)) continue;

        // valor_com_juros vem do interestEngine (mesma fonte do cron de cobrança):
        // CLT/GARANTIA → juros + 7% + R$20/dia; AUTONOMO → juros mora (s/ domingo) + R$20/dia.
        const profileType = inst.loan?.loanRequest?.profileType || '';
        const modalidade = getModalityTerminology(profileType);
        const charge = buildOverdueCharge(inst, daysOverdue, Number(inst.amount), systemSettingRate, sundayFinePolicy);
        const chargeVars = buildChargeTemplateVars(charge);
        const amtFmt = brMoney(charge.total);
        const pixInfo = inst.pixCode ? `\n\n📱 *PIX Copia e Cola:*\n${inst.pixCode}` : (pixKey ? `\n\n📱 *Chave PIX:* ${pixKey}` : '');

        // Email ao cliente
        if (c.email) {
          const urgency = daysOverdue >= 15 ? '#FF0000' : daysOverdue >= 7 ? '#FF4444' : '#FF6B6B';
          const html = brandedHtml(`
            <h2 style="color:${urgency};">🚨 ${modalidade.label.charAt(0).toUpperCase() + modalidade.label.slice(1)} em atraso — ${daysOverdue} dia${daysOverdue > 1 ? 's' : ''}</h2>
            <p>Olá, <strong>${c.name}</strong>!</p>
            <p>Seu valor de <strong style="color:${urgency};">${amtFmt}</strong> (já com juros e multa) referente à ${modalidade.label} venceu em <strong>${brDate(inst.dueDate)}</strong> e está com <strong>${daysOverdue} dia${daysOverdue > 1 ? 's' : ''} de atraso</strong>.</p>
            <p style="color:#FF6B6B;"><strong>⚠️ Juros e multas estão sendo aplicados diariamente.</strong></p>
            ${pixKey ? `<div style="background:#111;border:1px solid #333;border-radius:8px;padding:15px;margin:15px 0;">
              <p style="margin:5px 0;color:#ccc;"><strong style="color:#D4AF37;">Chave PIX:</strong> ${pixKey}</p>
              ${inst.pixCode ? `<p style="margin:5px 0;color:#ccc;word-break:break-all;"><strong style="color:#D4AF37;">PIX Copia e Cola:</strong> ${inst.pixCode}</p>` : ''}
            </div>` : ''}
            <p style="color:#aaa;">Entre em contato conosco se precisar renegociar.</p>
            <div style="text-align:center;margin:20px 0;">
              <a href="https://www.tubaraoemprestimo.com.br" style="background:#FF4444;color:#fff;padding:12px 30px;border-radius:8px;text-decoration:none;font-weight:bold;">Regularizar Agora</a>
            </div>
          `);
          emailService.send(c.email, `🚨 ${modalidade.label} em atraso (${daysOverdue} dias) — ${amtFmt}`, html).catch(err => console.error('[Cron] Late email failed:', err.message));
        }

        // WhatsApp ao cliente
        if (c.phone) {
          const baseFmt = brMoney(Number(inst.amount));
          sendWhatsAppMessage(c.phone,
            `🚨 *EM ATRASO*\n\nOlá, ${c.name.split(' ')[0]}!\n\nSua ${modalidade.label} de *${baseFmt}* venceu em *${brDate(inst.dueDate)}* (${daysOverdue} dia${daysOverdue > 1 ? 's' : ''} de atraso).\n\nJuros do período: *R$ ${chargeVars.juros_mes}*\nMulta contratual: *R$ ${chargeVars.multa_7}*\nMora diária: *R$ ${chargeVars.multa_diaria}*\nValor atualizado para pagamento hoje: *${amtFmt}*.${pixInfo}\n\n⚠️ Juros e multas estão sendo aplicados.\n\nRegularize pelo app ou entre em contato.\n\n_Tubarão Empréstimos 🦈_`
          ).catch(err => console.error('[Cron] Late WA failed:', err));
        }

        // Push ao cliente
        if (c.userId) {
          sendPushToUser(c.userId, `🚨 Em atraso (${daysOverdue}d)`, `Seu valor de ${amtFmt} está ${daysOverdue} dia(s) em atraso.`).catch(() => { });
        }

        // Notificação interna
        await prisma.notification.create({
          data: {
            customerId: c.id,
            customerEmail: c.email,
            title: `🚨 ${modalidade.label} em atraso — ${daysOverdue} dias`,
            message: `Valor de ${amtFmt} (com juros e multa) vencido em ${brDate(inst.dueDate)}.`,
            type: 'ALERT'
          }
        }).catch(() => { });
      }

      // Alerta para admin com resumo
      const totalOverdue = overdueInstallments.length;
      const totalAmount = overdueInstallments.reduce((sum, i) => sum + Number(i.amount), 0);

      // Notificação admin
      await prisma.notification.create({
        data: {
          title: `🚨 ${totalOverdue} parcela(s) em atraso`,
          message: `Total em atraso: R$ ${totalAmount.toFixed(2)}. Verifique o painel de cobranças.`,
          type: 'ALERT'
        }
      }).catch(() => { });

      // Push para admins
      sendPushToRole('ADMIN', `🚨 ${totalOverdue} parcela(s) em atraso`, `Total: R$ ${totalAmount.toFixed(2)}`).catch(() => { });

      // WhatsApp para admins
      try {
        const admins = await prisma.user.findMany({ where: { role: 'ADMIN' } });
        for (const admin of admins) {
          if (admin.phone) {
            sendWhatsAppMessage(admin.phone,
              `🚨 *Resumo de Atrasos*\n\n${totalOverdue} parcela(s) em atraso\nTotal: R$ ${totalAmount.toFixed(2)}\n\nAcesse o painel para detalhes.`
            ).catch(() => { });
          }
        }
      } catch { }

      console.log(`[Cron] late detection: ${totalOverdue} overdue, total R$ ${totalAmount.toFixed(2)}`);
    } catch (e) {
      console.error('[Cron] late payment detection error:', e);
    }
  });

  job.start();
};

// ============ CRON 3: WhatsApp Status agendado ============
export const scheduleWhatsAppStatus = () => {
  const job = new CronJob('*/5 * * * *', async () => {
    try {
      const now = new Date();
      const pendingStatuses = await prisma.scheduledStatus.findMany({
        where: {
          status: 'PENDING',
          scheduledAt: { lte: now }
        }
      });

      for (const status of pendingStatuses) {
        try {
          const { sendWhatsAppStatus } = await import('../services/whatsapp');
          await sendWhatsAppStatus(status.imageUrl, status.caption || undefined);

          await prisma.scheduledStatus.update({
            where: { id: status.id },
            data: { status: 'POSTED', postedAt: new Date() }
          });
          console.log(`[Cron] WhatsApp status posted: ${status.id}`);
        } catch (err: any) {
          await prisma.scheduledStatus.update({
            where: { id: status.id },
            data: { status: 'FAILED', errorMessage: err.message }
          });
          console.error(`[Cron] WhatsApp status failed:`, err.message);
        }
      }
    } catch (e) {
      console.error('[Cron] WhatsApp status cron error:', e);
    }
  });

  job.start();
};

// ============ CRON: BÔNUS MENSAL DE PARCEIROS ============
const schedulePartnerBonusEvaluation = () => {
  // Roda no dia 1 de cada mês às 10h
  const job = new CronJob('0 10 1 * *', async () => {
    try {
      console.log('[Cron] Starting monthly partner bonus evaluation...');

      // Mês anterior
      const now = new Date();
      const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const monthStr = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, '0')}`;
      const monthStart = prevMonth;
      const monthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

      // Buscar todos os parceiros ativos
      const partners = await prisma.user.findMany({
        where: { isPartner: true }
      });

      for (const partner of partners) {
        // Contar contratos do parceiro no mês anterior
        const contracts = await prisma.partnerCommission.findMany({
          where: {
            partnerId: partner.id,
            createdAt: { gte: monthStart, lte: monthEnd }
          },
          include: {
            loanRequest: {
              include: {
                loan: {
                  include: {
                    installments: true
                  }
                }
              }
            }
          }
        });

        const contractsCount = contracts.length;
        if (contractsCount === 0) continue;

        // Calcular taxa de inadimplência
        let totalInstallments = 0;
        let lateInstallments = 0;

        for (const contract of contracts) {
          const loan = contract.loanRequest?.loan;
          if (loan?.installments) {
            for (const inst of loan.installments) {
              if (new Date(inst.dueDate) <= monthEnd) {
                totalInstallments++;
                if (inst.status !== 'PAID') {
                  lateInstallments++;
                }
              }
            }
          }
        }

        const defaultRate = totalInstallments > 0 ? (lateInstallments / totalInstallments) * 100 : 0;

        // Verificar se qualifica para bônus
        let bonusAmount = 0;
        let bonusTier = '';

        if (contractsCount >= 10 && defaultRate < 5) {
          bonusAmount = 1000;
          bonusTier = 'GOLD';
        } else if (contractsCount >= 5 && defaultRate < 10) {
          bonusAmount = 500;
          bonusTier = 'SILVER';
        }

        if (bonusAmount > 0) {
          // Criar registro de bônus (upsert para evitar duplicatas)
          await prisma.partnerBonus.upsert({
            where: {
              partnerId_month: {
                partnerId: partner.id,
                month: monthStr
              }
            },
            create: {
              partnerId: partner.id,
              month: monthStr,
              contractsCount,
              defaultRate,
              bonusAmount,
              bonusTier,
              status: 'PENDING'
            },
            update: {
              contractsCount,
              defaultRate,
              bonusAmount,
              bonusTier
            }
          });

          console.log(`[Cron] Partner ${partner.name}: ${bonusTier} bonus (R$ ${bonusAmount}) - ${contractsCount} contracts, ${defaultRate.toFixed(1)}% default`);

          // Notificar parceiro
          if (partner.email) {
            const bonusHtml = brandedHtml(`
              <h2 style="color:#D4AF37;">🏆 Bônus de Performance!</h2>
              <p>Parabéns, <strong>${partner.name}</strong>!</p>
              <p>Você atingiu a meta ${bonusTier === 'GOLD' ? 'GOLD 🥇' : 'SILVER 🥈'} no mês de ${monthStr}!</p>
              <div style="background: #111; border: 1px solid #333; border-radius: 8px; padding: 15px; margin: 15px 0;">
                <p style="margin: 5px 0;"><strong style="color: #D4AF37;">Contratos:</strong> ${contractsCount}</p>
                <p style="margin: 5px 0;"><strong style="color: #D4AF37;">Inadimplência:</strong> ${defaultRate.toFixed(1)}%</p>
                <p style="margin: 5px 0;"><strong style="color: #4CAF50; font-size: 18px;">Bônus: R$ ${bonusAmount.toFixed(2)}</strong></p>
              </div>
              <p>O pagamento será realizado em breve. Continue assim! 🦈</p>
            `);
            emailService.send(partner.email, `🏆 Bônus ${bonusTier} — R$ ${bonusAmount} — Tubarão Parceiros`, bonusHtml).catch(() => { });
          }
        }
      }

      console.log('[Cron] Monthly partner bonus evaluation complete.');
    } catch (e) {
      console.error('[Cron] Partner bonus evaluation error:', e);
    }
  });

  job.start();
};

// ============ CRON: CANCELAMENTO DE COMISSÃO POR INADIMPLÊNCIA ============
const scheduleCommissionCancellation = () => {
  // Roda diariamente às 23h
  const job = new CronJob('0 23 * * *', async () => {
    try {
      console.log('[Cron] Checking for commission cancellations...');

      // Buscar comissões PENDING ou PARTIAL
      const pendingCommissions = await prisma.partnerCommission.findMany({
        where: {
          status: { in: ['PENDING', 'PARTIAL'] }
        },
        include: {
          loanRequest: {
            include: {
              loan: {
                include: {
                  installments: {
                    orderBy: { dueDate: 'asc' }
                  }
                }
              }
            }
          }
        }
      });

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      for (const commission of pendingCommissions) {
        const loan = commission.loanRequest?.loan;
        if (!loan) continue;

        // Verificar se há parcelas atrasadas 30+ dias sem pagamento
        const criticallyLateInstallments = loan.installments.filter(
          (inst: any) => inst.status !== 'PAID' && new Date(inst.dueDate) < thirtyDaysAgo
        );

        if (criticallyLateInstallments.length > 0) {
          await prisma.partnerCommission.update({
            where: { id: commission.id },
            data: {
              status: 'CANCELLED',
              cancelReason: `Inadimplência: ${criticallyLateInstallments.length} parcela(s) atrasada(s) 30+ dias`
            }
          });

          console.log(`[Cron] Commission ${commission.id} cancelled due to late payments`);
        }
      }
    } catch (e) {
      console.error('[Cron] Commission cancellation error:', e);
    }
  });

  job.start();
};

// ============ LEMBRETE DE CONTRAPROPOSTA (24h) ============
const scheduleCounterOfferReminder = () => {
  // Roda a cada 2 horas para verificar contrapropostas não aceitas
  const job = new CronJob('0 */2 * * *', async () => {
    try {
      console.log('[Cron] Verificando contrapropostas pendentes...');

      // Buscar contrapropostas com mais de 24h sem aceite
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);

      const pendingOffers = await prisma.loanRequest.findMany({
        where: {
          status: 'PENDING_ACCEPTANCE',
          counterOfferAccepted: false,
          approvedAt: {
            lte: twentyFourHoursAgo, // Mais de 24h
            gte: fortyEightHoursAgo  // Menos de 48h (não enviar para expiradas)
          }
        }
      });

      console.log(`[Cron] ${pendingOffers.length} contrapropostas aguardando aceite há mais de 24h`);

      for (const offer of pendingOffers) {
        const approvedFormatted = (offer.approvedAmount || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        const hoursLeft = Math.max(0, Math.round((48 * 60 * 60 * 1000 - (Date.now() - new Date(offer.approvedAt!).getTime())) / (1000 * 60 * 60)));

        // WhatsApp de lembrete
        if (offer.phone) {
          try {
            const config = await prisma.whatsappConfig.findFirst();
            if (config?.isConnected) {
              const { normalizePhoneBR } = await import('../services/whatsapp');
              const number = normalizePhoneBR(offer.phone);

              const waMsg = `⏰ *LEMBRETE: Crédito Aguardando Aceite!*\n\n` +
                `Olá, ${offer.clientName.split(' ')[0]}!\n\n` +
                `Seu crédito de *${approvedFormatted}* está aprovado e aguardando seu aceite.\n\n` +
                `⚠️ *Restam apenas ${hoursLeft} horas* para aceitar!\n\n` +
                `Acesse o app agora e clique em *"Aceitar Contrato"*:\n` +
                `🔗 https://www.tubaraoemprestimo.com.br\n\n` +
                `Não perca esta oportunidade!\n\n` +
                `_Tubarão Empréstimos 🦈_`;

              const axios = (await import('axios')).default;
              await axios.post(`${config.apiUrl}/message/sendText/${config.instanceName}`, {
                number, text: waMsg,
                options: { delay: 1200, presence: 'composing', linkPreview: false }
              }, { headers: { apikey: config.apiKey }, timeout: 15000 }).catch(() => {});
            }
          } catch (e) {
            console.error('[Cron] WhatsApp reminder error:', e);
          }
        }

        // Email de lembrete
        if (offer.email) {
          try {
            const emailHtml = brandedHtml(`
              <h2 style="color:#D4AF37;">⏰ Seu Crédito Está Esperando!</h2>
              <p>Olá, <strong>${offer.clientName}</strong>!</p>
              <p>Seu crédito de <strong style="color:#4CAF50;font-size:24px;">${approvedFormatted}</strong> foi aprovado e está aguardando seu aceite.</p>

              <div style="background:#1a1a1a;border:2px solid #FF6B6B;border-radius:12px;padding:20px;margin:20px 0;text-align:center;">
                <p style="color:#FF6B6B;font-size:18px;font-weight:bold;margin:0;">⚠️ Restam apenas ${hoursLeft} horas!</p>
                <p style="color:#aaa;font-size:13px;margin:10px 0 0 0;">Após este prazo, será necessário uma nova análise.</p>
              </div>

              <p style="text-align:center;margin:25px 0;">
                <a href="https://www.tubaraoemprestimo.com.br" style="display:inline-block;background:#D4AF37;color:#000;padding:15px 40px;text-decoration:none;border-radius:8px;font-weight:bold;font-size:16px;">
                  ✍️ ACEITAR CONTRATO AGORA
                </a>
              </p>
            `);
            emailService.send(offer.email, `⏰ Restam ${hoursLeft}h — Aceite seu crédito de ${approvedFormatted}!`, emailHtml).catch(() => {});
          } catch (e) {
            console.error('[Cron] Email reminder error:', e);
          }
        }

        // Push notification
        if (offer.userId) {
          sendPushToUser(
            offer.userId,
            `⏰ Restam ${hoursLeft}h!`,
            `Seu crédito de ${approvedFormatted} está aguardando aceite!`
          ).catch(() => {});
        }
      }

      // Expirar contrapropostas com mais de 48h
      const expiredOffers = await prisma.loanRequest.findMany({
        where: {
          status: 'PENDING_ACCEPTANCE',
          counterOfferAccepted: false,
          approvedAt: { lt: fortyEightHoursAgo }
        }
      });

      if (expiredOffers.length > 0) {
        console.log(`[Cron] Expirando ${expiredOffers.length} contrapropostas com mais de 48h`);

        for (const offer of expiredOffers) {
          await prisma.loanRequest.update({
            where: { id: offer.id },
            data: { status: 'EXPIRED' }
          });

          // Notificar expiração
          if (offer.phone) {
            try {
              const config = await prisma.whatsappConfig.findFirst();
              if (config?.isConnected) {
                const { normalizePhoneBR } = await import('../services/whatsapp');
                const number = normalizePhoneBR(offer.phone);
                const axios = (await import('axios')).default;
                await axios.post(`${config.apiUrl}/message/sendText/${config.instanceName}`, {
                  number,
                  text: `⏰ *Proposta Expirada*\n\nOlá, ${offer.clientName.split(' ')[0]}.\n\nSua proposta de crédito expirou pois não foi aceita em 48 horas.\n\nVocê pode fazer uma nova solicitação pelo app:\n🔗 https://www.tubaraoemprestimo.com.br\n\n_Tubarão Empréstimos 🦈_`,
                  options: { delay: 1200, presence: 'composing', linkPreview: false }
                }, { headers: { apikey: config.apiKey }, timeout: 15000 }).catch(() => {});
              }
            } catch (e) {}
          }
        }
      }
    } catch (err) {
      console.error('[Cron] Counteroffer reminder error:', err);
    }
  });
  job.start();
};

// ============ INIT ============
export const initCronJobs = () => {
  scheduleInstallmentReminders();
  scheduleLatePaymentDetection();
  // scheduleWhatsAppStatus(); // Temporariamente desabilitado até migration completa
  schedulePartnerBonusEvaluation();
  scheduleCommissionCancellation();
  scheduleCounterOfferReminder();
  console.log('[Cron] initialized (reminders + late detection + partner bonus + commission cancellation + counteroffer reminder)');
};

