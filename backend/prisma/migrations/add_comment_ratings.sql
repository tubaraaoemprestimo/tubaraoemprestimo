-- Migration: Add rating and priority fields to lesson_comments
-- Run: PGPASSWORD=tubarao123 psql -h localhost -U postgres -d tubarao_db -f this_file.sql

-- Add rating fields
ALTER TABLE lesson_comments ADD COLUMN IF NOT EXISTS rating INTEGER DEFAULT 0;
ALTER TABLE lesson_comments ADD COLUMN IF NOT EXISTS rating_count INTEGER DEFAULT 0;
ALTER TABLE lesson_comments ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 0;
ALTER TABLE lesson_comments ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT false;
ALTER TABLE lesson_comments ADD COLUMN IF NOT EXISTS admin_notes TEXT;

-- Create comment_ratings table for tracking who rated what
CREATE TABLE IF NOT EXISTS "comment_ratings" (
  "id"         TEXT NOT NULL PRIMARY KEY,
  "comment_id" TEXT NOT NULL,
  "user_id"    TEXT NOT NULL,
  "rating"     INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "comment_ratings_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "lesson_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "comment_ratings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "comment_ratings_comment_id_user_id_key" UNIQUE ("comment_id", "user_id")
);

CREATE INDEX IF NOT EXISTS "comment_ratings_comment_id_idx" ON "comment_ratings"("comment_id");
CREATE INDEX IF NOT EXISTS "comment_ratings_user_id_idx" ON "comment_ratings"("user_id");
CREATE INDEX IF NOT EXISTS "lesson_comments_rating_idx" ON "lesson_comments"("rating");
CREATE INDEX IF NOT EXISTS "lesson_comments_priority_idx" ON "lesson_comments"("priority");
CREATE INDEX IF NOT EXISTS "lesson_comments_is_pinned_idx" ON "lesson_comments"("is_pinned");
