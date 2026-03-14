// ============================================================================
// BACKEND - ETAPA 2: APROVAÇÃO COM CONTRAPROPOSTA
// Arquivo: backend/src/routes/loanRequests.ts
// ============================================================================

// ADICIONAR ESTA ROTA após a rota POST /api/loan-requests

// PUT /api/loan-requests/:id/approve — Aprovar solicitação com contraproposta
loanRequestsRouter.put('/:id/approve', requireAdmin, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const {
            approvedAmount,
            chargeType,
            chargePeriod,
            interestRate,
            firstPaymentDate,
            adminNotes
        } = req.body;

        // ===== VALIDAÇÕES OBRIGATÓRIAS =====
        if (!approvedAmount || approvedAmount <= 0) {
            return res.status(400).json({ error: 'Valor aprovado é obrigatório e deve ser maior que zero.' });
        }

        if (!chargeType) {
            return res.status(400).json({ error: 'Tipo de cobrança é obrigatório (DAILY, WEEKLY, MONTHLY, CUSTOM).' });
        }

        if (!chargePeriod || chargePeriod <= 0) {
            return res.status(400).json({ error: 'Período de cobrança é obrigatório (quantidade de dias/parcelas).' });
        }

        if (!interestRate || interestRate < 0) {
            return res.status(400).json({ error: 'Taxa de juros é obrigatória (pode ser 0 para sem juros).' });
        }

        if (!firstPaymentDate) {
            return res.status(400).json({ error: 'Data do primeiro pagamento é obrigatória.' });
        }

        // Buscar solicitação
        const request = await prisma.loanRequest.findUnique({
            where: { id },
            include: { customer: true }
        });

        if (!request) {
            return res.status(404).json({ error: 'Solicitação não encontrada.' });
        }

        if (request.status !== 'PENDING' && request.status !== 'WAITING_DOCS') {
            return res.status(400).json({ error: 'Solicitação não está pendente de aprovação.' });
        }

        // ===== CÁLCULO AUTOMÁTICO DOS VALORES =====
        const principal = parseFloat(approvedAmount.toString());
        const rate = parseFloat(interestRate.toString());
        const period = parseInt(chargePeriod.toString());

        // Calcular valor total da dívida (principal + juros)
        let totalDebtAmount = principal;
        let installmentAmount = 0;

        if (chargeType === 'DAILY') {
            // Juros simples: cada dia adiciona X%
            // Exemplo: R$1000 com 7% ao dia por 20 dias = R$1000 + (R$1000 * 0.07 * 20) = R$2400
            const totalInterest = principal * (rate / 100) * period;
            totalDebtAmount = principal + totalInterest;
            installmentAmount = totalDebtAmount / period; // Valor de cada diária
        } else if (chargeType === 'WEEKLY') {
            // Juros simples semanal
            const totalInterest = principal * (rate / 100) * period;
            totalDebtAmount = principal + totalInterest;
            installmentAmount = totalDebtAmount / period;
        } else if (chargeType === 'MONTHLY') {
            // Juros compostos mensais (mais comum para parcelas)
            // Fórmula: M = P * (1 + i)^n
            totalDebtAmount = principal * Math.pow(1 + (rate / 100), period);
            installmentAmount = totalDebtAmount / period;
        } else if (chargeType === 'CUSTOM') {
            // Prazo personalizado - juros simples
            const totalInterest = principal * (rate / 100) * period;
            totalDebtAmount = principal + totalInterest;
            installmentAmount = totalDebtAmount / period;
        }

        // Arredondar para 2 casas decimais
        totalDebtAmount = Math.round(totalDebtAmount * 100) / 100;
        installmentAmount = Math.round(installmentAmount * 100) / 100;

        // ===== ATUALIZAR SOLICITAÇÃO =====
        const updatedRequest = await prisma.loanRequest.update({
            where: { id },
            data: {
                approvedAmount: principal,
                approvedAt: new Date(),
                approvedById: req.user!.id,
                status: 'APPROVED', // Muda para APPROVED (aguardando liberação)

                // Parâmetros de cobrança
                chargeType,
                chargePeriod: period,
                interestRate: rate,
                totalDebtAmount,
                installmentAmount,
                firstPaymentDate: new Date(firstPaymentDate),

                // Observações do admin
                supplementalDescription: adminNotes || request.supplementalDescription
            }
        });

        // ===== NOTIFICAR CLIENTE =====
        if (request.customer) {
            // Email
            const emailBody = `
                <h2 style="color: #4CAF50;">✅ Empréstimo Aprovado!</h2>
                <p>Olá <strong>${request.clientName}</strong>,</p>
                <p>Temos uma ótima notícia! Seu empréstimo foi <strong>aprovado</strong>.</p>

                <div style="background: #1a1a1a; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="color: #D4AF37; margin-top: 0;">📋 Detalhes da Aprovação</h3>
                    <p><strong>Valor Aprovado:</strong> R$ ${principal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    <p><strong>Valor Total a Pagar:</strong> R$ ${totalDebtAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    <p><strong>Tipo de Cobrança:</strong> ${chargeType === 'DAILY' ? 'Diária' : chargeType === 'WEEKLY' ? 'Semanal' : chargeType === 'MONTHLY' ? 'Mensal' : 'Personalizado'}</p>
                    <p><strong>Quantidade de ${chargeType === 'MONTHLY' ? 'Parcelas' : 'Diárias'}:</strong> ${period}x</p>
                    <p><strong>Valor de Cada ${chargeType === 'MONTHLY' ? 'Parcela' : 'Diária'}:</strong> R$ ${installmentAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    <p><strong>Taxa de Juros:</strong> ${rate}% ${chargeType === 'DAILY' ? 'ao dia' : chargeType === 'MONTHLY' ? 'ao mês' : ''}</p>
                    <p><strong>Primeiro Pagamento:</strong> ${new Date(firstPaymentDate).toLocaleDateString('pt-BR')}</p>
                </div>

                <p><strong>Próximos Passos:</strong></p>
                <ol>
                    <li>Aguarde a liberação do valor na sua conta</li>
                    <li>Você receberá o comprovante de transferência</li>
                    <li>O contrato será ativado automaticamente</li>
                </ol>

                <p style="color: #ff9800; font-weight: bold;">⚠️ Importante: O valor será liberado em até 24 horas úteis.</p>
            `;

            try {
                await emailService.sendEmail(
                    request.email,
                    '✅ Empréstimo Aprovado - Tubarão Empréstimos',
                    brandedEmailHtml(emailBody)
                );
            } catch (emailError) {
                console.error('[Approve] Email error:', emailError);
            }

            // WhatsApp
            const whatsappMessage = `🦈 *TUBARÃO EMPRÉSTIMOS*\n\n✅ *EMPRÉSTIMO APROVADO!*\n\nOlá *${request.clientName}*!\n\nSeu empréstimo foi aprovado:\n\n💰 *Valor Aprovado:* R$ ${principal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n📊 *Valor Total:* R$ ${totalDebtAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n📅 *${period}x de R$ ${installmentAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}*\n🗓️ *Primeiro Pagamento:* ${new Date(firstPaymentDate).toLocaleDateString('pt-BR')}\n\n⏳ O valor será liberado em até 24h úteis.\n\nEm breve você receberá o comprovante! 🎉`;

            try {
                await sendWhatsAppNotification(request.phone, whatsappMessage);
            } catch (whatsappError) {
                console.error('[Approve] WhatsApp error:', whatsappError);
            }
        }

        // ===== LOG DE AUDITORIA =====
        await prisma.auditLog.create({
            data: {
                userId: req.user!.id,
                userName: req.user!.name,
                action: 'APPROVE_LOAN',
                entity: 'LoanRequest',
                entityId: id,
                details: `Aprovado: R$ ${principal} | Tipo: ${chargeType} | Período: ${period} | Juros: ${rate}% | Total: R$ ${totalDebtAmount}`,
                ipAddress: req.ip
            }
        });

        res.json({
            success: true,
            message: 'Empréstimo aprovado com sucesso!',
            data: {
                id: updatedRequest.id,
                approvedAmount: principal,
                totalDebtAmount,
                installmentAmount,
                chargeType,
                chargePeriod: period,
                interestRate: rate,
                firstPaymentDate: new Date(firstPaymentDate),
                status: 'APPROVED'
            }
        });

    } catch (error: any) {
        console.error('[Approve Loan] Error:', error);
        res.status(500).json({ error: 'Erro ao aprovar empréstimo: ' + error.message });
    }
});

