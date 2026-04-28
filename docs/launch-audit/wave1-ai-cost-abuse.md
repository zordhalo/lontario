# Wave 1 Audit — AI Cost & Abuse Risk

**Scope:** AI integration layer (`lib/ai/*`, `app/api/ai/*`, `app/api/candidates/*`, rate limiting, Vercel function config).
**Date:** 2026-04-27
**Verdict:** **DO NOT LAUNCH PUBLIC APPLY FORM** until BLOCKERS resolved. A modestly-skilled spammer can rack four-to-five-figure bills in hours.

---

## 1. External API Call Inventory

| Function | Provider | Model / Endpoint | Approx. cost / call | Where called | Auth/RL guard |
|---|---|---|---|---|---|
| `generateInterviewQuestions` | OpenAI | `gpt-4o-2024-08-06`, structured out, ~3-6k input + 4096 max output | **~$0.05–$0.08** | `/api/ai/generate-questions`, `/api/candidates/[id]/pregenerate-questions`, post-application background | AI tier 10/min/IP only (pregenerate route is unauthenticated and can be hit directly) |
| `generateFollowUpQuestion` | OpenAI | `gpt-4o`, max 4096 | **~$0.01–$0.03** | `/api/ai/follow-up` | AI tier 10/min/IP, no auth |
| `scoreCandidate` | OpenAI | `gpt-4o`, ~2k input + 4096 out | **~$0.03–$0.06** | `/api/ai/score-candidate`, `processAndScoreCandidate` | `/api/ai/*` AI tier; `/api/candidates` POST is `general` tier (100/min/IP) |
| `parseResume` | OpenAI | `gpt-4o`, up to ~16k context, 4096 out | **~$0.05–$0.15** | `/api/ai/parse-resume` | AI tier, no auth |
| `evaluateAnswer` | OpenAI | `gpt-4o`, 4096 out | **~$0.02–$0.04** | `/api/ai/evaluate-answer`, `/api/interviews/[id]/submit` (loop, one call per question) | AI tier 10/min for `/api/ai/*`; `interviews/.../submit` is mapped to AI tier — but rate limit is **per-IP**, not per interview |
| `generateJobDescription` | OpenAI | `gpt-4o`, max 1500 | **~$0.02** | (no public route — internal only) | n/a |
| `fetchLinkedInProfile` | Proxycurl | `/v2/linkedin?skills=include` | **~$0.01–$0.10 per lookup** (tier-dependent; the `skills=include` flag bumps cost) | `/api/ai/scrape-profile`, candidate scoring path (currently NOT wired in scoring.ts but exported and reachable) | AI tier 10/min/IP, no caching |
| `fetchGitHubProfile` | GitHub REST | `/users/:u`, `/users/:u/repos`, plus 5× `repo.languages_url` = **7 calls per fetch** | $0 dollars but **~7 GitHub API requests** | `/api/ai/scrape-profile`, `processAndScoreCandidate` (every applicant) | AI tier 10/min/IP for `/api/ai/*`; in scoring path it runs on `/api/candidates` POST which is **general tier 100/min/IP** |

> Cost ceiling per OpenAI call is **bounded only by `max_tokens: 4096`** (and `1500` for job description). With GPT-4o pricing (~$2.50/M input, $10/M output as of late 2024), worst-case single-call output cost is `4096 × $10/M ≈ $0.041`. Input tokens (resume excerpt + GitHub data) can push individual `parseResume` calls toward $0.15.

---

## BLOCKERS

### [BLOCKER-S] Public apply form triggers full AI pipeline at general 100/min/IP rate limit
- **File**: `app/api/candidates/route.ts:190-275` (POST), classified as `general` tier in `lib/rate-limit/index.ts:46-69`
- **Cost vector**: A spammer rotating IPs (or even from a single IP) gets up to **100 applications/min**. Each application kicks off `processAndScoreCandidate` → 1 OpenAI scoring call (~$0.05) + 1 OpenAI question-generation call (~$0.07) + 7 GitHub calls + optional Proxycurl ($0.01–0.10). **~$0.13–$0.22 per application × 100/min/IP = $13–$22 per minute per IP**. Across 10 IPs that's ~$10k/day. Email-uniqueness check is per-job, so a single attacker can submit 100s of unique emails to the same job.
- **Fix**: Add a dedicated `apply` tier (e.g. **3/min/IP, 20/hour/IP, AND 50/hour/job_id**); require email-verification or a Turnstile/hCaptcha challenge on the public apply form before scoring is queued; gate AI scoring behind a delayed worker rather than firing inline.
- **Wave 2 task**: Introduce a new `apply` rate-limit tier keyed on `(ip, job_id)` with hourly+daily caps and add Cloudflare Turnstile to the public apply form.

