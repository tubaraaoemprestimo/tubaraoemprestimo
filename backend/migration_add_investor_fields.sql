-- Migration: Add investor fields to loan_requests table
-- Date: 2026-02-19
-- Description: Adiciona campos específicos para investidores na tabela loan_requests

ALTER TABLE loan_requests
ADD COLUMN IF NOT EXISTS investment_tier VARCHAR(50),
ADD COLUMN IF NOT EXISTS payout_mode VARCHAR(50),
ADD COLUMN IF NOT EXISTS monthly_rate DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS contract_months INTEGER,
ADD COLUMN IF NOT EXISTS auto_renew BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS withdrawal_notice_months INTEGER,
ADD COLUMN IF NOT EXISTS account_holder_name VARCHAR(255);

-- Comentários para documentação
COMMENT ON COLUMN loan_requests.investment_tier IS 'Tier do investimento: STANDARD ou PREMIUM';
COMMENT ON COLUMN loan_requests.payout_mode IS 'Modo de pagamento: MONTHLY ou ANNUAL';
COMMENT ON COLUMN loan_requests.monthly_rate IS 'Taxa mensal de rendimento (%)';
COMMENT ON COLUMN loan_requests.contract_months IS 'Duração do contrato em meses';
COMMENT ON COLUMN loan_requests.auto_renew IS 'Renovação automática do contrato';
COMMENT ON COLUMN loan_requests.withdrawal_notice_months IS 'Meses de aviso prévio para resgate';
COMMENT ON COLUMN loan_requests.account_holder_name IS 'Nome do titular da conta bancária';
