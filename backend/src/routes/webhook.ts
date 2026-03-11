import { Router, Request, Response } from 'express';
import { prisma } from '../services/prisma';
import axios from 'axios';
import { sendWhatsAppMessage } from '../services/whatsapp';
import { sendPushToRole } from './push';

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
 * Chama a API do Google Gemini
 */
async function callGeminiAPI(
    apiKey: string, systemPrompt: string,
    history: { role: string; content: string }[], userMessage: string
): Promise<string> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
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
    perplexity: { url: 'https://api.perplexity.ai', model: 'llama-3.1-sonar-small-128k-online' },
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
        model: 'claude-sonnet-4-5-20250929',
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

        // Ignora grupos
        const remoteJid = key.remoteJid || '';
        if (remoteJid.includes('@g.us')) return;

        // Extrai texto da mensagem
        const msg = messageData.message || messageData;
        const content = msg?.conversation
            || msg?.extendedTextMessage?.text
            || msg?.imageMessage?.caption
            || msg?.videoMessage?.caption;

        if (!content) return;

        // Normaliza telefone
        const phone = remoteJid.replace('@s.whatsapp.net', '');
        console.log(`[Webhook] 📩 Mensagem de ${phone}: ${content.substring(0, 80)}`);

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
        if (!chatConfig || !chatConfig.enabled || !chatConfig.apiKey) {
            console.log('[Webhook] Chatbot IA desabilitado ou sem API key');
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

        // 7. Busca histórico recente
        const recentHistory = await prisma.aiChatHistory.findMany({
            where: { phone, role: { in: ['user', 'assistant'] } },
            orderBy: { createdAt: 'desc' },
            take: 20
        });
        const conversationHistory = recentHistory.reverse().map(h => ({ role: h.role, content: h.content }));

        // 8. Monta system prompt com contexto ENRIQUECIDO
        let systemPrompt = chatConfig.systemPrompt || 'Você é um assistente virtual da Tubarão Empréstimos, uma empresa de crédito. Seja educado, profissional e objetivo.';

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
                systemPrompt += `\n\n⚠️ CONSULTA DE CPF: O cliente informou o CPF ${cpfFormatted} mas NÃO foi encontrado no sistema. Informe educadamente que o CPF não está cadastrado e oriente a pessoa a se cadastrar pelo site ou app.`;
            }
        }

        // 8.2 Injetar dados completos do cliente identificado
        if (lookupCustomer) {
            systemPrompt += `\n\n===== DADOS DO CLIENTE (CONFIDENCIAL — use para responder, mas nunca mostre dados sensíveis completos) =====`;
            systemPrompt += `\nNome: ${lookupCustomer.name}`;
            systemPrompt += `\nCPF: ${lookupCustomer.cpf}`;
            systemPrompt += `\nEmail: ${lookupCustomer.email}`;
            systemPrompt += `\nTelefone: ${lookupCustomer.phone || 'não informado'}`;
            systemPrompt += `\nStatus: ${lookupCustomer.status}`;

            // Buscar empréstimos ativos
            try {
                const loans = await prisma.loan.findMany({
                    where: { customerId: lookupCustomer.id },
                    include: {
                        installments: { orderBy: { dueDate: 'asc' } }
                    }
                });

                if (loans.length === 0) {
                    systemPrompt += `\nEmpréstimos: Nenhum empréstimo ativo encontrado.`;
                } else {
                    systemPrompt += `\n\n--- EMPRÉSTIMOS (${loans.length}) ---`;
                    for (const loan of loans) {
                        systemPrompt += `\n\nContrato #${loan.id.slice(-6)}:`;
                        systemPrompt += `\n  Valor emprestado: R$ ${loan.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
                        systemPrompt += `\n  Saldo devedor: R$ ${loan.remainingAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
                        systemPrompt += `\n  Total de parcelas: ${loan.installmentsCount}`;
                        systemPrompt += `\n  Status: ${loan.status || 'ATIVO'}`;

                        // Parcelas detalhadas
                        const paid = loan.installments.filter((i: any) => i.status === 'PAID').length;
                        const late = loan.installments.filter((i: any) => i.status === 'LATE');
                        const open = loan.installments.filter((i: any) => i.status === 'OPEN');

                        systemPrompt += `\n  Parcelas pagas: ${paid}/${loan.installmentsCount}`;

                        if (late.length > 0) {
                            systemPrompt += `\n  ⚠️ PARCELAS ATRASADAS (${late.length}):`;
                            for (const inst of late) {
                                const daysLate = Math.floor((Date.now() - new Date(inst.dueDate).getTime()) / 86400000);
                                systemPrompt += `\n    - Parcela R$ ${inst.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} venceu em ${new Date(inst.dueDate).toLocaleDateString('pt-BR')} (${daysLate} dias de atraso)`;
                            }
                        }

                        if (open.length > 0) {
                            const nextInst = open[0];
                            systemPrompt += `\n  Próxima parcela: R$ ${(nextInst as any).amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} vence em ${new Date((nextInst as any).dueDate).toLocaleDateString('pt-BR')}`;
                        }
                    }
                }

                // Buscar solicitações pendentes
                const pendingRequests = await prisma.loanRequest.findMany({
                    where: { customerId: lookupCustomer.id, status: { in: ['PENDING', 'IN_REVIEW'] } }
                });
                if (pendingRequests.length > 0) {
                    systemPrompt += `\n\n--- SOLICITAÇÕES PENDENTES (${pendingRequests.length}) ---`;
                    for (const req of pendingRequests) {
                        systemPrompt += `\n  Solicitação: R$ ${req.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} em ${req.installments}x — Status: ${req.status}`;
                    }
                }

            } catch (dbErr: any) {
                console.error('[Webhook] Erro ao buscar dados financeiros do cliente:', dbErr.message);
            }

            systemPrompt += `\n===== FIM DOS DADOS DO CLIENTE =====`;
            systemPrompt += `\n\nIMPORTANTE: Use esses dados para responder perguntas do cliente sobre seus empréstimos, parcelas, saldo devedor, datas de vencimento, etc. Nunca exponha o CPF completo ou dados sensíveis na resposta. Se o cliente perguntar "quanto devo?", informe o saldo devedor. Se perguntar sobre parcelas, detalhe as próximas e atrasadas.`;
        }

        // 9. Chama a IA (com provider correto e key correta)
        let aiResponse: string;
        const resolvedApiKey = getProviderApiKey(chatConfig);
        const provider = chatConfig.provider || 'gemini';
        console.log(`[Webhook] Chamando IA: provider=${provider}, keyLen=${resolvedApiKey?.length || 0}`);

        if (!resolvedApiKey) {
            console.error(`[Webhook] API key vazia para provider ${provider}`);
            await prisma.aiChatHistory.create({ data: { phone, role: 'user', content } });
            return;
        }

        try {
            if (provider === 'gemini') {
                aiResponse = await callGeminiAPI(resolvedApiKey, systemPrompt, conversationHistory, content);
            } else if (provider === 'anthropic') {
                aiResponse = await callAnthropicAPI(resolvedApiKey, systemPrompt, conversationHistory, content);
            } else if (PROVIDER_CONFIG[provider]) {
                const cfg = PROVIDER_CONFIG[provider];
                aiResponse = await callOpenAICompatibleAPI(resolvedApiKey, cfg.url, cfg.model, systemPrompt, conversationHistory, content);
            } else {
                // Fallback: tenta como Gemini
                aiResponse = await callGeminiAPI(resolvedApiKey, systemPrompt, conversationHistory, content);
            }
        } catch (aiError: any) {
            console.error(`[Webhook] Erro na IA (${provider}):`, aiError?.response?.data || aiError.message);
            await prisma.aiChatHistory.create({ data: { phone, role: 'user', content } });
            await prisma.aiChatHistory.create({ data: { phone, role: 'system', content: 'ERROR', metadata: { error: aiError.message, provider } } });
            return;
        }

        // 10. Salva histórico
        await prisma.aiChatHistory.create({ data: { phone, role: 'user', content } });
        await prisma.aiChatHistory.create({ data: { phone, role: 'assistant', content: aiResponse, metadata: { provider: chatConfig.provider, autoReply: true } } });

        // 11. Envia resposta pelo WhatsApp
        const sent = await sendWhatsAppReply(waConfig, phone, aiResponse);
        console.log(`[Webhook] ${sent ? '✅' : '❌'} Resposta IA enviada para ${phone} (${chatConfig.provider})`);

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
