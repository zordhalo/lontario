# Wave 1 Audit — Infrastructure & Deployment (Vercel)

**Repo**: `lontario-yc` @ `main`
**Audit date**: 2026-04-27
**Scope**: next.config.mjs, vercel.json, env vars, Sentry, proxy.ts, build artifacts, logging, Supabase clients, function/runtime config, Node version.

---

## BLOCKERS

### [BLOCKER-M] `typescript.ignoreBuildErrors: true` masks 38 real type errors
- **File**: `next.config.mjs:5-7`
- **Finding**: `npx tsc --noEmit` produces **38 errors across 9 files**. Categories:
  - `TS7053` (×6): unsafe index signatures in `components/interview/QuestionDisplay.tsx`, `components/jobs/job-card.tsx` — runtime crash risk when a status (e.g. `paused`) is encountered.
  - `TS2322` (×3): wrong status string assigned to typed enums in `app/(dashboard)/jobs/new/page.tsx`, `components/jobs/candidate-panel.tsx`, and a `Promise<void>`-vs-`MouseEventHandler` mismatch in `app/interview/[token]/CandidateInterviewClient.tsx:470` (button onClick will silently break form-state expectations).
  - `TS2352` (×3): incorrect `as` casts on Supabase joined rows (which return arrays) in `app/api/activities/route.ts:74`, `app/api/dashboard/alerts/route.ts:41`, `components/jobs/candidate-panel.tsx:150` — these will read `.title`/`.id` from arrays and produce `undefined` at runtime.
  - `TS2339` (×1): `app/api/candidates/[id]/move/route.ts:123` reads `.title` off an array → `undefined` in activity log.
  - `TS7006`/`TS7031` (×6): implicit `any` in `lib/supabase/server.ts:50-52` cookie callback parameters and `QuestionDisplay.tsx:216`.
  - `TS2345` (×2): test-only failures in `tests/unit/lib/ai/scoring.test.ts`.
- **Fix**: Fix the Supabase join-shape errors first (these are real production bugs that will surface on `/api/activities`, `/api/dashboard/alerts`, and the move endpoint). Then remove `ignoreBuildErrors` and run `tsc --noEmit` in CI.
- **Wave 2 task**: Resolve all 38 TypeScript errors and remove `next.config.mjs` `ignoreBuildErrors` flag, then add `pnpm tsc --noEmit` to CI gating.

### [BLOCKER-S] Sentry DSN hardcoded in source — cannot be rotated without redeploy
- **File**: `instrumentation-client.ts:8`, `sentry.server.config.ts:8`, `sentry.edge.config.ts:9`
- **Finding**: `dsn: "https://5bff9440a5dd36735f2c9ec10476c7a2@o4510828351324160.ingest.us.sentry.io/4510828353486848"` is committed in three files. DSNs are not strictly secret, but hardcoding prevents per-environment routing (preview vs prod) and forces a redeploy to rotate.
- **Fix**: Replace with `process.env.NEXT_PUBLIC_SENTRY_DSN ?? "<fallback>"`. Set `NEXT_PUBLIC_SENTRY_DSN` and `SENTRY_DSN` in Vercel env (preview + production).
- **Wave 2 task**: Move Sentry DSN to env var with separate preview/production projects.

### [BLOCKER-S] `proxy.ts` will block `/apply/*` page routes when added — no public allowlist
- **File**: `proxy.ts:59-197`, matcher `proxy.ts:200-210`
- **Finding**: Matcher catches everything except static files. The page-route branch (lines 145-196) calls `supabase.auth.getSession()` on every non-API request. For an as-yet-unbuilt public `/apply/[jobId]` flow this is wasted Supabase calls per request, **and the entire matcher would still need the public path to remain off `PROTECTED_ROUTES`** (currently fine, but the `/jobs/create` and `/jobs/edit` entries will collide if `/jobs/[id]/apply` is added under that tree). Additionally rate-limit tier resolution defaults to `general` (100/min) for any `/api/apply/*` endpoint that gets created — fine for browsing, but resume uploads will be throttled by the wrong tier.
- **Fix**: (a) Add explicit `PUBLIC_ROUTES = ["/apply", "/jobs/[id]"]` short-circuit before Supabase auth call. (b) Update `getTierForPath` in `lib/rate-limit/index.ts` to map `/api/apply/*` → `general` and any upload sub-route → `upload`. (c) Confirm matcher excludes `/apply/[jobId]` static assets.
- **Wave 2 task**: Add public-route fast path to `proxy.ts` and dedicated rate-limit tier for the public apply endpoint.

