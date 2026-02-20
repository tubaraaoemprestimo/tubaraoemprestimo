import { Router, Request, Response } from 'express';
import { prisma } from '../services/prisma';
import { authenticate, requireAdmin } from '../middleware/auth';
import { sendWhatsAppMessage } from '../services/whatsapp';
import { emailService } from '../services/email';
import { sendPushToUser, sendPushToRole } from './push';

export const collectionsRouter = Router();
collectionsRouter.use(authenticate);
collectionsRouter.use(requireAdmin);

// POST /api/collections/dispatch - Disparar cobranças para clientes
collectionsRouter.post('/dispatch', async (req: Request, res: Response) => {
    try {
        console.log('[Collections] Iniciando disparo de cobranças');

        // Verificação de segurança - garantir que somente admins podem acionar
        if (!req.user || req.user.role !== 'ADMIN') {
            return res.status(403).json({ error: 'Acesso negado. Somente administradores podem disparar cobranças.' });
        }

        const now = new Date();
        const startToday = new Date(now);
        startToday.setHours(0, 0, 0, 0);
        const endToday = new Date(now);
        endToday.setHours(23, 59, 59, 999);

        // Buscar parcelas vencendo nos próximos 3 dias e atrasadas
        const dueIn3 = await prisma.installment.findMany({
            where: {
                status: 'OPEN',
                dueDate: {
                    gte: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000), // 2 dias à frente
                    lte: new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000)  // 4 dias à frente (intervalo de 3 dias)
                }
            },
            include: { loan: { include: { customer: true } } }
        });

        const dueToday = await prisma.installment.findMany({
            where: {
                status: 'OPEN',
                dueDate: { gte: startToday, lte: endToday }
            },
            include: { loan: { include: { customer: true } } }
        });

        const overdueInstallments = await prisma.installment.findMany({
            where: {
                status: 'OPEN',
                dueDate: { lt: startToday }
            },
            include: { loan: { include: { customer: true } } }
        });

        console.log(`[Collections] Encontradas: ${dueIn3.length} vencendo em 3 dias, ${dueToday.length} vencendo hoje, ${overdueInstallments.length} atrasadas`);

        // Obter chave PIX
        const pixSetting = await prisma.systemSetting.findFirst({ where: { key: 'pix_key' } });
        const pixKey = pixSetting?.value || '';

        let sentWhatsApp = 0;
        let sentEmail = 0;
        let sentPush = 0;
        let totalProcessed = 0;

        // Função para enviar notificação individual
        const sendNotifications = async (installment: any, type: 'due_soon' | 'due_today' | 'overdue') => {
            const customer = installment.loan?.customer;
            if (!customer) return;

            const formattedAmount = Number(installment.amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            const dueDate = new Date(installment.dueDate).toLocaleDateString('pt-BR');

            // Montar conteúdo da mensagem
            let title = '';
            let message = '';
            let subject = '';
            let waMessage = '';
            let htmlContent = '';

            if (type === 'due_soon') {
                title = '⏰ Lembrete de Pagamento';
                message = `Sua parcela de ${formattedAmount} vence em ${dueDate} (3 dias).`;
                subject = `⏰ Parcela vence em 3 dias — ${formattedAmount}`;
                waMessage = `⏰ *Lembrete de Pagamento*\n\nOlá, ${customer.name.split(' ')[0]}!\n\nSua parcela de *${formattedAmount}* vence em *${dueDate}* (3 dias).${pixKey ? `\n\n📱 *Chave PIX:* ${pixKey}` : ''}\n\nAcesse o app para mais detalhes.\n\n_Tubarão Empréstimos 🦈_`;

                htmlContent = `
                    <h2 style="color:#FFD700;">⏰ Lembrete de Pagamento</h2>
                    <p>Olá, <strong>${customer.name}</strong>!</p>
                    <p>Sua parcela de <strong style="color:#D4AF37;">${formattedAmount}</strong> vence em <strong>${dueDate}</strong> (3 dias).</p>
                    ${pixKey ? `<div style="background:#111;border:1px solid #333;border-radius:8px;padding:15px;margin:15px 0;">
                      <p style="margin:5px 0;color:#ccc;"><strong style="color:#D4AF37;">Chave PIX:</strong> ${pixKey}</p>
                    </div>` : ''}
                    <div style="text-align:center;margin:20px 0;">
                      <a href="https://www.tubaraoemprestimo.com.br" style="background:#D4AF37;color:#000;padding:12px 30px;border-radius:8px;text-decoration:none;font-weight:bold;">Acessar App</a>
                    </div>
                `;
            } else if (type === 'due_today') {
                title = '⚠️ Parcela Vence HOJE!';
                message = `Sua parcela de ${formattedAmount} vence HOJE.`;
                subject = `⚠️ Parcela vence HOJE — ${formattedAmount}`;
                waMessage = `⚠️ *PARCELA VENCE HOJE!*\n\nOlá, ${customer.name.split(' ')[0]}!\n\nSua parcela de *${formattedAmount}* vence *HOJE*.${pixKey ? `\n\n📱 *Chave PIX:* ${pixKey}` : ''}\n\nEvite juros e multas pagando em dia.\n\nAcesse o app para mais detalhes.\n\n_Tubarão Empréstimos 🦈_`;

                htmlContent = `
                    <h2 style="color:#FF6B6B;">⚠️ Parcela Vence HOJE!</h2>
                    <p>Olá, <strong>${customer.name}</strong>!</p>
                    <p>Sua parcela de <strong style="color:#FF6B6B;">${formattedAmount}</strong> vence <strong>HOJE</strong>.</p>
                    ${pixKey ? `<div style="background:#111;border:1px solid #333;border-radius:8px;padding:15px;margin:15px 0;">
                      <p style="margin:5px 0;color:#ccc;"><strong style="color:#D4AF37;">Chave PIX:</strong> ${pixKey}</p>
                    </div>` : ''}
                    <p style="color:#aaa;">Evite juros e multas pagando em dia.</p>
                    <div style="text-align:center;margin:20px 0;">
                      <a href="https://www.tubaraoemprestimo.com.br" style="background:#D4AF37;color:#000;padding:12px 30px;border-radius:8px;text-decoration:none;font-weight:bold;">Pagar Agora</a>
                    </div>
                `;
            } else { // overdue
                const daysOverdue = Math.floor((Date.now() - new Date(installment.dueDate).getTime()) / (1000 * 60 * 60 * 24));
                title = `🚨 Parcela ATRASADA — ${daysOverdue} dias`;
                message = `Sua parcela de ${formattedAmount} venceu em ${dueDate} e está com ${daysOverdue} dia(s) de atraso.`;
                subject = `🚨 Parcela ATRASADA (${daysOverdue} dias) — ${formattedAmount}`;
                waMessage = `🚨 *PARCELA ATRASADA*\n\nOlá, ${customer.name.split(' ')[0]}!\n\nSua parcela de *${formattedAmount}* venceu em *${dueDate}* (${daysOverdue} dia${daysOverdue > 1 ? 's' : ''} de atraso).${pixKey ? `\n\n📱 *Chave PIX:* ${pixKey}` : ''}\n\n⚠️ Juros e multas estão sendo aplicados.\n\nRegularize pelo app ou entre em contato.\n\n_Tubarão Empréstimos 🦈_`;

                htmlContent = `
                    <h2 style="color:#FF0000;">🚨 Parcela ATRASADA — ${daysOverdue} dias</h2>
                    <p>Olá, <strong>${customer.name}</strong>!</p>
                    <p>Sua parcela de <strong style="color:#FF0000;">${formattedAmount}</strong> venceu em <strong>${dueDate}</strong> e está com <strong>${daysOverdue} dia${daysOverdue > 1 ? 's' : ''} de atraso</strong>.</p>
                    <p style="color:#FF0000;"><strong>⚠️ Juros e multas estão sendo aplicados diariamente.</strong></p>
                    ${pixKey ? `<div style="background:#111;border:1px solid #333;border-radius:8px;padding:15px;margin:15px 0;">
                      <p style="margin:5px 0;color:#ccc;"><strong style="color:#D4AF37;">Chave PIX:</strong> ${pixKey}</p>
                    </div>` : ''}
                    <p style="color:#aaa;">Entre em contato conosco se precisar renegociar.</p>
                    <div style="text-align:center;margin:20px 0;">
                      <a href="https://www.tubaraoemprestimo.com.br" style="background:#FF0000;color:#fff;padding:12px 30px;border-radius:8px;text-decoration:none;font-weight:bold;">Regularizar Agora</a>
                    </div>
                `;
            }

            // Enviar email
            if (customer.email) {
                try {
                    await emailService.send(customer.email, subject, htmlContent);
                    sentEmail++;
                } catch (err) {
                    console.error('[Collections] Erro ao enviar email:', err);
                }
            }

            // Enviar WhatsApp
            if (customer.phone) {
                try {
                    await sendWhatsAppMessage(customer.phone, waMessage);
                    sentWhatsApp++;
                } catch (err) {
                    console.error('[Collections] Erro ao enviar WhatsApp:', err);
                }
            }

            // Enviar push
            if (customer.userId) {
                try {
                    await sendPushToUser(customer.userId, title, message);
                    sentPush++;
                } catch (err) {
                    console.error('[Collections] Erro ao enviar push:', err);
                }
            }

            // Enviar notificação no sistema
            try {
                await prisma.notification.create({
                    data: {
                        customerId: customer.id,
                        customerEmail: customer.email,
                        title: title,
                        message: message,
                        type: type === 'due_soon' ? 'WARNING' : type === 'due_today' ? 'WARNING' : 'ALERT'
                    }
                });
            } catch (err) {
                console.error('[Collections] Erro ao criar notificação:', err);
            }

            totalProcessed++;
        };

        // Processar parcelas vencendo em 3 dias
        for (const installment of dueIn3) {
            await sendNotifications(installment, 'due_soon');
        }

        // Processar parcelas vencendo hoje
        for (const installment of dueToday) {
            await sendNotifications(installment, 'due_today');
        }

        // Processar parcelas atrasadas
        for (const installment of overdueInstallments) {
            const daysOverdue = Math.floor((Date.now() - new Date(installment.dueDate).getTime()) / (1000 * 60 * 60 * 24));
            // Enviar notificações para atrasos de 1, 3, 7, 15, 30 dias
            if ([1, 3, 7, 15, 30].includes(daysOverdue)) {
                await sendNotifications(installment, 'overdue');
            }
        }

        console.log(`[Collections] Disparo concluído: ${sentWhatsApp} WhatsApp, ${sentEmail} emails, ${sentPush} push, ${totalProcessed} notificações`);

        res.json({
            success: true,
            results: {
                collections: {
                    sent: totalProcessed,
                    whatsappSent: sentWhatsApp,
                    emailSent: sentEmail,
                    pushSent: sentPush,
                    details: {
                        dueSoon: dueIn3.length,
                        dueToday: dueToday.length,
                        overdue: overdueInstallments.length
                    }
                }
            }
        });

    } catch (error: any) {
        console.error('[Collections] Erro no disparo de cobranças:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Erro ao processar cobranças'
        });
    }
});