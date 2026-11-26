-- WhatsApp por botões (Whaileys). Aditiva: só tabelas novas, nenhuma tabela existente alterada.
BEGIN;
CREATE TABLE IF NOT EXISTS "wa_bot_sessions" (
  "phone" TEXT PRIMARY KEY,
  "user_id" TEXT,
  "step" TEXT NOT NULL DEFAULT 'MENU',
  "data" JSONB NOT NULL DEFAULT '{}',
  "options" JSONB NOT NULL DEFAULT '[]',
  "verified" BOOLEAN NOT NULL DEFAULT false,
  "otp_hash" TEXT,
  "otp_tries" INTEGER NOT NULL DEFAULT 0,
  "otp_expires" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "wa_bot_sessions_user_id_idx" ON "wa_bot_sessions"("user_id");
CREATE TABLE IF NOT EXISTS "wa_bot_inbound" (
  "id" TEXT PRIMARY KEY,
  "phone" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "wa_bot_inbound_created_at_idx" ON "wa_bot_inbound"("created_at");
COMMIT;
