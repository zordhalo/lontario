-- ============================================================
-- Migration: Comprehensive RLS Policies for All Tables
-- Description: Creates Row Level Security policies for data
--              isolation and protection at the database level
-- Priority: CRITICAL - Required for data security compliance
-- ============================================================
--
-- ROLE PERMISSIONS SUMMARY:
-- -----------------------------------------------------------------
-- | Role            | Own Data | Org Data | Public Data | Admin |
-- |-----------------|----------|----------|-------------|-------|
-- | candidate       | ✓        | ✗        | View only   | ✗     |
-- | recruiter       | ✓        | ✓        | ✓           | ✗     |
-- | hiring_manager  | ✓        | ✓        | ✓           | ✗     |
-- | admin           | ✓        | ✓        | ✓           | ✓     |
-- -----------------------------------------------------------------
--
-- SECURITY PRINCIPLES:
-- 1. Deny by default (RLS enabled = no access without explicit policy)
-- 2. Least privilege access
-- 3. No data leakage between organizations
-- 4. Unauthenticated users can only see public data (published jobs)
-- ============================================================


-- ============================================================
-- PROFILES TABLE POLICIES
-- ============================================================
-- User profiles with role-based access. Access rules:
-- - Users can view and update their own profile
-- - Recruiters+ can view profiles in their organization
-- - Admins can manage all profiles in their org
--
-- IMPORTANT: These policies use SECURITY DEFINER helper functions 
-- to avoid infinite recursion when checking the current user's role.
-- Never directly query the profiles table within a profiles RLS policy!

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update profiles" ON profiles;
DROP POLICY IF EXISTS "Org members can view org profiles" ON profiles;
DROP POLICY IF EXISTS "Service role can insert profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can delete profiles" ON profiles;

-- SELECT: Users can view their own profile (no recursion - direct ID check)
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- SELECT: Admins can view all profiles
-- Uses SECURITY DEFINER function to avoid recursion
CREATE POLICY "Admins can view all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- SELECT: Recruiters and hiring managers can view profiles in their organization
-- Uses SECURITY DEFINER functions to safely check role and organization
CREATE POLICY "Org members can view org profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    public.is_recruiter_or_above()
    AND public.get_user_organization_id() IS NOT NULL
    AND public.get_user_organization_id() = organization_id
  );

-- UPDATE: Users can update their own profile (no recursion - direct ID check)
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- UPDATE: Admins can update any profile
-- Uses SECURITY DEFINER function to avoid recursion
CREATE POLICY "Admins can update profiles"
  ON profiles FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- INSERT: Allow profile creation (handled by trigger, service role)
CREATE POLICY "Service role can insert profiles"
  ON profiles FOR INSERT
  WITH CHECK (true);

-- DELETE: Only admins can delete profiles
-- Uses SECURITY DEFINER function to avoid recursion
CREATE POLICY "Admins can delete profiles"
  ON profiles FOR DELETE
  TO authenticated
  USING (public.is_admin());


-- ============================================================
-- JOBS TABLE POLICIES
-- ============================================================
-- Jobs are central to the hiring workflow. Access rules:
-- - Published jobs: Visible to everyone (including unauthenticated)
-- - Draft/paused/closed jobs: Visible only to org members
-- - Create/update/delete: Only recruiters+ in the organization

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Anyone can view published jobs" ON jobs;
DROP POLICY IF EXISTS "Authenticated users can view published jobs" ON jobs;
DROP POLICY IF EXISTS "Recruiters can view own org jobs" ON jobs;
DROP POLICY IF EXISTS "Org members can view all org jobs" ON jobs;
DROP POLICY IF EXISTS "Recruiters can create jobs" ON jobs;
DROP POLICY IF EXISTS "Recruiters can update own org jobs" ON jobs;
DROP POLICY IF EXISTS "Org members can update own jobs" ON jobs;
DROP POLICY IF EXISTS "Admins can delete jobs" ON jobs;
DROP POLICY IF EXISTS "Service role has full access to jobs" ON jobs;

-- SELECT: Anyone can view published (active) jobs
CREATE POLICY "Anyone can view published jobs"
  ON jobs FOR SELECT
  TO anon, authenticated
  USING (status = 'active' AND is_archived = false);

-- SELECT: Recruiters+ can view all jobs in their organization
CREATE POLICY "Org members can view all org jobs"
  ON jobs FOR SELECT
  TO authenticated
  USING (
    public.is_recruiter_or_above()
    AND public.user_owns_job(id)
  );

