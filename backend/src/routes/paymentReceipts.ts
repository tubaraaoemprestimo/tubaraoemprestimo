import { Router, Request, Response } from 'express';
import { prisma } from '../services/prisma';
import { authenticate, requireAdmin } from '../middleware/auth';
import { emailService } from '../services/email';
import { sendWhatsAppMessage } from '../services/whatsapp';
import { sendPushToUser, sendPushToRole } from './push';
import { applyApprovedPayment } from '../services/paymentConfirmationService';

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
                message: `${customer.name} enviou comprovante de R$ ${Number(receipt.amount).toFixed(2)}`,
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
                        `💳 *Comprovante Recebido*\n\nCliente: ${customer.name}\nValor: R$ ${Number(receipt.amount).toFixed(2)}\n\nAcesse o painel para confirmar o pagamento.`
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

        const customerMap = new Map<string, string>(customers.map((c: any) => [c.id, c.name]));
        type InstInfo = { loanId: string; dueDate: Date; amount: number };
        const installmentMap = new Map<string, InstInfo>(installments.map((i: any) => [i.id, { loanId: i.loanId, dueDate: i.dueDate, amount: Number(i.amount) }]));

        const enriched = receipts.map((r: any) => {
            const inst = installmentMap.get(r.installmentId);
            const customerName = customerMap.get(r.customerId) || '';

            // Debug log
            if (!customerName) {
                console.log(`[PaymentReceipts] ⚠️ customerName vazio para receipt ${r.id}, customerId: ${r.customerId}`);
            }

            return {
                ...r,
                customerName,
                loanId: inst ? inst.loanId : '',
                installmentDueDate: inst ? inst.dueDate : null,
                installmentAmount: inst ? inst.amount : null
            };
        });

        console.log(`[PaymentReceipts] GET retornando ${enriched.length} receipts, primeiro customerName: ${enriched[0]?.customerName || 'N/A'}`);
        res.json(enriched);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar comprovantes' });
    }
});

// PUT /api/payment-receipts/:id/approve — Admin confirma pagamento
paymentReceiptsRouter.put('/:id/approve', requireAdmin, async (req: Request, res: Response) => {
    try {
        const { isDischarge, isInterestOnly, amount } = req.body; // flags: quitação total ou só juros

        const existingReceipt = await prisma.paymentReceipt.findUnique({
            where: { id: req.params.id as string },
            select: { notes: true, amount: true }
        });
        if (!existingReceipt) {
            res.status(404).json({ error: 'Comprovante não encontrado' });
            return;
        }

        const approvedAmount = amount !== undefined ? Number(amount) : Number(existingReceipt.amount);
        if (!Number.isFinite(approvedAmount) || approvedAmount <= 0) {
            res.status(400).json({ error: 'Informe o valor do comprovante antes de aprovar' });
            return;
        }

        const nextNotes = req.body.notes
            ? [existingReceipt.notes, req.body.notes].filter(Boolean).join(' | review: ')
            : existingReceipt.notes || null;

        const receipt = await prisma.paymentReceipt.update({
            where: { id: req.params.id as string },
            data: {
                amount: approvedAmount,
                status: 'APPROVED',
                reviewedBy: req.user!.id,
                reviewedAt: new Date(),
                notes: nextNotes
            }
        });

        const result = await applyApprovedPayment(receipt, { isDischarge, isInterestOnly });
        if (result === 'INSTALLMENT_NOT_FOUND') {
            res.status(404).json({ error: 'Parcela não encontrada' });
            return;
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
