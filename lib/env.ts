/**
 * @fileoverview Centralized environment variable validation
 *
 * Validates all `process.env.*` access through a single zod schema so that:
 * - Missing required vars fail fast at module load with a readable error
 * - Optional vars (Upstash, Resend, CRON_SECRET, Sentry) are typed correctly
 *   and callers can branch on presence
 * - The shape of the environment is documented in one place
 *
 * Production behaviour for missing OPTIONAL infra (Upstash / Resend /
 * CRON_SECRET) is delegated to the consumer: this module does NOT crash boot
 * for those. Consumers should check `isProd && !env.X` and either disable the
 * feature, deny the request, or log to Sentry.
 *
 * @module lib/env
 */

import { z } from "zod";

// All vars are typed as optional at the schema level so the module is safe to
// import from edge/client bundles where server-only secrets aren't present.
// Hard requirements are enforced per-call via `requireEnv()` or per-feature
// via `warnDisabledInProd()`.
const serverSchema = z.object({
  // --- Supabase (required at runtime; see requireEnv() in supabase/*.ts) ---
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),

  // --- AI / external APIs (optional at boot; required when invoked) ---
  OPENAI_API_KEY: z.string().min(1).optional(),
  PROXYCURL_API_KEY: z.string().optional(),
  GITHUB_TOKEN: z.string().optional(),

  // --- Email (optional; cron will skip if absent) ---
  RESEND_API_KEY: z.string().min(1).optional(),
  EMAIL_FROM: z
    .string()
    .min(1)
    .default("Lontario <hello@lontario.lol>"),

  // --- Rate limiting (optional in dev; required in prod for rate limiter) ---
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),

  // --- Cron auth (optional; cron returns 503 if unset in prod) ---
  CRON_SECRET: z.string().min(32).optional(),

  // --- Sentry (optional; Sentry init is skipped if DSN unset) ---
  NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
  SENTRY_AUTH_TOKEN: z.string().optional(),

  // --- App URL ---
  NEXT_PUBLIC_APP_URL: z.string().url().default("https://lontario.lol"),

  // --- Runtime ---
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
});

export type ServerEnv = z.infer<typeof serverSchema>;

function loadEnv(): ServerEnv {
  const parsed = serverSchema.safeParse(process.env);

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    // Required vars (Supabase) genuinely cannot be defaulted; throwing is
    // intentional. This fires at module load on the server.
    throw new Error(
      `[lib/env] Invalid environment variables:\n${issues}\n\n` +
        `Check your .env.local / Vercel project env settings.`
    );
  }

  return parsed.data;
}

/**
 * Parsed and validated environment. Throws at import time if any REQUIRED
 * variable is missing or malformed.
 */
export const env: ServerEnv = loadEnv();

export const isProd = env.NODE_ENV === "production";
export const isDev = env.NODE_ENV === "development";
export const isTest = env.NODE_ENV === "test";

/**
 * Strictly require an env var. Throws if it is unset, regardless of
 * environment. Use inside request handlers that genuinely cannot proceed
 * without the value (e.g. an OpenAI route requiring OPENAI_API_KEY).
 */
export function requireEnv<K extends keyof ServerEnv>(key: K): NonNullable<ServerEnv[K]> {
  const value = env[key];
  if (value === undefined || value === null || value === "") {
    throw new Error(
      `[lib/env] Required environment variable "${String(key)}" is not set.`
    );
  }
  return value as NonNullable<ServerEnv[K]>;
}

/**
 * Warn (and report to Sentry, if available) that a feature is disabled in
 * production because its env vars are missing. Safe to call from module top
 * level — degrades to a console.warn if Sentry isn't initialized.
 */
export function warnDisabledInProd(feature: string, missing: string[]): void {
  if (!isProd) return;
  const msg = `[lib/env] Feature "${feature}" disabled in production: missing ${missing.join(", ")}`;
  // Avoid a static `import` to dodge circular init with sentry.* configs.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let captured = false;
  try {
    // dynamic require so this file stays edge-safe
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Sentry = require("@sentry/nextjs");
    if (Sentry?.captureMessage) {
      Sentry.captureMessage(msg, "error");
      captured = true;
    }
  } catch {
    // Sentry not installed / not initialized — fall through to console.
  }
  if (!captured) {
    // eslint-disable-next-line no-console
    console.error(msg);
  }
}
