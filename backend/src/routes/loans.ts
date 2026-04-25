import { Router, Request, Response } from 'express';
import { prisma } from '../services/prisma';
import { authenticate, requireAdmin } from '../middleware/auth';
import { sendWhatsAppMessage } from '../services/whatsapp';

export const loansRouter = Router();
loansRouter.use(authenticate);

// GET /api/loans/admin/all — Admin: listar todos os contratos com filtros
loansRouter.get('/admin/all', requireAdmin, async (req: Request, res: Response) => {
    try {
        const { status, type, search } = req.query as Record<string, string>;

        const where: any = {};
        if (status && status !== 'ALL') where.status = status;
        if (type === 'LOAN') where.isLoan = true;
        if (type === 'SERVICE') where.isService = true;
        if (type === 'INVESTMENT') where.isInvestment = true;

        const loans = await prisma.loan.findMany({
            where,
            include: {
                customer: true,
                installments: { orderBy: { dueDate: 'asc' } }
            },
            orderBy: { createdAt: 'desc' }
        });

        // Filtro de busca por nome/CPF do cliente
        const filtered = search
            ? loans.filter(l =>
                l.customer?.name?.toLowerCase().includes(search.toLowerCase()) ||
                l.customer?.cpf?.includes(search)
            )
            : loans;

        res.json(filtered);
    } catch (err) {
        console.error('[Loans] admin/all error:', err);
        res.status(500).json({ error: 'Erro ao listar contratos' });
    }
});

// GET /api/loans/:loanId/admin-details — Detalhes completos de um contrato (admin)
loansRouter.get('/:loanId/admin-details', requireAdmin, async (req: Request, res: Response) => {
    try {
        const { loanId } = req.params;
        const loan = await prisma.loan.findUnique({
            where: { id: loanId },
            include: {
                customer: true,
                installments: { orderBy: { dueDate: 'asc' } },
                loanRequest: { select: { profileType: true, monthlyRate: true, contractMonths: true } }
            }
        });
        if (!loan) { res.status(404).json({ error: 'Contrato não encontrado' }); return; }
        res.json(loan);
    } catch (err) {
        console.error('[Loans] admin-details error:', err);
        res.status(500).json({ error: 'Erro ao buscar detalhes' });
    }
});

// PUT /api/loans/:loanId/admin-edit — Editar contrato (admin)
loansRouter.put('/:loanId/admin-edit', requireAdmin, async (req: Request, res: Response) => {
    try {
        const { loanId } = req.params;
        const { adminNotes, dailyInstallmentAmount, nextPaymentDate } = req.body;

        const updated = await prisma.loan.update({
            where: { id: loanId },
            data: {
                ...(adminNotes !== undefined && { adminNotes }),
                ...(dailyInstallmentAmount !== undefined && { dailyInstallmentAmount: parseFloat(dailyInstallmentAmount) }),
                ...(nextPaymentDate && { nextPaymentDate: new Date(nextPaymentDate) })
            }
        });

        res.json({ success: true, loan: updated });
    } catch (err) {
        console.error('[Loans] admin-edit error:', err);
        res.status(500).json({ error: 'Erro ao editar contrato' });
    }
});

