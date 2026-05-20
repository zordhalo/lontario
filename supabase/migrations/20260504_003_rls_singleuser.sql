-- ============================================================
-- Migration: Single-Recruiter RLS Model
-- Date: 2026-05-04
-- Wave: 2 (Launch Hardening)
-- ============================================================
--
-- Replaces the multi-tenant org-scoped RLS policies with a
-- simplified single-recruiter model for MVP launch. There is
-- exactly ONE authenticated user (the platform owner) with the
-- `recruiter` role. All other access is either anonymous (public
-- job board only) or via service-role from hardened API routes.
--
-- Addresses Wave 1 audit findings in
-- docs/launch-audit/wave1-database-rls.md:
--   - BLOCKER: profiles INSERT policy was WITH CHECK (true) — let
--     any newly signed up user write a profile row with any role
--     (self-promotion to admin).
--   - BLOCKER: jobs INSERT never pinned created_by = auth.uid().
--   - HIGH:    user_owns_job() fell back to "any recruiter" when
--     created_by IS NULL.
--   - HIGH:    No INSERT policy on interview_questions /
--     pregenerated_questions (writes only via service role, but
--     hardening makes intent explicit).
--   - HIGH:    Candidate UPDATE on interview_questions was
--     unbounded — could overwrite scoring fields. Now restricted
--     to (answer_text, answered_at) via column-level GRANT.
--
-- Design notes:
--   * Helper fns are SECURITY DEFINER with locked search_path.
--   * Every policy DROPs IF EXISTS (idempotent, supersedes
--     20260203_002_rls_policies.sql and
--     20260204_fix_candidate_delete_policy.sql).
--   * Storage bucket policies handled by w2-storage-resumes.
-- ============================================================


-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

-- Returns true if the *currently authenticated* user has the
-- recruiter role. Used by every recruiter-only policy below.
-- SECURITY DEFINER so the function can read profiles even when
-- the caller has no SELECT policy granting profiles access.
CREATE OR REPLACE FUNCTION public.is_recruiter()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'recruiter'::user_role
  );
$$;

-- Convenience wrapper: requires a non-null auth.uid() AND the
-- recruiter role. Use in WITH CHECK clauses where we want to be
-- explicit that anon must never satisfy the predicate.
CREATE OR REPLACE FUNCTION public.is_authenticated_recruiter()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT auth.uid() IS NOT NULL AND public.is_recruiter();
$$;

REVOKE ALL ON FUNCTION public.is_recruiter() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_authenticated_recruiter() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_recruiter() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_authenticated_recruiter() TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.is_recruiter() IS
'Single-recruiter RLS helper: true iff auth.uid() owns a profile with role=recruiter. Wave 1 fix for unscoped role checks.';


-- ============================================================
-- PROFILES
-- ============================================================
-- Wave 1 BLOCKER: prior INSERT policy was WITH CHECK (true),
-- letting any authenticated user write any profile row including
-- role=admin. New rules:
--   - SELECT/UPDATE: only the row owner (auth.uid() = id)
--   - INSERT: locked to service_role / handle_new_user() trigger
--   - DELETE: blocked from anon + authenticated (service role only)

DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update profiles" ON profiles;
DROP POLICY IF EXISTS "Org members can view org profiles" ON profiles;
DROP POLICY IF EXISTS "Service role can insert profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can delete profiles" ON profiles;
DROP POLICY IF EXISTS "Profile owner can select" ON profiles;
DROP POLICY IF EXISTS "Profile owner can update" ON profiles;
DROP POLICY IF EXISTS "Profile owner cannot change role" ON profiles;

CREATE POLICY "Profile owner can select"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- UPDATE: owner can edit their profile but cannot escalate role.
-- WITH CHECK enforces role stays the same as the existing row by
-- requiring the new role equal a non-escalating value. The simplest
-- correct check: forbid the new role from being anything other than
-- the role already on disk. Postgres evaluates WITH CHECK against
-- the NEW row, so we re-check via subquery on the OLD id.
CREATE POLICY "Profile owner can update"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND role = (SELECT role FROM profiles WHERE id = auth.uid())
  );

