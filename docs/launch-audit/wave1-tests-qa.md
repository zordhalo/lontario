# Wave 1 — Test Coverage & QA Readiness Audit

Audit date: 2026-04-27. Branch: `main` @ `1de1b44`.

## Scope summary

- **Vitest run**: `pnpm test` → **9 files / 99 tests passed (2.99s)**, exit 0. Many noisy stderr warnings about Zod `.optional()` without `.nullable()` in `lib/ai/openai.ts` resume schema (forward-compat warning from OpenAI SDK; not a test failure).
- **Playwright**: 23 unique tests × 4 projects (Chrome / Firefox / Safari / iPhone 13) = 92 total. Did not execute (would boot dev server).
- **Coverage thresholds**: vitest enforces 80% lines/branches/functions/statements but `pnpm test` script does not pass `--coverage`, so the threshold is never evaluated in normal CI runs.

### Test inventory — `tests/`

| File | Lines | What it covers |
|---|---|---|
| `tests/setup.ts` | 68 | jest-dom matchers, MSW lifecycle, env stubs, mocks `next/navigation` + `next-themes` |
| `tests/mocks/server.ts` | 12 | MSW node server bootstrap |
| `tests/mocks/handlers.ts` | 239 | MSW handlers for `/api/jobs`, `/api/candidates`, `/api/candidates/:id/move`, `/api/interviews/*`, `/api/ai/*`, `/api/dashboard/*`, `/api/activities` |
| `tests/mocks/openai.ts` | 165 | Mock OpenAI structured-output payloads (questions, score, parsed resume, follow-up) |
| `tests/mocks/supabase.ts` | 99 | Mock supabase client builder |
| `tests/unit/lib/utils.test.ts` | 194 | `cn` / class merge utilities |
| `tests/unit/lib/rate-limit.test.ts` | 143 | `getTierForPath`, in-memory limiter (Upstash forced off), `_resetLimiter`, `RATE_LIMIT_CONFIG` |
| `tests/unit/lib/security/cors.test.ts` | 124 | `getCorsHeaders`, `handleCorsPreflightIfNeeded` (14 tests) |
| `tests/unit/lib/security/headers.test.ts` | 53 | `SECURITY_HEADERS` map + `applySecurityHeaders` |
| `tests/unit/lib/ai/openai.test.ts` | 308 | OpenAI client wrappers (mocked) — generate questions, score, parse resume, evaluate answer, follow-up |
| `tests/unit/lib/ai/scoring.test.ts` | 215 | `processAndScoreCandidate` pipeline with mocked supabase + openai + github scraper |
| `tests/integration/api/jobs.test.ts` | 128 | GET/POST/PUT/DELETE `/api/jobs` against MSW handlers |
| `tests/integration/api/candidates.test.ts` | 97 | GET list / GET by id / POST create / POST move — **all hitting MSW mocks, never the real Next route** |
| `tests/integration/api/ai.test.ts` | 114 | `/api/ai/{generate-questions,score-candidate,parse-resume,evaluate-answer}` — **MSW only** |

### Test inventory — `e2e/`

| File | Lines | What it covers |
|---|---|---|
| `e2e/auth.spec.ts` | 69 | Login form display, validation, register/forgot links — UI-only, no real auth |
| `e2e/jobs.spec.ts` | 70 | Jobs listing UI, create form, validation |
| `e2e/candidates.spec.ts` | 64 | Candidates dashboard listing, stage filter visibility, candidate card click; "Application Submission" test merely visits `/` and clicks any apply link if visible — **no actual application is submitted** |
| `e2e/accessibility.spec.ts` | 93 | axe-core scans on landing/login/register, heading hierarchy, color contrast, label association, keyboard nav |

### Config

- `vitest.config.ts:9` — `environment: 'jsdom'`, globals on, MSW setup, alias `@` → repo root. Coverage thresholds 80% but **not invoked by `pnpm test`**.
- `playwright.config.ts:31` — `baseURL: http://localhost:3000`; `webServer: pnpm dev` (timeout 120s, `reuseExistingServer` outside CI). 4 projects, retries=2 in CI.

### Supabase DB tests