// POST /api/loans/:loanId/manual-payment — Registrar pagamento manual (admin)
loansRouter.post('/:loanId/manual-payment', requireAdmin, async (req: Request, res: Response) => {
    try {
        const { loanId } = req.params;
        const { installmentId, amount, paymentMethod, receiptUrl, notes } = req.body;

        if (!installmentId || !amount) {
            res.status(400).json({ error: 'installmentId e amount são obrigatórios' });
            return;
        }

        const loan = await prisma.loan.findUnique({
            where: { id: loanId },
            include: { customer: true }
        });
        if (!loan) { res.status(404).json({ error: 'Contrato não encontrado' }); return; }

        // Buscar profileType para decidir se é pagamento de juros (CLT/Garantia) ou amortização (Comércio)
        const loanRequest = await prisma.loanRequest.findUnique({
            where: { id: loan.requestId },
            select: { profileType: true }
        });
        const profileType = (loanRequest as any)?.profileType || '';
        const isInterestOnlyProfile = ['CLT', 'GARANTIA', 'GARANTIA_VEICULO'].includes(profileType);

        // Marcar parcela como paga
        const paidInstallment = await prisma.installment.update({
            where: { id: installmentId },
            data: {
                status: 'PAID',
                paidAt: new Date(),
                ...(receiptUrl && { proofUrl: receiptUrl })
            }
        });

        if (isInterestOnlyProfile) {
            // CLT / Garantia: pagamento de JUROS — principal NÃO é abatido
            await prisma.loan.update({
                where: { id: loanId },
                data: {
                    lastPaymentDate: new Date(),
                    daysOverdue: 0
                    // remainingAmount NÃO muda — juros não amortiza o principal
                }
            });

            // Gerar próxima parcela de juros para o mês seguinte
            const interestRate = Number(loan.interestRate || 30) / 100;
            const nextInterestAmount = Number(loan.principalAmount) * interestRate;
            const nextDueDate = new Date();
            nextDueDate.setMonth(nextDueDate.getMonth() + 1);
            if (paidInstallment.dueDate) {
                nextDueDate.setDate(new Date(paidInstallment.dueDate).getDate());
            }
            await prisma.installment.create({
                data: {
                    loanId: loan.id,
                    amount: nextInterestAmount,
                    dueDate: nextDueDate,
                    status: 'OPEN'
                }
            });
            console.log(`[Loans] 💰 manual-payment JUROS - Loan ${loanId}: R$ ${amount} juros pago, principal mantido R$ ${Number(loan.remainingAmount).toFixed(2)}, nova parcela R$ ${nextInterestAmount.toFixed(2)} vence ${nextDueDate.toLocaleDateString('pt-BR')}`);
        } else {
            // AUTONOMO / MOTO / outros: AMORTIZAÇÃO — abate do principal
            const newRemaining = Math.max(0, loan.remainingAmount - parseFloat(amount));
            await prisma.loan.update({
                where: { id: loanId },
                data: {
                    remainingAmount: newRemaining,
                    lastPaymentDate: new Date(),
                    status: newRemaining <= 0 ? 'PAID' : loan.status,
                    daysOverdue: 0
                }
            });
            console.log(`[Loans] 💰 manual-payment AMORTIZAÇÃO - Loan ${loanId}: R$ ${amount} abatido, restante R$ ${newRemaining.toFixed(2)}`);
        }

        // Criar transação
        await prisma.transaction.create({
            data: {
                type: 'IN',
                description: `Pagamento manual - ${loan.customer?.name || String(loanId).substring(0, 8)} ${notes ? '| ' + notes : ''}`,
                amount: parseFloat(amount),
                category: 'PAYMENT',
                date: new Date()
            }
        });

        res.json({ success: true });
    } catch (err) {
        console.error('[Loans] manual-payment error:', err);
        res.status(500).json({ error: 'Erro ao registrar pagamento' });
    }
});

