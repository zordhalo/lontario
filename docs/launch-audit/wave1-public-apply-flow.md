# Wave 1 Audit — Public Application Flow

**Scope**: Audit the candidate-side experience required for an applicant to land on a public URL, see a job, and submit a resume + GitHub profile.

**Verdict**: The public flow does not exist. There is no `/apply` page, no public job index, no public job-detail page, no file upload for resumes, no recruiter notification on application, and no candidate confirmation email. The marketing landing page links to `/jobs` (CTA) but that path resolves only inside `app/(dashboard)/jobs/` which is gated by the dashboard layout — the CTA is effectively broken for unauthenticated visitors.

Severity legend: BLOCKER (ship-stopper), HIGH (ship-without-it = bad UX/security), MEDIUM (post-launch fast-follow), LOW (nice-to-have). Effort: S (<1d), M (1–3d), L (>3d).

---

## BLOCKERS

### [BLOCKER-M] No public job-listing or job-detail page
- **File**: missing (only `app/(dashboard)/jobs/page.tsx`, `app/(dashboard)/jobs/[id]/page.tsx` exist — both behind dashboard layout/auth grouping)
- **Finding**: There is no public-facing route where a candidate can view an open role. `app/(marketing)/` only contains `layout.tsx` and `page.tsx` (the landing page). The landing CTA in `components/landing/cta.tsx:25` links to `/jobs` but that path collides with the dashboard route group and is inaccessible to anonymous users in the intended applicant flow.
- **Fix**:
  1. Create `app/(marketing)/jobs/page.tsx` — public index of `jobs` with `status = 'active'`.
  2. Create `app/(marketing)/jobs/[id]/page.tsx` — public job detail rendering title, description, location, requirements, and an "Apply" CTA pointing to `/apply/[id]`.
  3. Add a server action or `GET /api/public/jobs` that returns only `status='active'` jobs and strips internal fields (e.g., `score_threshold`, internal_notes).
  4. Disambiguate the dashboard route — rename `app/(dashboard)/jobs` to `app/(dashboard)/admin/jobs` or move the public index to `/careers` so the namespaces don't collide.
- **Wave 2 task**: Build public marketing routes `/jobs` and `/jobs/[id]` reading active jobs from a new `GET /api/public/jobs` endpoint.

### [BLOCKER-M] No public `/apply/[jobId]` page
- **File**: missing
- **Finding**: `POST /api/candidates` accepts public submissions, but there is no UI that calls it for unauthenticated visitors. The only candidate-creation UI is `components/jobs/add-candidate-dialog.tsx` (recruiter-only, lives inside the dashboard, uses `useCreateCandidate` which hits the same endpoint).
- **Fix**:
  1. Create `app/(marketing)/apply/[id]/page.tsx` — server component that fetches the job (404 on missing/closed) and renders a client form.
  2. Use `add-candidate-dialog.tsx` as the field baseline — see [HIGH-S] below for fields to strip.
  3. Add a thank-you state route `app/(marketing)/apply/[id]/success/page.tsx` (or render in-place) showing "We received your application".
- **Wave 2 task**: Create `app/(marketing)/apply/[id]/page.tsx` with a public application form mirroring the candidate fields from `add-candidate-dialog.tsx` minus recruiter-only fields, plus a resume file upload.

### [BLOCKER-M] No resume PDF upload pipeline
- **File**: `app/api/candidates/route.ts:33-45` (schema), `app/api/candidates/route.ts:244-252` (insert)
- **Finding**: The `createCandidateSchema` only accepts text fields (no `resume_url`, no `resume_filename`, no file). However `types/index.ts:230-232` already declares `resume_url`, `resume_filename`, `resume_text` on the candidate row, so the DB column likely exists but is unused on the public flow. Missing pieces:
  1. **Storage bucket**: no `resumes` bucket migration exists in `supabase/migrations/` (only `avatars` at `20260204_create_avatars_bucket.sql`).
  2. **Signed-upload route handler**: missing — there is no `POST /api/candidates/upload-url` or equivalent that returns a Supabase signed upload URL.
  3. **Client uploader**: missing — no `<ResumeUpload>` component; `components/avatar-upload.tsx` is the only file-uploader and is auth-gated.
  4. **Schema accept**: `createCandidateSchema` does not include `resume_url`/`resume_filename`.
  5. **Text extraction**: `lib/ai/scoring.ts:81` reads `candidate.resume_text || candidate.cover_letter`. There is no PDF→text pipeline to populate `resume_text` from an uploaded PDF, so AI scoring gets degraded input. `app/api/ai/parse-resume/route.ts` accepts a text string only, not a file.
