-- Migration: Remove profiles foreign key constraint for MVP development
-- Date: 2026-01-30
-- Description: Temporarily removes the foreign key constraint on profiles.id -> auth.users.id
--              to allow creating placeholder profiles without real Supabase Auth users.
--              This is for MVP/development purposes only. Re-enable for production.

-- Drop the foreign key constraint on profiles table
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;

-- Also drop the foreign key constraint on jobs.created_by if it references profiles
ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_created_by_fkey;

-- Make created_by nullable for MVP (allows jobs without authenticated users)
ALTER TABLE jobs ALTER COLUMN created_by DROP NOT NULL;

-- Add a comment to remind us this is temporary
COMMENT ON TABLE profiles IS 'User profiles - NOTE: FK constraint to auth.users temporarily disabled for MVP';
