/**
 * @fileoverview Rate Limiting Module
 *
 * Provides tiered rate limiting for API routes using Upstash Redis
 * in production and an in-memory fallback for local development.
 *
 * @module lib/rate-limit
 */

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { env, isProd, warnDisabledInProd } from "@/lib/env";

// ============================================================
// Types & Configuration
// ============================================================

export type RateLimitTier =
  | "general"
  | "auth"
  | "ai"
  | "upload"
  | "apply"
  | "waitlist";

interface TierConfig {
  limit: number;
  windowMs: number;
}

export const RATE_LIMIT_CONFIG: Record<RateLimitTier, TierConfig> = {
  general: { limit: 100, windowMs: 60_000 },
  auth: { limit: 5, windowMs: 60_000 },
  ai: { limit: 10, windowMs: 60_000 },
  upload: { limit: 5, windowMs: 60_000 },
  // Wave 3 — public-API tiers (per-IP)
  apply: { limit: 3, windowMs: 60_000 },
  waitlist: { limit: 5, windowMs: 60_000 },
};

/**
 * Per-email rate limits for public endpoints. Applied via
 * {@link checkEmailRateLimit} so a single email can't be abused across
 * many IPs. Windows are deliberately longer than the per-IP windows.
 */
const EMAIL_RATE_LIMIT_CONFIG: Record<"apply" | "waitlist", TierConfig> = {
  apply: { limit: 2, windowMs: 60 * 60_000 }, // 2 / hour per email
  waitlist: { limit: 1, windowMs: 60 * 60_000 }, // 1 / hour per email
};

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

// ============================================================
// Tier Resolution
// ============================================================

/**
 * Determine the rate limit tier for a given pathname.
 * Returns null for routes that should skip rate limiting (e.g. cron).
 */
export function getTierForPath(pathname: string): RateLimitTier | null {
  // Cron routes are protected by CRON_SECRET — skip rate limiting
  if (pathname.startsWith("/api/cron/")) {
    return null;
  }

  // Auth routes
  if (pathname.startsWith("/api/auth/")) {
    return "auth";
  }

  // AI routes
  if (pathname.startsWith("/api/ai/")) {
    return "ai";
  }

  // Interview submit is AI-tier (makes multiple OpenAI calls)
  if (/^\/api\/interviews\/[^/]+\/submit$/.test(pathname)) {
    return "ai";
  }

  // Wave 3 — public apply flow. Resume-upload-url shares the apply tier
  // so attackers can't burn signed URLs faster than they can apply.
  if (
    pathname === "/api/public/apply" ||
    pathname === "/api/public/resume-upload-url"
  ) {
    return "apply";
  }

  if (pathname === "/api/waitlist") {
    return "waitlist";
  }

  // Default tier for all other API routes
  return "general";
}

// ============================================================
// Rate Limiter Implementations
// ============================================================

interface RateLimiter {
  check(identifier: string, tier: RateLimitTier): Promise<RateLimitResult>;
}

/**
 * Upstash Redis-backed rate limiter for production use.
 */
function createUpstashLimiter(redis: Redis): RateLimiter {
  // Create one Ratelimit instance per tier with sliding window.
  // Built dynamically from RATE_LIMIT_CONFIG so adding a new tier requires
  // only a single line in the config map.
  const limiters = {} as Record<RateLimitTier, Ratelimit>;
  for (const tier of Object.keys(RATE_LIMIT_CONFIG) as RateLimitTier[]) {
    const cfg = RATE_LIMIT_CONFIG[tier];
    limiters[tier] = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(cfg.limit, `${cfg.windowMs}ms`),
      prefix: `rl:${tier}`,
    });
  }

  return {
    async check(identifier, tier) {
      const config = RATE_LIMIT_CONFIG[tier];
      const result = await limiters[tier].limit(identifier);
      return {
        allowed: result.success,
        limit: config.limit,
        remaining: result.remaining,
        reset: result.reset,
      };
    },
  };
}

/**
 * In-memory rate limiter for local development.
 * Not suitable for production (stateless on Vercel).
 */
function createInMemoryLimiter(): RateLimiter {
  const store = new Map<string, { count: number; resetTime: number }>();

  // Periodic cleanup (1% chance per check)
  function maybeCleanup() {
    if (Math.random() < 0.01) {
      const now = Date.now();
      for (const [key, value] of store.entries()) {
        if (now > value.resetTime) {
          store.delete(key);
        }
      }
    }
  }

  return {
    async check(identifier, tier) {
      maybeCleanup();

      const config = RATE_LIMIT_CONFIG[tier];
      const key = `${tier}:${identifier}`;
      const now = Date.now();
      const record = store.get(key);

      if (!record || now > record.resetTime) {
        store.set(key, { count: 1, resetTime: now + config.windowMs });
        return {
          allowed: true,
          limit: config.limit,
          remaining: config.limit - 1,
          reset: now + config.windowMs,
        };
      }

      if (record.count >= config.limit) {
        return {
          allowed: false,
          limit: config.limit,
          remaining: 0,
          reset: record.resetTime,
        };
      }

      record.count++;
      return {
        allowed: true,
        limit: config.limit,
        remaining: config.limit - record.count,
        reset: record.resetTime,
      };
    },
  };
}