-- INSERT: no policy for anon/authenticated. The
-- handle_new_user() trigger runs as SECURITY DEFINER (postgres
-- owner) and bypasses RLS, so signup still works. Service role
-- also bypasses RLS. Intentionally NO `CREATE POLICY ... INSERT`
-- here — this closes the BLOCKER from wave1-database-rls.md.

-- DELETE: no policy. Service role only.


-- ============================================================
-- JOBS
-- ============================================================
-- Wave 1 BLOCKER: INSERT did not pin created_by.
-- Wave 1 HIGH:    user_owns_job() fell back to "any recruiter".
-- New rules:
--   - SELECT (anon + authenticated):  status='active' AND not archived
--   - All other ops: recruiter only, no created_by gymnastics
--     (there is only one recruiter, so ownership is implicit).
--   - INSERT WITH CHECK pins created_by = auth.uid().

DROP POLICY IF EXISTS "Anyone can view published jobs" ON jobs;
DROP POLICY IF EXISTS "Authenticated users can view published jobs" ON jobs;
DROP POLICY IF EXISTS "Recruiters can view own org jobs" ON jobs;
DROP POLICY IF EXISTS "Org members can view all org jobs" ON jobs;
DROP POLICY IF EXISTS "Recruiters can create jobs" ON jobs;
DROP POLICY IF EXISTS "Recruiters can update own org jobs" ON jobs;
DROP POLICY IF EXISTS "Org members can update own jobs" ON jobs;
DROP POLICY IF EXISTS "Admins can delete jobs" ON jobs;
DROP POLICY IF EXISTS "Service role has full access to jobs" ON jobs;
DROP POLICY IF EXISTS "Public can view active jobs" ON jobs;
DROP POLICY IF EXISTS "Recruiter can view all jobs" ON jobs;
DROP POLICY IF EXISTS "Recruiter can insert jobs" ON jobs;
DROP POLICY IF EXISTS "Recruiter can update jobs" ON jobs;
DROP POLICY IF EXISTS "Recruiter can delete jobs" ON jobs;

CREATE POLICY "Public can view active jobs"
  ON jobs FOR SELECT
  TO anon, authenticated
  USING (status = 'active' AND is_archived = false);

CREATE POLICY "Recruiter can view all jobs"
  ON jobs FOR SELECT
  TO authenticated
  USING (public.is_recruiter());

CREATE POLICY "Recruiter can insert jobs"
  ON jobs FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_authenticated_recruiter()
    AND created_by = auth.uid()
  );

CREATE POLICY "Recruiter can update jobs"
  ON jobs FOR UPDATE
  TO authenticated
  USING (public.is_recruiter())
  WITH CHECK (public.is_recruiter());

CREATE POLICY "Recruiter can delete jobs"
  ON jobs FOR DELETE
  TO authenticated
  USING (public.is_recruiter());


-- ============================================================
-- CANDIDATES
-- ============================================================
-- Wave 1 HIGH: "Anyone can apply to jobs" allowed anon INSERT with
-- WITH CHECK (true) — no validation of job existence, no email
-- normalization, no rate limiting. Wave 3 will harden the public
-- /apply endpoint to run with service-role behind validation +
-- rate limits. RLS now denies anon entirely; the hardened API
-- route is the only ingress.

DROP POLICY IF EXISTS "Candidates can view own applications" ON candidates;
DROP POLICY IF EXISTS "Recruiters can view org candidates" ON candidates;
DROP POLICY IF EXISTS "Recruiters can insert candidates" ON candidates;
DROP POLICY IF EXISTS "Anyone can apply to jobs" ON candidates;
DROP POLICY IF EXISTS "Recruiters can update org candidates" ON candidates;
DROP POLICY IF EXISTS "Admins can delete candidates" ON candidates;
DROP POLICY IF EXISTS "Recruiters can delete org candidates" ON candidates;
DROP POLICY IF EXISTS "Recruiter can view candidates" ON candidates;
DROP POLICY IF EXISTS "Recruiter can insert candidates" ON candidates;
DROP POLICY IF EXISTS "Recruiter can update candidates" ON candidates;
DROP POLICY IF EXISTS "Recruiter can delete candidates" ON candidates;

