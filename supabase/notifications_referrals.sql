-- ==============================================================
-- Script CORRIGIDO para Notificações, Score Real e Indique e Ganhe
-- Execute no Supabase SQL Editor
-- ==============================================================

-- 1. TABELA DE NOTIFICAÇÕES
DROP TABLE IF EXISTS notifications CASCADE;
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID, -- ID do usuário (auth_id ou user.id)
    customer_email TEXT, -- Email do cliente para identificação
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) DEFAULT 'INFO', -- INFO, WARNING, ALERT, SUCCESS
    read BOOLEAN DEFAULT FALSE,
    link VARCHAR(255), -- Link para ação (ex: /client/contracts)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_email ON notifications(customer_email);
CREATE INDEX idx_notifications_read ON notifications(read);
CREATE INDEX idx_notifications_created ON notifications(created_at DESC);

-- 2. TABELA DE HISTÓRICO DE SCORE
DROP TABLE IF EXISTS score_history CASCADE;
CREATE TABLE score_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_email TEXT NOT NULL,
    score_before INTEGER NOT NULL,
    score_after INTEGER NOT NULL,
    reason VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_score_history_email ON score_history(customer_email);

-- 3. TABELA DE INDICAÇÕES (Indique e Ganhe)
DROP TABLE IF EXISTS referrals CASCADE;
CREATE TABLE referrals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Quem indicou
    referrer_email TEXT NOT NULL,
    referrer_name TEXT,
    referrer_code VARCHAR(10) NOT NULL, -- Código único de 6 caracteres
    
    -- Quem foi indicado
    referred_name VARCHAR(255) NOT NULL,
    referred_cpf VARCHAR(14),
    referred_phone VARCHAR(20),
    referred_email TEXT,
    
    -- Status da indicação
    status VARCHAR(50) DEFAULT 'PENDING', -- PENDING, APPROVED, REJECTED, BONUS_PAID
    rejection_reason TEXT,
    
    -- Bônus
    bonus_amount DECIMAL(10,2) DEFAULT 0,
    bonus_paid_at TIMESTAMP WITH TIME ZONE,
    
    -- Datas
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    approved_at TIMESTAMP WITH TIME ZONE,
    approved_by TEXT
);

-- Índices
CREATE INDEX idx_referrals_referrer ON referrals(referrer_email);
CREATE INDEX idx_referrals_code ON referrals(referrer_code);
CREATE INDEX idx_referrals_status ON referrals(status);

-- 4. ADICIONAR COLUNA DE CÓDIGO DE INDICAÇÃO NO CUSTOMER
-- Cada cliente tem seu código único para indicar outros
ALTER TABLE customers ADD COLUMN IF NOT EXISTS referral_code VARCHAR(10);

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

-- 8. Adicionar índice único para referral_code
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_referral_code ON customers(referral_code);

-- 9. CONFIGURAÇÃO DE BÔNUS DE INDICAÇÃO (no system_settings se não existir)
INSERT INTO system_settings (key, value) 
VALUES ('referral_bonus', '50')
ON CONFLICT (key) DO NOTHING;

-- ==============================================================
-- SUCESSO! Execute o próximo bloco para inserir notificação de teste
-- ==============================================================
