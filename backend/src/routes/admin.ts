import { Router, Request, Response } from 'express';
import { prisma } from '../services/prisma';
import { authenticate } from '../middleware/auth';
import bcrypt from 'bcryptjs';
import { sendWhatsAppMessage } from '../services/whatsapp';

export const adminRouter = Router();

// Middleware para garantir que é admin
const isAdmin = async (req: Request, res: Response, next: Function) => {
    if (req.user?.role !== 'ADMIN') {
        res.status(403).json({ error: 'Acesso negado. Apenas administradores.' });
        return;
    }
    next();
};

// =============================================
// BLACKLIST
// =============================================

// GET /api/admin/blacklist - Listar blacklist
adminRouter.get('/blacklist', authenticate, isAdmin, async (req: Request, res: Response) => {
    try {
        const blacklist = await prisma.blacklist.findMany({
            orderBy: { addedAt: 'desc' }
        });
        res.json(blacklist);
    } catch (err) {
        console.error('[Admin] Error fetching blacklist:', err);
        res.status(500).json({ error: 'Erro ao buscar blacklist' });
    }
});

// POST /api/admin/blacklist - Adicionar à blacklist
adminRouter.post('/blacklist', authenticate, isAdmin, async (req: Request, res: Response) => {
    try {
        const { cpf, name, reason } = req.body;
        const cleanCpf = cpf.replace(/\D/g, '');

        if (!cleanCpf || !name || !reason) {
            res.status(400).json({ error: 'Dados incompletos' });
            return;
        }

        const existing = await prisma.blacklist.findUnique({ where: { cpf: cleanCpf } });
        if (existing) {
            res.status(400).json({ error: 'CPF já está na blacklist' });
            return;
        }

        const entry = await prisma.blacklist.create({
            data: {
                cpf: cleanCpf,
                name,
                reason,
                addedBy: req.user!.name,
                active: true
            }
        });

        res.json(entry);
    } catch (err) {
        console.error('[Admin] Error adding to blacklist:', err);
        res.status(500).json({ error: 'Erro ao adicionar à blacklist' });
    }
});

// DELETE /api/admin/blacklist/:id - Remover da blacklist
adminRouter.delete('/blacklist/:id', authenticate, isAdmin, async (req: Request, res: Response) => {
    try {
        const id = String(req.params.id);
        await prisma.blacklist.delete({ where: { id } });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao remover da blacklist' });
    }
});

// =============================================
// ANALYTICS DE CONTRAPROPOSTAS
// =============================================

// GET /api/admin/counteroffer-analytics
adminRouter.get('/counteroffer-analytics', authenticate, isAdmin, async (req: Request, res: Response) => {
    try {
        // Total de contrapropostas enviadas
        const totalCounterOffers = await prisma.loanRequest.count({
            where: { approvedAmount: { not: null } }
        });

        // Total aceitas
        const totalAccepted = await prisma.loanRequest.count({
            where: {
                approvedAmount: { not: null },
                counterOfferAccepted: true
            }
        });

        // Aguardando aceite
        const pendingAcceptance = await prisma.loanRequest.count({
            where: { status: 'PENDING_ACCEPTANCE' }
        });

        // Taxa de aceite
        const acceptanceRate = totalCounterOffers > 0
            ? Math.round((totalAccepted / totalCounterOffers) * 100)
            : 0;

        // Todas as contrapropostas com dados para cálculos
        const allCounterOffers = await prisma.loanRequest.findMany({
            where: { approvedAmount: { not: null } },
            select: {
                id: true,
                clientName: true,
                amount: true,
                requestedAmount: true,
                approvedAmount: true,
                approvedAt: true,
                counterOfferAccepted: true,
                counterOfferAcceptedAt: true,
                status: true,
                profileType: true,
                createdAt: true
            },
            orderBy: { approvedAt: 'desc' },
            take: 50
        });

        // Tempo médio de aceite (em horas)
        const acceptedOffers = allCounterOffers.filter(o => o.counterOfferAccepted && o.approvedAt && o.counterOfferAcceptedAt);
        let avgAcceptanceTimeHours = 0;
        let fastAcceptCount = 0; // Aceitos em menos de 1h

        if (acceptedOffers.length > 0) {
            const totalMs = acceptedOffers.reduce((sum, o) => {
                const diff = new Date(o.counterOfferAcceptedAt!).getTime() - new Date(o.approvedAt!).getTime();
                if (diff < 60 * 60 * 1000) fastAcceptCount++; // Menos de 1h
                return sum + diff;
            }, 0);
            avgAcceptanceTimeHours = Math.round((totalMs / acceptedOffers.length) / (1000 * 60 * 60) * 10) / 10;
        }

        // Valor total aprovado vs solicitado
        const totalRequested = allCounterOffers.reduce((sum, o) => sum + (o.requestedAmount || o.amount), 0);
        const totalApproved = allCounterOffers.reduce((sum, o) => sum + (o.approvedAmount || 0), 0);
        const avgDiscountRate = totalRequested > 0
            ? Math.round(((totalRequested - totalApproved) / totalRequested) * 100)
            : 0;

        // Por perfil
        const byProfile: Record<string, { total: number; accepted: number; rate: number }> = {};
        for (const offer of allCounterOffers) {
            const profile = offer.profileType || 'N/A';
            if (!byProfile[profile]) byProfile[profile] = { total: 0, accepted: 0, rate: 0 };
            byProfile[profile].total++;
            if (offer.counterOfferAccepted) byProfile[profile].accepted++;
        }
        for (const profile of Object.keys(byProfile)) {
            byProfile[profile].rate = byProfile[profile].total > 0
                ? Math.round((byProfile[profile].accepted / byProfile[profile].total) * 100)
                : 0;
        }

        res.json({
            success: true,
            analytics: {
                totalCounterOffers,
                totalAccepted,
                pendingAcceptance,
                acceptanceRate,
                avgAcceptanceTimeHours,
                fastAcceptCount, // Aceitos em menos de 1h (badge "Aprovação Rápida")
                totalRequested: Math.round(totalRequested * 100) / 100,
                totalApproved: Math.round(totalApproved * 100) / 100,
                avgDiscountRate,
                byProfile
            },
            recentOffers: allCounterOffers
        });
    } catch (err) {
        console.error('[Admin] Error fetching counteroffer analytics:', err);
        res.status(500).json({ error: 'Erro ao buscar analytics de contrapropostas' });
    }
});