-- INSERT: Recruiters+ can create jobs
CREATE POLICY "Recruiters can create jobs"
  ON jobs FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_recruiter_or_above()
  );

-- UPDATE: Recruiters+ can update jobs in their organization
CREATE POLICY "Org members can update own jobs"
  ON jobs FOR UPDATE
  TO authenticated
  USING (
    public.is_recruiter_or_above()
    AND public.user_owns_job(id)
  )
  WITH CHECK (
    public.is_recruiter_or_above()
    AND public.user_owns_job(id)
  );

-- DELETE: Only admins can delete jobs (soft delete via is_archived preferred)
CREATE POLICY "Admins can delete jobs"
  ON jobs FOR DELETE
  TO authenticated
  USING (
    public.is_admin()
    AND public.user_owns_job(id)
  );


-- ============================================================
-- CANDIDATES TABLE POLICIES
-- ============================================================
-- Candidates are job applicants. Access rules:
-- - Candidates can only see their own applications (matched by email)
-- - Recruiters+ can see candidates for jobs in their organization
-- - Only recruiters+ can modify candidate data

-- Drop existing policies
DROP POLICY IF EXISTS "Candidates can view own applications" ON candidates;
DROP POLICY IF EXISTS "Recruiters can view org candidates" ON candidates;
DROP POLICY IF EXISTS "Recruiters can insert candidates" ON candidates;
DROP POLICY IF EXISTS "Anyone can apply to jobs" ON candidates;
DROP POLICY IF EXISTS "Recruiters can update org candidates" ON candidates;
DROP POLICY IF EXISTS "Admins can delete candidates" ON candidates;

-- SELECT: Authenticated users (as candidates) can view their own applications
-- Matched by email address
CREATE POLICY "Candidates can view own applications"
  ON candidates FOR SELECT
  TO authenticated
  USING (
    email = (SELECT email FROM profiles WHERE id = auth.uid())
  );

-- SELECT: Recruiters+ can view candidates for jobs in their organization
CREATE POLICY "Recruiters can view org candidates"
  ON candidates FOR SELECT
  TO authenticated
  USING (
    public.is_recruiter_or_above()
    AND public.user_owns_job(job_id)
  );

-- INSERT: Anyone can apply for jobs (public job applications)
-- Allows both authenticated users and anonymous visitors to apply
CREATE POLICY "Anyone can apply to jobs"
  ON candidates FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- UPDATE: Recruiters+ can update candidates in their organization
CREATE POLICY "Recruiters can update org candidates"
  ON candidates FOR UPDATE
  TO authenticated
  USING (
    public.is_recruiter_or_above()
    AND public.user_owns_job(job_id)
  )
  WITH CHECK (
    public.is_recruiter_or_above()
    AND public.user_owns_job(job_id)
  );

-- DELETE: Only admins can delete candidates (soft delete via is_archived preferred)
CREATE POLICY "Admins can delete candidates"
  ON candidates FOR DELETE
  TO authenticated
  USING (
    public.is_admin()
    AND public.user_owns_job(job_id)
  );


-- ============================================================
-- AI_INTERVIEWS TABLE POLICIES
-- ============================================================
-- AI Interviews belong to candidates and jobs. Access rules:
-- - Candidates can view/update their own interviews (via access_token)
-- - Recruiters+ can view/manage interviews for their org's jobs
-- - Hiring managers+ can create interviews

-- Drop existing policies
DROP POLICY IF EXISTS "Candidates can view own interviews" ON ai_interviews;
DROP POLICY IF EXISTS "Candidates can access via token" ON ai_interviews;
DROP POLICY IF EXISTS "Recruiters can view org interviews" ON ai_interviews;
DROP POLICY IF EXISTS "Hiring managers can create interviews" ON ai_interviews;
DROP POLICY IF EXISTS "Recruiters can create interviews" ON ai_interviews;
DROP POLICY IF EXISTS "Candidates can update own interviews" ON ai_interviews;
DROP POLICY IF EXISTS "Recruiters can update org interviews" ON ai_interviews;
DROP POLICY IF EXISTS "Admins can delete interviews" ON ai_interviews;

-- SELECT: Candidates can view their own interviews (matched by candidate email)
CREATE POLICY "Candidates can view own interviews"
  ON ai_interviews FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM candidates c
      JOIN profiles p ON p.email = c.email
      WHERE c.id = ai_interviews.candidate_id
      AND p.id = auth.uid()
    )
  );

