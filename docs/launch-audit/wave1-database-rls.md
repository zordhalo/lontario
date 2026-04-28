# Wave 1 Audit — Supabase Database & RLS

**Scope**: `supabase/migrations/`, `supabase/tests/`, `types/index.ts` (note: `types/database.ts` does not exist; runtime shape lives in `types/index.ts`), and `MVP_USER_ID` consumers in `app/api/`.

**Audit date**: 2026-04-27. Posture target: public job board, public application intake, recruiter-only management.

---

## Schema state — reconstructed from migrations

> **Critical caveat**: The repo contains *no* base-schema migration. Migrations only ALTER pre-existing tables (`jobs`, `candidates`, `ai_interviews`, `interview_questions`, `profiles`, `candidate_activities`). Their core CREATE TABLE statements were applied out-of-band (Supabase dashboard or a deleted migration). The schema below is *inferred* from ALTERs, RLS policies, test inserts, and `types/index.ts`.

### Tables (existence inferred, columns partial)

| Table | Source | Notes |
|---|---|---|
| `profiles` | inferred + `20260203_update_user_roles.sql` | columns: `id UUID PK`, `email`, `full_name`, `company_name`, `role user_role`, `organization_id UUID` (added `001_enable_rls` L17 and `update_user_roles` L20), `avatar_url`, `timezone`, `notification_preferences JSONB`, `created_at`, `updated_at`. FK to `auth.users` **dropped** (`20260130_remove_profile_fk_for_mvp.sql:8`). |
| `jobs` | inferred + `20260130_add_job_archive.sql` | columns: `id`, `created_by UUID` (FK dropped, made nullable — `20260130_remove_profile_fk_for_mvp.sql:11,14`), `title`, `slug`, `level`, `department`, `location`, `location_type`, `employment_type`, `description`, `responsibilities`, `required_skills text[]`, `nice_to_have_skills text[]`, `salary_min`, `salary_max`, `salary_currency`, `show_salary`, `status`, `is_featured`, `is_archived BOOLEAN NOT NULL DEFAULT false` (added `20260130_add_job_archive.sql:2`), `screening_questions JSONB`, `total_applicants`, `active_candidates`, `published_at`, `closed_at`. |
| `candidates` | inferred + `20260130_add_candidate_avatar.sql` + `20260130_add_pregenerated_questions.sql` | columns: `id`, `job_id UUID` (FK assumed to `jobs(id)` but cascade unknown), `email`, `full_name`, `phone`, `location`, `linkedin_url`, `github_url`, `resume_url`, `resume_text`, `cover_letter`, `screening_answers JSONB`, `ai_score`, `ai_score_breakdown JSONB`, `ai_summary`, `ai_strengths text[]`, `ai_concerns text[]`, `extracted_skills text[]`, `avatar_url TEXT` (added `20260130_add_candidate_avatar.sql:5`), `years_of_experience`, `education_level`, `stage`, `rejection_reason`, `rejection_feedback`, `source`, `referrer_id`, `utm_*`, `last_activity_at`, `is_starred`, `is_archived`, `applied_at`, `question_generation_status TEXT DEFAULT 'none'` with CHECK (added `20260130_add_pregenerated_questions.sql:33-35`). |
| `ai_interviews` | inferred + `20260130_add_interview_scheduling.sql` + `20260130_add_interview_reviewed.sql` | `id`, `candidate_id`, `job_id`, `model_used`, `total_questions`, `status` (CHECK constraint with 10 values — `20260130_add_interview_scheduling.sql:37-49`), `questions_answered`, `access_token`, `expires_at`, `overall_score`, `ai_summary`, `recommendation`, `sent_at`, `started_at`, `completed_at`, `scheduled_at`, `reminder_sent_at`, `interview_link`, `interview_duration_minutes INT DEFAULT 30`, `candidate_timezone`, `custom_message`, `reviewed_at`, `reviewed_by UUID` (untyped — no FK). |
| `interview_questions` | inferred (RLS only) | not ALTERed in any migration; columns from `types/index.ts`: `id`, `interview_id`, `question_text`, `category`, `difficulty`, `question_order`, `scoring_rubric JSONB`, `candidate_answer`, `ai_score`, `ai_evaluation_breakdown JSONB`, `created_at`. |
| `candidate_activities` | inferred (RLS only) | columns from `types/index.ts`: `id`, `candidate_id`, `performed_by UUID nullable`, `activity_type`, `metadata JSONB`, `old_value`, `new_value`, `notes`, `is_internal`, `created_at`. **Note**: the test file references `candidate_activity` (singular) at line 51 — possible naming inconsistency. |
| `pregenerated_questions` | `20260130_add_pregenerated_questions.sql:4-30` | full CREATE TABLE present; `id UUID PK`, `candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE`, `job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE`, `questions JSONB`, `total_questions INT`, `total_estimated_time INT`, `status TEXT CHECK`, `error_message`, `model_used`, `generated_at`, `used_at`, `used_in_interview_id UUID REFERENCES ai_interviews(id) ON DELETE SET NULL`, `created_at`, `updated_at`, `UNIQUE(candidate_id, job_id)`. |
| `candidate_comments` | conditional (referenced in RLS DO blocks) | may not exist — RLS policies only created if table found. |
| `notifications` | conditional (referenced in RLS DO blocks) | may not exist — RLS policies only created if table found. |

