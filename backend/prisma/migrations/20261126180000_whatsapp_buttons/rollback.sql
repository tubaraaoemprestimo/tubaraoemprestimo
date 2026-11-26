-- Remove só as tabelas do WhatsApp por botões. Solicitações criadas continuam em loan_requests.
BEGIN;
DROP TABLE IF EXISTS "wa_bot_inbound";
DROP TABLE IF EXISTS "wa_bot_sessions";
COMMIT;
