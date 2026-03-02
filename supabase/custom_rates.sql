-- ==============================================================
-- Script para adicionar taxas personalizadas por cliente
-- Execute no Supabase SQL Editor
-- ==============================================================

-- 1. Adicionar coluna custom_rates na tabela customers
-- Armazena as taxas personalizadas como JSONB
ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS custom_rates JSONB;

-- 2. Comentário para documentação
COMMENT ON COLUMN customers.custom_rates IS 
'Taxas personalizadas do cliente que sobrescrevem as globais. 
Formato: { monthly_interest_rate: number, late_fixed_fee: number, late_interest_daily: number, late_interest_monthly: number }';

-- 3. Criar índice para consultas em custom_rates (opcional, para performance)
CREATE INDEX IF NOT EXISTS idx_customers_custom_rates ON customers USING GIN (custom_rates);

-- ==============================================================
-- Exemplo de uso:
-- UPDATE customers SET custom_rates = '{"monthly_interest_rate": 3.5, "late_fixed_fee": 10, "late_interest_daily": 0.05, "late_interest_monthly": 1.5}'::jsonb WHERE id = 'uuid-do-cliente';
-- ==============================================================
