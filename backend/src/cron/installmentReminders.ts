import { CronJob } from 'cron';
import { prisma } from '../services/prisma';
import { emailService } from '../services/email';
import { sendWhatsAppMessage } from '../services/whatsapp';
import { sendPushToUser, sendPushToRole } from '../routes/push';

function brDate(d: Date | string) {
  return new Date(d).toLocaleDateString('pt-BR');
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
          sendPushToUser(c.userId, '⏰ Parcela vence em 3 dias', `Sua parcela de ${amtFmt} vence em ${brDate(inst.dueDate)}`).catch(() => {});
        }

        await prisma.notification.create({
          data: {
            customerId: c.id,
            customerEmail: c.email,
            title: '⏰ Parcela vence em 3 dias',
            message: `Sua parcela de ${amtFmt} vence em ${brDate(inst.dueDate)}.`,
            type: 'WARNING'
          }
        }).catch(() => {});
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
          sendPushToUser(c.userId, '⚠️ Parcela vence HOJE', `Sua parcela de ${amtFmt} vence hoje!`).catch(() => {});
        }

        await prisma.notification.create({
          data: {
            customerId: c.id,
            customerEmail: c.email,
            title: '⚠️ Parcela vence HOJE',
            message: `Sua parcela de ${amtFmt} vence hoje. Evite juros!`,
            type: 'WARNING'
          }
        }).catch(() => {});
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
        include: { loan: { include: { customer: true } } }
      });

      if (overdueInstallments.length === 0) {
        console.log('[Cron] No overdue installments found');
        return;
      }

      const pixKey = await getPixKey();

      for (const inst of overdueInstallments) {
        const c = inst.loan?.customer;
        if (!c) continue;

        const daysOverdue = Math.floor((Date.now() - new Date(inst.dueDate).getTime()) / (1000 * 60 * 60 * 24));
        const amtFmt = `R$ ${Number(inst.amount).toFixed(2)}`;
        const pixInfo = inst.pixCode ? `\n\n📱 *PIX Copia e Cola:*\n${inst.pixCode}` : (pixKey ? `\n\n📱 *Chave PIX:* ${pixKey}` : '');

        // Enviar apenas para atrasos de 1, 3, 7, 15, 30 dias (não bombardear diariamente)
        if (![1, 3, 7, 15, 30].includes(daysOverdue)) continue;

        // Email ao cliente
        if (c.email) {
          const urgency = daysOverdue >= 15 ? '#FF0000' : daysOverdue >= 7 ? '#FF4444' : '#FF6B6B';
          const html = brandedHtml(`
            <h2 style="color:${urgency};">🚨 Parcela ATRASADA — ${daysOverdue} dia${daysOverdue > 1 ? 's' : ''}</h2>
            <p>Olá, <strong>${c.name}</strong>!</p>
            <p>Sua parcela de <strong style="color:${urgency};">${amtFmt}</strong> venceu em <strong>${brDate(inst.dueDate)}</strong> e está com <strong>${daysOverdue} dia${daysOverdue > 1 ? 's' : ''} de atraso</strong>.</p>
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
          emailService.send(c.email, `🚨 Parcela ATRASADA (${daysOverdue} dias) — ${amtFmt}`, html).catch(err => console.error('[Cron] Late email failed:', err.message));
        }

        // WhatsApp ao cliente
        if (c.phone) {
          sendWhatsAppMessage(c.phone,
            `🚨 *PARCELA ATRASADA*\n\nOlá, ${c.name.split(' ')[0]}!\n\nSua parcela de *${amtFmt}* venceu em *${brDate(inst.dueDate)}* (${daysOverdue} dia${daysOverdue > 1 ? 's' : ''} de atraso).${pixInfo}\n\n⚠️ Juros e multas estão sendo aplicados.\n\nRegularize pelo app ou entre em contato.\n\n_Tubarão Empréstimos 🦈_`
          ).catch(err => console.error('[Cron] Late WA failed:', err));
        }

        // Push ao cliente
        if (c.userId) {
          sendPushToUser(c.userId, `🚨 Parcela ATRASADA (${daysOverdue}d)`, `Sua parcela de ${amtFmt} está ${daysOverdue} dia(s) atrasada.`).catch(() => {});
        }

        // Notificação interna
        await prisma.notification.create({
          data: {
            customerId: c.id,
            customerEmail: c.email,
            title: `🚨 Parcela ATRASADA — ${daysOverdue} dias`,
            message: `Parcela de ${amtFmt} vencida em ${brDate(inst.dueDate)}.`,
            type: 'ALERT'
          }
        }).catch(() => {});
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
      }).catch(() => {});

      // Push para admins
      sendPushToRole('ADMIN', `🚨 ${totalOverdue} parcela(s) em atraso`, `Total: R$ ${totalAmount.toFixed(2)}`).catch(() => {});

      // WhatsApp para admins
      try {
        const admins = await prisma.user.findMany({ where: { role: 'ADMIN' } });
        for (const admin of admins) {
          if (admin.phone) {
            sendWhatsAppMessage(admin.phone,
              `🚨 *Resumo de Atrasos*\n\n${totalOverdue} parcela(s) em atraso\nTotal: R$ ${totalAmount.toFixed(2)}\n\nAcesse o painel para detalhes.`
            ).catch(() => {});
          }
        }
      } catch {}

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

// ============ INIT ============
export const initCronJobs = () => {
  scheduleInstallmentReminders();
  scheduleLatePaymentDetection();
  scheduleWhatsAppStatus();
  console.log('[Cron] initialized (reminders + late detection + whatsapp status)');
};
