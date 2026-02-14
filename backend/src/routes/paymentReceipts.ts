import { Router, Request, Response } from 'express';
import { prisma } from '../services/prisma';
import { authenticate, requireAdmin } from '../middleware/auth';
import { emailService } from '../services/email';
import { sendWhatsAppMessage } from '../services/whatsapp';
import { sendPushToUser, sendPushToRole } from './push';

export const paymentReceiptsRouter = Router();
paymentReceiptsRouter.use(authenticate);

// POST /api/payment-receipts — Cliente envia comprovante
paymentReceiptsRouter.post('/', async (req: Request, res: Response) => {
    try {
        const { installmentId, receiptUrl, amount } = req.body;

        if (!installmentId || !receiptUrl) {
            res.status(400).json({ error: 'installmentId e receiptUrl são obrigatórios' });
            return;
        }

        const installment = await prisma.installment.findUnique({
            where: { id: installmentId },
            include: { loans: { include: { customers: true } } }
        });

        if (!installment) {
            res.status(404).json({ error: 'Parcela não encontrada' });
            return;
        }

        const customer = installment.loans?.customers;
        if (!customer) {
            res.status(404).json({ error: 'Cliente não encontrado' });
            return;
        }

        const receipt = await prisma.paymentReceipt.create({
            data: {
                installmentId,
                customerId: customer.id,
                receiptUrl,
                amount: amount || installment.amount,
                status: 'PENDING'
            }
        });

        // Notificar admins
        await prisma.notification.create({
            data: {
                title: '💳 Comprovante Recebido',
                message: `${customer.name} enviou comprovante da parcela R$ ${Number(installment.amount).toFixed(2)}`,
                type: 'INFO'
            }
        }).catch(() => {});

        // Push para admins
        sendPushToRole('ADMIN', '💳 Comprovante Recebido', `${customer.name} enviou comprovante de pagamento`).catch(() => {});

        // WhatsApp para admins
        try {
            const admins = await prisma.user.findMany({ where: { role: 'ADMIN', phone: { not: null } } });
            for (const admin of admins) {
                if (admin.phone) {
                    await sendWhatsAppMessage(admin.phone,
                        `💳 *Comprovante Recebido*\n\nCliente: ${customer.name}\nValor: R$ ${Number(installment.amount).toFixed(2)}\n\nAcesse o painel para confirmar o pagamento.`
                    );
                }
            }
        } catch (e) { }

        res.json({ success: true, id: receipt.id });
    } catch (error: any) {
        console.error('[PaymentReceipts] Create error:', error);
        res.status(500).json({ error: 'Erro ao enviar comprovante' });
    }
});

// GET /api/payment-receipts — Listar comprovantes (admin: todos, client: próprios)
paymentReceiptsRouter.get('/', async (req: Request, res: Response) => {
    try {
        const isAdmin = req.user!.role === 'ADMIN';
        let where: any = {};

        if (!isAdmin) {
            const customer = await prisma.customer.findFirst({ where: { userId: req.user!.id } });
            if (!customer) { res.json([]); return; }
            where = { customerId: customer.id };
        }

        if (req.query.status) {
            where.status = req.query.status;
        }

        const receipts = await prisma.paymentReceipt.findMany({
            where,
            orderBy: { createdAt: 'desc' }
        });

        res.json(receipts);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar comprovantes' });
    }
});