### Indexes (only those added by migrations in this folder)

- `idx_ai_interviews_reviewed_at` partial WHERE `reviewed_at IS NULL` — `20260130_add_interview_reviewed.sql:11-13`
- `idx_ai_interviews_status_reviewed` partial — `20260130_add_interview_reviewed.sql:16-18`
- `idx_ai_interviews_scheduled_at` partial — `20260130_add_interview_scheduling.sql:15-17`
- `idx_ai_interviews_status_scheduled` partial — `20260130_add_interview_scheduling.sql:20-22`
- `idx_jobs_is_archived` — `20260130_add_job_archive.sql:5`
- `idx_jobs_status_archived` — `20260130_add_job_archive.sql:8`
- `idx_pregenerated_questions_candidate_job` — `20260130_add_pregenerated_questions.sql:38-39`
- `idx_pregenerated_questions_status` — `20260130_add_pregenerated_questions.sql:41-42`
- `idx_candidates_question_generation_status` partial — `20260130_add_pregenerated_questions.sql:44-46`
- `idx_profiles_role` — `20260203_update_user_roles.sql:96`
- `idx_profiles_organization_id` — `20260203_update_user_roles.sql:99`

### Constraints / FKs

- `pregenerated_questions.candidate_id` → `candidates(id) ON DELETE CASCADE`
- `pregenerated_questions.job_id` → `jobs(id) ON DELETE CASCADE`
- `pregenerated_questions.used_in_interview_id` → `ai_interviews(id) ON DELETE SET NULL`
- `pregenerated_questions UNIQUE(candidate_id, job_id)`
- `ai_interviews_status_check CHECK (status IN (...))` — 10 values
- `candidates.question_generation_status CHECK (... IN ('none','pending','generating','ready','failed'))`
- `pregenerated_questions.status CHECK (... IN ('pending','generating','ready','failed','used'))`
- `profiles_id_fkey` to `auth.users`: **DROPPED** (`20260130_remove_profile_fk_for_mvp.sql:8`)
- `jobs_created_by_fkey`: **DROPPED**, `created_by` made **nullable** (`20260130_remove_profile_fk_for_mvp.sql:11,14`)
- All other FKs (e.g. `candidates.job_id → jobs(id)`, `ai_interviews.candidate_id → candidates(id)`, `interview_questions.interview_id → ai_interviews(id)`, `candidate_activities.candidate_id → candidates(id)`) are **not asserted in any migration in this folder** — their existence and ON DELETE behavior are unknown.

### RLS policy map

| Table | Role | Op | Condition (file:line in `20260203_002_rls_policies.sql` unless noted) |
|---|---|---|---|
| profiles | authenticated | SELECT | `auth.uid() = id` (L48-51) |
| profiles | authenticated | SELECT | `is_admin()` (L55-58) |
| profiles | authenticated | SELECT | `is_recruiter_or_above() AND get_user_organization_id() = organization_id` (L62-69) |
| profiles | authenticated | UPDATE | `auth.uid() = id` (L72-76) |
| profiles | authenticated | UPDATE | `is_admin()` (L80-84) |
| profiles | (no role limit!) | INSERT | `WITH CHECK (true)` (L87-89) — **anyone can insert any profile** |
| profiles | authenticated | DELETE | `is_admin()` (L93-96) |
| jobs | anon, authenticated | SELECT | `status='active' AND is_archived=false` (L119-122) |
| jobs | authenticated | SELECT | `is_recruiter_or_above() AND user_owns_job(id)` (L125-131) |
| jobs | authenticated | INSERT | `is_recruiter_or_above()` (L134-139) — **does NOT pin `created_by` to `auth.uid()`** |
| jobs | authenticated | UPDATE | `is_recruiter_or_above() AND user_owns_job(id)` (L142-152) |
| jobs | authenticated | DELETE | `is_admin() AND user_owns_job(id)` (L155-161) |
| candidates | authenticated | SELECT | candidate self by email match (L182-187) |
| candidates | authenticated | SELECT | `is_recruiter_or_above() AND user_owns_job(job_id)` (L190-196) |
| candidates | anon, authenticated | INSERT | `WITH CHECK (true)` (L200-203) — **fully open insert** |
| candidates | authenticated | UPDATE | `is_recruiter_or_above() AND user_owns_job(job_id)` (L206-216) |
| candidates | authenticated | DELETE | `is_recruiter_or_above() AND user_owns_job(job_id)` (`20260204_fix_candidate_delete_policy.sql:13-19` — replaced original admin-only) |
| ai_interviews | authenticated | SELECT | candidate self via email join (L247-257) |
| ai_interviews | authenticated | SELECT | recruiter+ owns job (L264-270) |
| ai_interviews | authenticated | INSERT | recruiter+ owns job (L273-279) |
| ai_interviews | authenticated | UPDATE | candidate self (L282-300) |
| ai_interviews | authenticated | UPDATE | recruiter+ owns job (L303-313) |
| ai_interviews | authenticated | DELETE | `is_admin() AND user_owns_job(job_id)` (L316-322) |
| interview_questions | authenticated | SELECT | candidate self via deep join (L342-353) |
| interview_questions | authenticated | SELECT | recruiter+ owns interview (L356-366) |
| interview_questions | authenticated | UPDATE | candidate self (L369-389) |
| interview_questions | authenticated | UPDATE | recruiter+ (L395-413) |
| interview_questions | authenticated | DELETE | admin+ (L416-426) |
| interview_questions | — | INSERT | **NO POLICY** (comment L391-392 says "service role only") |
| candidate_activities | authenticated | SELECT | recruiter+ access (L443-449) |
| candidate_activities | authenticated | INSERT | recruiter+ access (L452-458) |
| candidate_activities | authenticated | DELETE | admin (L461-467) |
| candidate_activities | — | UPDATE | **NO POLICY** (intentional — append-only) |
| candidate_comments (conditional) | authenticated | SELECT/INSERT/UPDATE/DELETE | recruiter+ + author checks (L489-536) |
| pregenerated_questions (conditional) | authenticated | SELECT/UPDATE/DELETE | recruiter+ owns job (L561-589); **NO INSERT policy** |
| notifications (conditional) | authenticated | SELECT/INSERT/UPDATE/DELETE | `user_id = auth.uid()` (L614-637) |
| storage.objects (avatars) | authenticated | INSERT/UPDATE/DELETE | `bucket_id='avatars' AND auth.uid()::text = split_part(name,'-',1)` (`20260204_create_avatars_bucket.sql:13-38`) |
| storage.objects (avatars) | public | SELECT | `bucket_id='avatars'` (L41-44) |

