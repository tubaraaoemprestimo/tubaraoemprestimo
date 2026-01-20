-- ============================================
-- SETUP CRON: Automação de Notificações WhatsApp
-- ============================================

-- 1. Habilitar a extensão pg_cron e pg_net (se ainda não estiverem)
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

-- 2. Remover agendamento anterior (para não duplicar)
select cron.unschedule('whatsapp-auto-notifications-job');

-- 3. Criar o agendamento
-- Este job irá rodar a cada hora (minuto 0) para verificar envios pendentes
-- Ajuste o cronograma conforme necessidade: '0 9 * * *' para todo dia às 9h
SELECT cron.schedule(
    'whatsapp-auto-notifications-job',
    '0 * * * *', -- Roda a cada hora cheia (ex: 10:00, 11:00...)
    $$
    SELECT
        net.http_post(
            url:='https://cwhiujeragsethxjekkb.supabase.co/functions/v1/auto-notifications',
            headers:='{"Content-Type": "application/json", "Authorization": "Bearer SUA_SERVICE_ROLE_KEY_AQUI"}'::jsonb,
            body:='{}'::jsonb
        ) as request_id;
    $$
);

-- ============================================
-- IMPORTANTE:
-- Substitua 'SUA_SERVICE_ROLE_KEY_AQUI' pela sua chave 'service_role' (secret) do Supabase.
-- Você pode encontrá-la no Dashboard > Project Settings > API.
-- ============================================

-- 4. Verificar jobs agendados
select * from cron.job;
