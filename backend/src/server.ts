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

const app = express();
const PORT = process.env.PORT || 3001;

// ============= MIDDLEWARE =============

// CORS
app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parsing
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static files (uploads)
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// ============= ROUTES =============

app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/customers', customersRouter);
app.use('/api/loan-requests', loanRequestsRouter);
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
    res.status(404).json({ error: 'Rota não encontrada' });
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

app.listen(PORT, () => {
    console.log(`🦈 Tubarão Backend rodando na porta ${PORT}`);
    console.log(`📍 Ambiente: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🌐 CORS: ${process.env.CORS_ORIGIN || 'http://localhost:5173'}`);
});

export default app;
