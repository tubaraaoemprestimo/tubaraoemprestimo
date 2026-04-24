import { Router, Request, Response } from 'express';
import { prisma } from '../services/prisma';
import { authenticate, requireAdmin } from '../middleware/auth';
import { emailService } from '../services/email';
import { sendWhatsAppMessage, sendWhatsAppImage } from '../services/whatsapp';
import { sendPushToUser, sendPushToRole } from './push';
import axios from 'axios';

// ============ Helpers ============

async function sendWhatsAppNotification(phone: string, message: string) {
    try {
        const config = await prisma.whatsappConfig.findFirst();
        if (!config || !config.isConnected) return;

        const { normalizePhoneBR } = await import('../services/whatsapp');
        const number = normalizePhoneBR(phone);
        if (number.length < 12) return;

        await axios.post(`${config.apiUrl}/message/sendText/${config.instanceName}`, {
            number,
            text: message,
            options: { delay: 1200, presence: 'composing', linkPreview: false }
        }, { headers: { apikey: config.apiKey }, timeout: 15000 });
    } catch (e: any) {
        console.error('[LoanRequests] WhatsApp notification failed:', e?.response?.data?.message || e.message);
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
                status: { in: ['PENDING', 'WAITING_DOCS', 'PENDING_ACCEPTANCE'] }
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

// Helper: converter array para string (banco aceita só String)
function normalizeDocField(value: any): string | null {
    if (!value) return null;
    if (typeof value === 'string') return value;
    if (Array.isArray(value)) {
        if (value.length === 0) return null;
        if (value.length === 1) return value[0];
        return JSON.stringify(value);
    }
    return String(value);
}

// ── Validação estrita por profileType ──────────────────────────────────────
function validateRequestByProfile(data: any): string | null {
    const profile = data.profileType as string | undefined;

    // Validar referências obrigatórias (aceitar ambos os nomes de campo: frontend usa contactTrust1Name/contactTrust1)
    const ref1Name = data.reference1Name || data.contactTrust1Name;
    const ref1Phone = data.reference1Phone || data.contactTrust1;
    const ref2Name = data.reference2Name || data.contactTrust2Name;
    const ref2Phone = data.reference2Phone || data.contactTrust2;

    if (!ref1Name || !ref1Phone) {
        return 'Referência 1 (nome e telefone) é obrigatória.';
    }
    if (!ref2Name || !ref2Phone) {
        return 'Referência 2 (nome e telefone) é obrigatória.';
    }

    // Documentos básicos obrigatórios para TODOS os perfis de empréstimo
    if (['CLT', 'AUTONOMO', 'MOTO', 'GARANTIA'].includes(profile || '')) {
        // Selfie obrigatória
        if (!data.selfieUrl && !data.selfie) {
            return 'Selfie obrigatória.';
        }

        // RG frente obrigatório
        if (!data.idCardUrl && !data.idCardFront) {
            return 'RG frente obrigatório.';
        }

        // RG verso obrigatório
        if (!data.idCardBackUrl && !data.idCardBack) {
            return 'RG verso obrigatório.';
        }

        // Comprovante de endereço obrigatório
        if (!data.proofOfAddressUrl && !data.proofAddress) {
            return 'Comprovante de endereço obrigatório.';
        }

        // Assinatura obrigatória
        if (!data.signatureUrl && !data.signature) {
            return 'Assinatura obrigatória.';
        }

        // Vídeo selfie obrigatório (não obrigatório para MOTO — wizard MOTO não tem step de vídeo)
        if (profile !== 'MOTO' && !data.videoSelfieUrl && !data.videoSelfie) {
            return 'Vídeo de aceite (videoSelfie) obrigatório.';
        }
    }

    // AUTONOMO e CLT e GARANTIA precisam do vídeo da residência/estabelecimento
    if (['CLT', 'AUTONOMO', 'GARANTIA'].includes(profile || '')) {
        if (!data.videoHouseUrl && !data.videoHouse) {
            return 'Vídeo da residência/estabelecimento (videoHouse) obrigatório.';
        }
    }

    // CLT precisa de carteira de trabalho
    if (profile === 'CLT') {
        if (!data.workCardUrl && !data.workCard) {
            return 'Carteira de trabalho obrigatória para CLT.';
        }
    }

    // LIMPA_NOME precisa de assinatura
    if (profile === 'LIMPA_NOME') {
        if (!data.signatureUrl && !data.signature) {
            return 'Assinatura obrigatória para serviço Limpa Nome.';
        }
    }

    // GARANTIA needs collateral items
    if (profile === 'GARANTIA') {
        if (!data.collateralItems || !Array.isArray(data.collateralItems) || data.collateralItems.length === 0) {
            return 'Pelo menos 1 item de garantia é obrigatório.';
        }

        // Validar cada item
        for (let i = 0; i < data.collateralItems.length; i++) {
            const item = data.collateralItems[i];

            if (!item.type) {
                return `Item ${i + 1}: Tipo de garantia obrigatório.`;
            }
            if (!item.description) {
                return `Item ${i + 1}: Descrição obrigatória.`;
            }
            if (!item.estimatedValue) {
                return `Item ${i + 1}: Valor estimado obrigatório.`;
            }
            if (!item.photos || item.photos.length === 0) {
                return `Item ${i + 1}: Fotos obrigatórias.`;
            }

            // Se hasInvoice=true, invoiceUrl é obrigatório
            if (item.hasInvoice && !item.invoiceUrl) {
                return `Item ${i + 1}: Nota fiscal obrigatória (você marcou que possui).`;
            }
        }
    }

    return null;
}

// POST /api/loan-requests — Nova solicitação
loanRequestsRouter.post('/', async (req: Request, res: Response) => {
    try {
        const data = req.body;

        // Validação estrita dos campos obrigatórios por tipo de perfil
        const validationError = validateRequestByProfile(data);
        if (validationError) {
            res.status(400).json({ error: validationError });
            return;
        }

        // Verificar se cliente já tem solicitação ativa (prevenção de duplicatas)
        const existingRequest = await prisma.loanRequest.findFirst({
            where: {
                cpf: data.cpf,
                status: {
                    in: ['PENDING', 'WAITING_DOCS', 'PENDING_ACCEPTANCE', 'APPROVED']
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        if (existingRequest) {
            return res.status(400).json({
                error: 'Você já possui uma solicitação em andamento',
                existingRequestId: existingRequest.id,
                status: existingRequest.status
            });
        }

        // Busca ou cria customer
        let customer = await prisma.customer.findFirst({
            where: { OR: [{ cpf: data.cpf }, { email: req.user!.email }] }
        });

        // Verificar se o cliente veio de um parceiro
        let partnerId = null;
        let isPartnerReferral = false;
        let partnerCommissionRate = null;

        if (data.referralCode) {
            // Verificar se o código de indicação pertence a um parceiro
            const partner = await prisma.user.findFirst({
                where: {
                    isPartner: true,
                    OR: [
                        { email: data.referralCode },
                        { referralCode: data.referralCode }
                    ]
                }
            });

            if (partner) {
                partnerId = partner.id;
                isPartnerReferral = true;
                // Pegar a taxa de comissão padrão do parceiro
                const partnerProgram = await prisma.partnerProgram.findFirst({
                    where: {
                        id: partner.id
                    },
                    orderBy: { createdAt: 'desc' }
                });
                partnerCommissionRate = partnerProgram?.commissionRate || 5.0;
            }
        }

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
                    // Novos campos para sistema de parceiros
                    partnerId,
                    isPartnerCustomer: isPartnerReferral,
                    partnerCommissionRate,
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

            // Atualizar campos de parceiros se for uma referência de parceiro
            if (isPartnerReferral) {
                customerUpdateData.partnerId = partnerId;
                customerUpdateData.isPartnerCustomer = true;
                customerUpdateData.partnerCommissionRate = partnerCommissionRate;
            }

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
                clientName: data.clientName || data.name || req.user!.name,
                cpf: data.cpf,
                email: req.user!.email,
                phone: data.phone,
                amount: data.amount || 0,
                installments: data.installments || 1,
                profileType: data.profileType,
                referralCode: data.referralCode,
                fatherPhone: data.fatherPhone || data.contactTrust1 || null,
                motherPhone: data.motherPhone || data.contactTrust2 || null,
                spousePhone: data.spousePhone || null,
                // Novos campos - Relacionamentos familiares
                fatherPhoneRelationship: data.fatherPhoneRelationship || null,
                motherPhoneRelationship: data.motherPhoneRelationship || null,
                spousePhoneRelationship: data.spousePhoneRelationship || null,
                // Referências pessoais (aceitar ambos os formatos: reference1Name ou contactTrust1Name)
                reference1Name: data.reference1Name || data.contactTrust1Name || null,
                reference1Phone: data.reference1Phone || data.contactTrust1 || null,
                reference2Name: data.reference2Name || data.contactTrust2Name || null,
                reference2Phone: data.reference2Phone || data.contactTrust2 || null,
                // Novos campos - Dados profissionais
                companyAddress: data.companyAddress || null,
                companyProfession: data.companyProfession || null,
                companyWorkSince: data.companyWorkSince || null,
                companyIncome: data.companyIncome || null,
                companyPaymentDay: data.companyPaymentDay || null,
                companyName: data.companyName || null,
                // Novos campos - Termo de veracidade
                contractTermsAccepted: data.contractTermsAccepted || false,
                declarationAccepted: data.declarationAccepted || false,
                address: data.address,
                neighborhood: data.neighborhood,
                city: data.city,
                state: data.state,
                zipCode: data.zipCode || data.cep || null,
                birthDate: data.birthDate,
                preferredDueDay: data.preferredDueDay,
                instagram: data.instagram,
                monthlyIncome: data.monthlyIncome || (data.income ? parseFloat(String(data.income).replace(/[^\d.,]/g, '').replace(',', '.')) || null : null),
                // Documentos (aceita nomes do wizard OU do backend, e normaliza arrays)
                selfieUrl: normalizeDocField(data.selfieUrl || data.selfie),
                idCardUrl: normalizeDocField(data.idCardUrl || data.idCardFront),
                idCardBackUrl: normalizeDocField(data.idCardBackUrl || data.idCardBack),
                proofOfAddressUrl: normalizeDocField(data.proofOfAddressUrl || data.proofAddress),
                proofIncomeUrl: normalizeDocField(data.proofIncomeUrl || data.proofIncome),
                vehicleUrl: normalizeDocField(data.vehicleUrl || data.vehicleFront),
                videoSelfieUrl: normalizeDocField(data.videoSelfieUrl || data.videoSelfie),
                videoHouseUrl: normalizeDocField(data.videoHouseUrl || data.videoHouse),
                videoVehicleUrl: normalizeDocField(data.videoVehicleUrl),
                signatureUrl: normalizeDocField(data.signatureUrl || data.signature),
                workCardUrl: normalizeDocField(data.workCardUrl || data.workCard),
                // Dados extras (endereço detalhado, fotos casa, garantia, etc.)
                supplementalDescription: data.supplementalDescription || null,
                collateralItems: data.collateralItems || null,
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
                // Campos para sistema de parceiros
                partnerId,
                isPartnerReferral,
                partnerCommissionRate,
                // Campos específicos para INVESTIDOR
                investmentTier: data.investmentTier || null,
                payoutMode: data.payoutMode || null,
                monthlyRate: data.monthlyRate || null,
                contractMonths: data.contractMonths || null,
                autoRenew: data.autoRenew !== undefined ? data.autoRenew : true,
                withdrawalNoticeMonths: data.withdrawalNoticeMonths || null,
                accountHolderName: data.accountHolderName || null,
                // Flags de classificação de contrato
                isService: data.profileType === 'LIMPA_NOME',
                isInvestment: data.profileType === 'INVESTIDOR',
                isLoan: ['CLT', 'AUTONOMO', 'MOTO', 'GARANTIA'].includes(data.profileType || ''),
                status: 'PENDING'
            }
        });

        // ====== NOTIFICAÇÕES DE NOVA SOLICITAÇÃO ======
        const isMoto = request.profileType === 'MOTO';
        const isLimpaNome = request.profileType === 'LIMPA_NOME';
        const isInvestidor = request.profileType === 'INVESTIDOR';
        const profileLabels: Record<string, string> = {
            CLT: 'Empréstimo Pessoal (CLT)',
            AUTONOMO: 'Capital de Giro (Comércio)',
            MOTO: 'Financiamento de Motocicleta',
            GARANTIA: 'Empréstimo com Garantia',
            LIMPA_NOME: 'Limpa Nome',
            INVESTIDOR: 'Programa de Investimento',
        };
        const typeLabel = profileLabels[request.profileType || ''] || 'Empréstimo';
        const amtFmt = (request.amount || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

        // Detalhes de valor para exibição
        const valorDisplay = isMoto
            ? `<p style="margin: 5px 0;"><strong style="color: #D4AF37;">Produto:</strong> Honda Pop 110i 2026</p>
               <p style="margin: 5px 0;"><strong style="color: #D4AF37;">Entrada:</strong> R$ 2.000,00</p>
               <p style="margin: 5px 0;"><strong style="color: #D4AF37;">Parcelas:</strong> 36x R$ 611,00 + Seguro R$ 150,00/mês</p>`
            : isLimpaNome
                ? `<p style="margin: 5px 0;"><strong style="color: #D4AF37;">Serviço:</strong> Limpa Nome</p>`
                : isInvestidor
                    ? `<p style="margin: 5px 0;"><strong style="color: #D4AF37;">Valor do Investimento:</strong> ${amtFmt}</p>
                       <p style="margin: 5px 0;"><strong style="color: #06b6d4;">Rendimento:</strong> ${data.monthlyRate || 2.5}% ao mês</p>
                       <p style="margin: 5px 0;"><strong style="color: #06b6d4;">Modalidade:</strong> ${data.payoutMode === 'MONTHLY' ? 'Mensal' : 'Anual Acumulado'}</p>`
                    : `<p style="margin: 5px 0;"><strong style="color: #D4AF37;">Valor:</strong> ${amtFmt}</p>`;

        const descricaoResumida = isMoto
            ? 'financiamento de motocicleta Honda Pop 110i'
            : isLimpaNome
                ? 'serviço Limpa Nome'
                : isInvestidor
                    ? `investimento de ${amtFmt}`
                    : `${amtFmt}`;

        // Email para o cliente confirmando recebimento
        if (req.user!.email) {
            const clientHtml = brandedEmailHtml(`
                <h2 style="color: #D4AF37;">📋 Solicitação Recebida!</h2>
                <p>Olá, <strong>${data.clientName || req.user!.name}</strong>!</p>
                <p>Recebemos sua solicitação de ${isMoto ? 'financiamento' : isLimpaNome ? 'serviço' : isInvestidor ? 'investimento' : 'empréstimo'} e ela está em análise.</p>
                <div style="background: #111; border: 1px solid #333; border-radius: 8px; padding: 15px; margin: 15px 0;">
                    ${valorDisplay}
                    <p style="margin: 5px 0;"><strong style="color: #D4AF37;">Tipo:</strong> ${typeLabel}</p>
                </div>
                <p>${isInvestidor ? 'Nossa equipe entrará em contato em até 48 horas para dar continuidade ao processo.' : 'Acompanhe o status pelo aplicativo. Você receberá uma notificação assim que tivermos novidades.'}</p>
                <div style="text-align: center; margin: 20px 0;">
                    <a href="https://www.tubaraoemprestimo.com.br" style="background: #D4AF37; color: #000; padding: 12px 30px; border-radius: 8px; text-decoration: none; font-weight: bold;">Acessar App</a>
                </div>
            `);
            const emailSubject = isMoto
                ? '🏍️ Solicitação de Financiamento Recebida — Tubarão Empréstimos'
                : isInvestidor
                    ? '💰 Solicitação de Investimento Recebida — Tubarão Empréstimos'
                    : '📋 Solicitação Recebida — Tubarão Empréstimos';
            emailService.send(req.user!.email, emailSubject, clientHtml).catch(() => { });
        }

        // Email para o Admin notificando nova solicitação
        try {
            const adminEmail = process.env.ADMIN_EMAIL;
            if (adminEmail) {
                const adminBody = '<div style="font-family:Arial,sans-serif;background:#000;color:#fff;padding:30px;border-radius:12px">'
                    + '<h2 style="color:#D4AF37">📋 Nova Solicitação Recebida</h2>'
                    + '<p><b style="color:#D4AF37">Cliente:</b> ' + (data.clientName || req.user!.name) + '</p>'
                    + '<p><b style="color:#D4AF37">Serviço:</b> ' + typeLabel + '</p>'
                    + '<p><b style="color:#D4AF37">E-mail:</b> ' + req.user!.email + '</p>'
                    + '<p><b style="color:#D4AF37">Telefone:</b> ' + (data.phone || 'N/A') + '</p>'
                    + '<div style="text-align:center;margin:20px 0">'
                    + '<a href="https://www.tubaraoemprestimo.com.br/#/admin/requests" style="background:#D4AF37;color:#000;padding:12px 30px;border-radius:8px;text-decoration:none;font-weight:bold">Analisar no Painel</a>'
                    + '</div></div>';
                emailService.send(
                    adminEmail,
                    '📋 Nova Solicitação: ' + (data.clientName || req.user!.name) + ' — ' + typeLabel,
                    adminBody
                ).catch((err: any) => {
                    console.error('[LoanRequests] Falha ao enviar email ao admin:', err?.message);
                });
            }
        } catch (emailErr: any) {
            console.error('[LoanRequests] Erro ao montar email do admin:', emailErr?.message);
        }

        // WhatsApp para o cliente
        if (data.phone) {
            sendWhatsAppNotification(data.phone,
                `📋 *Solicitação Recebida!*\n\nOlá, ${(data.clientName || req.user!.name).split(' ')[0]}!\n\nSua solicitação de ${descricaoResumida} foi recebida e está em análise.\n\nAcompanhe pelo app:\nhttps://www.tubaraoemprestimo.com.br\n\n_Tubarão Empréstimos 🦈_`
            );
        }

        // Notificar admin via WhatsApp e notificação interna
        try {
            const admins = await prisma.user.findMany({ where: { role: 'ADMIN' } });
            for (const admin of admins) {
                if (admin.phone) {
                    await sendWhatsAppNotification(admin.phone,
                        `🦈 *Nova Solicitação!*\n\nCliente: ${data.clientName || req.user!.name}\n${isMoto ? 'Produto: Honda Pop 110i 2026' : isInvestidor ? `Investimento: ${amtFmt}` : `Valor: ${amtFmt}`}\nTipo: ${typeLabel}\n\nAcesse o painel para avaliar.`
                    );
                }
            }
            await prisma.notification.create({
                data: {
                    title: isMoto ? '🏍️ Nova Solicitação - Financiamento Moto' : isInvestidor ? '💰 Nova Solicitação - Investidor' : '📋 Nova Solicitação de Empréstimo',
                    message: `${data.clientName || req.user!.name} solicitou ${descricaoResumida} (${typeLabel})`,
                    type: 'INFO',
                    requestId: request.id
                }
            }).catch(() => { });
        } catch (notifErr) {
            console.error('[LoanRequests] Notification error:', notifErr);
        }

        // Notificação interna para o cliente
        if (customer?.id) {
            await prisma.notification.create({
                data: {
                    customerId: customer.id,
                    customerEmail: req.user!.email,
                    title: '📋 Solicitação Enviada',
                    message: `Sua solicitação de ${amtFmt} está em análise.`,
                    type: 'INFO'
                }
            }).catch(() => { });
        }

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
                    startDate: new Date(),
                    // Flags de classificação de contrato
                    isService: request.profileType === 'LIMPA_NOME',
                    isInvestment: request.profileType === 'INVESTIDOR',
                    isLoan: ['CLT', 'AUTONOMO', 'MOTO', 'GARANTIA'].includes(request.profileType || '')
                }
            });

            // Gera parcelas (com juros se houver)
            const interestRate = request.monthlyRate || 0;
            const totalWithInterest = interestRate > 0 ? request.amount * (1 + interestRate) : request.amount;
            const installmentAmount = totalWithInterest / request.installments;
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

            // ====== COMISSÃO DE PARCEIROS (NOVO SISTEMA) ======
            try {
                if (request.partnerId && request.isPartnerReferral) {
                    // Calcular comissão FIXA baseada no tipo e valor do empréstimo
                    let commissionAmount = 0;
                    const profileType = request.profileType || 'CLT';
                    const amount = request.amount || 0;

                    switch (profileType) {
                        case 'MOTO':
                            commissionAmount = 250; // R$ 250 fixo para moto
                            break;
                        case 'LIMPA_NOME':
                            commissionAmount = 50; // R$ 50 fixo para limpa nome
                            break;
                        case 'INVESTIDOR':
                            commissionAmount = amount * 0.01; // 1% do valor
                            break;
                        default: // CLT, AUTONOMO, GARANTIA, etc.
                            if (amount >= 10000) {
                                commissionAmount = 180;
                            } else if (amount >= 5000) {
                                commissionAmount = 150;
                            } else {
                                commissionAmount = 120; // Até 3k
                            }
                            break;
                    }

                    // Criar a comissão com status PENDING (liberação por parcela 40/30/30)
                    const commission = await prisma.partnerCommission.create({
                        data: {
                            partnerId: request.partnerId,
                            loanRequestId: request.id,
                            contractId: loan.id,
                            totalCommission: commissionAmount,
                            commissionAmount: 0, // Nada liberado ainda
                            commissionRate: 0,
                            installmentsReleased: 0,
                            releasedPercent: 0,
                            status: 'PENDING',
                            notes: `Comissão ${profileType} - Valor: R$ ${commissionAmount.toFixed(2)} (aguardando pagamento de parcelas)`
                        }
                    });

                    console.log(`[LoanRequests] Partner commission created: R$ ${commissionAmount} for partner ${request.partnerId}`);

                    // Enviar notificação ao parceiro
                    const partner = await prisma.user.findUnique({
                        where: { id: request.partnerId }
                    });

                    if (partner) {
                        // Enviar notificação por email
                        if (partner.email) {
                            const commissionHtml = brandedEmailHtml(`
                                <h2 style="color:#4CAF50;">💰 Nova Comissão Gerada!</h2>
                                <p>Olá, <strong>${partner.name}</strong>!</p>
                                <p>O empréstimo referenciado por você foi aprovado e gerou uma comissão!</p>
                                <div style="background: #111; border: 1px solid #333; border-radius: 8px; padding: 15px; margin: 15px 0;">
                                    <p style="margin: 5px 0;"><strong style="color: #D4AF37;">Cliente:</strong> ${request.clientName}</p>
                                    <p style="margin: 5px 0;"><strong style="color: #D4AF37;">Tipo:</strong> ${profileType}</p>
                                    <p style="margin: 5px 0;"><strong style="color: #D4AF37;">Valor da Comissão Total:</strong> R$ ${commissionAmount.toFixed(2)}</p>
                                    <p style="margin: 5px 0; color: #aaa;">A liberação acontece em 3 etapas: 40% (1ª parcela), 30% (2ª parcela), 30% (3ª parcela).</p>
                                </div>
                                <p>Acesse o painel de parceiros para mais detalhes sobre suas comissões.</p>
                            `);
                            emailService.send(partner.email, '💰 Nova Comissão Gerada — Tubarão Parceiros', commissionHtml).catch(() => { });
                        }

                        // Enviar notificação por WhatsApp
                        if (partner.phone) {
                            const commissionMsg = `💰 *Nova Comissão Gerada!*\n\n` +
                                `Olá, ${partner.name.split(' ')[0]}!\n\n` +
                                `O empréstimo de *${request.clientName}* foi aprovado.\n\n` +
                                `📊 *Tipo:* ${profileType}\n` +
                                `📊 *Comissão Total:* R$ ${commissionAmount.toFixed(2)}\n` +
                                `📊 *Liberação:* 40% na 1ª parcela, 30% na 2ª, 30% na 3ª\n\n` +
                                `Acesse o painel de parceiros para mais detalhes.\n\n` +
                                `_Tubarão Parceiros 🦈_`;
                            sendWhatsAppNotification(partner.phone, commissionMsg);
                        }

                        // Notificação no sistema
                        await prisma.notification.create({
                            data: {
                                customerEmail: partner.email,
                                title: '💰 Nova Comissão Gerada!',
                                message: `Empréstimo de ${request.clientName} aprovado. Comissão de R$ ${commissionAmount.toFixed(2)} gerada (liberação por parcela).`,
                                type: 'SUCCESS'
                            }
                        }).catch(() => { });
                    }
                }
            } catch (commissionErr) {
                console.error('[LoanRequests] Partner commission error:', commissionErr);
            }

        }

        // ====== GAMIFICAÇÃO DE INDICAÇÃO ======
        try {
            if (request.customerId) {
                const pendingReferral = await prisma.referral.findFirst({
                    where: { referredCustomerId: request.customerId, status: 'PENDING' },
                    include: { referrer: true }
                });
                if (pendingReferral) {
                    let points = 100;
                    let bonus = 0;
                    if (request.amount >= 10000) { bonus = 100; }
                    else if (request.amount >= 5000) { bonus = 50; }

                    await prisma.referral.update({
                        where: { id: pendingReferral.id },
                        data: { status: 'APPROVED', pointsAwarded: points, bonusAmount: bonus, approvedAt: new Date() }
                    });

                    await prisma.customer.update({
                        where: { id: pendingReferral.referrerCustomerId },
                        data: { referralPoints: { increment: points } }
                    });

                    // Notificar quem indicou
                    const referrer = pendingReferral.referrer;
                    if (referrer?.phone) {
                        sendWhatsAppNotification(referrer.phone,
                            `🎉 *Indicação Aprovada!*\n\nO empréstimo de ${request.clientName} foi aprovado!\n\nVocê ganhou *${points} pontos*${bonus > 0 ? ` e um bônus de R$ ${bonus}` : ''}! 🦈`
                        );
                    }
                    if (referrer?.email) {
                        emailService.send(referrer.email, '🎉 Indicação Aprovada — Tubarão Empréstimos',
                            brandedEmailHtml(`
                                <h2 style="color:#4CAF50;">Indicação Aprovada!</h2>
                                <p>O empréstimo de <strong>${request.clientName}</strong> foi aprovado!</p>
                                <p>Você ganhou <strong style="color:#D4AF37;">${points} pontos</strong>${bonus > 0 ? ` e um bônus de <strong style="color:#4CAF50;">R$ ${bonus}</strong>` : ''}!</p>
                            `)
                        ).catch(() => { });
                    }
                }
            }
        } catch (refErr) {
            console.error('[LoanRequests] Referral reward error:', refErr);
        }

        // ====== GERAR PIX PARA PARCELAS ======
        try {
            const pixSetting = await prisma.systemSetting.findFirst({ where: { key: 'pix_key' } });
            if (pixSetting?.value) {
                const loan = await prisma.loan.findFirst({ where: { requestId: request.id }, include: { installments: true, customer: true } });
                if (loan) {
                    const { generateInstallmentPixData, saveInstallmentQRCode } = await import('../services/pix');
                    for (const [index, inst] of loan.installments.entries()) {
                        const installmentNum = index + 1;
                        const { pixCode, qrCodeBuffer } = await generateInstallmentPixData(
                            pixSetting.value,
                            Number(inst.amount),
                            loan.customer.name,
                            loan.customer.city || 'SAO PAULO',
                            installmentNum,
                            loan.id
                        );
                        await saveInstallmentQRCode(prisma, inst.id, qrCodeBuffer, pixCode);
                    }
                }
            }
        } catch (pixErr) {
            console.error('[LoanRequests] PIX generation error:', pixErr);
        }

        // ====== NOTIFICAÇÕES AUTOMÁTICAS ======
        const amountFormatted = request.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

        // Buscar chave PIX para incluir nas notificações
        const pixSetting = await prisma.systemSetting.findUnique({
            where: { key: 'pix_key' }
        });

        // Email de aprovação
        if (request.email) {
            let emailContent = `
                <h2 style="color: #4CAF50;">✅ Empréstimo Aprovado!</h2>
                <p>Olá, <strong>${request.clientName}</strong>!</p>
                <p>Seu pedido de empréstimo foi <strong style="color: #4CAF50;">APROVADO</strong>!</p>
                <div style="background: #111; border: 1px solid #333; border-radius: 8px; padding: 15px; margin: 15px 0;">
                    <p style="margin: 5px 0;"><strong style="color: #D4AF37;">Valor:</strong> ${amountFormatted}</p>
                    <p style="margin: 5px 0;"><strong style="color: #D4AF37;">Tipo:</strong> ${request.profileType || 'Empréstimo'}</p>
                </div>`;

            // Incluir chave PIX se estiver configurada
            if (pixSetting?.value) {
                emailContent += `
                <div style="background: #111; border: 1px solid #333; border-radius: 8px; padding: 15px; margin: 15px 0;">
                    <p style="margin: 5px 0; color: #ccc;"><strong style="color: #D4AF37;">Chave PIX para pagamentos:</strong> ${pixSetting.value}</p>
                    <p style="margin: 5px 0; color: #aaa; font-size: 12px;">Use esta chave para realizar pagamentos de suas parcelas</p>
                </div>`;
            }

            emailContent += `
                <p>Acesse o aplicativo para ver os detalhes do seu empréstimo.</p>
                <div style="text-align: center; margin: 20px 0;">
                    <a href="https://www.tubaraoemprestimo.com.br" style="background: #D4AF37; color: #000; padding: 12px 30px; border-radius: 8px; text-decoration: none; font-weight: bold;">Acessar App</a>
                </div>
            `;

            const html = brandedEmailHtml(emailContent);
            emailService.send(request.email, '✅ Empréstimo Aprovado — Tubarão Empréstimos', html).catch(() => { });
        }

        // WhatsApp de aprovação
        if (request.phone) {
            let waMsg = `✅ *EMPRÉSTIMO APROVADO!*\n\n` +
                `Olá, ${request.clientName}!\n\n` +
                `Seu pedido de empréstimo foi *APROVADO*! 🎉\n\n` +
                `💰 *Valor:* ${amountFormatted}\n\n`;

            // Incluir chave PIX se estiver configurada
            if (pixSetting?.value) {
                waMsg += `📱 *Chave PIX:* ${pixSetting.value}\n` +
                    `Use esta chave para pagar suas parcelas.\n\n`;
            }

            waMsg += `Acesse o app para mais detalhes:\nhttps://www.tubaraoemprestimo.com.br\n\n` +
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
                    message: `Seu empréstimo de ${amountFormatted} foi aprovado!`,
                    type: 'SUCCESS'
                }
            }).catch(() => { });
        }

        // Push notification para o cliente
        if (request.userId) {
            sendPushToUser(request.userId, '✅ Empréstimo Aprovado!', `Seu empréstimo de ${amountFormatted} foi aprovado!`).catch(() => { });
        }

        res.json({ success: true });
    } catch (error: any) {
        console.error('[LoanRequests] Approve error:', error);
        res.status(500).json({ error: 'Erro ao aprovar' });
    }
});

