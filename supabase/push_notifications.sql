-- ============================================
-- PUSH NOTIFICATIONS - TABELAS
-- Execute no Supabase SQL Editor
-- ============================================

-- Tabela para armazenar tokens de push
CREATE TABLE IF NOT EXISTS push_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_email VARCHAR(255) NOT NULL,
    fcm_token TEXT NOT NULL,
    device_type VARCHAR(20) DEFAULT 'desktop', -- 'desktop', 'mobile', 'tablet'
    device_info JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    last_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_email, fcm_token)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_push_subs_email ON push_subscriptions(user_email);
CREATE INDEX IF NOT EXISTS idx_push_subs_active ON push_subscriptions(is_active);

-- RLS
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Políticas
DROP POLICY IF EXISTS "Users can manage own subscriptions" ON push_subscriptions;
CREATE POLICY "Users can manage own subscriptions" ON push_subscriptions
    FOR ALL USING (true);

-- Tabela para logs de notificações enviadas
CREATE TABLE IF NOT EXISTS notification_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type VARCHAR(20) NOT NULL, -- 'push', 'email', 'whatsapp'
    recipient TEXT NOT NULL,
    title VARCHAR(255),
    body TEXT,
    success BOOLEAN DEFAULT true,
    sent_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índice para consultas por data
CREATE INDEX IF NOT EXISTS idx_notif_logs_created ON notification_logs(created_at DESC);

-- RLS
ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;

-- Somente admins podem ver logs
DROP POLICY IF EXISTS "Admins can view logs" ON notification_logs;
CREATE POLICY "Admins can view logs" ON notification_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE auth_id = auth.uid() 
            AND role = 'ADMIN'
        )
    );

-- Sistema pode inserir logs
DROP POLICY IF EXISTS "System can insert logs" ON notification_logs;
CREATE POLICY "System can insert logs" ON notification_logs
    FOR INSERT WITH CHECK (true);

-- ============================================
-- VERIFICAR INSTALAÇÃO
-- ============================================
SELECT 'push_subscriptions' as table_name, COUNT(*) as count FROM push_subscriptions
UNION ALL
SELECT 'notification_logs' as table_name, COUNT(*) as count FROM notification_logs;
