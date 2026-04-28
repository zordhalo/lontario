# Launch Synthesis — Wave 1 Findings

**Verdict: NOT shippable.** 7 agents found **33+ BLOCKERS** across auth, DB, AI cost, infra, frontend, and the public flow itself.

The single biggest issue: **the candidate-side product does not exist.** No `/apply` page, no resume upload, no email notifications, no public landing for a job. Everything else (auth disabled, DB policies broken, AI cost-DoS, fake landing copy, hidden type errors) compounds the risk if you put a public URL in front of it.

## Total counts by slice

| Slice | BLOCKER | HIGH | MED | LOW |
|---|---|---|---|---|
| Auth & access | 5 | 4 | 4 | 4 |
| Public apply flow | 6 | 4 | 3 | 2 |
| Database & RLS | 5 | 6 | 5 | 3 |
| AI cost & abuse | 6 | 5 | 3 | 2 |
| Infra & deploy | 4 | 9 | 7 | 4 |
| Frontend & UX | 4 | 6 | 8 | 5 |
| Tests & QA | 4 | 5 | 4 | 2 |
| **Total** | **34** | **39** | **34** | **22** |

## Top 10 most urgent (must clear to even consider launching)

1. **No public apply page.** Build `/apply/[jobId]` + `/jobs` index. (`wave1-public-apply-flow.md`, `wave1-frontend-ux.md`)
2. **Resume upload missing entirely.** Need `resumes` Storage bucket + signed-URL upload + schema field. (`wave1-public-apply-flow.md`)
3. **AI cost-DoS:** anonymous AI routes + 100/min general tier on `POST /api/candidates` + Proxycurl/OpenAI/GitHub fan-out per request. **$720–$3,000/hour single-IP burn rate.** (`wave1-ai-cost-abuse.md`)
4. **Auth disabled platform-wide** with `createAdminClient` bypassing RLS on `POST /api/jobs`, `POST /api/candidates/[id]/move`, `interviews/[id]/start`, `interviews/[id]/submit`. (`wave1-auth-security.md`)
5. **No base schema migration.** Project cannot be rebuilt from this repo; only ALTER migrations exist. (`wave1-database-rls.md`)
6. **`profiles` INSERT policy is `WITH CHECK (true)`** — anyone can self-promote to admin. `jobs.created_by` ownership has a `NULL` backdoor. (`wave1-database-rls.md`)
7. **`processAndScoreCandidate` fire-and-forget without `waitUntil()`** — applications get inserted but never scored on Vercel. (`wave1-public-apply-flow.md`, `wave1-ai-cost-abuse.md`)
8. **No `UNIQUE(job_id, email)`** on candidates → duplicate-application check is a TOCTOU race. (`wave1-public-apply-flow.md`, `wave1-database-rls.md`)
9. **Landing page openly states the product is fake** (Acme/Initech logos, "100% fictional testimonials", joke legal links, `/dashboard` CTAs that dump candidates into recruiter Kanban). (`wave1-frontend-ux.md`)
10. **`ignoreBuildErrors: true` hides 38 type errors**, 3 of which are runtime bugs in production endpoints (Supabase joined-array cast bugs in `/api/activities`, `/api/dashboard/alerts`, `/api/candidates/[id]/move`). (`wave1-infra-deploy.md`)

## Build sequence (Wave 2 → Wave 3 → Wave 4)

### Wave 2 — Foundation (must land first, mostly serial)

These have hard ordering: schema before policies, policies before route auth, env config before everything else.

1. **DB foundation**: write the missing base schema migration; restore `profiles_id_fkey`, `jobs_created_by_fkey`; add `UNIQUE(job_id, email)` on candidates; add missing indexes; add `NOT NULL` + length CHECKs.
2. **Storage**: create `resumes` private bucket migration; signed-URL upload pattern.
3. **RLS hardening**: rewrite `profiles` INSERT policy (admin-only role grants); rewrite `jobs` INSERT to pin `created_by = auth.uid()`; remove `NULL`-fallback in `user_owns_job()`.
4. **Env & config**: hard-fail when `UPSTASH_REDIS_*` / `CRON_SECRET` / `NEXT_PUBLIC_SUPABASE_*` / `EMAIL_FROM` / `SENTRY_DSN` are missing; flip `ignoreBuildErrors: false`; fix the 3 runtime-impacting type errors.

