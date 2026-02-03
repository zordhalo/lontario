-- ============================================================
-- Migration: Enable Row Level Security on All Tables
-- Description: Enables RLS on all tables and creates helper
--              functions for permission checks
-- Priority: CRITICAL - Required for data security compliance
-- ============================================================

-- ============================================================
-- STEP 0: Ensure user_role enum has all required values
-- Note: ALTER TYPE ADD VALUE cannot run inside a transaction/DO block
-- ============================================================
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'hiring_manager';

-- ============================================================
-- STEP 0.5: Ensure profiles table has organization_id column
-- ============================================================
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS organization_id UUID;

-- ============================================================
-- STEP 1: Enable RLS on all tables
-- By default, RLS is disabled, which means all rows are visible
-- Enabling RLS with no policies means NO rows are visible (deny by default)
-- ============================================================

-- Core entity tables (these should exist)
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_interviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE interview_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidate_activities ENABLE ROW LEVEL SECURITY;

-- Enable RLS on tables that may not exist yet (conditional)
DO $$
BEGIN
  -- pregenerated_questions table (created by 20260130_add_pregenerated_questions.sql)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'pregenerated_questions') THEN
    ALTER TABLE pregenerated_questions ENABLE ROW LEVEL SECURITY;
    RAISE NOTICE 'RLS enabled on pregenerated_questions';
  ELSE
    RAISE NOTICE 'Table pregenerated_questions does not exist, skipping RLS';
  END IF;

  -- candidate_comments table
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'candidate_comments') THEN
    ALTER TABLE candidate_comments ENABLE ROW LEVEL SECURITY;
    RAISE NOTICE 'RLS enabled on candidate_comments';
  ELSE
    RAISE NOTICE 'Table candidate_comments does not exist, skipping RLS';
  END IF;

  -- notifications table
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'notifications') THEN
    ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
    RAISE NOTICE 'RLS enabled on notifications';
  ELSE
    RAISE NOTICE 'Table notifications does not exist, skipping RLS';
  END IF;
END $$;

-- ============================================================
-- STEP 2: Create Helper Functions for Permission Checks
-- These functions run with SECURITY DEFINER to bypass RLS
-- when checking permissions
-- ============================================================

-- Function to get the current user's organization_id
CREATE OR REPLACE FUNCTION public.get_user_organization_id()
RETURNS UUID AS $$
DECLARE
  org_id UUID;
BEGIN
  SELECT organization_id INTO org_id
  FROM profiles
  WHERE id = auth.uid();

  RETURN org_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Function to check if current user is in the same organization as a job
CREATE OR REPLACE FUNCTION public.user_owns_job(job_id_param UUID)
RETURNS BOOLEAN AS $$
DECLARE
  user_org_id UUID;
  job_created_by UUID;
  job_creator_org_id UUID;
BEGIN
  -- Get current user's organization
  SELECT organization_id INTO user_org_id
  FROM profiles
  WHERE id = auth.uid();

  -- Get job creator's info
  SELECT created_by INTO job_created_by FROM jobs WHERE id = job_id_param;

  -- If job has a creator, check their org
  IF job_created_by IS NOT NULL THEN
    SELECT organization_id INTO job_creator_org_id
    FROM profiles
    WHERE id = job_created_by;

    -- Check if same organization
    IF user_org_id IS NOT NULL AND job_creator_org_id IS NOT NULL THEN
      RETURN user_org_id = job_creator_org_id;
    END IF;

    -- If orgs not set, check if user is the creator
    RETURN auth.uid() = job_created_by;
  END IF;

  -- Job has no creator (MVP mode) - allow if user has proper role
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('recruiter', 'hiring_manager', 'admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Function to check if user can access a candidate
-- (candidate belongs to a job the user has access to)
CREATE OR REPLACE FUNCTION public.user_can_access_candidate(candidate_id_param UUID)
RETURNS BOOLEAN AS $$
DECLARE
  candidate_job_id UUID;
BEGIN
  SELECT job_id INTO candidate_job_id
  FROM candidates
  WHERE id = candidate_id_param;

  RETURN public.user_owns_job(candidate_job_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Function to check if user can access an interview
CREATE OR REPLACE FUNCTION public.user_can_access_interview(interview_id_param UUID)
RETURNS BOOLEAN AS $$
DECLARE
  interview_job_id UUID;
BEGIN
  SELECT job_id INTO interview_job_id
  FROM ai_interviews
  WHERE id = interview_id_param;

  RETURN public.user_owns_job(interview_job_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Function to check if current user has any of the specified roles
-- Improved version with array parameter
CREATE OR REPLACE FUNCTION public.has_any_role(required_roles text[])
RETURNS BOOLEAN AS $$
DECLARE
  user_role_value user_role;
BEGIN
  SELECT role INTO user_role_value
  FROM profiles
  WHERE id = auth.uid();

  RETURN user_role_value::text = ANY(required_roles);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Function to check if a user is an admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Function to check if user is a recruiter or higher
CREATE OR REPLACE FUNCTION public.is_recruiter_or_above()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('recruiter', 'hiring_manager', 'admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Function to check if user is a hiring manager or admin
CREATE OR REPLACE FUNCTION public.is_hiring_manager_or_above()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('hiring_manager', 'admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================================
-- STEP 3: Grant execute permissions on helper functions
-- These need to be accessible to authenticated users
-- ============================================================

GRANT EXECUTE ON FUNCTION public.get_user_organization_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_owns_job(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_can_access_candidate(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_can_access_interview(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_any_role(text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_recruiter_or_above() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_hiring_manager_or_above() TO authenticated;

-- ============================================================
-- COMMENTS for documentation
-- ============================================================

COMMENT ON FUNCTION public.get_user_organization_id() IS
'Returns the organization_id of the currently authenticated user';

COMMENT ON FUNCTION public.user_owns_job(UUID) IS
'Checks if the current user has access to a specific job (same org or creator)';

COMMENT ON FUNCTION public.user_can_access_candidate(UUID) IS
'Checks if the current user can access a candidate (via job ownership)';

COMMENT ON FUNCTION public.user_can_access_interview(UUID) IS
'Checks if the current user can access an interview (via job ownership)';

COMMENT ON FUNCTION public.is_admin() IS
'Returns true if the current user has the admin role';

COMMENT ON FUNCTION public.is_recruiter_or_above() IS
'Returns true if the current user is recruiter, hiring_manager, or admin';

COMMENT ON FUNCTION public.is_hiring_manager_or_above() IS
'Returns true if the current user is hiring_manager or admin';