---

## Findings

### BLOCKERS

#### [BLOCKER-M] No base schema migration in repo
- **File**: `supabase/migrations/` (entire folder)
- **Finding**: Tables `jobs`, `candidates`, `ai_interviews`, `interview_questions`, `profiles`, `candidate_activities` have no `CREATE TABLE` statement anywhere in `supabase/migrations/`. Only ALTERs and RLS policies exist. The Supabase project cannot be rebuilt from this repo. A fresh environment (staging, DR, new dev machine) will fail every migration after the first ALTER. This blocks reproducible deploys, PITR rebuilds, and CI testing.
- **Fix**: Run `supabase db dump --schema public --data-only=false` against the live project, commit the resulting `00000000000000_initial_schema.sql` as the first migration, and verify `supabase db reset` succeeds end-to-end.
- **Wave 2 task**: Dump the live schema and commit it as `00000000000000_initial_schema.sql`, then verify `supabase db reset` rebuilds cleanly.

#### [BLOCKER-S] `profiles` INSERT policy is `WITH CHECK (true)` — any user can create any profile
- **File**: `supabase/migrations/20260203_002_rls_policies.sql:87-89`
- **Finding**: `CREATE POLICY "Service role can insert profiles" ON profiles FOR INSERT WITH CHECK (true);` has no role restriction (no `TO` clause defaults to PUBLIC) and no condition. Any anon or authenticated client can insert a profile row with `role='admin'`, `organization_id` of any victim org, and immediately gain admin access to that org's jobs, candidates, and interviews via the helper functions. Profile creation is supposed to flow through the `handle_new_user()` AFTER INSERT trigger on `auth.users` (`20260203_update_user_roles.sql:52-89`), which runs as `SECURITY DEFINER` and does not need this policy.
- **Fix**:
  ```sql
  DROP POLICY "Service role can insert profiles" ON profiles;
  CREATE POLICY "Users can insert own profile"
    ON profiles FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = id AND role = 'candidate'::user_role);
  ```
  The `handle_new_user()` trigger runs as SECURITY DEFINER and bypasses RLS, so it does not need an INSERT policy.
- **Wave 2 task**: Replace the unrestricted profiles INSERT policy with one that pins `id = auth.uid()` and forces `role = 'candidate'`.

#### [BLOCKER-S] `jobs` INSERT does not pin `created_by` to caller
- **File**: `supabase/migrations/20260203_002_rls_policies.sql:134-139`
- **Finding**: The "Recruiters can create jobs" policy only checks `is_recruiter_or_above()` with no `WITH CHECK` against `created_by`. A recruiter in org A can insert a job with `created_by` set to a recruiter from org B (or `NULL`, since the column is now nullable per `20260130_remove_profile_fk_for_mvp.sql:14`). Combined with the `user_owns_job()` fallback at `20260203_001_enable_rls_all_tables.sql:112-117` ("job has no creator → allow if user has proper role"), a `created_by = NULL` job is owned by every recruiter on the platform, so impersonation is trivial.
- **Fix**:
  ```sql
  DROP POLICY "Recruiters can create jobs" ON jobs;
  CREATE POLICY "Recruiters can create jobs"
    ON jobs FOR INSERT TO authenticated
    WITH CHECK (is_recruiter_or_above() AND created_by = auth.uid());
  ALTER TABLE jobs ALTER COLUMN created_by SET NOT NULL;
  ```
- **Wave 2 task**: Tighten jobs INSERT policy to require `created_by = auth.uid()` and restore `NOT NULL` on `jobs.created_by`.

