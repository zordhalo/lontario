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

// ============================================================
// Types & Configuration
// ============================================================

export type RateLimitTier = "general" | "auth" | "ai" | "upload";

interface TierConfig {
  limit: number;
  windowMs: number;
}

export const RATE_LIMIT_CONFIG: Record<RateLimitTier, TierConfig> = {
  general: { limit: 100, windowMs: 60_000 },
  auth: { limit: 5, windowMs: 60_000 },
  ai: { limit: 10, windowMs: 60_000 },
  upload: { limit: 5, windowMs: 60_000 },
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
  // Create one Ratelimit instance per tier with sliding window
  const limiters: Record<RateLimitTier, Ratelimit> = {
    general: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(
        RATE_LIMIT_CONFIG.general.limit,
        `${RATE_LIMIT_CONFIG.general.windowMs}ms`
      ),
      prefix: "rl:general",
    }),
    auth: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(
        RATE_LIMIT_CONFIG.auth.limit,
        `${RATE_LIMIT_CONFIG.auth.windowMs}ms`
      ),
      prefix: "rl:auth",
    }),
    ai: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(
        RATE_LIMIT_CONFIG.ai.limit,
        `${RATE_LIMIT_CONFIG.ai.windowMs}ms`
      ),
      prefix: "rl:ai",
    }),
    upload: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(
        RATE_LIMIT_CONFIG.upload.limit,
        `${RATE_LIMIT_CONFIG.upload.windowMs}ms`
      ),
      prefix: "rl:upload",
    }),
  };

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
export function getRateLimiter(): RateLimiter {
  if (_limiter) return _limiter;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (url && token) {
    const redis = new Redis({ url, token });
    _limiter = createUpstashLimiter(redis);
  } else {
    if (process.env.NODE_ENV === "production") {
      console.warn(
        "[rate-limit] UPSTASH_REDIS_REST_URL/TOKEN not set. " +
          "Using in-memory fallback — this is NOT suitable for production."
      );
    }
    _limiter = createInMemoryLimiter();
  }

  return _limiter;
}

/** Exported for testing — resets the cached limiter instance. */
export function _resetLimiter() {
  _limiter = null;
}
