// Serviço de IA para Chatbot do Tubarão Empréstimos
import { supabase } from './supabaseClient';

interface AIChatbotConfig {
    id: string;
    enabled: boolean;
    provider: 'gemini' | 'perplexity' | 'openai';
    geminiApiKey: string | null;
    perplexityApiKey: string | null;
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
    geminiApiKey: null,
    perplexityApiKey: null,
    systemPrompt: `Você é um assistente de atendimento da empresa TUBARÃO EMPRÉSTIMOS.
Seja educado, profissional e ajude os clientes com dúvidas sobre empréstimos, parcelas e pagamentos.
Sempre que possível, incentive o cliente a manter os pagamentos em dia.
Se não souber responder algo, oriente o cliente a aguardar um atendente humano.`,
    welcomeMessage: 'Olá! 👋 Sou o assistente virtual da TUBARÃO EMPRÉSTIMOS. Como posso ajudar você hoje?',
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
            const { data, error } = await supabase
                .from('ai_chatbot_config')
                .select('*')
                .limit(1)
                .single();

            if (error || !data) {
                console.log('[AI Chatbot] Using default config');
                return DEFAULT_CONFIG;
            }

            return {
                id: data.id,
                enabled: data.enabled,
                provider: data.provider,
                geminiApiKey: data.gemini_api_key,
                perplexityApiKey: data.perplexity_api_key,
                systemPrompt: data.system_prompt || DEFAULT_CONFIG.systemPrompt,
                welcomeMessage: data.welcome_message || DEFAULT_CONFIG.welcomeMessage,
                fallbackMessage: data.fallback_message || DEFAULT_CONFIG.fallbackMessage,
                transferKeywords: data.transfer_keywords || DEFAULT_CONFIG.transferKeywords,
                autoReplyEnabled: data.auto_reply_enabled ?? true,
                workingHoursOnly: data.working_hours_only ?? false,
                workingHoursStart: data.working_hours_start || '08:00',
                workingHoursEnd: data.working_hours_end || '18:00',
                maxMessagesPerChat: data.max_messages_per_chat || 50
            };
        } catch (err) {
            console.error('[AI Chatbot] Error fetching config:', err);
            return DEFAULT_CONFIG;
        }
    },

    // Salvar configurações
    saveConfig: async (config: Partial<AIChatbotConfig>): Promise<boolean> => {
        try {
            const { error } = await supabase
                .from('ai_chatbot_config')
                .upsert({
                    id: config.id || 'b0000000-0000-0000-0000-000000000001',
                    enabled: config.enabled,
                    provider: config.provider,
                    gemini_api_key: config.geminiApiKey,
                    perplexity_api_key: config.perplexityApiKey,
                    system_prompt: config.systemPrompt,
                    welcome_message: config.welcomeMessage,
                    fallback_message: config.fallbackMessage,
                    transfer_keywords: config.transferKeywords,
                    auto_reply_enabled: config.autoReplyEnabled,
                    working_hours_only: config.workingHoursOnly,
                    working_hours_start: config.workingHoursStart,
                    working_hours_end: config.workingHoursEnd,
                    max_messages_per_chat: config.maxMessagesPerChat,
                    updated_at: new Date().toISOString()
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
            const { data, error } = await supabase
                .from('ai_chat_history')
                .select('role, message')
                .eq('phone', phone)
                .order('created_at', { ascending: false })
                .limit(limit);

            if (error || !data) return [];

            return data.reverse().map(m => ({
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
            await supabase.from('ai_chat_history').insert({
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

            const { data } = await supabase
                .from('customers')
                .select('*')
                .or(`phone.ilike.%${cleanPhone}%,phone.ilike.%${phone}%`)
                .limit(1)
                .single();

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

            const response = await fetch('https://api.perplexity.ai/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'llama-3.1-sonar-small-128k-online',
                    messages: formattedMessages,
                    max_tokens: 500,
                    temperature: 0.7
                })
            });

            if (!response.ok) {
                console.error('[AI Chatbot] Perplexity API error:', await response.text());
                return '';
            }

            const data = await response.json();
            return data.choices?.[0]?.message?.content || '';
        } catch (err) {
            console.error('[AI Chatbot] Perplexity exception:', err);
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
        const apiKey = config.provider === 'gemini' ? config.geminiApiKey : config.perplexityApiKey;

        if (!apiKey) {
            console.error('[AI Chatbot] No API key configured');
            return config.fallbackMessage;
        }

        if (config.provider === 'gemini') {
            response = await aiChatbotService.generateResponseGemini(
                history,
                config.systemPrompt,
                apiKey,
                customerContext
            );
        } else if (config.provider === 'perplexity') {
            response = await aiChatbotService.generateResponsePerplexity(
                history,
                config.systemPrompt,
                apiKey,
                customerContext
            );
        }

        if (!response) {
            return config.fallbackMessage;
        }

        // Salvar resposta
        await aiChatbotService.saveChatMessage(phone, 'assistant', response, customer?.id);

        return response;
    }
};