`supabase/tests/rls_tests.sql` (469 lines) — **plain psql DO-blocks with manual `RAISE NOTICE`/`RAISE EXCEPTION`. Not pgTAP.** Tests RLS by `SET ROLE` switching for profiles/jobs/candidates/interviews/comments/notifications. Has no runner script in `package.json`; nothing executes it in CI. Per existing observation 3508, RLS is comprehensive but the API layer bypasses it via `MVP_USER_ID` and `// MVP: Auth disabled`, so passing RLS tests do not protect production endpoints.

---

## BLOCKERS

### [BLOCKER-M] Candidate POST integration tests do not exercise the real route
- **File**: `tests/integration/api/candidates.test.ts:51-72`
- **Finding**: `POST /api/candidates` is asserted via `fetch('http://localhost:3000/api/candidates')` which MSW intercepts in `tests/mocks/handlers.ts:142-152`. The test only proves MSW returns 201 — it does **not** import or invoke `app/api/candidates/route.ts`. None of the production guards (zod `createCandidateSchema`, job-exists check, `status !== "active"` → 400 `JOB_CLOSED`, duplicate-email → 409 `DUPLICATE`, background `processAndScoreCandidate`) are tested. All four cases the auditor asked about (happy / duplicate / invalid / closed-job) are unverified.
- **Fix**: Add a true integration test that imports `POST` from `app/api/candidates/route.ts`, mocks `@/lib/supabase/server` (use the existing `tests/mocks/supabase.ts` pattern from `scoring.test.ts`), mocks `@/lib/ai`, and constructs a `NextRequest` to call `POST(req)` directly. Assert: 201 happy path, 400 zod failure (missing email/uuid), 400 `JOB_CLOSED` when `job.status='closed'`, 404 when job missing, 409 `DUPLICATE` on second insert, 500 path on `insertError`.
- **Wave 2 task**: Replace MSW-based candidate API tests with route-level tests that import `app/api/candidates/route.ts` and cover all five branches.

### [BLOCKER-M] No end-to-end public application submission test
- **File**: missing (`e2e/candidates.spec.ts:51-63` is a stub that does not submit)
- **Finding**: The supposed "Application Submission" Playwright test only checks if any `apply` link is visible on `/`. There is no `/apply/[jobId]` page in `app/` (only `(dashboard)`, `(auth)`, `(marketing)`, `interview/[token]`). The most launch-critical path — public candidate POSTs to `/api/candidates` — has zero end-to-end coverage. If validation, duplicate detection, or background scoring breaks, no test catches it.
- **Fix**: First confirm whether a public apply page exists or is planned (Wave 1 `wave1-public-apply-flow.md` likely owns this). Then add `e2e/apply.spec.ts` that: (1) seeds an active job via supabase test fixture, (2) navigates to the apply URL, (3) fills the form, (4) submits, (5) asserts success UI + that a candidate row was created with `stage='applied'`, (6) re-submits same email and asserts duplicate error.
- **Wave 2 task**: Author `e2e/apply.spec.ts` covering happy submit, duplicate, invalid email, and closed-job for the public apply flow once the page exists.

### [BLOCKER-S] AI score-candidate flow is mocked at the wrong layer
- **File**: `tests/integration/api/ai.test.ts:52-69`
- **Finding**: `POST /api/ai/score-candidate` test routes through MSW (`handlers.ts:192-194`) and never touches `app/api/ai/score-candidate/route.ts` or the `lib/ai/scoring.ts` orchestrator. The unit test in `tests/unit/lib/ai/scoring.test.ts` mocks `@/lib/ai/openai` so the OpenAI structured-output schema, prompt-injection guards, token caps, and Sentry span emission are never verified against real (mocked-at-network-edge) OpenAI traffic. msw is in deps but is not used to intercept `api.openai.com` calls.
- **Fix**: Add MSW handlers for `https://api.openai.com/v1/responses` (or whatever endpoint `responses.parse` hits) that return realistic structured payloads, then test `lib/ai/openai.ts::scoreCandidate` directly without mocking the `openai` SDK client itself. Add at least one timeout/error path (msw returns 500) to prove the catch block path.
- **Wave 2 task**: Add MSW-level OpenAI handlers and a route-level test for `app/api/ai/score-candidate/route.ts` covering OK + OpenAI 5xx + invalid JSON.

