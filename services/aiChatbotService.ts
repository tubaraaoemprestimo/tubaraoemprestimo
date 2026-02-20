// Serviço de IA para Chatbot do Tubarão Empréstimos
import { api } from './apiClient';

interface AIChatbotConfig {
    id: string;
    enabled: boolean;
    provider: 'gemini' | 'perplexity' | 'openai' | 'openrouter' | 'nvidia' | 'zai' | 'anthropic' | 'groq' | 'grok';
    apiKey: string | null;
    geminiApiKey: string | null;
    perplexityApiKey: string | null;
    openaiApiKey: string | null;
    openrouterApiKey: string | null;
    nvidiaApiKey: string | null;
    zaiApiKey: string | null;
    anthropicApiKey: string | null;
    groqApiKey: string | null;
    grokApiKey: string | null;
    systemPrompt: string;
    welcomeMessage: string;
    fallbackMessage: string;
    transferKeywords: string;
    autoReplyEnabled: boolean;
    workingHoursOnly: boolean;
    workingHoursStart: string;
    workingHoursEnd: string;
    maxMessagesPerChat: number;
}

interface ChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

const DEFAULT_CONFIG: AIChatbotConfig = {
    id: '',
    enabled: false,
    provider: 'gemini',
    apiKey: null,
    geminiApiKey: null,
    perplexityApiKey: null,
    openaiApiKey: null,
    openrouterApiKey: null,
    nvidiaApiKey: null,
    zaiApiKey: null,
    anthropicApiKey: null,
    groqApiKey: null,
    grokApiKey: null,
    systemPrompt: `Você é o Assistente Virtual inteligente do Tubarão Empréstimos. Sua missão é ajudar clientes com informações sobre empréstimos, pagamentos e dúvidas gerais.

⚠️ IMPORTANTE:
1. SE VOCÊ NÃO TIVER CERTEZA da resposta ou se o cliente pedir algo complexo que você não sabe: Responda APENAS com o código: [TRANSFERIR]
2. Não tente inventar ou enrolar. Se não souber, use [TRANSFERIR].
3. Seja conciso. Evite textos longos. Responda a pergunta e aguarde o cliente.
4. Não mande múltiplas mensagens seguidas.

Todos os tipos de notificações enviadas no Whatsaap envie o Link do APP: https://tubaraoemprestimo.com.br

📌 IDENTIDADE: Assistente Virtual do Tubarão Empréstimos.
- Tom: Profissional, objetivo e educado.
- Se o cliente só cumprimentar, retribua e aguarde.
- Se não entender, use: [TRANSFERIR].

🏢 EMPRESA:
- Empréstimo 100% digital, juros mensais a partir de 30%.
- Sem parcelamento (apenas juros sobre saldo).
- Horário: Seg-Sex, 8h-18h.

💰 PRODUTOS: Empréstimo (R$ 500-50k), Renegociação, Indique e Ganhe (R$ 50).

🚫 NUNCA: Invente dados, prometa aprovação ou peça senhas.

📞 COMANDO DE TRANSFERÊNCIA:
- Se precisar de humano, renegociação complexa ou não entender: Responda APENAS: [TRANSFERIR]

⚙️ REGRAS:
- Respostas curtas.
- Aguarde o cliente.
- Link final: https://tubaraoemprestimo.com.br`,
    welcomeMessage: 'Olá! 👋 Sou o assistente virtual da TUBARÃO EMPRESTIMOS. Como posso ajudar você hoje?',
    fallbackMessage: 'Desculpe, não entendi sua pergunta. Um de nossos atendentes irá responder em breve.',
    transferKeywords: 'atendente,humano,pessoa,falar com alguém',
    autoReplyEnabled: true,
    workingHoursOnly: false,
    workingHoursStart: '08:00',
    workingHoursEnd: '18:00',
    maxMessagesPerChat: 50
};