- **Fix**:
  1. Add migration `supabase/migrations/2026XXXX_create_resumes_bucket.sql` (see avatars-parallel below).
  2. Add `app/api/candidates/upload-url/route.ts` that returns a one-shot signed upload URL scoped to a `pending/{uuid}.pdf` key. Validate MIME (`application/pdf`), 10 MB cap, no auth required but rate-limit per IP.
  3. Add `components/apply/resume-upload.tsx` (client) using `@supabase/supabase-js` `storage.from('resumes').uploadToSignedUrl(...)`.
  4. Extend `createCandidateSchema` with `resume_url: z.string().url().optional()`, `resume_filename: z.string().optional()`.
  5. After insert, call a server-side PDF→text utility (e.g., `pdf-parse` or `unpdf`) to populate `resume_text`. Run before `processAndScoreCandidate` so scoring sees real content.
- **Wave 2 task**: Ship the resumes Supabase bucket, signed-URL route, client uploader, schema extension, and PDF text extraction so applicants can submit a PDF that flows into AI scoring.

### [BLOCKER-S] Marketing CTA points at a non-public route
- **File**: `components/landing/cta.tsx:25` (`<Link href="/jobs">`); `components/landing/hero.tsx:82` (`<Link href="/dashboard">`); `components/landing/navbar.tsx:131,136,173,178` (all CTAs to `/dashboard`)
- **Finding**: Hero, Navbar, and CTA target `/dashboard` (recruiter sign-in) or `/jobs` (which is dashboard-only). There is zero applicant-facing entry point on the landing page. This is the entire candidate journey starting point.
- **Fix**: Once public `/jobs` exists, repoint `cta.tsx` to `/jobs`, repoint at least one Hero button (or add a third) to "Apply for a job" → `/jobs`. Keep recruiter CTAs but make them secondary.
- **Wave 2 task**: Update landing CTAs to add a candidate-side entry point pointing to the new public `/jobs` index.

---

## HIGH

### [HIGH-S] No recruiter notification on new application
- **File**: `app/api/candidates/route.ts:244-275` — Resend is wired up (`lib/email/index.ts`, `lib/email/templates.ts`) but `POST /api/candidates` only triggers `processAndScoreCandidate` after insert; no email is sent.
- **Finding**: `lib/email/index.ts` exports `sendEmail` and helpers for `interview_scheduled`, `interview_completed`, `interview_rescheduled`, `interview_cancelled` — but no `application_received` (recruiter) or `application_confirmation` (candidate) types exist.
- **Fix**:
  1. Add two new template types in `lib/email/templates.ts`: `application_received` (to recruiter — fetch job → resolve recruiter email/owner) and `application_confirmation` (to applicant).
  2. After successful insert in `app/api/candidates/route.ts:252` and before the fire-and-forget scoring call, dispatch both emails (also fire-and-forget but with logging).
  3. For the recruiter address, resolve from `jobs.created_by` → profiles/auth.users; for MVP, env-var `DEFAULT_RECRUITER_EMAIL` is acceptable.
- **Wave 2 task**: Wire Resend `application_received` and `application_confirmation` templates into the candidate-create endpoint.

### [HIGH-S] Public form fields — strip recruiter-only inputs from baseline
- **File**: `components/jobs/add-candidate-dialog.tsx:32-41` (form schema), :64-76 (defaults), :255-end (UI)
- **Finding**: The recruiter dialog collects: `full_name`, `email`, `phone`, `location`, `linkedin_url`, `github_url`, `portfolio_url`, `cover_letter`. All are appropriate for a candidate to enter themselves. However the dialog also sets `source: "manual"` (line 96) — this should be `source: "public_apply"` for the public form to distinguish recruiter-added vs self-applied candidates downstream. Note: there are no truly recruiter-only fields (no internal notes, no stage selector, no AI-score override) in the dialog itself, so it is a clean baseline. However the public form must additionally include a resume PDF upload (currently absent — see BLOCKER above) and should NOT auto-poll AI scoring in-band (`pollCandidateUntilScored`, line 110) because that ties up the applicant's browser for up to 30 s; replace with a "we'll be in touch" success screen.
- **Fix**: Build `components/apply/public-application-form.tsx` based on `add-candidate-dialog.tsx` but: (a) drop the `Dialog` chrome, (b) drop the `pollCandidateUntilScored` polling overlay, (c) add a `resume` file input, (d) set `source: "public_apply"`, (e) replace `useCreateCandidate` (auth-aware hook) with a plain `fetch('/api/candidates', ...)` so the form works for anonymous users.
- **Wave 2 task**: Extract the form schema from `add-candidate-dialog.tsx` into `components/apply/public-application-form.tsx` adding resume upload and removing the recruiter-only progress-poll overlay.