### [BLOCKER-S] Public `/icon-*.png` assets are 5 MB each — will tank LCP and balloon Vercel egress
- **File**: `public/apple-icon.png` (4.7 MB), `public/icon-dark-32x32.png` (5.1 MB), `public/icon-light-32x32.png` (5.0 MB)
- **Finding**: `ls -la public/` shows 4.7-5.1 MB PNGs at 32×32 resolution — almost certainly the wrong file (likely full-resolution exports saved with the wrong size). Combined with `images.unoptimized: true` in `next.config.mjs:9`, every favicon hit serves megabytes.
- **Fix**: Re-export favicons at correct dimensions (icon-32x32 should be ~1-2 KB, apple-icon at 180×180 should be <50 KB). Set `images.unoptimized` to default (false) unless there's a documented reason.
- **Wave 2 task**: Replace oversized favicons and re-enable Next.js image optimization.

---

## HIGH

### [HIGH-S] CSP `connect-src` missing OpenAI, Resend, and Sentry tunnel route
- **File**: `next.config.mjs:48`
- **Finding**: Current `connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.ingest.sentry.io https://va.vercel-scripts.com`. Issues:
  - **OpenAI**: All OpenAI calls happen server-side (`lib/ai/openai.ts`), so no client `connect-src` needed — OK.
  - **Resend**: Server-side only (`lib/email/index.ts`) — OK.
  - **Sentry tunnel**: `next.config.mjs:80` configures `tunnelRoute: "/monitoring"`, which means client telemetry hits same-origin `/monitoring/*`. `'self'` covers it. ✅
  - **PROBLEM — Supabase Storage uploads**: `img-src` allows `https://*.supabase.co` but `connect-src` only allows the same domain. Storage signed-URL uploads use `XHR/fetch` to `https://<project>.supabase.co/storage/v1/object/...` which **is** covered by `https://*.supabase.co`. ✅
  - **PROBLEM — Turnstile/hCaptcha future**: Not in CSP. Adding either later requires `script-src` and `frame-src` updates.
  - **PROBLEM — Sentry session replay**: Worker scripts blob: covered, but the Sentry CDN for replay snapshot upload uses `*.sentry.io` (not just `*.ingest.sentry.io`). Verify with the Sentry dashboard that no replay events are blocked.
- **Fix**: Add a CSP comment block listing future-domain allowlist: Turnstile (`https://challenges.cloudflare.com`), hCaptcha (`https://*.hcaptcha.com`). Broaden Sentry to `https://*.sentry.io` to cover replays.
- **Wave 2 task**: Update CSP to include Turnstile/hCaptcha placeholders and broaden Sentry domains.

### [HIGH-S] `'unsafe-inline'` and `'unsafe-eval'` in `script-src` defeats most CSP value
- **File**: `next.config.mjs:43`
- **Finding**: `script-src 'self' 'unsafe-inline' 'unsafe-eval' https://va.vercel-scripts.com`. `unsafe-eval` is required by some libs but `unsafe-inline` should be replaced with a per-request nonce in middleware.
- **Fix**: Move CSP construction into `proxy.ts` so per-request nonce can be injected; emit nonces on `<Script>` tags. Optional: keep `'unsafe-inline'` only for `style-src` (Tailwind needs it for arbitrary value classes).
- **Wave 2 task**: Implement nonce-based CSP in proxy.ts and remove `'unsafe-inline'` from script-src.

### [HIGH-S] No `.vercelignore` — full repo (incl. `aiRoadmap.md`, large markdown, e2e tests) shipped to build context
- **File**: `(missing)` — repo root
- **Finding**: No `.vercelignore`; markdown docs (`aiRoadmap.md` 42KB, `contrario-aiAnalysis.md` 34KB, `lontarioJOKE-profile.md` 36KB) and `e2e/`, `tests/` dirs are pulled into the build container. Doesn't break the build, but inflates upload time and exposes internal docs that may contain customer or strategy notes.
- **Fix**: Add `.vercelignore`:
  ```
  e2e/
  tests/
  *.md
  !README.md
  .agent/
  .claude/
  docs/
  ```
