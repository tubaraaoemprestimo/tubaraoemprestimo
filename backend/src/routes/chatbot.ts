import { Router, Request, Response } from 'express';
import { prisma } from '../services/prisma';
import { authenticate, requireAdmin } from '../middleware/auth';
import axios from 'axios';

export const chatbotRouter = Router();

// ============ Helpers ============

/**
 * Verifica se o horário atual está dentro do horário de atendimento
 */
function isWithinWorkingHours(start: string, end: string): boolean {
    const now = new Date();
    // Converte para horário de Brasília (UTC-3)
    const brasiliaOffset = -3 * 60;
    const localTime = new Date(now.getTime() + (brasiliaOffset - now.getTimezoneOffset()) * 60000);

    const currentMinutes = localTime.getHours() * 60 + localTime.getMinutes();

    const [startH, startM] = start.split(':').map(Number);
    const [endH, endM] = end.split(':').map(Number);

    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
}

/**
 * Verifica se a mensagem contém keywords de transferência
 */
function containsTransferKeyword(message: string, keywords: string[]): boolean {
    const lowerMessage = message.toLowerCase();
    return keywords.some(keyword => lowerMessage.includes(keyword.toLowerCase()));
}

/**
 * Chama a API do Google Gemini
 */
async function callGeminiAPI(
    apiKey: string,
    systemPrompt: string,
    conversationHistory: { role: string; content: string }[],
    userMessage: string
): Promise<string> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

    const contents: any[] = [];

    if (systemPrompt) {
        contents.push({
            role: 'user',
            parts: [{ text: systemPrompt }]
        });
        contents.push({
            role: 'model',
            parts: [{ text: 'Entendido.' }]
        });
    }

    const recentHistory = conversationHistory.slice(-20);
    for (const msg of recentHistory) {
        contents.push({
            role: msg.role === 'user' ? 'user' : 'model',
            parts: [{ text: msg.content }]
        });
    }

    contents.push({
        role: 'user',
        parts: [{ text: userMessage }]
    });

    const response = await axios.post(url, {
        contents,
        generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1024
        }
    }, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000
    });

    const candidate = response.data?.candidates?.[0];
    if (!candidate?.content?.parts?.[0]?.text) {
        throw new Error('Resposta vazia do Gemini');
    }

    return candidate.content.parts[0].text;
}

/**
 * Chama a API do OpenAI
 */
async function callOpenAIAPI(
    apiKey: string,
    systemPrompt: string,
    conversationHistory: { role: string; content: string }[],
    userMessage: string
): Promise<string> {
    const messages: any[] = [{ role: 'system', content: systemPrompt }];

    const recentHistory = conversationHistory.slice(-20);
    for (const msg of recentHistory) {
        messages.push({
            role: msg.role === 'assistant' ? 'assistant' : 'user',
            content: msg.content
        });
    }

    messages.push({ role: 'user', content: userMessage });

    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
        model: 'gpt-4o-mini',
        messages,
        temperature: 0.7,
        max_tokens: 1024
    }, {
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        timeout: 30000
    });

    const content = response.data?.choices?.[0]?.message?.content;
    if (!content) {
        throw new Error('Resposta vazia do OpenAI');
    }

    return content;
}

/**
 * Chama a API do OpenRouter (aggregador de múltiplos modelos)
 */
async function callOpenRouterAPI(
    apiKey: string,
    systemPrompt: string,
    conversationHistory: { role: string; content: string }[],
    userMessage: string
): Promise<string> {
    const messages: any[] = [];

    if (systemPrompt) {
        messages.push({ role: 'system', content: systemPrompt });
    }

    const recentHistory = conversationHistory.slice(-20);
    for (const msg of recentHistory) {
        messages.push({
            role: msg.role === 'assistant' ? 'assistant' : 'user',
            content: msg.content
        });
    }

    messages.push({ role: 'user', content: userMessage });

    const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
        model: 'google/gemini-2.0-flash-exp:free',
        messages,
        temperature: 0.7,
        max_tokens: 1024
    }, {
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        timeout: 30000
    });

    const content = response.data?.choices?.[0]?.message?.content;
    if (!content) {
        throw new Error('Resposta vazia do OpenRouter');
    }

    return content;
}

