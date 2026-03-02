import { Router, Request, Response } from 'express';
import { prisma } from '../services/prisma';

export const maintenanceRouter = Router();

// Endpoint de emergência para rodar migração SQL Hardcoded
// Baseado 100% no schema.prisma para garantir sincronia
maintenanceRouter.get('/run-migration', async (_req: Request, res: Response) => {
    try {
        const commands: string[] = [

            // ==========================================
            // 1. CUSTOMERS - Campos de Parceiro
            // ==========================================
            `ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "partner_id" TEXT;`,
            `ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "is_partner_customer" BOOLEAN NOT NULL DEFAULT false;`,
            `ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "partner_commission_rate" DOUBLE PRECISION;`,
            `ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "contract_terms_accepted" BOOLEAN NOT NULL DEFAULT false;`,

            // ==========================================
            // 2. USERS - Campos de Parceiro
            // ==========================================
            `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_partner" BOOLEAN NOT NULL DEFAULT false;`,
            `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "partner_score" DOUBLE PRECISION;`,
            `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "referral_code" TEXT;`,

            // ==========================================
            // 3. LOANS - Link com LoanRequest
            // ==========================================
            `ALTER TABLE "loans" ADD COLUMN IF NOT EXISTS "request_id" TEXT;`,

            // ==========================================
            // 4. LOAN_REQUESTS - Campos Empresa + Parceiro
            // ==========================================
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
            `ALTER TABLE "loan_requests" ADD COLUMN IF NOT EXISTS "contract_pdf_url" TEXT;`,
            `ALTER TABLE "loan_requests" ADD COLUMN IF NOT EXISTS "supplemental_description" TEXT;`,
            `ALTER TABLE "loan_requests" ADD COLUMN IF NOT EXISTS "supplemental_doc_url" TEXT;`,
            `ALTER TABLE "loan_requests" ADD COLUMN IF NOT EXISTS "supplemental_requested_at" TIMESTAMP(3);`,
            `ALTER TABLE "loan_requests" ADD COLUMN IF NOT EXISTS "supplemental_uploaded_at" TIMESTAMP(3);`,

            // ==========================================
            // 5. TABELA: partner_commissions
            // ==========================================
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

            // ==========================================
            // 6. TABELA: partner_invites (campos corretos do schema)
            // ==========================================
            `CREATE TABLE IF NOT EXISTS "partner_invites" (
                "id" TEXT NOT NULL DEFAULT gen_random_uuid()::TEXT,
                "partner_id" TEXT NOT NULL,
                "invited_email" TEXT NOT NULL,
                "invite_code" TEXT NOT NULL,
                "status" TEXT NOT NULL DEFAULT 'PENDING',
                "accepted_at" TIMESTAMP(3),
                "expired_at" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP + INTERVAL '7 days'),
                "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT "partner_invites_pkey" PRIMARY KEY ("id")
            );`,

            // ==========================================
            // 7. TABELA: partner_programs
            // ==========================================
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

            // ==========================================
            // 8. TABELA: partner_bonuses
            // ==========================================
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
            );`,

            // ==========================================
            // 9. ÍNDICES
            // ==========================================
            `CREATE INDEX IF NOT EXISTS "partner_commissions_partner_id_idx" ON "partner_commissions"("partner_id");`,
            `CREATE INDEX IF NOT EXISTS "partner_commissions_loan_request_id_idx" ON "partner_commissions"("loan_request_id");`,
            `CREATE INDEX IF NOT EXISTS "partner_commissions_contract_id_idx" ON "partner_commissions"("contract_id");`,
            `CREATE INDEX IF NOT EXISTS "partner_commissions_status_idx" ON "partner_commissions"("status");`,
            `CREATE INDEX IF NOT EXISTS "partner_bonuses_partner_id_idx" ON "partner_bonuses"("partner_id");`,
            `CREATE INDEX IF NOT EXISTS "partner_bonuses_month_idx" ON "partner_bonuses"("month");`,
            `CREATE INDEX IF NOT EXISTS "partner_invites_partner_id_idx" ON "partner_invites"("partner_id");`,
            `CREATE INDEX IF NOT EXISTS "partner_invites_invited_email_idx" ON "partner_invites"("invited_email");`,
            `CREATE INDEX IF NOT EXISTS "partner_invites_invite_code_idx" ON "partner_invites"("invite_code");`,

            // ==========================================
            // 10. UNIQUE CONSTRAINTS (se não existirem)
            // ==========================================
            `CREATE UNIQUE INDEX IF NOT EXISTS "users_referral_code_key" ON "users"("referral_code");`,
            `CREATE UNIQUE INDEX IF NOT EXISTS "partner_invites_invite_code_key" ON "partner_invites"("invite_code");`,
            `CREATE UNIQUE INDEX IF NOT EXISTS "partner_bonuses_partner_id_month_key" ON "partner_bonuses"("partner_id", "month");`,

            // ==========================================
            // 11. AI_CHATBOT_CONFIG - Campos extras
            // ==========================================
            `ALTER TABLE "ai_chatbot_config" ADD COLUMN IF NOT EXISTS "welcome_message" TEXT DEFAULT '';`,
            `ALTER TABLE "ai_chatbot_config" ADD COLUMN IF NOT EXISTS "fallback_message" TEXT DEFAULT '';`,
            `ALTER TABLE "ai_chatbot_config" ADD COLUMN IF NOT EXISTS "working_hours_only" BOOLEAN DEFAULT false;`,
            `ALTER TABLE "ai_chatbot_config" ADD COLUMN IF NOT EXISTS "max_messages_per_chat" INTEGER DEFAULT 50;`,

            // ==========================================
            // 12. WHATSAPP_CONFIG - Tabela de configuração
            // ==========================================
            `CREATE TABLE IF NOT EXISTS "whatsapp_config" (
                "id" TEXT NOT NULL DEFAULT gen_random_uuid()::TEXT,
                "api_url" TEXT NOT NULL DEFAULT '',
                "api_key" TEXT NOT NULL DEFAULT '',
                "instance_name" TEXT NOT NULL DEFAULT '',
                "is_connected" BOOLEAN NOT NULL DEFAULT false,
                "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT "whatsapp_config_pkey" PRIMARY KEY ("id")
            );`,

            // ==========================================
            // 13. Verificação final
            // ==========================================
            `SELECT 'MIGRATION COMPLETE' AS result;`
        ];

        const results: Array<{ success: boolean; cmd: string; error?: string }> = [];
        let successCount = 0;
        let failCount = 0;

        for (const cmd of commands) {
            try {
                await prisma.$executeRawUnsafe(cmd);
                successCount++;
                results.push({ success: true, cmd: cmd.substring(0, 60) + '...' });
            } catch (err: any) {
                failCount++;
                results.push({ success: false, cmd: cmd.substring(0, 60) + '...', error: err.message?.substring(0, 120) });
            }
        }

        res.json({
            success: true,
            mode: 'hardcoded_v3_complete',
            summary: `${successCount} succeeded, ${failCount} failed out of ${commands.length} commands`,
            results
        });

    } catch (error: any) {
        console.error('Migration failed:', error);
        res.status(500).json({ error: 'Migration failed', details: error.message });
    }
});
