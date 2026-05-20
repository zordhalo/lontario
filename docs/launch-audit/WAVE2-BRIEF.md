# Wave 2 — Foundation (decisions locked)

User decisions (2026-05-04):

1. **MVP_USER_ID data is wipeable** — no migration of existing rows needed.
2. **Single recruiter** — the only authenticated user is `brian@creatin.ca`. No multi-tenant logic, no org concept. Marketing CTAs swap to a waitlist signup.
3. **Domain: `lontario.lol`** — use for CORS allowlist, `EMAIL_FROM`, Sentry, canonical URLs.
4. **`ignoreBuildErrors` flipped to false** — all 38 type errors must be fixed inside Wave 2.

## Single-recruiter architecture

- **Public surface (anonymous)**: `GET /jobs`, `GET /jobs/[id]`, `POST /api/public/apply`, `POST /api/waitlist`.
- **Recruiter surface (single authenticated user)**: everything under `/dashboard`, all other `/api/*` routes.
- **RLS posture**: `created_by = auth.uid()` for owner; public anon can `SELECT` only `jobs` where `status='active'` and can `INSERT` only into `candidates` via the apply route (which uses service role *behind* a hardened public API).

## Agents dispatched

| Agent | Files owned | Depends on |
|---|---|---|
| `w2-db-wipe-base` | `supabase/migrations/2026050*_wipe_mvp_*.sql`, `supabase/migrations/2026050*_base_schema_assertions.sql` | — |
| `w2-rls-singleuser` | `supabase/migrations/2026050*_rls_singleuser.sql` | runs after w2-db-wipe-base lands |
| `w2-storage-resumes` | `supabase/migrations/2026050*_resumes_bucket.sql`, `lib/supabase/storage.ts` | — |
| `w2-typescript-fixes` | `next.config.mjs`, all files surfaced by `tsc --noEmit` | — |
| `w2-env-hardening` | `lib/env.ts` (new), `lib/supabase/server.ts`, `lib/supabase/client.ts`, `sentry.*.config.ts`, `instrumentation*.ts` | — |
| `w2-proxy-cors` | `proxy.ts`, `lib/security/cors.ts` | — |

Wave 3 (public apply page + waitlist + auth re-enable + email) fires after Wave 2 lands.