### [BLOCKER-S] `/api/candidates/[id]/pregenerate-questions` is unauthenticated and can be replayed
- **File**: `app/api/candidates/[id]/pregenerate-questions/route.ts:15-208`
- **Cost vector**: Anyone with a candidate UUID (returned in the 201 from POST `/api/candidates`, and trivially enumerable via the GET handler in the same file) can POST to this route to regenerate a fresh OpenAI `generateInterviewQuestions` call (~$0.05–$0.08). The handler returns early on `status: ready`/`generating`, but an attacker can flip the row status by racing with another insert path or simply target candidates that have not yet been pre-generated. Even idempotent, it accepts hits at `general` tier 100/min/IP.
- **Fix**: Require server-side caller auth (service-role/internal call only), or sign the URL/payload from the originating server. Move the trigger from a public HTTP fetch (`scoring.ts:308-329`) to a direct function call or a queued job.
- **Wave 2 task**: Convert the post-scoring pre-generation hop from a self-issued HTTP `fetch` to an in-process call, and require an `x-internal-token` header for the route as defense in depth.

### [BLOCKER-M] `/api/ai/parse-resume` is unauthenticated and accepts arbitrary input up to whatever Next.js body size allows
- **File**: `app/api/ai/parse-resume/route.ts:20-67`; underlying call `lib/ai/openai.ts:538-571`
- **Cost vector**: `parseResume` ships the **entire** `resume_text` to OpenAI with no length cap server-side (only a `min(100)`). An attacker can send 200KB of text per request → maxes input tokens, returns a 4096-token response. With AI tier 10/min/IP the per-IP burn is **~10 × $0.15 = $1.50/min/IP**. From a botnet that's $90/min/IP × N IPs.
- **Fix**: Cap `resume_text` length (e.g. `z.string().min(100).max(20000)`); require auth for the route OR move parsing behind the apply form (and apply the new `apply` tier); move to `gpt-4o-mini` for parsing (~10× cheaper).
- **Wave 2 task**: Add input size cap, switch parsing to `gpt-4o-mini`, and require Supabase auth on `/api/ai/*` endpoints not used in the public interview flow.

### [BLOCKER-M] `/api/ai/score-candidate`, `/api/ai/follow-up`, `/api/ai/generate-questions`, `/api/ai/evaluate-answer` are all unauthenticated
- **File**: `app/api/ai/score-candidate/route.ts:27-29` ("MVP: Auth disabled"), `app/api/ai/evaluate-answer/route.ts:24` (same), `app/api/ai/generate-questions/route.ts:22-25` (auth fetched but not enforced), `app/api/ai/follow-up/route.ts:22-25` (same)
- **Cost vector**: Direct OpenAI proxies. With AI tier 10/min/IP a single attacker burns **~$0.50–$1.00/min** before rotating IPs. Combined `parseResume` + `scoreCandidate` from one IP is ~$2/min sustained.
- **Fix**: Require `supabase.auth.getUser()` to be non-null on every `/api/ai/*` route; for the interview flow, require an `access_token` keyed to a real interview row. Tighten the AI tier to 5/min/IP.
- **Wave 2 task**: Enforce session auth on every `/api/ai/*` POST and reject anonymous requests with 401.

### [BLOCKER-M] No OpenAI org-level spend cap or alerting documented
- **File**: `README.md:170-172`, no references to budget caps in repo (`grep -ri "spend\|budget"` finds nothing actionable)
- **Cost vector**: Without an OpenAI usage limit set in the dashboard, a successful abuse run keeps charging until the card declines. Sentry instruments `ai.operation` spans (`lib/ai/openai.ts:237-289` etc.) but there is **no alert rule on aggregate OpenAI spend or error rate**.
- **Fix**: Set OpenAI hard usage limit at the org dashboard (e.g. $200/day to start). Add Sentry alert: "AI ops > N/min" and "AI error rate > X%". Document both in `SECURITY.md`.
- **Wave 2 task**: Provision OpenAI hard-cap + soft-cap, and configure Sentry alert rules on `ai.operation` span volume and failure rate.

