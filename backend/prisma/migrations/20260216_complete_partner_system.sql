-- Migration FIX: Create partner_commissions table + complete all fields
-- Date: 2026-02-16

-- ====== Create partner_commissions table ======
CREATE TABLE IF NOT EXISTS "partner_commissions" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::TEXT,
    "partner_id" TEXT NOT NULL,
    "loan_request_id" TEXT NOT NULL,
    "contract_id" TEXT,
    "total_commission" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "commission_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "commission_rate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "installments_released" INTEGER NOT NULL DEFAULT 0,
    "released_percent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "release_1_amount" DOUBLE PRECISION,
    "release_1_at" TIMESTAMP(3),
    "release_2_amount" DOUBLE PRECISION,
    "release_2_at" TIMESTAMP(3),
    "release_3_amount" DOUBLE PRECISION,
    "release_3_at" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "cancel_reason" TEXT,
    "paid_at" TIMESTAMP(3),
    "payment_method" TEXT,
    "payment_reference" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "partner_commissions_pkey" PRIMARY KEY ("id")
);

-- Foreign keys
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'partner_commissions_partner_id_fkey') THEN
    ALTER TABLE "partner_commissions" ADD CONSTRAINT "partner_commissions_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'partner_commissions_loan_request_id_fkey') THEN
    ALTER TABLE "partner_commissions" ADD CONSTRAINT "partner_commissions_loan_request_id_fkey" FOREIGN KEY ("loan_request_id") REFERENCES "loan_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS "partner_commissions_partner_id_idx" ON "partner_commissions"("partner_id");
CREATE INDEX IF NOT EXISTS "partner_commissions_loan_request_id_idx" ON "partner_commissions"("loan_request_id");
CREATE INDEX IF NOT EXISTS "partner_commissions_contract_id_idx" ON "partner_commissions"("contract_id");
CREATE INDEX IF NOT EXISTS "partner_commissions_status_idx" ON "partner_commissions"("status");

-- ====== Create partner_invites table (if missing) ======
CREATE TABLE IF NOT EXISTS "partner_invites" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::TEXT,
    "partner_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "accepted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "partner_invites_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'partner_invites_partner_id_fkey') THEN
    ALTER TABLE "partner_invites" ADD CONSTRAINT "partner_invites_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "partner_invites_partner_id_idx" ON "partner_invites"("partner_id");
CREATE INDEX IF NOT EXISTS "partner_invites_email_idx" ON "partner_invites"("email");

-- ====== Verify users has isPartner and partnerScore fields ======
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='is_partner') THEN
    ALTER TABLE "users" ADD COLUMN "is_partner" BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='partner_score') THEN
    ALTER TABLE "users" ADD COLUMN "partner_score" DOUBLE PRECISION;
  END IF;
END $$;

-- ====== Verify loan has request_id field ======
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='loans' AND column_name='request_id') THEN
    ALTER TABLE "loans" ADD COLUMN "request_id" TEXT;
  END IF;
END $$;

-- Add unique constraint on request_id if not exists
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'loans_request_id_key') THEN
    CREATE UNIQUE INDEX "loans_request_id_key" ON "loans"("request_id");
  END IF;
END $$;

-- Add foreign key for loans.request_id -> loan_requests.id
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'loans_request_id_fkey') THEN
    ALTER TABLE "loans" ADD CONSTRAINT "loans_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "loan_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'Could not add loans_request_id_fkey: %', SQLERRM;
END $$;

-- ====== LoanRequest fields ======
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='loan_requests' AND column_name='company_address') THEN
    ALTER TABLE "loan_requests" ADD COLUMN "company_address" JSONB;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='loan_requests' AND column_name='company_profession') THEN
    ALTER TABLE "loan_requests" ADD COLUMN "company_profession" TEXT;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='loan_requests' AND column_name='company_work_since') THEN
    ALTER TABLE "loan_requests" ADD COLUMN "company_work_since" TEXT;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='loan_requests' AND column_name='company_income') THEN
    ALTER TABLE "loan_requests" ADD COLUMN "company_income" DOUBLE PRECISION;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='loan_requests' AND column_name='company_payment_day') THEN
    ALTER TABLE "loan_requests" ADD COLUMN "company_payment_day" INTEGER;
  END IF;
END $$;

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

-- ====== User referral_code ======
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='referral_code') THEN
    ALTER TABLE "users" ADD COLUMN "referral_code" TEXT;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'users_referral_code_key') THEN
    CREATE UNIQUE INDEX "users_referral_code_key" ON "users"("referral_code");
  END IF;
END $$;

SELECT 'MIGRATION COMPLETE!' AS result;
