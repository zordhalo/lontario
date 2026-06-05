/**
 * @fileoverview Unit tests for lib/rate-limit
 *
 * Tests tier mapping, in-memory rate limiting, and reset behavior.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getTierForPath,
  getRateLimiter,
  RATE_LIMIT_CONFIG,
  _resetLimiter,
  checkEmailRateLimit,
} from "@/lib/rate-limit";

// Ensure no Upstash env vars so we get the in-memory limiter
beforeEach(() => {
  vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
  vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
  _resetLimiter();
});

// ============================================================
// getTierForPath
// ============================================================

describe("getTierForPath", () => {
  it("returns null for cron routes", () => {
    expect(getTierForPath("/api/cron/interview-reminders")).toBeNull();
    expect(getTierForPath("/api/cron/interview-status")).toBeNull();
  });

  it('returns "auth" for auth routes', () => {
    expect(getTierForPath("/api/auth/login")).toBe("auth");
    expect(getTierForPath("/api/auth/callback")).toBe("auth");
  });

  it('returns "ai" for AI routes', () => {
    expect(getTierForPath("/api/ai/generate-questions")).toBe("ai");
    expect(getTierForPath("/api/ai/evaluate-answer")).toBe("ai");
    expect(getTierForPath("/api/ai/score-candidate")).toBe("ai");
  });

  it('returns "ai" for interview submit route', () => {
    expect(getTierForPath("/api/interviews/abc-123/submit")).toBe("ai");
  });

  it('returns "general" for other API routes', () => {
    expect(getTierForPath("/api/jobs")).toBe("general");
    expect(getTierForPath("/api/candidates")).toBe("general");
    expect(getTierForPath("/api/dashboard/stats")).toBe("general");
  });

  it('returns "general" for non-matching interview sub-routes', () => {
    expect(getTierForPath("/api/interviews/abc-123/start")).toBe("general");
    expect(getTierForPath("/api/interviews/abc-123/review")).toBe("general");
  });
});

// ============================================================
// In-memory rate limiter
// ============================================================

describe("in-memory rate limiter", () => {
  it("allows requests within the limit", async () => {
    const limiter = getRateLimiter();
    const result = await limiter.check("test-ip", "general");

    expect(result.allowed).toBe(true);
    expect(result.limit).toBe(RATE_LIMIT_CONFIG.general.limit);
    expect(result.remaining).toBe(RATE_LIMIT_CONFIG.general.limit - 1);
    expect(result.reset).toBeGreaterThan(Date.now());
  });

  it("blocks requests once the limit is exceeded", async () => {
    const limiter = getRateLimiter();
    const tier = "auth"; // limit = 5

    // Exhaust the limit
    for (let i = 0; i < RATE_LIMIT_CONFIG.auth.limit; i++) {
      const r = await limiter.check("block-test", tier);
      expect(r.allowed).toBe(true);
    }

    // Next request should be blocked
    const blocked = await limiter.check("block-test", tier);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it("tracks different identifiers independently", async () => {
    const limiter = getRateLimiter();

    const r1 = await limiter.check("ip-1", "general");
    const r2 = await limiter.check("ip-2", "general");

    expect(r1.allowed).toBe(true);
    expect(r2.allowed).toBe(true);
    // Both should have full remaining (minus 1)
    expect(r1.remaining).toBe(RATE_LIMIT_CONFIG.general.limit - 1);
    expect(r2.remaining).toBe(RATE_LIMIT_CONFIG.general.limit - 1);
  });

  it("tracks different tiers independently for the same identifier", async () => {
    const limiter = getRateLimiter();

    // Exhaust auth tier
    for (let i = 0; i < RATE_LIMIT_CONFIG.auth.limit; i++) {
      await limiter.check("same-ip", "auth");
    }

    const authBlocked = await limiter.check("same-ip", "auth");
    expect(authBlocked.allowed).toBe(false);

    // General tier should still be available
    const generalOk = await limiter.check("same-ip", "general");
    expect(generalOk.allowed).toBe(true);
  });

  it("resets after the window expires", async () => {
    vi.useFakeTimers();

    try {
      const limiter = getRateLimiter();
      const tier = "auth";

      // Exhaust the limit
      for (let i = 0; i < RATE_LIMIT_CONFIG.auth.limit; i++) {
        await limiter.check("reset-test", tier);
      }
      const blocked = await limiter.check("reset-test", tier);
      expect(blocked.allowed).toBe(false);

      // Advance time past the window
      vi.advanceTimersByTime(RATE_LIMIT_CONFIG.auth.windowMs + 1);

      const afterReset = await limiter.check("reset-test", tier);
      expect(afterReset.allowed).toBe(true);
      expect(afterReset.remaining).toBe(RATE_LIMIT_CONFIG.auth.limit - 1);
    } finally {
      vi.useRealTimers();
    }
  });
});

// ============================================================
// checkEmailRateLimit — in-memory fallback (dev mode)
// ============================================================

describe("checkEmailRateLimit", () => {
  beforeEach(() => {
    // Stay in dev mode so we get the in-memory fallback
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    vi.stubEnv("NODE_ENV", "test");
    _resetLimiter();
  });

  it("allows an email within the apply limit", async () => {
    const result = await checkEmailRateLimit("user@example.com", "apply");
    expect(result.allowed).toBe(true);
    expect(result.limit).toBeGreaterThan(0);
  });

  it("allows an email within the waitlist limit", async () => {
    const result = await checkEmailRateLimit("user@example.com", "waitlist");
    expect(result.allowed).toBe(true);
  });

  it("blocks after the apply per-email limit is reached", async () => {
    const email = "spammer@example.com";
    // Exhaust the apply limit (2 per hour by default)
    await checkEmailRateLimit(email, "apply");
    await checkEmailRateLimit(email, "apply");
    const blocked = await checkEmailRateLimit(email, "apply");
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it("blocks after the waitlist per-email limit is reached", async () => {
    const email = "waitlister@example.com";
    // Exhaust the waitlist limit (1 per hour by default)
    await checkEmailRateLimit(email, "waitlist");
    const blocked = await checkEmailRateLimit(email, "waitlist");
    expect(blocked.allowed).toBe(false);
  });

  it("different emails are tracked independently", async () => {
    await checkEmailRateLimit("a@example.com", "waitlist");
    const blocked = await checkEmailRateLimit("a@example.com", "waitlist");
    expect(blocked.allowed).toBe(false);

    const fresh = await checkEmailRateLimit("b@example.com", "waitlist");
    expect(fresh.allowed).toBe(true);
  });

  it("returns reset timestamp in the future", async () => {
    const result = await checkEmailRateLimit("ts@example.com", "apply");
    expect(result.reset).toBeGreaterThan(Date.now());
  });
});