// PUT /api/loan-requests/:id/pix-receipt — Anexar comprovante PIX ao loan existente
loanRequestsRouter.put('/:id/pix-receipt', requireAdmin, async (req: Request, res: Response) => {
    try {
        const id = req.params.id as string;
        const { pixReceiptUrl } = req.body;

        if (!pixReceiptUrl) {
            return res.status(400).json({ error: 'URL do comprovante obrigatória' });
        }

        const request = await prisma.loanRequest.findUnique({ where: { id } });
        if (!request) return res.status(404).json({ error: 'Solicitação não encontrada' });

        // Atualiza o loan associado
        const loan = await prisma.loan.findFirst({ where: { requestId: id } });
        if (!loan) return res.status(404).json({ error: 'Contrato não encontrado. Ative o contrato primeiro.' });

        await prisma.loan.update({
            where: { id: loan.id },
            data: { pixReceiptUrl }
        });

        // Notificação para o cliente
        if (request.customerId) {
            await prisma.notification.create({
                data: {
                    customerId: request.customerId,
                    title: '💰 Comprovante de Transferência Disponível',
                    message: 'O comprovante do PIX do seu empréstimo está disponível no app.',
                    type: 'SUCCESS'
                }
            }).catch(() => { });
        }

        // WhatsApp — envia imagem do comprovante + mensagem
        if (request.phone) {
            const caption = `💰 *Comprovante de Transferência PIX*\n\nOlá, ${request.clientName}! Segue o comprovante do PIX do seu empréstimo.\n\n_Tubarão Empréstimos 🦈_`;

            // Tenta enviar como imagem (base64 ou URL)
            const sentAsImage = await sendWhatsAppImage(request.phone, pixReceiptUrl, caption).catch(() => false);

            // Se falhar (ex: PDF), envia só texto + link app
            if (!sentAsImage) {
                sendWhatsAppNotification(request.phone,
                    `💰 *Comprovante de Transferência Disponível*\n\nOlá, ${request.clientName}!\n\nSeu comprovante PIX está disponível no app. Acesse e visualize na tela inicial.\n\n_Tubarão Empréstimos 🦈_`
                );
            }
        }

        console.log(`[PIX] Comprovante anexado ao loan ${loan.id} para request ${id}`);
        return res.json({ success: true, message: 'Comprovante anexado com sucesso' });
    } catch (err: any) {
        console.error('[PIX] Erro ao anexar comprovante:', err);
        return res.status(500).json({ error: 'Erro ao anexar comprovante' });
    }
});

