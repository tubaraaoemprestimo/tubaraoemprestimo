-- ==============================================================
-- Script para adicionar funcionalidade de Pagamento PIX
-- Execute no Supabase SQL Editor
-- ==============================================================

-- 1. Adicionar campos de PIX nas configurações do sistema
-- (system_settings usa formato key-value com JSONB)
INSERT INTO system_settings (id, key, value)
VALUES 
    (uuid_generate_v4(), 'pixKey', '""'),
    (uuid_generate_v4(), 'pixKeyType', '"ALEATORIA"'),
    (uuid_generate_v4(), 'pixReceiverName', '""')
ON CONFLICT (key) DO NOTHING;

-- 2. Criar tabela de comprovantes de pagamento
CREATE TABLE IF NOT EXISTS payment_receipts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    installment_id VARCHAR(100) NOT NULL,
    loan_id UUID REFERENCES loans(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    customer_name VARCHAR(255) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    receipt_url TEXT NOT NULL,
    receipt_type VARCHAR(10) NOT NULL DEFAULT 'IMAGE',
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    reviewed_by UUID REFERENCES users(id),
    rejection_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_payment_receipts_status ON payment_receipts(status);
CREATE INDEX IF NOT EXISTS idx_payment_receipts_customer ON payment_receipts(customer_id);
CREATE INDEX IF NOT EXISTS idx_payment_receipts_loan ON payment_receipts(loan_id);
CREATE INDEX IF NOT EXISTS idx_payment_receipts_submitted ON payment_receipts(submitted_at DESC);

-- 4. Enable RLS
ALTER TABLE payment_receipts ENABLE ROW LEVEL SECURITY;

-- 5. Policy para que admins possam ver todos os comprovantes
CREATE POLICY "Admins podem ver todos comprovantes" ON payment_receipts
    FOR SELECT
    USING (is_admin());

-- 6. Policy para que admins possam atualizar comprovantes
CREATE POLICY "Admins podem atualizar comprovantes" ON payment_receipts
    FOR UPDATE
    USING (is_admin());

-- 7. Policy para que qualquer pessoa autenticada possa inserir comprovantes
CREATE POLICY "Usuarios podem enviar comprovantes" ON payment_receipts
    FOR INSERT
    WITH CHECK (true);

-- 8. Policy para que clientes vejam seus próprios comprovantes
CREATE POLICY "Clientes podem ver seus comprovantes" ON payment_receipts
    FOR SELECT
    USING (customer_id = get_my_customer_id());

-- 9. Comentários para documentação
COMMENT ON TABLE payment_receipts IS 'Comprovantes de pagamento PIX enviados pelos clientes';
COMMENT ON COLUMN payment_receipts.status IS 'PENDING = aguardando análise, APPROVED = pagamento confirmado, REJECTED = comprovante inválido';
COMMENT ON COLUMN payment_receipts.receipt_type IS 'IMAGE = imagem (jpg, png), PDF = documento PDF';

-- ==============================================================
-- IMPORTANTE: Criar bucket de storage para comprovantes
-- Acesse o Supabase Dashboard > Storage > Create Bucket:
-- - Nome: receipts
-- - Public: true (para que as imagens possam ser visualizadas)
-- ==============================================================