#### [BLOCKER-M] MVP_USER_ID placeholder bypasses auth in production code paths
- **Files**: `app/api/jobs/route.ts:142,150,211`, `app/api/candidates/[id]/move/route.ts:29,117`
- **Finding**: `POST /api/jobs` calls `createAdminClient()` (service-role, RLS-bypassing) and upserts a profile with `id='00000000-…'`, `email='mvp@placeholder.local'`, `role='recruiter'` on every request, then sets `created_by = MVP_USER_ID` on the new job (`app/api/jobs/route.ts:144-162, 211`). `POST /api/candidates/[id]/move` writes `performed_by: MVP_USER_ID` to `candidate_activities` (`route.ts:117`) and explicitly comments "MVP: Skip job ownership check" at `route.ts:82`. As a result: (a) every job in production is owned by the placeholder profile, (b) every stage-change activity is attributed to it, (c) any caller can move any candidate at any job because the route uses an unrestricted admin client.
- **Fix**: Replace `createAdminClient()` with `await createClient()` (cookie-bound user client) in both routes; remove `ensureMvpProfile`; remove `MVP_USER_ID`; require `auth.uid()` and use it for `created_by` / `performed_by`. The RLS policies above (once tightened) will enforce ownership server-side.
- **Wave 2 task**: Delete every `MVP_USER_ID` reference, switch the two routes to the user-scoped client, and reinstate ownership checks via RLS instead of bypassing it.

#### [BLOCKER-S] `profiles.id` FK to `auth.users` is dropped — orphan profiles, broken cascade on user delete
- **File**: `supabase/migrations/20260130_remove_profile_fk_for_mvp.sql:8`
- **Finding**: Comment at L17 says "FK constraint to auth.users temporarily disabled for MVP". With FK gone: deleting a Supabase Auth user does not cascade to `profiles`; `profiles.id` may not match any real user; the placeholder MVP profile exists with `id='00000000-…'` and no auth backing. RLS helpers (`is_admin()`, `user_owns_job()`) match `auth.uid()` against `profiles.id`, so a real user with no profile row gets "deny by default" but a stale profile with a guessable UUID remains accessible.
- **Fix**:
  ```sql
  -- 1. Delete placeholder rows
  DELETE FROM profiles WHERE id = '00000000-0000-0000-0000-000000000000';
  -- 2. Reattach FK with cascade
  ALTER TABLE profiles
    ADD CONSTRAINT profiles_id_fkey
    FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
  -- 3. Reattach jobs.created_by FK
  ALTER TABLE jobs
    ADD CONSTRAINT jobs_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
  ```
- **Wave 2 task**: Restore `profiles_id_fkey` (CASCADE) and `jobs_created_by_fkey` (SET NULL) before re-enabling auth.

### HIGH

#### [HIGH-S] Missing index on `candidates.job_id`
- **File**: `supabase/migrations/` (no index defined)
- **Finding**: Every recruiter list query, every RLS check via `user_owns_job(job_id)`, and the candidates dashboard filter on `job_id`. With no index this is a sequential scan per request. No migration in the repo creates `idx_candidates_job_id`.
- **Fix**: `CREATE INDEX IF NOT EXISTS idx_candidates_job_id ON candidates(job_id);`
- **Wave 2 task**: Add `idx_candidates_job_id` and re-run EXPLAIN ANALYZE on the candidates list query.

#### [HIGH-S] No `UNIQUE(candidates.job_id, candidates.email)` — duplicate applications allowed
- **File**: `supabase/migrations/` (no constraint defined)
- **Finding**: A public job board with `Anyone can apply to jobs` (`20260203_002_rls_policies.sql:200-203`, `WITH CHECK (true)`) and no uniqueness lets the same email apply 1000× to the same job. No rate-limit at DB level; the RLS layer cannot dedupe. Spam vector and breaks `total_applicants` accounting.
- **Fix**:
  ```sql
  -- Dedupe first, then add constraint
  DELETE FROM candidates a USING candidates b
    WHERE a.id < b.id AND a.job_id = b.job_id AND lower(a.email) = lower(b.email);
  CREATE UNIQUE INDEX idx_candidates_job_email_unique
    ON candidates (job_id, lower(email));
  ```
- **Wave 2 task**: Dedupe existing rows and add a case-insensitive unique index on `(job_id, email)`.

#### [HIGH-S] Missing index on `jobs.status` (non-archived public listing)
- **File**: `supabase/migrations/20260130_add_job_archive.sql:8`
- **Finding**: There is `idx_jobs_status_archived` on `(status, is_archived)` which covers the public-feed filter `status='active' AND is_archived=false`. Good. However the public board likely sorts by `published_at DESC` and there is no index supporting that order on the filtered set. Also no plain `idx_jobs_status` for admin views filtering by draft/paused/closed alone.
- **Fix**:
  ```sql
  CREATE INDEX idx_jobs_active_published
    ON jobs(published_at DESC)
    WHERE status = 'active' AND is_archived = false;
  ```
- **Wave 2 task**: Add a partial index on `published_at DESC` for the public job feed.

#### [HIGH-S] Missing indexes on `candidate_activities` lookups
- **File**: `supabase/migrations/` (no index defined)
- **Finding**: `candidate_activities` is queried by `candidate_id` in every candidate detail page and by `performed_by` in audit views. No indexes asserted in any migration. RLS recursively calls `user_can_access_candidate(candidate_id)` per row.
- **Fix**:
  ```sql
  CREATE INDEX idx_candidate_activities_candidate_id ON candidate_activities(candidate_id, created_at DESC);
  CREATE INDEX idx_candidate_activities_performed_by ON candidate_activities(performed_by);
  ```
- **Wave 2 task**: Add `(candidate_id, created_at DESC)` and `(performed_by)` indexes on `candidate_activities`.