### [BLOCKER-S] `processAndScoreCandidate` is fire-and-forget Promise, not durable
- **File**: `app/api/candidates/route.ts:264-275` (calls `.catch()` but does not `await`); referenced in `lib/ai/scoring.ts:287-302`
- **Cost vector**: This is **not** `waitUntil()` — it's an unawaited Promise. On Vercel, the function may freeze on response and either (a) abort the OpenAI call mid-flight (leaks tokens already billed but no DB update) or (b) keep running silently until the runtime budget elapses. Mid-call retries by the client multiply the spend.
- **Fix**: Wrap in `waitUntil()` from `@vercel/functions`, or push to a durable queue (Vercel Workflow / QStash / Inngest). Set explicit `export const maxDuration = 60` on the route.
- **Wave 2 task**: Replace fire-and-forget with `waitUntil()` (short-term) and migrate scoring to a queued worker (medium-term) so retries are idempotent.

---

## HIGH

### [HIGH-S] No `maxDuration` export on any AI route
- **File**: All routes under `app/api/ai/*` and `app/api/candidates/*`. `vercel.json` only declares crons.
- **Cost vector**: Vercel's default Hobby/Pro `maxDuration` lets long OpenAI streams run up to 60–300s. An attacker who can make the model produce slow streamed output ties up function-seconds (compute $) on top of OpenAI tokens.
- **Fix**: Set `export const maxDuration = 30` (or 60 for the interview submit loop) on every AI-touching route. Add a request-level `AbortController` with a hard timeout to OpenAI calls.
- **Wave 2 task**: Add `maxDuration` and per-request `AbortController` (e.g. 25s) to all AI routes.

