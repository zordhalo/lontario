# Wave 1 — Auth & Access Control Audit

**Repo**: `lontario` @ `main`
**Date**: 2026-04-27
**Scope**: Pre-launch readiness for receiving live job applications.
**TL;DR**: The app cannot be safely launched in its current state. Every recruiter-facing API route is unauthenticated and exposes ALL tenants' data globally. AI endpoints are open to anonymous cost-DoS. Cron endpoints are only "fail-open" protected. Several dashboard pages are not gated at the proxy. RLS is bypassed wholesale for interview start/submit flows.

---

## API Surface Inventory

Legend — current state (as written) → target state (what it should be on launch).

| Endpoint | Methods | Current | Target | Risk if shipped as-is |
|---|---|---|---|---|
| `app/api/activities/route.ts` | GET | anon, `createClient()` (RLS) | recruiter-auth | Cross-tenant timeline leak (every recruiter's audit trail visible) |
| `app/api/ai/evaluate-answer/route.ts` | POST | anon, no DB, OpenAI call | candidate-auth (token-scoped) | Cost-DoS, prompt-injection vector |
| `app/api/ai/follow-up/route.ts` | POST | anon (auth check is a no-op comment), OpenAI | candidate-auth or recruiter-auth | Cost-DoS |
| `app/api/ai/generate-questions/route.ts` | POST | anon (auth check is a no-op comment), OpenAI | recruiter-auth | Cost-DoS, leaks job context |
| `app/api/ai/parse-resume/route.ts` | POST | anon, OpenAI | recruiter-auth or candidate-auth (apply flow) | Cost-DoS — large body x OpenAI |
| `app/api/ai/score-candidate/route.ts` | POST | anon, OpenAI + DB read of candidate+job | recruiter-auth | Cost-DoS + reveals private candidate scoring across tenants |
| `app/api/ai/scrape-profile/route.ts` | POST, GET | anon (`getUser` non-blocking), external scrape + OpenAI | recruiter-auth | Cost-DoS + SSRF surface |
| `app/api/candidates/route.ts` | GET, POST | anon, `createClient()` | recruiter-auth | List/create candidates against ANY job ID — full PII tenant breach |
| `app/api/candidates/[id]/route.ts` | GET, PATCH, DELETE | anon, "MVP: Auth disabled", "MVP: Skip job ownership check" | recruiter-auth + ownership | Anyone can read/edit/DELETE any candidate; resume URLs and notes leak |
| `app/api/candidates/[id]/move/route.ts` | POST | anon, writes activity with `MVP_USER_ID` placeholder | recruiter-auth | Pipeline tampering across tenants; broken audit log |
| `app/api/candidates/[id]/pregenerate-questions/route.ts` | POST, GET | anon | recruiter-auth | Cost-DoS, leaks generated Qs |
| `app/api/dashboard/alerts/route.ts` | GET | anon | recruiter-auth (per-user) | Cross-tenant alert leak |
| `app/api/dashboard/stats/route.ts` | GET | anon | recruiter-auth (per-user) | Aggregate org stats leaked globally |
| `app/api/interviews/schedule/route.ts` | POST, GET | anon, `createClient()` | recruiter-auth | Anyone can schedule interviews on behalf of any recruiter; emails any candidate |
| `app/api/interviews/[id]/route.ts` | GET, PATCH, DELETE | anon | recruiter-auth + ownership | Read/cancel/reschedule any interview |
| `app/api/interviews/[id]/start/route.ts` | POST, GET | anon, **`createAdminClient()` (RLS bypass)** | candidate-token-auth (signed link) | Anonymous attacker can start any interview by ID |
| `app/api/interviews/[id]/submit/route.ts` | POST, PATCH | anon, **`createAdminClient()` (RLS bypass)**, OpenAI calls | candidate-token-auth | Cost-DoS at AI tier; anyone can submit fake answers as any candidate |
| `app/api/interviews/[id]/review/route.ts` | POST, DELETE | anon, `reviewed_by` left null | recruiter-auth + ownership | Spoof review records; broken audit |
| `app/api/jobs/route.ts` | GET, POST | anon GET; POST uses **`createAdminClient()`** with hard-coded `MVP_USER_ID` | recruiter-auth (POST), public-anon (GET only if intentional) | Anyone can create jobs attributed to a fake profile; mass-spam vector |
| `app/api/jobs/[id]/route.ts` | GET, PUT, DELETE | anon | public-anon (GET, if you want public job board); recruiter-auth + ownership (PUT/DELETE) | Anyone can edit or delete any job posting |
| `app/api/cron/interview-reminders/route.ts` | GET | `CRON_SECRET` checked **only if defined** | admin/cron-secret (mandatory) | If env var unset in prod, fully public — see HIGH below |
| `app/api/cron/interview-status/route.ts` | GET | same fail-open pattern | admin/cron-secret (mandatory) | Same as above |
| `app/api/sentry-example-api/route.ts` | GET | anon, intentionally throws | remove before launch | Noise + minor info disclosure |

---

# BLOCKERS

### [BLOCKER-M] All recruiter API routes ship with authentication explicitly disabled
- **File**: `app/api/candidates/route.ts:51`, `app/api/candidates/[id]/route.ts:24,96,161`, `app/api/candidates/[id]/move/route.ts:35`, `app/api/candidates/[id]/pregenerate-questions/route.ts:15`, `app/api/jobs/route.ts:41,168`, `app/api/jobs/[id]/route.ts:38,110,175`, `app/api/interviews/schedule/route.ts:18`, `app/api/interviews/[id]/route.ts:13,85,252`, `app/api/interviews/[id]/review/route.ts:15,114`, `app/api/dashboard/stats/route.ts:20`, `app/api/dashboard/alerts/route.ts:16`, `app/api/activities/route.ts:15`
- **Finding**: Every route has a "MVP: Auth disabled" comment and skips ownership checks. Although most use `createClient()` (which would normally honor RLS), the absence of an authenticated cookie session means RLS evaluates as the anon role. If anon SELECT is permitted by Supabase policies (or if any policy has `using (true)` for this MVP), every recruiter's pipeline is publicly listable. POST/PATCH/DELETE to candidates, jobs, and interviews can be invoked by anyone on the internet.
- **Fix**:
  1. Add a `requireUser()` helper to `lib/supabase/auth.ts` that returns the session user or throws `401`.
  2. At the top of every handler call: `const user = await requireUser(supabase)`.
  3. Replace every `// MVP: Skip job ownership check` with an explicit `eq('user_id', user.id)` (or a `select` of the parent job filtered to the user) before mutation.
  4. Audit Supabase RLS policies — confirm `auth.uid() = owner_id` (or org membership) is enforced on `jobs`, `candidates`, `interviews`, `interview_reviews`, `candidate_activities`, `candidate_comments`, `dashboard_*` tables. Reject the launch if any table has `using (true)` in production.
- **Wave 2 task**: Re-enable per-route auth + ownership checks across all 14 recruiter API routes and verify Supabase RLS policies match.

### [BLOCKER-M] Interview start/submit endpoints use service-role key with no token auth
- **File**: `app/api/interviews/[id]/start/route.ts:36,245`; `app/api/interviews/[id]/submit/route.ts:60,363`
- **Finding**: These routes call `createAdminClient()` (bypasses RLS) and accept an interview ID with no token verification. An attacker who guesses or scrapes a UUID can start any interview, submit answers as the candidate, trigger paid OpenAI evaluation calls, and corrupt review records. This is the worst-case combination: RLS off + anonymous + paid AI write.
- **Fix**:
  1. Require a signed interview-access token on every request — either `interviews.access_token` (random 32-byte) or a short-lived JWT signed with `INTERVIEW_TOKEN_SECRET`. Token validates against the specific `interview_id`.
  2. Replace `createAdminClient()` with a token-scoped helper that loads the interview row by token+id and short-circuits if mismatch/expired/already-submitted.
  3. Add server-side single-use enforcement: once `submitted_at` is set, reject further `start`/`submit`.
  4. Apply the AI rate-limit tier per `interview_id`, not just per IP.
- **Wave 2 task**: Implement candidate-token auth for `/api/interviews/[id]/start` and `/submit`, drop admin client, add single-use guard.

### [BLOCKER-S] AI endpoints are anonymous and call paid OpenAI APIs
- **File**: `app/api/ai/evaluate-answer/route.ts:22`, `app/api/ai/follow-up/route.ts:18`, `app/api/ai/generate-questions/route.ts:18`, `app/api/ai/parse-resume/route.ts:20`, `app/api/ai/score-candidate/route.ts:27`, `app/api/ai/scrape-profile/route.ts:23`, `app/api/candidates/[id]/pregenerate-questions/route.ts:15`
- **Finding**: Anyone can hammer these endpoints. The IP-based rate limit is `ai: 10/60s` (`lib/rate-limit/index.ts:27`) — trivially bypassed with proxies. `parse-resume` accepts >100-char bodies with no upper bound, so each request can be a multi-thousand-token prompt. Score and scrape endpoints additionally read DB rows. Worst case is a $1k+/day OpenAI bill from a single afternoon of abuse.
- **Fix**:
  1. Require auth (recruiter or candidate-token) on every `/api/ai/*` route — drop the "optional for demo" pattern.
  2. Lower the `ai` tier limit to `5/60s` and add a daily per-user cap (`ai_daily: 50/24h`).
  3. Enforce a hard `MAX_PROMPT_CHARS` (e.g. 20k) on inputs.
  4. Add a circuit breaker: if the OpenAI monthly spend env threshold is crossed, return `503` with `code: AI_BUDGET_EXCEEDED`.
  5. Disable or delete the `optional auth` comments in `follow-up`, `generate-questions`, `scrape-profile` — they currently never reject.
- **Wave 2 task**: Gate all `/api/ai/*` routes behind auth, add per-user daily quotas, enforce input size caps, add OpenAI budget circuit breaker.

### [BLOCKER-S] `POST /api/jobs` uses admin client + hard-coded placeholder profile
- **File**: `app/api/jobs/route.ts:142-160,168-211`
- **Finding**: Job creation calls `createAdminClient()` (line 171), bypasses RLS, and assigns `created_by = MVP_USER_ID` (the all-zero UUID). Anyone on the internet can spam the jobs table; all postings appear under one synthetic account. There is no way to filter "my jobs" because they all belong to the placeholder. Combined with `GET /api/jobs/[id]` PUT/DELETE being anonymous, an attacker can wipe the entire jobs board.
- **Fix**:
  1. Remove `ensureMvpProfile`, `MVP_USER_ID`, and the `createAdminClient` branch.
  2. Require `requireUser()`; set `created_by = user.id`.
  3. Add an RLS policy: `jobs.created_by = auth.uid()` for INSERT/UPDATE/DELETE.
- **Wave 2 task**: Replace MVP placeholder profile in jobs POST with real authenticated user attribution.

### [BLOCKER-S] Cron auth fails open when `CRON_SECRET` is unset
- **File**: `app/api/cron/interview-reminders/route.ts:21-28`; `app/api/cron/interview-status/route.ts:18-23`
- **Finding**: The check is `if (cronSecret && authHeader !== \`Bearer ${cronSecret}\`)`. If the env var is ever missing — typo, accidental delete, preview deploy, branch deploy — the route becomes fully public and uses `createAdminClient()`. An attacker can drive arbitrary state transitions on interviews and trigger reminder emails.
- **Fix**:
  1. Treat missing `CRON_SECRET` as fatal: return `503` (or refuse to start) when `process.env.CRON_SECRET` is undefined in production.
  2. Use the canonical Vercel cron header check too: `request.headers.get('x-vercel-cron')` is set on Vercel-invoked crons.
  3. Add an env-validation step (zod) at boot in `instrumentation.ts` that asserts `CRON_SECRET` exists in production.
- **Wave 2 task**: Make `CRON_SECRET` mandatory in prod; add boot-time env validation; check `x-vercel-cron` header.

---

# HIGH

### [HIGH-S] Proxy `PROTECTED_ROUTES` list misses several authenticated dashboard paths
- **File**: `proxy.ts:24-31`
- **Finding**: Current list:
  ```
  /dashboard, /jobs/create, /jobs/edit, /candidates, /interviews/manage, /settings
  ```
  Filesystem reveals these dashboard pages exist but are **not** gated:
  - `/jobs` (the listing — `app/(dashboard)/jobs/page.tsx`)
  - `/jobs/[id]` (job detail)
  - `/jobs/new` (the actual create path — the list says `/jobs/create`, which does not exist)
  - `/interviews` (the listing — list says `/interviews/manage`, which does not exist)
  - `/interview/[token]` candidate flow — should arguably be public *with* token, currently public (which is correct for candidates but proxy never checks)
  - `/profile` (`app/(dashboard)/profile`)
  - `/dashboard/interview` route group (`app/(dashboard)/interview`)
  - `/sentry-example-page` (low risk but should be removed)

  Rendering happens server-side, so even though API routes block today via "MVP" comments, an unauth visitor can render the dashboard shell and any data fetched via Server Components using the user-less anon client. This also lets crawlers index recruiter UIs.
- **Fix**:
  1. Replace the list with paths that match the actual filesystem:
     ```
     ["/dashboard", "/jobs", "/jobs/new", "/jobs/[id]", "/candidates",
      "/interviews", "/interview" /* dashboard subtree only */,
      "/profile", "/settings"]
     ```
     and either delete `/jobs/create`, `/jobs/edit`, `/interviews/manage` or rename app routes to match.
  2. Carve out the public candidate flow `/interview/[token]` explicitly (it should be public-with-token, not blocked).
  3. Delete `/sentry-example-page` from production.
  4. Add E2E test: unauth visitor → 302 to `/login` for each protected path.
- **Wave 2 task**: Rewrite `proxy.ts` PROTECTED_ROUTES to match actual filesystem and add an E2E coverage test.

### [HIGH-S] No CSRF protection on state-changing API routes
- **File**: All POST/PATCH/PUT/DELETE handlers under `app/api/`; `lib/security/cors.ts:63-70`
- **Finding**: `Access-Control-Allow-Credentials: true` is set, and the proxy does not verify same-origin on POST. Supabase auth uses cookies, so once a recruiter is logged in, any malicious site they visit can submit a `<form>` POST to e.g. `/api/jobs/[id]` (DELETE via XHR is preflighted, but POST with `application/x-www-form-urlencoded` is a simple request not subject to CORS preflight — and the route only requires `application/json` parsing of the body, not a content-type check). Additionally, none of the POST routes verifies an `Origin`/`Sec-Fetch-Site` header.
- **Fix**:
  1. Add an `assertSameOrigin(request)` helper that rejects POST/PUT/PATCH/DELETE if `Origin` is not in the allow-list (or is missing for non-GET) AND `Sec-Fetch-Site` is not `same-origin` / `same-site` / `none`.
  2. Wire it into `proxy.ts` for all `/api/*` non-GET requests, before rate limiting.
  3. Reject any non-GET request without `Content-Type: application/json` to prevent simple-form CSRF.
  4. Optional: add a double-submit CSRF token cookie for the dashboard.
- **Wave 2 task**: Add same-origin/Sec-Fetch-Site enforcement and JSON content-type guard to all mutating API routes.

### [HIGH-S] CORS allows arbitrary `*.vercel.app` previews
- **File**: `lib/security/cors.ts:49`
- **Finding**: `^https:\/\/[a-z0-9-]+\.vercel\.app$` matches every Vercel project on the planet, including preview URLs of unrelated tenants and any Vercel-hosted attacker site. With `Allow-Credentials: true` and shared cookies, an attacker controlling any `*.vercel.app` host (trivial — just deploy) could launch credentialed cross-origin requests against production. They cannot read response bodies for cookies on a different `vercel.app` subdomain (browser SOP), but they can perform **CSRF-style writes** because preflight will succeed with this CORS config.
- **Fix**:
  1. Replace the wildcard with an explicit allow-list pulled from `VERCEL_PROJECT_PRODUCTION_URL` and the project's own preview URL pattern: `^https:\/\/lontario(-[a-z0-9-]+)?-<team-slug>\.vercel\.app$`.
  2. In production, allow ONLY `NEXT_PUBLIC_APP_URL` plus the canonical `lontario.com` (or whatever the prod domain is). Drop `*.vercel.app` entirely from the prod allow-list.
  3. Tie in with the CSRF fix above.
- **Wave 2 task**: Tighten CORS allow-list to project-specific Vercel hostnames in preview, drop wildcard in production.

### [HIGH-S] `createClient()` calls in API routes still operate as anon when no session cookie is present
- **File**: every route in the table above using `createClient()`
- **Finding**: This is not just a route-handler problem. Even after route-handler auth is added, the assumption that "RLS will save us" requires Supabase policies to NOT have anon read/write granted. Confirm none of the public-grants migrations leak data.
- **Fix**: Run `select * from pg_policies where schemaname='public'` and verify `roles` does not include `anon` for any sensitive table. Add a CI check.
- **Wave 2 task**: Add a Supabase policy snapshot test that fails CI if anon role is granted on jobs/candidates/interviews/profiles.

### [HIGH-S] `candidate_activities.performed_by = MVP_USER_ID` poisons the audit log
- **File**: `app/api/candidates/[id]/move/route.ts:117`; `app/api/jobs/route.ts:211`
- **Finding**: Audit/activity rows are written with the all-zero placeholder UUID. Once auth is enabled, you cannot tell who actually did what for any pre-launch data. If you ship and only later flip auth on, you'll have a forensics hole.
- **Fix**: Either (a) hold launch until auth is on so no MVP rows ever land, or (b) add a `data_quality = 'mvp_placeholder'` flag column and exclude these rows from audit views.
- **Wave 2 task**: Decide on MVP audit-row treatment and either purge or flag them at launch.

---

# MEDIUM

### [MED-XS] `/monitoring` Sentry tunnel is publicly POSTable and skipped by proxy
- **File**: `proxy.ts:62-68`; `next.config.mjs:80`
- **Finding**: `tunnelRoute: "/monitoring"` proxies all events to Sentry. The proxy explicitly skips it (`pathname.startsWith("/monitoring")`), so it has no rate limit, no CORS check, no security headers. Anyone can POST junk to it; Sentry will accept events whose DSN matches the configured project. The DSN is `NEXT_PUBLIC_SENTRY_DSN` (already public) so this is not a credential leak, but it is an event-quota DoS vector — abuse can blow your Sentry monthly event quota.
- **Fix**:
  1. Apply rate limiting at a separate tier (`monitoring: 30/60s` per IP) — keep the auth skip but stop being a free relay.
  2. Reject `monitoring` requests where `Origin` is not in the CORS allow-list.
- **Wave 2 task**: Rate-limit the Sentry tunnel route and reject unknown origins.

### [MED-XS] AI tier rate limit is per-IP, not per-user, and tier window is small
- **File**: `lib/rate-limit/index.ts:26`
- **Finding**: `ai: 10/60s` per IP. With NAT/proxies this is effectively unlimited. There is no daily cap. Combine with anonymous AI endpoints and you have unbounded cost exposure.
- **Fix**: Switch the AI limiter key to `userId || token || ip`, add a `daily` window of 50, and keep the burst window at 10/60s.
- **Wave 2 task**: Add per-user/per-token AI quotas with daily caps.

### [MED-XS] `app/api/sentry-example-api/route.ts` ships in production
- **File**: `app/api/sentry-example-api/route.ts`
- **Finding**: An always-throwing endpoint is left in the API surface. Low impact (no data, no auth) but pollutes Sentry and attack surface.
- **Fix**: Delete the file and the corresponding `app/sentry-example-page` route, or guard with `if (process.env.NODE_ENV !== 'production')`.
- **Wave 2 task**: Remove Sentry example routes from production builds.

### [MED-S] `app/api/ai/scrape-profile` performs outbound HTTP from the server
- **File**: `app/api/ai/scrape-profile/route.ts:23`
- **Finding**: Anonymous SSRF surface. Even though it's an LLM-driven scraper, an attacker who controls the URL can probe internal IPs (Vercel functions egress is mostly to internet, but still — RFC1918 / metadata IPs should be blocked).
- **Fix**: Validate URL against a public-only allow-pattern; block `127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `169.254.0.0/16`, `0.0.0.0`, and non-http(s) schemes; resolve DNS server-side and re-check.
- **Wave 2 task**: Add SSRF guard to scrape-profile URL input.

### [MED-XS] `Access-Control-Allow-Credentials: true` is unconditional
- **File**: `lib/security/cors.ts:68`
- **Finding**: Combined with the wildcard `*.vercel.app` (HIGH above), this enables credentialed cross-origin requests from any Vercel-hosted page. Even after fixing the wildcard, only set `Allow-Credentials` on the dashboard origin, not the public job board.
- **Fix**: Make `Allow-Credentials` conditional on origin matching the authenticated app URL only.
- **Wave 2 task**: Conditionally set Access-Control-Allow-Credentials only for trusted dashboard origin.

---

# LOW

### [LOW-XS] In-memory rate limiter is non-functional on Vercel
- **File**: `lib/rate-limit/index.ts:130-150`
- **Finding**: If Upstash env vars are missing in production, the limiter falls back to an in-memory map per Lambda instance — meaning effectively no global limit. Combined with cost-DoS exposure on AI routes, this is a silent failure mode.
- **Fix**: Refuse to start in production if `UPSTASH_REDIS_REST_URL` is unset (boot-time env validation).
- **Wave 2 task**: Fail-closed on missing Upstash env vars in production.

### [LOW-XS] Proxy session check uses `getSession()` not `getUser()`
- **File**: `proxy.ts:177`
- **Finding**: `getSession()` reads the cookie without verifying the JWT against Supabase, so a forged/expired cookie can pass this gate (the API routes would still re-verify if they used `getUser()`, but right now most don't auth at all). This is the Supabase-recommended distinction; for proxy redirects it's mostly fine, but pair with API-level verification.
- **Fix**: After API auth is added, ensure each route uses `supabase.auth.getUser()` (network-verified) before mutations.
- **Wave 2 task**: Standardize on getUser() in API handlers, keep getSession() in proxy for cheap redirects.

### [LOW-XS] `AUTH_ROUTES` redirect uses unsanitized `redirectTo` query param
- **File**: `proxy.ts:188-194`
- **Finding**: Open redirect potential: `new URL(destination, request.url)` with `destination` from the query string lets an attacker craft a login URL that, after auth, redirects to `https://evil.com` if the URL parser treats it as absolute.
- **Fix**: Validate `redirectTo` is a path that starts with `/` and not `//` before using it.
- **Wave 2 task**: Sanitize redirectTo to same-origin paths only.

### [LOW-XS] `app/api/cron/*` writes via admin client without idempotency keys
- **File**: `app/api/cron/interview-status/route.ts:25`, `app/api/cron/interview-reminders/route.ts:30`
- **Finding**: Not strictly an auth issue, but if the BLOCKER above (fail-open cron) is exploited, replays can duplicate reminder emails. Add an idempotency guard (`reminders_sent` flag check + UPDATE…WHERE not_sent).
- **Fix**: Use conditional updates so re-running is a no-op.
- **Wave 2 task**: Make cron jobs idempotent by row-level state guard.

---

## `createAdminClient()` Caller Audit

| Caller | Line | Should switch to user-scoped? |
|---|---|---|
| `app/api/jobs/route.ts` (POST) | 171 | **Yes** — must use `createClient()` + authenticated user |
| `app/api/interviews/[id]/start/route.ts` (POST, GET) | 36, 245 | **Yes** — switch to a token-scoped helper that loads the interview by signed token; never bypass RLS |
| `app/api/interviews/[id]/submit/route.ts` (POST, PATCH) | 60, 363 | **Yes** — same as start; token-scoped |
| `app/api/cron/interview-reminders/route.ts` | 30 | Stay admin (cron has no user) — but only after `CRON_SECRET` is mandatory and `x-vercel-cron` is verified |
| `app/api/cron/interview-status/route.ts` | 25 | Stay admin — same conditions as above |

Net: drop admin usage from 4 of the 5 caller files; harden the 2 that legitimately need it.

---

## Minimum Auth Posture for Public Launch — Checklist

Treat as gating criteria. Do not flip the launch switch with any unchecked.

- [ ] All recruiter API routes call a `requireUser()` helper that returns 401 otherwise.
- [ ] Every recruiter route enforces ownership via `eq('user_id', user.id)` (or org membership join) before any mutation.
- [ ] Supabase RLS verified: no `anon` grants on `jobs`, `candidates`, `interviews`, `interview_reviews`, `interview_questions`, `interview_answers`, `candidate_activities`, `candidate_comments`, `profiles`. Snapshot test in CI.
- [ ] `createAdminClient()` removed from `app/api/jobs/route.ts`, `app/api/interviews/[id]/start/route.ts`, `app/api/interviews/[id]/submit/route.ts`. Remaining callers are only the two cron handlers.
- [ ] `MVP_USER_ID` and `ensureMvpProfile()` deleted from the codebase.
- [ ] Candidate interview flow uses signed tokens; `start` and `submit` reject any request whose token does not match `interviews.id`. Single-use enforcement on `submit`.
- [ ] All `/api/ai/*` routes require auth (recruiter or candidate-token).
- [ ] AI rate limit keyed on `user_id || token`, not IP only; daily cap (e.g. 50/24h) in place; per-request prompt size cap; OpenAI budget circuit breaker.
- [ ] `CRON_SECRET` is mandatory in production (boot-time env validation); requests also verify `x-vercel-cron` header.
- [ ] `proxy.ts` PROTECTED_ROUTES updated to `[/dashboard, /jobs, /jobs/new, /jobs/[id], /candidates, /interviews, /profile, /settings]`; stale entries (`/jobs/create`, `/jobs/edit`, `/interviews/manage`) removed or routes renamed; E2E redirect test green.
- [ ] CSRF defense: proxy rejects non-GET API requests when `Origin` is missing or not in allow-list, or `Sec-Fetch-Site` is `cross-site`. JSON content-type required on mutating routes.
- [ ] CORS: production allow-list contains only `NEXT_PUBLIC_APP_URL` (and canonical custom domain). Wildcard `*.vercel.app` removed from production. Preview deploys use a project-specific regex.
- [ ] `Access-Control-Allow-Credentials` only set when origin is the dashboard host.
- [ ] `/api/sentry-example-api` and `/sentry-example-page` deleted (or `NODE_ENV !== 'production'` guarded).
- [ ] `/monitoring` Sentry tunnel is rate-limited (e.g. 30/60s/IP) and rejects unknown origins.
- [ ] `app/api/ai/scrape-profile` validates URL against SSRF allow-list (no RFC1918, link-local, metadata IPs, non-http(s) schemes).
- [ ] Open-redirect guard on `proxy.ts` `redirectTo` (must start with `/` and not `//`).
- [ ] In production, missing `UPSTASH_REDIS_REST_URL` is fatal — no in-memory limiter fallback.
- [ ] Manual smoke test: `curl` every route in the inventory above without a session cookie. Every recruiter route returns 401. Every public-anon route (job board GET if you keep it) returns the expected payload only.
