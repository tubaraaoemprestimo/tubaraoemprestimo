-- =============================================================================
-- MIGRAÇÃO: Adicionar birth_date na tabela loan_requests e customers
-- Data: 2026-02-06
-- Objetivo: Armazenar data de nascimento (obrigatório para Limpa Nome)
-- =============================================================================

-- Adicionar birth_date na tabela loan_requests
ALTER TABLE loan_requests
ADD COLUMN IF NOT EXISTS birth_date DATE;

-- Adicionar birth_date na tabela customers
ALTER TABLE customers
ADD COLUMN IF NOT EXISTS birth_date DATE;

-- Comentário para documentação
COMMENT ON COLUMN loan_requests.birth_date IS 'Data de nascimento do cliente';
COMMENT ON COLUMN customers.birth_date IS 'Data de nascimento do cliente';

SELECT 'Migração birth_date concluída!' as status;
