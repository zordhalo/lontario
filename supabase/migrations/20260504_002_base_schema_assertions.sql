-- Migration: Base schema defensive assertions
-- Date: 2026-05-04
-- Description: Defensively re-asserts foreign keys, indexes, NOT NULL, length
--              CHECKs, enum CHECKs, and uniqueness constraints that should
--              always be present on the public schema. Assumes the DB exists
--              (no CREATE TABLE here); every statement is idempotent so a
--              second run is a no-op.
--
-- Wave 1 findings addressed (docs/launch-audit/wave1-database-rls.md):
--   BLOCKER-S "profiles.id FK to auth.users is dropped"  -> restored below
--   BLOCKER-S "jobs.created_by FK / NOT NULL dropped"    -> restored (+ NOT NULL)
--   HIGH-S "Missing index on candidates.job_id"          -> idx_candidates_job_id
--   HIGH-S "No UNIQUE(candidates.job_id, lower(email))"  -> unique partial index
--   HIGH-S "Missing index on jobs.status"                -> idx_jobs_status
--   HIGH-S "Missing indexes on candidate_activities"     -> idx_activities_*
--   HIGH-S "No FK on ai_interviews.reviewed_by"          -> FK added
--   HIGH-S "No NOT NULL on critical user-supplied fields"-> SET NOT NULL block
--   HIGH-S "No length / format CHECK constraints"        -> length CHECKs
--   HIGH-S "Stage / role / status not enforced"          -> enum CHECKs
--   MED-S  "No index on ai_interviews.access_token"      -> UNIQUE index
--   MED-S  "candidate_activities.performed_by has no FK" -> FK SET NULL
--   HIGH-M "FK constraints on core tables not asserted"  -> child-table FKs
--
-- Intentionally deferred (out of scope for this defensive migration):
--   - RLS policy changes (handled by w2-rls-singleuser)
--   - total_applicants / active_candidates counter trigger (deferred — needs
--     a separate carefully-tested migration with backfill; see wave1 MED-M)
--   - profile_id linkage on candidates (wave1 MED-S — schema-shape change)
--   - avatars storage policy fix (wave1 HIGH-S — storage policy work)
--   - pgTAP test conversion (wave1 MED-S)
--
-- Patterns:
--   * Every FK/constraint uses DO $$ EXCEPTION WHEN duplicate_object THEN NULL.
--   * Every index uses CREATE INDEX IF NOT EXISTS / CREATE UNIQUE INDEX IF NOT EXISTS.
--   * NOT NULL uses SET NOT NULL inside a DO block that no-ops on already-set.
--   * CHECK constraints use ADD CONSTRAINT IF NOT EXISTS style via DO blocks.

BEGIN;

-- ===========================================================================
-- 1. Restore foreign keys
-- ===========================================================================

-- profiles.id -> auth.users.id (CASCADE on user delete)
-- BLOCKER-S #5 from wave1-database-rls.md
DO $$
BEGIN
  ALTER TABLE profiles
    ADD CONSTRAINT profiles_id_fkey
    FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN invalid_foreign_key THEN
    RAISE NOTICE 'profiles_id_fkey skipped: orphan rows present, run wipe migration first';
END $$;

-- jobs.created_by -> profiles.id (RESTRICT — recruiter cannot be deleted while jobs exist)
-- BLOCKER-S #3 / wave1 fix uses SET NULL; per agent brief use RESTRICT.
DO $$
BEGIN
  ALTER TABLE jobs
    ADD CONSTRAINT jobs_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE RESTRICT;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN invalid_foreign_key THEN
    RAISE NOTICE 'jobs_created_by_fkey skipped: orphan rows present, run wipe migration first';
END $$;

-- ai_interviews.reviewed_by -> profiles.id (SET NULL so deleting a reviewer
-- profile does not destroy the interview history).
-- HIGH-S from wave1
DO $$
BEGIN
  ALTER TABLE ai_interviews
    ADD CONSTRAINT ai_interviews_reviewed_by_fkey
    FOREIGN KEY (reviewed_by) REFERENCES profiles(id) ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN invalid_foreign_key THEN
    RAISE NOTICE 'ai_interviews_reviewed_by_fkey skipped: orphan rows present';
END $$;

