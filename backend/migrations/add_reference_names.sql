-- Migration: Add reference name fields to loan_requests table
-- Date: 2026-03-17
-- Description: Adds reference1_name, reference1_phone, reference2_name, reference2_phone fields

ALTER TABLE loan_requests
ADD COLUMN IF NOT EXISTS reference1_name TEXT,
ADD COLUMN IF NOT EXISTS reference1_phone TEXT,
ADD COLUMN IF NOT EXISTS reference2_name TEXT,
ADD COLUMN IF NOT EXISTS reference2_phone TEXT;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_loan_requests_references ON loan_requests(reference1_phone, reference2_phone);
