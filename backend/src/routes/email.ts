import { Router, Request, Response } from 'express';
import { prisma } from '../services/prisma';
import { authenticate, requireAdmin } from '../middleware/auth';
import nodemailer from 'nodemailer';
import axios from 'axios';

export const emailRouter = Router();
emailRouter.use(authenticate);

// ============ SMTP Transporter (Primary) ============

const smtpTransporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

// ============ Branded HTML Template ============

function wrapInBrandedTemplate(html: string): string {
    return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #000; color: #fff; padding: 30px; border-radius: 12px;">
        <div style="text-align: center; margin-bottom: 20px;">
            <h1 style="color: #D4AF37; font-size: 24px;">🦈 Tubarão Empréstimos</h1>
        </div>
        <div style="color: #ccc; font-size: 15px; line-height: 1.6;">
            ${html}
        </div>
        <hr style="border-color: #333; margin: 25px 0;" />
        <p style="color: #666; font-size: 12px; text-align: center;">
            Tubarão Empréstimos — Plataforma de Crédito Premium<br/>
            <span style="color: #555;">Este é um email automático. Não responda.</span>
        </p>
    </div>
    `;
}

// ============ Send via Resend API (Fallback) ============

async function sendViaResend(to: string, subject: string, html: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
        return { success: false, error: 'RESEND_API_KEY não configurada' };
    }

    try {
        const response = await axios.post('https://api.resend.com/emails', {
            from: process.env.RESEND_FROM || process.env.EMAIL_FROM || 'Tubarão Empréstimos <noreply@tubarao.com>',
            to: [to],
            subject,
            html
        }, {
            headers: {
                'Authorization': `Bearer ${resendApiKey}`,
                'Content-Type': 'application/json'
            }
        });

        return { success: true, messageId: response.data?.id };
    } catch (error: any) {
        const errorMsg = error.response?.data?.message || error.message || 'Erro desconhecido Resend';
        return { success: false, error: errorMsg };
    }
}

// ============ Send via SMTP (Primary) ============

async function sendViaSMTP(to: string, subject: string, html: string, text?: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
        const info = await smtpTransporter.sendMail({
            from: process.env.EMAIL_FROM || 'Tubarão Empréstimos <noreply@tubarao.com>',
            to,
            subject,
            html,
            text: text || undefined
        });

        return { success: true, messageId: info.messageId };
    } catch (error: any) {
        return { success: false, error: error.message || 'Erro SMTP desconhecido' };
    }
}

// ============ ROUTES ============

// POST /api/email/send - Enviar email
emailRouter.post('/send', async (req: Request, res: Response) => {
    try {
        const { to, subject, html, text, useTemplate } = req.body;

        if (!to || !subject || !html) {
            res.status(400).json({ error: 'Campos obrigatórios: to, subject, html' });
            return;
        }

        // Aplica template branded se solicitado (default: true)
        const finalHtml = useTemplate !== false ? wrapInBrandedTemplate(html) : html;

        // Tenta SMTP primeiro (primary)
        let result = await sendViaSMTP(to, subject, finalHtml, text);
        let provider = 'SMTP';

        // Se SMTP falhar, tenta Resend como fallback
        if (!result.success && process.env.RESEND_API_KEY) {
            console.log('[Email] SMTP falhou, tentando Resend como fallback...');
            result = await sendViaResend(to, subject, finalHtml);
            provider = 'RESEND';
        }

        // Loga no NotificationLog
        await prisma.notificationLog.create({
            data: {
                type: 'EMAIL',
                recipient: to,
                subject,
                content: html.substring(0, 500), // Limita tamanho do log
                status: result.success ? 'SENT' : 'FAILED',
                errorMessage: result.error || null,
                metadata: {
                    provider,
                    messageId: result.messageId || null,
                    sentBy: req.user!.id
                }
            }
        });

        if (result.success) {
            console.log(`[Email] Enviado para ${to} via ${provider}`);
            res.json({ success: true, provider, messageId: result.messageId });
        } else {
            console.error(`[Email] Falha ao enviar para ${to}:`, result.error);
            res.status(500).json({ error: 'Falha ao enviar email', details: result.error, provider });
        }
    } catch (error: any) {
        console.error('[Email] Erro inesperado:', error);
        res.status(500).json({ error: 'Erro ao enviar email' });
    }
});

// POST /api/email/test - Enviar email de teste (admin only)
emailRouter.post('/test', requireAdmin, async (req: Request, res: Response) => {
    try {
        const { to } = req.body;
        const recipient = to || req.user!.email;

        const testHtml = `
            <h2 style="color: #fff;">Email de Teste</h2>
            <p style="color: #ccc;">
                Este é um email de teste enviado pelo painel administrativo do <strong style="color: #D4AF37;">Tubarão Empréstimos</strong>.
            </p>
            <p style="color: #ccc;">
                Se você recebeu este email, a configuração de envio está funcionando corretamente.
            </p>
            <div style="background: #111; border: 1px solid #333; border-radius: 8px; padding: 15px; margin: 15px 0;">
                <p style="color: #888; margin: 0; font-size: 13px;">
                    <strong style="color: #D4AF37;">Enviado por:</strong> ${req.user!.name} (${req.user!.email})<br/>
                    <strong style="color: #D4AF37;">Data:</strong> ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}<br/>
                    <strong style="color: #D4AF37;">SMTP Host:</strong> ${process.env.SMTP_HOST || 'smtp.gmail.com'}<br/>
                    <strong style="color: #D4AF37;">Resend:</strong> ${process.env.RESEND_API_KEY ? 'Configurado' : 'Não configurado'}
                </p>
            </div>
        `;

        const finalHtml = wrapInBrandedTemplate(testHtml);

        // Tenta SMTP primeiro
        let result = await sendViaSMTP(recipient, '🧪 Teste de Email — Tubarão Empréstimos', finalHtml);
        let provider = 'SMTP';

        // Fallback para Resend
        if (!result.success && process.env.RESEND_API_KEY) {
            result = await sendViaResend(recipient, '🧪 Teste de Email — Tubarão Empréstimos', finalHtml);
            provider = 'RESEND';
        }

        // Loga
        await prisma.notificationLog.create({
            data: {
                type: 'EMAIL',
                recipient,
                subject: 'Teste de Email',
                content: 'Email de teste enviado pelo admin',
                status: result.success ? 'SENT' : 'FAILED',
                errorMessage: result.error || null,
                metadata: {
                    provider,
                    isTest: true,
                    sentBy: req.user!.id
                }
            }
        });

        if (result.success) {
            res.json({ success: true, message: `Email de teste enviado para ${recipient} via ${provider}` });
        } else {
            res.status(500).json({ error: 'Falha ao enviar email de teste', details: result.error });
        }
    } catch (error: any) {
        console.error('[Email] Erro no teste:', error);
        res.status(500).json({ error: 'Erro ao enviar email de teste' });
    }
});

// GET /api/email/logs - Listar logs de email (admin only)
emailRouter.get('/logs', requireAdmin, async (req: Request, res: Response) => {
    try {
        const { page = '1', limit = '20' } = req.query;
        const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

        const [logs, total] = await Promise.all([
            prisma.notificationLog.findMany({
                where: { type: 'EMAIL' },
                orderBy: { createdAt: 'desc' },
                take: parseInt(limit as string),
                skip
            }),
            prisma.notificationLog.count({ where: { type: 'EMAIL' } })
        ]);

        res.json({ logs, total, page: parseInt(page as string), limit: parseInt(limit as string) });
    } catch {
        res.status(500).json({ error: 'Erro ao buscar logs de email' });
    }
});
