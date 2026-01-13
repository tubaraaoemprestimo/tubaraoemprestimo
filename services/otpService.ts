/**
 * Serviço de OTP (One-Time Password)
 * Gera e valida códigos de verificação via WhatsApp/SMS
 */

import { supabase } from './supabaseClient';
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
            const { data: existingOtp } = await supabase
                .from('otp_codes')
                .select('*')
                .eq('phone', phone)
                .eq('verified', false)
                .gt('expires_at', new Date().toISOString())
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            // Se existe OTP recente (menos de 1 minuto), não enviar novo
            if (existingOtp) {
                const createdAt = new Date(existingOtp.created_at);
                const timeDiff = Date.now() - createdAt.getTime();
                if (timeDiff < 60000) { // 1 minuto
                    return {
                        success: false,
                        message: 'Aguarde 1 minuto para solicitar novo código.'
                    };
                }
            }

            // Salvar OTP no banco
            const { error: insertError } = await supabase.from('otp_codes').insert({
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
        const MAX_ATTEMPTS = 5;

        try {
            // Buscar OTP válido
            const { data: otp, error } = await supabase
                .from('otp_codes')
                .select('*')
                .eq('phone', phone)
                .eq('verified', false)
                .gt('expires_at', new Date().toISOString())
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            if (error || !otp) {
                return { valid: false, message: 'Código expirado ou inválido.' };
            }

            // Verificar tentativas
            if (otp.attempts >= MAX_ATTEMPTS) {
                return {
                    valid: false,
                    message: 'Muitas tentativas. Solicite um novo código.',
                    remainingAttempts: 0
                };
            }

            // Verificar código
            if (otp.code !== validation.code) {
                // Incrementar tentativas
                await supabase
                    .from('otp_codes')
                    .update({ attempts: otp.attempts + 1 })
                    .eq('id', otp.id);

                return {
                    valid: false,
                    message: 'Código incorreto.',
                    remainingAttempts: MAX_ATTEMPTS - otp.attempts - 1
                };
            }

            // Código correto - marcar como verificado
            await supabase
                .from('otp_codes')
                .update({
                    verified: true,
                    verified_at: new Date().toISOString()
                })
                .eq('id', otp.id);

            return { valid: true, message: 'Código validado!' };
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
        const since = new Date(Date.now() - withinHours * 60 * 60 * 1000);

        const { data } = await supabase
            .from('otp_codes')
            .select('*')
            .eq('phone', cleanPhone)
            .eq('verified', true)
            .gte('verified_at', since.toISOString())
            .limit(1);

        return data && data.length > 0;
    },

    /**
     * Limpa OTPs expirados (pode ser chamado periodicamente)
     */
    async cleanupExpired(): Promise<void> {
        await supabase
            .from('otp_codes')
            .delete()
            .lt('expires_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
    },
};

export default otpService;
