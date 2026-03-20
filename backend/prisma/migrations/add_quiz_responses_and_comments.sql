-- Migration: Add quiz_responses and lesson_comments tables
-- Run: PGPASSWORD=tubarao123 psql -h localhost -U postgres -d tubarao_db -f this_file.sql

-- LessonComment table
CREATE TABLE IF NOT EXISTS "lesson_comments" (
  "id"         TEXT NOT NULL PRIMARY KEY,
  "lesson_id"  TEXT NOT NULL,
  "user_id"    TEXT NOT NULL,
  "content"    TEXT NOT NULL,
  "parent_id"  TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "lesson_comments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "lesson_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "lesson_comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "lesson_comments_lesson_id_idx" ON "lesson_comments"("lesson_id");
CREATE INDEX IF NOT EXISTS "lesson_comments_user_id_idx" ON "lesson_comments"("user_id");
CREATE INDEX IF NOT EXISTS "lesson_comments_parent_id_idx" ON "lesson_comments"("parent_id");

-- QuizResponse table
CREATE TABLE IF NOT EXISTS "quiz_responses" (
  "id"                              TEXT NOT NULL PRIMARY KEY,
  "user_id"                         TEXT NOT NULL,
  "course_id"                       TEXT NOT NULL,
  "nps_score"                       INTEGER NOT NULL,
  "would_recommend"                 TEXT NOT NULL,
  "what_caught_attention"           TEXT,
  "situation_before"                TEXT NOT NULL,
  "clarity_now"                     TEXT NOT NULL,
  "interest_motos"                  TEXT NOT NULL,
  "interest_credit"                 TEXT NOT NULL,
  "would_start_steps"               TEXT NOT NULL,
  "investment_amount"               TEXT NOT NULL,
  "interest_online_mentorship"      TEXT NOT NULL,
  "interest_presential_mentorship"  TEXT NOT NULL,
  "full_name"                       TEXT NOT NULL,
  "whatsapp"                        TEXT NOT NULL,
  "city"                            TEXT,
  "state"                           TEXT,
  "suggestions"                     TEXT,
  "lead_status"                     TEXT NOT NULL,
  "lead_score"                      INTEGER NOT NULL DEFAULT 0,
  "notified_admin"                  BOOLEAN NOT NULL DEFAULT false,
  "contacted_at"                    TIMESTAMP(3),
  "contacted_by"                    TEXT,
  "notes"                           TEXT,
  "created_at"                      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"                      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "quiz_responses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "quiz_responses_user_id_course_id_key" UNIQUE ("user_id", "course_id")
);

CREATE INDEX IF NOT EXISTS "quiz_responses_user_id_idx" ON "quiz_responses"("user_id");
CREATE INDEX IF NOT EXISTS "quiz_responses_course_id_idx" ON "quiz_responses"("course_id");
CREATE INDEX IF NOT EXISTS "quiz_responses_lead_status_idx" ON "quiz_responses"("lead_status");
CREATE INDEX IF NOT EXISTS "quiz_responses_lead_score_idx" ON "quiz_responses"("lead_score");
CREATE INDEX IF NOT EXISTS "quiz_responses_created_at_idx" ON "quiz_responses"("created_at");