// =============================================
// ENVIO MANUAL DE ACESSO AO APP
// =============================================

// POST /api/admin/send-access — Admin envia login e senha para cliente antigo via WhatsApp
adminRouter.post('/send-access', authenticate, isAdmin, async (req: Request, res: Response) => {
    try {
        const { customerId, phone, name, email, cpf } = req.body;

        if (!phone || !name) {
            return res.status(400).json({ error: 'Telefone e nome são obrigatórios' });
        }

        const cleanPhone = phone.replace(/\D/g, '');

        // Verifica se já existe usuário com esse telefone ou email
        let user = await prisma.user.findFirst({
            where: email ? { email } : undefined
        });

        let customer = customerId
            ? await prisma.customer.findUnique({ where: { id: customerId } })
            : null;

        // Gera senha aleatória
        const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#';
        const password = Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
        const hashedPassword = await bcrypt.hash(password, 12);

        if (!user) {
            // Cria usuário novo
            const userEmail = email || `${cleanPhone}@tubarao.app`;
            user = await prisma.user.create({
                data: {
                    email: userEmail,
                    password: hashedPassword,
                    name,
                    phone: cleanPhone,
                    role: 'CLIENT'
                }
            });

            // Cria customer se não existir
            if (!customer) {
                customer = await prisma.customer.create({
                    data: {
                        userId: user.id,
                        name,
                        cpf: cpf ? cpf.replace(/\D/g, '') : '00000000000',
                        email: userEmail,
                        phone: cleanPhone,
                        status: 'ACTIVE'
                    }
                });
            }

            console.log(`[Admin] Novo usuário criado: ${user.email} para ${name} (${cleanPhone})`);
        } else {
            // Atualiza senha do usuário existente
            await prisma.user.update({
                where: { id: user.id },
                data: { password: hashedPassword }
            });
            console.log(`[Admin] Senha atualizada para usuário existente: ${user.email}`);
        }

        // Envia credenciais via WhatsApp
        const appUrl = 'https://www.tubaraoemprestimo.com.br';
        const msg =
            `🦈 *Tubarão Empréstimos — Acesso ao App*\n\n` +
            `Olá, ${name}! Seu acesso ao sistema foi liberado pelo administrador.\n\n` +
            `📱 *Acesse:* ${appUrl}\n\n` +
            `🔑 *Suas credenciais:*\n` +
            `• E-mail: ${user.email}\n` +
            `• Senha: ${password}\n\n` +
            `⚠️ Recomendamos trocar sua senha no primeiro acesso.\n\n` +
            `_Qualquer dúvida, fale conosco aqui no WhatsApp._`;

        await sendWhatsAppMessage(cleanPhone, msg);

        // Notificação no banco
        if (customer) {
            await prisma.notification.create({
                data: {
                    customerId: customer.id,
                    title: '📱 Acesso Liberado!',
                    message: `Seu acesso ao app foi liberado. Verifique suas credenciais no WhatsApp.`,
                    type: 'SUCCESS'
                }
            }).catch(() => { });
        }

        return res.json({
            success: true,
            message: `Acesso enviado via WhatsApp para ${cleanPhone}`,
            email: user.email,
            userId: user.id,
            customerId: customer?.id
        });
    } catch (err: any) {
        console.error('[Admin] Erro ao enviar acesso:', err);
        return res.status(500).json({ error: 'Erro ao enviar acesso: ' + err.message });
    }
});
