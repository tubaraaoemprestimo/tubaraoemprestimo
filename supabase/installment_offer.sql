-- ============================================
-- ADICIONAR COLUNA INSTALLMENT_OFFER NA TABELA CUSTOMERS
-- Execute este SQL no Supabase SQL Editor
-- ============================================

-- Adicionar coluna para oferta de parcelamento
ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS installment_offer JSONB DEFAULT NULL;

-- Comentário na coluna
COMMENT ON COLUMN customers.installment_offer IS 'Oferta de parcelamento enviada pelo admin: {amount, installments, interest_rate, installment_value, total_amount, created_at}';

-- Verificar
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'customers' AND column_name = 'installment_offer';