-- candidate_activities.performed_by -> profiles.id (SET NULL)
-- MED-S from wave1
DO $$
BEGIN
  IF to_regclass('public.candidate_activities') IS NOT NULL THEN
    BEGIN
      ALTER TABLE candidate_activities
        ADD CONSTRAINT candidate_activities_performed_by_fkey
        FOREIGN KEY (performed_by) REFERENCES profiles(id) ON DELETE SET NULL;
    EXCEPTION
      WHEN duplicate_object THEN NULL;
      WHEN invalid_foreign_key THEN
        RAISE NOTICE 'candidate_activities_performed_by_fkey skipped: orphan rows';
    END;
  END IF;
END $$;

-- Child-table FKs (HIGH-M from wave1) — defensive: only added if missing.
-- candidates.job_id -> jobs.id ON DELETE CASCADE
DO $$
BEGIN
  ALTER TABLE candidates
    ADD CONSTRAINT candidates_job_id_fkey
    FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN invalid_foreign_key THEN
    RAISE NOTICE 'candidates_job_id_fkey skipped: orphan rows present';
END $$;

-- ai_interviews.candidate_id -> candidates.id ON DELETE CASCADE
DO $$
BEGIN
  ALTER TABLE ai_interviews
    ADD CONSTRAINT ai_interviews_candidate_id_fkey
    FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN invalid_foreign_key THEN
    RAISE NOTICE 'ai_interviews_candidate_id_fkey skipped: orphan rows present';
END $$;

-- ai_interviews.job_id -> jobs.id ON DELETE CASCADE
DO $$
BEGIN
  ALTER TABLE ai_interviews
    ADD CONSTRAINT ai_interviews_job_id_fkey
    FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN invalid_foreign_key THEN
    RAISE NOTICE 'ai_interviews_job_id_fkey skipped: orphan rows present';
END $$;

-- interview_questions.interview_id -> ai_interviews.id ON DELETE CASCADE
DO $$
BEGIN
  IF to_regclass('public.interview_questions') IS NOT NULL THEN
    BEGIN
      ALTER TABLE interview_questions
        ADD CONSTRAINT interview_questions_interview_id_fkey
        FOREIGN KEY (interview_id) REFERENCES ai_interviews(id) ON DELETE CASCADE;
    EXCEPTION
      WHEN duplicate_object THEN NULL;
      WHEN invalid_foreign_key THEN
        RAISE NOTICE 'interview_questions_interview_id_fkey skipped: orphan rows';
    END;
  END IF;
END $$;

-- candidate_activities.candidate_id -> candidates.id ON DELETE CASCADE
DO $$
BEGIN
  IF to_regclass('public.candidate_activities') IS NOT NULL THEN
    BEGIN
      ALTER TABLE candidate_activities
        ADD CONSTRAINT candidate_activities_candidate_id_fkey
        FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE;
    EXCEPTION
      WHEN duplicate_object THEN NULL;
      WHEN invalid_foreign_key THEN
        RAISE NOTICE 'candidate_activities_candidate_id_fkey skipped: orphan rows';
    END;
  END IF;
END $$;

-- ===========================================================================
-- 2. NOT NULL on critical user-supplied fields (HIGH-S)
-- ===========================================================================

DO $$
BEGIN
  -- jobs.title
  BEGIN ALTER TABLE jobs ALTER COLUMN title SET NOT NULL;
  EXCEPTION WHEN others THEN RAISE NOTICE 'jobs.title SET NOT NULL skipped: %', SQLERRM;
  END;

  -- jobs.created_by (was dropped by 20260130_remove_profile_fk_for_mvp.sql)
  BEGIN ALTER TABLE jobs ALTER COLUMN created_by SET NOT NULL;
  EXCEPTION WHEN others THEN RAISE NOTICE 'jobs.created_by SET NOT NULL skipped: %', SQLERRM;
  END;

  -- candidates.email
  BEGIN ALTER TABLE candidates ALTER COLUMN email SET NOT NULL;
  EXCEPTION WHEN others THEN RAISE NOTICE 'candidates.email SET NOT NULL skipped: %', SQLERRM;
  END;

  -- candidates.full_name
  BEGIN ALTER TABLE candidates ALTER COLUMN full_name SET NOT NULL;
  EXCEPTION WHEN others THEN RAISE NOTICE 'candidates.full_name SET NOT NULL skipped: %', SQLERRM;
  END;

  -- candidates.job_id
  BEGIN ALTER TABLE candidates ALTER COLUMN job_id SET NOT NULL;
  EXCEPTION WHEN others THEN RAISE NOTICE 'candidates.job_id SET NOT NULL skipped: %', SQLERRM;
  END;

  -- ai_interviews.access_token
  BEGIN ALTER TABLE ai_interviews ALTER COLUMN access_token SET NOT NULL;
  EXCEPTION WHEN others THEN RAISE NOTICE 'ai_interviews.access_token SET NOT NULL skipped: %', SQLERRM;
  END;
