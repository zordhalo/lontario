-- Migration: Wipe MVP placeholder seed data
-- Date: 2026-05-04
-- Description: Removes all rows associated with the MVP_USER_ID placeholder
--              ('00000000-0000-0000-0000-000000000000') before restoring FKs and
--              real auth flows in 20260504_002_base_schema_assertions.sql and the
--              upcoming RLS hardening migration.
--
-- Addresses:
--   - BLOCKER-S "profiles.id FK to auth.users is dropped — orphan profiles" (wave1-database-rls.md)
--     prerequisite: must delete the placeholder profile before re-adding the FK to auth.users.
--   - BLOCKER-M "MVP_USER_ID placeholder bypasses auth" (wave1-database-rls.md)
--     prerequisite: removes the data the bypass code wrote so auth-bound code can take over.
--
-- The user has confirmed all MVP_USER_ID data is wipeable (single-recruiter MVP, no
-- production data of value). Deletions are ordered child-first to avoid FK violations
-- where FKs exist (pregenerated_questions.candidate_id, ai_interviews.candidate_id, etc.).
-- Tables that may not exist (notifications, candidate_comments) are guarded with
-- to_regclass checks.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Activities authored by the placeholder user (and any activities attached
--    to candidates we are about to delete).
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.candidate_activities') IS NOT NULL THEN
    DELETE FROM candidate_activities
     WHERE performed_by = '00000000-0000-0000-0000-000000000000'::uuid;

    DELETE FROM candidate_activities
     WHERE candidate_id IN (
       SELECT c.id FROM candidates c
        JOIN jobs j ON j.id = c.job_id
       WHERE j.created_by = '00000000-0000-0000-0000-000000000000'::uuid
     );
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2. Comments referencing placeholder (conditional table).
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.candidate_comments') IS NOT NULL THEN
    DELETE FROM candidate_comments
     WHERE author_id = '00000000-0000-0000-0000-000000000000'::uuid
        OR candidate_id IN (
          SELECT c.id FROM candidates c
           JOIN jobs j ON j.id = c.job_id
          WHERE j.created_by = '00000000-0000-0000-0000-000000000000'::uuid
        );
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 3. Notifications belonging to the placeholder user (conditional table).
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.notifications') IS NOT NULL THEN
    DELETE FROM notifications
     WHERE user_id = '00000000-0000-0000-0000-000000000000'::uuid;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 4. Interview questions for placeholder-owned interviews.
--    These should cascade from ai_interviews, but explicitly delete in case
--    the FK was never created (see wave1 HIGH-M "FK constraints not asserted").
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.interview_questions') IS NOT NULL THEN
    DELETE FROM interview_questions
     WHERE interview_id IN (
       SELECT ai.id FROM ai_interviews ai
        JOIN jobs j ON j.id = ai.job_id
       WHERE j.created_by = '00000000-0000-0000-0000-000000000000'::uuid
     );
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 5. Pre-generated questions for placeholder-owned candidates/jobs.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.pregenerated_questions') IS NOT NULL THEN
    DELETE FROM pregenerated_questions
     WHERE job_id IN (
       SELECT id FROM jobs
        WHERE created_by = '00000000-0000-0000-0000-000000000000'::uuid
     );
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 6. AI interviews for placeholder-owned jobs.
-- ---------------------------------------------------------------------------
DELETE FROM ai_interviews
 WHERE job_id IN (
   SELECT id FROM jobs
    WHERE created_by = '00000000-0000-0000-0000-000000000000'::uuid
 );

-- Also delete interviews where reviewed_by was the placeholder, in case the
-- reviewer was set even on non-placeholder jobs.
UPDATE ai_interviews
   SET reviewed_by = NULL, reviewed_at = NULL
 WHERE reviewed_by = '00000000-0000-0000-0000-000000000000'::uuid;

-- ---------------------------------------------------------------------------
-- 7. Candidates belonging to placeholder-owned jobs.
-- ---------------------------------------------------------------------------
DELETE FROM candidates
 WHERE job_id IN (
   SELECT id FROM jobs
    WHERE created_by = '00000000-0000-0000-0000-000000000000'::uuid
 );

-- ---------------------------------------------------------------------------
-- 8. Jobs created by the placeholder.
-- ---------------------------------------------------------------------------
DELETE FROM jobs
 WHERE created_by = '00000000-0000-0000-0000-000000000000'::uuid;

-- ---------------------------------------------------------------------------
-- 9. Finally, the placeholder profile itself.
-- ---------------------------------------------------------------------------
DELETE FROM profiles
 WHERE id = '00000000-0000-0000-0000-000000000000'::uuid;

COMMIT;
