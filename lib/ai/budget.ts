/**
 * @fileoverview Daily AI spend ceiling
 *
 * Wave 1 cost-DoS fix [BLOCKER]: nothing in the codebase tracked aggregate
 * OpenAI / Proxycurl spend. A successful abuse run was bounded only by the
 * card's credit limit. This module gives the orchestrator a single chokepoint
 * to ask "are we still under today's budget?" before paying for an external
 * call, and a hook to record the actual spend afterward.
 *
 * Storage:
 *   - Upstash Redis when configured (atomic `incrbyfloat` + 25h TTL).
 *   - In-process counter otherwise (dev only — does not survive function
 *     instances, which is fine because the dev box has no card attached).
 *
 * TODO(env): the daily ceiling should be a real env var. `lib/env.ts` is
 * owned by another agent this wave; for now the hardcoded default is 25 USD,
 * which a recruiter can raise by editing {@link DAILY_BUDGET_USD_DEFAULT}.
 * Once `AI_BUDGET_DAILY_USD` exists in the zod schema, read it here:
 *
 *   const ceiling = Number(process.env.AI_BUDGET_DAILY_USD ?? DAILY_BUDGET_USD_DEFAULT);
 *
 * `process.env` is read directly (and only as a fallback) so this module
 * stays import-time-safe even before the env var is added.
 *
 * @module lib/ai/budget
 */

import { Redis } from "@upstash/redis";
import { env } from "@/lib/env";

// ============================================================
// Configuration
// ============================================================

/**
 * Hardcoded daily ceiling until `AI_BUDGET_DAILY_USD` lands in lib/env.ts.
 * Chosen to absorb ~50–200 legitimate applications/day at typical pricing
 * while keeping a single-IP attacker bounded.
 *
 * A recruiter can raise this by either:
 *  1. Editing this constant and redeploying, OR
 *  2. Setting `AI_BUDGET_DAILY_USD` in Vercel env (picked up via the
 *     process.env fallback below once the schema is updated).
 */
export const DAILY_BUDGET_USD_DEFAULT = 25;

function getDailyCeilingUsd(): number {
  const raw = process.env.AI_BUDGET_DAILY_USD;
  if (raw) {
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return DAILY_BUDGET_USD_DEFAULT;
}

// ============================================================
// Error type
// ============================================================

/**
 * Thrown by AI callers when {@link checkBudgetOk} reports the daily ceiling
 * is hit. The scoring orchestrator catches this and degrades gracefully
 * (candidate is inserted but unscored) — it must never bubble to the user
 * as a 500.
 */
export class BudgetExceededError extends Error {
  readonly code = "AI_DAILY_BUDGET_EXCEEDED";
  constructor(reason: string) {
    super(`AI daily budget exceeded: ${reason}`);
    this.name = "BudgetExceededError";
  }
}

// ============================================================
// Storage
// ============================================================

interface SpendStore {
  read(day: string): Promise<number>;
  add(day: string, usd: number, ttlSec: number): Promise<number>;
}

let _store: SpendStore | null = null;

function memoryStore(): SpendStore {
  const data = new Map<string, number>();
  return {
    async read(day) {
      return data.get(day) ?? 0;
    },
    async add(day, usd) {
      const next = (data.get(day) ?? 0) + usd;
      data.set(day, next);
      return next;
    },
  };
}

function upstashStore(redis: Redis): SpendStore {
  return {
    async read(day) {
      const raw = await redis.get<string | number>(`ai:spend:${day}`);
      if (raw == null) return 0;
      const n = typeof raw === "number" ? raw : Number(raw);
      return Number.isFinite(n) ? n : 0;
    },
    async add(day, usd, ttlSec) {
      const key = `ai:spend:${day}`;
      // incrbyfloat returns the new value as a string. Set the TTL on first
      // increment of the day — overshoot is harmless.
      const next = await redis.incrbyfloat(key, usd);
      // Always re-set TTL; cheap and avoids the orphan-key case.
      await redis.expire(key, ttlSec).catch(() => undefined);
      return typeof next === "number" ? next : Number(next);
    },
  };
}

function getStore(): SpendStore {
  if (_store) return _store;
  const url = env.UPSTASH_REDIS_REST_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) {
    _store = upstashStore(new Redis({ url, token }));
  } else {
    _store = memoryStore();
  }
  return _store;
}

/** Test-only reset. */
export function _resetBudget() {
  _store = null;
}

// ============================================================
// Public API
// ============================================================

function todayKey(): string {
  // UTC day; matches the 25h TTL choice in `add()`.
  return new Date().toISOString().slice(0, 10);
}

export interface BudgetCheck {
  ok: boolean;
  /** Reason code when `ok === false`. */
  reason?: "daily_budget_exceeded";
  /** USD spent today so far, for logging. */
  spentUsd: number;
  /** USD ceiling in effect. */
  ceilingUsd: number;
}

/**
 * Returns `{ ok: false }` when adding `estimatedCostUsd` to today's tally
 * would exceed the daily ceiling. Callers should check this BEFORE making
 * an external paid call.
 *
 * Estimation should be conservative (use the worst-case max_tokens output
 * cost) so we err on the side of refusing rather than over-spending.
 */
export async function checkBudgetOk(
  estimatedCostUsd: number
): Promise<BudgetCheck> {
  const ceiling = getDailyCeilingUsd();
  const spent = await getStore()
    .read(todayKey())
    .catch(() => 0);
  if (spent + estimatedCostUsd > ceiling) {
    return {
      ok: false,
      reason: "daily_budget_exceeded",
      spentUsd: spent,
      ceilingUsd: ceiling,
    };
  }
  return { ok: true, spentUsd: spent, ceilingUsd: ceiling };
}

/**
 * Increments today's spend counter by `usd`. Best-effort: a Redis failure is
 * logged but does not throw — losing one accounting tick is preferable to
 * failing a paid call that already succeeded upstream.
 *
 * TTL is 25 hours so the key naturally rolls over at the next UTC midnight
 * without a separate cleanup job.
 */
export async function recordSpend(usd: number): Promise<void> {
  if (!Number.isFinite(usd) || usd <= 0) return;
  try {
    await getStore().add(todayKey(), usd, 25 * 60 * 60);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[lib/ai/budget] recordSpend failed:", err);
  }
}

// ============================================================
// Cost estimation
// ============================================================

/**
 * Per-1k-token pricing in USD. Values current as of late-2025 OpenAI pricing;
 * update here when pricing moves. Used both for the pre-flight check and the
 * post-call accounting.
 */
const PRICING: Record<string, { inPer1k: number; outPer1k: number }> = {
  "gpt-4o": { inPer1k: 0.0025, outPer1k: 0.01 },
  "gpt-4o-2024-08-06": { inPer1k: 0.0025, outPer1k: 0.01 },
  "gpt-4o-mini": { inPer1k: 0.00015, outPer1k: 0.0006 },
};

const DEFAULT_PRICE = { inPer1k: 0.0025, outPer1k: 0.01 };

export function estimateCost(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const p = PRICING[model] ?? DEFAULT_PRICE;
  return (inputTokens / 1000) * p.inPer1k + (outputTokens / 1000) * p.outPer1k;
}
