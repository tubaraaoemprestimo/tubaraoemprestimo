-- ============================================
-- CRIAR TABELA message_templates SE NÃO EXISTIR
-- ============================================

CREATE TABLE IF NOT EXISTS message_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    category VARCHAR(50) NOT NULL DEFAULT 'CUSTOM',
    content TEXT NOT NULL,
    variables TEXT[] DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    trigger_event VARCHAR(100), -- Evento que dispara automaticamente
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_templates_category ON message_templates(category);
CREATE INDEX IF NOT EXISTS idx_templates_trigger ON message_templates(trigger_event);
CREATE INDEX IF NOT EXISTS idx_templates_active ON message_templates(is_active);

-- ============================================
-- CRIAR TABELA notifications SE NÃO EXISTIR
-- ============================================

CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_email VARCHAR(255) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) DEFAULT 'INFO', -- INFO, WARNING, ALERT, SUCCESS
    link VARCHAR(500),
    read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_notifications_email ON notifications(customer_email);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);

-- ============================================
-- CRIAR TABELA collection_rules SE NÃO EXISTIR
-- ============================================

CREATE TABLE IF NOT EXISTS collection_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    days_offset INTEGER NOT NULL, -- Negativo = antes, Positivo = depois do vencimento
    type VARCHAR(50) DEFAULT 'COLLECTION', -- REMINDER, COLLECTION
    message_template TEXT NOT NULL,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índice
CREATE INDEX IF NOT EXISTS idx_rules_days ON collection_rules(days_offset);
CREATE INDEX IF NOT EXISTS idx_rules_active ON collection_rules(active);

-- ============================================
-- CRIAR TABELA notification_logs SE NÃO EXISTIR
-- ============================================

CREATE TABLE IF NOT EXISTS notification_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type VARCHAR(50) NOT NULL, -- CAMPAIGN, COUPON, COLLECTION, TEMPLATE
    reference_id UUID,
    rule_id UUID,
    customer_id UUID,
    recipients_count INTEGER DEFAULT 0,
    sent_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_logs_type ON notification_logs(type);
CREATE INDEX IF NOT EXISTS idx_logs_created ON notification_logs(created_at DESC);