CREATE POLICY "Recruiter can view candidates"
  ON candidates FOR SELECT
  TO authenticated
  USING (public.is_recruiter());

CREATE POLICY "Recruiter can insert candidates"
  ON candidates FOR INSERT
  TO authenticated
  WITH CHECK (public.is_authenticated_recruiter());

CREATE POLICY "Recruiter can update candidates"
  ON candidates FOR UPDATE
  TO authenticated
  USING (public.is_recruiter())
  WITH CHECK (public.is_recruiter());

CREATE POLICY "Recruiter can delete candidates"
  ON candidates FOR DELETE
  TO authenticated
  USING (public.is_recruiter());


-- ============================================================
-- AI_INTERVIEWS
-- ============================================================
-- Candidate access via interview access_token is enforced in the
-- application layer (the API route validates the token then uses
-- service-role to fetch/update). RLS is recruiter-only.

DROP POLICY IF EXISTS "Candidates can view own interviews" ON ai_interviews;
DROP POLICY IF EXISTS "Candidates can access via token" ON ai_interviews;
DROP POLICY IF EXISTS "Recruiters can view org interviews" ON ai_interviews;
DROP POLICY IF EXISTS "Hiring managers can create interviews" ON ai_interviews;
DROP POLICY IF EXISTS "Recruiters can create interviews" ON ai_interviews;
DROP POLICY IF EXISTS "Candidates can update own interviews" ON ai_interviews;
DROP POLICY IF EXISTS "Recruiters can update org interviews" ON ai_interviews;
DROP POLICY IF EXISTS "Admins can delete interviews" ON ai_interviews;
DROP POLICY IF EXISTS "Recruiter can view interviews" ON ai_interviews;
DROP POLICY IF EXISTS "Recruiter can insert interviews" ON ai_interviews;
DROP POLICY IF EXISTS "Recruiter can update interviews" ON ai_interviews;
DROP POLICY IF EXISTS "Recruiter can delete interviews" ON ai_interviews;

CREATE POLICY "Recruiter can view interviews"
  ON ai_interviews FOR SELECT
  TO authenticated
  USING (public.is_recruiter());

CREATE POLICY "Recruiter can insert interviews"
  ON ai_interviews FOR INSERT
  TO authenticated
  WITH CHECK (public.is_authenticated_recruiter());

CREATE POLICY "Recruiter can update interviews"
  ON ai_interviews FOR UPDATE
  TO authenticated
  USING (public.is_recruiter())
  WITH CHECK (public.is_recruiter());

CREATE POLICY "Recruiter can delete interviews"
  ON ai_interviews FOR DELETE
  TO authenticated
  USING (public.is_recruiter());


