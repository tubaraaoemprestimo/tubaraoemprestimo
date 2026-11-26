-- Rollback da Central WhatsApp: remove só as tabelas novas (histórico da central e respostas rápidas).
-- O histórico antigo (ai_chat_history) e as mensagens na Evolution não são tocados.
\set ON_ERROR_STOP on
BEGIN;
DROP TABLE IF EXISTS wa_messages;
DROP TABLE IF EXISTS wa_conversations;
DROP TABLE IF EXISTS wa_quick_replies;
DELETE FROM system_settings WHERE key IN ('inbox_settings', 'inbox_import', 'inbox_health');
COMMIT;
