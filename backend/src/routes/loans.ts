import { Router, Request, Response } from 'express';
import { prisma } from '../services/prisma';
import { authenticate, requireAdmin } from '../middleware/auth';
import { sendWhatsAppMessage } from '../services/whatsapp';

export const loansRouter = Router();
loansRouter.use(authenticate);

// GET /api/loans — Empréstimos do cliente ou todos (admin)
loansRouter.get('/', async (req: Request, res: Response) => {
    try {
        let loans;
        if (req.user!.role === 'ADMIN') {
            loans = await prisma.loan.findMany({
                include: { customer: true, installments: true },
                orderBy: { createdAt: 'desc' }
            });
        } else {
            // Busca customer do user
            const customer = await prisma.customer.findFirst({
                where: { userId: req.user!.id }
            });
            if (!customer) { res.json([]); return; }

            loans = await prisma.loan.findMany({
                where: { customerId: customer.id },
                include: { installments: true },
                orderBy: { createdAt: 'desc' }
            });
        }
        res.json(loans);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar empréstimos' });
    }
});

// PUT /api/loans/:loanId/installments/:installmentId/proof — Upload comprovante
loansRouter.put('/:loanId/installments/:installmentId/proof', async (req: Request, res: Response) => {
    try {
        const { proofUrl } = req.body;
        const installment = await prisma.installment.update({
            where: { id: req.params.installmentId as string },
            data: {
                proofUrl,
                status: 'PAID',
                paidAt: new Date()
            }
        });

        // Atualiza remaining_amount do loan
        const loan = await prisma.loan.findUnique({
            where: { id: req.params.loanId as string }
        });
        if (loan) {
            const newRemaining = loan.remainingAmount - installment.amount;
            await prisma.loan.update({
                where: { id: loan.id },
                data: {
                    remainingAmount: Math.max(0, newRemaining),
                    status: newRemaining <= 0 ? 'PAID' : loan.status
                }
            });

            // Cria transação
            await prisma.transaction.create({
                data: {
                    type: 'IN',
                    description: `Pagamento parcela - ${loan.id.substring(0, 8)}`,
                    amount: installment.amount,
                    category: 'PAYMENT',
                    date: new Date()
                }
            });

            // Notifica admins via WhatsApp sobre pagamento recebido
            if (loan.customerId) {
                const customer = await prisma.customer.findUnique({ where: { id: loan.customerId } });
                if (customer) {
                    const admins = await prisma.user.findMany({ where: { role: 'ADMIN' } });
                    for (const admin of admins) {
                        if (admin.phone) {
                            await sendWhatsAppMessage(admin.phone,
                                `💰 *Pagamento Recebido!*\n\nCliente: ${customer.name}\nValor: R$ ${installment.amount.toFixed(2)}\nParcela: ${installment.id.substring(0, 8)}\n\nVerifique e confirme no painel admin.`
                            );
                        }
                    }
                }
            }

            // ====== GATILHO DE LIBERAÇÃO DE COMISSÃO (40/30/30) ======
            try {
                // Verificar se este loan veio de uma indicação de parceiro
                const loanRequest = await prisma.loanRequest.findUnique({
                    where: { id: loan.requestId }
                });

                if (loanRequest?.isPartnerReferral && loanRequest?.partnerId) {
                    // Buscar comissão pendente para este contrato
                    const commission = await prisma.partnerCommission.findFirst({
                        where: {
                            contractId: loan.id,
                            status: { in: ['PENDING', 'PARTIAL'] }
                        }
                    });

                    if (commission) {
                        // Contar parcelas pagas do empréstimo
                        const paidInstallments = await prisma.installment.count({
                            where: {
                                loanId: loan.id,
                                status: 'PAID'
                            }
                        });

                        const totalComm = commission.totalCommission;
                        let updateData: any = {};

                        if (paidInstallments === 1 && commission.installmentsReleased < 1) {
                            // 1ª parcela paga: libera 40%
                            const release = totalComm * 0.40;
                            updateData = {
                                installmentsReleased: 1,
                                releasedPercent: 40,
                                commissionAmount: release,
                                release1Amount: release,
                                release1At: new Date(),
                                status: 'PARTIAL'
                            };
                            console.log(`[Loans] Partner commission: Released 40% (R$ ${release.toFixed(2)}) for partner ${loanRequest.partnerId}`);
                        } else if (paidInstallments === 2 && commission.installmentsReleased < 2) {
                            // 2ª parcela paga: libera +30% (total 70%)
                            const release = totalComm * 0.30;
                            updateData = {
                                installmentsReleased: 2,
                                releasedPercent: 70,
                                commissionAmount: (commission.release1Amount || 0) + release,
                                release2Amount: release,
                                release2At: new Date(),
                                status: 'PARTIAL'
                            };
                            console.log(`[Loans] Partner commission: Released +30% (R$ ${release.toFixed(2)}) for partner ${loanRequest.partnerId}`);
                        } else if (paidInstallments >= 3 && commission.installmentsReleased < 3) {
                            // 3ª parcela paga: libera +30% (total 100%)
                            const release = totalComm * 0.30;
                            updateData = {
                                installmentsReleased: 3,
                                releasedPercent: 100,
                                commissionAmount: totalComm,
                                release3Amount: release,
                                release3At: new Date(),
                                status: 'PAID',
                                paidAt: new Date()
                            };
                            console.log(`[Loans] Partner commission: Released final 30% (R$ ${release.toFixed(2)}) - FULLY PAID for partner ${loanRequest.partnerId}`);
                        }

                        if (Object.keys(updateData).length > 0) {
                            await prisma.partnerCommission.update({
                                where: { id: commission.id },
                                data: updateData
                            });

                            // Atualizar partnerScore (total liberado)
                            const totalReleased = await prisma.partnerCommission.aggregate({
                                where: {
                                    partnerId: loanRequest.partnerId,
                                    status: { in: ['PARTIAL', 'PAID'] }
                                },
                                _sum: { commissionAmount: true }
                            });

                            await prisma.user.update({
                                where: { id: loanRequest.partnerId },
                                data: { partnerScore: totalReleased._sum.commissionAmount || 0 }
                            });
                        }
                    }
                }
            } catch (commErr) {
                console.error('[Loans] Commission release error:', commErr);
            }
        }

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao registrar pagamento' });
    }
});

