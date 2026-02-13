import { Router, Request, Response } from 'express';
import { prisma } from '../services/prisma';
import { authenticate, requireAdmin } from '../middleware/auth';
import axios from 'axios';
import { emailService } from '../services/email';

export const campaignsRouter = Router();
campaignsRouter.use(authenticate);

// ============ Helpers ============

/**
 * Normaliza telefone para formato internacional
 */
function normalizePhone(phone: string): string {
    let number = phone.replace(/\D/g, '');
    if (!number.startsWith('55') && number.length >= 10) {
        number = '55' + number;
    }
    return number;
}

/**
 * Envia mensagem WhatsApp via Evolution API
 */
async function sendWhatsApp(
    config: { apiUrl: string; apiKey: string; instanceName: string },
    phone: string, text: string
): Promise<boolean> {
    try {
        const url = `${config.apiUrl}/message/sendText/${config.instanceName}`;
        await axios.post(url, {
            number: normalizePhone(phone),
            options: { delay: 1500, presence: 'composing', linkPreview: false },
            textMessage: { text }
        }, { headers: { apikey: config.apiKey }, timeout: 15000 });
        return true;
    } catch {
        return false;
    }
}

/**
 * Envia email branded
 */
async function sendEmail(to: string, subject: string, body: string): Promise<boolean> {
    const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #000; color: #fff; padding: 30px; border-radius: 12px;">
        <div style="text-align: center; margin-bottom: 20px;">
            <h1 style="color: #D4AF37; font-size: 24px;">🦈 Tubarão Empréstimos</h1>
        </div>
        <div style="color: #ccc; font-size: 15px; line-height: 1.6;">
            ${body.replace(/\n/g, '<br>')}
        </div>
        <hr style="border-color: #333; margin: 25px 0;" />
        <p style="color: #666; font-size: 12px; text-align: center;">
            Tubarão Empréstimos — Plataforma de Crédito Premium<br/>
            <span style="color: #555;">Este é um email automático. Não responda.</span>
        </p>
    </div>`;
    return emailService.send(to, subject, html);
}

// ============ ROUTES ============

// GET /api/campaigns - Listar
campaignsRouter.get('/', requireAdmin, async (_req: Request, res: Response) => {
    try {
        const campaigns = await prisma.campaign.findMany({ orderBy: { priority: 'desc' } });
        res.json(campaigns);
    } catch { res.status(500).json({ error: 'Erro' }); }
});

// GET /api/campaigns/active - Listar ativas (para o Cliente)
// IMPORTANTE: Esta rota deve vir ANTES de /:id para não conflitar
campaignsRouter.get('/active', async (_req: Request, res: Response) => {
    try {
        const now = new Date();
        const campaigns = await prisma.campaign.findMany({
            where: {
                active: true,
                startDate: { lte: now },
                endDate: { gte: now }
            },
            orderBy: { priority: 'desc' },
            take: 3
        });
        res.json(campaigns);
    } catch { res.status(500).json({ error: 'Erro' }); }
});

// POST /api/campaigns - Criar/Atualizar
campaignsRouter.post('/', requireAdmin, async (req: Request, res: Response) => {
    try {
        const { id, title, description, imageUrl, link, startDate, endDate, frequency, priority } = req.body;

        const data: any = { title, description, imageUrl, link, frequency, priority, startDate: new Date(startDate), endDate: new Date(endDate) };

        if (id) {
            await prisma.campaign.update({ where: { id }, data });
        } else {
            await prisma.campaign.create({ data: { ...data, active: true } });
        }
        res.json({ success: true });
    } catch { res.status(500).json({ error: 'Erro ao salvar' }); }
});

// DELETE /api/campaigns/:id - Deletar
campaignsRouter.delete('/:id', requireAdmin, async (req: Request, res: Response) => {
    try {
        await prisma.campaign.delete({ where: { id: req.params.id as string } });
        res.json({ success: true });
    } catch { res.status(500).json({ error: 'Erro' }); }
});

// ============ DISPATCH (Substitui a Edge Function send-campaign) ============

// POST /api/campaigns/send - Disparar campanha ou cupom para todos os clientes
campaignsRouter.post('/send', requireAdmin, async (req: Request, res: Response) => {
    try {
        const { type, id } = req.body;

        if (!type || !id) {
            res.status(400).json({ error: 'Campos obrigatórios: type (campaign | coupon), id' });
            return;
        }

        console.log(`[Campaigns] Disparando ${type}: ${id}`);

        // 1. Busca config do WhatsApp
        const waConfig = await prisma.whatsappConfig.findFirst();
        const waEnabled = waConfig && waConfig.isConnected && waConfig.apiUrl && waConfig.apiKey;

        // 2. Busca clientes ativos com telefone
        const customers = await prisma.customer.findMany({
            where: { status: 'ACTIVE', phone: { not: '' } },
            select: { id: true, name: true, phone: true, email: true }
        });

        if (customers.length === 0) {
            res.json({ success: true, sent: 0, message: 'Nenhum cliente ativo para enviar' });
            return;
        }

        let message = '';
        let targetCustomers = customers;
        let sent = 0, failed = 0, emailsSent = 0;
        let emailSubject = '';

        // ============= CAMPAIGN =============
        if (type === 'campaign') {
            const campaign = await prisma.campaign.findUnique({ where: { id } });
            if (!campaign) {
                res.status(404).json({ error: 'Campanha não encontrada' });
                return;
            }

            message = `🎯 *${campaign.title}*\n\n` +
                `${campaign.description || ''}\n\n` +
                `${campaign.link ? `👉 Acesse: ${campaign.link}` : ''}\n\n` +
                `📱 *Baixe o App:*\nhttps://www.tubaraoemprestimo.com.br/\n\n` +
                `_Tubarão Empréstimos 🦈_`;

            emailSubject = `🎯 ${campaign.title} — Tubarão Empréstimos`;
        }

        // ============= COUPON =============
        if (type === 'coupon') {
            const coupon = await prisma.coupon.findUnique({ where: { id } });
            if (!coupon) {
                res.status(404).json({ error: 'Cupom não encontrado' });
                return;
            }

            const expiresText = coupon.expiresAt
                ? `\n⏰ Válido até: ${new Date(coupon.expiresAt).toLocaleDateString('pt-BR')}`
                : '';

            message = `🎉 *CUPOM EXCLUSIVO!*\n\n` +
                `Use o código *${coupon.code}* e ganhe *${coupon.discount}% de desconto*!\n` +
                `${coupon.description || ''}\n` +
                `${expiresText}\n\n` +
                `📱 *Acesse o App:*\nhttps://www.tubaraoemprestimo.com.br/\n\n` +
                `_Tubarão Empréstimos 🦈_`;

            emailSubject = '🎁 Cupom de Desconto Especial — Tubarão Empréstimos';

            // Se cupom é para cliente específico
            if (coupon.customerEmail) {
                targetCustomers = customers.filter(c =>
                    c.email.toLowerCase() === coupon.customerEmail!.toLowerCase()
                );
            }
        }

        // ============= ENVIAR =============
        // Responde imediatamente com estimativa
        res.json({
            success: true,
            status: 'SENDING',
            total: targetCustomers.length,
            message: `Disparo iniciado para ${targetCustomers.length} clientes. WhatsApp: ${waEnabled ? '✅' : '❌ (desconectado)'}`
        });

        // Envia em background (não bloqueia a resposta)
        (async () => {
            for (const customer of targetCustomers) {
                // WhatsApp
                if (customer.phone && waEnabled) {
                    try {
                        const success = await sendWhatsApp(waConfig!, customer.phone, message);
                        if (success) sent++; else failed++;
                    } catch { failed++; }
                    // Delay para evitar rate limiting
                    await new Promise(r => setTimeout(r, 1500));
                }

                // Email
                if (customer.email) {
                    try {
                        const emailSent = await sendEmail(customer.email, emailSubject, message);
                        if (emailSent) emailsSent++;
                    } catch { /* email falhou, continua */ }
                }
            }

            // Log no NotificationLog
            await prisma.notificationLog.create({
                data: {
                    type: type.toUpperCase(),
                    recipient: `broadcast-${targetCustomers.length}`,
                    subject: emailSubject,
                    content: message.substring(0, 500),
                    status: failed === 0 ? 'SENT' : 'FAILED',
                    errorMessage: failed > 0 ? `${failed} WhatsApp falharam` : null,
                    metadata: {
                        campaignId: id,
                        type,
                        total: targetCustomers.length,
                        whatsappSent: sent,
                        whatsappFailed: failed,
                        emailsSent,
                        sentBy: 'admin'
                    }
                }
            }).catch(() => { });

            console.log(`[Campaigns] ✅ Disparo completo: ${sent} WhatsApp OK, ${failed} falhas, ${emailsSent} emails`);
        })();

    } catch (error: any) {
        console.error('[Campaigns] Erro ao disparar:', error);
        res.status(500).json({ error: 'Erro ao disparar campanha' });
    }
});
