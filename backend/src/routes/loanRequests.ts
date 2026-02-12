import { Router, Request, Response } from 'express';
import { prisma } from '../services/prisma';
import { authenticate, requireAdmin } from '../middleware/auth';

export const loanRequestsRouter = Router();
loanRequestsRouter.use(authenticate);

// GET /api/loan-requests — Listar solicitações (admin: todas, client: só as dele)
loanRequestsRouter.get('/', async (req: Request, res: Response) => {
    try {
        const where = req.user!.role === 'ADMIN' ? {} : { userId: req.user!.id };
        const requests = await prisma.loanRequest.findMany({
            where,
            orderBy: { createdAt: 'desc' }
        });
        res.json(requests);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar solicitações' });
    }
});

// GET /api/loan-requests/pending — Solicitação pendente do cliente
loanRequestsRouter.get('/pending', async (req: Request, res: Response) => {
    try {
        const request = await prisma.loanRequest.findFirst({
            where: {
                userId: req.user!.id,
                status: { in: ['PENDING', 'WAITING_DOCS'] }
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json(request);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar solicitação pendente' });
    }
});

// GET /api/loan-requests/latest — Última solicitação (qualquer status)
loanRequestsRouter.get('/latest', async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;
        const request = await prisma.loanRequest.findFirst({
            where: { userId },
            orderBy: { createdAt: 'desc' }
        });
        res.json(request);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar última solicitação' });
    }
});

// POST /api/loan-requests — Nova solicitação
loanRequestsRouter.post('/', async (req: Request, res: Response) => {
    try {
        const data = req.body;

        // Busca ou cria customer
        let customer = await prisma.customer.findFirst({
            where: { OR: [{ cpf: data.cpf }, { email: req.user!.email }] }
        });

        if (!customer) {
            customer = await prisma.customer.create({
                data: {
                    userId: req.user!.id,
                    name: data.clientName || req.user!.name,
                    cpf: data.cpf,
                    email: req.user!.email,
                    phone: data.phone,
                    address: data.address,
                    neighborhood: data.neighborhood,
                    city: data.city,
                    state: data.state,
                    zipCode: data.zipCode,
                    monthlyIncome: data.monthlyIncome,
                    birthDate: data.birthDate,
                    instagram: data.instagram,
                    status: 'ACTIVE'
                }
            });
        } else {
            // Atualiza dados do customer
            await prisma.customer.update({
                where: { id: customer.id },
                data: {
                    userId: req.user!.id,
                    name: data.clientName || req.user!.name,
                    phone: data.phone,
                    address: data.address,
                    neighborhood: data.neighborhood,
                    city: data.city,
                    state: data.state,
                    zipCode: data.zipCode,
                    monthlyIncome: data.monthlyIncome
                }
            });
        }

        // Cria solicitação
        const request = await prisma.loanRequest.create({
            data: {
                customerId: customer.id,
                userId: req.user!.id,
                clientName: data.clientName || req.user!.name,
                cpf: data.cpf,
                email: req.user!.email,
                phone: data.phone,
                amount: data.amount || 0,
                installments: data.installments || 1,
                profileType: data.profileType,
                fatherPhone: data.fatherPhone,
                motherPhone: data.motherPhone,
                spousePhone: data.spousePhone,
                address: data.address,
                neighborhood: data.neighborhood,
                city: data.city,
                state: data.state,
                zipCode: data.zipCode,
                birthDate: data.birthDate,
                preferredDueDay: data.preferredDueDay,
                instagram: data.instagram,
                monthlyIncome: data.monthlyIncome,
                // Documentos
                selfieUrl: data.selfieUrl,
                idCardUrl: data.idCardUrl,
                idCardBackUrl: data.idCardBackUrl,
                proofOfAddressUrl: data.proofOfAddressUrl,
                proofIncomeUrl: data.proofIncomeUrl,
                vehicleUrl: data.vehicleUrl,
                videoSelfieUrl: data.videoSelfieUrl,
                videoHouseUrl: data.videoHouseUrl,
                videoVehicleUrl: data.videoVehicleUrl,
                signatureUrl: data.signatureUrl,
                workCardUrl: data.workCardUrl,
                // Banco
                bankName: data.bankName,
                bankAgency: data.bankAgency,
                bankAccount: data.bankAccount,
                bankAccountType: data.bankAccountType,
                pixKey: data.pixKey,
                pixKeyType: data.pixKeyType,
                // Geo
                latitude: data.latitude,
                longitude: data.longitude,
                accuracy: data.accuracy,
                contractAccepted: data.contractAccepted || false,
                status: 'PENDING'
            }
        });

        res.status(201).json({ success: true, id: request.id });
    } catch (error: any) {
        console.error('[LoanRequests] Submit error:', error);
        res.status(500).json({ error: 'Erro ao enviar solicitação' });
    }
});

// PUT /api/loan-requests/:id/approve — Aprovar
loanRequestsRouter.put('/:id/approve', requireAdmin, async (req: Request, res: Response) => {
    try {
        const id = req.params.id as string;
        const request = await prisma.loanRequest.update({
            where: { id },
            data: { status: 'APPROVED' }
        });

        // Cria empréstimo
        if (request.customerId) {
            const loan = await prisma.loan.create({
                data: {
                    customerId: request.customerId,
                    requestId: request.id,
                    amount: request.amount,
                    installmentsCount: request.installments,
                    remainingAmount: request.amount,
                    status: 'APPROVED',
                    startDate: new Date()
                }
            });

            // Gera parcelas
            const installmentAmount = request.amount / request.installments;
            const installments = [];
            for (let i = 1; i <= request.installments; i++) {
                const dueDate = new Date();
                dueDate.setMonth(dueDate.getMonth() + i);
                if (request.preferredDueDay) dueDate.setDate(request.preferredDueDay);

                installments.push({
                    loanId: loan.id,
                    dueDate,
                    amount: installmentAmount,
                    status: 'OPEN'
                });
            }
            await prisma.installment.createMany({ data: installments });

            // Atualiza customer
            await prisma.customer.update({
                where: { id: request.customerId },
                data: {
                    activeLoansCount: { increment: 1 },
                    totalDebt: { increment: request.amount }
                }
            });

            // Cria transação
            await prisma.transaction.create({
                data: {
                    type: 'OUT',
                    description: `Empréstimo aprovado - ${request.clientName}`,
                    amount: request.amount,
                    category: 'LOAN',
                    date: new Date()
                }
            });
        }

        res.json({ success: true });
    } catch (error: any) {
        console.error('[LoanRequests] Approve error:', error);
        res.status(500).json({ error: 'Erro ao aprovar' });
    }
});

// PUT /api/loan-requests/:id/reject — Rejeitar
loanRequestsRouter.put('/:id/reject', requireAdmin, async (req: Request, res: Response) => {
    try {
        await prisma.loanRequest.update({
            where: { id: req.params.id as string },
            data: { status: 'REJECTED' }
        });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao rejeitar' });
    }
});

// PUT /api/loan-requests/:id/values — Atualizar valores
loanRequestsRouter.put('/:id/values', requireAdmin, async (req: Request, res: Response) => {
    try {
        const { amount, installments } = req.body;
        await prisma.loanRequest.update({
            where: { id: req.params.id as string },
            data: { amount, installments }
        });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao atualizar valores' });
    }
});

// PUT /api/loan-requests/:id/supplemental — Solicitar doc suplementar
loanRequestsRouter.put('/:id/supplemental', requireAdmin, async (req: Request, res: Response) => {
    try {
        const { description } = req.body;
        await prisma.loanRequest.update({
            where: { id: req.params.id as string },
            data: {
                status: 'WAITING_DOCS',
                supplementalDescription: description,
                supplementalRequestedAt: new Date()
            }
        });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Erro' });
    }
});

// PUT /api/loan-requests/:id/supplemental-upload — Upload doc suplementar
loanRequestsRouter.put('/:id/supplemental-upload', async (req: Request, res: Response) => {
    try {
        const { docUrl } = req.body;
        await prisma.loanRequest.update({
            where: { id: req.params.id as string },
            data: {
                supplementalDocUrl: docUrl,
                supplementalUploadedAt: new Date(),
                status: 'PENDING'
            }
        });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Erro' });
    }
});

// PUT /api/loan-requests/:id/contract — Atualizar URL do PDF do contrato
loanRequestsRouter.put('/:id/contract', async (req: Request, res: Response) => {
    try {
        const { contractPdfUrl } = req.body;
        const id = req.params.id as string;

        const request = await prisma.loanRequest.findUnique({ where: { id } });
        if (!request) {
            res.status(404).json({ error: 'Solicitação não encontrada' });
            return;
        }

        // Allow update if admin OR if user owns the request
        const isAdmin = req.user?.role === 'ADMIN';
        const isOwner = req.user?.id === request.userId;

        if (!isAdmin && !isOwner) {
            res.status(403).json({ error: 'Acesso negado' });
            return;
        }

        await prisma.loanRequest.update({
            where: { id },
            data: { contractPdfUrl }
        });

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao atualizar contrato' });
    }
});

