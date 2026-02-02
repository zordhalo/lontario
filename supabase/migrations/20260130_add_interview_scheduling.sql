-- Migration: Add interview scheduling fields to ai_interviews table
-- Date: 2026-01-30
-- Description: Adds columns to support scheduled AI interviews with email notifications

-- Add new columns to ai_interviews table
ALTER TABLE ai_interviews
ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS interview_link TEXT,
ADD COLUMN IF NOT EXISTS interview_duration_minutes INTEGER DEFAULT 30,
ADD COLUMN IF NOT EXISTS candidate_timezone TEXT,
ADD COLUMN IF NOT EXISTS custom_message TEXT;

-- Create index on scheduled_at for efficient querying of upcoming interviews
CREATE INDEX IF NOT EXISTS idx_ai_interviews_scheduled_at 
ON ai_interviews (scheduled_at) 
WHERE scheduled_at IS NOT NULL;

-- Create index on status and scheduled_at for cron job queries
CREATE INDEX IF NOT EXISTS idx_ai_interviews_status_scheduled 
ON ai_interviews (status, scheduled_at) 
WHERE scheduled_at IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN ai_interviews.scheduled_at IS 'When the interview is scheduled to take place';
COMMENT ON COLUMN ai_interviews.reminder_sent_at IS 'When the reminder email was sent';
COMMENT ON COLUMN ai_interviews.interview_link IS 'Unique public link for candidate to access interview';
COMMENT ON COLUMN ai_interviews.interview_duration_minutes IS 'Expected duration of the interview in minutes';
COMMENT ON COLUMN ai_interviews.candidate_timezone IS 'Timezone of the candidate for display purposes';
COMMENT ON COLUMN ai_interviews.custom_message IS 'Custom message from recruiter to include in invite';

-- Update the status check constraint to include new statuses
-- First drop the existing constraint if it exists
ALTER TABLE ai_interviews DROP CONSTRAINT IF EXISTS ai_interviews_status_check;

-- Add the updated constraint with new status values
ALTER TABLE ai_interviews ADD CONSTRAINT ai_interviews_status_check 
CHECK (status IN (
  'pending', 
  'scheduled', 
  'ready', 
  'sent', 
  'in_progress', 
  'completed', 
  'expired', 
  'abandoned', 
  'missed', 
  'cancelled'
));
