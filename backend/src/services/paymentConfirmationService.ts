import { prisma } from './prisma';
import { sendWhatsAppMessage } from './whatsapp';
import { sendPushToUser } from '../routes/push';
import { applyPaymentWaterfall, getLoanPayoffBalance } from './loanPayoffService';

/**
 * Aplica a baixa de um pagamento já aprovado: atualiza parcela/contrato,
 * registra a entrada, gera recibo ou quitação e notifica o cliente.
 *
 * Extraído sem alteração de PUT /api/payment-receipts/:id/approve para que o
 * admin (comprovante manual) e o webhook da InfinitePay usem exatamente as
 * mesmas regras financeiras — rolagem de juros (CLT/GARANTIA), waterfall de
 * amortização e quitação — em vez de duas cópias que divergem com o tempo.
 *
 * `receipt` é a linha de PaymentReceipt já marcada como APPROVED.
 */
export async function applyApprovedPayment(
    receipt: any,
    opts: { isDischarge?: boolean; isInterestOnly?: boolean } = {}
): Promise<'OK' | 'INSTALLMENT_NOT_FOUND'> {
    const { isDischarge, isInterestOnly } = opts;

    const installment = await prisma.installment.findUnique({
        where: { id: receipt.installmentId }
    });
    if (!installment) {
        return 'INSTALLMENT_NOT_FOUND';
    }

    // Atualizar remainingAmount do loan
    const loan = await prisma.loan.findUnique({
        where: { id: installment.loanId },
        include: { installments: true, customer: true }
    });

    // Buscar o profileType do LoanRequest vinculado
    let profileType = '';
    if (loan) {
        const loanRequest = await prisma.loanRequest.findUnique({
            where: { id: loan.requestId },
            select: { profileType: true }
        });
        profileType = (loanRequest as any)?.profileType || '';
    }

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

            // Marcar loan/request como quitado
            await prisma.loan.update({
                where: { id: loan.id },
                data: {
                    remainingAmount: 0,
                    status: 'COMPLETED'
                }
            });
            await prisma.loanRequest.update({
                where: { id: loan.requestId },
                data: { status: 'COMPLETED' }
            });

            console.log(`[PaymentReceipts] ✅ Loan ${loan.id} QUITADO (discharge)`);
        } else if (isInterestOnly || (profileType === 'CLT' || profileType === 'GARANTIA' || profileType === 'GARANTIA_VEICULO')) {
            // ============================================================
            // PAGAMENTO DE JUROS (CLT / Garantia) — NÃO abate do principal
            // O juros é receita mensal recorrente (30% a.m.)
            // O remainingAmount (saldo devedor) NÃO muda
            // Gera nova parcela de juros para o próximo mês
            // ============================================================
            const paidAmount = Number(receipt.amount);

            await prisma.loan.update({
                where: { id: loan.id },
                data: {
                    lastPaymentDate: new Date()
                    // remainingAmount NÃO MUDA — juros não amortiza o principal
                }
            });

            // Marca o registro pago como pagamento de juros de rolagem (não é amortização)
            await prisma.installment.update({
                where: { id: installment.id },
                data: { status: 'PAID', paidAt: new Date(), proofUrl: receipt.receiptUrl, isInterestPayment: true }
            });

            // Gerar nova parcela de juros para o próximo mês
            const interestRate = Number(loan.interestRate || 30) / 100; // 30% -> 0.30
            const nextInterestAmount = Number(loan.principalAmount) * interestRate;
            const nextDueDate = new Date();
            nextDueDate.setMonth(nextDueDate.getMonth() + 1);
            // Manter o mesmo dia do vencimento original
            if (installment.dueDate) {
                nextDueDate.setDate(new Date(installment.dueDate).getDate());
            }

            await prisma.installment.create({
                data: {
                    loanId: loan.id,
                    amount: nextInterestAmount,
                    dueDate: nextDueDate,
                    status: 'OPEN',
                    isInterestPayment: true
                }
            });

            console.log(`[PaymentReceipts] 💰 Loan ${loan.id} JUROS PAGO: R$ ${paidAmount.toFixed(2)} — principal mantido R$ ${Number(loan.remainingAmount).toFixed(2)} — nova parcela juros R$ ${nextInterestAmount.toFixed(2)} vence ${nextDueDate.toLocaleDateString('pt-BR')}`);
        } else {
            // ============================================================
            // AMORTIZAÇÃO (Comércio/DAILY) — abate do principal
            // Cada pagamento reduz o remainingAmount
            // ============================================================
            const paidAmount = Number(receipt.amount);
            const balance = await getLoanPayoffBalance(loan.id);
            const waterfall = applyPaymentWaterfall({
                paymentAmount: paidAmount,
                principalBalance: balance.principalBalance,
                interestBalance: balance.interestBalance,
                feeBalance: balance.feeBalance,
            });
            const now = new Date();

            await prisma.$transaction(async (tx: any) => {
                let remainingFeeReduction = waterfall.appliedToFees;
                const pendingInstallments = await tx.installment.findMany({
                    where: { id: { in: balance.pendingInstallmentIds } },
                    orderBy: { dueDate: 'asc' },
                });

                for (const pending of pendingInstallments) {
                    const currentFee = Number(pending.lateFeeAmount || pending.fineAccumulated || 0);
                    const feeApplied = Math.min(remainingFeeReduction, currentFee);
                    remainingFeeReduction = +(remainingFeeReduction - feeApplied).toFixed(2);
                    const nextFee = +(currentFee - feeApplied).toFixed(2);
                    const targetTotal = Number(pending.amount || 0) + currentFee;
                    const shouldClose = pending.id === installment.id && paidAmount >= targetTotal;

                    await tx.installment.update({
                        where: { id: pending.id },
                        data: {
                            lateFeeAmount: nextFee,
                            fineAccumulated: nextFee,
                            ...(pending.id === installment.id && { proofUrl: receipt.receiptUrl }),
                            ...(shouldClose && { status: 'PAID', paidAt: now }),
                        }
                    });
                }

                await tx.loan.update({
                    where: { id: loan.id },
                    data: {
                        remainingAmount: waterfall.remainingPrincipalBalance,
                        lastPaymentDate: now,
                        status: waterfall.remainingTotalBalance <= 0 ? 'COMPLETED' : loan.status
                    }
                });
            });

            console.log(`[PaymentReceipts] Loan ${loan.id} AMORTIZAÇÃO/WATERFALL: pago R$ ${paidAmount.toFixed(2)} fees=${waterfall.appliedToFees} principal=${waterfall.appliedToPrincipal} => remainingAmount = R$ ${waterfall.remainingPrincipalBalance.toFixed(2)}`);
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
            const { generateReceiptHTML, generateDischargeHTML, saveDocument, getCompanySettings } = await import('./documentService');
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
                const { sendDischargeEmail } = await import('./emailService');
                await sendDischargeEmail({
                    email: customer.email,
                    name: customer.name,
                    dischargeHTML,
                    loanAmount: Number(receipt.amount)
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
                const { sendReceiptEmail } = await import('./emailService');
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
                    ? `Parabéns! Seu contrato foi quitado! Total pago: R$ ${Number(receipt.amount).toFixed(2)}`
                    : `Seu pagamento de R$ ${Number(receipt.amount).toFixed(2)} foi confirmado!`,
                type: 'SUCCESS'
            }
        }).catch(() => {});

        // WhatsApp
        if (customer.phone) {
            const waMsg = isDischarge
                ? `🎉 *CONTRATO QUITADO!*

Parabéns, ${customer.name.split(' ')[0]}!

Seu contrato foi quitado com sucesso! 🎊

💰 *Total pago: R$ ${Number(receipt.amount).toFixed(2)}*

Acesse o app para ver sua declaração de quitação.

_Tubarão Empréstimos 🦈_`
                : `✅ *Pagamento Confirmado!*\n\nOlá, ${customer.name.split(' ')[0]}!\n\nSeu pagamento de R$ ${Number(receipt.amount).toFixed(2)} foi confirmado.\n\nAcesse o app para ver seu recibo.\n\n_Tubarão Empréstimos 🦈_`;

            sendWhatsAppMessage(customer.phone, waMsg).catch(() => {});
        }

        // Push
        if (customer.userId) {
            sendPushToUser(
                customer.userId,
                isDischarge ? '🎉 Contrato Quitado' : '✅ Pagamento Confirmado',
                isDischarge ? `Parabéns! Contrato quitado! Total: R$ ${Number(receipt.amount).toFixed(2)}` : `Seu pagamento de R$ ${Number(receipt.amount).toFixed(2)} foi confirmado!`
            ).catch(() => {});
        }
    }

    return 'OK';
}
