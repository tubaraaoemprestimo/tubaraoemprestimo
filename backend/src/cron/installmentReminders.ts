import { CronJob } from 'cron';
import { prisma } from '../services/prisma';
import { emailService } from '../services/email';
import { sendWhatsAppMessage } from '../services/whatsapp';

function brDate(d: Date | string) {
  return new Date(d).toLocaleDateString('pt-BR');
}

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

      const dueIn3 = await prisma.installments.findMany({
        where: { status: 'OPEN', due_date: { gte: start3, lte: end3 } },
        include: { loans: { include: { customers: true } } }
      });

      const dueToday = await prisma.installments.findMany({
        where: { status: 'OPEN', due_date: { gte: start0, lte: end0 } },
        include: { loans: { include: { customers: true } } }
      });

      for (const inst of dueIn3) {
        const c = inst.loans?.customers;
        if (!c) continue;

        if (c.email) {
          await emailService.send(
            c.email,
            'Lembrete: parcela vence em 3 dias',
            `<p>Olá ${c.name}, sua parcela de <b>R$ ${Number(inst.amount).toFixed(2)}</b> vence em <b>${brDate(inst.due_date)}</b>.</p>`
          );
        }

        if (c.phone) {
          await sendWhatsAppMessage(
            c.phone,
            `Olá ${c.name.split(' ')[0]}! Sua parcela de R$ ${Number(inst.amount).toFixed(2)} vence em ${brDate(inst.due_date)}.`
          );
        }
      }

      for (const inst of dueToday) {
        const c = inst.loans?.customers;
        if (!c) continue;

        if (c.email) {
          await emailService.send(
            c.email,
            'Hoje é o vencimento da sua parcela',
            `<p>Olá ${c.name}, sua parcela de <b>R$ ${Number(inst.amount).toFixed(2)}</b> vence <b>hoje</b>.</p>`
          );
        }

        if (c.phone) {
          await sendWhatsAppMessage(
            c.phone,
            `⚠️ ${c.name.split(' ')[0]}, sua parcela de R$ ${Number(inst.amount).toFixed(2)} vence hoje.`
          );
        }
      }

      console.log(`[Cron] reminders ok: +3d=${dueIn3.length}, today=${dueToday.length}`);
    } catch (e) {
      console.error('[Cron] installment reminders error:', e);
    }
  });

  job.start();
};

export const initCronJobs = () => {
  scheduleInstallmentReminders();
  console.log('[Cron] initialized');
};
