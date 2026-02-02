-- Migration: Add review tracking fields to ai_interviews table
-- Date: 2026-01-30
-- Description: Adds columns to track when interview summaries have been reviewed by recruiters

-- Add new columns to ai_interviews table
ALTER TABLE ai_interviews
ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS reviewed_by UUID;

-- Create index on reviewed_at for efficient querying of unreviewed interviews
CREATE INDEX IF NOT EXISTS idx_ai_interviews_reviewed_at 
ON ai_interviews (reviewed_at) 
WHERE reviewed_at IS NULL;

-- Create composite index for dashboard alerts query (completed but not reviewed)
CREATE INDEX IF NOT EXISTS idx_ai_interviews_status_reviewed 
ON ai_interviews (status, reviewed_at) 
WHERE status = 'completed' AND reviewed_at IS NULL;

-- Add comments for documentation
COMMENT ON COLUMN ai_interviews.reviewed_at IS 'When the interview summary was reviewed by a recruiter';
COMMENT ON COLUMN ai_interviews.reviewed_by IS 'UUID of the user who reviewed the interview (for future auth integration)';
