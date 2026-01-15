-- ==============================================
-- TUBARÃO EMPRÉSTIMOS - Temas e Cores em Tempo Real
-- Execute APENAS este script no Supabase SQL Editor
-- ==============================================

-- 1. TABELA DE CONFIGURAÇÕES DE TEMA/CORES
CREATE TABLE IF NOT EXISTS theme_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    primary_color VARCHAR(9) DEFAULT '#D4AF37',
    secondary_color VARCHAR(9) DEFAULT '#1a1a1a',
    accent_color VARCHAR(9) DEFAULT '#10b981',
    danger_color VARCHAR(9) DEFAULT '#ef4444',
    warning_color VARCHAR(9) DEFAULT '#f59e0b',
    success_color VARCHAR(9) DEFAULT '#22c55e',
    background_color VARCHAR(9) DEFAULT '#000000',
    card_color VARCHAR(9) DEFAULT '#18181b',
    text_color VARCHAR(9) DEFAULT '#ffffff',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Desabilitar RLS para tema
ALTER TABLE theme_settings DISABLE ROW LEVEL SECURITY;

-- Inserir configuração padrão
INSERT INTO theme_settings (id, primary_color, secondary_color, accent_color, danger_color, warning_color, success_color, background_color, card_color, text_color)
VALUES (
    '00000000-0000-0000-0000-000000000001', 
    '#D4AF37', '#1a1a1a', '#10b981', '#ef4444', '#f59e0b', '#22c55e', '#000000', '#18181b', '#ffffff'
)
ON CONFLICT (id) DO NOTHING;

-- 2. Garantir RLS desabilitado na tabela notifications
ALTER TABLE notifications DISABLE ROW LEVEL SECURITY;