#### [HIGH-S] No FK on `ai_interviews.reviewed_by` — orphans guaranteed
- **File**: `supabase/migrations/20260130_add_interview_reviewed.sql:8`
- **Finding**: `reviewed_by UUID` added with no FK to `profiles(id)`. Comment says "for future auth integration". Production launch needs this tied to a real reviewer or it cannot be audited.
- **Fix**:
  ```sql
  ALTER TABLE ai_interviews
    ADD CONSTRAINT ai_interviews_reviewed_by_fkey
    FOREIGN KEY (reviewed_by) REFERENCES profiles(id) ON DELETE SET NULL;
  ```
- **Wave 2 task**: Add FK from `ai_interviews.reviewed_by` to `profiles(id)`.

#### [HIGH-M] FK constraints on core tables not asserted in repo
- **File**: `supabase/migrations/` (none)
- **Finding**: `candidates.job_id`, `ai_interviews.candidate_id`, `ai_interviews.job_id`, `interview_questions.interview_id`, `candidate_activities.candidate_id` — none of these FKs are defined in any migration here. Their cascade behavior (`ON DELETE CASCADE` vs `RESTRICT` vs nothing) is unknown and varies if the live DB and a fresh dev DB diverge. Deleting a job today may either cascade to candidates/interviews/activities, or leave orphans, depending on what was clicked in the dashboard.
- **Fix**: Once base schema is dumped (BLOCKER-M), explicitly assert all FKs with `ON DELETE CASCADE` for child rows that should follow the parent (candidates → job, interviews → candidate, questions → interview, activities → candidate).
- **Wave 2 task**: After base schema dump, add a migration that asserts every FK with explicit cascade behavior.

#### [HIGH-S] Storage avatars policy uses fragile `split_part(name,'-',1)` for ownership
- **File**: `supabase/migrations/20260204_create_avatars_bucket.sql:19,28,37`
- **Finding**: Ownership is decided by `auth.uid()::text = split_part(name, '-', 1)`. UUIDs themselves contain hyphens, so `split_part('123e4567-e89b-12d3-a456-426614174000.jpg', '-', 1)` returns `'123e4567'` — only the first 8 hex chars. Two users whose UUIDs share the first 8 chars will both pass the check and overwrite each other's avatars. Also no folder structure means listing the bucket leaks all uploaders' filenames.
- **Fix**:
  ```sql
  DROP POLICY "Users can upload own avatar" ON storage.objects;
  CREATE POLICY "Users can upload own avatar"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (
      bucket_id = 'avatars'
      AND (storage.foldername(name))[1] = auth.uid()::text
    );
  -- repeat for UPDATE, DELETE; require uploads at path "<uid>/<file>"
  ```
- **Wave 2 task**: Switch avatar storage path convention to `<auth.uid>/<filename>` and rewrite the three storage policies to compare against `(storage.foldername(name))[1]`.

#### [HIGH-S] Avatars bucket is `public=true` with no abuse controls
- **File**: `supabase/migrations/20260204_create_avatars_bucket.sql:6`
- **Finding**: `public=true` allows direct CDN URLs, which is desired. But size limit is 2 MB and MIME allowlist is jpeg/png/webp — that part is good. What is missing: per-user upload rate limit, EXIF stripping, and a CDN/cache TTL. Public buckets also leak object existence via 200 vs 404, which can be probed.
- **Fix**: Add an upload rate-limit at the API layer (already partially done per recent commit `1de1b44`). Strip EXIF on upload (server-side via Sharp). Consider switching to a private bucket with signed URLs if you want to keep avatar URLs unguessable.
- **Wave 2 task**: Add server-side EXIF strip + per-user upload rate limit for the avatars bucket.

#### [HIGH-S] No `NOT NULL` enforced on critical user-supplied fields
- **File**: inferred (no migration sets these)
- **Finding**: From `types/index.ts`, `Candidate.email: string` and `Candidate.full_name: string` are typed non-nullable, but no migration in this repo asserts `NOT NULL` on `candidates.email` or `candidates.full_name`. Same for `jobs.title`, `jobs.description`, `ai_interviews.access_token`, `ai_interviews.expires_at`. Anonymous `INSERT` is allowed (`WITH CHECK (true)`), so a malformed body can insert NULLs and break every downstream query.
- **Fix**: Audit live DB with `\d candidates`, `\d jobs`, `\d ai_interviews`. Add `ALTER TABLE … ALTER COLUMN … SET NOT NULL` for every column the type system says is required.
- **Wave 2 task**: Compare live `information_schema.columns` to `types/index.ts`, emit migration setting NOT NULL on every mismatch.

#### [HIGH-S] No length / format CHECK constraints on user input
- **File**: `supabase/migrations/` (none)
- **Finding**: With public `INSERT` allowed on `candidates`, no CHECK limits `length(email) <= 320`, `length(full_name) <= 200`, `length(cover_letter) <= 50000`, `length(resume_text) <= 1_000_000`, etc. A single applicant can write multi-megabyte text fields and inflate the DB.
- **Fix**:
  ```sql
  ALTER TABLE candidates
    ADD CONSTRAINT candidates_email_len CHECK (char_length(email) BETWEEN 3 AND 320),
    ADD CONSTRAINT candidates_email_fmt CHECK (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
    ADD CONSTRAINT candidates_full_name_len CHECK (char_length(full_name) BETWEEN 1 AND 200),
    ADD CONSTRAINT candidates_cover_letter_len CHECK (cover_letter IS NULL OR char_length(cover_letter) <= 50000),
    ADD CONSTRAINT candidates_resume_text_len CHECK (resume_text IS NULL OR char_length(resume_text) <= 1000000);
  ```
