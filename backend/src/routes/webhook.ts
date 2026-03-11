import { Router, Request, Response } from 'express';
import { prisma } from '../services/prisma';
import axios from 'axios';
import { sendWhatsAppMessage } from '../services/whatsapp';
import { sendPushToRole } from './push';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';

export const webhookRouter = Router();

// ============ Helpers ============

/**
 * Verifica se o horário atual está dentro do horário de atendimento (Brasília)
 */
function isWithinWorkingHours(start: string, end: string): boolean {
    const now = new Date();
    const brasiliaOffset = -3 * 60;
    const localTime = new Date(now.getTime() + (brasiliaOffset - now.getTimezoneOffset()) * 60000);
    const currentMinutes = localTime.getHours() * 60 + localTime.getMinutes();
    const [startH, startM] = start.split(':').map(Number);
    const [endH, endM] = end.split(':').map(Number);
    return currentMinutes >= startH * 60 + startM && currentMinutes <= endH * 60 + endM;
}

function containsTransferKeyword(message: string, keywords: string[]): boolean {
    const lowerMessage = message.toLowerCase();
    return keywords.some(keyword => lowerMessage.includes(keyword.toLowerCase()));
}

/**
 * Chama a API do Google Gemini (texto)
 */
async function callGeminiAPI(
    apiKey: string, systemPrompt: string,
    history: { role: string; content: string }[], userMessage: string
): Promise<string> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const contents: any[] = [];

    if (systemPrompt) {
        contents.push({ role: 'user', parts: [{ text: `[Instrução do Sistema]: ${systemPrompt}` }] });
        contents.push({ role: 'model', parts: [{ text: 'Entendido. Vou seguir essas instruções.' }] });
    }

    for (const msg of history.slice(-20)) {
        contents.push({ role: msg.role === 'user' ? 'user' : 'model', parts: [{ text: msg.content }] });
    }
    contents.push({ role: 'user', parts: [{ text: userMessage }] });

    const response = await axios.post(url, {
        contents,
        generationConfig: { temperature: 0.7, topP: 0.95, topK: 40, maxOutputTokens: 1024 },
        safetySettings: [
            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' }
        ]
    }, { headers: { 'Content-Type': 'application/json' }, timeout: 30000 });

    const candidate = response.data?.candidates?.[0];
    if (!candidate?.content?.parts?.[0]?.text) throw new Error('Resposta vazia do Gemini');
    return candidate.content.parts[0].text;
}

/**
 * Chama a API do Gemini com suporte multimodal nativo (áudio, imagem, PDF)
 */
async function callGeminiMultimodalAPI(
    apiKey: string, systemPrompt: string,
    history: { role: string; content: string }[], userMessage: string,
    mediaBuffer?: Buffer, mediaMimetype?: string
): Promise<{ text: string; transcription?: string }> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const contents: any[] = [];

    if (systemPrompt) {
        contents.push({ role: 'user', parts: [{ text: `[Instrução do Sistema]: ${systemPrompt}` }] });
        contents.push({ role: 'model', parts: [{ text: 'Entendido. Vou seguir essas instruções.' }] });
    }

    for (const msg of history.slice(-20)) {
        contents.push({ role: msg.role === 'user' ? 'user' : 'model', parts: [{ text: msg.content }] });
    }

    // Monta a mensagem do usuário com mídia
    const userParts: any[] = [];

    if (mediaBuffer && mediaMimetype) {
        const base64Data = mediaBuffer.toString('base64');
        // Mapeia mimetypes do WhatsApp para tipos aceitos pelo Gemini
        let geminiMime = mediaMimetype;
        if (mediaMimetype.includes('ogg')) geminiMime = 'audio/ogg';
        if (mediaMimetype.includes('mpeg') && mediaMimetype.includes('audio')) geminiMime = 'audio/mpeg';
        if (mediaMimetype.includes('m4a')) geminiMime = 'audio/mp4';
        if (mediaMimetype.includes('webm') && mediaMimetype.includes('audio')) geminiMime = 'audio/webm';

        userParts.push({
            inline_data: { mime_type: geminiMime, data: base64Data }
        });
    }

    // Instrução contextual baseada no tipo de mídia
    let instruction = userMessage || '';
    if (mediaBuffer && mediaMimetype) {
        if (mediaMimetype.includes('audio') || mediaMimetype.includes('ogg')) {
            instruction = (userMessage ? userMessage + '\n\n' : '') +
                'O usuário enviou um áudio. Transcreva o que foi dito e responda de acordo. Comece sua resposta respondendo diretamente ao que o usuário disse no áudio.';
        } else if (mediaMimetype.includes('image')) {
            instruction = (userMessage ? userMessage + '\n\n' : '') +
                'O usuário enviou uma imagem. Analise e descreva o que vê, e responda de acordo.';
        } else if (mediaMimetype.includes('pdf') || mediaMimetype.includes('document')) {
            instruction = (userMessage ? userMessage + '\n\n' : '') +
                'O usuário enviou um documento. Leia o conteúdo e responda de acordo.';
        }
    }

    if (instruction) userParts.push({ text: instruction });
    if (userParts.length === 0) userParts.push({ text: 'oi' });

    contents.push({ role: 'user', parts: userParts });

    const response = await axios.post(url, {
        contents,
        generationConfig: { temperature: 0.7, topP: 0.95, topK: 40, maxOutputTokens: 1024 },
        safetySettings: [
            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' }
        ]
    }, { headers: { 'Content-Type': 'application/json' }, timeout: 60000 });

    const candidate = response.data?.candidates?.[0];
    if (!candidate?.content?.parts?.[0]?.text) throw new Error('Resposta vazia do Gemini Multimodal');
    return { text: candidate.content.parts[0].text };
}

