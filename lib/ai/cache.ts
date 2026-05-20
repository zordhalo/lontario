/**
 * @fileoverview Shared cache for AI-pipeline external lookups
 *
 * Wave 1 cost-DoS fix: GitHub and Proxycurl lookups previously executed on
 * every applicant with no memoization. A spammer applying with the same
 * `github.com/torvalds` URL 100 times burned 700 GitHub calls and (if a
 * Proxycurl key is set) $10+ in third-party spend. This module gives the
 * scoring orchestrator a read-through cache backed by:
 *
 *   - Upstash Redis when `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN`
 *     are present (production / preview).
 *   - An in-process Map with TTL eviction otherwise (local dev / tests /
 *     environments where Redis is not provisioned).
 *
 * Keep keys short and namespaced. TTLs are chosen so a single applicant
 * cannot push the platform into a hot loop, but a real recruiter re-scoring
 * a candidate still sees fresh-enough data.
 *
 * @module lib/ai/cache
 */

import { Redis } from "@upstash/redis";
import { env } from "@/lib/env";

// ============================================================
// Backend selection
// ============================================================

interface CacheBackend {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSec: number): Promise<void>;
}

let _backend: CacheBackend | null = null;

function inMemoryBackend(): CacheBackend {
  // Global Map so concurrent imports (Next.js route handler bundles) share
  // the same store within a single function invocation.
  const store = new Map<string, { value: string; expiresAt: number }>();

  function maybeCleanup() {
    if (Math.random() < 0.01) {
      const now = Date.now();
      for (const [k, v] of store.entries()) {
        if (v.expiresAt <= now) store.delete(k);
      }
    }
  }

  return {
    async get(key) {
      maybeCleanup();
      const hit = store.get(key);
      if (!hit) return null;
      if (hit.expiresAt <= Date.now()) {
        store.delete(key);
        return null;
      }
      return hit.value;
    },
    async set(key, value, ttlSec) {
      store.set(key, { value, expiresAt: Date.now() + ttlSec * 1000 });
    },
  };
}

function upstashBackend(redis: Redis): CacheBackend {
  return {
    async get(key) {
      // Upstash returns the deserialized value when the stored value is JSON.
      // We always serialize to string ourselves so the return type is
      // predictable.
      const raw = await redis.get<string>(key);
      return raw ?? null;
    },
    async set(key, value, ttlSec) {
      await redis.set(key, value, { ex: ttlSec });
    },
  };
}

function getBackend(): CacheBackend {
  if (_backend) return _backend;

  const url = env.UPSTASH_REDIS_REST_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) {
    _backend = upstashBackend(new Redis({ url, token }));
  } else {
    _backend = inMemoryBackend();
  }
  return _backend;
}

/** Test-only reset. */
export function _resetCache() {
  _backend = null;
}

// ============================================================
// Public API
// ============================================================

/** Recommended TTLs (seconds). Exposed so callers don't hardcode numbers. */
export const CACHE_TTL = {
  /** GitHub user + repos: profiles change occasionally; 6h is a safe compromise. */
  GITHUB: 6 * 60 * 60,
  /** Proxycurl: charged per lookup → cache aggressively. */
  PROXYCURL: 7 * 24 * 60 * 60,
  /** GitHub user-exists check (validate-only). Cheap; refresh daily. */
  GITHUB_VALIDATE: 24 * 60 * 60,
} as const;

/** Canonical key builders so callers can't drift. */
export const cacheKey = {
  ghUser: (username: string) => `gh:user:${username.toLowerCase()}`,
  ghRepos: (username: string) => `gh:repos:${username.toLowerCase()}`,
  ghValidate: (username: string) => `gh:exists:${username.toLowerCase()}`,
  proxycurl: (linkedinUrl: string) => `proxycurl:${hashUrl(linkedinUrl)}`,
};

/**
 * Read-through cache. Calls `fn()` only on cache miss, then stores the
 * JSON-serialized result for `ttlSec` seconds. Errors thrown by `fn` are not
 * cached — callers see the raw failure and can decide whether to retry.
 */
export async function cacheGet<T>(
  key: string,
  fn: () => Promise<T>,
  ttlSec: number
): Promise<T> {
  const backend = getBackend();
  const cached = await backend.get(key).catch(() => null);
  if (cached !== null) {
    try {
      return JSON.parse(cached) as T;
    } catch {
      // Corrupt entry — fall through to regenerate.
    }
  }
  const value = await fn();
  // Best-effort write; never let cache failure break the request.
  await backend
    .set(key, JSON.stringify(value), ttlSec)
    .catch(() => undefined);
  return value;
}

/**
 * Read cache without populating. Used by short-circuit paths (e.g. budget
 * exceeded) that want to serve a stale answer rather than re-spend.
 */
export async function cachePeek<T>(key: string): Promise<T | null> {
  const backend = getBackend();
  const raw = await backend.get(key).catch(() => null);
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/** Stable djb2 hash so a LinkedIn URL doesn't make absurdly long cache keys. */
function hashUrl(url: string): string {
  let h = 5381;
  const s = url.trim().toLowerCase();
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  }
  // Unsigned hex for nicer keys.
  return (h >>> 0).toString(16);
}
