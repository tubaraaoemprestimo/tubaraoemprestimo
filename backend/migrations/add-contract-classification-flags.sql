-- Adicionar flags de classificação de contrato em loan_requests
ALTER TABLE loan_requests ADD COLUMN IF NOT EXISTS is_service BOOLEAN DEFAULT false;
ALTER TABLE loan_requests ADD COLUMN IF NOT EXISTS is_investment BOOLEAN DEFAULT false;
ALTER TABLE loan_requests ADD COLUMN IF NOT EXISTS is_loan BOOLEAN DEFAULT true;

-- Adicionar flags de classificação de contrato em loans
ALTER TABLE loans ADD COLUMN IF NOT EXISTS is_service BOOLEAN DEFAULT false;
ALTER TABLE loans ADD COLUMN IF NOT EXISTS is_investment BOOLEAN DEFAULT false;
ALTER TABLE loans ADD COLUMN IF NOT EXISTS is_loan BOOLEAN DEFAULT true;

-- Atualizar registros existentes baseado no profileType
UPDATE loan_requests SET
  is_service = true,
  is_investment = false,
  is_loan = false
WHERE profile_type = 'LIMPA_NOME';

UPDATE loan_requests SET
  is_service = false,
  is_investment = true,
  is_loan = false
WHERE profile_type = 'INVESTIDOR';

UPDATE loan_requests SET
  is_service = false,
  is_investment = false,
  is_loan = true
WHERE profile_type IN ('CLT', 'AUTONOMO', 'MOTO', 'GARANTIA');

-- Atualizar loans baseado no profileType do loan_request relacionado
UPDATE loans l SET
  is_service = true,
  is_investment = false,
  is_loan = false
FROM loan_requests lr
WHERE l.request_id = lr.id AND lr.profile_type = 'LIMPA_NOME';

UPDATE loans l SET
  is_service = false,
  is_investment = true,
  is_loan = false
FROM loan_requests lr
WHERE l.request_id = lr.id AND lr.profile_type = 'INVESTIDOR';

UPDATE loans l SET
  is_service = false,
  is_investment = false,
  is_loan = true
FROM loan_requests lr
WHERE l.request_id = lr.id AND lr.profile_type IN ('CLT', 'AUTONOMO', 'MOTO', 'GARANTIA');

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_loan_requests_is_service ON loan_requests(is_service);
CREATE INDEX IF NOT EXISTS idx_loan_requests_is_investment ON loan_requests(is_investment);
CREATE INDEX IF NOT EXISTS idx_loan_requests_is_loan ON loan_requests(is_loan);

CREATE INDEX IF NOT EXISTS idx_loans_is_service ON loans(is_service);
CREATE INDEX IF NOT EXISTS idx_loans_is_investment ON loans(is_investment);
CREATE INDEX IF NOT EXISTS idx_loans_is_loan ON loans(is_loan);

-- Verificar resultados
SELECT
  profile_type,
  is_service,
  is_investment,
  is_loan,
  COUNT(*) as total
FROM loan_requests
GROUP BY profile_type, is_service, is_investment, is_loan
ORDER BY profile_type;
