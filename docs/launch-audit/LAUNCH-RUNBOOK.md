# Lontario Launch Runbook

After Wave 3, the foundation + product surface are in place. This runbook walks the **only-you-can-do-it** steps to go live.

## 1. Vercel project setup

```bash
vercel link
vercel domains add lontario.lol
vercel domains add www.lontario.lol  # optional
```

## 2. Environment variables (Vercel dashboard → Project → Settings → Environment Variables)

Copy from `.env.example`. Set for **Production** AND **Preview** environments.

**Required:**
- `NEXT_PUBLIC_SUPABASE_URL` — from Supabase project settings
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase project anon key
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase service role (server-only, **never** prefix with NEXT_PUBLIC)
- `NEXT_PUBLIC_APP_URL` = `https://lontario.lol`
- `RESEND_API_KEY` — from Resend dashboard
- `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` — from Upstash console
- `CRON_SECRET` — generate with `openssl rand -hex 32`; also set in Vercel Cron settings

**Required for AI scoring** (otherwise candidates are inserted but unscored):
- `OPENAI_API_KEY`
- `GITHUB_TOKEN` — personal access token, no scopes needed (public API only)

**Optional but recommended:**
- `NEXT_PUBLIC_SENTRY_DSN` — error tracking
- `SENTRY_AUTH_TOKEN` — for source map uploads (CI)
- `EMAIL_FROM` = `Lontario <hello@lontario.lol>` (default if unset)
- `RECRUITER_NOTIFICATION_EMAIL` = `brian@creatin.ca` (default if unset)
- `AI_BUDGET_DAILY_USD` = `25` (hard cap on AI spend per day; default 25)
- `PROXYCURL_API_KEY` — LinkedIn enrichment; if unset, LinkedIn data is skipped (no error)
- `BOTID_VERIFY_URL` — Vercel BotID endpoint; if unset, BotID is no-op and we rely on rate limits

## 3. Supabase setup

1. Create project at supabase.com if not done.
2. Run migrations in order:
   ```bash
   supabase link --project-ref <ref>
   supabase db push
   ```
   Or apply manually via SQL editor in this order:
   - All existing `2026013*` and `2026020*` migrations
   - `20260504_001_wipe_mvp_seed_data.sql` (only safe if you've never run a real signup yet — otherwise skip)
   - `20260504_002_base_schema_assertions.sql`
   - `20260504_003_rls_singleuser.sql`
   - `20260504_004_resumes_bucket.sql`
   - `20260504_005_waitlist.sql`

## 4. Create your recruiter account

After deploy:
1. Visit `https://lontario.lol/register`, sign up with `brian@creatin.ca`.
2. The auth trigger creates a `profiles` row with `role='candidate'`.
3. **Manually flip your profile to recruiter** in the Supabase SQL editor:
   ```sql
   UPDATE profiles SET role = 'recruiter' WHERE email = 'brian@creatin.ca';
   ```
4. Sign out and back in. You can now access `/dashboard`.

## 5. Resend domain verification

1. Resend dashboard → Domains → Add `lontario.lol`.
2. Add the DNS records they show (SPF, DKIM, optionally DMARC) to your domain DNS.
3. Wait for "Verified" status.
4. Until verified, **all transactional emails fail silently** (logged to Sentry, no candidate impact).

## 6. Vercel Cron

`vercel.json` already declares two cron jobs (`/api/cron/interview-reminders` every 15min, `/api/cron/interview-status` every 5min). After deploy, set `CRON_SECRET` in Vercel and verify cron runs in the Vercel dashboard → Cron tab.

## 7. Sanity smoke test (after deploy)

1. Visit `https://lontario.lol/` — should show landing with joke copy, "See open roles" CTA → `/jobs`.
2. Submit waitlist form → check Upstash for rate-limit keys, check Resend logs for delivery.
3. Sign in at `/login`, go to `/dashboard/jobs/new`, create a test job.
4. Open `/jobs` in incognito — should see the new job.
5. Apply at `/apply/[id]` with a test email + your real GitHub URL.
6. Check Supabase `candidates` table for the row, then re-check after ~30s for `ai_score` populated.
7. Check Resend logs for two emails (candidate confirmation + recruiter notification).

## 8. Known follow-ups (Wave 4 — not blocking launch)

- Integration tests under `tests/integration/api/` use MSW mocks; replace with real-handler tests using a recruiter session fixture.
- `app/api/sentry-example-api/route.ts` should be deleted or gated.
- Some lucide-react icons (`Github`, `Linkedin`) emit deprecation warnings — cosmetic only.
- `@supabase/ssr createServerClient` deprecated positional-args signature — needs migration when bumping `@supabase/ssr`.
- BotID widget on apply form is not installed; relying on per-IP + per-email rate limits + GitHub user pre-validation as the bot gate.
- `total_applicants` / `active_candidates` counters on `profiles` have no trigger — recomputed on each read.

## Cost ceilings, summarized

- AI: $25/day hard cap (env: `AI_BUDGET_DAILY_USD`)
- Resume uploads: 10 MB max, PDF/DOC/DOCX only
- Per-IP rate limits: 3 apply/min, 5 waitlist/min, 10 AI/min, 100 general/min
- Per-email rate limits: 2 apply/hour, 1 waitlist/hour
- BotID: fail-open without `BOTID_VERIFY_URL` (rate limits compensate)