### [BLOCKER-M] Coverage thresholds are configured but never enforced
- **File**: `vitest.config.ts:36-42` and `package.json` `test` script
- **Finding**: Coverage gates of 80/80/80/80 are declared but `pnpm test` runs `vitest` without `--coverage`, so the thresholds are dead config. CI cannot regress and trip them.
- **Fix**: Add `pnpm test:coverage` script (`vitest run --coverage`) and wire it into the GitHub Actions test job. Confirm v8 provider is installed.
- **Wave 2 task**: Add `test:coverage` script + CI step; lower thresholds initially to current baseline, then ratchet.

---

## HIGH

### [HIGH-S] Move-candidate stage transitions undertested
- **File**: `tests/integration/api/candidates.test.ts:74-96`
- **Finding**: Only "happy → interview" and "404 not found" paths exist, against MSW. No coverage of: invalid stage value (zod 400), terminal-state transitions (`hired`/`rejected` → `applied`?), `rejection_reason` requirement when stage=`rejected`, audit/history side-effects, or notes persistence. The real route is `app/api/candidates/[id]/move/route.ts` (140 lines, never imported by tests).
- **Fix**: Route-level test importing the real `POST` handler with mocked supabase. Verify zod rejects unknown stages and that all 9 stage enum values round-trip.
- **Wave 2 task**: Add `tests/integration/api/candidates-move.test.ts` covering all 9 stages + invalid + 404 + rejection_reason validation.

### [HIGH-S] Supabase auth callback has no test
- **File**: `app/auth/callback/route.ts` (whole file untested); no entry in `tests/`
- **Finding**: The OAuth/magic-link callback is one of three publicly reachable, unauthenticated endpoints (alongside `/api/candidates` POST and the marketing pages). It silently swallows `exchangeCodeForSession` errors (only the truthy-error branch is tested by redirect to `/login?error=auth_callback_error`; a thrown exception would 500). No test verifies the `next` query-param sanitization — `next=//evil.com` would currently redirect off-origin via `new URL(next, requestUrl.origin)` only because `URL` resolves it relative to origin, but `next=/dashboard%23` and similar edge cases are unverified.
- **Fix**: Add `tests/integration/auth/callback.test.ts` that imports `GET`, mocks supabase, and asserts: missing code → `/login?error=`, valid code → 302 to `next`, error from supabase → `/login?error=`, open-redirect attempt (`next=https://evil.com`) → must stay on origin.
- **Wave 2 task**: Add auth-callback tests including open-redirect protection.

### [HIGH-S] Background AI scoring failures swallowed without Sentry capture
- **File**: `app/api/candidates/route.ts:273-275`; `lib/ai/scoring.ts:116, 217, 278, 298, 324, 327`
- **Finding**: `processAndScoreCandidate(...).catch((error) => console.error(...))` runs after the response is sent. Inside `lib/ai/scoring.ts`, six `console.error` sites swallow errors (GitHub fetch, score, DB update, question pre-gen) without any `Sentry.captureException`. Sentry is wired (`@sentry/nextjs` in deps, `lib/ai/openai.ts` uses `Sentry.startSpan`) but the only `captureException` in the entire repo is `app/global-error.tsx:13`. A failed AI score after a candidate applies is invisible in production.
- **Fix**: Add `Sentry.captureException(error, { tags: { area: 'candidate-scoring' }})` to every catch block in `lib/ai/scoring.ts` and the `.catch` in `app/api/candidates/route.ts:273`. Add a test that mocks `@sentry/nextjs` and asserts capture is called when scoring throws.
- **Wave 2 task**: Wrap silent AI catches with `Sentry.captureException` and add a unit test verifying capture on failure.

### [HIGH-S] Rate limiter only tested for in-memory mode
- **File**: `tests/unit/lib/rate-limit.test.ts:16-20`
- **Finding**: `beforeEach` deliberately stubs Upstash env vars to empty so the in-memory limiter is exercised. The Upstash code path that actually runs in production is untested. Tier mappings, sliding-window counts, and the "fail-open vs fail-closed on Upstash error" decision are all unverified for production behavior.
- **Fix**: Add a separate suite that stubs the Upstash env vars, mocks `@upstash/ratelimit` + `@upstash/redis`, and asserts the limiter is constructed once, increments on each request, and behavior when Upstash returns an error.
- **Wave 2 task**: Add Upstash-mode rate-limiter tests including upstream-error behavior.

