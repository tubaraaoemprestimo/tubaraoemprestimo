-- ============================================
-- CONFIGURAÇÕES DE TAXAS E EMPRÉSTIMOS
-- Execute este SQL no Supabase
-- ============================================

-- Configurações de juros e taxas
INSERT INTO system_settings (key, value)
VALUES 
  -- Taxa de juros mensal (em %)
  ('interest_rate_monthly', '30'),
  
  -- Taxa de juros diária por atraso (em %)
  ('late_fee_daily', '0.5'),
  
  -- Taxa de juros mensal por atraso (em %)
  ('late_fee_monthly', '15'),
  
  -- Taxa fixa por atraso (em R$)
  ('late_fee_fixed', '50'),
  
  -- Valor mínimo de empréstimo
  ('min_loan_amount', '300'),
  
  -- Valor máximo de empréstimo SEM GARANTIA
  ('max_loan_no_guarantee', '3000'),
  
  -- Valor máximo de empréstimo COM GARANTIA
  ('max_loan_amount', '10000'),
  
  -- Número de parcelas (fixo pelo admin)
  ('default_installments', '4'),
  
  -- Pacotes de valores disponíveis (JSON array) - até 3000
  ('loan_packages', '[500, 1000, 1500, 2000, 2500, 3000]'),
  
  -- Prazo de liberação (em horas)
  ('release_time_hours', '72')
  
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- Verificar
SELECT key, value FROM system_settings;