- **Wave 2 task**: Add CHECK constraints for length and email format on `candidates`, `jobs`, `ai_interviews` user-input columns.

#### [HIGH-S] Stage / role / status columns not enforced as enums or CHECKs (except `ai_interviews.status`)
- **File**: `supabase/migrations/` (none)
- **Finding**: `candidates.stage`, `jobs.status`, `jobs.level`, `jobs.location_type`, `jobs.employment_type`, `ai_interviews.recommendation`, `interview_questions.category`, `interview_questions.difficulty` — TypeScript types restrict to specific literals, but no DB-level CHECK or enum is asserted in any migration here. A buggy client write or admin SQL session can set `stage='UNKNOWN'` and break dashboards.
- **Fix**: Either create Postgres ENUMs (matching `types/index.ts`) and ALTER COLUMN to those types, or add CHECK constraints listing each allowed value.
- **Wave 2 task**: Add CHECK or ENUM coverage for every stage / status / category / difficulty / recommendation column.

### MEDIUM

#### [MED-S] `pregenerated_questions` has no INSERT policy under RLS — service-role-only insert
- **File**: `supabase/migrations/20260203_002_rls_policies.sql:561-589`
- **Finding**: Only SELECT/UPDATE/DELETE policies exist. With RLS enabled, no INSERT policy means the only way to create a row is the service role (RLS-bypassing). This appears intentional ("system creates these via background jobs") but is undocumented at the policy level and will silently break if any client-side code tries to insert.
- **Fix**: Add an explicit comment policy or a `WITH CHECK (false)` policy named clearly, e.g.:
  ```sql
  CREATE POLICY "No client inserts to pregenerated_questions"
    ON pregenerated_questions FOR INSERT TO authenticated WITH CHECK (false);
  ```
- **Wave 2 task**: Add explicit deny-INSERT policy (or a comment + monitoring) on `pregenerated_questions`.

#### [MED-S] `interview_questions` INSERT policy missing — same situation
- **File**: `supabase/migrations/20260203_002_rls_policies.sql:391-392` (comment only)
- **Finding**: Same as above. Service-role-only by omission. Document and harden.
- **Fix**: Add explicit deny-INSERT policy or scope to a SECURITY DEFINER function.
- **Wave 2 task**: Add explicit deny-INSERT policy on `interview_questions`.

#### [MED-S] `user_owns_job()` falls back to "any recruiter" when `created_by IS NULL`
- **File**: `supabase/migrations/20260203_001_enable_rls_all_tables.sql:112-117`
- **Finding**: When `jobs.created_by IS NULL` (legal because the FK was dropped and column made nullable), the function returns true for any user with role recruiter/hiring_manager/admin. Combined with BLOCKER-S #3 (recruiter can insert with `created_by = NULL`), every recruiter on the platform owns every NULL-creator job, including its candidates and interviews. This is the "MVP mode" backdoor and must be removed before launch.
- **Fix**: Remove the fallback. Once `jobs.created_by` is `NOT NULL`, the entire `IF job_created_by IS NULL` branch becomes dead code and can be deleted.
- **Wave 2 task**: Drop the `created_by IS NULL` cross-org fallback in `user_owns_job()`.

#### [MED-S] Helper function `is_admin()` (and friends) don't restrict to current org
- **File**: `supabase/migrations/20260203_001_enable_rls_all_tables.sql:166-175`
- **Finding**: `is_admin()` returns true for any admin in any org. Then policies like "Admins can delete jobs" still gate on `user_owns_job(id)`, so cross-org admins can't delete cross-org jobs. But "Admins can view all profiles" (`002_rls_policies.sql:55-58`) and "Admins can update profiles" (L80-84) have **no org check** — an admin in org A can read and modify every profile across every org. Multi-tenant data leak.
- **Fix**:
  ```sql
  CREATE POLICY "Admins can view all profiles"
    ON profiles FOR SELECT TO authenticated
    USING (is_admin() AND organization_id = get_user_organization_id());
  -- same for UPDATE / DELETE
  ```
- **Wave 2 task**: Scope all profiles admin policies to `organization_id = get_user_organization_id()`.

#### [MED-S] RLS condition uses email join — global single-tenant leak vector
- **File**: `supabase/migrations/20260203_002_rls_policies.sql:182-187, 247-257, 282-300, 342-389`
- **Finding**: "Candidate can see own applications" matches by `candidates.email = profiles.email`. If a candidate signs up for the recruiter portal with the same email they used to apply elsewhere, they can read every application across all jobs/orgs that share that email. There's no `job_id` or `org` scoping. Email is also user-controlled at signup; no email-verification gate is referenced. Recommend matching by `candidate_id ↔ profile_id` instead via an explicit linkage column.
- **Fix**: Add `candidates.profile_id UUID REFERENCES profiles(id)` populated when an authenticated user applies, and rewrite the policy to `candidates.profile_id = auth.uid()` with email as a secondary fallback only behind `email_confirmed_at IS NOT NULL`.
- **Wave 2 task**: Introduce `candidates.profile_id` and migrate candidate self-access policies off of email matching.

