import { Router, Request, Response } from 'express';
import { prisma } from '../services/prisma';
import { authenticate, requireAdmin } from '../middleware/auth';
import { emailService } from '../services/email';
import axios from 'axios';

// ============ Helpers ============

async function sendWhatsAppNotification(phone: string, message: string) {
    try {
        const config = await prisma.whatsappConfig.findFirst();
        if (!config || !config.isConnected) return;

        let number = phone.replace(/\D/g, '');
        if (!number.startsWith('55') && number.length >= 10) number = '55' + number;

        await axios.post(`${config.apiUrl}/message/sendText/${config.instanceName}`, {
            number,
            options: { delay: 1200, presence: 'composing', linkPreview: false },
            textMessage: { text: message }
        }, { headers: { apikey: config.apiKey }, timeout: 15000 });
    } catch (e: any) {
        console.error('[LoanRequests] WhatsApp notification failed:', e.message);
    }
}

function brandedEmailHtml(body: string): string {
    return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #000; color: #fff; padding: 30px; border-radius: 12px;">
        <div style="text-align: center; margin-bottom: 20px;">
            <h1 style="color: #D4AF37; font-size: 24px;">🦈 Tubarão Empréstimos</h1>
        </div>
        <div style="color: #ccc; font-size: 15px; line-height: 1.6;">
            ${body}
        </div>
        <hr style="border-color: #333; margin: 25px 0;" />
        <p style="color: #666; font-size: 12px; text-align: center;">
            Tubarão Empréstimos — Plataforma de Crédito Premium
        </p>
    </div>`;
}

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
                    status: 'ACTIVE',
                    // Geocalização
                    latitude: data.latitude,
                    longitude: data.longitude,
                    locationUpdatedAt: data.locationCapturedAt ? new Date(data.locationCapturedAt) : null
                }
            });
        } else {
            // Atualiza dados do customer
            // Preparar atualização do customer
            const customerUpdateData: any = {
                userId: req.user!.id,
                name: data.clientName || req.user!.name,
                phone: data.phone,
                address: data.address,
                neighborhood: data.neighborhood,
                city: data.city,
                state: data.state,
                zipCode: data.zipCode,
                monthlyIncome: data.monthlyIncome
            };

            // Atualizar geolocalização apenas se novos dados foram capturados
            if (data.latitude !== undefined && data.latitude !== null) {
                customerUpdateData.latitude = data.latitude;
            }
            if (data.longitude !== undefined && data.longitude !== null) {
                customerUpdateData.longitude = data.longitude;
            }
            if (data.locationCapturedAt) {
                customerUpdateData.locationUpdatedAt = new Date(data.locationCapturedAt);
            }

            await prisma.customer.update({
                where: { id: customer.id },
                data: customerUpdateData
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
                referralCode: data.referralCode,
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

        // ====== NOTIFICAÇÕES AUTOMÁTICAS ======
        const amountFormatted = request.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

        // Email de aprovação
        if (request.email) {
            const html = brandedEmailHtml(`
                <h2 style="color: #4CAF50;">✅ Empréstimo Aprovado!</h2>
                <p>Olá, <strong>${request.clientName}</strong>!</p>
                <p>Seu pedido de empréstimo foi <strong style="color: #4CAF50;">APROVADO</strong>!</p>
                <div style="background: #111; border: 1px solid #333; border-radius: 8px; padding: 15px; margin: 15px 0;">
                    <p style="margin: 5px 0;"><strong style="color: #D4AF37;">Valor:</strong> ${amountFormatted}</p>
                    <p style="margin: 5px 0;"><strong style="color: #D4AF37;">Parcelas:</strong> ${request.installments}x</p>
                    <p style="margin: 5px 0;"><strong style="color: #D4AF37;">Tipo:</strong> ${request.profileType || 'Empréstimo'}</p>
                </div>
                <p>Acesse o aplicativo para ver os detalhes e acompanhar suas parcelas.</p>
                <div style="text-align: center; margin: 20px 0;">
                    <a href="https://www.tubaraoemprestimo.com.br" style="background: #D4AF37; color: #000; padding: 12px 30px; border-radius: 8px; text-decoration: none; font-weight: bold;">Acessar App</a>
                </div>
            `);
            emailService.send(request.email, '✅ Empréstimo Aprovado — Tubarão Empréstimos', html).catch(() => { });
        }

        // WhatsApp de aprovação
        if (request.phone) {
            const waMsg = `✅ *EMPRÉSTIMO APROVADO!*\n\n` +
                `Olá, ${request.clientName}!\n\n` +
                `Seu pedido de empréstimo foi *APROVADO*! 🎉\n\n` +
                `💰 *Valor:* ${amountFormatted}\n` +
                `📊 *Parcelas:* ${request.installments}x\n\n` +
                `Acesse o app para mais detalhes:\nhttps://www.tubaraoemprestimo.com.br\n\n` +
                `_Tubarão Empréstimos 🦈_`;
            sendWhatsAppNotification(request.phone, waMsg);
        }

        // Notificação no sistema
        if (request.customerId) {
            await prisma.notification.create({
                data: {
                    customerId: request.customerId,
                    customerEmail: request.email,
                    title: '✅ Empréstimo Aprovado',
                    message: `Seu empréstimo de ${amountFormatted} em ${request.installments}x foi aprovado!`,
                    type: 'SUCCESS'
                }
            }).catch(() => { });
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
        const loanRequest = await prisma.loanRequest.update({
            where: { id: req.params.id as string },
            data: { status: 'REJECTED' }
        });

        // ====== NOTIFICAÇÕES AUTOMÁTICAS ======

        // Email de rejeição
        if (loanRequest.email) {
            const html = brandedEmailHtml(`
                <h2 style="color: #FF6B6B;">Solicitação Não Aprovada</h2>
                <p>Olá, <strong>${loanRequest.clientName}</strong>.</p>
                <p>Infelizmente sua solicitação de empréstimo não foi aprovada neste momento.</p>
                <p style="color: #aaa;">Isso pode acontecer por diversos motivos. Você pode tentar novamente após 30 dias ou entrar em contato conosco para mais informações.</p>
                <div style="text-align: center; margin: 20px 0;">
                    <a href="https://www.tubaraoemprestimo.com.br" style="background: #D4AF37; color: #000; padding: 12px 30px; border-radius: 8px; text-decoration: none; font-weight: bold;">Acessar App</a>
                </div>
            `);
            emailService.send(loanRequest.email, 'Atualização sobre sua solicitação — Tubarão Empréstimos', html).catch(() => { });
        }

        // WhatsApp de rejeição
        if (loanRequest.phone) {
            const waMsg = `Olá, ${loanRequest.clientName}.\n\n` +
                `Informamos que sua solicitação de empréstimo não foi aprovada neste momento.\n\n` +
                `Você pode tentar novamente após 30 dias ou entrar em contato conosco para mais informações.\n\n` +
                `_Tubarão Empréstimos 🦈_`;
            sendWhatsAppNotification(loanRequest.phone, waMsg);
        }

        // Notificação no sistema
        if (loanRequest.customerId) {
            await prisma.notification.create({
                data: {
                    customerId: loanRequest.customerId,
                    customerEmail: loanRequest.email,
                    title: 'Solicitação Atualizada',
                    message: 'Sua solicitação de empréstimo foi atualizada. Acesse o app para mais detalhes.',
                    type: 'INFO'
                }
            }).catch(() => { });
        }

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

