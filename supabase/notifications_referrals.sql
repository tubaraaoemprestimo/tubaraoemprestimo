-- ==============================================================
-- Script para Notificações, Score Real e Sistema "Indique e Ganhe"
-- Execute no Supabase SQL Editor
-- ==============================================================

-- 1. TABELA DE NOTIFICAÇÕES
-- Notificações reais do sistema para cada cliente
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) DEFAULT 'INFO', -- INFO, WARNING, ALERT, SUCCESS
    read BOOLEAN DEFAULT FALSE,
    link VARCHAR(255), -- Link para ação (ex: /client/contracts)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_notifications_customer ON notifications(customer_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(customer_id, read);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);

-- RLS para notificações
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers can view own notifications" ON notifications
    FOR SELECT USING (
        customer_id IN (
            SELECT id FROM customers WHERE email = auth.jwt() ->> 'email'
        )
    );

CREATE POLICY "Admin can manage all notifications" ON notifications
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE auth_id = auth.uid() AND role = 'ADMIN'
        )
    );

-- 2. TABELA DE HISTÓRICO DE SCORE
-- Histórico de alterações de score do cliente
CREATE TABLE IF NOT EXISTS score_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    score_before INTEGER NOT NULL,
    score_after INTEGER NOT NULL,
    reason VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_score_history_customer ON score_history(customer_id);

-- 3. TABELA DE INDICAÇÕES (Indique e Ganhe)
-- Sistema de códigos de indicação com validação do admin
CREATE TABLE IF NOT EXISTS referrals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Quem indicou
    referrer_customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    referrer_code VARCHAR(10) NOT NULL UNIQUE, -- Código único de 6 caracteres
    
    -- Quem foi indicado
    referred_customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    referred_name VARCHAR(255),
    referred_cpf VARCHAR(14),
    referred_phone VARCHAR(20),
    
    -- Status da indicação
    status VARCHAR(50) DEFAULT 'PENDING', -- PENDING, APPROVED, REJECTED, BONUS_PAID
    rejection_reason TEXT,
    
    -- Bônus
    bonus_amount DECIMAL(10,2) DEFAULT 0,
    bonus_paid_at TIMESTAMP WITH TIME ZONE,
    
    -- Datas
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    approved_at TIMESTAMP WITH TIME ZONE,
    approved_by UUID REFERENCES users(id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_customer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_code ON referrals(referrer_code);
CREATE INDEX IF NOT EXISTS idx_referrals_status ON referrals(status);

-- RLS para indicações
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers can view own referrals" ON referrals
    FOR SELECT USING (
        referrer_customer_id IN (
            SELECT id FROM customers WHERE email = auth.jwt() ->> 'email'
        )
    );

CREATE POLICY "Admin can manage all referrals" ON referrals
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE auth_id = auth.uid() AND role = 'ADMIN'
        )
    );

-- 4. ADICIONAR COLUNA DE CÓDIGO DE INDICAÇÃO NO CUSTOMER
-- Cada cliente tem seu código único para indicar outros
ALTER TABLE customers ADD COLUMN IF NOT EXISTS referral_code VARCHAR(10) UNIQUE;

-- 5. FUNÇÃO PARA GERAR CÓDIGO DE INDICAÇÃO
CREATE OR REPLACE FUNCTION generate_referral_code()
RETURNS VARCHAR(10) AS $$
DECLARE
    new_code VARCHAR(10);
    code_exists BOOLEAN;
BEGIN
    LOOP
        -- Gerar código de 6 caracteres alfanuméricos
        new_code := UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 6));
        
        -- Verificar se já existe
        SELECT EXISTS(SELECT 1 FROM customers WHERE referral_code = new_code) INTO code_exists;
        
        -- Se não existe, retornar
        IF NOT code_exists THEN
            RETURN new_code;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 6. TRIGGER PARA GERAR CÓDIGO AUTOMÁTICO AO CRIAR CLIENTE
CREATE OR REPLACE FUNCTION set_referral_code()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.referral_code IS NULL THEN
        NEW.referral_code := generate_referral_code();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_referral_code ON customers;
CREATE TRIGGER trigger_set_referral_code
    BEFORE INSERT ON customers
    FOR EACH ROW
    EXECUTE FUNCTION set_referral_code();

-- 7. ATUALIZAR CLIENTES EXISTENTES SEM CÓDIGO
UPDATE customers 
SET referral_code = generate_referral_code() 
WHERE referral_code IS NULL;

-- 8. CONFIGURAÇÃO DE BÔNUS DE INDICAÇÃO (no system_settings)
INSERT INTO system_settings (key, value) 
VALUES ('referral_bonus', '{"amount": 50, "enabled": true}')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- ==============================================================
-- Comentários sobre o sistema:
-- 
-- NOTIFICAÇÕES:
-- - Criadas automaticamente por triggers ou manualmente pelo admin
-- - Tipos: INFO, WARNING, ALERT, SUCCESS
-- 
-- SCORE:
-- - Score real baseado no histórico do cliente
-- - Aumenta com pagamentos em dia
-- - Diminui com atrasos
-- 
-- INDIQUE E GANHE:
-- - Cada cliente tem um código único (6 caracteres)
-- - Quando alguém usa o código, a indicação fica PENDING
-- - Admin valida e aprova/rejeita
-- - Após aprovação, cliente indicado contrata, bônus é creditado
-- ==============================================================
