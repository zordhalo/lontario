import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// env.ts runs loadEnv() at import time. These tests use vi.resetModules() +
// dynamic imports so each test sees a fresh module load with controlled env.

describe('env module flags', () => {
    beforeEach(() => vi.resetModules());
    afterEach(() => vi.unstubAllEnvs());

    it('isTest is true in test environment', async () => {
        vi.stubEnv('NODE_ENV', 'test');
        const { isTest, isProd, isDev } = await import('@/lib/env');
        expect(isTest).toBe(true);
        expect(isProd).toBe(false);
        expect(isDev).toBe(false);
    });

    it('isDev is true in development environment', async () => {
        vi.stubEnv('NODE_ENV', 'development');
        const { isDev } = await import('@/lib/env');
        expect(isDev).toBe(true);
    });
});

describe('requireEnv', () => {
    beforeEach(() => vi.resetModules());
    afterEach(() => vi.unstubAllEnvs());

    it('returns the value when the env var is set', async () => {
        // PROXYCURL_API_KEY has no min(1) constraint — safe to set to any string
        vi.stubEnv('PROXYCURL_API_KEY', 'pk-test-key');
        const { requireEnv } = await import('@/lib/env');
        expect(requireEnv('PROXYCURL_API_KEY')).toBe('pk-test-key');
    });

    it('throws when the env var is absent', async () => {
        // Delete the key so zod sees undefined (not empty string, which would
        // fail a min(1) constraint on other fields)
        const saved = process.env.PROXYCURL_API_KEY;
        delete process.env.PROXYCURL_API_KEY;

        try {
            const { requireEnv } = await import('@/lib/env');
            expect(() => requireEnv('PROXYCURL_API_KEY')).toThrow();
        } finally {
            if (saved !== undefined) process.env.PROXYCURL_API_KEY = saved;
        }
    });
});

describe('warnDisabledInProd', () => {
    beforeEach(() => vi.resetModules());
    afterEach(() => vi.unstubAllEnvs());

    it('does nothing in non-production environments', async () => {
        vi.stubEnv('NODE_ENV', 'test');
        const { warnDisabledInProd } = await import('@/lib/env');
        expect(() => warnDisabledInProd('my-feature', ['SOME_KEY'])).not.toThrow();
    });
});
