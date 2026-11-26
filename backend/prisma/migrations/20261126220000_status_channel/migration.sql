-- Status agendado: qual número publica. Aditiva (coluna nova com padrão).
BEGIN;
ALTER TABLE "scheduled_status" ADD COLUMN IF NOT EXISTS "channel" TEXT NOT NULL DEFAULT 'EVOLUTION';
COMMIT;
