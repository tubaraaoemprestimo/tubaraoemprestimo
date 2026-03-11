import { Router, Request, Response } from 'express';
import Stripe from 'stripe';

export const checkoutRouter = Router();

// Inicializa Stripe com a chave secreta
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
    apiVersion: '2026-02-25.clover',
});

/**
 * POST /api/checkout
 * Cria uma sessão de checkout do Stripe
 */
checkoutRouter.post('/', async (req: Request, res: Response) => {
    try {
        const { priceId, customerEmail, customerName } = req.body;

        if (!priceId) {
            res.status(400).json({ error: 'priceId é obrigatório' });
            return;
        }

        // Valida se a chave do Stripe está configurada
        if (!process.env.STRIPE_SECRET_KEY) {
            console.error('[Stripe] STRIPE_SECRET_KEY não configurada');
            res.status(500).json({ error: 'Stripe não configurado' });
            return;
        }

        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:5173';

        // Cria a sessão de checkout
        const session = await stripe.checkout.sessions.create({
            mode: 'payment',
            payment_method_types: ['card'],
            line_items: [
                {
                    price: priceId,
                    quantity: 1,
                },
            ],
            success_url: `${appUrl}/#/acesso?success=true&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${appUrl}/#/funil?canceled=true`,
            customer_email: customerEmail,
            metadata: {
                customerName: customerName || '',
            },
        });

        console.log(`[Stripe] Sessão criada: ${session.id} para ${customerEmail}`);

        res.json({ url: session.url, sessionId: session.id });
    } catch (error: any) {
        console.error('[Stripe] Erro ao criar checkout:', error.message);
        res.status(500).json({
            error: 'Erro ao criar sessão de pagamento',
            details: error.message
        });
    }
});