/**
 * Chama qualquer API compatível com OpenAI (Groq, OpenAI, OpenRouter, Nvidia, Perplexity, Grok)
 */
async function callOpenAICompatibleAPI(
    apiKey: string, baseUrl: string, model: string,
    systemPrompt: string,
    history: { role: string; content: string }[], userMessage: string
): Promise<string> {
    const messages: any[] = [];
    if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
    for (const msg of history.slice(-20)) {
        messages.push({ role: msg.role === 'assistant' ? 'assistant' : 'user', content: msg.content });
    }
    messages.push({ role: 'user', content: userMessage });

    const response = await axios.post(`${baseUrl}/chat/completions`, {
        model, messages, temperature: 0.7, max_tokens: 1024
    }, {
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        timeout: 30000
    });

    const content = response.data?.choices?.[0]?.message?.content;
    if (!content) throw new Error(`Resposta vazia do provider (${model})`);
    return content;
}

// Configuração dos providers OpenAI-compatíveis
const PROVIDER_CONFIG: Record<string, { url: string; model: string }> = {
    groq: { url: 'https://api.groq.com/openai/v1', model: 'llama-3.3-70b-versatile' },
    openai: { url: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
    openrouter: { url: 'https://openrouter.ai/api/v1', model: 'meta-llama/llama-3.1-70b-instruct' },
    nvidia: { url: 'https://integrate.api.nvidia.com/v1', model: 'meta/llama-3.1-70b-instruct' },
    perplexity: { url: 'https://api.perplexity.ai', model: 'sonar' },
    grok: { url: 'https://api.x.ai/v1', model: 'grok-2-latest' },
};

/**
 * Chama a API da Anthropic (formato nativo — NÃO é compatível com OpenAI)
 */
async function callAnthropicAPI(
    apiKey: string,
    systemPrompt: string,
    history: { role: string; content: string }[],
    userMessage: string
): Promise<string> {
    const messages: any[] = [];
    for (const msg of history.slice(-20)) {
        messages.push({ role: msg.role === 'assistant' ? 'assistant' : 'user', content: msg.content });
    }
    messages.push({ role: 'user', content: userMessage });

    const response = await axios.post('https://api.anthropic.com/v1/messages', {
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: systemPrompt || undefined,
        messages
    }, {
        headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json'
        },
        timeout: 30000
    });

    const content = response.data?.content?.[0]?.text;
    if (!content) throw new Error('Resposta vazia do Anthropic');
    return content;
}

/**
 * Resolve a API key correta para o provider selecionado
 */
function getProviderApiKey(config: any): string {
    const provider = config.provider || 'gemini';
    const keyMap: Record<string, string> = {
        gemini: config.geminiApiKey || config.apiKey,
        groq: config.groqApiKey,
        openai: config.openaiApiKey,
        openrouter: config.openrouterApiKey,
        nvidia: config.nvidiaApiKey,
        perplexity: config.perplexityApiKey,
        grok: config.grokApiKey,
        anthropic: config.anthropicApiKey,
        zai: config.zaiApiKey,
    };
    return keyMap[provider] || config.apiKey || '';
}

/**
 * Baixa mídia da Evolution API
 */
