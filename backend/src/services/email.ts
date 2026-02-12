import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

export const emailService = {
    /**
     * Enviar email de confirmação de conta
     */
    async sendConfirmation(email: string, name: string, token: string): Promise<boolean> {
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        const confirmUrl = `${frontendUrl}/#/confirm-email?token=${token}`;

        try {
            await transporter.sendMail({
                from: process.env.EMAIL_FROM || 'Tubarão Empréstimos <noreply@tubarao.com>',
                to: email,
                subject: '✅ Confirme seu email — Tubarão Empréstimos',
                html: `
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
                `
            });
            console.log('[Email] Confirmação enviada para:', email);
            return true;
        } catch (error) {
            console.error('[Email] Erro ao enviar confirmação:', error);
            return false;
        }
    },

    /**
     * Enviar email de reset de senha
     */
    async sendPasswordReset(email: string, name: string, token: string): Promise<boolean> {
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        const resetUrl = `${frontendUrl}/#/reset-password?token=${token}`;

        try {
            await transporter.sendMail({
                from: process.env.EMAIL_FROM || 'Tubarão Empréstimos <noreply@tubarao.com>',
                to: email,
                subject: '🔒 Redefinir senha — Tubarão Empréstimos',
                html: `
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
                `
            });
            console.log('[Email] Reset senha enviado para:', email);
            return true;
        } catch (error) {
            console.error('[Email] Erro ao enviar reset:', error);
            return false;
        }
    },

    /**
     * Enviar email genérico
     */
    async send(to: string, subject: string, html: string): Promise<boolean> {
        try {
            await transporter.sendMail({
                from: process.env.EMAIL_FROM || 'Tubarão Empréstimos <noreply@tubarao.com>',
                to,
                subject,
                html
            });
            return true;
        } catch (error) {
            console.error('[Email] Erro:', error);
            return false;
        }
    }
};