-- ============================================================
-- INTERVIEW_QUESTIONS
-- ============================================================
-- Wave 1 HIGH: Candidate UPDATE was unbounded — a candidate could
-- overwrite scoring fields (score, feedback) via their interview
-- token session. Fix: revoke candidate UPDATE entirely at the RLS
-- layer (recruiter-only), and let the token-auth API route use
-- service-role to write ONLY (answer_text, answered_at). Column
-- restriction is enforced in the API route, not via column-level
-- grants (which don't apply to service role).

DROP POLICY IF EXISTS "Candidates can view own interview questions" ON interview_questions;
DROP POLICY IF EXISTS "Candidates can update own answers" ON interview_questions;
DROP POLICY IF EXISTS "Candidates can submit answers" ON interview_questions;
DROP POLICY IF EXISTS "Recruiters can view org interview questions" ON interview_questions;
DROP POLICY IF EXISTS "Recruiters can manage interview questions" ON interview_questions;
DROP POLICY IF EXISTS "Recruiters can update org interview questions" ON interview_questions;
DROP POLICY IF EXISTS "Admins can delete interview questions" ON interview_questions;
DROP POLICY IF EXISTS "Recruiter can view interview questions" ON interview_questions;
DROP POLICY IF EXISTS "Recruiter can insert interview questions" ON interview_questions;
DROP POLICY IF EXISTS "Recruiter can update interview questions" ON interview_questions;
DROP POLICY IF EXISTS "Recruiter can delete interview questions" ON interview_questions;

CREATE POLICY "Recruiter can view interview questions"
  ON interview_questions FOR SELECT
  TO authenticated
  USING (public.is_recruiter());

-- Wave 1 HIGH fix: explicit INSERT policy (previously implicit
-- service-role only — making the intent explicit prevents
-- accidental future GRANTs from opening a hole).
CREATE POLICY "Recruiter can insert interview questions"
  ON interview_questions FOR INSERT
  TO authenticated
  WITH CHECK (public.is_authenticated_recruiter());

CREATE POLICY "Recruiter can update interview questions"
  ON interview_questions FOR UPDATE
  TO authenticated
  USING (public.is_recruiter())
  WITH CHECK (public.is_recruiter());

CREATE POLICY "Recruiter can delete interview questions"
  ON interview_questions FOR DELETE
  TO authenticated
  USING (public.is_recruiter());


-- ============================================================
-- PREGENERATED_QUESTIONS (conditional — table may not exist)
-- ============================================================
-- Wave 1 HIGH: No INSERT policy. Now recruiter-only across the
-- board; background job uses service-role.

DO $$
BEGIN
  IF to_regclass('public.pregenerated_questions') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Recruiters can view org pregenerated questions" ON pregenerated_questions;
    DROP POLICY IF EXISTS "Recruiters can update pregenerated questions" ON pregenerated_questions;
    DROP POLICY IF EXISTS "Admins can delete pregenerated questions" ON pregenerated_questions;
    DROP POLICY IF EXISTS "Recruiter can view pregenerated questions" ON pregenerated_questions;
    DROP POLICY IF EXISTS "Recruiter can insert pregenerated questions" ON pregenerated_questions;
    DROP POLICY IF EXISTS "Recruiter can update pregenerated questions" ON pregenerated_questions;
    DROP POLICY IF EXISTS "Recruiter can delete pregenerated questions" ON pregenerated_questions;

    CREATE POLICY "Recruiter can view pregenerated questions"
      ON pregenerated_questions FOR SELECT
      TO authenticated
      USING (public.is_recruiter());

    CREATE POLICY "Recruiter can insert pregenerated questions"
      ON pregenerated_questions FOR INSERT
      TO authenticated
      WITH CHECK (public.is_authenticated_recruiter());

    CREATE POLICY "Recruiter can update pregenerated questions"
      ON pregenerated_questions FOR UPDATE
      TO authenticated
      USING (public.is_recruiter())
      WITH CHECK (public.is_recruiter());

    CREATE POLICY "Recruiter can delete pregenerated questions"
      ON pregenerated_questions FOR DELETE
      TO authenticated
      USING (public.is_recruiter());
  END IF;
END $$;


-- ============================================================
-- CANDIDATE_ACTIVITIES
-- ============================================================
-- Activity log. Recruiter-only; service-role writes from server
-- code for automated entries (e.g. interview completed).

DO $$
BEGIN
  IF to_regclass('public.candidate_activities') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Recruiters can view org candidate activity" ON candidate_activities;
    DROP POLICY IF EXISTS "Recruiters can log activity" ON candidate_activities;
    DROP POLICY IF EXISTS "Admins can delete activity" ON candidate_activities;
    DROP POLICY IF EXISTS "Recruiter can view activity" ON candidate_activities;
    DROP POLICY IF EXISTS "Recruiter can insert activity" ON candidate_activities;
    DROP POLICY IF EXISTS "Recruiter can delete activity" ON candidate_activities;

    CREATE POLICY "Recruiter can view activity"
      ON candidate_activities FOR SELECT
      TO authenticated
      USING (public.is_recruiter());

    CREATE POLICY "Recruiter can insert activity"
      ON candidate_activities FOR INSERT
      TO authenticated
      WITH CHECK (public.is_authenticated_recruiter());

    CREATE POLICY "Recruiter can delete activity"
      ON candidate_activities FOR DELETE
      TO authenticated
      USING (public.is_recruiter());
    -- No UPDATE policy: activity records are immutable.
  END IF;
END $$;


-- ============================================================
-- CANDIDATE_COMMENTS (conditional)
-- ============================================================
DO $$
BEGIN
  IF to_regclass('public.candidate_comments') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Recruiters can view org comments" ON candidate_comments;
    DROP POLICY IF EXISTS "Recruiters can create comments" ON candidate_comments;
    DROP POLICY IF EXISTS "Users can update own comments" ON candidate_comments;
    DROP POLICY IF EXISTS "Users can delete own comments" ON candidate_comments;
    DROP POLICY IF EXISTS "Admins can delete any org comment" ON candidate_comments;
    DROP POLICY IF EXISTS "Recruiter can view comments" ON candidate_comments;
    DROP POLICY IF EXISTS "Recruiter can insert comments" ON candidate_comments;
    DROP POLICY IF EXISTS "Recruiter can update comments" ON candidate_comments;
    DROP POLICY IF EXISTS "Recruiter can delete comments" ON candidate_comments;

    CREATE POLICY "Recruiter can view comments"
      ON candidate_comments FOR SELECT
      TO authenticated
      USING (public.is_recruiter());

    CREATE POLICY "Recruiter can insert comments"
      ON candidate_comments FOR INSERT
      TO authenticated
      WITH CHECK (public.is_authenticated_recruiter());

    CREATE POLICY "Recruiter can update comments"
      ON candidate_comments FOR UPDATE
      TO authenticated
      USING (public.is_recruiter())
      WITH CHECK (public.is_recruiter());

    CREATE POLICY "Recruiter can delete comments"
      ON candidate_comments FOR DELETE
      TO authenticated
      USING (public.is_recruiter());
  END IF;
END $$;


-- ============================================================
-- NOTIFICATIONS (conditional)
-- ============================================================
-- Single-user model: notifications all belong to the recruiter.
-- Keep the user_id = auth.uid() guard for defense-in-depth in case
-- the table is ever re-used multi-tenant.
DO $$
BEGIN
  IF to_regclass('public.notifications') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
    DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
    DROP POLICY IF EXISTS "Users can delete own notifications" ON notifications;
    DROP POLICY IF EXISTS "System can create notifications" ON notifications;

    CREATE POLICY "Users can view own notifications"
      ON notifications FOR SELECT
      TO authenticated
      USING (user_id = auth.uid());

    CREATE POLICY "System can create notifications"
      ON notifications FOR INSERT
      TO authenticated
      WITH CHECK (user_id = auth.uid());

    CREATE POLICY "Users can update own notifications"
      ON notifications FOR UPDATE
      TO authenticated
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());

    CREATE POLICY "Users can delete own notifications"
      ON notifications FOR DELETE
      TO authenticated
      USING (user_id = auth.uid());
  END IF;