#### [MED-M] No automatic `total_applicants` / `active_candidates` triggers asserted
- **File**: `supabase/migrations/` (none)
- **Finding**: `Job.total_applicants` and `Job.active_candidates` exist in `types/index.ts:196-198`. With public anon INSERT on candidates, somebody must keep these counters honest. No trigger function is defined in any migration. If this is done in app code, it races; if not, the dashboards lie.
- **Fix**: Add an AFTER INSERT/UPDATE/DELETE trigger on `candidates` that recomputes counters per `job_id`, or replace the columns with views that aggregate live.
- **Wave 2 task**: Add a counter-maintenance trigger on `candidates` (or replace columns with a view).

#### [MED-S] `interview_questions` has no UPDATE-only-when-unanswered guard for candidates
- **File**: `supabase/migrations/20260203_002_rls_policies.sql:369-389`
- **Finding**: Candidates can UPDATE their interview_questions rows freely. After they submit an answer, they can update again indefinitely (or after the recruiter has scored). Should be: UPDATE allowed only while `candidate_answer IS NULL` and `ai_interviews.status IN ('sent','in_progress')`.
- **Fix**: Tighten the policy with `WITH CHECK (candidate_answer IS NOT NULL)` (insert once) and add a status check via a SECURITY DEFINER helper.
- **Wave 2 task**: Lock candidate UPDATE on `interview_questions` to a single submission per question.

#### [MED-S] No index on `ai_interviews.access_token` for unauthenticated lookups
- **File**: `supabase/migrations/` (none)
- **Finding**: The interview-taking flow looks up by `access_token`. No index asserted in this repo. This is a hot path on every invite click.
- **Fix**: `CREATE UNIQUE INDEX idx_ai_interviews_access_token ON ai_interviews(access_token);`
- **Wave 2 task**: Add unique index on `ai_interviews.access_token`.

#### [MED-S] `candidate_activities` performed_by has no FK
- **File**: `supabase/migrations/` (none — `types/index.ts:367` says nullable UUID)
- **Finding**: No FK to `profiles(id)`. Activity log can reference deleted profile UUIDs forever. Audit history becomes meaningless.
- **Fix**: `ALTER TABLE candidate_activities ADD CONSTRAINT candidate_activities_performed_by_fkey FOREIGN KEY (performed_by) REFERENCES profiles(id) ON DELETE SET NULL;`
- **Wave 2 task**: Add FK on `candidate_activities.performed_by` with `ON DELETE SET NULL`.

#### [MED-S] Tests are descriptive, not assertive
- **File**: `supabase/tests/rls_tests.sql`
- **Finding**: The "tests" only INSERT data and `RAISE NOTICE` reminders ("verify this user cannot see…"). No `pgTAP` `ok()` / `is()` calls, no failing assertions. They cannot run in CI as pass/fail. Cross-org isolation, candidate-scoped reads, anonymous-only-published — none are programmatically verified.
- **Fix**: Adopt `pgTAP`, write real assertions: `SELECT plan(N); … SELECT is(...)`. Run via `supabase test db` in CI.
- **Wave 2 task**: Convert `rls_tests.sql` to pgTAP, add it to CI.

#### [MED-S] Test file references nonexistent table `candidate_activity` (singular)
- **File**: `supabase/tests/rls_tests.sql:51,402`
- **Finding**: RLS migrations reference `candidate_activities` (plural). Test file deletes from `candidate_activity` (singular). Either the test will fail at runtime with `relation does not exist`, or the live DB has *both* tables and one is dead.
- **Fix**: Rename to `candidate_activities` in tests; verify there is no orphan `candidate_activity` table.
- **Wave 2 task**: Fix table name typo in `rls_tests.sql` and confirm only `candidate_activities` exists.

### LOW

#### [LOW-S] Comment claims FK is "temporarily" disabled but no follow-up migration
- **File**: `supabase/migrations/20260130_remove_profile_fk_for_mvp.sql:17`
- **Finding**: Self-explanatory tech debt marker. Captured under BLOCKER-S #5; this is just a tracking note.
- **Fix**: See BLOCKER-S #5.
- **Wave 2 task**: Covered by FK restoration task.

#### [LOW-S] `pregenerated_questions.model_used` defaults to a hardcoded GPT version
- **File**: `supabase/migrations/20260130_add_pregenerated_questions.sql:19`
- **Finding**: `DEFAULT 'gpt-4o-2024-08-06'` will rot. Move default to app config.
- **Fix**: `ALTER TABLE pregenerated_questions ALTER COLUMN model_used DROP DEFAULT;`
- **Wave 2 task**: Drop hardcoded model default; supply from application code.

#### [LOW-S] Many partial indexes on `ai_interviews` overlap
- **File**: `supabase/migrations/20260130_add_interview_reviewed.sql:11-18`, `20260130_add_interview_scheduling.sql:14-22`
- **Finding**: Four partial indexes on `ai_interviews(status, scheduled_at)`, `(scheduled_at)`, `(reviewed_at)`, `(status, reviewed_at)`. Once volume grows these duplicate maintenance cost. Worth a benchmark to consolidate.
- **Fix**: Consolidate into one or two composite indexes after measuring query patterns.
- **Wave 2 task**: Benchmark and consolidate `ai_interviews` partial indexes.

