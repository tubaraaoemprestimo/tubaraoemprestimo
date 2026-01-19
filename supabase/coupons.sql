-- ============================================
-- TABELA DE CUPONS
-- Execute este SQL no Supabase SQL Editor
-- ============================================

-- Criar tabela de cupons
CREATE TABLE IF NOT EXISTS coupons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) UNIQUE NOT NULL,
    discount DECIMAL(5,2) NOT NULL DEFAULT 0,
    description TEXT,
    customer_email VARCHAR(255), -- NULL = cupom geral para todos
    active BOOLEAN DEFAULT true,
    max_uses INTEGER DEFAULT 1,
    current_uses INTEGER DEFAULT 0,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_coupons_customer_email ON coupons(customer_email);
CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons(code);
CREATE INDEX IF NOT EXISTS idx_coupons_active ON coupons(active);

-- Comentários
COMMENT ON TABLE coupons IS 'Cupons de desconto para clientes';
COMMENT ON COLUMN coupons.customer_email IS 'Email do cliente específico. NULL = cupom para todos';
COMMENT ON COLUMN coupons.discount IS 'Percentual de desconto';

-- Desabilitar RLS por enquanto
ALTER TABLE coupons DISABLE ROW LEVEL SECURITY;

-- Exemplo de inserção de cupom
-- INSERT INTO coupons (code, discount, description, expires_at) VALUES 
-- ('BEMVINDO10', 10, 'Desconto de boas-vindas', NOW() + INTERVAL '30 days');

-- Verificar
SELECT * FROM coupons;