-- SELECT: Allow access via valid access_token (for interview taking)
-- This is handled by the API endpoint, not RLS
-- Tokens are validated in the application layer

-- SELECT: Recruiters+ can view interviews for jobs in their organization
CREATE POLICY "Recruiters can view org interviews"
  ON ai_interviews FOR SELECT
  TO authenticated
  USING (
    public.is_recruiter_or_above()
    AND public.user_owns_job(job_id)
  );

-- INSERT: Recruiters+ can create interviews
CREATE POLICY "Recruiters can create interviews"
  ON ai_interviews FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_recruiter_or_above()
    AND public.user_owns_job(job_id)
  );

-- UPDATE: Candidates can update their own interviews (answering questions)
CREATE POLICY "Candidates can update own interviews"
  ON ai_interviews FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM candidates c
      JOIN profiles p ON p.email = c.email
      WHERE c.id = ai_interviews.candidate_id
      AND p.id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM candidates c
      JOIN profiles p ON p.email = c.email
      WHERE c.id = ai_interviews.candidate_id
      AND p.id = auth.uid()
    )
  );

-- UPDATE: Recruiters+ can update interviews in their organization
CREATE POLICY "Recruiters can update org interviews"
  ON ai_interviews FOR UPDATE
  TO authenticated
  USING (
    public.is_recruiter_or_above()
    AND public.user_owns_job(job_id)
  )
  WITH CHECK (
    public.is_recruiter_or_above()
    AND public.user_owns_job(job_id)
  );

-- DELETE: Only admins can delete interviews
CREATE POLICY "Admins can delete interviews"
  ON ai_interviews FOR DELETE
  TO authenticated
  USING (
    public.is_admin()
    AND public.user_owns_job(job_id)
  );


-- ============================================================
-- INTERVIEW_QUESTIONS TABLE POLICIES
-- ============================================================
-- Interview questions belong to interviews. Access inherited from interview.
-- - Candidates can view/answer questions for their interviews
-- - Recruiters+ can view questions for their org's interviews

-- Drop existing policies
DROP POLICY IF EXISTS "Candidates can view own interview questions" ON interview_questions;
DROP POLICY IF EXISTS "Candidates can update own answers" ON interview_questions;
DROP POLICY IF EXISTS "Candidates can submit answers" ON interview_questions;
DROP POLICY IF EXISTS "Recruiters can view org interview questions" ON interview_questions;
DROP POLICY IF EXISTS "Recruiters can manage interview questions" ON interview_questions;
DROP POLICY IF EXISTS "Recruiters can update org interview questions" ON interview_questions;
DROP POLICY IF EXISTS "Admins can delete interview questions" ON interview_questions;

-- SELECT: Candidates can view questions for their interviews
CREATE POLICY "Candidates can view own interview questions"
  ON interview_questions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM ai_interviews ai
      JOIN candidates c ON c.id = ai.candidate_id
      JOIN profiles p ON p.email = c.email
      WHERE ai.id = interview_questions.interview_id
      AND p.id = auth.uid()
    )
  );

-- SELECT: Recruiters+ can view questions for interviews in their organization
CREATE POLICY "Recruiters can view org interview questions"
  ON interview_questions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM ai_interviews ai
      WHERE ai.id = interview_questions.interview_id
      AND public.is_recruiter_or_above()
      AND public.user_owns_job(ai.job_id)
    )
  );

-- UPDATE: Candidates can submit answers to their questions
CREATE POLICY "Candidates can submit answers"
  ON interview_questions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM ai_interviews ai
      JOIN candidates c ON c.id = ai.candidate_id
      JOIN profiles p ON p.email = c.email
      WHERE ai.id = interview_questions.interview_id
      AND p.id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM ai_interviews ai
      JOIN candidates c ON c.id = ai.candidate_id
      JOIN profiles p ON p.email = c.email
      WHERE ai.id = interview_questions.interview_id
      AND p.id = auth.uid()
    )
  );

-- INSERT: Only system (service role) creates questions during interview generation
-- No direct INSERT policy for authenticated users

