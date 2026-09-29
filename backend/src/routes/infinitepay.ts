import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { ChargeError, getInfinitePayService } from '../services/infinitepay/infinitepayService';

// Rotas do cliente (autenticadas): criar cobrança e acompanhar status.
export const paymentsRouter = Router();
paymentsRouter.use(authenticate);

const HTTP_BY_CODE: Record<ChargeError['code'], number> = {
    NOT_CONFIGURED: 503,
    NOT_FOUND: 404,
    FORBIDDEN: 403,
    NOTHING_DUE: 400,
    IN_PROGRESS: 409,
    ALREADY_PAID: 409,
    PROVIDER_ERROR: 502,
};

function sendError(res: Response, error: any, tag: string) {
    if (error instanceof ChargeError) {
        res.status(HTTP_BY_CODE[error.code]).json({ error: error.message, code: error.code });
        return;
    }
    console.error(`[Payments] ${tag}:`, error?.message);
    res.status(500).json({ error: 'Erro ao processar pagamento' });
}

// GET /api/payments/infinitepay/enabled — o app decide se mostra "Pagar online"
paymentsRouter.get('/infinitepay/enabled', (_req: Request, res: Response) => {
    res.json({ enabled: getInfinitePayService().isEnabled() });
});

// POST /api/payments/infinitepay/charges — { loanId, type: 'interest_only' | 'full' }
paymentsRouter.post('/infinitepay/charges', async (req: Request, res: Response) => {
    try {
        const { loanId, type } = req.body || {};
        if (typeof loanId !== 'string' || !loanId) {
            res.status(400).json({ error: 'loanId obrigatório' });
            return;
        }
        if (type !== 'interest_only' && type !== 'full') {
            res.status(400).json({ error: 'Tipo inválido. Use: interest_only ou full' });
            return;
        }
        const charge = await getInfinitePayService().createCharge(req.user!.id, loanId, type);
        res.json({ success: true, charge });
    } catch (error: any) {
        sendError(res, error, 'Criar cobrança');
    }
});

// GET /api/payments/infinitepay/charges/:id — status (reconcilia com payment_check)
paymentsRouter.get('/infinitepay/charges/:id', async (req: Request, res: Response) => {
    try {
        const str = (v: unknown) => (typeof v === 'string' && v.length <= 200 ? v : undefined);
        const charge = await getInfinitePayService().getChargeStatus(
            req.user!.id,
            req.user!.role === 'ADMIN',
            req.params.id as string,
            { transactionNsu: str(req.query.transaction_nsu), slug: str(req.query.slug) }
        );
        res.json({ success: true, charge });
    } catch (error: any) {
        sendError(res, error, 'Status da cobrança');
    }
});

// Webhook público da InfinitePay. Não confia no corpo: a baixa só acontece
// depois de payment_check na API oficial (ver processWebhook).
export const infinitePayWebhookRouter = Router();

infinitePayWebhookRouter.post('/', async (req: Request, res: Response) => {
    try {
        const result = await getInfinitePayService().processWebhook(req.body || {});
        console.log(`[InfinitePay] Webhook ${req.body?.order_nsu || '-'}: ${result}`);
    } catch (error: any) {
        // Nunca devolver 5xx por erro nosso após gravar a auditoria: a
        // InfinitePay reenviaria sem fim. A reconciliação cobre o que faltar.
        console.error('[InfinitePay] Erro no webhook:', error?.message);
    }
    res.status(200).json({ received: true });
});