// POST /api/loans/:loanId/settle-all — Quitação total (admin)
loansRouter.post('/:loanId/settle-all', requireAdmin, async (req: Request, res: Response) => {
    try {
        const { loanId } = req.params;

        const loan = await prisma.loan.findUnique({
            where: { id: loanId },
            include: { customer: true, installments: true }
        });
        if (!loan) { res.status(404).json({ error: 'Contrato não encontrado' }); return; }

        const pendingInstallments = loan.installments.filter(
            i => i.status === 'OPEN' || i.status === 'LATE' || i.status === 'AWAITING_CONFIRMATION'
        );

        if (pendingInstallments.length === 0) {
            res.status(400).json({ error: 'Não há parcelas pendentes para quitar' });
            return;
        }

        const now = new Date();
        const totalPaid = pendingInstallments.reduce((sum, i) => sum + i.amount, 0);

        // Marcar todas as parcelas pendentes como PAID
        await prisma.installment.updateMany({
            where: { id: { in: pendingInstallments.map(i => i.id) } },
            data: { status: 'PAID', paidAt: now }
        });

        // Atualizar loan: remainingAmount = 0, status = COMPLETED
        await prisma.loan.update({
            where: { id: loanId },
            data: {
                remainingAmount: 0,
                lastPaymentDate: now,
                status: 'COMPLETED',
                daysOverdue: 0
            }
        });

        // Criar transação de quitação
        await prisma.transaction.create({
            data: {
                type: 'IN',
                description: `Quitação total — ${loan.customer?.name || String(loanId).substring(0, 8)} (${pendingInstallments.length} parcelas)`,
                amount: totalPaid,
                category: 'PAYMENT',
                date: now
            }
        });

        // Notificar cliente via WhatsApp
        if (loan.customer?.phone) {
            try {
                await sendWhatsAppMessage(
                    loan.customer.phone,
                    `✅ *Contrato Quitado!*\n\nOlá ${loan.customer.name}, seu contrato foi totalmente quitado.\n\nObrigado por confiar na Tubarão Empréstimos! 🦈`
                );
            } catch {
                // falha no WhatsApp não deve bloquear a quitação
            }
        }

        res.json({ success: true, installmentsSettled: pendingInstallments.length, totalPaid });
    } catch (err) {
        console.error('[Loans] settle-all error:', err);
        res.status(500).json({ error: 'Erro ao quitar contrato' });
    }
});

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
            where: { id: req.params.loanId as string },
            include: { loanRequest: { select: { profileType: true } } }
        } as any);
        if (loan) {
            const profileType = (loan as any).loanRequest?.profileType || '';
            const isInterestOnly = ['CLT', 'GARANTIA', 'GARANTIA_VEICULO'].includes(profileType);
            const newRemaining = isInterestOnly ? loan.remainingAmount : loan.remainingAmount - installment.amount;
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

// POST /api/loans/:loanId/nivel-ouro — Ativar Nível Ouro Tubarão
loansRouter.post('/:loanId/nivel-ouro', authenticate, async (req: Request, res: Response) => {
    try {
        const { loanId } = req.params;

        // 1. Buscar o empréstimo
        const loan = await prisma.loan.findUnique({
            where: { id: loanId },
            include: {
                installments: {
                    orderBy: { dueDate: 'asc' }
                },
                customer: true
            }
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

        // 2. VALIDAÇÕES DE ELEGIBILIDADE

        // 2.1. Verificar se já foi utilizado
        if (loan.nivelOuroUtilizado) {
            res.status(400).json({
                error: 'Nível Ouro já utilizado',
                message: 'Você já utilizou o Nível Ouro Tubarão neste contrato.'
            });
            return;
        }

        // 2.2. Verificar se contrato está ativo
        if (loan.status !== 'APPROVED') {
            res.status(400).json({
                error: 'Contrato inativo',
                message: 'O contrato precisa estar ativo para usar o Nível Ouro Tubarão.'
            });
            return;
        }

        // 2.3. Verificar se tem parcelas em atraso
        const overdueInstallments = loan.installments.filter(i =>
            i.status === 'LATE' || i.status === 'OVERDUE'
        );
        if (overdueInstallments.length > 0) {
            res.status(400).json({
                error: 'Parcelas em atraso',
                message: 'Você possui parcelas em atraso. Regularize sua situação para acessar o Nível Ouro Tubarão.'
            });
            return;
        }

        // 2.4. Verificar 12 pagamentos consecutivos em dia
        const paidInstallments = loan.installments.filter(i => i.status === 'PAID');
        if (paidInstallments.length < 12) {
            res.status(400).json({
                error: 'Pagamentos insuficientes',
                message: `Você precisa de 12 pagamentos consecutivos em dia. Você tem ${paidInstallments.length} pagamentos confirmados.`
            });
            return;
        }

        // 2.5. Verificar se os 12 pagamentos foram em dia (sem atrasos)
        const first12Paid = paidInstallments.slice(0, 12);
        const hasDelays = first12Paid.some(inst => {
            if (!inst.paidAt) return true;
            const dueDate = new Date(inst.dueDate);
            const paidDate = new Date(inst.paidAt);
            return paidDate > dueDate; // Pagou após vencimento
        });

        if (hasDelays) {
            res.status(400).json({
                error: 'Pagamentos com atraso',
                message: 'Os 12 pagamentos precisam ter sido feitos em dia, sem atrasos.'
            });
            return;
        }

        // 3. CALCULAR NOVO PLANO (5 PARCELAS)

        // Buscar taxa de juros mensal do sistema
        const interestSetting = await prisma.systemSettings.findFirst({
            where: { key: 'monthlyInterestRate' }
        });
        const monthlyInterestAmount = parseFloat(interestSetting?.value || '300'); // R$ 300 padrão

        // Valor do empréstimo original
        const loanAmount = loan.amount;

        // Nova parcela = Juros mensal (R$ 300) + (Valor empréstimo ÷ 5)
        const principalPerInstallment = loanAmount / 5;
        const newInstallmentValue = monthlyInterestAmount + principalPerInstallment;
        const totalAmount = newInstallmentValue * 5;

        // 4. CRIAR AS 5 NOVAS PARCELAS

        // Cancelar parcelas abertas antigas
        await prisma.installment.updateMany({
            where: {
                loanId: loan.id,
                status: { in: ['OPEN', 'PENDING'] }
            },
            data: {
                status: 'CANCELLED'
            }
        });

        // Criar 5 novas parcelas
        const today = new Date();
        const newInstallments = [];

        for (let i = 1; i <= 5; i++) {
            const dueDate = new Date(today);
            dueDate.setMonth(dueDate.getMonth() + i);

            const installment = await prisma.installment.create({
                data: {
                    loanId: loan.id,
                    amount: parseFloat(newInstallmentValue.toFixed(2)),
                    dueDate: dueDate,
                    status: 'OPEN'
                }
            });
            newInstallments.push(installment);
        }

        // 5. ATUALIZAR O EMPRÉSTIMO
        await prisma.loan.update({
            where: { id: loan.id },
            data: {
                nivelOuroUtilizado: true,
                dataAtivacaoNivelOuro: new Date(),
                installmentsCount: 5,
                remainingAmount: totalAmount
            }
        });

        // 6. CRIAR NOTIFICAÇÃO PARA ADMIN
        await prisma.notification.create({
            data: {
                title: `🟢 Nível Ouro Ativado — ${customer.name}`,
                message: `${customer.name} (${customer.cpf}) ativou o Nível Ouro Tubarão!
Contrato: #${loanId.slice(-6)}
Novo plano: 5x de R$ ${newInstallmentValue.toFixed(2)}
Total: R$ ${totalAmount.toFixed(2)}`,
                type: 'SUCCESS',
                customerId: customer.id,
                customerEmail: customer.email
            }
        });

        // 7. ENVIAR EMAIL PARA O CLIENTE
        try {
            const { emailService } = require('../services/email');
            const emailHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #000; color: #fff; padding: 30px; border-radius: 12px;">
                <div style="text-align: center; margin-bottom: 20px;">
                    <h1 style="color: #D4AF37; font-size: 24px;">🦈 Tubarão Empréstimos</h1>
                </div>
                <div style="background: linear-gradient(135deg, #D4AF37 0%, #FFD700 100%); padding: 20px; border-radius: 12px; text-align: center; margin-bottom: 20px;">
                    <h2 style="color: #000; margin: 0; font-size: 28px;">🟢 NÍVEL OURO ATIVADO!</h2>
                    <p style="color: #000; margin: 10px 0 0 0; font-size: 14px;">Parabéns pela disciplina!</p>
                </div>
                <div style="background: #111; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                    <p style="color: #D4AF37; font-weight: bold; margin-bottom: 15px;">Seu Novo Plano:</p>
                    <p style="color: #aaa; margin: 5px 0;">Parcelas: <strong style="color: #fff;">5x de R$ ${newInstallmentValue.toFixed(2)}</strong></p>
                    <p style="color: #aaa; margin: 5px 0;">Total: <strong style="color: #fff;">R$ ${totalAmount.toFixed(2)}</strong></p>
                    <p style="color: #aaa; margin: 5px 0;">Primeira parcela: <strong style="color: #fff;">${newInstallments[0].dueDate.toLocaleDateString('pt-BR')}</strong></p>
                </div>
                <div style="background: #1a1a00; border: 1px solid #D4AF37; border-radius: 8px; padding: 15px;">
                    <p style="color: #D4AF37; font-weight: bold; margin-bottom: 10px;">✨ Benefícios do Nível Ouro:</p>
                    <ul style="color: #fff; margin: 0; padding-left: 20px;">
                        <li>Apenas 5 parcelas para quitar</li>
                        <li>Condições especiais de pagamento</li>
                        <li>Reconhecimento pela sua disciplina</li>
                    </ul>
                </div>
                <p style="color: #666; font-size: 11px; text-align: center; margin-top: 20px;">
                    Continue pagando em dia para manter seus benefícios!<br/>
                    Tubarão Empréstimos — Plataforma de Crédito Premium
                </p>
            </div>`;
            await emailService.send(
                customer.email,
                '🟢 Nível Ouro Tubarão Ativado — Parabéns!',
                emailHtml
            );
        } catch (emailErr) {
            console.error('[Loans] Email error:', emailErr);
        }

        // 8. NOTIFICAR ADMINS VIA WHATSAPP
        try {
            const admins = await prisma.user.findMany({ where: { role: 'ADMIN' } });
            for (const admin of admins) {
                if (admin.phone) {
                    await sendWhatsAppMessage(admin.phone,
                        `🟢 *NÍVEL OURO ATIVADO!*\n\nCliente: ${customer.name}\nCPF: ${customer.cpf}\nContrato: #${loanId.slice(-6)}\n\nNovo plano: 5x de R$ ${newInstallmentValue.toFixed(2)}\nTotal: R$ ${totalAmount.toFixed(2)}\n\nCliente completou 12 pagamentos consecutivos em dia! 🎉`
                    );
                }
            }
        } catch (whatsappErr) {
            console.error('[Loans] WhatsApp error:', whatsappErr);
        }

        // 9. RETORNAR SUCESSO
        res.json({
            success: true,
            message: 'Nível Ouro Tubarão ativado com sucesso!',
            plan: {
                installments: 5,
                installmentValue: parseFloat(newInstallmentValue.toFixed(2)),
                totalAmount: parseFloat(totalAmount.toFixed(2)),
                firstDueDate: newInstallments[0].dueDate,
                newInstallments: newInstallments.map(i => ({
                    id: i.id,
                    amount: i.amount,
                    dueDate: i.dueDate,
                    status: i.status
                }))
            }
        });

    } catch (error: any) {
        console.error('[Loans] Nivel Ouro error:', error);
        res.status(500).json({ error: 'Erro ao ativar Nível Ouro Tubarão' });
    }
});