### [HIGH-S] No GitHub-URL real-user validation — spam vector
- **File**: `lib/ai/github.ts:47-159` (`fetchGitHubProfile`), `:164-188` (extractors)
- **Finding**: `extractGitHubUsername` only validates the URL shape — it accepts `https://github.com/asdfasdfasdf123` without checking the user exists. The user is only verified later when `fetchGitHubProfile` calls `/users/{username}` (which 404s), but that happens inside the fire-and-forget `processAndScoreCandidate` (`app/api/candidates/route.ts:264`) — by then the candidate row is already inserted. A spammer can flood the table with fake URLs and consume AI tokens (each retry hits OpenAI in `lib/ai/scoring.ts`). Also there is no `URL.host === 'github.com'` check on the public schema (`createCandidateSchema.github_url: z.string().url()` accepts any URL).
- **Fix**:
  1. In `createCandidateSchema` (`app/api/candidates/route.ts:40`) tighten `github_url` to `.refine(u => new URL(u).host === 'github.com')`.
  2. Pre-flight: before insert, call `HEAD https://api.github.com/users/{username}` (single request, ~50 ms with token). On 404, reject with `INVALID_GITHUB`.
  3. Add a simple Cloudflare/Turnstile or hCaptcha gate on the public form.
- **Wave 2 task**: Add host-restriction + GitHub user-existence pre-flight to `POST /api/candidates`, and put a CAPTCHA on the public form.

### [HIGH-S] Duplicate-prevention race condition — no DB unique index
- **File**: `app/api/candidates/route.ts:228-241` (read-then-write); migrations searched in `supabase/migrations/` — no `UNIQUE (job_id, email)` constraint exists.
- **Finding**: The `.single()` lookup at line 229 is a TOCTOU race: two simultaneous POSTs from the same applicant both see "no existing", both insert. Without a DB-level unique index, duplicates land. `supabase/migrations/20260203_001_enable_rls_all_tables.sql` and the candidate-related migrations only add RLS, avatar columns, archive flags, and pregeneration columns — no unique constraint on `(job_id, email)`.
- **Fix**:
  1. Add migration `2026XXXX_unique_candidate_email_per_job.sql`:
     ```
     CREATE UNIQUE INDEX IF NOT EXISTS uq_candidates_job_email
     ON candidates (job_id, lower(email))
     WHERE is_archived = false;
     ```
  2. In `route.ts`, replace the read-then-write with `INSERT ... ON CONFLICT DO NOTHING RETURNING *` (or catch the unique-violation error code `23505` and return the same `DUPLICATE` response).
- **Wave 2 task**: Add a partial unique index on `(job_id, lower(email))` and translate `23505` violations into the existing `DUPLICATE` 409 response.

### [HIGH-S] Fire-and-forget AI scoring — Vercel function will be killed
- **File**: `app/api/candidates/route.ts:264-275` (`processAndScoreCandidate(...).catch(...)` — no `await`, no `waitUntil`)
- **Finding**: Vercel serverless functions terminate as soon as the response is sent (or shortly after). Background promises that started before the response are not guaranteed to complete — they are routinely killed mid-execution. `processAndScoreCandidate` performs multi-step work: GitHub fetch (1–3 s), OpenAI scoring call (5–20 s), DB update. Total can exceed 10 s. On Hobby tier the default 10 s wall clock + immediate termination after `res.send` means many candidates will land with `ai_score = null` and stay that way.
- **Fix** (pick one):
  1. **Easiest**: wrap with Vercel's `waitUntil` from `next/server` / `@vercel/functions` — `waitUntil(processAndScoreCandidate(...))`. This explicitly tells the runtime to keep the invocation alive up to its max duration.
  2. **Better**: enqueue to a queue (Vercel Queues, Upstash QStash, Inngest, Trigger.dev) and have a worker process. The cron route pattern is already used in `app/api/cron/`.
  3. **Acceptable interim**: store pending rows and have an existing cron route (`app/api/cron/`) sweep `candidates WHERE ai_score IS NULL AND created_at < now() - interval '1 minute'` and re-score.
