import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
    CACHE_TTL,
    cacheKey,
    cacheGet,
    cachePeek,
    _resetCache,
} from '@/lib/ai/cache';

beforeEach(() => {
    vi.stubEnv('UPSTASH_REDIS_REST_URL', '');
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', '');
    _resetCache();
});

// ============================================================
// CACHE_TTL constants
// ============================================================

describe('CACHE_TTL', () => {
    it('GITHUB TTL is positive and at least 1 hour', () => {
        expect(CACHE_TTL.GITHUB).toBeGreaterThanOrEqual(3600);
    });

    it('PROXYCURL TTL is larger than GITHUB TTL', () => {
        expect(CACHE_TTL.PROXYCURL).toBeGreaterThan(CACHE_TTL.GITHUB);
    });

    it('GITHUB_VALIDATE TTL is positive', () => {
        expect(CACHE_TTL.GITHUB_VALIDATE).toBeGreaterThan(0);
    });
});

// ============================================================
// cacheKey builders
// ============================================================

describe('cacheKey', () => {
    it('ghUser lowercases the username', () => {
        expect(cacheKey.ghUser('TorValds')).toBe('gh:user:torvalds');
    });

    it('ghUser produces consistent keys', () => {
        expect(cacheKey.ghUser('alice')).toBe(cacheKey.ghUser('ALICE'));
    });

    it('ghRepos lowercases the username', () => {
        expect(cacheKey.ghRepos('Alice')).toBe('gh:repos:alice');
    });

    it('ghValidate lowercases the username', () => {
        expect(cacheKey.ghValidate('Bob')).toBe('gh:exists:bob');
    });

    it('proxycurl produces stable hash for same URL', () => {
        const k1 = cacheKey.proxycurl('https://linkedin.com/in/alice');
        const k2 = cacheKey.proxycurl('https://linkedin.com/in/alice');
        expect(k1).toBe(k2);
    });

    it('proxycurl produces different hashes for different URLs', () => {
        const k1 = cacheKey.proxycurl('https://linkedin.com/in/alice');
        const k2 = cacheKey.proxycurl('https://linkedin.com/in/bob');
        expect(k1).not.toBe(k2);
    });

    it('proxycurl key starts with proxycurl:', () => {
        expect(cacheKey.proxycurl('https://linkedin.com/in/x')).toMatch(/^proxycurl:/);
    });
});

// ============================================================
// cacheGet — in-memory backend
// ============================================================

describe('cacheGet', () => {
    it('calls the factory on cache miss', async () => {
        const factory = vi.fn().mockResolvedValue({ name: 'Alice' });
        const result = await cacheGet('test-key', factory, 60);
        expect(factory).toHaveBeenCalledTimes(1);
        expect(result).toEqual({ name: 'Alice' });
    });

    it('returns cached value on subsequent calls', async () => {
        const factory = vi.fn().mockResolvedValue(42);
        await cacheGet('num-key', factory, 60);
        const second = await cacheGet('num-key', factory, 60);
        expect(factory).toHaveBeenCalledTimes(1);
        expect(second).toBe(42);
    });

    it('propagates factory errors without caching them', async () => {
        const factory = vi.fn().mockRejectedValue(new Error('fetch failed'));
        await expect(cacheGet('err-key', factory, 60)).rejects.toThrow('fetch failed');

        // Second call should retry
        factory.mockResolvedValue('recovered');
        const result = await cacheGet('err-key', factory, 60);
        expect(result).toBe('recovered');
        expect(factory).toHaveBeenCalledTimes(2);
    });

    it('different keys are stored independently', async () => {
        await cacheGet('key-a', async () => 'A', 60);
        await cacheGet('key-b', async () => 'B', 60);

        const a = await cacheGet('key-a', async () => 'MISS', 60);
        const b = await cacheGet('key-b', async () => 'MISS', 60);
        expect(a).toBe('A');
        expect(b).toBe('B');
    });

    it('respects TTL expiry', async () => {
        vi.useFakeTimers();
        try {
            await cacheGet('ttl-key', async () => 'fresh', 1); // 1 second TTL
            vi.advanceTimersByTime(1001);
            const factory = vi.fn().mockResolvedValue('refetched');
            const result = await cacheGet('ttl-key', factory, 1);
            expect(factory).toHaveBeenCalledTimes(1);
            expect(result).toBe('refetched');
        } finally {
            vi.useRealTimers();
        }
    });
});

// ============================================================
// cachePeek — in-memory backend
// ============================================================

describe('cachePeek', () => {
    it('returns null on cache miss', async () => {
        const result = await cachePeek('nonexistent');
        expect(result).toBeNull();
    });

    it('returns the stored value without calling any factory', async () => {
        await cacheGet('peek-key', async () => ({ x: 1 }), 60);
        const peeked = await cachePeek<{ x: number }>('peek-key');
        expect(peeked).toEqual({ x: 1 });
    });

    it('returns null after TTL expiry', async () => {
        vi.useFakeTimers();
        try {
            await cacheGet('peek-ttl', async () => 'data', 1);
            vi.advanceTimersByTime(1001);
            expect(await cachePeek('peek-ttl')).toBeNull();
        } finally {
            vi.useRealTimers();
        }
    });
});
