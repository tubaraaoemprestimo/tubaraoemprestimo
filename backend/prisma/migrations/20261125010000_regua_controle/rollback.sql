-- Rollback da migração regua_controle. Perde o histórico de envios (não afeta dinheiro).
\set ON_ERROR_STOP on
BEGIN;
DROP TABLE IF EXISTS collection_dispatches;
ALTER TABLE loans DROP COLUMN IF EXISTS messages_suspended;
DELETE FROM system_settings WHERE key = 'collection_rules';
COMMIT;