- **Wave 2 task**: Create `.vercelignore` excluding tests, docs, and audit artifacts.

### [HIGH-S] No `engines` field in `package.json` — Vercel may default to non-LTS Node
- **File**: `package.json` (no `"engines"` key)
- **Finding**: Without `engines.node`, Vercel uses the project setting, which defaults to its current default. As of 2026, Vercel offers Node 22 (LTS) and Node 24 (current LTS). The Sentry SDK and Next 16 are tested on 20+. Pinning is necessary for reproducible builds.
- **Fix**: Add `"engines": { "node": "22.x" }` to `package.json`. Also set Node version in Vercel project settings to match.
- **Wave 2 task**: Pin Node version via `engines` and Vercel project settings.

### [HIGH-S] Missing `robots.txt`, `sitemap.xml`, `og-image` for marketing/apply pages
- **File**: `public/` directory listing
- **Finding**: No `robots.txt`, no `sitemap.xml`, no OG image, no Web App `manifest.json`, no `apple-touch-icon` at correct size. For a YC-launch marketing page + `/apply` flow this affects SEO and link previews.
- **Fix**: Add `app/robots.ts` and `app/sitemap.ts` (Next 16 file conventions). Add `app/opengraph-image.tsx` (or static `public/og-default.png`) sized 1200×630.
- **Wave 2 task**: Add robots/sitemap/OG image generation for the public-facing pages.

### [HIGH-M] `getBaseUrl()` returns malformed URL when relying on `VERCEL_URL`
- **File**: `lib/supabase/auth.ts:253-263`
- **Finding**: `process.env.VERCEL_URL` is a hostname (e.g. `lontario-abc123.vercel.app`) **without** a scheme. Using it directly as a URL produces `lontario-abc123.vercel.app/auth/callback` (invalid). All OAuth/email/reset redirects will break on preview deploys.
- **Fix**: 
  ```ts
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
  ```
- **Wave 2 task**: Fix `getBaseUrl()` URL scheme handling and add unit test.

### [HIGH-S] Cron routes have no `maxDuration` or `runtime` declared — default 10s timeout
- **File**: `app/api/cron/interview-reminders/route.ts`, `app/api/cron/interview-status/route.ts`
- **Finding**: Both cron handlers iterate Supabase rows and send N emails sequentially via Resend. With the Hobby plan default of 10s and Pro default of 15s, a batch of >20 emails (each ~300-500ms via Resend) will time out and leave `reminder_sent_at` partially set.
- **Fix**: Add `export const maxDuration = 300;` and `export const runtime = "nodejs";` to both cron route files. Switch sequential `for` loop to a small concurrency pool (e.g. `Promise.all` chunks of 5).
- **Wave 2 task**: Add maxDuration/runtime exports to cron routes and parallelize email sends.

### [HIGH-S] Cron secret check is a no-op when env var is unset
- **File**: `app/api/cron/interview-reminders/route.ts:26`, `app/api/cron/interview-status/route.ts:21`
- **Finding**: `if (cronSecret && authHeader !== ...)` — when `CRON_SECRET` is not set the check passes silently. Anyone hitting `/api/cron/interview-status` can forcibly mark interviews missed/abandoned/expired in production.
- **Fix**: Invert: `if (process.env.NODE_ENV === 'production' && (!cronSecret || authHeader !== ...))`. Or fail-closed always: `if (!cronSecret || authHeader !== ...) return 401`.
- **Wave 2 task**: Make cron secret verification fail-closed in production.