/**
 * Chama a API da Nvidia NIM (NVIDIA Inference Microservice)
 */
async function callNvidiaAPI(
    apiKey: string,
    systemPrompt: string,
    conversationHistory: { role: string; content: string }[],
    userMessage: string
): Promise<string> {
    const messages: any[] = [];

    if (systemPrompt) {
        messages.push({ role: 'system', content: systemPrompt });
    }

    const recentHistory = conversationHistory.slice(-20);
    for (const msg of recentHistory) {
        messages.push({
            role: msg.role === 'assistant' ? 'assistant' : 'user',
            content: msg.content
        });
    }

    messages.push({ role: 'user', content: userMessage });

    const response = await axios.post(
        'https://integrate.api.nvidia.com/v1/chat/completions',
        {
            model: 'nvidia/llama-3.1-nemotron-70b-instruct',
            messages,
            temperature: 0.7,
            max_tokens: 1024,
            stream: false
        },
        {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            timeout: 30000
        }
    );

    const content = response.data?.choices?.[0]?.message?.content;
    if (!content) {
        throw new Error('Resposta vazia da Nvidia');
    }

    return content;
}

/**
 * Chama a API do Z.AI (via Groq API compatível)
 */
async function callZaiAPI(
    apiKey: string,
    systemPrompt: string,
    conversationHistory: { role: string; content: string }[],
    userMessage: string
): Promise<string> {
    const messages: any[] = [];

    if (systemPrompt) {
        messages.push({ role: 'system', content: systemPrompt });
    }

    const recentHistory = conversationHistory.slice(-20);
    for (const msg of recentHistory) {
        messages.push({
            role: msg.role === 'assistant' ? 'assistant' : 'user',
            content: msg.content
        });
    }

    messages.push({ role: 'user', content: userMessage });

    const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
        model: 'llama-3.1-70b-versatile',
        messages,
        temperature: 0.7,
        max_tokens: 1024
    }, {
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        timeout: 30000
    });

    const content = response.data?.choices?.[0]?.message?.content;
    if (!content) {
        throw new Error('Resposta vazia do Z.AI');
    }

    return content;
}

/**
 * Chama a API do Perplexity
 */
async function callPerplexityAPI(
    apiKey: string,
    systemPrompt: string,
    conversationHistory: { role: string; content: string }[],
    userMessage: string
): Promise<string> {
    const url = 'https://api.perplexity.ai/chat/completions';

    const messages: any[] = [];

    if (systemPrompt) {
        messages.push({ role: 'system', content: systemPrompt });
    }

    // Últimas 20 mensagens do histórico
    const recentHistory = conversationHistory.slice(-20);
    for (const msg of recentHistory) {
        messages.push({
            role: msg.role === 'assistant' ? 'assistant' : 'user',
            content: msg.content
        });
    }

    messages.push({ role: 'user', content: userMessage });

    const response = await axios.post(url, {
        model: 'llama-3.1-sonar-small-128k-online',
        messages,
        temperature: 0.7,
        max_tokens: 1024
    }, {
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        timeout: 30000
    });

    const content = response.data?.choices?.[0]?.message?.content;
    if (!content) {
        throw new Error('Resposta vazia do Perplexity');
    }

    return content;
}

// ============ ROUTES ============

// GET /api/chatbot/config - Buscar configuração do chatbot
chatbotRouter.get('/config', authenticate, async (_req: Request, res: Response) => {
    try {
        const config = await prisma.aiChatbotConfig.findFirst();
        if (!config) {
            res.json({
                enabled: false,
                provider: 'gemini',
                apiKey: '',
                systemPrompt: '',
                autoReplyEnabled: true,
                workingHoursStart: '08:00',
                workingHoursEnd: '18:00',
                transferKeywords: ['atendente', 'humano', 'pessoa']
            });
            return;
        }

        // Mascara a API key para não expor no frontend (mostra apenas últimos 4 chars)
        const maskedConfig = {
            ...config,
            apiKey: config.apiKey ? `****${config.apiKey.slice(-4)}` : ''
        };

        res.json(maskedConfig);
    } catch {
        res.status(500).json({ error: 'Erro ao buscar configuração do chatbot' });
    }
});

