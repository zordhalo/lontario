-- Add is_archived column to jobs table
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE NOT NULL;

-- Create index for efficient filtering of non-archived jobs
CREATE INDEX IF NOT EXISTS idx_jobs_is_archived ON jobs(is_archived);

-- Create composite index for common query pattern (status + archived)
CREATE INDEX IF NOT EXISTS idx_jobs_status_archived ON jobs(status, is_archived);
