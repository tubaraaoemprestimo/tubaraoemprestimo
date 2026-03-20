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
import trackflowRouter from './routes/trackflow';
import documentsRouter from './routes/documents';
import { aiRouter } from './routes/ai';
import { quizRouter } from './routes/quiz';
import { commentsRouter } from './routes/comments';
import { automationRouter } from './routes/automation';
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
app.use(express.json({ limit: '200mb' }));
app.use(express.urlencoded({ extended: true, limit: '200mb' }));

// Static files (uploads) — detecta MIME type pelo conteúdo do arquivo
app.get('/uploads/:date/:filename', (req, res) => {
    const filePath = path.join(__dirname, '..', 'uploads', req.params.date, req.params.filename);
    if (!require('fs').existsSync(filePath)) {
        res.status(404).json({ error: 'File not found' });
        return;
    }
    const fd = require('fs').openSync(filePath, 'r');
    const magic = Buffer.alloc(16);
    require('fs').readSync(fd, magic, 0, 16, 0);
    require('fs').closeSync(fd);
    let contentType = 'application/octet-stream';
    if (magic[0] === 0xFF && magic[1] === 0xD8 && magic[2] === 0xFF) contentType = 'image/jpeg';
    else if (magic[0] === 0x89 && magic[1] === 0x50 && magic[2] === 0x4E && magic[3] === 0x47) contentType = 'image/png';
    else if (magic[0] === 0x47 && magic[1] === 0x49 && magic[2] === 0x46) contentType = 'image/gif';
    else if (magic[0] === 0x52 && magic[1] === 0x49 && magic[2] === 0x46 && magic[8] === 0x57 && magic[9] === 0x45) contentType = 'image/webp';
    else if (magic[4] === 0x66 && magic[5] === 0x74 && magic[6] === 0x79 && magic[7] === 0x70) contentType = 'video/mp4';
    else if (magic[0] === 0x1A && magic[1] === 0x45 && magic[2] === 0xDF && magic[3] === 0xA3) contentType = 'video/webm';
    else if (magic[0] === 0x25 && magic[1] === 0x50 && magic[2] === 0x44 && magic[3] === 0x46) contentType = 'application/pdf';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=31536000');
    res.sendFile(filePath);
});
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
app.use('/api/trackflow', trackflowRouter);
app.use('/api/documents', documentsRouter);
app.use('/api/ai', aiRouter);
app.use('/api/quiz', quizRouter);
app.use('/api/comments', commentsRouter);
app.use('/api/automation', automationRouter);

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

app.listen(Number(PORT), "0.0.0.0", () => {
    console.log(`ðŸ¦ˆ TubarÃ£o Backend rodando na porta ${PORT}`);
    console.log(`ðŸ“ Ambiente: ${process.env.NODE_ENV || 'development'}`);
    console.log(`ðŸŒ CORS: ${process.env.CORS_ORIGIN || 'http://localhost:5173'}`);
});

export default app;

