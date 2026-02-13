import { CronJob } from 'cron';
import { prisma } from '../services/prisma';
import { emailService } from '../services/email';
import { sendWhatsAppMessage } from '../services/whatsapp';
import { sendPushToUser } from '../routes/push';

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

export const scheduleInstallmentReminders = () => {
  // Roda todo dia às 8h
  const job = new CronJob('0 8 * * *', async () => {
    try {
      const now = new Date();
      const in3 = new Date(now);
      in3.setDate(in3.getDate() + 3);

      const start3 = new Date(in3); start3.setHours(0, 0, 0, 0);
      const end3 = new Date(in3); end3.setHours(23, 59, 59, 999);
      const start0 = new Date(now); start0.setHours(0, 0, 0, 0);
      const end0 = new Date(now); end0.setHours(23, 59, 59, 999);

      // Parcelas que vencem em 3 dias
      const dueIn3 = await prisma.installments.findMany({
        where: { status: 'OPEN', due_date: { gte: start3, lte: end3 } },
        include: { loans: { include: { customers: true } } }
      });

      // Parcelas que vencem hoje
      const dueToday = await prisma.installments.findMany({
        where: { status: 'OPEN', due_date: { gte: start0, lte: end0 } },
        include: { loans: { include: { customers: true } } }
      });

      // PIX settings
      let pixKey = '';
      try {
        const pk = await prisma.systemSettings.findFirst({ where: { key: 'pix_key' } });
        if (pk?.value) pixKey = pk.value;
      } catch {}

      // Lembrete 3 dias antes
      for (const inst of dueIn3) {
        const c = inst.loans?.customers;
        if (!c) continue;

        const amtFmt = `R$ ${Number(inst.amount).toFixed(2)}`;
        const pixInfo = inst.pix_code ? `\n\n📱 *PIX Copia e Cola:*\n${inst.pix_code}` : (pixKey ? `\n\n📱 *Chave PIX:* ${pixKey}` : '');

        if (c.email) {
          const html = brandedHtml(`
            <h2 style="color:#FFD700;">⏰ Lembrete de Pagamento</h2>
            <p>Olá, <strong>${c.name}</strong>!</p>
            <p>Sua parcela de <strong style="color:#D4AF37;">${amtFmt}</strong> vence em <strong>${brDate(inst.due_date)}</strong> (3 dias).</p>
            ${pixKey ? `<div style="background:#111;border:1px solid #333;border-radius:8px;padding:15px;margin:15px 0;">
              <p style="margin:5px 0;color:#ccc;"><strong style="color:#D4AF37;">Chave PIX:</strong> ${pixKey}</p>
              ${inst.pix_code ? `<p style="margin:5px 0;color:#ccc;word-break:break-all;"><strong style="color:#D4AF37;">PIX Copia e Cola:</strong> ${inst.pix_code}</p>` : ''}
            </div>` : ''}
            <div style="text-align:center;margin:20px 0;">
              <a href="https://www.tubaraoemprestimo.com.br" style="background:#D4AF37;color:#000;padding:12px 30px;border-radius:8px;text-decoration:none;font-weight:bold;">Acessar App</a>
            </div>
          `);
          await emailService.send(c.email, `⏰ Parcela vence em 3 dias — ${amtFmt}`, html);
        }

        if (c.phone) {
          await sendWhatsAppMessage(c.phone,
            `⏰ *Lembrete de Pagamento*\n\nOlá, ${c.name.split(' ')[0]}!\n\nSua parcela de *${amtFmt}* vence em *${brDate(inst.due_date)}* (3 dias).${pixInfo}\n\nAcesse o app para mais detalhes.\n\n_Tubarão Empréstimos 🦈_`
          );
        }

        if (c.userId) {
          sendPushToUser(c.userId, '⏰ Parcela vence em 3 dias', `Sua parcela de ${amtFmt} vence em ${brDate(inst.due_date)}`).catch(() => {});
        }

        // Notificação interna
        await prisma.notification.create({
          data: {
            customerId: c.id,
            customerEmail: c.email,
            title: '⏰ Parcela vence em 3 dias',
            message: `Sua parcela de ${amtFmt} vence em ${brDate(inst.due_date)}.`,
            type: 'WARNING'
          }
        }).catch(() => {});
      }

      // Lembrete no dia
      for (const inst of dueToday) {
        const c = inst.loans?.customers;
        if (!c) continue;

        const amtFmt = `R$ ${Number(inst.amount).toFixed(2)}`;
        const pixInfo = inst.pix_code ? `\n\n📱 *PIX Copia e Cola:*\n${inst.pix_code}` : (pixKey ? `\n\n📱 *Chave PIX:* ${pixKey}` : '');

        if (c.email) {
          const html = brandedHtml(`
            <h2 style="color:#FF6B6B;">⚠️ Parcela Vence HOJE!</h2>
            <p>Olá, <strong>${c.name}</strong>!</p>
            <p>Sua parcela de <strong style="color:#FF6B6B;">${amtFmt}</strong> vence <strong>HOJE</strong>.</p>
            ${pixKey ? `<div style="background:#111;border:1px solid #333;border-radius:8px;padding:15px;margin:15px 0;">
              <p style="margin:5px 0;color:#ccc;"><strong style="color:#D4AF37;">Chave PIX:</strong> ${pixKey}</p>
              ${inst.pix_code ? `<p style="margin:5px 0;color:#ccc;word-break:break-all;"><strong style="color:#D4AF37;">PIX Copia e Cola:</strong> ${inst.pix_code}</p>` : ''}
            </div>` : ''}
            <p style="color:#aaa;">Evite juros e multas pagando em dia.</p>
            <div style="text-align:center;margin:20px 0;">
              <a href="https://www.tubaraoemprestimo.com.br" style="background:#D4AF37;color:#000;padding:12px 30px;border-radius:8px;text-decoration:none;font-weight:bold;">Pagar Agora</a>
            </div>
          `);
          await emailService.send(c.email, `⚠️ Parcela vence HOJE — ${amtFmt}`, html);
        }

        if (c.phone) {
          await sendWhatsAppMessage(c.phone,
            `⚠️ *PARCELA VENCE HOJE!*\n\nOlá, ${c.name.split(' ')[0]}!\n\nSua parcela de *${amtFmt}* vence *HOJE*.${pixInfo}\n\nEvite juros e multas pagando em dia.\n\nAcesse o app para mais detalhes.\n\n_Tubarão Empréstimos 🦈_`
          );
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

// Cron para postar WhatsApp Status agendado
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

export const initCronJobs = () => {
  scheduleInstallmentReminders();
  scheduleWhatsAppStatus();
  console.log('[Cron] initialized (reminders + whatsapp status)');
};