- **Wave 2 task**: Replace bare promise with `waitUntil(processAndScoreCandidate(...))` and add a cron sweeper for any `ai_score IS NULL` candidates older than 5 minutes as a safety net.

### [HIGH-S] Need `resumes` Storage bucket migration parallel to `avatars`
- **File**: model after `supabase/migrations/20260204_create_avatars_bucket.sql`
- **Finding**: The avatars migration creates a public bucket with auth-scoped INSERT/UPDATE/DELETE keyed off `auth.uid()` in the filename. That pattern does NOT work for resumes because (a) applicants are not authenticated, and (b) resumes must NOT be public — they contain PII (phone, address, work history).
- **Fix** — create `supabase/migrations/2026XXXX_create_resumes_bucket.sql`:
  - `INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES ('resumes', 'resumes', false, 10485760, ARRAY['application/pdf']) ON CONFLICT DO NOTHING;`
  - **No public SELECT policy** — recruiters access via short-lived signed URL minted server-side.
  - INSERT policy: allow `anon` and `authenticated` roles to upload only into `pending/` prefix (objects keyed by random UUID server-side); enforce via signed upload URLs minted by `app/api/candidates/upload-url/route.ts` so the client can never upload outside that prefix.
  - SELECT policy: only `service_role` (server-side) and `authenticated` recruiters whose `user_id` owns the parent `candidates.job_id`. RLS join: `EXISTS (SELECT 1 FROM candidates c JOIN jobs j ON j.id = c.job_id WHERE c.resume_url LIKE '%' || storage.objects.name AND j.created_by = auth.uid())`.
  - On retention: add a cleanup job to delete objects whose key starts with `pending/` and have no matching `candidates.resume_url` after 24 h (orphans from abandoned forms).
- **Wave 2 task**: Add a private `resumes` bucket migration with anon-INSERT-via-signed-url-only and recruiter-scoped SELECT via candidate→job ownership.

---

## MEDIUM

### [MEDIUM-S] No rate limit on `POST /api/candidates`
- **File**: `app/api/candidates/route.ts:190` (no rate limit applied)
- **Finding**: The endpoint is publicly callable with no per-IP throttle. Combined with the GitHub-spam vector and OpenAI cost per submission, this is a budget-burn risk. Recent commit `1de1b44 Add rate limiting, CORS, security headers, Sentry AI` suggests middleware exists — verify it covers this route.
- **Fix**: Apply existing rate-limit middleware (likely Upstash) to the POST handler — e.g., 5/min per IP, 20/day per IP.
- **Wave 2 task**: Confirm/extend the rate-limiter to cover `POST /api/candidates` and `POST /api/candidates/upload-url`.

### [MEDIUM-S] `email` not normalized — duplicate-prevention bypass
- **File**: `app/api/candidates/route.ts:35,233`
- **Finding**: `z.string().email()` accepts `Foo@Example.com` and `foo@example.com` as different keys. Both the `.eq("email", ...)` lookup and any future unique index will treat them as distinct.
- **Fix**: Add `.transform(s => s.toLowerCase().trim())` on the email field in `createCandidateSchema`. Pair with the partial index on `lower(email)` from [HIGH-S] above.
- **Wave 2 task**: Lowercase + trim email in the schema and use `lower(email)` in the unique index.

### [MEDIUM-S] Public POST does not enforce `host === 'linkedin.com'` either
- **File**: `app/api/candidates/route.ts:39-41`
- **Finding**: `linkedin_url` and `portfolio_url` accept any URL; an attacker can store arbitrary URLs (e.g., phishing) viewable later by recruiters in the dashboard.
- **Fix**: Restrict `linkedin_url` to `linkedin.com`. Leave `portfolio_url` open but display with `rel="noopener noreferrer nofollow"` (already used in `hero.tsx:91`).
- **Wave 2 task**: Tighten URL host validation on linkedin_url and ensure recruiter UI renders external links with `rel="noopener noreferrer nofollow"`.

### [MEDIUM-S] No CAPTCHA / honeypot on the public form
- **File**: missing
- **Finding**: Zero bot mitigation on a public POST that triggers OpenAI calls.
- **Fix**: Add Cloudflare Turnstile (free) or hCaptcha. Validate token server-side in `POST /api/candidates`.
- **Wave 2 task**: Add Turnstile to the public form and verify the token in `POST /api/candidates`.

