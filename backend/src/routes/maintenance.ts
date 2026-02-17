import { Router, Request, Response } from 'express';
import { prisma } from '../services/prisma';

export const maintenanceRouter = Router();

// Endpoint de emergência para rodar migração SQL Hardcoded (Mais seguro que parsear arquivo)
maintenanceRouter.get('/run-migration', async (req: Request, res: Response) => {
    try {
        const commands = [
            // Partner Commissions
            `CREATE TABLE IF NOT EXISTS "partner_commissions" (
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
            );`,
            // Partner Invites
            `CREATE TABLE IF NOT EXISTS "partner_invites" (
                "id" TEXT NOT NULL DEFAULT gen_random_uuid()::TEXT,
                "partner_id" TEXT NOT NULL,
                "email" TEXT NOT NULL,
                "status" TEXT NOT NULL DEFAULT 'PENDING',
                "accepted_at" TIMESTAMP(3),
                "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT "partner_invites_pkey" PRIMARY KEY ("id")
            );`,

            // Users Columns
            `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_partner" BOOLEAN NOT NULL DEFAULT false;`,
            `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "partner_score" DOUBLE PRECISION;`,
            `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "referral_code" TEXT;`,

            // Loans Columns
            `ALTER TABLE "loans" ADD COLUMN IF NOT EXISTS "request_id" TEXT;`,

            // LoanRequests Columns
            `ALTER TABLE "loan_requests" ADD COLUMN IF NOT EXISTS "company_address" JSONB;`,
            `ALTER TABLE "loan_requests" ADD COLUMN IF NOT EXISTS "company_profession" TEXT;`,
            `ALTER TABLE "loan_requests" ADD COLUMN IF NOT EXISTS "company_work_since" TEXT;`,
            `ALTER TABLE "loan_requests" ADD COLUMN IF NOT EXISTS "company_income" DOUBLE PRECISION;`,
            `ALTER TABLE "loan_requests" ADD COLUMN IF NOT EXISTS "company_payment_day" INTEGER;`,
            `ALTER TABLE "loan_requests" ADD COLUMN IF NOT EXISTS "company_name" TEXT;`,
            `ALTER TABLE "loan_requests" ADD COLUMN IF NOT EXISTS "contract_terms_accepted" BOOLEAN NOT NULL DEFAULT false;`,
            `ALTER TABLE "loan_requests" ADD COLUMN IF NOT EXISTS "declaration_accepted" BOOLEAN NOT NULL DEFAULT false;`,
            `ALTER TABLE "loan_requests" ADD COLUMN IF NOT EXISTS "partner_id" TEXT;`,
            `ALTER TABLE "loan_requests" ADD COLUMN IF NOT EXISTS "is_partner_referral" BOOLEAN NOT NULL DEFAULT false;`,
            `ALTER TABLE "loan_requests" ADD COLUMN IF NOT EXISTS "partner_commission_rate" DOUBLE PRECISION;`,
            `ALTER TABLE "loan_requests" ADD COLUMN IF NOT EXISTS "referral_code" TEXT;`,

            // Partner Program
            `CREATE TABLE IF NOT EXISTS "partner_programs" (
                "id" TEXT NOT NULL DEFAULT gen_random_uuid()::TEXT,
                "name" TEXT NOT NULL,
                "description" TEXT NOT NULL,
                "commission_rate" DOUBLE PRECISION NOT NULL,
                "minimum_commission" DOUBLE PRECISION NOT NULL,
                "maximum_commission" DOUBLE PRECISION NOT NULL,
                "is_active" BOOLEAN NOT NULL DEFAULT true,
                "start_date" TIMESTAMP(3) NOT NULL,
                "end_date" TIMESTAMP(3),
                "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT "partner_programs_pkey" PRIMARY KEY ("id")
            );`,

            // Partner Bonus
            `CREATE TABLE IF NOT EXISTS "partner_bonuses" (
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
            );`
        ];

        const results = [];
        for (const cmd of commands) {
            try {
                await prisma.$executeRawUnsafe(cmd);
                results.push({ success: true, cmd: cmd.substring(0, 50) + '...' });
            } catch (err: any) {
                // Ignorar erro de coluna já existente se o IF NOT EXISTS falhar (versões antigas de PG), mas vamos assumir que funcinou ou falhou
                results.push({ success: false, cmd: cmd.substring(0, 50) + '...', error: err.message });
            }
        }

        res.json({ success: true, mode: 'hardcoded_commands', results });

    } catch (error: any) {
        console.error('Migration failed:', error);
        res.status(500).json({ error: 'Migration failed', details: error.message });
    }
});
