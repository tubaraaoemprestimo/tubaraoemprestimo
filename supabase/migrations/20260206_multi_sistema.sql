-- =============================================================================
-- SCRIPT DE MIGRAÇÃO - Multi Sistema Tubarão Empréstimos
-- Data: 2026-02-06
-- Objetivo: Adicionar suporte a 5 tipos de serviço no sistema
-- =============================================================================

-- 1. Adicionar novos tipos de perfil/serviço (enum-like constraint)
-- Os novos valores são: CLT, AUTONOMO, MOTO, GARANTIA, LIMPA_NOME

-- Primeiro, verificar se a coluna profile_type existe e atualizar
-- Se não existir, criar
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'loan_requests' AND column_name = 'profile_type'
  ) THEN
    ALTER TABLE loan_requests ADD COLUMN profile_type TEXT DEFAULT 'CLT';
  END IF;
END $$;

-- 2. Adicionar coluna service_type para melhor organização
ALTER TABLE loan_requests 
ADD COLUMN IF NOT EXISTS service_type TEXT DEFAULT 'EMPRESTIMO';
-- Valores: EMPRESTIMO, FINANCIAMENTO, SERVICO

-- 3. Adicionar campos específicos para GARANTIA
ALTER TABLE loan_requests 
ADD COLUMN IF NOT EXISTS guarantee_type TEXT; -- 'veiculo', 'eletronico'

ALTER TABLE loan_requests 
ADD COLUMN IF NOT EXISTS guarantee_subtype TEXT; -- 'carro', 'moto', 'celular', etc

ALTER TABLE loan_requests 
ADD COLUMN IF NOT EXISTS guarantee_description TEXT;

ALTER TABLE loan_requests 
ADD COLUMN IF NOT EXISTS guarantee_estimated_value DECIMAL(12,2);

ALTER TABLE loan_requests 
ADD COLUMN IF NOT EXISTS guarantee_photos TEXT[]; -- Array de URLs

ALTER TABLE loan_requests 
ADD COLUMN IF NOT EXISTS guarantee_video TEXT;

ALTER TABLE loan_requests 
ADD COLUMN IF NOT EXISTS guarantee_document TEXT; -- CRLV, Nota Fiscal

ALTER TABLE loan_requests 
ADD COLUMN IF NOT EXISTS guarantee_in_possession BOOLEAN DEFAULT FALSE;

-- 4. Adicionar campos específicos para LIMPA NOME
ALTER TABLE loan_requests 
ADD COLUMN IF NOT EXISTS limpa_nome_contract_signed BOOLEAN DEFAULT FALSE;

ALTER TABLE loan_requests 
ADD COLUMN IF NOT EXISTS limpa_nome_contract_date TIMESTAMPTZ;

ALTER TABLE loan_requests 
ADD COLUMN IF NOT EXISTS limpa_nome_debts_info TEXT; -- JSON com info das dívidas

-- 5. Adicionar campos específicos para MOTO (financiamento)
ALTER TABLE loan_requests 
ADD COLUMN IF NOT EXISTS moto_entry_paid BOOLEAN DEFAULT FALSE;

ALTER TABLE loan_requests 
ADD COLUMN IF NOT EXISTS moto_model TEXT;

ALTER TABLE loan_requests 
ADD COLUMN IF NOT EXISTS moto_installment_value DECIMAL(10,2) DEFAULT 611.00;

ALTER TABLE loan_requests 
ADD COLUMN IF NOT EXISTS moto_insurance_value DECIMAL(10,2) DEFAULT 150.00;

-- 6. Adicionar campos específicos para AUTONOMO (capital de giro)
ALTER TABLE loan_requests 
ADD COLUMN IF NOT EXISTS autonomo_daily_value DECIMAL(10,2); -- Valor da diária

ALTER TABLE loan_requests 
ADD COLUMN IF NOT EXISTS autonomo_business_video TEXT;

ALTER TABLE loan_requests 
ADD COLUMN IF NOT EXISTS autonomo_cnpj TEXT;

ALTER TABLE loan_requests 
ADD COLUMN IF NOT EXISTS autonomo_business_address TEXT;

-- 7. Adicionar campo de localização GPS
ALTER TABLE loan_requests 
ADD COLUMN IF NOT EXISTS location_latitude DECIMAL(10,7);

ALTER TABLE loan_requests 
ADD COLUMN IF NOT EXISTS location_longitude DECIMAL(10,7);

ALTER TABLE loan_requests 
ADD COLUMN IF NOT EXISTS location_captured_at TIMESTAMPTZ;

-- 8. Adicionar índice para profile_type para melhorar performance
CREATE INDEX IF NOT EXISTS idx_loan_requests_profile_type ON loan_requests(profile_type);

-- 9. Adicionar índice para status
CREATE INDEX IF NOT EXISTS idx_loan_requests_status ON loan_requests(status);

-- =============================================================================
-- NOTAS IMPORTANTES:
-- =============================================================================
-- 
-- Cores no Painel Admin por Profile Type:
-- - CLT: bg-gray-500 (Cinza)
-- - AUTONOMO: bg-green-500 (Verde)
-- - MOTO: bg-yellow-500 (Amarelo)
-- - GARANTIA: bg-orange-500 (Laranja)
-- - LIMPA_NOME: bg-purple-500 (Roxo)
--
-- Service Types:
-- - EMPRESTIMO: CLT, AUTONOMO (pagamento mensal/diário)
-- - FINANCIAMENTO: MOTO (compra parcelada)
-- - SERVICO: LIMPA_NOME (serviço, não é empréstimo)
-- - GARANTIA: Empréstimo com bem como garantia
--
-- =============================================================================

-- 10. Criar view para facilitar consultas no admin
CREATE OR REPLACE VIEW vw_loan_requests_summary AS
SELECT 
  id,
  name,
  cpf,
  phone,
  email,
  profile_type,
  CASE profile_type
    WHEN 'CLT' THEN 'CLT / Assalariado'
    WHEN 'AUTONOMO' THEN 'Autônomo / Comércio'
    WHEN 'MOTO' THEN 'Financiamento Moto'
    WHEN 'GARANTIA' THEN 'Empréstimo c/ Garantia'
    WHEN 'LIMPA_NOME' THEN 'Limpa Nome'
    ELSE profile_type
  END as profile_label,
  amount,
  status,
  created_at,
  CASE 
    WHEN profile_type = 'GARANTIA' THEN guarantee_type
    ELSE NULL
  END as guarantee_info,
  CASE 
    WHEN profile_type = 'GARANTIA' AND guarantee_photos IS NOT NULL AND array_length(guarantee_photos, 1) > 0 
    THEN TRUE 
    ELSE FALSE 
  END as has_guarantee_docs
FROM loan_requests
ORDER BY created_at DESC;

-- 11. Adicionar comentários para documentação
COMMENT ON COLUMN loan_requests.profile_type IS 'Tipo de serviço: CLT, AUTONOMO, MOTO, GARANTIA, LIMPA_NOME';
COMMENT ON COLUMN loan_requests.guarantee_type IS 'Tipo da garantia: veiculo, eletronico';
COMMENT ON COLUMN loan_requests.guarantee_in_possession IS 'Se o bem já está em posse da empresa';

SELECT 'Migração concluída com sucesso!' as status;
