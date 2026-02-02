-- Pre-generated interview questions table
-- Questions are generated when a candidate is added to a job, so scheduling is instant

CREATE TABLE IF NOT EXISTS pregenerated_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  
  -- Question data (stored as JSON array)
  questions JSONB NOT NULL DEFAULT '[]',
  total_questions INTEGER NOT NULL DEFAULT 0,
  total_estimated_time INTEGER NOT NULL DEFAULT 0, -- in minutes
  
  -- Generation status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'generating', 'ready', 'failed', 'used')),
  error_message TEXT,
  
  -- Metadata
  model_used TEXT DEFAULT 'gpt-4o-2024-08-06',
  generated_at TIMESTAMPTZ,
  used_at TIMESTAMPTZ, -- When questions were used for an interview
  used_in_interview_id UUID REFERENCES ai_interviews(id) ON DELETE SET NULL,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Ensure one set of questions per candidate-job pair
  UNIQUE(candidate_id, job_id)
);

-- Add question_generation_status to candidates table for quick status checks
ALTER TABLE candidates 
ADD COLUMN IF NOT EXISTS question_generation_status TEXT DEFAULT 'none'
CHECK (question_generation_status IN ('none', 'pending', 'generating', 'ready', 'failed'));

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_pregenerated_questions_candidate_job 
ON pregenerated_questions(candidate_id, job_id);

CREATE INDEX IF NOT EXISTS idx_pregenerated_questions_status 
ON pregenerated_questions(status);

CREATE INDEX IF NOT EXISTS idx_candidates_question_generation_status 
ON candidates(question_generation_status) 
WHERE question_generation_status != 'none';

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION update_pregenerated_questions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER pregenerated_questions_updated_at
  BEFORE UPDATE ON pregenerated_questions
  FOR EACH ROW
  EXECUTE FUNCTION update_pregenerated_questions_updated_at();

-- Comment for documentation
COMMENT ON TABLE pregenerated_questions IS 'Stores pre-generated interview questions for candidates to make scheduling instant';
COMMENT ON COLUMN pregenerated_questions.status IS 'pending=waiting, generating=AI working, ready=can be used, failed=error, used=already used';
