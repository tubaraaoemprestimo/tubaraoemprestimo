// ============================================================================
// BACKEND - ETAPA 4: LIBERAÇÃO DO EMPRÉSTIMO
// Adicionar ao arquivo: backend/src/routes/loans.ts
// ============================================================================

// ADICIONAR ESTAS ROTAS NO FINAL DO ARQUIVO loans.ts (após a linha 682)

// ============================================================================
// POST /api/loans/:requestId/release — Liberar empréstimo aprovado
// ============================================================================

loansRouter.post('/:requestId/release', requireAdmin, async (req: Request, res: Response) => {
    try {
        const { requestId } = req.params;
        const {
            releasedAmount,
            releaseMethod,
            pixReceiptUrl,
            releaseNotes
        } = req.body;

        // ===== VALIDAÇÕES OBRIGATÓRIAS =====
        if (!releasedAmount || releasedAmount <= 0) {
            return res.status(400).json({ error: 'Valor liberado é obrigatório e deve ser maior que zero.' });
        }

        if (!releaseMethod) {
            return res.status(400).json({ error: 'Método de liberação é obrigatório (PIX, TED, DINHEIRO).' });
        }

        // ⚠️ VALIDAÇÃO CRÍTICA: Comprovante de PIX é OBRIGATÓRIO
        if (!pixReceiptUrl || pixReceiptUrl.trim() === '') {
            return res.status(400).json({
                error: '⚠️ COMPROVANTE DE PIX É OBRIGATÓRIO! Você deve anexar o comprovante de transferência antes de liberar o empréstimo.'
            });
        }

        // Buscar solicitação aprovada
        const request = await prisma.loanRequest.findUnique({
            where: { id: requestId },
            include: { customer: true }
        });

        if (!request) {
            return res.status(404).json({ error: 'Solicitação não encontrada.' });
        }

        if (request.status !== 'APPROVED') {
            return res.status(400).json({ error: 'Solicitação não está aprovada. Status atual: ' + request.status });
        }

        // Verificar se já existe um empréstimo ativo para esta solicitação
        const existingLoan = await prisma.loan.findUnique({
            where: { requestId }
        });

        if (existingLoan) {
            return res.status(400).json({ error: 'Já existe um empréstimo ativo para esta solicitação.' });
        }

        // Validar que os parâmetros de cobrança foram definidos na aprovação
        if (!request.chargeType || !request.chargePeriod || request.interestRate === null || !request.totalDebtAmount || !request.firstPaymentDate) {
            return res.status(400).json({
                error: 'Parâmetros de cobrança não foram definidos na aprovação. Por favor, aprove novamente a solicitação com todos os dados.'
            });
        }

        const principal = parseFloat(request.approvedAmount?.toString() || '0');
        const totalDebt = parseFloat(request.totalDebtAmount?.toString() || '0');
        const installmentValue = parseFloat(request.installmentAmount?.toString() || '0');
        const period = parseInt(request.chargePeriod?.toString() || '1');

        // ===== CRIAR EMPRÉSTIMO ATIVO =====
        const loan = await prisma.loan.create({
            data: {
                customerId: request.customerId!,
                requestId: request.id,

                // Valores
                amount: principal,
                principalAmount: principal,
                totalDebtAmount: totalDebt,
                remainingAmount: totalDebt,
                paidAmount: 0,

                // Parcelas
                installmentsCount: period,
                totalInstallments: period,
                paidInstallments: 0,
                overdueInstallments: 0,
                dailyInstallmentAmount: request.chargeType === 'DAILY' ? installmentValue : null,

                // Tipo de cobrança
                chargeType: request.chargeType,
                chargePeriod: period,
                interestRate: request.interestRate,
                paymentFrequency: request.chargeType === 'DAILY' ? 'DAILY' : request.chargeType === 'WEEKLY' ? 'WEEKLY' : 'MONTHLY',
                dueDay: request.preferredDueDay || new Date(request.firstPaymentDate).getDate(),

                // Datas
                startDate: new Date(),
                firstPaymentDate: new Date(request.firstPaymentDate),
                nextPaymentDate: new Date(request.firstPaymentDate),

                // Liberação
                releasedAmount: parseFloat(releasedAmount.toString()),
                releasedAt: new Date(),
                releaseMethod,
                pixReceiptUrl, // ⚠️ CAMPO CRÍTICO - Comprovante de PIX
                releaseNotes,
                releasedById: req.user!.id,

                // Status
                status: 'ACTIVE',
                isDefaulting: false,
                daysOverdue: 0,

                // Flags
                isLoan: true,
                isService: false,
                isInvestment: false
            }
        });

        // ===== GERAR PARCELAS/DIÁRIAS =====
        const installments = [];
        let currentDate = new Date(request.firstPaymentDate);
        let remainingDebt = totalDebt;

        for (let i = 1; i <= period; i++) {
            const isLastInstallment = i === period;

            // Calcular valor da parcela (última parcela ajusta diferença de arredondamento)
            let installmentAmount = installmentValue;
            if (isLastInstallment) {
                installmentAmount = remainingDebt;
            }

            // Calcular quanto é principal e quanto é juros
            const principalPortion = principal / period;
            const interestPortion = installmentAmount - principalPortion;

            remainingDebt -= installmentAmount;

            installments.push({
                loanId: loan.id,
                installmentNumber: i,
                amount: Math.round(installmentAmount * 100) / 100,
                principalAmount: Math.round(principalPortion * 100) / 100,
                interestAmount: Math.round(interestPortion * 100) / 100,
                remainingAmount: Math.max(0, Math.round(remainingDebt * 100) / 100),
                dueDate: new Date(currentDate),
                status: 'OPEN',
                daysOverdue: 0,
                paidAmount: 0
            });

            // Avançar data para próxima parcela
            if (request.chargeType === 'DAILY') {
                currentDate.setDate(currentDate.getDate() + 1);
            } else if (request.chargeType === 'WEEKLY') {
                currentDate.setDate(currentDate.getDate() + 7);
            } else if (request.chargeType === 'MONTHLY') {
                currentDate.setMonth(currentDate.getMonth() + 1);
            } else if (request.chargeType === 'CUSTOM') {
                // Para custom, dividir o período total igualmente
                const daysPerInstallment = Math.floor(period / period);
                currentDate.setDate(currentDate.getDate() + daysPerInstallment);
            }
        }

        // Criar todas as parcelas no banco
        await prisma.installment.createMany({
            data: installments
        });

        // ===== ATUALIZAR SOLICITAÇÃO =====
        await prisma.loanRequest.update({
            where: { id: requestId },
            data: {
                status: 'ACTIVE' // Muda de APPROVED para ACTIVE
            }
        });

        // ===== ATUALIZAR CLIENTE =====
        if (request.customerId) {
            await prisma.customer.update({
                where: { id: request.customerId },
                data: {
                    status: 'ACTIVE',
                    activeLoansCount: { increment: 1 },
                    totalDebt: { increment: totalDebt }
                }
            });
        }

        // ===== NOTIFICAR CLIENTE =====
        if (request.customer) {
            const { emailService } = require('../services/email');
            const emailBody = `
                <h2 style="color: #4CAF50;">💰 Empréstimo Liberado!</h2>
                <p>Olá <strong>${request.clientName}</strong>,</p>
                <p>Seu empréstimo foi <strong>liberado</strong> e o valor já está disponível!</p>

                <div style="background: #1a1a1a; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="color: #D4AF37; margin-top: 0;">💸 Detalhes da Liberação</h3>
                    <p><strong>Valor Liberado:</strong> R$ ${parseFloat(releasedAmount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    <p><strong>Método:</strong> ${releaseMethod}</p>
                    <p><strong>Data da Liberação:</strong> ${new Date().toLocaleString('pt-BR')}</p>
                </div>

                <div style="background: #1a1a1a; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="color: #D4AF37; margin-top: 0;">📋 Resumo do Contrato</h3>
                    <p><strong>Valor Total a Pagar:</strong> R$ ${totalDebt.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    <p><strong>Quantidade de ${request.chargeType === 'MONTHLY' ? 'Parcelas' : 'Diárias'}:</strong> ${period}x</p>
                    <p><strong>Valor de Cada ${request.chargeType === 'MONTHLY' ? 'Parcela' : 'Diária'}:</strong> R$ ${installmentValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    <p><strong>Primeiro Vencimento:</strong> ${new Date(request.firstPaymentDate).toLocaleDateString('pt-BR')}</p>
                </div>

                <div style="background: #ff9800; color: #000; padding: 15px; border-radius: 8px; margin: 20px 0;">
                    <p style="margin: 0; font-weight: bold;">⚠️ IMPORTANTE: Mantenha seus pagamentos em dia para evitar juros e multas!</p>
                </div>

                <p><strong>Comprovante de Transferência:</strong></p>
                <p><a href="${pixReceiptUrl}" style="color: #D4AF37; text-decoration: underline;">Clique aqui para ver o comprovante</a></p>
            `;

            try {
                await emailService.sendEmail(
                    request.email,
                    '💰 Empréstimo Liberado - Tubarão Empréstimos',
                    emailBody
                );
            } catch (emailError) {
                console.error('[Release] Email error:', emailError);
            }
        }

        // ===== LOG DE AUDITORIA =====
        await prisma.auditLog.create({
            data: {
                userId: req.user!.id,
                userName: req.user!.name,
                action: 'RELEASE_LOAN',
                entity: 'Loan',
                entityId: loan.id,
                details: `Liberado: R$ ${releasedAmount} | Método: ${releaseMethod} | Total: R$ ${totalDebt} | Parcelas: ${period}x`,
                ipAddress: req.ip
            }
        });

        res.json({
            success: true,
            message: 'Empréstimo liberado com sucesso!',
            data: {
                loanId: loan.id,
                requestId: request.id,
                releasedAmount: parseFloat(releasedAmount),
                totalDebtAmount: totalDebt,
                installmentsCount: period,
                firstPaymentDate: new Date(request.firstPaymentDate),
                status: 'ACTIVE',
                pixReceiptUrl
            }
        });

    } catch (error: any) {
        console.error('[Release Loan] Error:', error);
        res.status(500).json({ error: 'Erro ao liberar empréstimo: ' + error.message });
    }
});