async function downloadMedia(
    waConfig: { apiUrl: string; apiKey: string; instanceName: string },
    key: any
): Promise<{ buffer: Buffer; mimetype: string; filename: string } | null> {
    try {
        // Evolution API v2 usa base64Media endpoint
        const url = `${waConfig.apiUrl}/chat/getBase64FromMediaMessage/${waConfig.instanceName}`;
        const response = await axios.post(url, {
            message: { key }
        }, {
            headers: { apikey: waConfig.apiKey },
            timeout: 30000
        });

        const base64Data = response.data?.base64 || response.data?.media?.data;
        const mimetype = response.data?.mimetype || response.data?.media?.mimetype || 'application/octet-stream';

        if (!base64Data) {
            console.error('[Media] Resposta sem base64:', JSON.stringify(response.data).substring(0, 200));
            return null;
        }

        const buffer = Buffer.from(base64Data, 'base64');
        const filename = `media_${Date.now()}`;

        console.log(`[Media] ✅ Mídia baixada: ${mimetype}, ${buffer.length} bytes`);
        return { buffer, mimetype, filename };
    } catch (error: any) {
        console.error('[Media] Erro ao baixar mídia:', error?.response?.data || error.message);
        return null;
    }
}

/**
 * Transcreve áudio usando Groq Whisper
 */
async function transcribeAudio(audioBuffer: Buffer, filename: string, groqApiKey: string): Promise<string | null> {
    try {
        // Salva temporariamente
        const tempPath = path.join('/tmp', `${filename}.ogg`);
        fs.writeFileSync(tempPath, audioBuffer);

        // Envia para Groq Whisper
        const formData = new FormData();
        formData.append('file', fs.createReadStream(tempPath));
        formData.append('model', 'whisper-large-v3');
        formData.append('language', 'pt');

        const response = await axios.post('https://api.groq.com/openai/v1/audio/transcriptions', formData, {
            headers: {
                'Authorization': `Bearer ${groqApiKey}`,
                ...formData.getHeaders()
            },
            timeout: 60000
        });

        // Remove arquivo temporário
        fs.unlinkSync(tempPath);

        return response.data?.text || null;
    } catch (error: any) {
        console.error('[Whisper] Erro ao transcrever áudio:', error.message);
        return null;
    }
}

/**
 * Processa imagem com Claude Vision
 */
async function processImageWithClaude(
    imageBuffer: Buffer,
    mimetype: string,
    anthropicApiKey: string,
    userQuestion: string
): Promise<string> {
    try {
        const base64Image = imageBuffer.toString('base64');
        const mediaType = mimetype.includes('png') ? 'image/png' :
                         mimetype.includes('jpeg') || mimetype.includes('jpg') ? 'image/jpeg' :
                         mimetype.includes('webp') ? 'image/webp' : 'image/jpeg';

        const response = await axios.post('https://api.anthropic.com/v1/messages', {
            model: 'claude-sonnet-4-20250514',
            max_tokens: 1024,
            messages: [{
                role: 'user',
                content: [
                    {
                        type: 'image',
                        source: {
                            type: 'base64',
                            media_type: mediaType,
                            data: base64Image
                        }
                    },
                    {
                        type: 'text',
                        text: userQuestion || 'Descreva esta imagem em detalhes.'
                    }
                ]
            }]
        }, {
            headers: {
                'x-api-key': anthropicApiKey,
                'anthropic-version': '2023-06-01',
                'Content-Type': 'application/json'
            },
            timeout: 30000
        });

        return response.data?.content?.[0]?.text || 'Não foi possível processar a imagem.';
    } catch (error: any) {
        console.error('[Claude Vision] Erro:', error.message);
        return 'Erro ao processar imagem.';
    }
}

/**
 * Extrai texto de documento/PDF
 */
async function extractTextFromDocument(buffer: Buffer, mimetype: string): Promise<string | null> {
    try {
        if (mimetype.includes('pdf')) {
            const pdfParse = require('pdf-parse');
            const data = await pdfParse(buffer);
            return data.text;
        } else if (mimetype.includes('text')) {
            return buffer.toString('utf-8');
        }
        return null;
    } catch (error: any) {
        console.error('[Document] Erro ao extrair texto:', error.message);
        return null;
    }
}

/**
 * Envia mensagem pelo WhatsApp via Evolution API
 */
async function sendWhatsAppReply(
    config: { apiUrl: string; apiKey: string; instanceName: string },
    phone: string, text: string
): Promise<boolean> {
    try {
        const url = `${config.apiUrl}/message/sendText/${config.instanceName}`;
        await axios.post(url, {
            number: phone,
            text,
            options: { delay: 1200, presence: 'composing', linkPreview: false }
        }, { headers: { apikey: config.apiKey }, timeout: 15000 });
        return true;
    } catch (error: any) {
        console.error(`[WhatsApp] Erro ao enviar para ${phone}:`, error?.response?.data?.message || error.message);
        return false;
    }
}

