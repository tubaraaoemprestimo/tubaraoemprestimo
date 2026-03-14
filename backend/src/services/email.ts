import axios from 'axios';

// ============ RESEND API EMAIL SERVICE ============
// Usa a API do Resend (https://resend.com) para envio de emails transacionais

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const RESEND_FROM = process.env.RESEND_FROM || 'Tubarão Empréstimos <contato@tubaraoemprestimo.com.br>';
const RESEND_API_URL = 'https://api.resend.com/emails';

// Queue para respeitar o rate limit do Resend (2 req/s)
let lastEmailTime = 0;
async function throttle() {
    const now = Date.now();
    const elapsed = now - lastEmailTime;
    if (elapsed < 600) {
        await new Promise(r => setTimeout(r, 600 - elapsed));
    }
    lastEmailTime = Date.now();
}

async function sendViaResend(to: string, subject: string, html: string): Promise<boolean> {
    if (!RESEND_API_KEY) {
        console.error('[Email] RESEND_API_KEY não configurada no .env');
        return false;
    }

    await throttle();
    try {
        const response = await axios.post(RESEND_API_URL, {
            from: RESEND_FROM,
            to: [to],
            subject,
            html
        }, {
            headers: {
                'Authorization': `Bearer ${RESEND_API_KEY}`,
                'Content-Type': 'application/json'
            },
            timeout: 15000
        });

        console.log(`[Email] ✅ Enviado para ${to} via Resend (id: ${response.data?.id || 'ok'})`);
        return true;
    } catch (error: any) {
        const errData = error?.response?.data;
        const errMsg = errData?.message || errData?.error || error.message;
        console.error(`[Email] ❌ Erro Resend para ${to}:`, errMsg);
        return false;
    }
}

export const emailService = {
    /**
     * Enviar email de confirmação de conta
     */
    async sendConfirmation(email: string, name: string, token: string): Promise<boolean> {
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        const confirmUrl = `${frontendUrl}/#/confirm-email?token=${token}`;

        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #000; color: #fff; padding: 30px; border-radius: 12px;">
                <div style="text-align: center; margin-bottom: 20px;">
                    <h1 style="color: #D4AF37;">🦈 Tubarão Empréstimos</h1>
                </div>
                <h2 style="color: #fff;">Olá, ${name}!</h2>
                <p style="color: #ccc; font-size: 16px;">
                    Obrigado por se cadastrar. Para ativar sua conta, clique no botão abaixo:
                </p>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${confirmUrl}" 
                       style="background: #D4AF37; color: #000; padding: 14px 40px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px; display: inline-block;">
                        Confirmar Email
                    </a>
                </div>
                <p style="color: #888; font-size: 13px;">
                    Se você não criou esta conta, ignore este email.
                </p>
                <hr style="border-color: #333; margin: 20px 0;" />
                <p style="color: #666; font-size: 12px; text-align: center;">
                    Tubarão Empréstimos — Plataforma de Crédito Premium
                </p>
            </div>
        `;

        const sent = await sendViaResend(email, '✅ Confirme seu email — Tubarão Empréstimos', html);
        if (sent) console.log('[Email] Confirmação enviada para:', email);
        return sent;
    },

    /**
     * Enviar email de reset de senha
     */
    async sendPasswordReset(email: string, name: string, token: string): Promise<boolean> {
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        const resetUrl = `${frontendUrl}/#/reset-password?token=${token}`;

        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #000; color: #fff; padding: 30px; border-radius: 12px;">
                <div style="text-align: center; margin-bottom: 20px;">
                    <h1 style="color: #D4AF37;">🦈 Tubarão Empréstimos</h1>
                </div>
                <h2 style="color: #fff;">Olá, ${name}!</h2>
                <p style="color: #ccc; font-size: 16px;">
                    Recebemos uma solicitação para redefinir sua senha. Clique no botão abaixo:
                </p>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${resetUrl}" 
                       style="background: #D4AF37; color: #000; padding: 14px 40px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px; display: inline-block;">
                        Redefinir Senha
                    </a>
                </div>
                <p style="color: #888; font-size: 13px;">
                    Este link expira em 1 hora. Se você não solicitou, ignore este email.
                </p>
                <hr style="border-color: #333; margin: 20px 0;" />
                <p style="color: #666; font-size: 12px; text-align: center;">
                    Tubarão Empréstimos — Plataforma de Crédito Premium
                </p>
            </div>
        `;

        const sent = await sendViaResend(email, '🔒 Redefinir senha — Tubarão Empréstimos', html);
        if (sent) console.log('[Email] Reset senha enviado para:', email);
        return sent;
    },

    /**
     * Enviar email genérico (usado por campaigns, loans, etc.)
     */
    async send(to: string, subject: string, html: string): Promise<boolean> {
        return sendViaResend(to, subject, html);
    }
};
