-- ============================================
-- CONFIGURAÇÕES DE EMAIL
-- Execute no Supabase
-- ============================================

-- Adicionar configurações de email no system_settings
-- SUBSTITUA pelo seu email real antes de executar!

INSERT INTO system_settings (key, value)
VALUES 
  ('admin_email', 'tubaraoemprestimos@gmail.com'),
  ('email_notifications_enabled', 'true'),
  ('email_on_new_request', 'true'),
  ('email_on_status_change', 'true')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- Verificar
SELECT key, value FROM system_settings WHERE key LIKE '%email%';
