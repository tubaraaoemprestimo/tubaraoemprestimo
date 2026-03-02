-- ============================================
-- TABELA DE PAGAMENTOS DE EMPRÉSTIMOS
-- Para controlar pagamentos de juros e parcelas
-- ============================================

-- Tipo de pagamento
DO $$ BEGIN
    CREATE TYPE payment_type AS ENUM ('JUROS', 'PARCELA', 'TOTAL', 'MULTA', 'OUTRO');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Tabela de pagamentos
CREATE TABLE IF NOT EXISTS loan_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_id UUID REFERENCES loan_requests(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    
    -- Dados do pagamento
    payment_type VARCHAR(50) NOT NULL DEFAULT 'JUROS', -- JUROS, PARCELA, TOTAL, MULTA
    amount DECIMAL(15,2) NOT NULL,
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    reference_month VARCHAR(7), -- Ex: '2026-02' para fevereiro de 2026
    reference_year INTEGER,
    
    -- Comprovante
    proof_url TEXT,
    
    -- Confirmação
    confirmed BOOLEAN DEFAULT false,
    confirmed_by VARCHAR(255),
    confirmed_at TIMESTAMP WITH TIME ZONE,
    
    -- Observações
    notes TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_loan_payments_request ON loan_payments(request_id);
CREATE INDEX IF NOT EXISTS idx_loan_payments_customer ON loan_payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_loan_payments_date ON loan_payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_loan_payments_confirmed ON loan_payments(confirmed);

-- RLS
ALTER TABLE loan_payments ENABLE ROW LEVEL SECURITY;

-- Políticas
CREATE POLICY "Admins can manage loan_payments" ON loan_payments
    FOR ALL USING (is_admin());

CREATE POLICY "Clients can view own payments" ON loan_payments
    FOR SELECT USING (customer_id = get_my_customer_id() OR is_admin());

CREATE POLICY "Anyone can insert payments" ON loan_payments
    FOR INSERT WITH CHECK (true);

-- ============================================
-- ATUALIZAR LOAN_REQUESTS COM CAMPOS DE PAGAMENTO
-- ============================================

-- Adicionar campos de controle de pagamento na loan_requests
ALTER TABLE loan_requests ADD COLUMN IF NOT EXISTS total_paid DECIMAL(15,2) DEFAULT 0;
ALTER TABLE loan_requests ADD COLUMN IF NOT EXISTS last_payment_date DATE;
ALTER TABLE loan_requests ADD COLUMN IF NOT EXISTS payments_count INTEGER DEFAULT 0;
ALTER TABLE loan_requests ADD COLUMN IF NOT EXISTS is_fully_paid BOOLEAN DEFAULT false;

-- ============================================
-- COMENTÁRIOS
-- ============================================
COMMENT ON TABLE loan_payments IS 'Registro de todos os pagamentos feitos pelos clientes';
COMMENT ON COLUMN loan_payments.payment_type IS 'Tipo: JUROS (mensal), PARCELA, TOTAL (quitação), MULTA';
COMMENT ON COLUMN loan_payments.reference_month IS 'Mês de referência do pagamento (formato: YYYY-MM)';
COMMENT ON COLUMN loan_payments.confirmed IS 'Se o pagamento foi confirmado pelo admin';
