-- ==============================================
-- TUBARÃO EMPRÉSTIMOS - Configurações do Chatbot IA
-- Execute no Supabase SQL Editor
-- ==============================================

-- Tabela de configuração do Chatbot
CREATE TABLE IF NOT EXISTS ai_chatbot_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    enabled BOOLEAN DEFAULT false,
    provider VARCHAR(50) DEFAULT 'gemini', -- gemini, perplexity, openai
    gemini_api_key TEXT,
    perplexity_api_key TEXT,
    system_prompt TEXT DEFAULT 'Você é um assistente de atendimento da empresa TUBARÃO EMPRÉSTIMOS. 
Seja educado, profissional e ajude os clientes com dúvidas sobre empréstimos, parcelas e pagamentos.
Sempre que possível, incentive o cliente a manter os pagamentos em dia.
Se não souber responder algo, oriente o cliente a aguardar um atendente humano.',
    welcome_message TEXT DEFAULT 'Olá! 👋 Sou o assistente virtual da TUBARÃO EMPRÉSTIMOS. Como posso ajudar você hoje?',
    fallback_message TEXT DEFAULT 'Desculpe, não entendi sua pergunta. Um de nossos atendentes irá responder em breve.',
    transfer_keywords TEXT DEFAULT 'atendente,humano,pessoa,falar com alguém',
    auto_reply_enabled BOOLEAN DEFAULT true,
    working_hours_only BOOLEAN DEFAULT false,
    working_hours_start TIME DEFAULT '08:00',
    working_hours_end TIME DEFAULT '18:00',
    max_messages_per_chat INTEGER DEFAULT 50,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de histórico de conversas
CREATE TABLE IF NOT EXISTS ai_chat_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone VARCHAR(20) NOT NULL,
    customer_id UUID REFERENCES customers(id),
    role VARCHAR(20) NOT NULL, -- user, assistant
    message TEXT NOT NULL,
    tokens_used INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_chat_history_phone ON ai_chat_history(phone);
CREATE INDEX IF NOT EXISTS idx_chat_history_created ON ai_chat_history(created_at);

-- Desabilitar RLS para facilitar
ALTER TABLE ai_chatbot_config DISABLE ROW LEVEL SECURITY;
ALTER TABLE ai_chat_history DISABLE ROW LEVEL SECURITY;

-- Inserir configuração padrão
INSERT INTO ai_chatbot_config (id, enabled, provider)
SELECT 
    'b0000000-0000-0000-0000-000000000001'::uuid,
    false,
    'gemini'
WHERE NOT EXISTS (
    SELECT 1 FROM ai_chatbot_config LIMIT 1
);

-- Verificar
SELECT * FROM ai_chatbot_config;
