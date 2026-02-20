-- Migration: Commission Release System (40/30/30) + Partner Bonus
-- Date: 2026-02-16
-- Description: Updates PartnerCommission model for installment-based release,
--              adds PartnerBonus model, and adds new fields to LoanRequest and User.
-- IMPORTANT: This migration uses DO blocks with conditional checks for PostgreSQL compatibility.

-- ====== LoanRequest new fields ======
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='loan_requests' AND column_name='company_name') THEN
    ALTER TABLE "loan_requests" ADD COLUMN "company_name" TEXT;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='loan_requests' AND column_name='contract_terms_accepted') THEN
    ALTER TABLE "loan_requests" ADD COLUMN "contract_terms_accepted" BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='loan_requests' AND column_name='declaration_accepted') THEN
    ALTER TABLE "loan_requests" ADD COLUMN "declaration_accepted" BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;

-- ====== User new fields ======
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='referral_code') THEN
    ALTER TABLE "users" ADD COLUMN "referral_code" TEXT;
  END IF;
END $$;

-- Create unique index on referral_code (only for non-null values)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'users_referral_code_key') THEN
    CREATE UNIQUE INDEX "users_referral_code_key" ON "users"("referral_code");
  END IF;
END $$;

-- ====== PartnerCommission new fields ======
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='partner_commissions' AND column_name='contract_id') THEN
    ALTER TABLE "partner_commissions" ADD COLUMN "contract_id" TEXT;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='partner_commissions' AND column_name='total_commission') THEN
    ALTER TABLE "partner_commissions" ADD COLUMN "total_commission" DOUBLE PRECISION;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='partner_commissions' AND column_name='installments_released') THEN
    ALTER TABLE "partner_commissions" ADD COLUMN "installments_released" INTEGER NOT NULL DEFAULT 0;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='partner_commissions' AND column_name='released_percent') THEN
    ALTER TABLE "partner_commissions" ADD COLUMN "released_percent" DOUBLE PRECISION NOT NULL DEFAULT 0;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='partner_commissions' AND column_name='release_1_amount') THEN
    ALTER TABLE "partner_commissions" ADD COLUMN "release_1_amount" DOUBLE PRECISION;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='partner_commissions' AND column_name='release_1_at') THEN
    ALTER TABLE "partner_commissions" ADD COLUMN "release_1_at" TIMESTAMP(3);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='partner_commissions' AND column_name='release_2_amount') THEN
    ALTER TABLE "partner_commissions" ADD COLUMN "release_2_amount" DOUBLE PRECISION;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='partner_commissions' AND column_name='release_2_at') THEN
    ALTER TABLE "partner_commissions" ADD COLUMN "release_2_at" TIMESTAMP(3);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='partner_commissions' AND column_name='release_3_amount') THEN
    ALTER TABLE "partner_commissions" ADD COLUMN "release_3_amount" DOUBLE PRECISION;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='partner_commissions' AND column_name='release_3_at') THEN
    ALTER TABLE "partner_commissions" ADD COLUMN "release_3_at" TIMESTAMP(3);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='partner_commissions' AND column_name='cancel_reason') THEN
    ALTER TABLE "partner_commissions" ADD COLUMN "cancel_reason" TEXT;
  END IF;
END $$;

-- Backfill total_commission from commission_amount for existing records
UPDATE "partner_commissions" SET "total_commission" = "commission_amount" WHERE "total_commission" IS NULL;

-- Make total_commission NOT NULL after backfill
ALTER TABLE "partner_commissions" ALTER COLUMN "total_commission" SET NOT NULL;

-- Create index on contract_id
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'partner_commissions_contract_id_idx') THEN
    CREATE INDEX "partner_commissions_contract_id_idx" ON "partner_commissions"("contract_id");
  END IF;
END $$;

-- ====== PartnerBonus table ======
CREATE TABLE IF NOT EXISTS "partner_bonuses" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::TEXT,
    "partner_id" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "contracts_count" INTEGER NOT NULL DEFAULT 0,
    "default_rate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "bonus_amount" DOUBLE PRECISION NOT NULL,
    "bonus_tier" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "paid_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "partner_bonuses_pkey" PRIMARY KEY ("id")
);

-- Add foreign key only if it doesn't exist
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'partner_bonuses_partner_id_fkey') THEN
    ALTER TABLE "partner_bonuses" ADD CONSTRAINT "partner_bonuses_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- Unique constraint on partner_id + month
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'partner_bonuses_partner_id_month_key') THEN
    CREATE UNIQUE INDEX "partner_bonuses_partner_id_month_key" ON "partner_bonuses"("partner_id", "month");
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'partner_bonuses_partner_id_idx') THEN
    CREATE INDEX "partner_bonuses_partner_id_idx" ON "partner_bonuses"("partner_id");
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'partner_bonuses_month_idx') THEN
    CREATE INDEX "partner_bonuses_month_idx" ON "partner_bonuses"("month");
  END IF;
END $$;

-- ====== Summary ======
-- New fields: company_name, contract_terms_accepted, declaration_accepted (loan_requests)
-- New fields: referral_code (users)
-- New fields: contract_id, total_commission, installments_released, released_percent,
--             release_1_amount, release_1_at, release_2_amount, release_2_at,
--             release_3_amount, release_3_at, cancel_reason (partner_commissions)
-- New table: partner_bonuses