### [HIGH-S] AI routes log full error including potential prompt content
- **File**: `app/api/ai/score-candidate/route.ts:52`, `evaluate-answer/route.ts:52`, `generate-questions/route.ts:72`, `parse-resume/route.ts:45`, `follow-up/route.ts:52`, `scrape-profile/route.ts:98`
- **Finding**: `console.error("Error scoring candidate:", error)` — when OpenAI throws, the error often includes the request body in `error.response.data` (resume text, candidate name, email). Combined with `sendDefaultPii: true` in `sentry.server.config.ts:20` and `recordInputs: true / recordOutputs: true` in the OpenAI integration, every AI failure ships full PII to Sentry.
- **Fix**: Either (a) flip `sendDefaultPii` to `false` and `recordInputs`/`recordOutputs` to `false` server-side, or (b) add a `beforeSend` hook that strips known PII fields (`resume_text`, `email`, `full_name`) before serialization. The current `beforeSend` only deletes `event.user.email` — it doesn't touch `event.exception` or `event.contexts`.
- **Wave 2 task**: Tighten Sentry server-side PII scrubbing and disable OpenAI input/output recording in production.

---

## MEDIUM

### [MEDIUM-S] `images.unoptimized: true` disables all Next/Image optimization globally
- **File**: `next.config.mjs:8-10`
- **Finding**: With unoptimized images, every `<Image>` becomes a plain `<img>` with no resize, no AVIF/WebP, no CDN cache. The marketing page references `public/images/testimonial-*.jpg` and a logo — these would all benefit from optimization.
- **Fix**: Remove `images.unoptimized: true`. Add `images.remotePatterns` for `*.supabase.co` if user uploads are rendered.
- **Wave 2 task**: Remove `images.unoptimized` and configure remotePatterns for Supabase Storage.

### [MEDIUM-S] `app/api/sentry-example-api/route.ts` and `app/sentry-example-page/page.tsx` will ship to production
- **File**: `app/api/sentry-example-api/route.ts`, `app/sentry-example-page/page.tsx`
- **Finding**: These intentionally throw errors and are part of the Sentry quickstart. Anyone hitting `/sentry-example-page` triggers a 500 and pollutes Sentry quota.
- **Fix**: Delete both routes before launch, or gate behind `if (process.env.NODE_ENV !== 'production') notFound()`.
- **Wave 2 task**: Remove Sentry example routes from production build.

### [MEDIUM-S] Sentry replay sample rate (10%) + `recordInputs/Outputs` will exceed quota
- **File**: `instrumentation-client.ts:26`, `sentry.server.config.ts:24-27`
- **Finding**: 10% session replay × all dashboard users + AI input/output capture on every server route → likely to blow through default quota in week 1. Combined with `enableLogs: true` on every config (3 files).
- **Fix**: Drop `replaysSessionSampleRate` to 0.01 (1%) for launch. Set `enableLogs: false` server-side; only client-side logging is useful. Set `tracesSampleRate` to 0.05 in production.
- **Wave 2 task**: Tune Sentry sample rates for production cost control.

### [MEDIUM-S] `EMAIL_FROM` falls back to `noreply@example.com` — emails will hard-bounce
- **File**: `lib/email/index.ts:53`
- **Finding**: `const DEFAULT_FROM = process.env.EMAIL_FROM || "Lontario <noreply@example.com>";` If `EMAIL_FROM` is forgotten in production env, every transactional email sends from a non-routable domain and Resend may reject the request entirely (unverified sender).
- **Fix**: Throw at module init if `EMAIL_FROM` is missing in production. Or hardcode a known-verified default like `Lontario <noreply@lontario.com>`.
- **Wave 2 task**: Make `EMAIL_FROM` required in production and verify the sender domain in Resend.

### [MEDIUM-S] `lib/rate-limit/index.ts` falls back to in-memory limiter silently
- **File**: `lib/rate-limit/index.ts:202-219`
- **Finding**: Logs a warning but still serves traffic. On Vercel each lambda has its own memory → effectively no rate limiting. The auth tier (5/min) becomes 5/min/lambda × N lambdas → password-spray protection gone.
- **Fix**: Throw at boot in production if `UPSTASH_REDIS_REST_URL`/`TOKEN` missing.
- **Wave 2 task**: Make Upstash credentials mandatory in production rate limiter.

