-- ==============================================
-- TUBARÃO EMPRÉSTIMOS - Notificações em Tempo Real
-- Execute este script no Supabase SQL Editor
-- ==============================================

-- Tabela de notificações
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID,
    customer_email VARCHAR(255),
    type VARCHAR(20) DEFAULT 'info', -- success, warning, info, error
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    link TEXT,
    read BOOLEAN DEFAULT false,
    for_role VARCHAR(20) DEFAULT 'CLIENT', -- CLIENT, ADMIN, ALL
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_email ON notifications(customer_email);
CREATE INDEX IF NOT EXISTS idx_notifications_role ON notifications(for_role);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);

-- Desabilitar RLS para permitir acesso completo
ALTER TABLE notifications DISABLE ROW LEVEL SECURITY;

-- ==============================================
-- TABELA DE CONFIGURAÇÕES DE TEMA/CORES
-- ==============================================

CREATE TABLE IF NOT EXISTS theme_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    primary_color VARCHAR(9) DEFAULT '#D4AF37', -- Dourado
    secondary_color VARCHAR(9) DEFAULT '#1a1a1a', -- Preto
    accent_color VARCHAR(9) DEFAULT '#10b981', -- Verde
    danger_color VARCHAR(9) DEFAULT '#ef4444', -- Vermelho
    warning_color VARCHAR(9) DEFAULT '#f59e0b', -- Amarelo
    success_color VARCHAR(9) DEFAULT '#22c55e', -- Verde claro
    background_color VARCHAR(9) DEFAULT '#000000', -- Preto
    card_color VARCHAR(9) DEFAULT '#18181b', -- Zinc-900
    text_color VARCHAR(9) DEFAULT '#ffffff', -- Branco
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Desabilitar RLS para tema
ALTER TABLE theme_settings DISABLE ROW LEVEL SECURITY;

-- Inserir configuração padrão se não existir
INSERT INTO theme_settings (id, primary_color, secondary_color, accent_color)
VALUES ('00000000-0000-0000-0000-000000000001', '#D4AF37', '#1a1a1a', '#10b981')
ON CONFLICT (id) DO NOTHING;
