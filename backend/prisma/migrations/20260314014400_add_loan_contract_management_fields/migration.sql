-- AlterTable
ALTER TABLE "loans" ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "loans" ADD COLUMN "principal_amount" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "loans" ADD COLUMN "daily_installment_amount" DOUBLE PRECISION;
ALTER TABLE "loans" ADD COLUMN "total_installments" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "loans" ADD COLUMN "first_payment_date" TIMESTAMP(3);
ALTER TABLE "loans" ADD COLUMN "pix_receipt_url" TEXT;
ALTER TABLE "loans" ADD COLUMN "interest_rate" DOUBLE PRECISION;
ALTER TABLE "loans" ADD COLUMN "payment_frequency" TEXT NOT NULL DEFAULT 'MONTHLY';
ALTER TABLE "loans" ADD COLUMN "due_day" INTEGER;
ALTER TABLE "loans" ADD COLUMN "days_overdue" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "loans" ADD COLUMN "last_payment_date" TIMESTAMP(3);
ALTER TABLE "loans" ADD COLUMN "next_payment_date" TIMESTAMP(3);
ALTER TABLE "loans" ADD COLUMN "admin_notes" TEXT;

-- AlterTable - Change default status from APPROVED to ACTIVE
ALTER TABLE "loans" ALTER COLUMN "status" SET DEFAULT 'ACTIVE';

-- CreateIndex
CREATE INDEX "loans_status_idx" ON "loans"("status");
CREATE INDEX "loans_customer_id_idx" ON "loans"("customer_id");
CREATE INDEX "loans_next_payment_date_idx" ON "loans"("next_payment_date");

-- Migrate existing data: set principal_amount = amount for existing loans
UPDATE "loans" SET "principal_amount" = "amount" WHERE "principal_amount" = 0;
UPDATE "loans" SET "total_installments" = "installments_count" WHERE "total_installments" = 1;