### [MEDIUM-S] `console.error` calls log Supabase errors that may contain row data
- **File**: 40+ occurrences across `app/api/**/*.ts`
- **Finding**: `console.error("Database error:", dbError)` — Supabase error objects include `.details` and `.hint` strings that sometimes echo column values for unique-constraint failures (e.g. duplicate email). On Vercel these go to runtime logs (and Sentry if `Sentry.captureException` wraps them).
- **Fix**: Centralize: create `lib/logger.ts` that whitelists fields (`code`, `message`, `pgcode`) and strips `details`. Replace direct `console.error` with `logger.error`.
- **Wave 2 task**: Introduce a structured logger that scrubs Supabase error payloads.

### [MEDIUM-S] CORS allowlist allows ANY `*.vercel.app` preview
- **File**: `lib/security/cors.ts:49`
- **Finding**: `if (/^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(origin)) return true;` — this lets any random Vercel project on the same Vercel platform use the API with credentials. Combined with `Access-Control-Allow-Credentials: true`, an attacker with a `*.vercel.app` deployment could mount a CSRF-style attack on a logged-in user.
- **Fix**: Replace regex with explicit `<project-name>-*.vercel.app` pattern, or whitelist only `VERCEL_URL` and `VERCEL_BRANCH_URL` exactly.
- **Wave 2 task**: Restrict CORS allowlist to project-specific Vercel preview URLs.

---

## LOW

### [LOW-XS] `tunnelRoute: "/monitoring"` collides with proxy skip but not documented
- **File**: `next.config.mjs:80`, `proxy.ts:65`
- **Finding**: The proxy skips `/monitoring` correctly. Just confirm no future page route is added under that path.
- **Fix**: Add a comment in `proxy.ts` referencing `next.config.mjs:80`.
- **Wave 2 task**: Add cross-reference comment between Sentry tunnelRoute and proxy skip list.

### [LOW-XS] No `Vary: Origin` header on CORS responses
- **File**: `lib/security/cors.ts:58-71`
- **Finding**: When `Access-Control-Allow-Origin` is dynamic, caches need `Vary: Origin` to avoid serving the wrong origin's response.
- **Fix**: Add `"Vary": "Origin"` to the returned headers.
- **Wave 2 task**: Add `Vary: Origin` to CORS response headers.

### [LOW-XS] No HEAD method support on cron — Vercel health checks may 405
- **File**: `app/api/cron/interview-reminders/route.ts`, `interview-status/route.ts`
- **Finding**: Only `GET` exported. Vercel cron uses GET so OK, but uptime monitors may HEAD.
- **Fix**: Add `export const HEAD = GET;` or accept it explicitly.
- **Wave 2 task**: (optional) Add HEAD support to cron routes.

### [LOW-XS] `serverExternalPackages` only lists IITM/RITM — verify no other native deps
- **File**: `next.config.mjs:11`
- **Finding**: Externalizing `import-in-the-middle`/`require-in-the-middle` is correct for Sentry. No other Node-native modules in deps that need this treatment.
- **Fix**: None.
- **Wave 2 task**: N/A.

---

## (a) Complete Environment Variable Checklist

### Required in production (app will crash or silently fail)
| Var | Where used | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `lib/supabase/{client,server}.ts`, `proxy.ts:150` | Public, throws if missing |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | same | Public, throws if missing |
| `SUPABASE_SERVICE_ROLE_KEY` | `lib/supabase/server.ts:86` (admin client) | **SERVER-ONLY**. Never `NEXT_PUBLIC_*`. Verified not bundled — only imported via `createAdminClient` in cron + AI routes. Throws if missing in cron/admin paths. |
| `OPENAI_API_KEY` | `lib/ai/openai.ts:56` | Throws on first AI call |
| `RESEND_API_KEY` | `lib/email/index.ts:43` | Throws on first send |
| `EMAIL_FROM` | `lib/email/index.ts:53` | Currently falls back to invalid `noreply@example.com` — see MEDIUM finding |
| `CRON_SECRET` | `app/api/cron/*/route.ts` | Currently optional (silent skip) — see HIGH finding |
| `UPSTASH_REDIS_REST_URL` | `lib/rate-limit/index.ts:205` | Falls back to in-memory (broken on serverless) — see MEDIUM finding |
| `UPSTASH_REDIS_REST_TOKEN` | `lib/rate-limit/index.ts:206` | Same |
| `NEXT_PUBLIC_APP_URL` | `lib/security/cors.ts:17`, `lib/supabase/auth.ts:259` | Used for CORS allowlist + OAuth redirects |