// POST /api/loan-requests/:id/activate-contract — Ativar Contrato (FASE 2)
loanRequestsRouter.post('/:id/activate-contract', requireAdmin, async (req: Request, res: Response) => {
    try {
        const id = req.params.id as string;
        const {
            principalAmount,
            dailyInstallmentAmount,
            fixedInstallmentAmount,
            totalInstallments,
            firstPaymentDate,
            pixReceiptUrl,
            interestRate,
            paymentFrequency,
            dueDay,
            adminNotes
        } = req.body;

        // Validações
        if (!principalAmount || principalAmount <= 0) {
            return res.status(400).json({ error: 'Valor principal inválido' });
        }
        if (!totalInstallments || totalInstallments <= 0) {
            return res.status(400).json({ error: 'Número de parcelas inválido' });
        }
        if (!pixReceiptUrl) {
            return res.status(400).json({ error: 'Comprovante de PIX obrigatório' });
        }
        if (!firstPaymentDate) {
            return res.status(400).json({ error: 'Data do primeiro pagamento obrigatória' });
        }

        // Buscar solicitação
        const request = await prisma.loanRequest.findUnique({
            where: { id },
            include: { customer: true }
        });

        if (!request) {
            return res.status(404).json({ error: 'Solicitação não encontrada' });
        }

        if (request.status !== 'APPROVED' && request.status !== 'PENDING_ACCEPTANCE' && request.status !== 'ACTIVE') {
            return res.status(400).json({ error: 'Solicitação precisa estar aprovada ou ativa' });
        }

        // Verificar se já existe um contrato ativo
        const existingLoan = await prisma.loan.findUnique({
            where: { requestId: id }
        });

        if (existingLoan) {
            // Atualizar contrato existente
            const updatedLoan = await prisma.loan.update({
                where: { id: existingLoan.id },
                data: {
                    principalAmount: parseFloat(principalAmount),
                    dailyInstallmentAmount: dailyInstallmentAmount ? parseFloat(dailyInstallmentAmount) : null,
                    totalInstallments: parseInt(totalInstallments),
                    firstPaymentDate: new Date(firstPaymentDate),
                    pixReceiptUrl,
                    interestRate: interestRate ? parseFloat(interestRate) : null,
                    paymentFrequency: paymentFrequency || 'MONTHLY',
                    dueDay: dueDay ? parseInt(dueDay) : null,
                    adminNotes: adminNotes || null,
                    status: 'ACTIVE',
                    amount: parseFloat(principalAmount),
                    remainingAmount: parseFloat(principalAmount),
                    updatedAt: new Date()
                }
            });

            // Calcular próxima data de pagamento
            const nextPayment = new Date(firstPaymentDate);
            if (paymentFrequency === 'DAILY') {
                nextPayment.setDate(nextPayment.getDate() + 1);
            } else if (paymentFrequency === 'WEEKLY') {
                nextPayment.setDate(nextPayment.getDate() + 7);
            } else {
                nextPayment.setMonth(nextPayment.getMonth() + 1);
            }

            await prisma.loan.update({
                where: { id: updatedLoan.id },
                data: { nextPaymentDate: nextPayment }
            });

            // ✅ FIX: Atualizar status da LoanRequest para ACTIVE (antes estava faltando neste path)
            await prisma.loanRequest.update({
                where: { id },
                data: { status: 'ACTIVE' }
            });

            return res.json({ success: true, loanId: updatedLoan.id, message: 'Contrato atualizado com sucesso' });
        }

        // Criar novo contrato
        if (!request.customerId) {
            return res.status(400).json({ error: 'Cliente não encontrado' });
        }

        const loan = await prisma.loan.create({
            data: {
                customerId: request.customerId,
                requestId: request.id,
                amount: parseFloat(principalAmount),
                principalAmount: parseFloat(principalAmount),
                dailyInstallmentAmount: dailyInstallmentAmount ? parseFloat(dailyInstallmentAmount) : null,
                totalInstallments: parseInt(totalInstallments),
                installmentsCount: parseInt(totalInstallments),
                remainingAmount: parseFloat(principalAmount),
                status: 'ACTIVE',
                startDate: new Date(),
                firstPaymentDate: new Date(firstPaymentDate),
                pixReceiptUrl,
                interestRate: interestRate ? parseFloat(interestRate) : null,
                paymentFrequency: paymentFrequency || 'MONTHLY',
                dueDay: dueDay ? parseInt(dueDay) : null,
                adminNotes: adminNotes || null,
                isService: request.profileType === 'LIMPA_NOME',
                isInvestment: request.profileType === 'INVESTIDOR',
                isLoan: ['CLT', 'AUTONOMO', 'MOTO', 'GARANTIA'].includes(request.profileType || '')
            }
        });

        // Calcular próxima data de pagamento
        const nextPayment = new Date(firstPaymentDate);
        if (paymentFrequency === 'DAILY') {
            nextPayment.setDate(nextPayment.getDate() + 1);
        } else if (paymentFrequency === 'WEEKLY') {
            nextPayment.setDate(nextPayment.getDate() + 7);
        } else {
            nextPayment.setMonth(nextPayment.getMonth() + 1);
        }

        await prisma.loan.update({
            where: { id: loan.id },
            data: { nextPaymentDate: nextPayment }
        });

        // Gerar parcelas (prioridade: fixedInstallmentAmount > dailyInstallmentAmount > cálculo com juros)
        let installmentAmount: number;
        if (fixedInstallmentAmount) {
            installmentAmount = parseFloat(fixedInstallmentAmount);
        } else if (dailyInstallmentAmount) {
            installmentAmount = parseFloat(dailyInstallmentAmount);
        } else {
            const rate = interestRate ? parseFloat(interestRate) : 0;
            const totalWithInterest = rate > 0 ? parseFloat(principalAmount) * (1 + rate) : parseFloat(principalAmount);
            installmentAmount = totalWithInterest / parseInt(totalInstallments);
        }

        // Helper: adiciona N dias úteis (seg-sáb) pulando domingos
        function addBusinessDaysLocal(start: Date, days: number): Date {
            const result = new Date(start);
            let added = 0;
            while (added < days) {
                result.setDate(result.getDate() + 1);
                if (result.getDay() !== 0) added++; // 0 = domingo
            }
            return result;
        }

        const installments = [];
        const baseDate = new Date(firstPaymentDate);
        baseDate.setHours(0, 0, 0, 0);

        if (paymentFrequency === 'DAILY') {
            // Parcelas DIÁRIAS pulam domingos (Regra do Domingo)
            // 1ª parcela = firstPaymentDate (já definida pelo admin)
            // Próximas parcelas = próximo dia útil após a anterior
            let currentDue = new Date(baseDate);
            // Se firstPaymentDate cair em domingo, avança para segunda
            while (currentDue.getDay() === 0) {
                currentDue.setDate(currentDue.getDate() + 1);
            }
            for (let i = 0; i < parseInt(totalInstallments); i++) {
                installments.push({
                    loanId: loan.id,
                    dueDate: new Date(currentDue),
                    amount: installmentAmount,
                    status: 'OPEN'
                });
                if (i < parseInt(totalInstallments) - 1) {
                    // Próximo dia útil (pula domingo)
                    currentDue = addBusinessDaysLocal(currentDue, 1);
                }
            }
        } else {
            for (let i = 0; i < parseInt(totalInstallments); i++) {
                const dueDate = new Date(baseDate);
                if (paymentFrequency === 'WEEKLY') {
                    dueDate.setDate(dueDate.getDate() + (i * 7));
                } else {
                    dueDate.setMonth(dueDate.getMonth() + i);
                    if (dueDay) dueDate.setDate(parseInt(dueDay));
                }
                installments.push({
                    loanId: loan.id,
                    dueDate,
                    amount: installmentAmount,
                    status: 'OPEN'
                });
            }
        }
        await prisma.installment.createMany({ data: installments });

        // Atualizar customer
        await prisma.customer.update({
            where: { id: request.customerId },
            data: {
                activeLoansCount: { increment: 1 },
                totalDebt: { increment: parseFloat(principalAmount) }
            }
        });

        // Criar transação
        await prisma.transaction.create({
            data: {
                type: 'OUT',
                description: `Empréstimo ativado - ${request.clientName}`,
                amount: parseFloat(principalAmount),
                category: 'LOAN',
                date: new Date()
            }
        });

        // Atualizar status da solicitação
        await prisma.loanRequest.update({
            where: { id },
            data: { status: 'ACTIVE' }
        });

        // Notificação para o cliente
        const amountFormatted = parseFloat(principalAmount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

        if (request.customerId) {
            await prisma.notification.create({
                data: {
                    customerId: request.customerId,
                    customerEmail: request.email,
                    title: '💰 Contrato Ativado',
                    message: `Seu empréstimo de ${amountFormatted} foi liberado! Confira o comprovante no app.`,
                    type: 'SUCCESS'
                }
            }).catch(() => { });
        }

        // WhatsApp para o cliente
        if (request.phone) {
            const waMsg = `💰 *CONTRATO ATIVADO!*\n\n` +
                `Olá, ${request.clientName}!\n\n` +
                `Seu empréstimo de *${amountFormatted}* foi liberado! 🎉\n\n` +
                `📱 Confira o comprovante de transferência no app.\n\n` +
                `_Tubarão Empréstimos 🦈_`;

            sendWhatsAppNotification(request.phone, waMsg);
        }

        // Push para o cliente
        if (request.userId) {
            sendPushToUser(request.userId, '💰 Contrato Ativado', `Seu empréstimo de ${amountFormatted} foi liberado!`).catch(() => { });
        }

        // Notificação para admins (InApp + Push)
        await prisma.notification.create({
            data: {
                title: '✅ Contrato Ativado',
                message: `Contrato de ${request.clientName} (${amountFormatted}) foi ativado com sucesso.`,
                type: 'SUCCESS',
                requestId: id
            }
        }).catch(() => { });
        sendPushToRole('ADMIN', '✅ Contrato Ativado', `${request.clientName} — ${amountFormatted}`).catch(() => { });

        // ====== GERAR CONTRATO AUTOMATICAMENTE ======
        try {
            const { generateContractHTML, saveDocument, getCompanySettings } = await import('../services/documentService');
            const settings = await getCompanySettings();

            const customer = await prisma.customer.findUnique({
                where: { id: request.customerId! }
            });

            if (customer) {
                const contractHTML = generateContractHTML({
                    loan,
                    customer,
                    loanRequest: request,
                    settings
                });

                await saveDocument({
                    type: 'CONTRACT',
                    customerId: customer.id,
                    loanId: loan.id,
                    title: `Contrato de Empréstimo #${loan.id.substring(0, 8)}`,
                    htmlContent: contractHTML,
                    amount: parseFloat(principalAmount),
                    metadata: {
                        installments: parseInt(totalInstallments),
                        interestRate: interestRate || 0,
                        firstPaymentDate: firstPaymentDate
                    }
                });

                // Enviar contrato por email
                const { sendContractEmail } = await import('../services/emailService');
                await sendContractEmail({
                    email: request.email,
                    name: request.clientName,
                    contractHTML,
                    loanAmount: parseFloat(principalAmount),
                    installments: parseInt(totalInstallments)
                });

                console.log(`[LoanRequests] ✅ Contrato gerado e enviado para ${request.email}`);
            }
        } catch (docError: any) {
            console.error('[LoanRequests] Erro ao gerar contrato:', docError.message);
        }

        res.json({ success: true, loanId: loan.id });
    } catch (error: any) {
        console.error('[LoanRequests] Activate contract error:', error);
        res.status(500).json({ error: 'Erro ao ativar contrato' });
    }
});

// PUT /api/loan-requests/:id/approve-with-counteroffer — Aprovar com Contraproposta
loanRequestsRouter.put('/:id/approve-with-counteroffer', requireAdmin, async (req: Request, res: Response) => {
    try {
        const id = req.params.id as string;
        const { approvedAmount, interestRate, billingType, installments } = req.body;

        if (!approvedAmount || approvedAmount <= 0) {
            return res.status(400).json({ error: 'Valor aprovado inválido' });
        }

        // Buscar solicitação original
        const originalRequest = await prisma.loanRequest.findUnique({ where: { id } });
        if (!originalRequest) {
            return res.status(404).json({ error: 'Solicitação não encontrada' });
        }

        // Salvar valor original se ainda não foi salvo
        const requestedAmount = originalRequest.requestedAmount || originalRequest.amount;

        // 🔥 BUG FIX: Se valor aprovado = valor solicitado, não precisa aceite do cliente
        const needsAcceptance = parseFloat(approvedAmount) !== requestedAmount;

        // Atualizar solicitação com contraproposta
        const updateData: any = {
            requestedAmount, // Preservar valor original
            approvedAmount: parseFloat(approvedAmount),
            approvedAt: new Date(),
            approvedBy: { connect: { id: req.user!.id } },
            status: needsAcceptance ? 'PENDING_ACCEPTANCE' : 'APPROVED', // Se mesmo valor, já aprova direto
            counterOfferAccepted: !needsAcceptance // Se não precisa aceite, marca como aceito
        };

        // Se não precisa aceite, já marca data de aceite
        if (!needsAcceptance) {
            updateData.counterOfferAcceptedAt = new Date();
        }
        // Sempre salvar billingType e installments na solicitação
        if (billingType) updateData.billingType = billingType;
        if (installments !== undefined) updateData.installments = installments;

        // Salvar taxa de juros negociada, se informada
        if (interestRate && parseFloat(interestRate) > 0) {
            updateData.monthlyRate = parseFloat(interestRate);
        }



        const request = await prisma.loanRequest.update({
            where: { id },
            data: updateData
        });

        // ====== NOTIFICAÇÕES AUTOMÁTICAS ======
        const requestedFormatted = requestedAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        const approvedFormatted = parseFloat(approvedAmount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

        if (needsAcceptance) {
            // CONTRAPROPOSTA - precisa aceite do cliente
            // Email de contraproposta
            if (request.email) {
                const emailContent = brandedEmailHtml(`
                    <h2 style="color: #D4AF37;">🎉 Crédito Pré-Aprovado!</h2>
                    <p>Olá, <strong>${request.clientName}</strong>!</p>
                    <p>Temos uma ótima notícia! Seu pedido de crédito foi analisado e <strong style="color: #4CAF50;">PRÉ-APROVADO</strong>!</p>

                    <div style="background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%); border: 2px solid #D4AF37; border-radius: 12px; padding: 20px; margin: 20px 0;">
                        <p style="margin: 8px 0; color: #aaa;">Valor Solicitado:</p>
                        <p style="margin: 8px 0; font-size: 18px; text-decoration: line-through; color: #666;">${requestedFormatted}</p>

                        <p style="margin: 15px 0 8px 0; color: #D4AF37; font-weight: bold;">💰 Valor Liberado:</p>
                        <p style="margin: 8px 0; font-size: 32px; font-weight: bold; color: #4CAF50;">${approvedFormatted}</p>

                        <p style="margin: 15px 0 5px 0; color: #aaa; font-size: 13px;">
                            ✅ Crédito disponível para saque<br>
                            ✅ Sem consulta ao SPC/Serasa<br>
                            ✅ Aprovação em minutos
                        </p>
                    </div>

                    <div style="background: #1a1a1a; border-left: 4px solid #D4AF37; padding: 15px; margin: 20px 0;">
                        <p style="margin: 0; color: #D4AF37; font-weight: bold;">⚡ AÇÃO NECESSÁRIA</p>
                        <p style="margin: 10px 0 0 0;">Acesse o app agora e clique em <strong>"Aceitar Contrato"</strong> para liberar o saldo na sua conta!</p>
                    </div>

                    <p style="text-align: center; margin: 25px 0;">
                        <a href="https://www.tubaraoemprestimo.com.br" style="display: inline-block; background: #D4AF37; color: #000; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
                            ✍️ ACEITAR CONTRATO
                        </a>
                    </p>

                    <p style="color: #888; font-size: 13px; margin-top: 20px;">
                        <strong>Importante:</strong> Esta oferta é válida por 48 horas. Após este prazo, será necessário fazer uma nova análise.
                    </p>
                `);
                emailService.send(request.email, '🎉 Crédito Pré-Aprovado — Aceite Agora!', emailContent).catch(() => { });
            }

            // WhatsApp de contraproposta
            if (request.phone) {
                const waMsg = `🎉 *CRÉDITO PRÉ-APROVADO!*\n\n` +
                    `Olá, ${request.clientName.split(' ')[0]}!\n\n` +
                    `Seu pedido foi analisado e temos uma ótima notícia:\n\n` +
                    `💰 *Valor Liberado:* ${approvedFormatted}\n` +
                    `📊 *Parcelas:* ${request.installments}x\n\n` +
                    `✅ Crédito disponível para saque\n` +
                    `✅ Sem consulta ao SPC/Serasa\n` +
                    `✅ Aprovação em minutos\n\n` +
                    `⚡ *AÇÃO NECESSÁRIA:*\n` +
                    `Acesse o app e clique em *"Aceitar Contrato"* para liberar o saldo!\n\n` +
                    `🔗 https://www.tubaraoemprestimo.com.br\n\n` +
                    `⏰ Oferta válida por 48 horas.\n\n` +
                    `_Tubarão Empréstimos 🦈_`;

                sendWhatsAppNotification(request.phone, waMsg);
            }
        } else {
            // MESMO VALOR - aprovado direto, notificar que está aprovado
            if (request.email) {
                const emailContent = brandedEmailHtml(`
                    <h2 style="color: #4CAF50;">✅ Crédito Aprovado!</h2>
                    <p>Olá, <strong>${request.clientName}</strong>!</p>
                    <p>Seu pedido de crédito foi <strong style="color: #4CAF50;">APROVADO</strong>!</p>

                    <div style="background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%); border: 2px solid #4CAF50; border-radius: 12px; padding: 20px; margin: 20px 0;">
                        <p style="margin: 15px 0 8px 0; color: #4CAF50; font-weight: bold;">💰 Valor Aprovado:</p>
                        <p style="margin: 8px 0; font-size: 32px; font-weight: bold; color: #4CAF50;">${approvedFormatted}</p>
                        <p style="margin: 8px 0; color: #aaa;">Parcelas: ${request.installments}x</p>
                    </div>

                    <p>Aguarde o contato da nossa equipe para finalizar o processo e liberar o crédito!</p>
                `);
                emailService.send(request.email, '✅ Crédito Aprovado!', emailContent).catch(() => { });
            }

            if (request.phone) {
                const waMsg = `✅ *CRÉDITO APROVADO!*\n\n` +
                    `Olá, ${request.clientName.split(' ')[0]}!\n\n` +
                    `Seu pedido foi aprovado:\n\n` +
                    `💰 *Valor:* ${approvedFormatted}\n` +
                    `📊 *Parcelas:* ${request.installments}x\n\n` +
                    `Aguarde o contato da nossa equipe para finalizar!\n\n` +
                    `_Tubarão Empréstimos 🦈_`;

                sendWhatsAppNotification(request.phone, waMsg);
            }
        }

        // Notificação no sistema
        if (request.customerId) {
            await prisma.notification.create({
                data: {
                    customerId: request.customerId,
                    customerEmail: request.email,
                    title: '🎉 Crédito Pré-Aprovado!',
                    message: `Seu crédito de ${approvedFormatted} foi pré-aprovado! Acesse o app e aceite o contrato para liberar o saldo.`,
                    type: 'SUCCESS'
                }
            }).catch(() => { });
        }

        // Push notification para o cliente
        if (request.userId) {
            sendPushToUser(
                request.userId,
                '🎉 Crédito Pré-Aprovado!',
                `${approvedFormatted} liberado! Aceite o contrato agora.`
            ).catch(() => { });
        }

        res.json({ success: true, request });
    } catch (error: any) {
        console.error('[LoanRequests] Approve with counteroffer error:', error);
        res.status(500).json({ error: 'Erro ao aprovar com contraproposta' });
    }
});

// PUT /api/loan-requests/:id/accept-counteroffer — Cliente aceita a contraproposta
loanRequestsRouter.put('/:id/accept-counteroffer', async (req: Request, res: Response) => {
    try {
        const id = req.params.id as string;
        const userId = req.user!.id;

        // Buscar solicitação
        const request = await prisma.loanRequest.findUnique({ where: { id } });

        if (!request) {
            return res.status(404).json({ error: 'Solicitação não encontrada' });
        }

        // Verificar se é do usuário logado
        if (request.userId !== userId) {
            return res.status(403).json({ error: 'Acesso negado' });
        }

        // Verificar se está aguardando aceite
        if (request.status !== 'PENDING_ACCEPTANCE') {
            return res.status(400).json({ error: 'Esta solicitação não está aguardando aceite' });
        }

        // Verificar se já foi aceita
        if (request.counterOfferAccepted) {
            return res.status(400).json({ error: 'Contrato já foi aceito' });
        }

        // Atualizar para aceito e mudar status para APPROVED
        const updatedRequest = await prisma.loanRequest.update({
            where: { id },
            data: {
                counterOfferAccepted: true,
                counterOfferAcceptedAt: new Date(),
                status: 'APPROVED',
                amount: request.approvedAmount || request.amount // Usar valor aprovado
            }
        });

        // Criar empréstimo com o valor aprovado
        if (updatedRequest.customerId && updatedRequest.approvedAmount) {
            const loan = await prisma.loan.create({
                data: {
                    customerId: updatedRequest.customerId,
                    requestId: updatedRequest.id,
                    amount: updatedRequest.approvedAmount,
                    principalAmount: updatedRequest.approvedAmount, // ✅ FIX: Campo obrigatório
                    installmentsCount: updatedRequest.installments,
                    totalInstallments: updatedRequest.installments, // ✅ FIX: Campo obrigatório
                    remainingAmount: updatedRequest.approvedAmount,
                    status: 'APPROVED',
                    startDate: new Date(),
                    isService: updatedRequest.profileType === 'LIMPA_NOME',
                    isInvestment: updatedRequest.profileType === 'INVESTIDOR',
                    isLoan: ['CLT', 'AUTONOMO', 'MOTO', 'GARANTIA'].includes(updatedRequest.profileType || ''),
                    billingType: updatedRequest.billingType || (updatedRequest.profileType === 'AUTONOMO' ? 'DAILY' : 'MONTHLY')
                }
            });

            // Gerar parcelas (com juros se houver)
            const interestRate = updatedRequest.monthlyRate || 0;
            const totalWithInterest = interestRate > 0 ? updatedRequest.approvedAmount * (1 + interestRate) : updatedRequest.approvedAmount;
            const installmentAmount = totalWithInterest / updatedRequest.installments;
            const installments = [];
            for (let i = 1; i <= updatedRequest.installments; i++) {
                const dueDate = new Date();
                dueDate.setMonth(dueDate.getMonth() + i);
                if (updatedRequest.preferredDueDay) dueDate.setDate(updatedRequest.preferredDueDay);

                installments.push({
                    loanId: loan.id,
                    dueDate,
                    amount: installmentAmount,
                    status: 'OPEN'
                });
            }
            await prisma.installment.createMany({ data: installments });

            // Atualizar customer
            await prisma.customer.update({
                where: { id: updatedRequest.customerId },
                data: {
                    activeLoansCount: { increment: 1 },
                    totalDebt: { increment: updatedRequest.approvedAmount },
                    // ✅ DEMANDA 2: Sincronizar dados da solicitação para o perfil do cliente
                    instagram: updatedRequest.instagramHandle || undefined,
                    street: updatedRequest.street || undefined,
                    number: updatedRequest.number || undefined,
                    neighborhood: updatedRequest.neighborhood || undefined,
                    city: updatedRequest.city || undefined,
                    state: updatedRequest.state || undefined,
                    zipCode: updatedRequest.zipCode || undefined
                }
            });

            // Criar transação
            await prisma.transaction.create({
                data: {
                    type: 'OUT',
                    description: `Empréstimo aprovado (contraproposta aceita) - ${updatedRequest.clientName}`,
                    amount: updatedRequest.approvedAmount,
                    category: 'LOAN',
                    date: new Date()
                }
            });

            // ====== COMISSÃO DE PARCEIROS ======
            try {
                if (updatedRequest.partnerId && updatedRequest.isPartnerReferral) {
                    let commissionAmount = 0;
                    const profileType = updatedRequest.profileType || 'CLT';
                    const amount = updatedRequest.approvedAmount;

                    switch (profileType) {
                        case 'MOTO':
                            commissionAmount = 250;
                            break;
                        case 'LIMPA_NOME':
                            commissionAmount = 50;
                            break;
                        case 'INVESTIDOR':
                            commissionAmount = amount * 0.01;
                            break;
                        default:
                            if (amount >= 10000) {
                                commissionAmount = 180;
                            } else if (amount >= 5000) {
                                commissionAmount = 150;
                            } else {
                                commissionAmount = 120;
                            }
                            break;
                    }

                    await prisma.partnerCommission.create({
                        data: {
                            partnerId: updatedRequest.partnerId,
                            loanRequestId: updatedRequest.id,
                            contractId: loan.id,
                            totalCommission: commissionAmount,
                            commissionAmount: 0,
                            commissionRate: 0,
                            installmentsReleased: 0,
                            releasedPercent: 0,
                            status: 'PENDING',
                            notes: `Comissão ${profileType} - Contraproposta aceita - R$ ${commissionAmount.toFixed(2)}`
                        }
                    });
                }
            } catch (commissionErr) {
                console.error('[LoanRequests] Partner commission error:', commissionErr);
            }

            // ====== GERAR PIX PARA PARCELAS ======
            try {
                const pixSetting = await prisma.systemSetting.findFirst({ where: { key: 'pix_key' } });
                if (pixSetting?.value) {
                    const loanWithData = await prisma.loan.findFirst({
                        where: { id: loan.id },
                        include: { installments: true, customer: true }
                    });
                    if (loanWithData) {
                        const { generateInstallmentPixData, saveInstallmentQRCode } = await import('../services/pix');
                        for (const [index, inst] of loanWithData.installments.entries()) {
                            const installmentNum = index + 1;
                            const { pixCode, qrCodeBuffer } = await generateInstallmentPixData(
                                pixSetting.value,
                                Number(inst.amount),
                                loanWithData.customer.name,
                                loanWithData.customer.city || 'SAO PAULO',
                                installmentNum,
                                loanWithData.id
                            );
                            await saveInstallmentQRCode(prisma, inst.id, qrCodeBuffer, pixCode);
                        }
                    }
                }
            } catch (pixErr) {
                console.error('[LoanRequests] PIX generation error:', pixErr);
            }
        }

        // ====== NOTIFICAR ADMINS DO ACEITE ======
        try {
            const admins = await prisma.user.findMany({
                where: { role: 'ADMIN' }
            });

            const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

            for (const admin of admins) {
                await prisma.notification.create({
                    data: {
                        customerId: admin.id,
                        title: '✅ Cliente Aceitou Contraproposta',
                        message: `${request.clientName} aceitou a contraproposta de ${fmt(request.approvedAmount || 0)}. Ative o contrato agora!`,
                        type: 'SUCCESS',
                        requestId: id
                    }
                });
            }
        } catch (notifErr) {
            console.error('[LoanRequests] Admin notification error:', notifErr);
        }

        // ====== NOTIFICAÇÕES ======
        const approvedFormatted = (updatedRequest.approvedAmount || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

        // Email de confirmação
        if (updatedRequest.email) {
            const emailContent = brandedEmailHtml(`
                <h2 style="color: #4CAF50;">✅ Contrato Aceito com Sucesso!</h2>
                <p>Olá, <strong>${updatedRequest.clientName}</strong>!</p>
                <p>Seu contrato foi aceito e o crédito está sendo processado!</p>

                <div style="background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%); border: 2px solid #4CAF50; border-radius: 12px; padding: 20px; margin: 20px 0; text-align: center;">
                    <p style="margin: 0; color: #4CAF50; font-size: 16px;">💰 Valor Liberado</p>
                    <p style="margin: 10px 0; font-size: 36px; font-weight: bold; color: #4CAF50;">${approvedFormatted}</p>
                    <p style="margin: 0; color: #aaa; font-size: 14px;">Em ${updatedRequest.installments}x parcelas</p>
                </div>

                <div style="background: #1a1a1a; border-left: 4px solid #D4AF37; padding: 15px; margin: 20px 0;">
                    <p style="margin: 0 0 10px 0; color: #D4AF37; font-weight: bold;">📋 Próximos Passos:</p>
                    <p style="margin: 5px 0;">✅ Seu crédito está sendo transferido</p>
                    <p style="margin: 5px 0;">✅ Você receberá os boletos/PIX das parcelas</p>
                    <p style="margin: 5px 0;">✅ Acompanhe tudo pelo app</p>
                </div>

                <p style="text-align: center; margin: 25px 0;">
                    <a href="https://www.tubaraoemprestimo.com.br" style="display: inline-block; background: #D4AF37; color: #000; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
                        ACESSAR MEU PAINEL
                    </a>
                </p>
            `);
            emailService.send(updatedRequest.email, '✅ Contrato Aceito — Tubarão Empréstimos', emailContent).catch(() => { });
        }

        // WhatsApp de confirmação
        if (updatedRequest.phone) {
            const waMsg = `✅ *CONTRATO ACEITO!*\n\n` +
                `Parabéns, ${updatedRequest.clientName.split(' ')[0]}!\n\n` +
                `Seu contrato foi aceito com sucesso!\n\n` +
                `💰 *Valor:* ${approvedFormatted}\n` +
                `📊 *Parcelas:* ${updatedRequest.installments}x\n\n` +
                `📋 *Próximos Passos:*\n` +
                `✅ Seu crédito está sendo transferido\n` +
                `✅ Você receberá os boletos/PIX\n` +
                `✅ Acompanhe pelo app\n\n` +
                `🔗 https://www.tubaraoemprestimo.com.br\n\n` +
                `_Tubarão Empréstimos 🦈_`;

            sendWhatsAppNotification(updatedRequest.phone, waMsg);
        }

        // Notificação no sistema
        if (updatedRequest.customerId) {
            await prisma.notification.create({
                data: {
                    customerId: updatedRequest.customerId,
                    customerEmail: updatedRequest.email,
                    title: '✅ Contrato Aceito!',
                    message: `Seu contrato de ${approvedFormatted} foi aceito! O crédito está sendo processado.`,
                    type: 'SUCCESS'
                }
            }).catch(() => { });
        }

        // Push para o cliente
        if (updatedRequest.userId) {
            sendPushToUser(updatedRequest.userId, '✅ Contrato Aceito!', `Seu contrato de ${approvedFormatted} foi aceito! Aguarde a liberação.`).catch(() => { });
        }

        // NOTIFICAR ADMIN — Push + Email + WhatsApp
        await sendPushToRole('ADMIN', '✅ Contraproposta Aceita', `${updatedRequest.clientName} aceitou ${approvedFormatted}. Ative o contrato!`).catch(() => { });
        try {
            const adminEmail = await prisma.systemSetting.findFirst({ where: { key: 'admin_email' } });
            if (adminEmail?.value) {
                emailService.send(
                    adminEmail.value,
                    '✅ Cliente Aceitou Contraproposta — Ação Necessária',
                    brandedEmailHtml(`<h2 style="color:#4CAF50;">✅ Contraproposta Aceita!</h2><p><strong>${updatedRequest.clientName}</strong> aceitou a contraproposta de <strong>${approvedFormatted}</strong>.</p><p>Acesse o painel para ativar o contrato agora!</p>`)
                ).catch(() => { });
            }
            const adminPhone = await prisma.systemSetting.findFirst({ where: { key: 'admin_phone' } });
            if (adminPhone?.value) {
                sendWhatsAppNotification(adminPhone.value,
                    `✅ *CONTRAPROPOSTA ACEITA!*\n\n${updatedRequest.clientName} aceitou ${approvedFormatted}.\n\nAcesse o painel e ative o contrato agora!\n\n_Tubarão Empréstimos 🦈_`
                );
            }
        } catch (_e) { /* não bloquear */ }

        res.json({ success: true, request: updatedRequest });
    } catch (error: any) {
        console.error('[LoanRequests] Accept counteroffer error:', error);
        res.status(500).json({ error: 'Erro ao aceitar contraproposta' });
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

        // Push notification para o cliente
        if (loanRequest.userId) {
            sendPushToUser(loanRequest.userId, 'Solicitação Atualizada', 'Sua solicitação foi atualizada. Acesse o app.').catch(() => { });
        }

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao rejeitar' });
    }
});

// PUT /api/loan-requests/:id/values — Atualizar valores
loanRequestsRouter.put('/:id/values', requireAdmin, async (req: Request, res: Response) => {
    try {
        const { amount, installments, companyPaymentDay } = req.body;
        const dataToUpdate: any = { amount, installments };

        if (companyPaymentDay !== undefined) {
            const parsedCompanyPaymentDay = parseInt(String(companyPaymentDay), 10);
            dataToUpdate.companyPaymentDay = Number.isFinite(parsedCompanyPaymentDay) && parsedCompanyPaymentDay > 0
                ? parsedCompanyPaymentDay
                : null;
        }

        await prisma.loanRequest.update({
            where: { id: req.params.id as string },
            data: dataToUpdate
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
        const loanRequest = await prisma.loanRequest.update({
            where: { id: req.params.id as string },
            data: {
                status: 'WAITING_DOCS',
                supplementalDescription: description,
                supplementalRequestedAt: new Date()
            }
        });

        // ====== NOTIFICAÇÕES - Documentos Pendentes ======
        if (loanRequest.email) {
            const html = brandedEmailHtml(`
                <h2 style="color: #FFD700;">📄 Documentos Solicitados</h2>
                <p>Olá, <strong>${loanRequest.clientName}</strong>!</p>
                <p>Precisamos de documentos adicionais para dar andamento à sua solicitação:</p>
                <div style="background:#111;border:1px solid #333;border-radius:8px;padding:15px;margin:15px 0;">
                    <p style="color:#D4AF37;font-weight:bold;">Documentos necessários:</p>
                    <p style="color:#ccc;">${description || 'Acesse o app para ver os detalhes.'}</p>
                </div>
                <p style="color: #aaa;">Envie os documentos o mais breve possível para agilizar a análise.</p>
                <div style="text-align: center; margin: 20px 0;">
                    <a href="https://www.tubaraoemprestimo.com.br" style="background: #D4AF37; color: #000; padding: 12px 30px; border-radius: 8px; text-decoration: none; font-weight: bold;">Enviar Documentos</a>
                </div>
            `);
            emailService.send(loanRequest.email, '📄 Documentos Solicitados — Tubarão Empréstimos', html).catch(err => console.error('[Supplemental] Email failed:', err.message));
        }

        if (loanRequest.phone) {
            sendWhatsAppNotification(loanRequest.phone,
                `📄 *Documentos Solicitados*\n\nOlá, ${loanRequest.clientName?.split(' ')[0]}!\n\nPrecisamos de documentos adicionais para sua solicitação:\n\n${description || 'Acesse o app para detalhes.'}\n\nEnvie pelo app o mais rápido possível.\n\n_Tubarão Empréstimos 🦈_`
            );
        }

        if (loanRequest.customerId) {
            await prisma.notification.create({
                data: {
                    customerId: loanRequest.customerId,
                    customerEmail: loanRequest.email,
                    title: '📄 Documentos Solicitados',
                    message: `Precisamos de documentos adicionais: ${description || 'Acesse o app.'}`,
                    type: 'WARNING'
                }
            }).catch(() => { });
        }

        if (loanRequest.userId) {
            sendPushToUser(loanRequest.userId, '📄 Documentos Solicitados', 'Precisamos de documentos adicionais. Acesse o app.').catch(() => { });
        }

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Erro' });
    }
});

// PUT /api/loan-requests/:id/supplemental-upload — Upload doc suplementar
loanRequestsRouter.put('/:id/supplemental-upload', async (req: Request, res: Response) => {
    try {
        const { docUrl, addressProofUrl, instagramHandle } = req.body;
        const id = req.params.id as string;

        // Buscar solicitação para validar e notificar
        const loanRequest = await prisma.loanRequest.findUnique({
            where: { id }
        });

        if (!loanRequest) {
            return res.status(404).json({ error: 'Solicitação não encontrada' });
        }

        // Verificar se é o dono da solicitação (cliente só pode enviar seus próprios docs)
        if (req.user!.role !== 'ADMIN' && loanRequest.userId !== req.user!.id) {
            return res.status(403).json({ error: 'Não autorizado' });
        }

        // Atualizar documentos e voltar status para PENDING
        const updated = await prisma.loanRequest.update({
            where: { id },
            data: {
                supplementalDocUrl: docUrl || loanRequest.supplementalDocUrl,
                addressProofUrl: addressProofUrl || loanRequest.addressProofUrl,
                instagramHandle: instagramHandle || loanRequest.instagramHandle,
                supplementalUploadedAt: new Date(),
                status: 'PENDING' // Volta para análise do admin
            }
        });

        // Notificar admin — Push + InApp
        await sendPushToRole('ADMIN', '📄 Documentos Adicionais Enviados', `${loanRequest.clientName} enviou os documentos solicitados`);

        await prisma.notification.create({
            data: {
                customerId: null,
                customerEmail: null,
                title: '📄 Documentos Adicionais Enviados',
                message: `${loanRequest.clientName} enviou os documentos solicitados.`,
                type: 'DOCS_UPLOADED',
                isRead: false,
                requestId: id
            }
        });

        // Email + WhatsApp para admin (se configurado)
        try {
            const adminSettings = await prisma.systemSetting.findFirst({ where: { key: 'admin_phone' } });
            if (adminSettings?.value) {
                sendWhatsAppNotification(adminSettings.value,
                    `📄 *Documentos Enviados*\n\n${loanRequest.clientName} enviou os documentos adicionais solicitados.\n\nAcesse o painel para analisar.\n\n_Tubarão Empréstimos 🦈_`
                );
            }
            const adminEmail = await prisma.systemSetting.findFirst({ where: { key: 'admin_email' } });
            if (adminEmail?.value) {
                emailService.send(
                    adminEmail.value,
                    '📄 Documentos Adicionais Enviados — Tubarão Empréstimos',
                    brandedEmailHtml(`<h2>📄 Documentos Enviados</h2><p><strong>${loanRequest.clientName}</strong> enviou os documentos adicionais solicitados.</p><p>Acesse o painel para analisar a solicitação.</p>`)
                ).catch(() => { });
            }
        } catch (_e) { /* não bloquear */ }

        res.json({ success: true, request: updated });
    } catch (error) {
        console.error('Erro ao enviar documentos adicionais:', error);
        res.status(500).json({ error: 'Erro ao enviar documentos' });
    }
});

/**
 * POST /api/loan-requests/broadcast
 * Envia mensagem em massa para clientes selecionados (ADMIN ONLY)
 * Body: { requestIds: string[], message: string, type: string }
 */
loanRequestsRouter.post('/broadcast', authenticate, requireAdmin, async (req: Request, res: Response) => {
    try {
        const { requestIds, message, type } = req.body;

        if (!requestIds || !Array.isArray(requestIds) || requestIds.length === 0) {
            return res.status(400).json({ error: 'Selecione pelo menos um destinatário' });
        }
        if (!message || message.trim().length === 0) {
            return res.status(400).json({ error: 'Mensagem é obrigatória' });
        }

        // Buscar dados de telefone e nome dos clientes selecionados
        const requests = await prisma.loanRequest.findMany({
            where: { id: { in: requestIds } },
            select: { id: true, clientName: true, phone: true, status: true }
        });

        // Responde imediatamente e processa em background
        res.json({ success: true, total: requests.length, message: 'Disparo iniciado em background' });

        // Processar envios em background com delay entre cada um
        (async () => {
            let sent = 0;
            let failed = 0;

            for (const req of requests) {
                try {
                    if (!req.phone) { failed++; continue; }

                    const firstName = req.clientName?.split(' ')[0] || 'Cliente';
                    const finalMessage = message
                        .replace(/\{nome\}/gi, firstName)
                        .replace(/\{name\}/gi, firstName)
                        .replace(/\{clientName\}/gi, firstName);

                    await sendWhatsAppNotification(req.phone, finalMessage);
                    sent++;

                    // Delay de 1.5s entre envios para não sobrecarregar a API
                    await new Promise(resolve => setTimeout(resolve, 1500));
                } catch (e) {
                    console.error(`[Broadcast] Falha ao enviar para ${req.clientName}:`, e);
                    failed++;
                }
            }

            console.log(`[Broadcast] Concluído: ${sent} enviados, ${failed} falhas. Tipo: ${type}`);
        })();

    } catch (error) {
        console.error('Erro no broadcast:', error);
        res.status(500).json({ error: 'Erro ao iniciar disparo' });
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

// DELETE - Excluir solicitação (soft delete)
loanRequestsRouter.delete('/:id', requireAdmin, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;

        const request = await prisma.loanRequest.findUnique({ where: { id } });
        if (!request) {
            return res.status(404).json({ error: 'Solicitação não encontrada' });
        }

        await prisma.loanRequest.update({
            where: { id },
            data: {
                status: 'CANCELLED'
            }
        });

        // Notificar cliente
        if (request.customerId) {
            await prisma.notification.create({
                data: {
                    customerId: request.customerId,
                    title: 'Solicitação Cancelada',
                    message: `Sua solicitação foi cancelada. ${reason || 'Entre em contato para mais informações.'}`,
                    type: 'WARNING'
                }
            });
        }

        // WhatsApp
        if (request.phone) {
            await sendWhatsAppMessage(request.phone,
                `Olá ${request.clientName}, sua solicitação foi cancelada. ${reason || 'Entre em contato para mais informações.'}`
            );
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Erro ao excluir solicitação:', error);
        res.status(500).json({ error: 'Erro ao excluir solicitação' });
    }
});

// PUT - Pausar solicitação
loanRequestsRouter.put('/:id/pause', requireAdmin, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;

        const request = await prisma.loanRequest.findUnique({ where: { id } });
        if (!request) {
            return res.status(404).json({ error: 'Solicitação não encontrada' });
        }

        await prisma.loanRequest.update({
            where: { id },
            data: {
                status: 'PAUSED'
            }
        });

        // Notificar cliente
        if (request.customerId) {
            await prisma.notification.create({
                data: {
                    customerId: request.customerId,
                    title: 'Solicitação Pausada',
                    message: `Sua solicitação foi pausada temporariamente. ${reason || ''}`,
                    type: 'INFO'
                }
            });
        }

        res.json({ success: true, previousStatus: request.status });
    } catch (error) {
        console.error('Erro ao pausar solicitação:', error);
        res.status(500).json({ error: 'Erro ao pausar solicitação' });
    }
});

// PUT - Retomar solicitação pausada
loanRequestsRouter.put('/:id/resume', requireAdmin, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const request = await prisma.loanRequest.findUnique({ where: { id } });
        if (!request) {
            return res.status(404).json({ error: 'Solicitação não encontrada' });
        }

        if (request.status !== 'PAUSED') {
            return res.status(400).json({ error: 'Solicitação não está pausada' });
        }

        // Extrair status anterior do adminNotes
        const match = request.adminNotes?.match(/anterior: (\w+)/);
        const previousStatus = match ? match[1] : 'PENDING';

        await prisma.loanRequest.update({
            where: { id },
            data: {
                status: previousStatus,
                adminNotes: `Retomado em ${new Date().toISOString()}`
            }
        });

        res.json({ success: true });
    } catch (error) {
        console.error('Erro ao retomar solicitação:', error);
        res.status(500).json({ error: 'Erro ao retomar solicitação' });
    }
});