// GET /api/loans/:loanId/nivel-ouro/eligibility — Verificar elegibilidade para Nível Ouro
loansRouter.get('/:loanId/nivel-ouro/eligibility', authenticate, async (req: Request, res: Response) => {
    try {
        const { loanId } = req.params;

        const loan = await prisma.loan.findUnique({
            where: { id: loanId },
            include: {
                installments: {
                    orderBy: { dueDate: 'asc' }
                }
            }
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

        // Verificar elegibilidade
        const alreadyUsed = loan.nivelOuroUtilizado;
        const isActive = loan.status === 'APPROVED';
        const overdueInstallments = loan.installments.filter(i =>
            i.status === 'LATE' || i.status === 'OVERDUE'
        );
        const hasOverdue = overdueInstallments.length > 0;
        const paidInstallments = loan.installments.filter(i => i.status === 'PAID');
        const paidCount = paidInstallments.length;
        const has12Payments = paidCount >= 12;

        // Verificar se os pagamentos foram em dia
        let allOnTime = true;
        if (has12Payments) {
            const first12Paid = paidInstallments.slice(0, 12);
            allOnTime = !first12Paid.some(inst => {
                if (!inst.paidAt) return true;
                const dueDate = new Date(inst.dueDate);
                const paidDate = new Date(inst.paidAt);
                return paidDate > dueDate;
            });
        }

        const isEligible = !alreadyUsed && isActive && !hasOverdue && has12Payments && allOnTime;

        let reason = '';
        if (alreadyUsed) reason = 'Nível Ouro já foi utilizado neste contrato';
        else if (!isActive) reason = 'Contrato não está ativo';
        else if (hasOverdue) reason = 'Existem parcelas em atraso';
        else if (!has12Payments) reason = `Você tem ${paidCount} pagamentos. Precisa de 12 pagamentos consecutivos`;
        else if (!allOnTime) reason = 'Os 12 pagamentos precisam ter sido feitos em dia';

        res.json({
            eligible: isEligible,
            reason: isEligible ? 'Você está elegível para o Nível Ouro Tubarão!' : reason,
            details: {
                alreadyUsed,
                isActive,
                hasOverdue,
                paidCount,
                has12Payments,
                allOnTime
            }
        });

    } catch (error: any) {
        console.error('[Loans] Eligibility check error:', error);
        res.status(500).json({ error: 'Erro ao verificar elegibilidade' });
    }
});
