/**
 * Serviço de OTP (One-Time Password)
 * Gera e valida códigos de verificação via WhatsApp/SMS
 */

import { api } from './apiClient';
import { whatsappService } from './whatsappService';

export interface OTPRequest {
    userId?: string;
    phone: string;
    type: 'sms' | 'whatsapp';
}

export interface OTPValidation {
    phone: string;
    code: string;
}

export const otpService = {
    /**
     * Gera código OTP de 6 dígitos
     */
    generateCode(): string {
        return Math.floor(100000 + Math.random() * 900000).toString();
    },

    /**
     * Envia OTP via WhatsApp
     */
    async sendOTP(request: OTPRequest): Promise<{ success: boolean; message: string }> {
        const code = this.generateCode();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutos

        // Limpar formato do telefone
        const phone = request.phone.replace(/\D/g, '');

        try {
            // Verificar se já existe OTP não expirado para este telefone
            const { data: existingOtp } = await api.get<any>(`/auth/otp/check?phone=${phone}`);

            // Se existe OTP recente (menos de 1 minuto), não enviar novo
            if (existingOtp) {
                const createdAt = new Date((existingOtp as any).created_at);
                const timeDiff = Date.now() - createdAt.getTime();
                if (timeDiff < 60000) { // 1 minuto
                    return {
                        success: false,
                        message: 'Aguarde 1 minuto para solicitar novo código.'
                    };
                }
            }

            // Salvar OTP via API
            const { error: insertError } = await api.post('/auth/otp', {
                user_id: request.userId,
                phone,
                code,
                type: request.type,
                expires_at: expiresAt.toISOString(),
                verified: false,
                attempts: 0,
            });

            if (insertError) {
                console.error('Erro ao salvar OTP:', insertError);
                return { success: false, message: 'Erro ao gerar código.' };
            }

            // Enviar via WhatsApp
            if (request.type === 'whatsapp') {
                const message = `🔐 *Tubarão Empréstimos*\n\nSeu código de verificação é:\n\n*${code}*\n\n⏱️ Este código expira em 10 minutos.\n\n⚠️ Nunca compartilhe este código com ninguém.`;

                const sent = await whatsappService.sendMessage(phone, message);

                if (!sent) {
                    return { success: false, message: 'Erro ao enviar WhatsApp. Verifique o número.' };
                }
            }

            return { success: true, message: 'Código enviado!' };
        } catch (e) {
            console.error('Erro ao enviar OTP:', e);
            return { success: false, message: 'Erro ao enviar código.' };
        }
    },

    /**
     * Valida código OTP
     */
    async validateOTP(validation: OTPValidation): Promise<{
        valid: boolean;
        message: string;
        remainingAttempts?: number;
    }> {
        const phone = validation.phone.replace(/\D/g, '');

        try {
            const { data, error } = await api.post<any>('/auth/otp/validate', {
                phone,
                code: validation.code
            });

            if (error || !data) {
                return { valid: false, message: 'Código expirado ou inválido.' };
            }

            const result = data as any;
            return {
                valid: result.valid || false,
                message: result.message || 'Erro ao validar código.',
                remainingAttempts: result.remainingAttempts
            };
        } catch (e) {
            console.error('Erro ao validar OTP:', e);
            return { valid: false, message: 'Erro ao validar código.' };
        }
    },

    /**
     * Verifica se telefone já foi verificado recentemente
     */
    async isPhoneVerified(phone: string, withinHours: number = 24): Promise<boolean> {
        const cleanPhone = phone.replace(/\D/g, '');

        const { data } = await api.get<any>(`/auth/otp/verified?phone=${cleanPhone}&hours=${withinHours}`);

        return (data as any)?.verified || false;
    },

    /**
     * Limpa OTPs expirados (pode ser chamado periodicamente)
     */
    async cleanupExpired(): Promise<void> {
        await api.delete('/auth/otp/cleanup');
    },
};

export default otpService;
