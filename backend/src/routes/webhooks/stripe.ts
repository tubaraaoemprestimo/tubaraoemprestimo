import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import { prisma } from '../../services/prisma';
import bcrypt from 'bcryptjs';
import { sendWelcomeEmail } from '../../services/emailService';

export const stripeWebhookRouter = Router();

// Inicializa Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
    apiVersion: '2026-02-25.clover',
});

/**
 * Gera uma senha aleatória segura
 */
function generateSecurePassword(length: number = 12): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%&*';
    let password = '';
    for (let i = 0; i < length; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
}

/**
 * POST /api/webhooks/stripe
 * Webhook do Stripe para processar eventos de pagamento
 */
stripeWebhookRouter.post('/', async (req: Request, res: Response) => {
    const sig = req.headers['stripe-signature'];

    if (!sig) {
        console.error('[Stripe Webhook] Signature ausente');
        res.status(400).send('Webhook signature missing');
        return;
    }

    if (!process.env.STRIPE_WEBHOOK_SECRET) {
        console.error('[Stripe Webhook] STRIPE_WEBHOOK_SECRET não configurado');
        res.status(500).send('Webhook secret not configured');
        return;
    }

    let event: Stripe.Event;

    try {
        // Verifica a assinatura do webhook
        event = stripe.webhooks.constructEvent(
            req.body,
            sig,
            process.env.STRIPE_WEBHOOK_SECRET
        );
    } catch (err: any) {
        console.error('[Stripe Webhook] Erro na verificação:', err.message);
        res.status(400).send(`Webhook Error: ${err.message}`);
        return;
    }

    // Processa o evento checkout.session.completed
    if (event.type === 'checkout.session.completed') {
        const session = event.data.object as Stripe.Checkout.Session;

        console.log(`[Stripe Webhook] Pagamento confirmado: ${session.id}`);

        try {
            // Extrai dados do cliente
            const customerEmail = session.customer_details?.email;
            const customerName = session.customer_details?.name || session.metadata?.customerName || 'Cliente';

            if (!customerEmail) {
                console.error('[Stripe Webhook] Email do cliente não encontrado');
                res.status(400).send('Customer email missing');
                return;
            }

            console.log(`[Stripe Webhook] Processando acesso para: ${customerEmail}`);

            // Verifica se o usuário já existe
            let user = await prisma.user.findUnique({
                where: { email: customerEmail }
            });

            let generatedPassword: string | null = null;
            let isNewUser = false;

            if (!user) {
                // Usuário não existe - criar novo
                isNewUser = true;
                generatedPassword = generateSecurePassword(12);
                const hashedPassword = await bcrypt.hash(generatedPassword, 10);

                user = await prisma.user.create({
                    data: {
                        email: customerEmail,
                        name: customerName,
                        password: hashedPassword,
                        role: 'CLIENT',
                        hasCourseAccess: true,
                    }
                });

                console.log(`[Stripe Webhook] ✅ Novo usuário criado: ${user.id} (${customerEmail})`);
            } else {
                // Usuário já existe - apenas libera acesso
                user = await prisma.user.update({
                    where: { id: user.id },
                    data: { hasCourseAccess: true }
                });

                console.log(`[Stripe Webhook] ✅ Acesso liberado para usuário existente: ${user.id} (${customerEmail})`);
            }

            // FASE 3: Enviar e-mail com credenciais via Resend
            if (isNewUser && generatedPassword) {
                // Novo usuário - envia senha gerada
                const emailSent = await sendWelcomeEmail({
                    email: customerEmail,
                    name: customerName,
                    password: generatedPassword,
                    isNewUser: true
                });

                if (emailSent) {
                    console.log(`[Stripe Webhook] ✅ E-mail de boas-vindas enviado para ${customerEmail}`);
                } else {
                    console.error(`[Stripe Webhook] ⚠️ Falha ao enviar e-mail para ${customerEmail}`);
                }
            } else {
                // Usuário existente - envia notificação de renovação (sem senha)
                const emailSent = await sendWelcomeEmail({
                    email: customerEmail,
                    name: customerName,
                    password: '********', // Placeholder - usuário já tem senha
                    isNewUser: false
                });

                if (emailSent) {
                    console.log(`[Stripe Webhook] ✅ E-mail de renovação enviado para ${customerEmail}`);
                } else {
                    console.error(`[Stripe Webhook] ⚠️ Falha ao enviar e-mail para ${customerEmail}`);
                }
            }

            res.json({ received: true, userId: user.id });
        } catch (error: any) {
            console.error('[Stripe Webhook] Erro ao processar pagamento:', error);
            res.status(500).json({ error: 'Erro ao processar pagamento', details: error.message });
        }
    } else {
        // Outros eventos do Stripe (ignorar por enquanto)
        console.log(`[Stripe Webhook] Evento ignorado: ${event.type}`);
        res.json({ received: true });
    }
});
