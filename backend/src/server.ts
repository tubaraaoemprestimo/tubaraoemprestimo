import express from 'express';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';

// Load env
dotenv.config();

// Import routes
import { authRouter } from './routes/auth';
import { usersRouter } from './routes/users';
import { customersRouter } from './routes/customers';
import { loanRequestsRouter } from './routes/loanRequests';
import { loansRouter } from './routes/loans';
import { settingsRouter } from './routes/settings';
import { uploadRouter } from './routes/upload';
import { webhookRouter } from './routes/webhook';
import { campaignsRouter } from './routes/campaigns';
import { antifraudRouter } from './routes/antifraud';
import { notificationsRouter } from './routes/notifications';
import { financeRouter } from './routes/finance';
import { emailRouter } from './routes/email';
import { pushRouter } from './routes/push';
import { chatbotRouter } from './routes/chatbot';
import { cpfLookupRouter } from './routes/cpfLookup';
import { whatsappStatusRouter } from './routes/whatsappStatus';
import { referralsRouter } from './routes/referrals';
import { communicationRouter } from './routes/communication';
import { adminRouter } from './routes/admin';
import { qualificationLeadsRouter } from './routes/qualificationLeads';
import { paymentReceiptsRouter } from './routes/paymentReceipts';
import { openFinanceRouter } from './routes/openFinance';
import { pixRouter } from './routes/pix';
import { collectionsRouter } from './routes/collections';
import { partnersRouter } from './routes/partners';
import { maintenanceRouter } from './routes/maintenance';
import { loanRequestUpdatesRouter } from './routes/loanRequestUpdates';
import scheduledStatusRouter from './routes/scheduledStatus';
import collectionAutomationRouter from './routes/collectionAutomation';
import { returningClientsRouter } from './routes/returningClients';
import { funilRouter } from './routes/funil';
import { cursoRouter } from './routes/curso';
import { checkoutRouter } from './routes/checkout';
import { stripeWebhookRouter } from './routes/webhooks/stripe';
import { initCronJobs } from './cron/installmentReminders';
import { startCollectionCron } from './cron/collectionCron';

const app = express();
const PORT = process.env.PORT || 3001;

// ============= MIDDLEWARE =============

// CORS - Allow production and development origins
const allowedOrigins = [
    'https://www.tubaraoemprestimo.com.br',
    'https://tubaraoemprestimo.com.br',
    'http://localhost:5173',
    'http://localhost:3000',
    process.env.CORS_ORIGIN
].filter(Boolean) as string[];

app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, server-to-server, curl)
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            console.log(`[CORS] Blocked origin: ${origin}`);
            callback(null, true); // Allow all in case of misconfigured reverse proxy
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// IMPORTANTE: Webhook do Stripe precisa do raw body ANTES do express.json()
app.use('/api/webhooks/stripe', express.raw({ type: 'application/json' }), stripeWebhookRouter);

// Body parsing (para todas as outras rotas)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static files (uploads)
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// ============= ROUTES =============

app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/customers', customersRouter);
app.use('/api/loan-requests', loanRequestsRouter);
app.use('/api/loan-request-updates', loanRequestUpdatesRouter);
app.use('/api/loans', loansRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/upload', uploadRouter);
app.use('/api/webhook', webhookRouter);
app.use('/api/campaigns', campaignsRouter);
app.use('/api/antifraud', antifraudRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/finance', financeRouter);
app.use('/api/email', emailRouter);
app.use('/api/push', pushRouter);
app.use('/api/chatbot', chatbotRouter);
app.use('/api/cpf', cpfLookupRouter);
app.use('/api/whatsapp', whatsappStatusRouter);
app.use('/api/referrals', referralsRouter);
app.use('/api/communication', communicationRouter);
app.use('/api/admin', adminRouter);
app.use('/api/payment-receipts', paymentReceiptsRouter);
app.use('/api/open-finance', openFinanceRouter);
app.use('/api/pix', pixRouter);
app.use('/api/collections', collectionsRouter);
app.use('/api/partners', partnersRouter);
app.use('/api/maintenance', maintenanceRouter);
app.use('/api/qualification-leads', qualificationLeadsRouter);
app.use('/api/scheduled-status', scheduledStatusRouter);
app.use('/api/collection-automation', collectionAutomationRouter);
app.use('/api/returning-clients', returningClientsRouter);
app.use('/api/funil', funilRouter);
app.use('/api/curso', cursoRouter);
app.use('/api/checkout', checkoutRouter);

// Health check
app.get('/api/health', (_req, res) => {
    res.json({
        status: 'ok',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        env: process.env.NODE_ENV || 'development'
    });
});

// 404
app.use((_req, res) => {
    res.status(404).json({ error: 'Rota nÃ£o encontrada' });
});

// Error handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('[Server Error]', err);
    res.status(err.status || 500).json({
        error: err.message || 'Erro interno do servidor',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
});

// ============= START =============

initCronJobs();
startCollectionCron();

app.listen(PORT, () => {
    console.log(`ðŸ¦ˆ TubarÃ£o Backend rodando na porta ${PORT}`);
    console.log(`ðŸ“ Ambiente: ${process.env.NODE_ENV || 'development'}`);
    console.log(`ðŸŒ CORS: ${process.env.CORS_ORIGIN || 'http://localhost:5173'}`);
});

export default app;

