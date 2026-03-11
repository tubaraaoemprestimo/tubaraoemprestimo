-- ============================================
-- Migration: Área do Investidor Tubarão
-- Data: 2026-02-10
-- Descrição: Cria tabela investor_requests para
-- armazenar solicitações de investimento e
-- adiciona INVESTIDOR ao enum de profile_type
-- ============================================

-- 1. Criar enum para status do investimento
DO $$ BEGIN
    CREATE TYPE investor_status AS ENUM (
        'PENDING',      -- Aguardando análise
        'APPROVED',     -- Aprovado pelo admin
        'ACTIVE',       -- Contrato ativo (investimento rodando)
        'COMPLETED',    -- Prazo finalizado, resgate feito
        'REJECTED',     -- Reprovado
        'CANCELLED'     -- Cancelado
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Criar enum para modalidade de remuneração
DO $$ BEGIN
    CREATE TYPE investor_payout_mode AS ENUM (
        'MONTHLY',      -- Rendimento mensal
        'ANNUAL'        -- Rendimento anual acumulado
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. Criar tabela investor_requests
CREATE TABLE IF NOT EXISTS investor_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,

    -- Dados pessoais / empresa
    full_name VARCHAR(255) NOT NULL,
    cpf_cnpj VARCHAR(20) NOT NULL,
    rg_cnh VARCHAR(50),
    birth_date DATE,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(20) NOT NULL,

    -- Endereço
    address TEXT,
    city VARCHAR(255),
    state VARCHAR(2),
    zip_code VARCHAR(10),

    -- Dados bancários
    bank_name VARCHAR(255),
    pix_key TEXT,
    pix_key_type VARCHAR(20) DEFAULT 'cpf',
    account_holder_name VARCHAR(255),

    -- Investimento
    investment_amount DECIMAL(15,2) NOT NULL,
    investment_tier VARCHAR(20) NOT NULL DEFAULT 'STANDARD',
    -- STANDARD = R$10.000-49.999 | PREMIUM = R$50.000+
    payout_mode investor_payout_mode NOT NULL DEFAULT 'MONTHLY',
    monthly_rate DECIMAL(5,2) NOT NULL,
    -- STANDARD MONTHLY=2.5% | STANDARD ANNUAL=3.5%
    -- PREMIUM MONTHLY=5.0% | PREMIUM ANNUAL=6.0%

    contract_months INTEGER NOT NULL DEFAULT 12,
    auto_renew BOOLEAN DEFAULT true,
    withdrawal_notice_months INTEGER DEFAULT 3,

    -- Aceite legal
    terms_accepted BOOLEAN DEFAULT false,
    terms_accepted_at TIMESTAMP WITH TIME ZONE,
    signature_url TEXT,

    -- Status
    status investor_status DEFAULT 'PENDING',
    admin_notes TEXT,
    approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    approved_at TIMESTAMP WITH TIME ZONE,

    -- Documentos
    id_card_url TEXT,
    id_card_back_url TEXT,
    proof_of_address_url TEXT,
    selfie_url TEXT,

    -- Metadata
    profile_type VARCHAR(20) DEFAULT 'INVESTIDOR',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Índices
CREATE INDEX IF NOT EXISTS idx_investor_requests_status ON investor_requests(status);
CREATE INDEX IF NOT EXISTS idx_investor_requests_cpf ON investor_requests(cpf_cnpj);
CREATE INDEX IF NOT EXISTS idx_investor_requests_email ON investor_requests(email);
CREATE INDEX IF NOT EXISTS idx_investor_requests_customer ON investor_requests(customer_id);
CREATE INDEX IF NOT EXISTS idx_investor_requests_created ON investor_requests(created_at DESC);

-- 5. RLS
ALTER TABLE investor_requests ENABLE ROW LEVEL SECURITY;

-- Clientes podem ver apenas suas próprias solicitações
CREATE POLICY "Clients can view own investor requests" ON investor_requests
    FOR SELECT USING (
        customer_id = get_my_customer_id() OR is_admin()
    );

-- Qualquer autenticado pode criar solicitação
CREATE POLICY "Authenticated can create investor requests" ON investor_requests
    FOR INSERT WITH CHECK (true);

-- Admin pode gerenciar tudo
CREATE POLICY "Admins can manage investor requests" ON investor_requests
    FOR ALL USING (is_admin());

-- 6. Trigger para updated_at
CREATE OR REPLACE FUNCTION update_investor_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_investor_updated_at ON investor_requests;
CREATE TRIGGER trigger_investor_updated_at
    BEFORE UPDATE ON investor_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_investor_updated_at();
