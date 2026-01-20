-- ============================================
-- SETUP CRON: Automação de Notificações WhatsApp
-- ============================================

-- 1. Habilitar a extensão pg_cron e pg_net
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

-- 2. Remover agendamento anterior de forma segura
DO $$
DECLARE
    row record;
BEGIN
    FOR row IN SELECT jobid FROM cron.job WHERE jobname = 'whatsapp-auto-notifications-job' LOOP
        PERFORM cron.unschedule(row.jobid);
    END LOOP;
END $$;

-- 3. Criar o agendamento (Atualizado com sua chave)
-- Agendado para rodar a cada hora (minuto 0)
SELECT cron.schedule(
    'whatsapp-auto-notifications-job',
    '0 * * * *', 
    $$
    SELECT
        net.http_post(
            url:='https://cwhiujeragsethxjekkb.supabase.co/functions/v1/auto-notifications',
            headers:='{"Content-Type": "application/json", "Authorization": "Bearer sb_secret_T2i1wRT0CkjMs0Ow6jh7IQ_4U7Hj5hx"}'::jsonb,
            body:='{}'::jsonb
        ) as request_id;
    $$
);

-- ============================================
-- VERIFICAÇÃO
-- ============================================
select * from cron.job;

-- ============================================
-- CRON: Status WhatsApp (a cada 5 minutos)
-- ============================================
DO $$
DECLARE
    row record;
BEGIN
    FOR row IN SELECT jobid FROM cron.job WHERE jobname = 'whatsapp-post-status-job' LOOP
        PERFORM cron.unschedule(row.jobid);
    END LOOP;
END $$;

SELECT cron.schedule(
    'whatsapp-post-status-job',
    '*/5 * * * *', -- A cada 5 minutos
    $$
    SELECT
        net.http_post(
            url:='https://cwhiujeragsethxjekkb.supabase.co/functions/v1/post-status',
            headers:='{"Content-Type": "application/json", "Authorization": "Bearer sb_secret_T2i1wRT0CkjMs0Ow6jh7IQ_4U7Hj5hx"}'::jsonb,
            body:='{}'::jsonb
        ) as request_id;
    $$
);

-- Verificar todos os jobs
SELECT jobid, jobname, schedule FROM cron.job;
