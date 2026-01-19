-- ============================================
-- CONFIGURAÇÕES DE EMAIL
-- Execute no Supabase SQL Editor
-- ============================================

-- A coluna 'value' da tabela system_settings é do tipo JSONB
-- Então precisamos passar valores como JSON válido

INSERT INTO system_settings (key, value)
VALUES 
  ('admin_email', '"tubaraao.emprestimo@gmail.com"'),
  ('email_notifications_enabled', 'true'),
  ('email_on_new_request', 'true'),
  ('email_on_status_change', 'true')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- Verificar se foi inserido
SELECT key, value FROM system_settings WHERE key LIKE '%email%';