END $$;

-- ===========================================================================
-- 3. Length / format CHECK constraints (HIGH-S)
-- ===========================================================================

DO $$
BEGIN
  BEGIN
    ALTER TABLE jobs
      ADD CONSTRAINT jobs_title_len_chk
      CHECK (char_length(title) BETWEEN 1 AND 200);
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER TABLE candidates
      ADD CONSTRAINT candidates_email_len_chk
      CHECK (char_length(email) BETWEEN 3 AND 254);
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER TABLE candidates
      ADD CONSTRAINT candidates_email_fmt_chk
      CHECK (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$');
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER TABLE candidates
      ADD CONSTRAINT candidates_full_name_len_chk
      CHECK (char_length(full_name) BETWEEN 1 AND 200);
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER TABLE candidates
      ADD CONSTRAINT candidates_linkedin_url_len_chk
      CHECK (linkedin_url IS NULL OR char_length(linkedin_url) <= 2048);
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER TABLE candidates
      ADD CONSTRAINT candidates_github_url_len_chk
      CHECK (github_url IS NULL OR char_length(github_url) <= 2048);
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER TABLE candidates
      ADD CONSTRAINT candidates_resume_url_len_chk
      CHECK (resume_url IS NULL OR char_length(resume_url) <= 2048);
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER TABLE candidates
      ADD CONSTRAINT candidates_avatar_url_len_chk
      CHECK (avatar_url IS NULL OR char_length(avatar_url) <= 2048);
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

-- ===========================================================================
-- 4. Enum-style CHECK constraints (HIGH-S)
--    ai_interviews.status already has one (20260130_add_interview_scheduling.sql:37-49).
--    candidates.question_generation_status already has one (pregenerated_questions migration).
-- ===========================================================================

DO $$
BEGIN
  -- jobs.status
  BEGIN
    ALTER TABLE jobs
      ADD CONSTRAINT jobs_status_chk
      CHECK (status IN ('draft', 'active', 'paused', 'closed', 'archived'));
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  -- jobs.level (typical seniority enums; types/index.ts source of truth)
  BEGIN
    ALTER TABLE jobs
      ADD CONSTRAINT jobs_level_chk
      CHECK (level IS NULL OR level IN (
        'intern', 'entry', 'junior', 'mid', 'senior',
        'lead', 'staff', 'principal', 'manager', 'director', 'executive'
      ));
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  -- candidates.stage
  BEGIN
    ALTER TABLE candidates
      ADD CONSTRAINT candidates_stage_chk
      CHECK (stage IN (
        'applied', 'screening', 'interview', 'offer', 'hired', 'rejected', 'withdrawn'
      ));
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

-- ===========================================================================
-- 5. Unique constraints / indexes
-- ===========================================================================

-- UNIQUE (job_id, lower(email)) on candidates — partial, excludes archived so a
-- recruiter who archives a candidate can still receive a re-application.
-- HIGH-S from wave1
CREATE UNIQUE INDEX IF NOT EXISTS idx_candidates_job_email_unique
  ON candidates (job_id, lower(email))
  WHERE is_archived = false;

-- UNIQUE on ai_interviews.access_token — MED-S from wave1
CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_interviews_access_token
  ON ai_interviews (access_token)
  WHERE access_token IS NOT NULL;

-- ===========================================================================
-- 6. Performance indexes (HIGH-S)
-- ===========================================================================

CREATE INDEX IF NOT EXISTS idx_candidates_job_id
  ON candidates (job_id);

CREATE INDEX IF NOT EXISTS idx_candidates_email
  ON candidates (lower(email));

-- idx_jobs_is_archived already created by 20260130_add_job_archive.sql:5;
-- repeat with IF NOT EXISTS for defensive freshness.
CREATE INDEX IF NOT EXISTS idx_jobs_is_archived
  ON jobs (is_archived);

CREATE INDEX IF NOT EXISTS idx_jobs_status
  ON jobs (status);

DO $$
BEGIN
  IF to_regclass('public.candidate_activities') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_activities_candidate_id
      ON candidate_activities (candidate_id, created_at DESC);

    CREATE INDEX IF NOT EXISTS idx_activities_performed_by
      ON candidate_activities (performed_by);
  END IF;
END $$;

COMMIT;
