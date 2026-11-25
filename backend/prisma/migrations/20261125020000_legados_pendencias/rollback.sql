-- Rollback de legados_pendencias. Aborta se já houver dados nas tabelas novas (use o backup).
\set ON_ERROR_STOP on
BEGIN;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM legacy_device_financings) OR EXISTS (SELECT 1 FROM investment_records)
     OR EXISTS (SELECT 1 FROM disputes) THEN
    RAISE EXCEPTION 'há celulares/investimentos/contestações registrados; rollback abortado (use backup)';
  END IF;
END $$;
DROP TABLE investment_payouts;
DROP TABLE investment_records;
DROP TABLE legacy_device_financings;
DROP TABLE disputes;
ALTER TABLE loans DROP COLUMN legacy_document_url;
ALTER TABLE customers DROP COLUMN invite_opt_out, DROP COLUMN promo_opt_out, DROP COLUMN phone_confirmed,
  DROP COLUMN comm_suspended_until, DROP COLUMN comm_suspended_reason, DROP COLUMN comm_prefs_updated_at;
DELETE FROM system_settings WHERE key = 'communication_settings';
COMMIT;