### [MEDIUM-M] No resume virus scan
- **File**: missing
- **Finding**: Recruiters will download applicant-uploaded PDFs from the dashboard. Without scanning, a malicious PDF can target recruiter machines.
- **Fix**: Run uploads through a scanner — e.g., Cloudmersive, ClamAV via a worker, or VirusTotal. Quarantine suspicious files and don't expose `resume_url` until clean.
- **Wave 2 task**: Add an async virus scan step before exposing `resume_url` to recruiter UI.

---

## LOW

### [LOW-S] Robots / SEO for public job pages
- **File**: missing
- **Finding**: Once `/jobs/[id]` is public, you'll want `JobPosting` JSON-LD and a sitemap. Not blocking.
- **Fix**: Add `app/sitemap.ts` and `JobPosting` schema in the page metadata.
- **Wave 2 task**: Emit `JobPosting` JSON-LD and a sitemap entry per active job.

### [LOW-S] OG / social-share preview for job pages
- **File**: missing
- **Finding**: No OpenGraph image for shared job links.
- **Fix**: Add `app/(marketing)/jobs/[id]/opengraph-image.tsx`.
- **Wave 2 task**: Generate per-job OG images.

### [LOW-S] Accessibility audit of the application form
- **File**: `components/jobs/add-candidate-dialog.tsx` (baseline)
- **Finding**: Required-field markers use a `*` in the visible label only, not `aria-required`. Acceptable with `react-hook-form` validation but worth confirming in the public form.
- **Fix**: Add `aria-required="true"` and `aria-invalid` on required inputs.
- **Wave 2 task**: A11y pass on the public form.

---

## Minimum public-flow shopping list

Files to create, in order, to ship a working applicant flow:

1. `supabase/migrations/2026XXXX_unique_candidate_email_per_job.sql` — partial unique index on `(job_id, lower(email))`.
2. `supabase/migrations/2026XXXX_create_resumes_bucket.sql` — private `resumes` bucket; anon-INSERT-via-signed-URL only; recruiter-scoped SELECT via candidate→job ownership.
3. `app/api/public/jobs/route.ts` — `GET` returns `status='active'` jobs (stripped fields).
4. `app/api/public/jobs/[id]/route.ts` — `GET` returns one active job.
5. `app/api/candidates/upload-url/route.ts` — `POST` returns a signed Supabase upload URL for `resumes/pending/{uuid}.pdf`; rate-limited per IP.
6. `lib/email/templates.ts` — add `application_received` and `application_confirmation` template types.
7. Edits to `app/api/candidates/route.ts`:
   - extend schema with `resume_url`, `resume_filename`; lowercase `email`; tighten `github_url`/`linkedin_url` hosts;
   - GitHub user existence pre-flight;
   - replace read-then-write dup-check with `ON CONFLICT` handling;
   - replace bare promise with `waitUntil(processAndScoreCandidate(...))`;
   - dispatch `application_received` and `application_confirmation` emails.
8. `lib/pdf/extract-text.ts` — server-side PDF→text utility called before scoring to populate `resume_text`.
9. `components/apply/resume-upload.tsx` — client uploader using the signed URL.
10. `components/apply/public-application-form.tsx` — derived from `add-candidate-dialog.tsx`, no Dialog chrome, no in-band scoring poll, with resume upload + Turnstile, `source: 'public_apply'`.
11. `app/(marketing)/jobs/page.tsx` — public job index.
12. `app/(marketing)/jobs/[id]/page.tsx` — public job detail with "Apply" CTA.
13. `app/(marketing)/apply/[id]/page.tsx` — server component fetching the job + rendering the public form; success state inline or at `apply/[id]/success`.
14. Edits to `components/landing/cta.tsx`, `components/landing/hero.tsx`, `components/landing/navbar.tsx` — add a candidate-side CTA pointing to `/jobs`.
15. (Optional safety net) `app/api/cron/score-pending-candidates/route.ts` — sweep candidates with `ai_score IS NULL` older than 5 min.

Once 1–14 land, an applicant can: visit landing → click "Browse jobs" → open a job → click "Apply" → fill form, upload PDF, submit → receive confirmation email; recruiter receives notification email; AI scoring completes via `waitUntil` (or the cron sweeper as backup).
