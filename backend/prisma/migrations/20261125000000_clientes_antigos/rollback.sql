-- Rollback da migração clientes_antigos. SÓ usar se nenhum cliente antigo/convite tiver sido gravado
-- (aborta sozinho se houver). Depois, voltar o backend para o commit anterior.
\set ON_ERROR_STOP on
BEGIN;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM customers WHERE is_legacy) OR EXISTS (SELECT 1 FROM loans WHERE is_legacy OR collection_suspended)
     OR EXISTS (SELECT 1 FROM activation_invites) THEN
    RAISE EXCEPTION 'há dados do módulo clientes antigos; rollback de schema abortado (use backup)';
  END IF;
END $$;
DELETE FROM message_templates WHERE trigger_event = 'INSTALLMENT_DUE_5_DAYS';
DROP TABLE activation_invites;
DROP INDEX IF EXISTS uq_loans_legacy_reference;
DROP INDEX IF EXISTS idx_customers_is_legacy;
ALTER TABLE loans DROP COLUMN is_legacy, DROP COLUMN legacy_reference, DROP COLUMN legacy_original_date, DROP COLUMN legacy_paid_amount,
  DROP COLUMN legacy_balance_date, DROP COLUMN legacy_balance_confirmed, DROP COLUMN collection_suspended;
ALTER TABLE customers DROP COLUMN activation_status, DROP COLUMN is_legacy, DROP COLUMN whatsapp_opt_out;
COMMIT;
