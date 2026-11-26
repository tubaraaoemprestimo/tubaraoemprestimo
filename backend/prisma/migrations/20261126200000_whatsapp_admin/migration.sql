-- Admin pelo WhatsApp de botões. Aditiva: só tabela nova.
BEGIN;
CREATE TABLE IF NOT EXISTS "wa_admin_phones" (
  "phone" TEXT PRIMARY KEY,
  "user_id" TEXT NOT NULL,
  "label" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "pin_hash" TEXT,
  "pin_tries" INTEGER NOT NULL DEFAULT 0,
  "locked_until" TIMESTAMP(3),
  "session_until" TIMESTAMP(3),
  "created_by" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "wa_admin_phones_user_id_idx" ON "wa_admin_phones"("user_id");
COMMIT;