// PUT /api/chatbot/config - Atualizar configuração (admin only)
chatbotRouter.put('/config', authenticate, requireAdmin, async (req: Request, res: Response) => {
    try {
        const {
            enabled,
            provider,
            apiKey,
            systemPrompt,
            autoReplyEnabled,
            workingHoursStart,
            workingHoursEnd,
            transferKeywords
        } = req.body;

        const data: any = {};
        if (enabled !== undefined) data.enabled = enabled;
        if (provider !== undefined) data.provider = provider;
        if (apiKey !== undefined && !apiKey.startsWith('****')) data.apiKey = apiKey; // Só atualiza se não for masked
        if (systemPrompt !== undefined) data.systemPrompt = systemPrompt;
        if (autoReplyEnabled !== undefined) data.autoReplyEnabled = autoReplyEnabled;
        if (workingHoursStart !== undefined) data.workingHoursStart = workingHoursStart;
        if (workingHoursEnd !== undefined) data.workingHoursEnd = workingHoursEnd;
        if (transferKeywords !== undefined) data.transferKeywords = transferKeywords;

        const existing = await prisma.aiChatbotConfig.findFirst();
        if (existing) {
            await prisma.aiChatbotConfig.update({ where: { id: existing.id }, data });
        } else {
            await prisma.aiChatbotConfig.create({ data });
        }

        res.json({ success: true });
    } catch (error: any) {
        console.error('[Chatbot] Erro ao salvar config:', error);
        res.status(500).json({ error: 'Erro ao salvar configuração do chatbot' });
    }
});

// GET /api/chatbot/history/:phone - Buscar histórico de chat por telefone
chatbotRouter.get('/history/:phone', authenticate, async (req: Request, res: Response) => {
    try {
        const phoneParam = req.params.phone;
        const phone = Array.isArray(phoneParam) ? phoneParam[0] : phoneParam;
        const limit = (req.query.limit as string) || '50';
        const offset = (req.query.offset as string) || '0';

        const history = await prisma.aiChatHistory.findMany({
            where: { phone },
            orderBy: { createdAt: 'asc' },
            take: parseInt(limit),
            skip: parseInt(offset)
        });

        const total = await prisma.aiChatHistory.count({ where: { phone } });

        res.json({ history, total });
    } catch {
        res.status(500).json({ error: 'Erro ao buscar histórico' });
    }
});