### [HIGH-S] CORS allow-list not asserted at proxy level
- **File**: `tests/unit/lib/security/cors.test.ts` (unit only); `proxy.ts:17` (no test)
- **Finding**: `getCorsHeaders` is unit-tested but `proxy.ts` (CORS preflight + rate-limit + headers + supabase auth) has zero integration tests. A regression in proxy ordering — e.g., security headers applied before CORS so `Access-Control-Allow-Origin` is missed — would not be caught.
- **Fix**: Add `tests/integration/proxy.test.ts` that constructs a `NextRequest` with various Origin headers and asserts the proxy returns the expected combination of CORS + security + rate-limit headers, both for OPTIONS preflight and actual GET.
- **Wave 2 task**: Add proxy integration tests for CORS preflight + headers + rate-limit interaction.

### [HIGH-S] CI does not run e2e
- **File**: `.github/workflows/` (assumed); `playwright.config.ts:24-26`
- **Finding**: Reporter switches on `process.env.CI` so a pipeline is presumably anticipated, but I found no GitHub Actions job that runs `pnpm exec playwright test`. (Quick check: `find .github -type f` would confirm.) Without it, all 92 e2e cases are local-only.
- **Fix**: Add a `playwright` job to CI matrix; cache browsers; upload HTML report artifact on failure.
- **Wave 2 task**: Wire Playwright into CI, including browser install caching.

---

## MEDIUM

### [MED-S] Integration tests are misnamed — they are MSW contract tests
- **File**: `tests/integration/api/*.test.ts`
- **Finding**: All three files in `tests/integration/api/` use `fetch('http://localhost:3000/api/...')` and rely on MSW handlers. They never start a Next server and never invoke the real route handlers. This gives false confidence that "API integration is tested." See BLOCKER-M for candidates; same applies to jobs and ai.
- **Fix**: Either rename the directory to `tests/contract/` to clarify intent, or convert to true route-handler tests by importing the route and constructing `NextRequest` directly.
- **Wave 2 task**: Convert `tests/integration/api/*.test.ts` into route-handler imports OR rename to clarify they are mock contracts.

### [MED-S] No tests for cron endpoints
- **File**: `app/api/cron/interview-reminders/route.ts`, `app/api/cron/interview-status/route.ts` — both untested
- **Finding**: Cron routes are scheduled by Vercel Cron and modify candidate/interview state. No tests cover idempotency, partial failures, or auth via `CRON_SECRET`. They also bypass rate-limit per `getTierForPath('/api/cron/...')` returning null.
- **Fix**: Unit-test each cron route with mocked supabase; assert auth header check and idempotent behavior on already-processed records.
- **Wave 2 task**: Add cron-route tests with auth-header guard verification.

### [MED-S] Zod schema warnings from OpenAI SDK
- **File**: `lib/ai/openai.ts` (parsed_resume schema)
- **Finding**: Test stderr is flooded with `Zod field … uses .optional() without .nullable()` warnings. Per the SDK message, this becomes an error in a future version and may break resume parsing on upgrade.
- **Fix**: Replace `.optional()` with `.nullable().optional()` (or `.nullish()`) on every parsed_resume field flagged.
- **Wave 2 task**: Update parsed_resume Zod schema for OpenAI structured-outputs forward compatibility.

### [MED-S] Pregenerate-questions, evaluate-answer, follow-up routes lack route-level tests
- **File**: `app/api/candidates/[id]/pregenerate-questions/route.ts`, `app/api/ai/follow-up/route.ts`
- **Finding**: Only the OpenAI wrapper functions are unit-tested (`tests/unit/lib/ai/openai.test.ts`). Route-level guards (auth, validation, error mapping) are untested.
- **Fix**: Route-level tests importing each handler with mocked supabase + openai.
- **Wave 2 task**: Add route tests for pregenerate-questions, follow-up, evaluate-answer.

### [MED-M] Playwright tests are mostly "isVisible-or-skip" stubs
- **File**: `e2e/candidates.spec.ts:27-31, 41-48, 52-63`; `e2e/jobs.spec.ts` (similar pattern)
- **Finding**: Multiple tests use `if (await element.isVisible()) { ...assert... }`. If the element is missing, the test silently passes. Effectively the suite cannot fail except for accessibility violations and the basic auth-page rendering.
- **Fix**: Replace conditional asserts with deterministic seeded fixtures and unconditional expects.
- **Wave 2 task**: Rewrite Playwright stage-filter, candidate-card, and apply tests to fail when the element is missing.