// GET /api/loans/pre-approval — Pré-aprovação do cliente
loansRouter.get('/pre-approval', async (req: Request, res: Response) => {
    try {
        const customer = await prisma.customer.findFirst({
            where: { userId: req.user!.id },
            select: { preApprovedAmount: true }
        });
        res.json({ amount: customer?.preApprovedAmount || null });
    } catch (error) {
        res.status(500).json({ error: 'Erro' });
    }
});

// GET /api/loans/installment-offer — Oferta de parcelamento do cliente
loansRouter.get('/installment-offer', async (req: Request, res: Response) => {
    try {
        const customer = await prisma.customer.findFirst({
            where: { userId: req.user!.id },
            select: { installmentOffer: true }
        });
        res.json({ offer: customer?.installmentOffer || null });
    } catch (error) {
        res.status(500).json({ error: 'Erro' });
    }
});

// POST /api/loans/:loanId/generate-payment — Gerar cobrança (só juros ou quitação total)
loansRouter.post('/:loanId/generate-payment', authenticate, async (req: Request, res: Response) => {
    try {
        const { loanId } = req.params;
        const { type } = req.body; // 'interest_only' | 'full'

        if (!type || !['interest_only', 'full'].includes(type)) {
            res.status(400).json({ error: 'Tipo inválido. Use: interest_only ou full' });
            return;
        }

        // 1. Buscar o empréstimo
        const loan = await prisma.loan.findUnique({
            where: { id: loanId },
            include: { installments: true }
        });

        if (!loan) {
            res.status(404).json({ error: 'Empréstimo não encontrado' });
            return;
        }

        // Verificar se pertence ao usuário
        const customer = await prisma.customer.findFirst({
            where: { userId: req.user!.id }
        });
        if (!customer || customer.id !== loan.customerId) {
            res.status(403).json({ error: 'Sem permissão' });
            return;
        }

        // 2. Buscar taxa de juros do admin
        const interestSetting = await prisma.systemSettings.findFirst({
            where: { key: 'monthlyInterestRate' }
        });
        const monthlyRate = parseFloat(interestSetting?.value || '30') / 100; // 30% → 0.30

        // 3. Calcular valores
        const originalAmount = loan.amount; // Valor emprestado original
        const remainingAmount = loan.remainingAmount; // Saldo devedor restante
        const interestAmount = parseFloat((originalAmount * monthlyRate).toFixed(2)); // Juros do mês

        let paymentAmount = 0;
        let paymentDescription = '';

        if (type === 'interest_only') {
            paymentAmount = interestAmount;
            paymentDescription = `Pagamento de Juros Mensal (${(monthlyRate * 100).toFixed(0)}% sobre R$ ${originalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})`;
        } else {
            // Full: saldo devedor restante + juros do mês atual
            paymentAmount = parseFloat((remainingAmount + interestAmount).toFixed(2));
            paymentDescription = `Quitação Total (Saldo R$ ${remainingAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} + Juros R$ ${interestAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})`;
        }

        // 4. Buscar PIX da empresa
        const pixKeySetting = await prisma.systemSettings.findFirst({ where: { key: 'pixKey' } });
        const pixKeyTypeSetting = await prisma.systemSettings.findFirst({ where: { key: 'pixKeyType' } });
        const pixReceiverSetting = await prisma.systemSettings.findFirst({ where: { key: 'pixReceiverName' } });

        const pixKey = pixKeySetting?.value || '61.086.937/0001-16';
        const pixKeyType = pixKeyTypeSetting?.value || 'CNPJ';
        const pixReceiver = pixReceiverSetting?.value || 'TUBARÃO EMPRÉSTIMOS LTDA';

        // 5. Criar notificação para admin
        await prisma.notification.create({
            data: {
                title: type === 'interest_only'
                    ? `💰 Pagamento de Juros — ${customer.name}`
                    : `✅ Quitação Total — ${customer.name}`,
                message: `${customer.name} (${customer.cpf}) solicitou ${type === 'interest_only' ? 'pagamento de juros' : 'quitação total'} do contrato #${loanId.slice(-6)}.
Valor: R$ ${paymentAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
Empréstimo original: R$ ${originalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
Saldo devedor: R$ ${remainingAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
                type: 'ALERT',
                customerId: customer.id,
                customerEmail: customer.email
            }
        });

        // 6. Enviar email para o cliente
        try {
            const { emailService } = require('../services/email');
            const emailHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #000; color: #fff; padding: 30px; border-radius: 12px;">
                <div style="text-align: center; margin-bottom: 20px;">
                    <h1 style="color: #D4AF37; font-size: 24px;">🦈 Tubarão Empréstimos</h1>
                </div>
                <h2 style="color: #D4AF37; margin-bottom: 15px;">${type === 'interest_only' ? '💰 Pagamento de Juros' : '✅ Quitação Total'}</h2>
                <div style="background: #111; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                    <p style="color: #aaa; margin: 5px 0;">Contrato: <strong style="color: #fff;">#${loanId.slice(-6)}</strong></p>
                    <p style="color: #aaa; margin: 5px 0;">Valor Original: <strong style="color: #fff;">R$ ${originalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></p>
                    <p style="color: #aaa; margin: 5px 0;">Saldo Devedor: <strong style="color: #fff;">R$ ${remainingAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></p>
                    <p style="color: #aaa; margin: 5px 0;">Juros (${(monthlyRate * 100).toFixed(0)}% a.m.): <strong style="color: #D4AF37;">R$ ${interestAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></p>
                    <hr style="border-color: #333; margin: 15px 0;" />
                    <p style="color: #D4AF37; font-size: 22px; font-weight: bold; margin: 10px 0; text-align: center;">
                        VALOR A PAGAR: R$ ${paymentAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                </div>
                <div style="background: #1a1a00; border: 1px solid #D4AF37; border-radius: 8px; padding: 15px; text-align: center;">
                    <p style="color: #D4AF37; font-weight: bold; margin-bottom: 10px;">🔑 Chave PIX para Pagamento</p>
                    <p style="color: #fff; font-size: 18px; font-weight: bold;">${pixKey}</p>
                    <p style="color: #aaa; font-size: 12px;">${pixKeyType} — ${pixReceiver}</p>
                </div>
                <p style="color: #666; font-size: 11px; text-align: center; margin-top: 20px;">
                    Após o pagamento, envie o comprovante pelo app para confirmação.<br/>
                    Tubarão Empréstimos — Plataforma de Crédito Premium
                </p>
            </div>`;
            await emailService.send(customer.email,
                type === 'interest_only' ? '💰 Pagamento de Juros — Tubarão Empréstimos' : '✅ Quitação Total — Tubarão Empréstimos',
                emailHtml
            );
        } catch (emailErr) {
            console.error('[Loans] Email error:', emailErr);
        }

        // 7. Notificar admins via Push
        try {
            const { sendPushToRole } = require('./push');
            sendPushToRole('ADMIN',
                type === 'interest_only' ? '💰 Pagamento de Juros' : '✅ Quitação Total',
                `${customer.name}: R$ ${paymentAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
            ).catch(() => { });
        } catch { }

        // 8. Retornar dados para o frontend
        res.json({
            success: true,
            payment: {
                type,
                amount: paymentAmount,
                description: paymentDescription,
                originalAmount,
                remainingAmount,
                interestAmount,
                interestRate: monthlyRate * 100,
                pixKey,
                pixKeyType,
                pixReceiver,
                contractId: loanId.slice(-6),
            }
        });

    } catch (error: any) {
        console.error('[Loans] Generate payment error:', error);
        res.status(500).json({ error: 'Erro ao gerar cobrança' });
    }
});