### [HIGH-M] `evaluateAnswer` runs once per question in a serial loop with no batch limit
- **File**: `app/api/interviews/[id]/submit/route.ts:174-225`
- **Cost vector**: An attacker who completes an interview can submit **N answers** (N is the number of pre-generated questions, but there's no validation that `answers.length <= questions.length`). Even legitimately, 10 questions × $0.03 ≈ $0.30 per interview submission. With the access_token leaked or guessable, replays multiply this. Also, the interview can only be `completed` once, but a status of `in_progress`/`scheduled`/`ready` admits multiple submits before status transitions, and PATCH (single-answer) has no AI cost but unlimited writes.
- **Fix**: Reject `answers.length > questions.length`; mark interview `completed` *before* the AI loop or use a row lock; enforce one-shot via `UPDATE WHERE status='in_progress'` returning rowcount.
- **Wave 2 task**: Add answer-count cap and atomic state transition before evaluating; consider batching `evaluateAnswer` into a single OpenAI call.

### [HIGH-M] No caching for GitHub or Proxycurl lookups
- **File**: `lib/ai/github.ts:47-159`, `lib/ai/linkedin.ts:45-150`
- **Cost vector**: Re-scoring the same candidate (or two candidates with the same GitHub URL across jobs) re-fetches **7 GitHub calls + 1 Proxycurl call ($0.01–$0.10)** every time. GitHub anonymous limit is 60/hour without a token; with `GITHUB_TOKEN` it's 5000/hour — but a public apply form could exhaust it within an hour if every applicant has a github_url.
- **Fix**: Cache by `username`/`linkedin_url` in Supabase or Vercel KV with a 24h TTL. Reduce GitHub language fetches to one combined call (top repo only) and switch to GraphQL to cut to 1–2 requests.
- **Wave 2 task**: Add a `profile_cache` table (or KV) keyed on `(source, identifier)` with 24h TTL; reuse across candidates and re-scoring.

### [HIGH-S] Email uniqueness check is per-job, not per-platform
- **File**: `app/api/candidates/route.ts:228-241`
- **Cost vector**: A spammer can apply to N jobs with the same email and pay for N full pipelines. Trivial to script.
- **Fix**: Add a per-email global rate limit (e.g. 3 applications/email/day) at the API layer; require email verification before scoring fires.
- **Wave 2 task**: Implement email-based throttle and double-opt-in for first-time applicants.

### [HIGH-S] AI tier (10/min/IP) is too generous for unauthenticated AI proxies
- **File**: `lib/rate-limit/index.ts:24-29`
- **Cost vector**: 10/min × $0.05 avg = $0.50/min per IP. From 50 cheap residential proxies, that's $25/min ≈ $1500/hr.
- **Fix**: Drop AI tier to 3/min/IP for anonymous, 30/min for authenticated; split limits.
- **Wave 2 task**: Implement tiered limits keyed on auth state (anon vs. user).

---

## MEDIUM

### [MEDIUM-S] In-memory rate limiter fallback in production
- **File**: `lib/rate-limit/index.ts:202-222`
- **Cost vector**: If `UPSTASH_REDIS_REST_URL` is unset in production, the limiter silently falls back to in-memory — which on Vercel's stateless functions effectively means **no rate limiting at all** (each cold start has its own Map).
- **Fix**: Make Upstash mandatory in production: throw on startup if env vars missing AND `NODE_ENV === "production"`.
- **Wave 2 task**: Add a hard guard that aborts boot in production without Upstash credentials.

### [MEDIUM-S] No request-level OpenAI timeout / `AbortSignal`
- **File**: `lib/ai/openai.ts:62-67`, all completion calls
- **Cost vector**: A slow-network attacker (or OpenAI degradation) holds the function open the full Vercel max duration. Compounds with [HIGH-S] above.
- **Fix**: Pass `signal: AbortSignal.timeout(20_000)` to every `openai.beta.chat.completions.parse` call; wrap with retry-once logic that respects the timeout.
- **Wave 2 task**: Add 20s timeout signal to every OpenAI call.

### [MEDIUM-S] No retry/backoff strategy; failed OpenAI calls disappear
- **File**: `lib/ai/openai.ts` throughout — every function throws on parse failure
- **Cost vector**: Soft cost: failed calls are still billed by OpenAI. Without retry, transient errors lose the spend. With a naïve frontend retry, they double-bill.
- **Fix**: Implement explicit retry-once with exponential backoff at the OpenAI layer. Mark candidates `scoring_failed` so the frontend doesn't auto-retry.
- **Wave 2 task**: Add retry policy + scoring-state machine on candidate row.

### [MEDIUM-S] `lib/ai/openai.ts:90-108` rate-limiter is process-local and useless on serverless
- **File**: `lib/ai/openai.ts:90-108`
- **Cost vector**: `rateLimiter.lastCall` lives in module scope — each Vercel function instance has its own. Provides zero protection against burst spend.
- **Fix**: Remove or replace with Upstash-backed token bucket keyed on `openai:global`.
- **Wave 2 task**: Replace in-memory delay with Redis-backed global concurrency cap.

### [MEDIUM-M] Proxycurl `skills=include` flag is the expensive variant
- **File**: `lib/ai/linkedin.ts:55-63`
- **Cost vector**: Proxycurl charges credits per "extra" — `skills=include` adds cost per profile. The code also falls back to keyword-grepping the same data on lines 78-122 — duplicating the spend.
- **Fix**: Drop `skills=include` (the keyword extractor on lines 82-122 already approximates it from the description) and re-enable only when you have a paid budget.
- **Wave 2 task**: Remove `skills=include` parameter and rely on local skill extraction.

### [MEDIUM-S] `processAndScoreCandidate` triggers `triggerQuestionPregeneration` which makes a server-to-server HTTP request
- **File**: `lib/ai/scoring.ts:308-329`
- **Cost vector**: This `fetch` goes through the Vercel ingress, hits the rate limiter, and counts against the IP of the runtime — but the URL is publicly callable (see BLOCKER above). Doubles function-seconds for every successful application.
- **Fix**: Call `generateInterviewQuestions` directly in-process or enqueue.
- **Wave 2 task**: Replace HTTP self-call with direct in-process call.

---

## LOW

### [LOW-S] AI temperature 0.7 with 4096 max tokens "just in case"
- **File**: `lib/ai/openai.ts:77-84`
- **Cost vector**: Many calls do not need 4096 tokens. `parseResume` and `scoreCandidate` would fit in 1500–2000.
- **Fix**: Lower `max_tokens` per function (e.g. 2048 for scoring, 1024 for follow-up). Saves 30–50% on output cost ceilings.
- **Wave 2 task**: Right-size `max_tokens` per function.

### [LOW-S] `gpt-4o` used for tasks that `gpt-4o-mini` could handle
- **File**: `lib/ai/openai.ts:79`
- **Cost vector**: `parseResume`, `evaluateAnswer`, and `generateFollowUpQuestion` are all viable on `gpt-4o-mini` at ~10× lower cost.
- **Fix**: Split `AI_CONFIG` into per-function model selection.
- **Wave 2 task**: Move resume parsing, answer eval, follow-ups to `gpt-4o-mini`.

### [LOW-S] `extractGitHubUsername` accepts plain string — risk of fetching arbitrary GitHub usernames at scale
- **File**: `lib/ai/github.ts:164-181`
- **Cost vector**: Combined with the unauthenticated scrape-profile route, attackers can use the platform as a free GitHub-API proxy for enumeration. Cheap individually but RL-able.
- **Fix**: Limit to URLs only (require `github.com/` prefix); keep the function but reject bare usernames.
- **Wave 2 task**: Tighten URL validation in scrape-profile.

### [LOW-S] `generateJobDescription` is exposed via the export but no public route — fine, but undocumented
- **File**: `lib/ai/openai.ts:729-780`
- **Cost vector**: None today, but if a future route wraps it without auth, it's a $0.02 burn vector.
- **Fix**: Document that any `lib/ai` consumer must be behind auth + rate limit.
- **Wave 2 task**: Add a header comment to `lib/ai/openai.ts` codifying the calling-convention contract.

### [LOW-S] No Sentry tag for cost/spend
- **File**: `lib/ai/openai.ts` `Sentry.startSpan` calls — instrument operation, not tokens
- **Cost vector**: You can see *what* is happening but not *how much it cost*. No way to alert on spend.
- **Fix**: Capture `usage.total_tokens` from each completion as a span attribute. Add a Sentry alert on `sum(ai.tokens) > N per 5 min`.
- **Wave 2 task**: Record `prompt_tokens`/`completion_tokens` on every span; add a token-rate alert.

---

## Per-Application Cost Estimate

Assumptions: GPT-4o pricing late-2024 (~$2.50/M input, $10/M output); Proxycurl personal-use pricing $0.01/lookup with skills add-on at $0.10; GitHub free.

**Best case (no LinkedIn, GitHub URL provided, average prompts):**
- 1× `scoreCandidate`: input ~1.5k tokens / output ~800 tokens → ~$0.012
- 1× `generateInterviewQuestions` (background): input ~2k / output ~2k → ~$0.025
- 7× GitHub calls: $0
- **Total: ~$0.04 / application**

**Typical case (cover letter + GitHub + median prompts):**
- 1× `scoreCandidate`: ~$0.05
- 1× `generateInterviewQuestions`: ~$0.07
- 7× GitHub calls: $0
- **Total: ~$0.12 / application**

**Worst case (long resume + LinkedIn lookup + max tokens + retries):**
- 1× `parseResume`: ~$0.15
- 1× `scoreCandidate` at max: ~$0.10
- 1× `generateInterviewQuestions` at max: ~$0.15
- 1× Proxycurl `skills=include`: ~$0.10
- **Total: ~$0.50 / application**

**If interview is also taken:** add ~$0.30 for 10× `evaluateAnswer`, optionally + `generateFollowUpQuestion` at $0.02 each.

**Burn-rate scenarios at current limits (10/min/IP for /api/ai, 100/min/IP for /api/candidates POST):**
- Single-IP attacker, typical case: `100 × $0.12 = $12/min` ≈ **$720/hr / $17,280/day**.
- Single-IP attacker, worst case (huge resumes): `100 × $0.50 = $50/min` ≈ **$3,000/hr / $72,000/day**.
- 50 rotating IPs at typical: **~$36,000/hr**.

---

## Minimum Cost-Safety Controls Before Launch

- [ ] **OpenAI dashboard hard usage limit** set (e.g. $50–$200/day to start).
- [ ] **Cloudflare Turnstile (or hCaptcha) on the public apply form**; verify token server-side before any AI call fires.
- [ ] **New `apply` rate-limit tier** at `(ip)`: 3/min, 20/hour; AND `(job_id)`: 50/hour; AND `(email)`: 3/day.
- [ ] **Drop AI anon tier from 10/min to 3/min**; require auth on `/api/ai/score-candidate`, `/api/ai/parse-resume`, `/api/ai/evaluate-answer`, `/api/ai/follow-up`, `/api/ai/generate-questions`, `/api/ai/scrape-profile`.
- [ ] **Auth or signed token on `/api/candidates/[id]/pregenerate-questions`**; make it not-callable from the public internet.
- [ ] **Cap `resume_text` and `cover_letter` length** in zod schemas (e.g. 20k chars).
- [ ] **`waitUntil()` wrap** for `processAndScoreCandidate` (or move to a queue).
- [ ] **`export const maxDuration = 30`** on every AI-touching route + `AbortSignal.timeout(20_000)` on each OpenAI call.
- [ ] **Mandatory Upstash in production** — throw on boot if env vars missing.
- [ ] **24h cache** for GitHub and Proxycurl lookups keyed on identifier.
- [ ] **Sentry alert rule** on AI op rate (>30/min) and on AI error rate (>10%); record `usage.total_tokens` on every span.
- [ ] **Switch `parseResume`, `evaluateAnswer`, `generateFollowUpQuestion` to `gpt-4o-mini`**.
- [ ] **Drop Proxycurl `skills=include`** flag (or gate behind a feature flag tied to a paid plan).
- [ ] **Atomic interview-completion guard** before running the `evaluateAnswer` loop.
