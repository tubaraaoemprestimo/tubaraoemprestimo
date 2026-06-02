import { Router, Request, Response } from 'express';
import { prisma } from '../services/prisma';
import { authenticate, requireAdmin } from '../middleware/auth';
import { getLoanPayoffBalance } from '../services/loanPayoffService';

export const financeRouter = Router();
financeRouter.use(authenticate);

// ============ HELPERS - Payment Receipts (JSON in SystemSetting) ============

const RECEIPTS_KEY = 'payment_receipts_data';

interface ReceiptRow {
    id: string;
    installment_id: string;
    loan_id: string;
    customer_id: string;
    customer_name: string;
    amount: number;
    receipt_url: string;
    receipt_type: string;
    status: string;
    submitted_at: string;
    reviewed_at: string | null;
    reviewed_by: string | null;
    rejection_reason: string | null;
}

async function loadReceipts(): Promise<ReceiptRow[]> {
    const row = await prisma.systemSetting.findUnique({ where: { key: RECEIPTS_KEY } });
    if (!row?.value) return [];
    try {
        const parsed = JSON.parse(row.value);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

async function saveReceipts(data: ReceiptRow[]): Promise<void> {
    await prisma.systemSetting.upsert({
        where: { key: RECEIPTS_KEY },
        update: { value: JSON.stringify(data) },
        create: { key: RECEIPTS_KEY, value: JSON.stringify(data) }
    });
}

// ============ DASHBOARD ============

// GET /api/finance/dashboard - Resumo Financeiro
financeRouter.get('/dashboard', requireAdmin, async (_req: Request, res: Response) => {
    try {
        const totalLoans = await prisma.loan.count();
        const totalAmount = await prisma.loan.aggregate({
            _sum: { amount: true }
        });
        const totalPaid = await prisma.installment.aggregate({
            where: { status: 'PAID' },
            _sum: { amount: true }
        });
        const pendingAmount = (totalAmount._sum.amount || 0) - (totalPaid._sum.amount || 0);

        res.json({
            loans: totalLoans,
            amountInvested: totalAmount._sum.amount || 0,
            amountPaid: totalPaid._sum.amount || 0,
            amountPending: pendingAmount
        });
    } catch {
        res.status(500).json({ error: 'Erro ao buscar dados dashboard' });
    }
});

// ============ TRANSACTIONS ============

// GET /api/finance/transactions - Listar transações
financeRouter.get('/transactions', requireAdmin, async (_req: Request, res: Response) => {
    try {
        const transactions = await prisma.transaction.findMany({
            orderBy: { date: 'desc' },
            take: 50
        });
        res.json(transactions);
    } catch {
        res.status(500).json({ error: 'Erro ao buscar transações' });
    }
});

// POST /api/finance/transactions - Criar transação manual
financeRouter.post('/transactions', requireAdmin, async (req: Request, res: Response) => {
    try {
        const { type, description, amount, category, date } = req.body;

        await prisma.transaction.create({
            data: {
                type,
                description,
                amount: parseFloat(amount),
                category,
                date: new Date(date)
            }
        });
        res.json({ success: true });
    } catch {
        res.status(500).json({ error: 'Erro ao criar transação' });
    }
});

// ============ INTERACTIONS ============

// GET /api/finance/interactions - Logs de interação (audit + messages)
financeRouter.get('/interactions', requireAdmin, async (_req: Request, res: Response) => {
    try {
        const logs = await prisma.auditLog.findMany({
            orderBy: { timestamp: 'desc' },
            take: 100
        });
        res.json(logs);
    } catch {
        res.status(500).json({ error: 'Erro ao buscar interações' });
    }
});

// ============ PAYMENT RECEIPTS ============

// GET /api/finance/receipts - Listar comprovantes
financeRouter.get('/receipts', requireAdmin, async (req: Request, res: Response) => {
    try {
        let data = await loadReceipts();
        const status = String(req.query.status || '').toUpperCase();
        if (status && status !== 'ALL') {
            data = data.filter(r => r.status === status);
        }
        // Sort by submitted_at desc
        data.sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime());
        res.json(data);
    } catch {
        res.status(500).json({ error: 'Erro ao buscar comprovantes' });
    }
});

// POST /api/finance/receipts - Criar comprovante (client submits)
financeRouter.post('/receipts', async (req: Request, res: Response) => {
    try {
        const body = req.body || {};
        const data = await loadReceipts();

        const row: ReceiptRow = {
            id: body.id || crypto.randomUUID(),
            installment_id: String(body.installment_id || body.installmentId || ''),
            loan_id: String(body.loan_id || body.loanId || ''),
            customer_id: String(body.customer_id || body.customerId || req.user?.id || ''),
            customer_name: String(body.customer_name || body.customerName || ''),
            amount: Number(body.amount || 0),
            receipt_url: String(body.receipt_url || body.receiptUrl || ''),
            receipt_type: String(body.receipt_type || body.receiptType || 'PIX'),
            status: 'PENDING',
            submitted_at: new Date().toISOString(),
            reviewed_at: null,
            reviewed_by: null,
            rejection_reason: null
        };

        data.unshift(row);
        await saveReceipts(data);
        res.status(201).json(row);
    } catch {
        res.status(500).json({ error: 'Erro ao criar comprovante' });
    }
});

// PUT /api/finance/receipts/:id/approve - Aprovar comprovante
financeRouter.put('/receipts/:id/approve', requireAdmin, async (req: Request, res: Response) => {
    try {
        const id = String(req.params.id);
        const data = await loadReceipts();
        const idx = data.findIndex(r => r.id === id);

        if (idx < 0) {
            res.status(404).json({ error: 'Comprovante não encontrado' });
            return;
        }

        data[idx].status = 'APPROVED';
        data[idx].reviewed_at = new Date().toISOString();
        data[idx].reviewed_by = req.user?.id || 'admin';

        // Mark installment as paid if installment_id exists
        if (data[idx].installment_id) {
            try {
                // Marca a parcela como paga (preserva paidAt e proofUrl)
                const installment = await prisma.installment.update({
                    where: { id: data[idx].installment_id },
                    data: {
                        status: 'PAID',
                        paidAt: new Date(),
                        ...(data[idx].receipt_url ? { proofUrl: data[idx].receipt_url } : {})
                    }
                });

                // ============================================================
                // Resolve o profileType do contrato e aplica a MESMA lógica de
                // rolagem das outras 3 rotas (paymentReceipts.ts /approve,
                // loans.ts /proof e /manual-payment), para não abater o principal
                // em pagamentos de juros de CLT/GARANTIA. A baixa/quitação final
                // permanece sob confirmação do admin (esta rota é o admin aprovando).
                // ============================================================
                const loan = await prisma.loan.findUnique({ where: { id: installment.loanId } });

                if (loan) {
                    // Resolve profileType via LoanRequest (consultado como nas outras rotas)
                    let profileType = '';
                    try {
                        const loanRequest = await prisma.loanRequest.findUnique({
                            where: { id: loan.requestId },
                            select: { profileType: true }
                        });
                        profileType = (loanRequest as any)?.profileType || '';
                    } catch { /* profileType indeterminado -> tratado como falha-segura abaixo */ }

                    const { isInterestOnly } = req.body || {};
                    const isRollover = profileType === 'CLT' || profileType === 'GARANTIA' || profileType === 'GARANTIA_VEICULO';
                    const paidAmount = Number(data[idx].amount) || 0;

                    if (isInterestOnly || isRollover) {
                        // ====================================================
                        // PAGAMENTO DE JUROS (CLT / Garantia) — rolagem NÃO amortiza
                        // remainingAmount permanece integral; gera nova parcela de juros
                        // (espelha paymentReceipts.ts /approve)
                        // ====================================================
                        await prisma.loan.update({
                            where: { id: loan.id },
                            data: { lastPaymentDate: new Date() }
                            // remainingAmount NÃO muda — juros de rolagem não amortiza o principal
                        });

                        // Marca o registro pago como pagamento de juros de rolagem (não é amortização)
                        await prisma.installment.update({
                            where: { id: installment.id },
                            data: { isInterestPayment: true }
                        });

                        // Gera nova parcela de juros para o próximo mês
                        const interestRate = Number(loan.interestRate || 30) / 100; // 30% -> 0.30
                        const nextInterestAmount = Number(loan.principalAmount) * interestRate;
                        const nextDueDate = new Date();
                        nextDueDate.setMonth(nextDueDate.getMonth() + 1);
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
                    } else if (!profileType) {
                        // ====================================================
                        // FALHA-SEGURA (req. 2.13): profileType indeterminado/vazio.
                        // NÃO abater o principal — prefere o caminho seguro de rolagem.
                        // Apenas registra lastPaymentDate; remainingAmount inalterado.
                        // Não assume semântica de rolagem (não marca isInterestPayment
                        // nem gera parcela de juros), pois a modalidade é desconhecida.
                        // ====================================================
                        await prisma.loan.update({
                            where: { id: loan.id },
                            data: { lastPaymentDate: new Date() }
                        });
                    } else {
                        // ====================================================
                        // AMORTIZAÇÃO (AUTONOMO/MOTO) — abate do principal normalmente
                        // Marca COMPLETED quando o saldo zera (comportamento preservado)
                        // ====================================================
                        const newRemaining = Math.max(0, Number(loan.remainingAmount) - paidAmount);
                        await prisma.loan.update({
                            where: { id: loan.id },
                            data: {
                                remainingAmount: newRemaining,
                                lastPaymentDate: new Date(),
                                status: newRemaining <= 0 ? 'COMPLETED' : loan.status
                            }
                        });
                    }
                }
            } catch { /* installment may not exist */ }
        }

        await saveReceipts(data);
        res.json({ success: true, receipt: data[idx] });
    } catch {
        res.status(500).json({ error: 'Erro ao aprovar comprovante' });
    }
});

// PUT /api/finance/receipts/:id/reject - Rejeitar comprovante
financeRouter.put('/receipts/:id/reject', requireAdmin, async (req: Request, res: Response) => {
    try {
        const id = String(req.params.id);
        const { rejection_reason, rejectionReason } = req.body;
        const data = await loadReceipts();
        const idx = data.findIndex(r => r.id === id);

        if (idx < 0) {
            res.status(404).json({ error: 'Comprovante não encontrado' });
            return;
        }

        data[idx].status = 'REJECTED';
        data[idx].reviewed_at = new Date().toISOString();
        data[idx].reviewed_by = req.user?.id || 'admin';
        data[idx].rejection_reason = rejection_reason || rejectionReason || '';

        await saveReceipts(data);
        res.json({ success: true, receipt: data[idx] });
    } catch {
        res.status(500).json({ error: 'Erro ao rejeitar comprovante' });
    }
});

// ============ RISK LOGS ============

// GET /api/finance/risk-logs - Listar logs de risco
financeRouter.get('/risk-logs', requireAdmin, async (req: Request, res: Response) => {
    try {
        const limit = parseInt(String(req.query.limit || '100'));
        const logs = await prisma.riskEvent.findMany({
            orderBy: { createdAt: 'desc' },
            take: limit
        });
        // Map to frontend format
        res.json(logs.map(l => ({
            id: l.id,
            user_id: l.userId,
            session_id: (l.details as any)?.session_id || '',
            ip: l.ipAddress || '',
            user_agent: l.userAgent || '',
            platform: (l.details as any)?.platform || '',
            screen_resolution: (l.details as any)?.screen_resolution || '',
            latitude: l.latitude,
            longitude: l.longitude,
            action: l.eventType,
            risk_score: (l.details as any)?.risk_score || 0,
            risk_factors: (l.details as any)?.risk_factors || [],
            created_at: l.createdAt.toISOString()
        })));
    } catch {
        res.status(500).json({ error: 'Erro ao buscar logs de risco' });
    }
});

// ============ BIOMETRICS ============

// GET /api/finance/biometrics - Listar contagem de biometrias por user
financeRouter.get('/biometrics', requireAdmin, async (_req: Request, res: Response) => {
    try {
        const creds = await prisma.webauthnCredential.findMany({
            select: { userId: true }
        });
        const countMap: Record<string, number> = {};
        creds.forEach(c => {
            countMap[c.userId] = (countMap[c.userId] || 0) + 1;
        });
        res.json(countMap);
    } catch {
        res.status(500).json({ error: 'Erro ao buscar biometrias' });
    }
});

// DELETE /api/finance/biometrics/:userId - Resetar biometria de um user
financeRouter.delete('/biometrics/:userId', requireAdmin, async (req: Request, res: Response) => {
    try {
        const userId = String(req.params.userId);
        await prisma.webauthnCredential.deleteMany({ where: { userId } });

        // Log the action
        await prisma.riskEvent.create({
            data: {
                userId,
                eventType: 'BIOMETRIC_ADMIN_RESET',
                riskLevel: 'LOW',
                details: { source: 'SECURITY_HUB', resetBy: req.user?.id },
                ipAddress: 'admin-panel'
            }
        });

        res.json({ success: true });
    } catch {
        res.status(500).json({ error: 'Erro ao resetar biometria' });
    }
});

// ============ CUSTOMERS MAP (emails for SecurityHub) ============

// GET /api/finance/customers-map - Mapa de emails de customers
financeRouter.get('/customers-map', requireAdmin, async (_req: Request, res: Response) => {
    try {
        const customers = await prisma.customer.findMany({ select: { email: true } });
        const map: Record<string, boolean> = {};
        customers.forEach(c => {
            const email = (c.email || '').toLowerCase();
            if (email) map[email] = true;
        });
        res.json(map);
    } catch {
        res.status(500).json({ error: 'Erro ao buscar mapa de clientes' });
    }
});

// GET /api/finance/requests-map - Mapa de contagem de requests por email
financeRouter.get('/requests-map', requireAdmin, async (_req: Request, res: Response) => {
    try {
        const requests = await prisma.loanRequest.findMany({ select: { email: true } });
        const map: Record<string, number> = {};
        requests.forEach(r => {
            const email = (r.email || '').toLowerCase();
            if (email) map[email] = (map[email] || 0) + 1;
        });
        res.json(map);
    } catch {
        res.status(500).json({ error: 'Erro ao buscar mapa de requests' });
    }
});

// GET /api/finance/today-summary - Guia operacional: quem cobrar hoje
financeRouter.get('/today-summary', requireAdmin, async (_req: Request, res: Response) => {
    try {
        const today = new Date();
        const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0);
        const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);

        const transactionsToday = await prisma.transaction.findMany({
            where: {
                type: 'IN',
                category: 'PAYMENT',
                date: { gte: startOfDay, lte: endOfDay }
            }
        });

        const paidTodayLoanIds = new Set<string>();
        for (const t of transactionsToday) {
            const match = String(t.description || '').match(/contrato:([a-zA-Z0-9-]+)/);
            if (match?.[1]) paidTodayLoanIds.add(match[1]);
        }

        const activeLoans = await prisma.loan.findMany({
            where: {
                status: { in: ['ACTIVE', 'DEFAULT', 'APPROVED'] },
                remainingAmount: { gt: 0 }
            },
            include: {
                customer: true,
                loanRequest: { select: { profileType: true } },
                installments: {
                    where: { status: { in: ['OPEN', 'LATE', 'AWAITING_CONFIRMATION'] } },
                    orderBy: { dueDate: 'asc' }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        const collectionsDueToday: any[] = [];
        const overdueCollections: any[] = [];

        for (const loan of activeLoans) {
            if (paidTodayLoanIds.has(loan.id)) continue;

            const profileType = loan.loanRequest?.profileType || '';
            const isDaily = profileType === 'AUTONOMO' || loan.paymentFrequency === 'DAILY';
            const isMonthly = ['CLT', 'GARANTIA', 'GARANTIA_VEICULO', 'LIMPA_NOME'].includes(profileType) || loan.paymentFrequency === 'MONTHLY';
            const balance = await getLoanPayoffBalance(loan.id);
            if (!isDaily && balance.cycleChargeBalance <= 0) continue;

            const nextDue = loan.nextPaymentDate
                ? new Date(loan.nextPaymentDate)
                : loan.installments[0]?.dueDate
                    ? new Date(loan.installments[0].dueDate)
                    : null;
            if (nextDue) nextDue.setHours(0, 0, 0, 0);

            const dailyChargeBalance = Number(loan.installments[0]?.amount || loan.dailyInstallmentAmount || 0) + Number(loan.installments[0]?.lateFeeAmount || 0);
            const currentCycleChargeBalance = isDaily ? dailyChargeBalance : balance.cycleChargeBalance;
            if (isDaily && currentCycleChargeBalance <= 0) continue;

            const base = {
                loanId: loan.id,
                amount: loan.amount,
                remainingAmount: loan.remainingAmount,
                cycleChargeBalance: currentCycleChargeBalance,
                totalPayoffBalance: balance.totalPayoffBalance,
                principalBalance: balance.principalBalance,
                interestBalance: balance.interestBalance,
                feeBalance: balance.feeBalance,
                profileType,
                paymentFrequency: loan.paymentFrequency,
                customer: loan.customer ? { id: loan.customer.id, name: loan.customer.name, phone: loan.customer.phone } : null,
                nextInstallment: loan.installments[0] || null,
            };

            if (isDaily) {
                collectionsDueToday.push({ ...base, reason: 'DAILY_COLLECTION', label: 'Cobrança diária pendente', daysOverdue: 0 });
                continue;
            }

            if (isMonthly && nextDue && startOfDay >= nextDue) {
                const daysOverdue = Math.max(0, Math.floor((startOfDay.getTime() - nextDue.getTime()) / (1000 * 60 * 60 * 24)));
                const item = {
                    ...base,
                    reason: daysOverdue === 0 ? 'MONTHLY_DUE_TODAY' : 'MONTHLY_OVERDUE',
                    label: daysOverdue === 0 ? 'Vence hoje' : 'Em atraso',
                    daysOverdue,
                };
                if (daysOverdue === 0) collectionsDueToday.push(item);
                else overdueCollections.push(item);
            }
        }

        const paymentsReceivedToday = transactionsToday.reduce((sum, t) => sum + Number(t.amount || 0), 0);
        const totalDueToday = collectionsDueToday.reduce((sum, i) => sum + Number(i.cycleChargeBalance || 0), 0);

        res.json({
            totalDueToday,
            installmentsDueCount: collectionsDueToday.length,
            installmentsDueToday: collectionsDueToday,
            loansInDefaultCount: overdueCollections.length,
            loansInDefault: overdueCollections,
            paymentsReceivedToday,
            paymentsReceivedCount: transactionsToday.length
        });
    } catch (err) {
        console.error('[Finance] today-summary error:', err);
        res.status(500).json({ error: 'Erro ao buscar resumo do dia' });
    }
});