// ============================================================
// Factory
// ============================================================

let _limiter: RateLimiter | null = null;

/**
 * Get or create the singleton rate limiter.
 * Uses Upstash Redis if UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN
 * are set, otherwise falls back to in-memory.
 */
/**
 * Deny-all rate limiter used in production when Upstash is unconfigured.
 * Fail-closed: rejects every request rather than silently dropping back to
 * an in-memory store that cannot work on serverless.
 */
function createDenyAllLimiter(): RateLimiter {
  return {
    async check(_identifier, tier) {
      const config = RATE_LIMIT_CONFIG[tier];
      return {
        allowed: false,
        limit: config.limit,
        remaining: 0,
        reset: Date.now() + config.windowMs,
      };
    },
  };
}

export function getRateLimiter(): RateLimiter {
  if (_limiter) return _limiter;

  const url = env.UPSTASH_REDIS_REST_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN;

  if (url && token) {
    const redis = new Redis({ url, token });
    _limiter = createUpstashLimiter(redis);
  } else if (isProd) {
    // Fail-closed in production: log to Sentry and deny all requests
    // rather than fall back to an in-memory store that does not work on
    // serverless (Vercel) and would silently disable rate limiting.
    warnDisabledInProd("rate-limit", [
      "UPSTASH_REDIS_REST_URL",
      "UPSTASH_REDIS_REST_TOKEN",
    ]);
    _limiter = createDenyAllLimiter();
  } else {
    _limiter = createInMemoryLimiter();
  }

  return _limiter;
}

/** Exported for testing — resets the cached limiter instance. */
export function _resetLimiter() {
  _limiter = null;
  _emailLimiters = null;
}

// ============================================================
// Per-email rate limiters (Wave 3 — public apply / waitlist)
// ============================================================

type EmailTier = "apply" | "waitlist";

/**
 * Lazily-built per-email limiters. Separate Upstash Ratelimit instances
 * (distinct prefix) so per-email counts don't collide with per-IP counts.
 */
let _emailLimiters:
  | {
      upstash: Record<EmailTier, Ratelimit> | null;
      memory: Map<string, { count: number; resetTime: number }> | null;
    }
  | null = null;

function getEmailLimiters() {
  if (_emailLimiters) return _emailLimiters;

  const url = env.UPSTASH_REDIS_REST_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN;

  if (url && token) {
    const redis = new Redis({ url, token });
    const upstash: Record<EmailTier, Ratelimit> = {
      apply: new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(
          EMAIL_RATE_LIMIT_CONFIG.apply.limit,
          `${EMAIL_RATE_LIMIT_CONFIG.apply.windowMs}ms`
        ),
        prefix: "rl:email:apply",
      }),
      waitlist: new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(
          EMAIL_RATE_LIMIT_CONFIG.waitlist.limit,
          `${EMAIL_RATE_LIMIT_CONFIG.waitlist.windowMs}ms`
        ),
        prefix: "rl:email:waitlist",
      }),
    };
    _emailLimiters = { upstash, memory: null };
  } else if (isProd) {
    // Fail-closed in production. Same rationale as the per-IP limiter.
    warnDisabledInProd("email-rate-limit", [
      "UPSTASH_REDIS_REST_URL",
      "UPSTASH_REDIS_REST_TOKEN",
    ]);
    _emailLimiters = { upstash: null, memory: null };
  } else {
    _emailLimiters = { upstash: null, memory: new Map() };
  }

  return _emailLimiters;
}

/**
 * Check whether `email` has exceeded its per-email rate limit for the given
 * public-API tier. Uses a longer window than the per-IP limiter so a single
 * email cannot be abused by rotating IPs.
 *
 * Production with no Upstash configured → fail-closed (denies the request).
 * Development → in-memory fallback.
 */
export async function checkEmailRateLimit(
  email: string,
  tier: EmailTier
): Promise<RateLimitResult> {
  const cfg = EMAIL_RATE_LIMIT_CONFIG[tier];
  const limiters = getEmailLimiters();
  const identifier = email.trim().toLowerCase();

  // Production, no Upstash → fail-closed.
  if (isProd && !limiters.upstash) {
    return {
      allowed: false,
      limit: cfg.limit,
      remaining: 0,
      reset: Date.now() + cfg.windowMs,
    };
  }

  if (limiters.upstash) {
    const result = await limiters.upstash[tier].limit(identifier);
    return {
      allowed: result.success,
      limit: cfg.limit,
      remaining: result.remaining,
      reset: result.reset,
    };
  }

  // Dev in-memory fallback.
  const store = limiters.memory!;
  const key = `email:${tier}:${identifier}`;
  const now = Date.now();
  const record = store.get(key);

  if (!record || now > record.resetTime) {
    store.set(key, { count: 1, resetTime: now + cfg.windowMs });
    return {
      allowed: true,
      limit: cfg.limit,
      remaining: cfg.limit - 1,
      reset: now + cfg.windowMs,
    };
  }

  if (record.count >= cfg.limit) {
    return {
      allowed: false,
      limit: cfg.limit,
      remaining: 0,
      reset: record.resetTime,
    };
  }

  record.count++;
  return {
    allowed: true,
    limit: cfg.limit,
    remaining: cfg.limit - record.count,
    reset: record.resetTime,
  };
}