-- UPDATE: Recruiters can update questions (e.g., scoring)
CREATE POLICY "Recruiters can update org interview questions"
  ON interview_questions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM ai_interviews ai
      WHERE ai.id = interview_questions.interview_id
      AND public.is_recruiter_or_above()
      AND public.user_owns_job(ai.job_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM ai_interviews ai
      WHERE ai.id = interview_questions.interview_id
      AND public.is_recruiter_or_above()
      AND public.user_owns_job(ai.job_id)
    )
  );

-- DELETE: Admins only
CREATE POLICY "Admins can delete interview questions"
  ON interview_questions FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM ai_interviews ai
      WHERE ai.id = interview_questions.interview_id
      AND public.is_admin()
      AND public.user_owns_job(ai.job_id)
    )
  );


-- ============================================================
-- CANDIDATE_ACTIVITIES TABLE POLICIES
-- ============================================================
-- Activity logs track actions on candidates. Access rules:
-- - Recruiters+ can view activity for candidates in their org's jobs
-- - Only system/recruiters+ can create activity records
-- - Activity records are immutable (no update/delete)

-- Drop existing policies
DROP POLICY IF EXISTS "Recruiters can view org candidate activity" ON candidate_activities;
DROP POLICY IF EXISTS "Recruiters can log activity" ON candidate_activities;
DROP POLICY IF EXISTS "Admins can delete activity" ON candidate_activities;

-- SELECT: Recruiters+ can view activity for their org's candidates
CREATE POLICY "Recruiters can view org candidate activity"
  ON candidate_activities FOR SELECT
  TO authenticated
  USING (
    public.is_recruiter_or_above()
    AND public.user_can_access_candidate(candidate_id)
  );

-- INSERT: Recruiters+ can log activity
CREATE POLICY "Recruiters can log activity"
  ON candidate_activities FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_recruiter_or_above()
    AND public.user_can_access_candidate(candidate_id)
  );

-- DELETE: Admins only (for compliance/cleanup)
CREATE POLICY "Admins can delete activity"
  ON candidate_activities FOR DELETE
  TO authenticated
  USING (
    public.is_admin()
    AND public.user_can_access_candidate(candidate_id)
  );


-- ============================================================
-- CANDIDATE_COMMENTS TABLE POLICIES (Conditional - table may not exist)
-- ============================================================
-- Comments are notes from hiring team members. Access rules:
-- - Recruiters+ can view comments on their org's candidates
-- - Users can edit/delete their own comments
-- - Admins can manage all comments in their org

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'candidate_comments') THEN
    -- Drop existing policies
    DROP POLICY IF EXISTS "Recruiters can view org comments" ON candidate_comments;
    DROP POLICY IF EXISTS "Recruiters can create comments" ON candidate_comments;
    DROP POLICY IF EXISTS "Users can update own comments" ON candidate_comments;
    DROP POLICY IF EXISTS "Users can delete own comments" ON candidate_comments;
    DROP POLICY IF EXISTS "Admins can delete any org comment" ON candidate_comments;

    -- SELECT: Recruiters+ can view comments on their org's candidates
    CREATE POLICY "Recruiters can view org comments"
      ON candidate_comments FOR SELECT
      TO authenticated
      USING (
        public.is_recruiter_or_above()
        AND public.user_can_access_candidate(candidate_id)
      );

    -- INSERT: Recruiters+ can create comments
    CREATE POLICY "Recruiters can create comments"
      ON candidate_comments FOR INSERT
      TO authenticated
      WITH CHECK (
        public.is_recruiter_or_above()
        AND public.user_can_access_candidate(candidate_id)
        AND author_id = auth.uid()
      );

    -- UPDATE: Users can update their own comments
    CREATE POLICY "Users can update own comments"
      ON candidate_comments FOR UPDATE
      TO authenticated
      USING (
        author_id = auth.uid()
        AND public.user_can_access_candidate(candidate_id)
      )
      WITH CHECK (
        author_id = auth.uid()
        AND public.user_can_access_candidate(candidate_id)
      );

    -- DELETE: Users can delete their own comments
    CREATE POLICY "Users can delete own comments"
      ON candidate_comments FOR DELETE
      TO authenticated
      USING (
        author_id = auth.uid()
        AND public.user_can_access_candidate(candidate_id)
      );

    -- DELETE: Admins can delete any comment in their org
    CREATE POLICY "Admins can delete any org comment"
      ON candidate_comments FOR DELETE
      TO authenticated
      USING (
        public.is_admin()
        AND public.user_can_access_candidate(candidate_id)
      );

    RAISE NOTICE 'Created RLS policies for candidate_comments';
  ELSE
    RAISE NOTICE 'Table candidate_comments does not exist, skipping policies';
  END IF;
