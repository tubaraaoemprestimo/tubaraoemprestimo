-- Remove o cadastro de números admin do WhatsApp.
BEGIN;
DROP TABLE IF EXISTS "wa_admin_phones";
COMMIT;
