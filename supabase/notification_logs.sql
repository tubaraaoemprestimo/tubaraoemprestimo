-- ==============================================
-- TUBARÃO EMPRÉSTIMOS - Tabela de Logs de Notificações
-- Execute no Supabase SQL Editor
-- ==============================================

-- Remover tabela anterior se existir (para recriar com todas as colunas)
DROP TABLE IF EXISTS notification_logs;

-- Tabela para rastrear notificações enviadas (evitar duplicatas)
CREATE TABLE notification_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type VARCHAR(50) NOT NULL, -- CAMPAIGN, COUPON, COLLECTION, WELCOME, APPROVAL, etc
    reference_id UUID, -- ID da campanha, cupom, parcela, etc
    rule_id UUID, -- ID da regra de cobrança (se aplicável)
    customer_id UUID REFERENCES customers(id),
    recipients_count INTEGER DEFAULT 0,
    sent_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para busca eficiente
CREATE INDEX IF NOT EXISTS idx_notification_logs_type ON notification_logs(type);
CREATE INDEX IF NOT EXISTS idx_notification_logs_reference ON notification_logs(reference_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_created ON notification_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_notification_logs_customer ON notification_logs(customer_id);

-- Desabilitar RLS
ALTER TABLE notification_logs DISABLE ROW LEVEL SECURITY;

-- Comentários
COMMENT ON TABLE notification_logs IS 'Log de notificações enviadas via WhatsApp para evitar duplicatas';
COMMENT ON COLUMN notification_logs.type IS 'Tipo: CAMPAIGN, COUPON, COLLECTION, WELCOME, APPROVAL, PAYMENT';
COMMENT ON COLUMN notification_logs.reference_id IS 'ID do item relacionado (campanha, cupom, parcela)';

-- Verificar
SELECT 'notification_logs table created successfully!' as status;
