-- Migration: Add WhatsAppAutomation, QuizQuestion, ScoringRule tables
-- Run: psql $DATABASE_URL -f this_file.sql

CREATE TABLE IF NOT EXISTS "whatsapp_automations" (
  "id"           TEXT NOT NULL PRIMARY KEY,
  "lead_id"      TEXT,
  "lead_status"  TEXT NOT NULL,
  "client_name"  TEXT NOT NULL,
  "phone"        TEXT NOT NULL,
  "message_text" TEXT NOT NULL,
  "status"       TEXT NOT NULL DEFAULT 'PENDING',
  "message_id"   TEXT,
  "error"        TEXT,
  "sent_at"      TIMESTAMP(3),
  "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "whatsapp_automations_lead_id_idx"     ON "whatsapp_automations"("lead_id");
CREATE INDEX IF NOT EXISTS "whatsapp_automations_status_idx"      ON "whatsapp_automations"("status");
CREATE INDEX IF NOT EXISTS "whatsapp_automations_lead_status_idx" ON "whatsapp_automations"("lead_status");
CREATE INDEX IF NOT EXISTS "whatsapp_automations_created_at_idx"  ON "whatsapp_automations"("created_at");

CREATE TABLE IF NOT EXISTS "quiz_questions" (
  "id"         TEXT NOT NULL PRIMARY KEY,
  "step"       INTEGER NOT NULL,
  "question"   TEXT NOT NULL,
  "type"       TEXT NOT NULL,
  "options"    JSONB NOT NULL DEFAULT '[]',
  "weight"     INTEGER NOT NULL DEFAULT 10,
  "category"   TEXT NOT NULL DEFAULT 'experience',
  "order"      INTEGER NOT NULL DEFAULT 0,
  "active"     BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "quiz_questions_step_idx" ON "quiz_questions"("step");

CREATE TABLE IF NOT EXISTS "scoring_rules" (
  "id"          TEXT NOT NULL PRIMARY KEY,
  "condition"   TEXT NOT NULL,
  "points"      INTEGER NOT NULL,
  "description" TEXT NOT NULL,
  "active"      BOOLEAN NOT NULL DEFAULT true,
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
