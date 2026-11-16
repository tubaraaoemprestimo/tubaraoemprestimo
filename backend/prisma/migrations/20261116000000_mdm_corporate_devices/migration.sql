-- Aparelhos corporativos (funcionários) no MDM: sem vínculo com estoque, auto-registro no check-in.
-- Aditiva. Aplicar: docker exec -i tubarao_postgres psql -v ON_ERROR_STOP=1 -U postgres -d tubarao_db < migration.sql
-- Rollback: ALTER TABLE ... DROP COLUMN das colunas abaixo; unit_id volta a NOT NULL só se não houver linha com unit_id nulo.
BEGIN;

ALTER TABLE "apple_mdm_devices" ALTER COLUMN "unit_id" DROP NOT NULL;
ALTER TABLE "apple_mdm_devices"
    ADD COLUMN IF NOT EXISTS "device_name" TEXT,
    ADD COLUMN IF NOT EXISTS "model" TEXT,
    ADD COLUMN IF NOT EXISTS "assigned_to" TEXT,
    ADD COLUMN IF NOT EXISTS "lost_mode" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS "last_location" JSONB,
    ADD COLUMN IF NOT EXISTS "unenrolled_at" TIMESTAMP(3);

ALTER TABLE "mdm_commands" ADD COLUMN IF NOT EXISTS "params" JSONB;

COMMIT;
