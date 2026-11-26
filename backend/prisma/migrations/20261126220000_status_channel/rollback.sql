BEGIN;
ALTER TABLE "scheduled_status" DROP COLUMN IF EXISTS "channel";
COMMIT;