END $$;


-- ============================================================
-- PREGENERATED_QUESTIONS TABLE POLICIES (Conditional - table may not exist)
-- ============================================================
-- Pre-generated questions for instant interview scheduling. Access rules:
-- - Recruiters+ can view/manage for their org's candidates
-- - System creates these via background jobs

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'pregenerated_questions') THEN
    -- Drop existing policies
    DROP POLICY IF EXISTS "Recruiters can view org pregenerated questions" ON pregenerated_questions;
    DROP POLICY IF EXISTS "Recruiters can update pregenerated questions" ON pregenerated_questions;
    DROP POLICY IF EXISTS "Admins can delete pregenerated questions" ON pregenerated_questions;

    -- SELECT: Recruiters+ can view for their org's candidates
    CREATE POLICY "Recruiters can view org pregenerated questions"
      ON pregenerated_questions FOR SELECT
      TO authenticated
      USING (
        public.is_recruiter_or_above()
        AND public.user_owns_job(job_id)
      );

    -- UPDATE: Recruiters+ can update status (e.g., mark as used)
    CREATE POLICY "Recruiters can update pregenerated questions"
      ON pregenerated_questions FOR UPDATE
      TO authenticated
      USING (
        public.is_recruiter_or_above()
        AND public.user_owns_job(job_id)
      )
      WITH CHECK (
        public.is_recruiter_or_above()
        AND public.user_owns_job(job_id)
      );

    -- DELETE: Admins only
    CREATE POLICY "Admins can delete pregenerated questions"
      ON pregenerated_questions FOR DELETE
      TO authenticated
      USING (
        public.is_admin()
        AND public.user_owns_job(job_id)
      );

    RAISE NOTICE 'Created RLS policies for pregenerated_questions';
  ELSE
    RAISE NOTICE 'Table pregenerated_questions does not exist, skipping policies';
  END IF;
END $$;


-- ============================================================
-- NOTIFICATIONS TABLE POLICIES (Conditional - table may not exist)
-- ============================================================
-- Notifications are user-specific. Access rules:
-- - Users can only see and manage their own notifications

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notifications') THEN
    -- Drop existing policies
    DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
    DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
    DROP POLICY IF EXISTS "Users can delete own notifications" ON notifications;
    DROP POLICY IF EXISTS "System can create notifications" ON notifications;

    -- SELECT: Users can only view their own notifications
    CREATE POLICY "Users can view own notifications"
      ON notifications FOR SELECT
      TO authenticated
      USING (user_id = auth.uid());

    -- INSERT: System creates notifications (service role)
    -- Allow authenticated users to create notifications for themselves
    CREATE POLICY "System can create notifications"
      ON notifications FOR INSERT
      TO authenticated
      WITH CHECK (user_id = auth.uid() OR public.is_admin());

    -- UPDATE: Users can update their own notifications (mark as read)
    CREATE POLICY "Users can update own notifications"
      ON notifications FOR UPDATE
      TO authenticated
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());

    -- DELETE: Users can delete their own notifications
    CREATE POLICY "Users can delete own notifications"
      ON notifications FOR DELETE
      TO authenticated
      USING (user_id = auth.uid());

    RAISE NOTICE 'Created RLS policies for notifications';
  ELSE
    RAISE NOTICE 'Table notifications does not exist, skipping policies';
  END IF;
END $$;


-- ============================================================
-- DOCUMENTATION
-- ============================================================

COMMENT ON POLICY "Anyone can view published jobs" ON jobs IS
'Public access to active, non-archived job postings';

COMMENT ON POLICY "Org members can view all org jobs" ON jobs IS
'Recruiters, hiring managers, and admins can view all jobs in their organization';

COMMENT ON POLICY "Candidates can view own applications" ON candidates IS
'Users can see applications they submitted (matched by email)';

COMMENT ON POLICY "Recruiters can view org candidates" ON candidates IS
'Recruiters+ can view candidates for jobs in their organization';

COMMENT ON POLICY "Candidates can view own interviews" ON ai_interviews IS
'Users can see interviews for applications they submitted';

-- Conditional comments for tables that may not exist
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notifications') THEN
    COMMENT ON POLICY "Users can view own notifications" ON notifications IS
    'Users can only access their own notifications';
  END IF;
END $$;