### Required by Sentry (currently hardcoded — see BLOCKER)
| Var | Where used |
|---|---|
| `NEXT_PUBLIC_SENTRY_DSN` | (should be in `instrumentation-client.ts`) |
| `SENTRY_DSN` | (should be in `sentry.server.config.ts`, `sentry.edge.config.ts`) |
| `SENTRY_AUTH_TOKEN` | source map upload via `withSentryConfig` (Vercel integration sets automatically if connected) |

### Optional
| Var | Where used | Effect if absent |
|---|---|---|
| `PROXYCURL_API_KEY` | `lib/ai/linkedin.ts:48` | LinkedIn enrichment disabled (graceful) |
| `GITHUB_TOKEN` | `lib/ai/github.ts:54` | Public rate limit (60/hr) instead of 5000/hr |
| `VERCEL_URL` | `lib/security/cors.ts:23`, `lib/supabase/auth.ts:260` | Auto-set by Vercel |
| `VERCEL_BRANCH_URL` | `lib/security/cors.ts:29` | Auto-set by Vercel |
| `NODE_ENV` | many | Auto-set by Vercel |
| `NEXT_RUNTIME` | `instrumentation.ts:4` | Auto-set by Next |
| `CI` | `next.config.mjs:68` | Just toggles Sentry log silence |
| `SUPABASE_PROJECT_ID` | `package.json` script `db:types` only | Local dev only |

### Variables used WITHOUT a fallback that would crash on cold start
- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `proxy.ts:150-151` use the `!` non-null assertion. **The proxy runs on every request**, so missing either kills 100% of traffic at the edge with no clear error. (`lib/supabase/{client,server}.ts` throw a readable error instead.)

---

## (b) Pre-deploy go/no-go checklist

Tick each before promoting to production:

- [ ] All BLOCKER items resolved (TS errors fixed; Sentry DSN env-driven; proxy public allowlist; favicons resized).
- [ ] `pnpm tsc --noEmit` exits 0 in CI.
- [ ] `pnpm build` runs locally without warnings about chunk size or missing env.
- [ ] All env vars from "Required in production" set in **Vercel → Settings → Environment Variables** for both `Production` and `Preview` (different values OK).
- [ ] `SUPABASE_SERVICE_ROLE_KEY` confirmed **NOT** prefixed with `NEXT_PUBLIC_` and not referenced in any client component (`grep -r SUPABASE_SERVICE_ROLE_KEY components/` returns nothing — verified).
- [ ] `CRON_SECRET` set, fail-closed code path merged.
- [ ] `UPSTASH_REDIS_REST_URL` + `_TOKEN` set; in-memory fallback gated on `NODE_ENV !== 'production'`.
- [ ] `EMAIL_FROM` set to a verified Resend sender.
- [ ] `NEXT_PUBLIC_APP_URL` set to canonical production URL (e.g. `https://lontario.com`).
- [ ] Vercel project Node version pinned (Settings → General → Node Version) and `engines.node` set.
- [ ] `app/sentry-example-page` and `app/api/sentry-example-api` removed.
- [ ] `.vercelignore` added; redeploy verifies tests/docs not in build context.
- [ ] `robots.ts`, `sitemap.ts`, `opengraph-image.tsx` added; verified at `/robots.txt`, `/sitemap.xml`.
- [ ] `proxy.ts` updated with `/apply` public allowlist before any apply UI is exposed.
- [ ] Sentry sample rates lowered: traces 0.05, replays 0.01, server `sendDefaultPii: false`, `enableLogs: false` on server.
- [ ] CORS regex tightened to project-specific preview URLs.
- [ ] Public favicon files <100 KB each (`ls -lh public/*.png`).
- [ ] First production deploy: hit `/api/cron/interview-status` with wrong/no `Authorization` and verify 401.
- [ ] First production deploy: hit `/api/ai/score-candidate` 11 times and verify a 429 (Upstash working).
- [ ] First production deploy: confirm Sentry receives a test event from `/sentry-example-page` (then remove).
- [ ] Smoke-test OAuth login: redirect URL must be `https://<prod>/auth/callback`, not `<prod>/auth/callback`.

---

**End of Wave 1 audit.**
