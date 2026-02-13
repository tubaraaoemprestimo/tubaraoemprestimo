import { prisma } from './prisma';
import axios from 'axios';

export async function sendWhatsAppMessage(to: string, message: string) {
    try {
        const config = await prisma.whatsappConfig.findFirst();
        if (!config || !config.isConnected) {
            console.log('[WhatsApp] Config not found or disconnected');
            return;
        }

        // Clean number
        const number = to.replace(/\D/g, '');
        if (number.length < 10) return;

        const url = `${config.apiUrl}/message/sendText/${config.instanceName}`;
        await axios.post(url, {
            number: number,
            options: { delay: 1200, presence: "composing", linkPreview: false },
            textMessage: { text: message }
        }, {
            headers: {
                apikey: config.apiKey,
                'Content-Type': 'application/json'
            }
        });
        console.log(`[WhatsApp] Message sent to ${number}`);
    } catch (error: any) {
        console.error('[WhatsApp] Send failed:', error.message);
    }
}

export async function sendWhatsAppStatus(imageUrl: string, caption?: string) {
    try {
        const config = await prisma.whatsappConfig.findFirst();
        if (!config || !config.isConnected) return;

        const url = `${config.apiUrl}/message/sendStatus/${config.instanceName}`;
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
            }
        });
        console.log('[WhatsApp] Status posted');
    } catch (error: any) {
        console.error('[WhatsApp] Status post failed:', error.message);
    }
}