// ============================================================================
// GET /api/loans/active — Listar empréstimos ativos (admin)
// ============================================================================

loansRouter.get('/active', requireAdmin, async (req: Request, res: Response) => {
    try {
        const { status, customerId } = req.query;

        const where: any = {};
        if (status) where.status = status;
        if (customerId) where.customerId = customerId;

        const loans = await prisma.loan.findMany({
            where,
            include: {
                customer: {
                    select: {
                        id: true,
                        name: true,
                        cpf: true,
                        phone: true,
                        email: true,
                        isDefaulting: true,
                        daysOverdue: true
                    }
                },
                loanRequest: {
                    select: {
                        id: true,
                        profileType: true,
                        createdAt: true
                    }
                },
                installments: {
                    orderBy: { installmentNumber: 'asc' }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        res.json(loans);
    } catch (error: any) {
        console.error('[Get Active Loans] Error:', error);
        res.status(500).json({ error: 'Erro ao buscar empréstimos: ' + error.message });
    }
});

// ============================================================================
// GET /api/loans/:id/details — Detalhes completos de um empréstimo
// ============================================================================

loansRouter.get('/:id/details', requireAdmin, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const loan = await prisma.loan.findUnique({
            where: { id },
            include: {
                customer: true,
                loanRequest: true,
                installments: {
                    orderBy: { installmentNumber: 'asc' }
                },
                payments: {
                    orderBy: { paymentDate: 'desc' },
                    include: {
                        registeredBy: {
                            select: {
                                id: true,
                                name: true,
                                email: true
                            }
                        }
                    }
                },
                agreements: {
                    orderBy: { createdAt: 'desc' },
                    include: {
                        createdBy: {
                            select: {
                                id: true,
                                name: true,
                                email: true
                            }
                        }
                    }
                },
                collectionHistory: {
                    orderBy: { contactDate: 'desc' },
                    include: {
                        collector: {
                            select: {
                                id: true,
                                name: true,
                                email: true
                            }
                        }
                    }
                },
                releasedBy: {
                    select: {
                        id: true,
                        name: true,
                        email: true
                    }
                }
            }
        });

        if (!loan) {
            return res.status(404).json({ error: 'Empréstimo não encontrado.' });
        }

        res.json(loan);
    } catch (error: any) {
        console.error('[Get Loan Details] Error:', error);
        res.status(500).json({ error: 'Erro ao buscar empréstimo: ' + error.message });
    }
});