### Wave 3 — Public apply path (parallelizable, depends on Wave 2)

5. **Public API**: new `POST /api/public/apply` (the *only* unauthenticated mutate endpoint), with Turnstile, per-job + per-IP + per-email rate limits, idempotency on `(job_id, email)`, GitHub user-existence pre-check before any AI call.
6. **Background scoring**: wrap `processAndScoreCandidate` in `waitUntil()`; add `maxDuration` + AbortSignal to all OpenAI calls; cache GitHub/Proxycurl by URL.
7. **Public pages**: `/jobs` (active listings), `/jobs/[id]` (public detail), `/apply/[jobId]` (form), `/apply/[jobId]/success` (confirmation).
8. **Email**: Resend templates for "we received your application" (candidate) and "new application" (recruiter); send via `waitUntil()` from the apply route.
9. **Auth re-enable on dashboard**: every `/api/jobs`, `/api/candidates`, `/api/dashboard`, `/api/ai`, `/api/interviews` endpoint requires session; remove all `MVP_USER_ID` references; replace `createAdminClient()` callers with user-scoped client.
10. **Proxy fix**: rewrite `PROTECTED_ROUTES` (current list is wrong); add `/apply/*` and `/jobs/*` (public) to allowlist; switch `getSession()` to `getUser()`.

### Wave 4 — Polish & guardrails (parallelizable)

11. **Landing rewrite**: kill fake testimonials, fake stats, joke legal links, "second-best AI agency" badge; add real privacy/terms; CTAs point to `/jobs`.
12. **Toast consolidation**: pick Sonner *or* radix-store, mount one `<Toaster />`, migrate all imports.
13. **Frontend cleanup**: remove "Lorem Ipsum" placeholder in `CandidatePanel.tsx:535`; remove `/sentry-example-page` from prod; fix touch/keyboard DnD in Kanban; add error states to `useCandidates` consumers.
14. **Tests**: real route-level tests for `POST /api/public/apply` (happy + dup + invalid + closed-job + spam); e2e for full apply submission; auth-callback open-redirect test; activate coverage gate in CI.
15. **Observability**: replace `console.error` swallowing with `Sentry.captureException` in scoring + apply flows; turn off `sendDefaultPii` in Sentry; redact resume_text/email from breadcrumbs.
16. **Cost ceilings**: OpenAI org-level spend cap; Sentry alert on AI volume / 5xx rate; per-IP daily budget.
17. **Cron secret**: make `CRON_SECRET` mandatory; verify `x-vercel-cron` header.
18. **CORS**: drop the `*.vercel.app` wildcard; allowlist only the production domain + explicit preview pattern.

## Recommended Wave 2 dispatch shape

Five parallel agents, narrowly scoped, each writes code. They have explicit non-overlap on files:

- **w2-db**: writes new SQL migrations only (no app code touched).
- **w2-env-types**: flips `ignoreBuildErrors`, fixes the 3 runtime type bugs, hardens env-var loading. Touches `next.config.mjs`, the 3 broken route handlers, and `lib/supabase/server.ts`.
- **w2-storage**: writes `resumes` bucket migration + a signed-upload helper in `lib/supabase/storage.ts`.
- **w2-proxy-auth**: fixes `proxy.ts` `PROTECTED_ROUTES`, switches to `getUser()`, drops CORS wildcard. Doesn't touch app handlers yet — that's Wave 3.
- **w2-rls**: rewrites the broken policies in a new migration (depends on w2-db landing first; will run after).

After Wave 2 lands, Wave 3 can fan out into 5+ agents in parallel since the foundation is stable.