// ============ ROUTES ============

// POST /api/webhook/whatsapp — Webhook da Evolution API (recebe mensagens)
webhookRouter.post('/whatsapp', async (req: Request, res: Response) => {
    // Responde 200 imediatamente para não bloquear a Evolution API
    res.status(200).json({ status: 'ok' });

    try {
        const body = req.body;

        // Evolution API v2 pode enviar diferentes eventos
        const eventType = body.event || body.type;
        const data = body.data || body;

        // Só processa mensagens recebidas (não enviadas por nós)
        if (eventType !== 'messages.upsert' && eventType !== 'message') return;

        // Extract message content - Evolution API v2 format
        const messageData = data.message || data;
        const key = data.key || messageData?.key;
        if (!key) return;

        // Ignora mensagens enviadas por nós
        if (key.fromMe) return;

        // Ignora grupos (nunca responder em grupos)
        const remoteJid = key.remoteJid || '';
        if (remoteJid.includes('@g.us')) {
            console.log('[Webhook] 🚫 Mensagem de grupo ignorada:', remoteJid);
            return;
        }

        // Ignora mensagens de broadcast/newsletter
        if (remoteJid.includes('@broadcast') || remoteJid.includes('@newsletter')) return;

        // Extrai texto da mensagem
        const msg = messageData.message || messageData;
        let content = msg?.conversation
            || msg?.extendedTextMessage?.text
            || msg?.imageMessage?.caption
            || msg?.videoMessage?.caption
            || '';

        // Detecta e ignora mensagens de outros bots/IAs para evitar loop
        const botIndicators = [
            '🤖', '🦈 Olá!', '🦈 Oi!', // Nosso próprio bot
            'Sou um assistente virtual', 'sou uma inteligência artificial',
            'I am an AI', 'I\'m an AI assistant',
            'como assistente virtual', 'sou um chatbot',
            '¡Hola! Soy', 'Soy un asistente',
        ];
        const pushName = data.pushName || '';
        const botNameIndicators = ['bot', 'Bot', 'BOT', 'assistant', 'Assistant', 'IA ', 'AI ', 'chatbot', 'Chatbot', 'autoresponder'];
        const isBotByName = botNameIndicators.some(indicator => pushName.includes(indicator));
        const isBotByContent = content && botIndicators.some(indicator => content.startsWith(indicator));

        // Se a mensagem vem de um bot (pelo nome) E parece resposta automática, ignora
        if (isBotByName && isBotByContent) {
            console.log(`[Webhook] 🤖 Mensagem de bot/IA ignorada (${pushName}): ${content.substring(0, 60)}...`);
            return;
        }

        // Detecta loop: se recebemos muitas mensagens do mesmo número em poucos segundos, pode ser bot
        // Verifica se as últimas 3 mensagens deste número nos últimos 30s são todas de "assistant" (indicando loop)
        const recentBotCheck = await prisma.aiChatHistory.findMany({
            where: { phone: remoteJid.replace('@s.whatsapp.net', ''), createdAt: { gte: new Date(Date.now() - 30000) } },
            orderBy: { createdAt: 'desc' },
            take: 6
        });
        const recentPattern = recentBotCheck.map(m => m.role).join(',');
        if (recentBotCheck.length >= 6 && recentPattern === 'assistant,user,assistant,user,assistant,user') {
            console.log(`[Webhook] 🔄 Possível loop de bot detectado para ${remoteJid.replace('@s.whatsapp.net', '')} - pausando resposta`);
            return;
        }

        // Detecta tipo de mídia
        const hasAudio = msg?.audioMessage || msg?.pttMessage;
        const hasImage = msg?.imageMessage;
        const hasDocument = msg?.documentMessage;
        const messageId = key.id;

        // Se não tem texto nem mídia, ignora
        if (!content && !hasAudio && !hasImage && !hasDocument) return;

        // Normaliza telefone
        const phone = remoteJid.replace('@s.whatsapp.net', '');
        console.log(`[Webhook] 📩 Mensagem de ${phone}: ${content.substring(0, 80) || '[MÍDIA]'}`);

        // 1. Busca config do WhatsApp
        const waConfig = await prisma.whatsappConfig.findFirst();
        if (!waConfig || !waConfig.isConnected) {
            console.log('[Webhook] WhatsApp não configurado ou desconectado');
            return;
        }

        // 2. Log de auditoria
        const customer = await prisma.customer.findFirst({
            where: {
                OR: [
                    { phone: { contains: phone } },
                    { phone: { contains: phone.substring(2) } }
                ]
            }
        });

        if (customer) {
            await prisma.auditLog.create({
                data: {
                    userId: customer.userId || 'system',
                    userName: customer.name,
                    action: 'WHATSAPP_MESSAGE_RECEIVED',
                    entity: 'CUSTOMER',
                    entityId: customer.id,
                    details: `Mensagem recebida: ${content.substring(0, 200)}`,
                    ipAddress: 'webhook'
                }
            }).catch(() => { });
        }

        // 2.5. Alertar admins de TODA mensagem recebida via WhatsApp + Push
        const senderName = customer?.name || phone;
        // Notificação no sistema para admin
        await prisma.notification.create({
            data: {
                title: `📩 Mensagem WhatsApp: ${senderName}`,
                message: `${content.substring(0, 200)}`,
                type: 'INFO'
            }
        }).catch(() => { });
        // Push para admins
        sendPushToRole('ADMIN', `📩 WhatsApp: ${senderName}`, content.substring(0, 100)).catch(() => { });
        // WhatsApp para admins (encaminhar mensagem do cliente)
        try {
            const admins = await prisma.user.findMany({ where: { role: 'ADMIN' } });
            for (const admin of admins) {
                if (admin.phone && admin.phone !== phone) {
                    sendWhatsAppMessage(admin.phone,
                        `📩 *Mensagem de Cliente*\n\nDe: ${senderName} (${phone})\n\n"${content.substring(0, 300)}"\n\n_Encaminhado automaticamente_`
                    ).catch(() => { });
                }
            }
        } catch { }

        // 3. Busca config do chatbot IA
        const chatConfig = await prisma.aiChatbotConfig.findFirst();
        if (!chatConfig || !chatConfig.enabled) {
            console.log('[Webhook] Chatbot IA desabilitado');
            return;
        }

        // Verifica se tem API key para o provider selecionado
        const resolvedApiKey = getProviderApiKey(chatConfig);
        if (!resolvedApiKey) {
            console.log(`[Webhook] API key vazia para provider ${chatConfig.provider || 'gemini'}`);
            return;
        }

        // 4. Verifica horário de atendimento (somente se workingHoursOnly estiver ativo)
        if (chatConfig.workingHoursOnly && !isWithinWorkingHours(chatConfig.workingHoursStart, chatConfig.workingHoursEnd)) {
            await prisma.aiChatHistory.create({ data: { phone, role: 'user', content } });
            const offMsg = `Olá! Nosso atendimento funciona das ${chatConfig.workingHoursStart} às ${chatConfig.workingHoursEnd}. Sua mensagem foi registrada e retornaremos assim que possível. 😊`;
            await prisma.aiChatHistory.create({ data: { phone, role: 'assistant', content: offMsg, metadata: { autoReply: true, reason: 'OFF_HOURS' } } });
            await sendWhatsAppReply(waConfig, phone, offMsg);
            return;
        }

        // 5. Verifica se está em modo humano (PAUSED)
        const lastSystem = await prisma.aiChatHistory.findFirst({
            where: { phone, role: 'system' },
            orderBy: { createdAt: 'desc' }
        });
        if (lastSystem?.content === 'PAUSED') {
            await prisma.aiChatHistory.create({ data: { phone, role: 'user', content } });
            console.log(`[Webhook] Conversa ${phone} está em modo humano, não respondendo com IA`);
            return;
        }

        // 6. Verifica keywords de transferência
        if (containsTransferKeyword(content, chatConfig.transferKeywords)) {
            await prisma.aiChatHistory.create({ data: { phone, role: 'user', content } });
            await prisma.aiChatHistory.create({ data: { phone, role: 'system', content: 'PAUSED', metadata: { reason: 'TRANSFER_KEYWORD' } } });
            const transferMsg = 'Entendido! Estou transferindo você para um atendente humano. Aguarde um momento, por favor. 🙋';
            await prisma.aiChatHistory.create({ data: { phone, role: 'assistant', content: transferMsg, metadata: { autoReply: true, reason: 'TRANSFER' } } });
            await sendWhatsAppReply(waConfig, phone, transferMsg);

            // Alertar TODOS admins via Push + WhatsApp + Notificação
            const clientName = customer?.name || phone;
            sendPushToRole('ADMIN', '🤖 Cliente quer falar com humano', `${clientName} solicitou transferência. Msg: "${content.substring(0, 80)}"`).catch(() => { });
            await prisma.notification.create({
                data: {
                    title: '🤖 Transferência Chatbot',
                    message: `${clientName} (${phone}) solicitou atendimento humano. Mensagem: "${content.substring(0, 200)}"`,
                    type: 'ALERT'
                }
            }).catch(() => { });
            // WhatsApp para admins
            try {
                const admins = await prisma.user.findMany({ where: { role: 'ADMIN' } });
                for (const admin of admins) {
                    if (admin.phone) {
                        sendWhatsAppMessage(admin.phone,
                            `🤖 *Transferência Chatbot*\n\nCliente: ${clientName}\nTel: ${phone}\nMsg: "${content.substring(0, 150)}"\n\nResponda diretamente ou acesse o painel.`
                        ).catch(() => { });
                    }
                }
            } catch { }
            return;
        }

        // 6.5. Processa mídia (áudio, imagem, documento)
        let mediaContext = '';
        let mediaBuffer: Buffer | undefined;
        let mediaMimetype: string | undefined;

        if (hasAudio || hasImage || hasDocument) {
            console.log(`[Webhook] 📎 Processando mídia: audio=${!!hasAudio}, image=${!!hasImage}, doc=${!!hasDocument}`);

            const media = await downloadMedia(waConfig, key);
            if (media) {
                const currentProvider = chatConfig.provider || 'gemini';

                // Se Gemini é o provider principal, usa processamento multimodal nativo
                if (currentProvider === 'gemini' && chatConfig.geminiApiKey) {
                    mediaBuffer = media.buffer;
                    mediaMimetype = media.mimetype;
                    const mediaType = hasAudio ? '🎤 Áudio' : hasImage ? '🖼️ Imagem' : '📄 Documento';
                    console.log(`[Webhook] ${mediaType} será processado nativamente pelo Gemini`);
                } else {
                    // Fallback: processa mídia com serviços separados
                    if (hasAudio) {
                        const groqKey = chatConfig.groqApiKey || chatConfig.apiKey;
                        if (groqKey) {
                            const transcription = await transcribeAudio(media.buffer, media.filename, groqKey);
                            if (transcription) {
                                mediaContext += `\n\n[ÁUDIO TRANSCRITO]: ${transcription}`;
                                content = content || transcription;
                                console.log(`[Webhook] 🎤 Áudio transcrito (Whisper): ${transcription.substring(0, 100)}...`);
                            }
                        }
                    }

                    if (hasImage) {
                        const anthropicKey = chatConfig.anthropicApiKey;
                        if (anthropicKey) {
                            const imageAnalysis = await processImageWithClaude(
                                media.buffer, media.mimetype, anthropicKey,
                                content || 'O que você vê nesta imagem?'
                            );
                            mediaContext += `\n\n[IMAGEM ANALISADA]: ${imageAnalysis}`;
                            console.log(`[Webhook] 🖼️ Imagem processada (Claude): ${imageAnalysis.substring(0, 100)}...`);
                        }
                    }

                    if (hasDocument) {
                        const docText = await extractTextFromDocument(media.buffer, media.mimetype);
                        if (docText) {
                            mediaContext += `\n\n[DOCUMENTO]: ${docText.substring(0, 2000)}`;
                            console.log(`[Webhook] 📄 Documento extraído: ${docText.substring(0, 100)}...`);
                        }
                    }
                }
            }
        }

        // 7. Busca histórico recente
        const recentHistory = await prisma.aiChatHistory.findMany({
            where: { phone, role: { in: ['user', 'assistant'] } },
            orderBy: { createdAt: 'desc' },
            take: 20
        });
        const conversationHistory = recentHistory.reverse().map(h => ({ role: h.role, content: h.content }));

        // 8. Monta system prompt com contexto ENRIQUECIDO
        // IMPORTANTE: O prompt do admin vem PRIMEIRO para ter prioridade máxima
        const adminPrompt = chatConfig.systemPrompt || 'Você é um assistente virtual da Tubarão Empréstimos, uma empresa de crédito. Seja educado, profissional e objetivo.';
        let contextData = '';

        // 8.1 Detectar CPF na mensagem (formato: XXX.XXX.XXX-XX ou XXXXXXXXXXX)
        const cpfMatch = content.match(/(\d{3}\.?\d{3}\.?\d{3}-?\d{2})/);
        let lookupCustomer = customer;

        if (cpfMatch && !customer) {
            const cpfClean = cpfMatch[1].replace(/\D/g, '');
            const cpfFormatted = cpfClean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
            lookupCustomer = await prisma.customer.findFirst({
                where: { OR: [{ cpf: cpfClean }, { cpf: cpfFormatted }] }
            });
            if (!lookupCustomer) {
                // CPF não encontrado no sistema — a IA deve informar
                contextData += `\n\n⚠️ CONSULTA DE CPF: O cliente informou o CPF ${cpfFormatted} mas NÃO foi encontrado no sistema. Informe educadamente que o CPF não está cadastrado e oriente a pessoa a se cadastrar pelo site ou app.`;
            }
        }

        // 8.2 Injetar dados completos do cliente identificado
        if (lookupCustomer) {
            contextData += `\n\n===== DADOS DO CLIENTE (CONFIDENCIAL — use para responder, mas nunca mostre dados sensíveis completos) =====`;
            contextData += `\nNome: ${lookupCustomer.name}`;
            contextData += `\nCPF: ${lookupCustomer.cpf}`;
            contextData += `\nEmail: ${lookupCustomer.email}`;
            contextData += `\nTelefone: ${lookupCustomer.phone || 'não informado'}`;
            contextData += `\nStatus: ${lookupCustomer.status}`;

            // Buscar empréstimos ativos
            try {
                const loans = await prisma.loan.findMany({
                    where: { customerId: lookupCustomer.id },
                    include: {
                        installments: { orderBy: { dueDate: 'asc' } }
                    }
                });

                if (loans.length === 0) {
                    contextData += `\nEmpréstimos: Nenhum empréstimo ativo encontrado.`;
                } else {
                    contextData += `\n\n--- EMPRÉSTIMOS (${loans.length}) ---`;
                    for (const loan of loans) {
                        contextData += `\n\nContrato #${loan.id.slice(-6)}:`;
                        contextData += `\n  Valor emprestado: R$ ${loan.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
                        contextData += `\n  Saldo devedor: R$ ${loan.remainingAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
                        contextData += `\n  Total de parcelas: ${loan.installmentsCount}`;
                        contextData += `\n  Status: ${loan.status || 'ATIVO'}`;

                        // Parcelas detalhadas
                        const paid = loan.installments.filter((i: any) => i.status === 'PAID').length;
                        const late = loan.installments.filter((i: any) => i.status === 'LATE');
                        const open = loan.installments.filter((i: any) => i.status === 'OPEN');

                        contextData += `\n  Parcelas pagas: ${paid}/${loan.installmentsCount}`;

                        if (late.length > 0) {
                            contextData += `\n  ⚠️ PARCELAS ATRASADAS (${late.length}):`;
                            for (const inst of late) {
                                const daysLate = Math.floor((Date.now() - new Date(inst.dueDate).getTime()) / 86400000);
                                contextData += `\n    - Parcela R$ ${inst.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} venceu em ${new Date(inst.dueDate).toLocaleDateString('pt-BR')} (${daysLate} dias de atraso)`;
                            }
                        }

                        if (open.length > 0) {
                            const nextInst = open[0];
                            contextData += `\n  Próxima parcela: R$ ${(nextInst as any).amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} vence em ${new Date((nextInst as any).dueDate).toLocaleDateString('pt-BR')}`;
                        }
                    }
                }

                // Buscar solicitações pendentes
                const pendingRequests = await prisma.loanRequest.findMany({
                    where: { customerId: lookupCustomer.id, status: { in: ['PENDING', 'IN_REVIEW'] } }
                });
                if (pendingRequests.length > 0) {
                    contextData += `\n\n--- SOLICITAÇÕES PENDENTES (${pendingRequests.length}) ---`;
                    for (const req of pendingRequests) {
                        contextData += `\n  Solicitação: R$ ${req.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} em ${req.installments}x — Status: ${req.status}`;
                    }
                }

            } catch (dbErr: any) {
                console.error('[Webhook] Erro ao buscar dados financeiros do cliente:', dbErr.message);
            }

            contextData += `\n===== FIM DOS DADOS DO CLIENTE =====`;
            contextData += `\n\nIMPORTANTE: Use esses dados para responder perguntas do cliente sobre seus empréstimos, parcelas, saldo devedor, datas de vencimento, etc. Nunca exponha o CPF completo ou dados sensíveis na resposta. Se o cliente perguntar "quanto devo?", informe o saldo devedor. Se perguntar sobre parcelas, detalhe as próximas e atrasadas.`;
        }

        // Monta o prompt final: ADMIN PROMPT PRIMEIRO (prioridade máxima) + contexto depois
        const systemPrompt = `${adminPrompt}\n\n${contextData}${mediaContext}`;

        // 9. Chama a IA com fallback automático: Gemini → Perplexity → Groq → Claude
        let aiResponse: string;
        const provider = chatConfig.provider || 'gemini';
        console.log(`[Webhook] Chamando IA: provider=${provider}, keyLen=${resolvedApiKey?.length || 0}${mediaBuffer ? ', com mídia nativa' : ''}`);

        // Monta mensagem completa com contexto de mídia
        const fullMessage = content + mediaContext;

        // Função auxiliar para chamar provider específico
        const callProvider = async (p: string, key: string): Promise<string> => {
            // Se Gemini e tem mídia, usa API multimodal nativa
            if (p === 'gemini' && mediaBuffer && mediaMimetype) {
                const result = await callGeminiMultimodalAPI(key, systemPrompt, conversationHistory, content || '', mediaBuffer, mediaMimetype);
                return result.text;
            }
            if (p === 'gemini') return callGeminiAPI(key, systemPrompt, conversationHistory, fullMessage);
            if (p === 'anthropic') return callAnthropicAPI(key, systemPrompt, conversationHistory, fullMessage);
            if (PROVIDER_CONFIG[p]) {
                const cfg = PROVIDER_CONFIG[p];
                return callOpenAICompatibleAPI(key, cfg.url, cfg.model, systemPrompt, conversationHistory, fullMessage);
            }
            return callGeminiAPI(key, systemPrompt, conversationHistory, fullMessage);
        };

        // Ordem de fallback: provider principal → Claude → Perplexity → Groq → Gemini
        const fallbackChain: { name: string; key: string }[] = [
            { name: provider, key: resolvedApiKey },
        ];
        if (provider !== 'anthropic' && chatConfig.anthropicApiKey) fallbackChain.push({ name: 'anthropic', key: chatConfig.anthropicApiKey });
        if (provider !== 'perplexity' && chatConfig.perplexityApiKey) fallbackChain.push({ name: 'perplexity', key: chatConfig.perplexityApiKey });
        if (provider !== 'groq' && chatConfig.groqApiKey) fallbackChain.push({ name: 'groq', key: chatConfig.groqApiKey });
        if (provider !== 'gemini' && chatConfig.geminiApiKey) fallbackChain.push({ name: 'gemini', key: chatConfig.geminiApiKey });

        let usedProvider = provider;
        try {
            let lastError: any = null;
            for (const fb of fallbackChain) {
                try {
                    aiResponse = await callProvider(fb.name, fb.key);
                    usedProvider = fb.name;
                    if (fb.name !== provider) console.log(`[Webhook] ⚠️ Fallback: ${provider} falhou, usando ${fb.name}`);
                    lastError = null;
                    break;
                } catch (err: any) {
                    console.error(`[Webhook] ❌ Provider ${fb.name} falhou:`, err?.response?.data?.error?.message || err.message);
                    lastError = err;
                }
            }
            if (lastError) throw lastError;
        } catch (aiError: any) {
            console.error(`[Webhook] Erro na IA (todos providers falharam):`, aiError?.response?.data || aiError.message);
            await prisma.aiChatHistory.create({ data: { phone, role: 'user', content: fullMessage } });
            await prisma.aiChatHistory.create({ data: { phone, role: 'system', content: 'ERROR', metadata: { error: aiError.message, provider } } });
            return;
        }

        // 10. Salva histórico
        await prisma.aiChatHistory.create({ data: { phone, role: 'user', content: fullMessage } });
        await prisma.aiChatHistory.create({ data: { phone, role: 'assistant', content: aiResponse, metadata: { provider: usedProvider, autoReply: true } } });

        // 11. Envia resposta pelo WhatsApp
        const sent = await sendWhatsAppReply(waConfig, phone, aiResponse);
        console.log(`[Webhook] ${sent ? '✅' : '❌'} Resposta IA enviada para ${phone} (${usedProvider})`);

    } catch (error: any) {
        console.error('[Webhook] Erro ao processar mensagem:', error.message);
    }
});

// POST /api/webhook/send — Enviar mensagem manualmente (Backend -> WhatsApp)
webhookRouter.post('/send', async (req: Request, res: Response) => {
    try {
        const { phone, message } = req.body;
        const config = await prisma.whatsappConfig.findFirst();

        if (!config || !config.isConnected) {
            res.status(400).json({ error: 'WhatsApp desconectado' });
            return;
        }

        const sent = await sendWhatsAppReply(config, phone, message);
        if (sent) {
            res.json({ success: true });
        } else {
            res.status(500).json({ error: 'Falha ao enviar mensagem' });
        }
    } catch (error) {
        console.error('[WhatsApp] Erro ao enviar:', error);
        res.status(500).json({ error: 'Erro ao enviar mensagem' });
    }
});