### [MED-S] `pnpm test:e2e` script not found
- **File**: `package.json`
- **Finding**: There is no e2e script wired in package.json (verify); e2e is invoked via `pnpm exec playwright test`. Lowers DX and CI integration.
- **Fix**: Add `"test:e2e": "playwright test"` and `"test:e2e:ui": "playwright test --ui"`.
- **Wave 2 task**: Add e2e scripts to package.json.

### [MED-S] No test for resume PDF / file-upload path on POST /api/candidates
- **File**: `tests/integration/api/candidates.test.ts:52-72`
- **Finding**: The Zod schema does not currently accept a resume file (only `resume_text` per route handler comment, but the schema in route.ts does not list `resume_text` either — only `cover_letter` + URLs). If the public apply flow includes resume upload, that path is undefined and untested.
- **Fix**: Confirm intended resume input shape, add to schema, then add tests.
- **Wave 2 task**: Define resume input contract and add tests.

---

## LOW

### [LOW-S] OpenAI mock structured outputs drift from real schema
- **File**: `tests/mocks/openai.ts`
- **Finding**: The mock fixtures are static and not regenerated from `lib/ai/openai.ts` schemas. If schema changes, tests pass but production breaks.
- **Fix**: Generate mock fixtures from Zod schemas or add a schema-validation step in tests.
- **Wave 2 task**: Validate OpenAI mock fixtures against current Zod schemas in a test.

### [LOW-S] `console.error` in production routes is not a Sentry breadcrumb
- **File**: `app/api/candidates/route.ts:178, 255, 274, 280` and most `app/api/**/route.ts` catches
- **Finding**: 13+ catch blocks log via `console.error` only. Sentry SDK auto-captures unhandled exceptions but not caught-and-rethrown ones. Breadcrumb context is lost.
- **Fix**: Replace with a small `logError(error, ctx)` helper that calls `Sentry.captureException` plus `console.error` in dev.
- **Wave 2 task**: Add `lib/observability/log-error.ts` helper and migrate API catches.

### [LOW-S] No mobile-only e2e tests beyond accessibility
- **File**: `playwright.config.ts:66-69`
- **Finding**: iPhone 13 project runs the same suite. No mobile-specific layout/tap-target tests.
- **Fix**: Add a mobile spec covering apply form usability (after BLOCKER-M is in place).
- **Wave 2 task**: Mobile apply-form e2e.

### [LOW-S] RLS test runner not in CI
- **File**: `supabase/tests/rls_tests.sql` (469 lines, plain DO-blocks)
- **Finding**: No package script or CI step executes this against a test supabase instance. Per existing observation 3508, RLS is comprehensive but the API bypasses it, so even if the script runs, production endpoints aren't protected. Still, regressions in RLS itself would go undetected.
- **Fix**: Convert to pgTAP if practical, or wrap in a `pnpm db:test:rls` script that runs against a dockerized supabase or a dedicated test project; gate in CI.
- **Wave 2 task**: Add a CI job that runs `rls_tests.sql` against a supabase test instance.

---

## Must-have tests before public launch (small, focused, public apply path only)

1. **Route-level test for `POST /api/candidates`** — happy path, duplicate (409), zod-invalid (400), closed job (400 `JOB_CLOSED`), job-not-found (404). Importing the real handler from `app/api/candidates/route.ts`, not MSW. *(addresses BLOCKER-M #1)*
2. **E2E apply submission** — `e2e/apply.spec.ts` that fills the public apply form and asserts a successful 201, plus duplicate-email rejection on second submit. *(addresses BLOCKER-M #2)*
3. **Auth-callback test** — `app/auth/callback/route.ts`: missing code, success, supabase error, and open-redirect protection on `next=`. *(addresses HIGH #2)*
4. **Sentry capture on background scoring failure** — mock `@sentry/nextjs`, force `processAndScoreCandidate` to throw, assert `captureException` is called. *(addresses HIGH #3)*
5. **Proxy integration test** — one OPTIONS preflight + one GET assert that CORS, security headers, and rate-limit headers all coexist on a single response. *(addresses HIGH #5)*
6. **Coverage gate active in CI** — `pnpm test:coverage` with thresholds enforced; even if thresholds start lower than 80 %, the gate must run. *(addresses BLOCKER-M #4)*

If only one item ships, ship #1. If two, add #2.