// PUT /api/payment-receipts/:id/approve — Admin confirma pagamento
paymentReceiptsRouter.put('/:id/approve', requireAdmin, async (req: Request, res: Response) => {
    try {
        const receipt = await prisma.paymentReceipt.update({
            where: { id: req.params.id as string },
            data: {
                status: 'APPROVED',
                reviewedBy: req.user!.id,
                reviewedAt: new Date(),
                notes: req.body.notes || null
            }
        });

        // Marca parcela como paga
        await prisma.installment.update({
            where: { id: receipt.installmentId },
            data: {
                status: 'PAID',
                paidAt: new Date(),
                proofUrl: receipt.receiptUrl
            }
        });

        // Busca dados do cliente
        const customer = await prisma.customer.findUnique({ where: { id: receipt.customerId } });

        if (customer) {
            // Notificação interna
            await prisma.notification.create({
                data: {
                    customerId: customer.id,
                    customerEmail: customer.email,
                    title: '✅ Pagamento Confirmado',
                    message: `Seu pagamento de R$ ${Number(receipt.amount).toFixed(2)} foi confirmado!`,
                    type: 'SUCCESS'
                }
            }).catch(() => {});

            // Email
            if (customer.email) {
                emailService.send(customer.email, '✅ Pagamento Confirmado — Tubarão Empréstimos',
                    `<div style="font-family:Arial;max-width:600px;margin:0 auto;background:#000;color:#fff;padding:30px;border-radius:12px;">
                    <h1 style="color:#D4AF37;text-align:center;">🦈 Tubarão Empréstimos</h1>
                    <h2 style="color:#4CAF50;">Pagamento Confirmado!</h2>
                    <p style="color:#ccc;">Olá, <strong>${customer.name}</strong>!</p>
                    <p style="color:#ccc;">Seu pagamento de <strong style="color:#4CAF50;">R$ ${Number(receipt.amount).toFixed(2)}</strong> foi confirmado com sucesso.</p>
                    <div style="text-align:center;margin:20px 0;">
                        <a href="https://www.tubaraoemprestimo.com.br" style="background:#D4AF37;color:#000;padding:12px 30px;border-radius:8px;text-decoration:none;font-weight:bold;">Acessar App</a>
                    </div>
                    </div>`
                ).catch(() => {});
            }

            // WhatsApp
            if (customer.phone) {
                sendWhatsAppMessage(customer.phone,
                    `✅ *Pagamento Confirmado!*\n\nOlá, ${customer.name.split(' ')[0]}!\n\nSeu pagamento de R$ ${Number(receipt.amount).toFixed(2)} foi confirmado.\n\nAcesse o app para acompanhar suas parcelas.\n\n_Tubarão Empréstimos 🦈_`
                ).catch(() => {});
            }

            // Push
            if (customer.userId) {
                sendPushToUser(customer.userId, '✅ Pagamento Confirmado', `Seu pagamento de R$ ${Number(receipt.amount).toFixed(2)} foi confirmado!`).catch(() => {});
            }
        }

        res.json({ success: true });
    } catch (error: any) {
        console.error('[PaymentReceipts] Approve error:', error);
        res.status(500).json({ error: 'Erro ao aprovar comprovante' });
    }
});

// PUT /api/payment-receipts/:id/reject — Admin rejeita comprovante
paymentReceiptsRouter.put('/:id/reject', requireAdmin, async (req: Request, res: Response) => {
    try {
        const receipt = await prisma.paymentReceipt.update({
            where: { id: req.params.id as string },
            data: {
                status: 'REJECTED',
                reviewedBy: req.user!.id,
                reviewedAt: new Date(),
                notes: req.body.notes || 'Comprovante não aceito'
            }
        });

        const customer = await prisma.customer.findUnique({ where: { id: receipt.customerId } });
        if (customer) {
            await prisma.notification.create({
                data: {
                    customerId: customer.id,
                    customerEmail: customer.email,
                    title: '⚠️ Comprovante Não Aceito',
                    message: `Seu comprovante de pagamento não foi aceito. ${req.body.notes || 'Envie um novo comprovante.'}`,
                    type: 'WARNING'
                }
            }).catch(() => {});

            // Email de rejeição de comprovante
            if (customer.email) {
                const reasonText = req.body.notes || 'Envie um novo comprovante.';
                const html = `
                <div style="font-family:Arial;max-width:600px;margin:0 auto;background:#000;color:#fff;padding:30px;border-radius:12px;">
                    <div style="text-align:center;margin-bottom:20px;"><h1 style="color:#D4AF37;font-size:24px;">🦈 Tubarão Empréstimos</h1></div>
                    <h2 style="color:#FF6B6B;">⚠️ Comprovante Não Aceito</h2>
                    <p>Olá, <strong>${customer.name}</strong>!</p>
                    <p>Seu comprovante de pagamento não foi aceito.</p>
                    <p><strong>Motivo:</strong> ${reasonText}</p>
                    <p style="color:#aaa;">Acesse o app e envie um novo comprovante.</p>
                    <div style="text-align:center;margin:20px 0;">
                        <a href="https://www.tubaraoemprestimo.com.br" style="background:#D4AF37;color:#000;padding:12px 30px;border-radius:8px;text-decoration:none;font-weight:bold;">Enviar Novo Comprovante</a>
                    </div>
                    <hr style="border-color:#333;margin:25px 0;" />
                    <p style="color:#666;font-size:12px;text-align:center;">Tubarão Empréstimos — Plataforma de Crédito Premium</p>
                </div>`;
                emailService.send(customer.email, '⚠️ Comprovante Não Aceito — Tubarão Empréstimos', html).catch(err => console.error('[PaymentReceipts] Email rejection failed:', err.message));
            }

            if (customer.phone) {
                sendWhatsAppMessage(customer.phone,
                    `⚠️ *Comprovante Não Aceito*\n\nOlá, ${customer.name.split(' ')[0]}.\n\nSeu comprovante de pagamento não foi aceito.\nMotivo: ${req.body.notes || 'Envie um novo comprovante.'}\n\nAcesse o app para enviar novamente.\n\n_Tubarão Empréstimos 🦈_`
                ).catch(() => {});
            }

            if (customer.userId) {
                sendPushToUser(customer.userId, '⚠️ Comprovante Não Aceito', 'Seu comprovante de pagamento não foi aceito. Envie um novo.').catch(() => {});
            }
        }

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao rejeitar comprovante' });
    }
});