// POST /api/chatbot/message - Processar mensagem com IA
chatbotRouter.post('/message', authenticate, async (req: Request, res: Response) => {
    try {
        const { phone, message, customerContext } = req.body;

        if (!phone || !message) {
            res.status(400).json({ error: 'Campos obrigatórios: phone, message' });
            return;
        }

        // 1. Busca configuração
        const config = await prisma.aiChatbotConfig.findFirst();

        if (!config || !config.enabled) {
            res.status(400).json({ error: 'Chatbot desabilitado', code: 'CHATBOT_DISABLED' });
            return;
        }

        if (!config.apiKey) {
            res.status(500).json({ error: 'API Key do chatbot não configurada' });
            return;
        }

        // 2. Verifica se está em horário de atendimento
        if (!isWithinWorkingHours(config.workingHoursStart, config.workingHoursEnd)) {
            // Salva mensagem do usuário no histórico
            await prisma.aiChatHistory.create({
                data: { phone, role: 'user', content: message }
            });

            const offHoursMsg = `Olá! Nosso atendimento funciona das ${config.workingHoursStart} às ${config.workingHoursEnd}. Sua mensagem foi registrada e retornaremos assim que possível. 😊`;

            await prisma.aiChatHistory.create({
                data: { phone, role: 'assistant', content: offHoursMsg, metadata: { autoReply: true, reason: 'OFF_HOURS' } }
            });

            res.json({ response: offHoursMsg, status: 'OFF_HOURS' });
            return;
        }

        // 3. Verifica se conversa está em modo handover (transferida para humano)
        const lastSystemMessage = await prisma.aiChatHistory.findFirst({
            where: { phone, role: 'system' },
            orderBy: { createdAt: 'desc' }
        });

        if (lastSystemMessage?.content === 'PAUSED') {
            // Conversa transferida para humano - salva mensagem mas não responde com IA
            await prisma.aiChatHistory.create({
                data: { phone, role: 'user', content: message }
            });

            res.json({
                response: null,
                status: 'TRANSFERRED',
                message: 'Conversa transferida para atendente humano'
            });
            return;
        }

        // 4. Verifica keywords de transferência
        if (containsTransferKeyword(message, config.transferKeywords)) {
            // Salva mensagem do usuário
            await prisma.aiChatHistory.create({
                data: { phone, role: 'user', content: message }
            });

            // Marca como transferida
            await prisma.aiChatHistory.create({
                data: { phone, role: 'system', content: 'PAUSED', metadata: { reason: 'TRANSFER_KEYWORD' } }
            });

            const transferMsg = 'Entendido! Estou transferindo você para um atendente humano. Aguarde um momento, por favor. 🙋';

            await prisma.aiChatHistory.create({
                data: { phone, role: 'assistant', content: transferMsg, metadata: { autoReply: true, reason: 'TRANSFER' } }
            });

            res.json({ response: transferMsg, status: 'TRANSFERRED' });
            return;
        }

        // 5. Busca histórico recente
        const recentHistory = await prisma.aiChatHistory.findMany({
            where: {
                phone,
                role: { in: ['user', 'assistant'] }
            },
            orderBy: { createdAt: 'desc' },
            take: 20
        });

        const conversationHistory = recentHistory
            .reverse()
            .map(h => ({ role: h.role, content: h.content }));

        // 6. Monta system prompt com contexto do cliente
        let systemPrompt = config.systemPrompt || 'Você é um assistente virtual da Tubarão Empréstimos, uma empresa de crédito. Seja educado, profissional e objetivo.';

        if (customerContext) {
            systemPrompt += `\n\nContexto do cliente:\n${JSON.stringify(customerContext)}`;
        }

        // 7. Chama a IA (Gemini, Perplexity, OpenAI, OpenRouter, Nvidia, Z.AI)
        let aiResponse: string;

        switch (config.provider) {
            case 'perplexity':
                aiResponse = await callPerplexityAPI(config.apiKey, systemPrompt, conversationHistory, message);
                break;
            case 'openai':
                aiResponse = await callOpenAIAPI(config.openaiApiKey || config.apiKey, systemPrompt, conversationHistory, message);
                break;
            case 'openrouter':
                aiResponse = await callOpenRouterAPI(config.openrouterApiKey || config.apiKey, systemPrompt, conversationHistory, message);
                break;
            case 'nvidia':
                aiResponse = await callNvidiaAPI(config.nvidiaApiKey || config.apiKey, systemPrompt, conversationHistory, message);
                break;
            case 'zai':
                aiResponse = await callZaiAPI(config.zaiApiKey || config.apiKey, systemPrompt, conversationHistory, message);
                break;
            default:
                aiResponse = await callGeminiAPI(config.geminiApiKey || config.apiKey, systemPrompt, conversationHistory, message);
        }

        // 8. Salva mensagem do usuário e resposta da IA
        await prisma.aiChatHistory.create({
            data: { phone, role: 'user', content: message }
        });

        await prisma.aiChatHistory.create({
            data: {
                phone,
                role: 'assistant',
                content: aiResponse,
                metadata: { provider: config.provider, autoReply: true }
            }
        });

        res.json({ response: aiResponse, status: 'OK', provider: config.provider });
    } catch (error: any) {
        console.error('[Chatbot] Erro ao processar mensagem:', error);

        // Tenta salvar erro no histórico
        try {
            const { phone } = req.body;
            if (phone) {
                await prisma.aiChatHistory.create({
                    data: {
                        phone,
                        role: 'system',
                        content: 'ERROR',
                        metadata: { error: error.message || 'Erro desconhecido' }
                    }
                });
            }
        } catch { /* ignora erro do log */ }

        res.status(500).json({ error: 'Erro ao processar mensagem com IA' });
    }
});

// POST /api/chatbot/transfer/:phone - Transferir para atendente humano
chatbotRouter.post('/transfer/:phone', authenticate, requireAdmin, async (req: Request, res: Response) => {
    try {
        const phoneParam = req.params.phone;
        const phone = Array.isArray(phoneParam) ? phoneParam[0] : phoneParam;
        const { reason } = req.body;

        // Cria mensagem de sistema marcando como PAUSED
        await prisma.aiChatHistory.create({
            data: {
                phone,
                role: 'system',
                content: 'PAUSED',
                metadata: {
                    reason: reason || 'MANUAL_TRANSFER',
                    transferredBy: req.user!.id,
                    transferredAt: new Date().toISOString()
                }
            }
        });

        res.json({ success: true, message: `Conversa com ${phone} transferida para atendimento humano` });
    } catch {
        res.status(500).json({ error: 'Erro ao transferir conversa' });
    }
});

