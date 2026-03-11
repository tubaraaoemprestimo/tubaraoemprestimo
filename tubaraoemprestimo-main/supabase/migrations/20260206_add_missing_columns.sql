-- =============================================================================
-- MIGRAÇÃO: Adicionar colunas faltantes em loan_requests
-- Data: 2026-02-06
-- Objetivo: Garantir que todas as colunas usadas pelo código existam no banco
-- =============================================================================

-- Cliente recorrente
ALTER TABLE loan_requests
ADD COLUMN IF NOT EXISTS is_returning_client BOOLEAN DEFAULT FALSE;

ALTER TABLE loan_requests
ADD COLUMN IF NOT EXISTS returning_client_note TEXT DEFAULT '';

-- Cor da moto (financiamento)
ALTER TABLE loan_requests
ADD COLUMN IF NOT EXISTS moto_color TEXT;

-- Garantir que profile_type existe (caso multi_sistema não tenha rodado)
ALTER TABLE loan_requests
ADD COLUMN IF NOT EXISTS profile_type TEXT DEFAULT 'CLT';

-- Garantir que service_type existe
ALTER TABLE loan_requests
ADD COLUMN IF NOT EXISTS service_type TEXT DEFAULT 'EMPRESTIMO';

-- Garantir que birth_date existe
ALTER TABLE loan_requests
ADD COLUMN IF NOT EXISTS birth_date DATE;

-- Limpa Nome
ALTER TABLE loan_requests
ADD COLUMN IF NOT EXISTS limpa_nome_contract_signed BOOLEAN DEFAULT FALSE;

ALTER TABLE loan_requests
ADD COLUMN IF NOT EXISTS limpa_nome_contract_date TIMESTAMPTZ;

-- Índice para profile_type
CREATE INDEX IF NOT EXISTS idx_loan_requests_profile_type ON loan_requests(profile_type);

SELECT 'Migração colunas faltantes concluída!' as status;