// PUT /api/loan-requests/:id/reject — Reprovar solicitação
loanRequestsRouter.put('/:id/reject', requireAdmin, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;

        if (!reason) {
            return res.status(400).json({ error: 'Motivo da reprovação é obrigatório.' });
        }

        const request = await prisma.loanRequest.findUnique({
            where: { id },
            include: { customer: true }
        });

        if (!request) {
            return res.status(404).json({ error: 'Solicitação não encontrada.' });
        }

        // Atualizar status
        await prisma.loanRequest.update({
            where: { id },
            data: {
                status: 'REJECTED',
                supplementalDescription: reason
            }
        });

        // Notificar cliente
        if (request.customer) {
            const emailBody = `
                <h2 style="color: #f44336;">❌ Empréstimo Não Aprovado</h2>
                <p>Olá <strong>${request.clientName}</strong>,</p>
                <p>Infelizmente, não foi possível aprovar seu empréstimo no momento.</p>

                <div style="background: #1a1a1a; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <p><strong>Motivo:</strong> ${reason}</p>
                </div>

                <p>Você pode fazer uma nova solicitação a qualquer momento.</p>
                <p>Nossa equipe está à disposição para esclarecer dúvidas.</p>
            `;

            try {
                await emailService.sendEmail(
                    request.email,
                    '❌ Solicitação de Empréstimo - Tubarão Empréstimos',
                    brandedEmailHtml(emailBody)
                );
            } catch (e) {
                console.error('[Reject] Email error:', e);
            }
        }

        // Log de auditoria
        await prisma.auditLog.create({
            data: {
                userId: req.user!.id,
                userName: req.user!.name,
                action: 'REJECT_LOAN',
                entity: 'LoanRequest',
                entityId: id,
                details: `Motivo: ${reason}`,
                ipAddress: req.ip
            }
        });

        res.json({ success: true, message: 'Solicitação reprovada.' });

    } catch (error: any) {
        console.error('[Reject Loan] Error:', error);
        res.status(500).json({ error: 'Erro ao reprovar empréstimo: ' + error.message });
    }
});
