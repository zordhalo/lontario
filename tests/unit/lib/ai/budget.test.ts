import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
    DAILY_BUDGET_USD_DEFAULT,
    BudgetExceededError,
    estimateCost,
    checkBudgetOk,
    recordSpend,
    _resetBudget,
} from '@/lib/ai/budget';

beforeEach(() => {
    vi.stubEnv('UPSTASH_REDIS_REST_URL', '');
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', '');
    vi.stubEnv('AI_BUDGET_DAILY_USD', '');
    _resetBudget();
});

// ============================================================
// DAILY_BUDGET_USD_DEFAULT
// ============================================================

describe('DAILY_BUDGET_USD_DEFAULT', () => {
    it('is a positive number', () => {
        expect(DAILY_BUDGET_USD_DEFAULT).toBeGreaterThan(0);
    });
});

// ============================================================
// BudgetExceededError
// ============================================================

describe('BudgetExceededError', () => {
    it('is an Error subclass', () => {
        const err = new BudgetExceededError('test reason');
        expect(err).toBeInstanceOf(Error);
    });

    it('includes the reason in the message', () => {
        const err = new BudgetExceededError('daily limit hit');
        expect(err.message).toContain('daily limit hit');
    });

    it('has code AI_DAILY_BUDGET_EXCEEDED', () => {
        const err = new BudgetExceededError('x');
        expect(err.code).toBe('AI_DAILY_BUDGET_EXCEEDED');
    });

    it('has name BudgetExceededError', () => {
        const err = new BudgetExceededError('x');
        expect(err.name).toBe('BudgetExceededError');
    });
});

// ============================================================
// estimateCost
// ============================================================

describe('estimateCost', () => {
    it('returns 0 for zero tokens', () => {
        expect(estimateCost('gpt-4o', 0, 0)).toBe(0);
    });

    it('calculates gpt-4o-mini cost correctly', () => {
        // 1000 in @ $0.00015/1k + 1000 out @ $0.0006/1k = $0.00075
        const cost = estimateCost('gpt-4o-mini', 1000, 1000);
        expect(cost).toBeCloseTo(0.00075, 6);
    });

    it('calculates gpt-4o cost correctly', () => {
        // 1000 in @ $0.0025/1k + 1000 out @ $0.01/1k = $0.0125
        const cost = estimateCost('gpt-4o', 1000, 1000);
        expect(cost).toBeCloseTo(0.0125, 6);
    });

    it('uses default pricing for unknown models', () => {
        // Falls back to gpt-4o pricing
        const known = estimateCost('gpt-4o', 2000, 500);
        const unknown = estimateCost('unknown-model', 2000, 500);
        expect(unknown).toBeCloseTo(known, 6);
    });

    it('scales linearly with token count', () => {
        const single = estimateCost('gpt-4o-mini', 1000, 1000);
        const double = estimateCost('gpt-4o-mini', 2000, 2000);
        expect(double).toBeCloseTo(single * 2, 6);
    });
});

// ============================================================
// checkBudgetOk (in-memory backend)
// ============================================================

describe('checkBudgetOk', () => {
    it('returns ok=true when nothing has been spent', async () => {
        const result = await checkBudgetOk(0.01);
        expect(result.ok).toBe(true);
        expect(result.spentUsd).toBe(0);
        expect(result.ceilingUsd).toBeGreaterThan(0);
    });

    it('returns ok=false when estimated cost exceeds ceiling', async () => {
        // Spend right up to the ceiling first
        const ceiling = DAILY_BUDGET_USD_DEFAULT;
        await recordSpend(ceiling - 0.001);

        const result = await checkBudgetOk(0.01);
        expect(result.ok).toBe(false);
        expect(result.reason).toBe('daily_budget_exceeded');
    });

    it('respects AI_BUDGET_DAILY_USD override', async () => {
        vi.stubEnv('AI_BUDGET_DAILY_USD', '1');
        _resetBudget();

        await recordSpend(0.99);
        const allowed = await checkBudgetOk(0.005);
        expect(allowed.ok).toBe(true);

        await recordSpend(0.02);
        const blocked = await checkBudgetOk(0.005);
        expect(blocked.ok).toBe(false);
    });

    it('ignores invalid AI_BUDGET_DAILY_USD and falls back to default', async () => {
        vi.stubEnv('AI_BUDGET_DAILY_USD', 'not-a-number');
        _resetBudget();

        const result = await checkBudgetOk(0.01);
        expect(result.ceilingUsd).toBe(DAILY_BUDGET_USD_DEFAULT);
    });
});

// ============================================================
// recordSpend (in-memory backend)
// ============================================================

describe('recordSpend', () => {
    it('accumulates spend across multiple calls', async () => {
        await recordSpend(1.0);
        await recordSpend(2.0);

        const result = await checkBudgetOk(0);
        expect(result.spentUsd).toBeCloseTo(3.0, 6);
    });

    it('ignores zero amounts', async () => {
        await recordSpend(0);
        const result = await checkBudgetOk(0);
        expect(result.spentUsd).toBe(0);
    });

    it('ignores negative amounts', async () => {
        await recordSpend(-5);
        const result = await checkBudgetOk(0);
        expect(result.spentUsd).toBe(0);
    });

    it('ignores NaN', async () => {
        await recordSpend(NaN);
        const result = await checkBudgetOk(0);
        expect(result.spentUsd).toBe(0);
    });
});
