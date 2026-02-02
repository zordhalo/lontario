-- Add avatar_url column to candidates table for storing GitHub profile pictures
-- This column stores the URL to the candidate's GitHub avatar when fetched from their profile

ALTER TABLE candidates
ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Add comment for documentation
COMMENT ON COLUMN candidates.avatar_url IS 'URL to candidate profile picture (typically from GitHub)';