#### [LOW-S] No timestamps trigger documented for most tables
- **File**: `supabase/migrations/20260130_add_pregenerated_questions.sql:49-60`
- **Finding**: Only `pregenerated_questions` has an `updated_at` trigger in repo. Other tables (`profiles`, `jobs`, `candidates`, `ai_interviews`) presumably have one in the missing base schema. Document and standardize.
- **Fix**: Once base schema is dumped, ensure a single `set_updated_at()` function and identical triggers across tables.
- **Wave 2 task**: Standardize `updated_at` triggers across all tables.

#### [LOW-S] `types/database.ts` referenced in audit brief does not exist
- **File**: `types/index.ts` is the only types file
- **Finding**: There is no generated `types/database.ts` from `supabase gen types typescript`. The hand-written `types/index.ts` is what consumers use. Drift between hand-written types and live DB is inevitable.
- **Fix**: Add `pnpm supabase gen types typescript --linked > types/database.ts` to CI; have `types/index.ts` import the generated `Database` type for table shapes.
- **Wave 2 task**: Generate `types/database.ts` from Supabase and wire it into `types/index.ts`.

---

## Migrations needed before launch (ordered)

1. **Dump and commit base schema** — `00000000000000_initial_schema.sql` from `supabase db dump`.
2. **Restore FKs** — `profiles.id → auth.users(id) ON DELETE CASCADE`, `jobs.created_by → profiles(id) ON DELETE SET NULL`, `ai_interviews.reviewed_by`, `candidate_activities.performed_by`, plus all child-table FKs (`candidates.job_id`, `ai_interviews.candidate_id/job_id`, `interview_questions.interview_id`, `candidate_activities.candidate_id`) with explicit cascade behavior.
3. **Delete MVP placeholder data** — `DELETE FROM profiles WHERE id = '00000000-0000-0000-0000-000000000000'` and any rows referencing it (after backfilling real `created_by` / `performed_by`).
4. **Tighten profiles INSERT policy** — pin `id = auth.uid()` and `role = 'candidate'`.
5. **Tighten jobs INSERT policy** — `WITH CHECK (… AND created_by = auth.uid())`; restore `NOT NULL`.
6. **Remove `created_by IS NULL` fallback** in `user_owns_job()`.
7. **Scope admin profile policies to org** — admins should not read other orgs' profiles.
8. **Add `UNIQUE(job_id, lower(email))` on candidates** — after dedupe.
9. **Add NOT NULL + length/format CHECKs** on user-input columns across `candidates`, `jobs`, `ai_interviews`.
10. **Add stage/status/category/difficulty CHECK or ENUM constraints**.
11. **Add missing indexes** — `candidates(job_id)`, `candidate_activities(candidate_id, created_at DESC)`, `candidate_activities(performed_by)`, `ai_interviews(access_token)` UNIQUE, partial `jobs(published_at DESC) WHERE active`.
12. **Fix avatars storage policies** — switch path convention to `<uid>/<file>` and use `storage.foldername()`.
13. **Add explicit deny-INSERT policies** on `interview_questions` and `pregenerated_questions`.
14. **Add `candidates.profile_id`** and migrate self-access policies off of email matching.
15. **Convert RLS tests to pgTAP** and add to CI.
16. **Generate `types/database.ts`** from Supabase and import into `types/index.ts`.

---

## RLS posture per table

| Table | RLS enabled | Public SELECT | Public INSERT | Self SELECT | Org SELECT | Org write | Admin DELETE | Verdict |
|---|---|---|---|---|---|---|---|---|
| `profiles` | yes | no | **yes (open INSERT)** | yes (auth.uid=id) | yes (org members) | self + admin | admin only | **broken — open INSERT, admin not org-scoped** |
| `jobs` | yes | yes (active+!archived) | no | n/a | recruiter+ in org | recruiter+ (created_by not pinned) | admin in org | **broken — INSERT does not pin created_by; NULL fallback owns globally** |
| `candidates` | yes | no | **yes (anon+auth, no constraints)** | by email | recruiter+ in org | recruiter+ in org | recruiter+ in org | **fragile — open insert with no dedupe / size cap** |
| `ai_interviews` | yes | no | no | by email | recruiter+ in org | candidate self + recruiter+ | admin in org | mostly OK; candidate UPDATE too permissive |
| `interview_questions` | yes | no | service-role only (no policy) | candidate via email join | recruiter+ in org | candidate self + recruiter+ | admin in org | OK; tighten candidate UPDATE to once-only |
| `candidate_activities` | yes | no | recruiter+ | n/a | recruiter+ in org | INSERT only (immutable) | admin in org | OK |
| `pregenerated_questions` | conditional | no | service-role only | n/a | recruiter+ in org | recruiter+ in org | admin in org | OK if table exists; add deny-INSERT policy |
| `candidate_comments` | conditional | no | recruiter+ self-author | n/a | recruiter+ in org | author + admin | author + admin | OK if table exists |
| `notifications` | conditional | no | self only | self only | n/a | self | self | OK if table exists |
| `storage.objects (avatars)` | yes | yes (bucket public) | uid-by-prefix-string-match | n/a | n/a | uid-by-prefix-string-match | uid-by-prefix-string-match | **broken — `split_part(name,'-',1)` only matches first 8 hex chars of UUID** |
