import { prisma } from './prisma';
import axios from 'axios';

/**
 * Normaliza telefone BR para formato internacional (55DDXXXXXXXXX)
 */
export function normalizePhoneBR(phone: string): string {
    if (!phone) return '';
    let number = phone.replace(/\D/g, '');
    // Remove leading zeros
    while (number.startsWith('0')) number = number.substring(1);
    // Handle operator codes (13-digit numbers)
    if (!number.startsWith('55')) {
        if (number.length === 13) {
            number = number.slice(-11);
        } else if (number.length === 12) {
            number = number.slice(-10);
        }
        if (number.length >= 10 && number.length <= 11) {
            number = '55' + number;
        }
    }
    return number;
}

export async function sendWhatsAppMessage(to: string, message: string): Promise<boolean> {
    try {
        // Validação básica
        if (!to || !message) {
            console.log('[WhatsApp] Telefone ou mensagem vazia, ignorando');
            return false;
        }

        const config = await prisma.whatsappConfig.findFirst();
        if (!config || !config.isConnected) {
            console.log('[WhatsApp] Config not found or disconnected');
            return false;
        }

        // Validar que a URL do Evolution API está configurada
        if (!config.apiUrl || config.apiUrl.trim() === '') {
            console.log('[WhatsApp] API URL não configurada');
            return false;
        }

        // Validar que a instanceName está configurada
        if (!config.instanceName || config.instanceName.trim() === '') {
            console.log('[WhatsApp] Instance name não configurada');
            return false;
        }

        const number = normalizePhoneBR(to);
        if (number.length < 12) {
            console.log(`[WhatsApp] Invalid number after normalization: ${number} (original: ${to})`);
            return false;
        }

        // Garante que a URL não tem barra final
        const baseUrl = config.apiUrl.replace(/\/+$/, '');
        const url = `${baseUrl}/message/sendText/${config.instanceName}`;

        // Validar URL antes de enviar
        try {
            new URL(url);
        } catch {
            console.error(`[WhatsApp] URL inválida construída: ${url}`);
            return false;
        }

        await axios.post(url, {
            number,
            text: message,
            options: { delay: 1200, presence: 'composing', linkPreview: false }
        }, {
            headers: {
                apikey: config.apiKey,
                'Content-Type': 'application/json'
            },
            timeout: 15000
        });
        console.log(`[WhatsApp] ✅ Message sent to ${number}`);
        return true;
    } catch (error: any) {
        const errMsg = error?.response?.data?.message || error.message;
        console.error(`[WhatsApp] ❌ Send failed to ${to}:`, errMsg);
        return false;
    }
}

export async function sendWhatsAppStatus(imageUrl: string, caption?: string) {
    try {
        const config = await prisma.whatsappConfig.findFirst();
        if (!config || !config.isConnected || !config.apiUrl || !config.instanceName) return;

        const baseUrl = config.apiUrl.replace(/\/+$/, '');
        const url = `${baseUrl}/message/sendStatus/${config.instanceName}`;

        // Validar URL
        try { new URL(url); } catch { console.error('[WhatsApp] Status URL inválida'); return; }

        await axios.post(url, {
            statusMessage: {
                type: 'image',
                content: imageUrl,
                caption: caption || '',
                allContacts: true,
                backgroundColor: '#000000',
                font: 1
            }
        }, {
            headers: {
                apikey: config.apiKey,
                'Content-Type': 'application/json'
            },
            timeout: 15000
        });
        console.log('[WhatsApp] ✅ Status posted');
    } catch (error: any) {
        console.error('[WhatsApp] ❌ Status post failed:', error.message);
    }
}