export const aiChatbotService = {
    // Buscar configurações do chatbot
    getConfig: async (): Promise<AIChatbotConfig> => {
        try {
            const { data, error } = await api.get<any>('/chatbot/config');

            if (error || !data) {
                console.log('[AI Chatbot] Using default config');
                return DEFAULT_CONFIG;
            }

            const d = data as any;
            return {
                id: d.id,
                enabled: d.enabled,
                provider: d.provider,
                apiKey: d.api_key || d.apiKey,
                geminiApiKey: d.gemini_api_key || d.geminiApiKey,
                perplexityApiKey: d.perplexity_api_key || d.perplexityApiKey,
                openaiApiKey: d.openai_api_key || d.openaiApiKey,
                openrouterApiKey: d.openrouter_api_key || d.openrouterApiKey,
                nvidiaApiKey: d.nvidia_api_key || d.nvidiaApiKey,
                zaiApiKey: d.zai_api_key || d.zaiApiKey,
                anthropicApiKey: d.anthropic_api_key || d.anthropicApiKey,
                groqApiKey: d.groq_api_key || d.groqApiKey,
                grokApiKey: d.grok_api_key || d.grokApiKey,
                systemPrompt: d.system_prompt || d.systemPrompt || DEFAULT_CONFIG.systemPrompt,
                welcomeMessage: d.welcome_message || d.welcomeMessage || DEFAULT_CONFIG.welcomeMessage,
                fallbackMessage: d.fallback_message || d.fallbackMessage || DEFAULT_CONFIG.fallbackMessage,
                transferKeywords: d.transfer_keywords || d.transferKeywords || DEFAULT_CONFIG.transferKeywords,
                autoReplyEnabled: d.auto_reply_enabled ?? d.autoReplyEnabled ?? true,
                workingHoursOnly: d.working_hours_only ?? d.workingHoursOnly ?? false,
                workingHoursStart: d.working_hours_start || d.workingHoursStart || '08:00',
                workingHoursEnd: d.working_hours_end || d.workingHoursEnd || '18:00',
                maxMessagesPerChat: d.max_messages_per_chat || d.maxMessagesPerChat || 50
            };
        } catch (err) {
            console.error('[AI Chatbot] Error fetching config:', err);
            return DEFAULT_CONFIG;
        }
    },

    // Salvar configurações
    saveConfig: async (config: Partial<AIChatbotConfig>): Promise<boolean> => {
        try {
            const { error } = await api.put('/chatbot/config', {
                enabled: config.enabled,
                provider: config.provider,
                apiKey: config.apiKey || config.geminiApiKey,
                geminiApiKey: config.geminiApiKey,
                perplexityApiKey: config.perplexityApiKey,
                openaiApiKey: config.openaiApiKey,
                openrouterApiKey: config.openrouterApiKey,
                nvidiaApiKey: config.nvidiaApiKey,
                zaiApiKey: config.zaiApiKey,
                anthropicApiKey: config.anthropicApiKey,
                groqApiKey: config.groqApiKey,
                grokApiKey: config.grokApiKey,
                systemPrompt: config.systemPrompt,
                welcomeMessage: config.welcomeMessage,
                fallbackMessage: config.fallbackMessage,
                transferKeywords: config.transferKeywords
                    ? (typeof config.transferKeywords === 'string'
                        ? config.transferKeywords.split(',').map(s => s.trim())
                        : config.transferKeywords)
                    : undefined,
                autoReplyEnabled: config.autoReplyEnabled,
                workingHoursOnly: config.workingHoursOnly,
                workingHoursStart: config.workingHoursStart,
                workingHoursEnd: config.workingHoursEnd,
                maxMessagesPerChat: config.maxMessagesPerChat,
            });

            if (error) {
                console.error('[AI Chatbot] Error saving config:', error);
                return false;
            }
            return true;
        } catch (err) {
            console.error('[AI Chatbot] Exception saving config:', err);
            return false;
        }
    },

    // Buscar histórico de conversa
    getChatHistory: async (phone: string, limit: number = 10): Promise<ChatMessage[]> => {
        try {
            const { data, error } = await api.get<any[]>(`/chatbot/history/${encodeURIComponent(phone)}?limit=${limit}`);

            if (error || !data) return [];

            return (data as any[]).reverse().map(m => ({
                role: m.role as 'user' | 'assistant',
                content: m.message
            }));
        } catch (err) {
            console.error('[AI Chatbot] Error fetching history:', err);
            return [];
        }
    },

    // Salvar mensagem no histórico
    saveChatMessage: async (phone: string, role: 'user' | 'assistant', message: string, customerId?: string): Promise<void> => {
        try {
            await api.post('/chatbot/history', {
                phone,
                customer_id: customerId || null,
                role,
                message
            });
        } catch (err) {
            console.error('[AI Chatbot] Error saving message:', err);
        }
    },

    // Buscar dados do cliente pelo telefone
    getCustomerByPhone: async (phone: string) => {
        try {
            const cleanPhone = phone.replace(/\D/g, '').replace(/^55/, '');

            const { data } = await api.get<any>(`/customers?phone=${encodeURIComponent(cleanPhone)}`);

            // If data is an array, take the first element
            if (Array.isArray(data)) {
                return (data as any[])[0] || null;
            }
            return data;
        } catch {
            return null;
        }
    },

    // Gerar resposta com Gemini
    generateResponseGemini: async (
        messages: ChatMessage[],
        systemPrompt: string,
        apiKey: string,
        customerContext?: string
    ): Promise<string> => {
        try {
            const fullPrompt = customerContext
                ? `${systemPrompt}\n\nContexto do cliente:\n${customerContext}`
                : systemPrompt;

            const contents = [
                { role: 'user', parts: [{ text: fullPrompt }] },
                ...messages.map(m => ({
                    role: m.role === 'assistant' ? 'model' : 'user',
                    parts: [{ text: m.content }]
                }))
            ];

            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents,
                        generationConfig: {
                            temperature: 0.7,
                            maxOutputTokens: 500
                        }
                    })
                }
            );

            if (!response.ok) {
                console.error('[AI Chatbot] Gemini API error:', await response.text());
                return '';
            }

            const data = await response.json();
            return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        } catch (err) {
            console.error('[AI Chatbot] Gemini exception:', err);
            return '';
        }
    },

    // Gerar resposta com OpenAI
    generateResponseOpenAI: async (
        messages: ChatMessage[],
        systemPrompt: string,
        apiKey: string,
        customerContext?: string
    ): Promise<string> => {
        try {
            const formattedMessages: any[] = [
                { role: 'system', content: customerContext ? `${systemPrompt}\n\nContexto do cliente:\n${customerContext}` : systemPrompt },
                ...messages.slice(-10).map(m => ({
                    role: m.role === 'assistant' ? 'assistant' : 'user',
                    content: m.content
                }))
            ];

            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'gpt-4o-mini',
                    messages: formattedMessages,
                    temperature: 0.7,
                    max_tokens: 500
                })
            });

            if (!response.ok) {
                console.error('[AI Chatbot] OpenAI API error:', await response.text());
                return '';
            }

            const data = await response.json();
            return data.choices?.[0]?.message?.content || '';
        } catch (err) {
            console.error('[AI Chatbot] OpenAI exception:', err);
            return '';
        }
    },

    // Gerar resposta com OpenRouter
    generateResponseOpenRouter: async (
        messages: ChatMessage[],
        systemPrompt: string,
        apiKey: string,
        customerContext?: string
    ): Promise<string> => {
        try {
            const formattedMessages: any[] = [];

            if (systemPrompt) {
                formattedMessages.push({ role: 'system', content: customerContext ? `${systemPrompt}\n\nContexto do cliente:\n${customerContext}` : systemPrompt });
            }

            formattedMessages.push(...messages.slice(-10).map(m => ({
                role: m.role === 'assistant' ? 'assistant' : 'user',
                content: m.content
            })));

            const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'google/gemini-2.0-flash-exp:free',
                    messages: formattedMessages,
                    temperature: 0.7,
                    max_tokens: 500
                })
            });

            if (!response.ok) {
                console.error('[AI Chatbot] OpenRouter API error:', await response.text());
                return '';
            }

            const data = await response.json();
            return data.choices?.[0]?.message?.content || '';
        } catch (err) {
            console.error('[AI Chatbot] OpenRouter exception:', err);
            return '';
        }
    },

    // Gerar resposta com Nvidia
    generateResponseNvidia: async (
        messages: ChatMessage[],
        systemPrompt: string,
        apiKey: string,
        customerContext?: string
    ): Promise<string> => {
        try {
            const formattedMessages: any[] = [];

            if (systemPrompt) {
                formattedMessages.push({ role: 'system', content: customerContext ? `${systemPrompt}\n\nContexto do cliente:\n${customerContext}` : systemPrompt });
            }

            formattedMessages.push(...messages.slice(-10).map(m => ({
                role: m.role === 'assistant' ? 'assistant' : 'user',
                content: m.content
            })));

            const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'nvidia/llama-3.1-nemotron-70b-instruct',
                    messages: formattedMessages,
                    temperature: 0.7,
                    max_tokens: 500
                })
            });

            if (!response.ok) {
                console.error('[AI Chatbot] Nvidia API error:', await response.text());
                return '';
            }

            const data = await response.json();
            return data.choices?.[0]?.message?.content || '';
        } catch (err) {
            console.error('[AI Chatbot] Nvidia exception:', err);
            return '';
        }
    },

    // Gerar resposta com Z.AI (Groq API)
    generateResponseZai: async (
        messages: ChatMessage[],
        systemPrompt: string,
        apiKey: string,
        customerContext?: string
    ): Promise<string> => {
        try {
            const formattedMessages: any[] = [];

            if (systemPrompt) {
                formattedMessages.push({ role: 'system', content: customerContext ? `${systemPrompt}\n\nContexto do cliente:\n${customerContext}` : systemPrompt });
            }

            formattedMessages.push(...messages.slice(-10).map(m => ({
                role: m.role === 'assistant' ? 'assistant' : 'user',
                content: m.content
            })));

            const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'llama-3.1-70b-versatile',
                    messages: formattedMessages,
                    temperature: 0.7,
                    max_tokens: 500
                })
            });

            if (!response.ok) {
                console.error('[AI Chatbot] Z.AI API error:', await response.text());
                return '';
            }

            const data = await response.json();
            return data.choices?.[0]?.message?.content || '';
        } catch (err) {
            console.error('[AI Chatbot] Z.AI exception:', err);
            return '';
        }
    },

    // Gerar resposta com Anthropic (Claude)
    generateResponseAnthropic: async (
        messages: ChatMessage[],
        systemPrompt: string,
        apiKey: string,
        customerContext?: string
    ): Promise<string> => {
        try {
            const formattedMessages = messages.slice(-10).map(m => ({
                role: m.role === 'assistant' ? 'assistant' : 'user',
                content: m.content
            }));

            const response = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'x-api-key': apiKey,
                    'Content-Type': 'application/json',
                    'anthropic-version': '2023-06-01'
                },
                body: JSON.stringify({
                    model: 'claude-3-5-sonnet-20241022',
                    max_tokens: 500,
                    temperature: 0.7,
                    system: customerContext ? `${systemPrompt}\n\nContexto do cliente:\n${customerContext}` : systemPrompt,
                    messages: formattedMessages
                })
            });

            if (!response.ok) {
                console.error('[AI Chatbot] Anthropic API error:', await response.text());
                return '';
            }

            const data = await response.json();
            return data.content?.[0]?.text || '';
        } catch (err) {
            console.error('[AI Chatbot] Anthropic exception:', err);
            return '';
        }
    },

    // Gerar resposta com Groq
    generateResponseGroq: async (
        messages: ChatMessage[],
        systemPrompt: string,
        apiKey: string,
        customerContext?: string
    ): Promise<string> => {
        try {
            const formattedMessages: any[] = [];

            if (systemPrompt) {
                formattedMessages.push({ role: 'system', content: customerContext ? `${systemPrompt}\n\nContexto do cliente:\n${customerContext}` : systemPrompt });
            }

            formattedMessages.push(...messages.slice(-10).map(m => ({
                role: m.role === 'assistant' ? 'assistant' : 'user',
                content: m.content
            })));

            const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'llama-3.3-70b-versatile',
                    messages: formattedMessages,
                    temperature: 0.7,
                    max_tokens: 500
                })
            });

            if (!response.ok) {
                console.error('[AI Chatbot] Groq API error:', await response.text());
                return '';
            }

            const data = await response.json();
            return data.choices?.[0]?.message?.content || '';
        } catch (err) {
            console.error('[AI Chatbot] Groq exception:', err);
            return '';
        }
    },

    // Gerar resposta com Grok (xAI)
    generateResponseGrok: async (
        messages: ChatMessage[],
        systemPrompt: string,
        apiKey: string,
        customerContext?: string
    ): Promise<string> => {
        try {
            const formattedMessages: any[] = [];

            if (systemPrompt) {
                formattedMessages.push({ role: 'system', content: customerContext ? `${systemPrompt}\n\nContexto do cliente:\n${customerContext}` : systemPrompt });
            }

            formattedMessages.push(...messages.slice(-10).map(m => ({
                role: m.role === 'assistant' ? 'assistant' : 'user',
                content: m.content
            })));

            const response = await fetch('https://api.x.ai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'grok-beta',
                    messages: formattedMessages,
                    temperature: 0.7,
                    max_tokens: 500
                })
            });

            if (!response.ok) {
                console.error('[AI Chatbot] Grok API error:', await response.text());
                return '';
            }

            const data = await response.json();
            return data.choices?.[0]?.message?.content || '';
        } catch (err) {
            console.error('[AI Chatbot] Grok exception:', err);
            return '';
        }
    },

    // Gerar resposta com Perplexity
    generateResponsePerplexity: async (
        messages: ChatMessage[],
        systemPrompt: string,
        apiKey: string,
        customerContext?: string
    ): Promise<string> => {
        try {
            const fullPrompt = customerContext
                ? `${systemPrompt}\n\nContexto do cliente:\n${customerContext}`
                : systemPrompt;

            const formattedMessages = [
                { role: 'system', content: fullPrompt },
                ...messages.map(m => ({
                    role: m.role,
                    content: m.content
                }))
            ];

            let url = 'https://api.perplexity.ai/chat/completions';
            let model = 'llama-3.1-sonar-large-128k-online';

            if (apiKey.trim().startsWith('gsk_')) {
                url = 'https://api.groq.com/openai/v1/chat/completions';
                model = 'llama-3.1-8b-instant';
            } else if (apiKey.trim().startsWith('sk-')) {
                url = 'https://api.openai.com/v1/chat/completions';
                model = 'gpt-3.5-turbo';
            }

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey.trim()}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: model,
                    messages: formattedMessages,
                    max_tokens: 500,
                    temperature: 0.7
                })
            });

            if (!response.ok) {
                console.error('[AI Chatbot] API error:', await response.text());
                return '';
            }

            const data = await response.json();
            return data.choices?.[0]?.message?.content || '';
        } catch (err) {
            console.error('[AI Chatbot] Exception:', err);
            return '';
        }
    },

    // Processar mensagem recebida e gerar resposta
    processMessage: async (phone: string, message: string): Promise<string | null> => {
        const config = await aiChatbotService.getConfig();

        // Verificar se está habilitado
        if (!config.enabled || !config.autoReplyEnabled) {
            console.log('[AI Chatbot] Disabled, skipping');
            return null;
        }

        // Verificar horário de trabalho
        if (config.workingHoursOnly) {
            const now = new Date();
            const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
            if (currentTime < config.workingHoursStart || currentTime > config.workingHoursEnd) {
                console.log('[AI Chatbot] Outside working hours');
                return null;
            }
        }

        // Verificar palavras de transferência
        const transferWords = config.transferKeywords.split(',').map(w => w.trim().toLowerCase());
        if (transferWords.some(word => message.toLowerCase().includes(word))) {
            console.log('[AI Chatbot] Transfer keyword detected');
            return 'Entendido! Vou transferir você para um de nossos atendentes. Aguarde um momento. 🙏';
        }

        // Buscar dados do cliente
        const customer = await aiChatbotService.getCustomerByPhone(phone);
        let customerContext = '';

        if (customer) {
            customerContext = `Nome: ${customer.name}
CPF: ${customer.cpf}
Telefone: ${customer.phone}
Status: ${customer.status}
Dívida Total: R$ ${customer.total_debt?.toLocaleString('pt-BR') || '0'}
Empréstimos Ativos: ${customer.active_loans_count || 0}`;
        }

        // Salvar mensagem do usuário
        await aiChatbotService.saveChatMessage(phone, 'user', message, customer?.id);

        // Buscar histórico
        const history = await aiChatbotService.getChatHistory(phone, 10);

        // Gerar resposta
        let response = '';

        let apiKey: string | null = null;
        switch (config.provider) {
            case 'gemini':
                apiKey = config.geminiApiKey || config.apiKey;
                if (apiKey) {
                    response = await aiChatbotService.generateResponseGemini(history, config.systemPrompt, apiKey, customerContext);
                }
                break;
            case 'perplexity':
                apiKey = config.perplexityApiKey || config.apiKey;
                if (apiKey) {
                    response = await aiChatbotService.generateResponsePerplexity(history, config.systemPrompt, apiKey, customerContext);
                }
                break;
            case 'openai':
                apiKey = config.openaiApiKey || config.apiKey;
                if (apiKey) {
                    response = await aiChatbotService.generateResponseOpenAI(history, config.systemPrompt, apiKey, customerContext);
                }
                break;
            case 'openrouter':
                apiKey = config.openrouterApiKey || config.apiKey;
                if (apiKey) {
                    response = await aiChatbotService.generateResponseOpenRouter(history, config.systemPrompt, apiKey, customerContext);
                }
                break;
            case 'nvidia':
                apiKey = config.nvidiaApiKey || config.apiKey;
                if (apiKey) {
                    response = await aiChatbotService.generateResponseNvidia(history, config.systemPrompt, apiKey, customerContext);
                }
                break;
            case 'zai':
                apiKey = config.zaiApiKey || config.apiKey;
                if (apiKey) {
                    response = await aiChatbotService.generateResponseZai(history, config.systemPrompt, apiKey, customerContext);
                }
                break;
            case 'anthropic':
                apiKey = config.anthropicApiKey || config.apiKey;
                if (apiKey) {
                    response = await aiChatbotService.generateResponseAnthropic(history, config.systemPrompt, apiKey, customerContext);
                }
                break;
            case 'groq':
                apiKey = config.groqApiKey || config.apiKey;
                if (apiKey) {
                    response = await aiChatbotService.generateResponseGroq(history, config.systemPrompt, apiKey, customerContext);
                }
                break;
            case 'grok':
                apiKey = config.grokApiKey || config.apiKey;
                if (apiKey) {
                    response = await aiChatbotService.generateResponseGrok(history, config.systemPrompt, apiKey, customerContext);
                }
                break;
        }

        if (!apiKey) {
            console.error('[AI Chatbot] No API key configured for provider:', config.provider);
            return config.fallbackMessage;
        }

        if (!response) {
            return config.fallbackMessage;
        }

        // Salvar resposta
        await aiChatbotService.saveChatMessage(phone, 'assistant', response, customer?.id);

        return response;
    },
    // Gerar resposta (Wrapper para uso geral/teste)
    generateResponse: async (message: string, history: ChatMessage[] = [], localConfig?: AIChatbotConfig | null): Promise<string> => {
        const config = localConfig || await aiChatbotService.getConfig();

        // Helper: retorna chave válida (ignora mascarada)
        const validKey = (key: string | null | undefined): string | null => {
            if (!key || key.startsWith('****') || key.trim() === '') return null;
            return key;
        };

        let apiKey: string | null = null;
        switch (config.provider) {
            case 'gemini':
                apiKey = validKey(config.geminiApiKey) || validKey(config.apiKey);
                if (apiKey) return aiChatbotService.generateResponseGemini(history, config.systemPrompt, apiKey);
                break;
            case 'perplexity':
                apiKey = validKey(config.perplexityApiKey) || validKey(config.apiKey);
                if (apiKey) return aiChatbotService.generateResponsePerplexity(history, config.systemPrompt, apiKey);
                break;
            case 'openai':
                apiKey = validKey(config.openaiApiKey) || validKey(config.apiKey);
                if (apiKey) return aiChatbotService.generateResponseOpenAI(history, config.systemPrompt, apiKey);
                break;
            case 'openrouter':
                apiKey = validKey(config.openrouterApiKey) || validKey(config.apiKey);
                if (apiKey) return aiChatbotService.generateResponseOpenRouter(history, config.systemPrompt, apiKey);
                break;
            case 'nvidia':
                apiKey = validKey(config.nvidiaApiKey) || validKey(config.apiKey);
                if (apiKey) return aiChatbotService.generateResponseNvidia(history, config.systemPrompt, apiKey);
                break;
            case 'zai':
                apiKey = validKey(config.zaiApiKey) || validKey(config.apiKey);
                if (apiKey) return aiChatbotService.generateResponseZai(history, config.systemPrompt, apiKey);
                break;
            case 'anthropic':
                apiKey = validKey(config.anthropicApiKey) || validKey(config.apiKey);
                if (apiKey) return aiChatbotService.generateResponseAnthropic(history, config.systemPrompt, apiKey);
                break;
            case 'groq':
                apiKey = validKey(config.groqApiKey) || validKey(config.apiKey);
                if (apiKey) return aiChatbotService.generateResponseGroq(history, config.systemPrompt, apiKey);
                break;
            case 'grok':
                apiKey = validKey(config.grokApiKey) || validKey(config.apiKey);
                if (apiKey) return aiChatbotService.generateResponseGrok(history, config.systemPrompt, apiKey);
                break;
        }

        return "Erro: API Key não configurada.";
    }
};
