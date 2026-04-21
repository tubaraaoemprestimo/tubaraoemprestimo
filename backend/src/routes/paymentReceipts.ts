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
            include: { loan: { include: { customer: true } } }
        });

        if (!installment) {
            res.status(404).json({ error: 'Parcela não encontrada' });
            return;
        }

        const customer = installment.loan?.customer;
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

        // Filtrar por status (ignorar 'ALL')
        const statusFilter = req.query.status as string;
        if (statusFilter && statusFilter !== 'ALL') {
            where.status = statusFilter;
        }

        const receipts = await prisma.paymentReceipt.findMany({
            where,
            orderBy: { createdAt: 'desc' }
        });

        if (receipts.length === 0) { res.json([]); return; }

        // Enriquecer com customerName e loanId (campos não existem no modelo direto)
        const customerIds = [...new Set(receipts.map((r: any) => r.customerId))];
        const installmentIds = [...new Set(receipts.map((r: any) => r.installmentId))];

        const [customers, installments] = await Promise.all([
            prisma.customer.findMany({ where: { id: { in: customerIds as string[] } }, select: { id: true, name: true } }),
            prisma.installment.findMany({ where: { id: { in: installmentIds as string[] } }, select: { id: true, loanId: true, dueDate: true, amount: true } })
        ]);

        const customerMap = new Map(customers.map((c: any) => [c.id, c.name]));
        const installmentMap = new Map(installments.map((i: any) => [i.id, { loanId: i.loanId, dueDate: i.dueDate, amount: i.amount }]));

        const enriched = receipts.map((r: any) => ({
            ...r,
            customerName: customerMap.get(r.customerId) || '',
            loanId: installmentMap.get(r.installmentId)?.loanId || '',
            installmentDueDate: installmentMap.get(r.installmentId)?.dueDate || null,
            installmentAmount: installmentMap.get(r.installmentId)?.amount || null
        }));

        res.json(enriched);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar comprovantes' });
    }
});