// POST /api/chatbot/resume/:phone - Retomar atendimento automático
chatbotRouter.post('/resume/:phone', authenticate, requireAdmin, async (req: Request, res: Response) => {
    try {
        const phoneParam = req.params.phone;
        const phone = Array.isArray(phoneParam) ? phoneParam[0] : phoneParam;

        // Cria mensagem de sistema marcando como RESUMED
        await prisma.aiChatHistory.create({
            data: {
                phone,
                role: 'system',
                content: 'RESUMED',
                metadata: {
                    resumedBy: req.user!.id,
                    resumedAt: new Date().toISOString()
                }
            }
        });

        res.json({ success: true, message: `Atendimento automático retomado para ${phone}` });
    } catch {
        res.status(500).json({ error: 'Erro ao retomar atendimento' });
    }
});

// GET /api/chatbot/conversations - Listar conversas ativas (admin)
chatbotRouter.get('/conversations', authenticate, requireAdmin, async (_req: Request, res: Response) => {
    try {
        // Busca telefones distintos com mensagens recentes (últimos 7 dias)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const recentMessages = await prisma.aiChatHistory.findMany({
            where: {
                createdAt: { gte: sevenDaysAgo }
            },
            orderBy: { createdAt: 'desc' },
            select: { phone: true, role: true, content: true, createdAt: true }
        });

        // Agrupa por telefone
        const conversationsMap = new Map<string, {
            phone: string;
            lastMessage: string;
            lastRole: string;
            lastAt: Date;
            messageCount: number;
            isPaused: boolean;
        }>();

        for (const msg of recentMessages) {
            if (!conversationsMap.has(msg.phone)) {
                conversationsMap.set(msg.phone, {
                    phone: msg.phone,
                    lastMessage: msg.content.substring(0, 100),
                    lastRole: msg.role,
                    lastAt: msg.createdAt,
                    messageCount: 0,
                    isPaused: false
                });
            }
            const conv = conversationsMap.get(msg.phone)!;
            conv.messageCount++;

            // Verifica se está pausada (última mensagem de sistema = PAUSED)
            if (msg.role === 'system' && msg.content === 'PAUSED' && !conv.isPaused) {
                conv.isPaused = true;
            }
            if (msg.role === 'system' && msg.content === 'RESUMED') {
                conv.isPaused = false;
            }
        }

        const conversations = Array.from(conversationsMap.values())
            .sort((a, b) => b.lastAt.getTime() - a.lastAt.getTime());

        res.json(conversations);
    } catch {
        res.status(500).json({ error: 'Erro ao buscar conversas' });
    }
});

// GET /api/chatbot/history-all - Bulk history list (all phones)
chatbotRouter.get('/history-all', authenticate, requireAdmin, async (req: Request, res: Response) => {
    try {
        const limit = parseInt(String(req.query.limit || '500'));
        const history = await prisma.aiChatHistory.findMany({
            orderBy: { createdAt: 'desc' },
            take: limit
        });

        // Map to frontend format
        res.json(history.map(h => ({
            id: h.id,
            phone: h.phone,
            customer_id: (h.metadata as any)?.customer_id || null,
            role: h.role,
            message: h.content,
            created_at: h.createdAt.toISOString()
        })));
    } catch {
        res.status(500).json({ error: 'Erro ao buscar histórico' });
    }
});

// DELETE /api/chatbot/history - Clear history (all or by phone)
chatbotRouter.delete('/history', authenticate, requireAdmin, async (req: Request, res: Response) => {
    try {
        const phone = String(req.query.phone || '');
        if (phone) {
            await prisma.aiChatHistory.deleteMany({ where: { phone } });
        } else {
            await prisma.aiChatHistory.deleteMany();
        }
        res.json({ success: true });
    } catch {
        res.status(500).json({ error: 'Erro ao limpar histórico' });
    }
});

