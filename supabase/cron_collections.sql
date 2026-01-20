-- ==============================================
-- TUBARÃO EMPRÉSTIMOS - Configuração CRON para Cobranças Automáticas
-- Execute no Supabase SQL Editor (Database > Extensions > pg_cron primeiro)
-- ==============================================

-- 1. Habilitar extensões necessárias
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Remover job anterior se existir
SELECT cron.unschedule('daily-collections') WHERE EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'daily-collections'
);

-- 3. Criar job de cobranças automáticas - Executa todo dia às 8:00 da manhã
SELECT cron.schedule(
    'daily-collections',      -- Nome do job
    '0 8 * * *',              -- CRON: 8:00 todos os dias
    $$
    SELECT net.http_post(
        url := 'https://cwhiujeragsethxjekkb.supabase.co/functions/v1/auto-notifications',
        headers := '{"Content-Type": "application/json"}'::jsonb,
        body := '{"action": "collections"}'::jsonb
    );
    $$
);

-- 4. Verificar se o job foi criado
SELECT * FROM cron.job WHERE jobname = 'daily-collections';

-- 5. (Opcional) Ver histórico de execuções
-- SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;

-- ==============================================
-- INFORMAÇÕES SOBRE O CRON
-- ==============================================
-- O job 'daily-collections' irá:
-- 1. Executar todos os dias às 8:00 da manhã (horário UTC)
-- 2. Chamar a Edge Function 'auto-notifications' com action='collections'
-- 3. A Edge Function irá:
--    a) Buscar todas as regras de cobrança ativas
--    b) Verificar parcelas OPEN ou LATE
--    c) Enviar mensagens WhatsApp para clientes conforme regras
--    d) Logar os envios na tabela notification_logs
--
-- Para testar manualmente, execute:
-- SELECT net.http_post(
--     url := 'https://cwhiujeragsethxjekkb.supabase.co/functions/v1/auto-notifications',
--     headers := '{"Content-Type": "application/json"}'::jsonb,
--     body := '{"action": "collections"}'::jsonb
-- );