// PUT /api/payment-receipts/:id/approve — Admin confirma pagamento
paymentReceiptsRouter.put('/:id/approve', requireAdmin, async (req: Request, res: Response) => {
    try {
        const { isDischarge } = req.body; // Novo: flag de quitação total

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
        const installment = await prisma.installment.update({
            where: { id: receipt.installmentId },
            data: {
                status: 'PAID',
                paidAt: new Date(),
                proofUrl: receipt.receiptUrl
            }
        });

        // Atualizar remainingAmount do loan
        const loan = await prisma.loan.findUnique({
            where: { id: installment.loanId },
            include: { installments: true, customer: true }
        });

        if (loan) {
            let totalPaid = 0; // Declarar no escopo superior

            // Se for quitação total
            if (isDischarge) {
                // Marcar TODAS as parcelas como pagas
                await prisma.installment.updateMany({
                    where: {
                        loanId: loan.id,
                        status: { not: 'PAID' }
                    },
                    data: {
                        status: 'PAID',
                        paidAt: new Date()
                    }
                });

                // Calcular total pago
                totalPaid = loan.installments
                    .filter((i: any) => i.status === 'PAID' || i.id === installment.id)
                    .reduce((sum: number, i: any) => sum + Number(i.amount), 0);

                // Marcar loan como quitado
                await prisma.loan.update({
                    where: { id: loan.id },
                    data: {
                        remainingAmount: 0,
                        status: 'COMPLETED'
                    }
                });

                console.log(`[PaymentReceipts] ✅ Loan ${loan.id} QUITADO (discharge)`);
            } else {
                // Fluxo normal: baixa pelo valor REAL pago (receipt.amount), não pelo valor da parcela
                const paidAmount = Number(receipt.amount);
                const newRemaining = Math.max(0, Number(loan.remainingAmount) - paidAmount);

                await prisma.loan.update({
                    where: { id: loan.id },
                    data: {
                        remainingAmount: newRemaining,
                        lastPaymentDate: new Date(),
                        status: newRemaining <= 0 ? 'COMPLETED' : loan.status
                    }
                });

                console.log(`[PaymentReceipts] Loan ${loan.id} updated: -R$ ${paidAmount.toFixed(2)} => remainingAmount = R$ ${newRemaining.toFixed(2)}`);
            }

            // Criar transação de entrada
            await prisma.transaction.create({
                data: {
                    type: 'IN',
                    description: `Pagamento confirmado - ${loan.id.substring(0, 8)}`,
                    amount: Number(receipt.amount),
                    category: 'PAYMENT',
                    date: new Date()
                }
            }).catch(() => {});
        }

        // Busca dados do cliente
        const customer = await prisma.customer.findUnique({ where: { id: receipt.customerId } });

        if (customer && loan) {
            // ====== GERAR RECIBO OU QUITAÇÃO ======
            try {
                const { generateReceiptHTML, generateDischargeHTML, saveDocument, getCompanySettings } = await import('../services/documentService');
                const settings = await getCompanySettings();

                if (isDischarge) {
                    // Calcular total pago para quitação
                    const totalPaidForDischarge = loan.installments
                        .reduce((sum: number, i: any) => sum + Number(i.amount), 0);

                    // Gerar declaração de quitação
                    const dischargeHTML = generateDischargeHTML({
                        loan,
                        customer,
                        settings,
                        totalPaid: totalPaidForDischarge
                    });

                    await saveDocument({
                        type: 'DISCHARGE',
                        customerId: customer.id,
                        loanId: loan.id,
                        title: `Declaração de Quitação - Contrato #${loan.id.substring(0, 8)}`,
                        htmlContent: dischargeHTML,
                        amount: Number(receipt.amount),
                        metadata: { receiptId: receipt.id }
                    });

                    // Enviar email de quitação
                    const { sendDischargeEmail } = await import('../services/emailService');
                    await sendDischargeEmail({
                        email: customer.email,
                        name: customer.name,
                        dischargeHTML,
                        loanAmount: Number(loan.principalAmount)
                    });

                    console.log(`[PaymentReceipts] ✅ Quitação gerada e enviada para ${customer.email}`);
                } else {
                    // Gerar recibo de pagamento
                    const receiptHTML = generateReceiptHTML({
                        receipt,
                        installment,
                        loan,
                        customer,
                        settings
                    });

                    await saveDocument({
                        type: 'RECEIPT',
                        customerId: customer.id,
                        loanId: loan.id,
                        installmentId: installment.id,
                        title: `Recibo de Pagamento #${receipt.id.substring(0, 8)}`,
                        htmlContent: receiptHTML,
                        amount: Number(receipt.amount),
                        metadata: { installmentNumber: loan.installments.findIndex(i => i.id === installment.id) + 1 }
                    });

                    // Enviar email de recibo
                    const { sendReceiptEmail } = await import('../services/emailService');
                    await sendReceiptEmail({
                        email: customer.email,
                        name: customer.name,
                        receiptHTML,
                        amount: Number(receipt.amount),
                        remainingBalance: Number(loan.remainingAmount)
                    });

                    console.log(`[PaymentReceipts] ✅ Recibo gerado e enviado para ${customer.email}`);
                }
            } catch (docError: any) {
                console.error('[PaymentReceipts] Erro ao gerar documento:', docError.message);
            }

            // Notificação interna
            await prisma.notification.create({
                data: {
                    customerId: customer.id,
                    customerEmail: customer.email,
                    title: isDischarge ? '🎉 Contrato Quitado' : '✅ Pagamento Confirmado',
                    message: isDischarge
                        ? `Parabéns! Seu contrato foi quitado!`
                        : `Seu pagamento de R$ ${Number(receipt.amount).toFixed(2)} foi confirmado!`,
                    type: 'SUCCESS'
                }
            }).catch(() => {});

            // WhatsApp
            if (customer.phone) {
                const waMsg = isDischarge
                    ? `🎉 *CONTRATO QUITADO!*\n\nParabéns, ${customer.name.split(' ')[0]}!\n\nSeu contrato foi quitado com sucesso! 🎊\n\nAcesse o app para ver sua declaração de quitação.\n\n_Tubarão Empréstimos 🦈_`
                    : `✅ *Pagamento Confirmado!*\n\nOlá, ${customer.name.split(' ')[0]}!\n\nSeu pagamento de R$ ${Number(receipt.amount).toFixed(2)} foi confirmado.\n\nAcesse o app para ver seu recibo.\n\n_Tubarão Empréstimos 🦈_`;

                sendWhatsAppMessage(customer.phone, waMsg).catch(() => {});
            }

            // Push
            if (customer.userId) {
                sendPushToUser(
                    customer.userId,
                    isDischarge ? '🎉 Contrato Quitado' : '✅ Pagamento Confirmado',
                    isDischarge ? 'Parabéns! Seu contrato foi quitado!' : `Seu pagamento de R$ ${Number(receipt.amount).toFixed(2)} foi confirmado!`
                ).catch(() => {});
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