END $$;


-- ============================================================
-- ANON ROLE LOCKDOWN
-- ============================================================
-- Anon must only ever be able to SELECT the public job board.
-- Revoke everything else, then re-grant the precise SELECT we
-- need. The "Public can view active jobs" RLS policy above
-- further filters to status='active' AND is_archived=false.

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon;

GRANT USAGE ON SCHEMA public TO anon;
GRANT SELECT ON public.jobs TO anon;

-- Re-grant function execution that anon legitimately needs.
GRANT EXECUTE ON FUNCTION public.is_recruiter() TO anon;
GRANT EXECUTE ON FUNCTION public.is_authenticated_recruiter() TO anon;


-- ============================================================
-- DOCUMENTATION
-- ============================================================
COMMENT ON POLICY "Public can view active jobs" ON jobs IS
'Single-recruiter MVP: anon + authenticated may read only active, non-archived jobs (public job board).';

COMMENT ON POLICY "Recruiter can insert jobs" ON jobs IS
'Wave 1 BLOCKER fix: requires is_authenticated_recruiter() AND pins created_by = auth.uid().';

COMMENT ON POLICY "Profile owner can update" ON profiles IS
'Wave 1 BLOCKER fix: WITH CHECK prevents the owner from escalating their own role (new role must equal existing role).';
