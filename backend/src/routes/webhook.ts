import { Router, Request, Response } from 'express';
import { prisma } from '../services/prisma';
import axios from 'axios';

export const webhookRouter = Router();

// Endpoint para Evolution API
webhookRouter.post('/whatsapp', async (req: Request, res: Response) => {
    try {
        const body = req.body;
        const { type, data, instance } = body;

        // Se for mensagem recebida
        if (type === 'message') {
            const message = data.message;
            const from = data.key.remoteJid; // 5511999999999@s.whatsapp.net
            const content = message.conversation || message.extendedTextMessage?.text;

            if (!content) {
                res.status(200).json({ status: 'ignored' });
                return;
            }

            // Normaliza telefone (remove @s.whatsapp.net)
            const phone = from.replace('@s.whatsapp.net', '');

            // Loga interação
            console.log(`[WhatsApp] Mensagem de ${phone}: ${content}`);

            // TODO: Lógica do Chatbot (migrar do aiChatbotService)
            // Aqui você pode integrar com o Gemini para responder automaticamente

            // Exemplo simples: Salvar histórico ou atualizar status do cliente
            const customer = await prisma.customer.findFirst({
                where: { phone: { contains: phone.substring(2) } } // Tenta achar pelo número (sem 55 se precisar)
            });

            if (customer) {
                await prisma.auditLog.create({
                    data: {
                        userId: customer.userId || 'system',
                        userName: customer.name,
                        action: 'WHATSAPP_MESSAGE',
                        entity: 'CUSTOMER',
                        entityId: customer.id,
                        details: `Recebeu mensagem: ${content}`,
                        ipAddress: req.ip
                    }
                });
            }
        }

        res.status(200).json({ status: 'ok' });
    } catch (error) {
        console.error('[Webhook] Erro:', error);
        res.status(500).json({ error: 'Erro no webhook' });
    }
});

// Endpoint para enviar mensagem (Backend -> WhatsApp)
webhookRouter.post('/send', async (req: Request, res: Response) => {
    try {
        const { phone, message } = req.body;
        const config = await prisma.whatsappConfig.findFirst();

        if (!config || !config.isConnected) {
            res.status(400).json({ error: 'WhatsApp desconectado' });
            return;
        }

        // Envia via Evolution API
        const url = `${config.apiUrl}/message/sendText/${config.instanceName}`;
        await axios.post(url, {
            number: phone,
            options: { delay: 1200, presence: 'composing', linkPreview: false },
            textMessage: { text: message }
        }, {
            headers: { apikey: config.apiKey }
        });

        res.json({ success: true });
    } catch (error) {
        console.error('[WhatsApp] Erro ao enviar:', error);
        res.status(500).json({ error: 'Erro ao enviar mensagem' });
    }
});
