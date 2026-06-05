import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';
import {
    checkRateLimit,
    rateLimitMiddleware,
    errorResponse,
    successResponse,
} from '@/lib/auth/utils';

// ============================================================
// checkRateLimit
// ============================================================

describe('checkRateLimit', () => {
    it('allows the first request and returns correct remaining', () => {
        const result = checkRateLimit('ip-a', 5, 60_000);
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(4);
    });

    it('counts down remaining on each call', () => {
        const id = 'ip-countdown';
        for (let i = 5; i > 1; i--) {
            const r = checkRateLimit(id, 5, 60_000);
            expect(r.allowed).toBe(true);
            expect(r.remaining).toBe(i - 1);
        }
    });

    it('blocks once the limit is reached', () => {
        const id = 'ip-block';
        for (let i = 0; i < 3; i++) {
            checkRateLimit(id, 3, 60_000);
        }
        const blocked = checkRateLimit(id, 3, 60_000);
        expect(blocked.allowed).toBe(false);
        expect(blocked.remaining).toBe(0);
    });

    it('different identifiers are tracked independently', () => {
        checkRateLimit('iso-1', 2, 60_000);
        checkRateLimit('iso-1', 2, 60_000);
        const blocked = checkRateLimit('iso-1', 2, 60_000);
        expect(blocked.allowed).toBe(false);

        const fresh = checkRateLimit('iso-2', 2, 60_000);
        expect(fresh.allowed).toBe(true);
    });

    it('resets after window expiry', () => {
        vi.useFakeTimers();
        try {
            const id = 'ip-reset';
            checkRateLimit(id, 1, 100);
            vi.advanceTimersByTime(101);
            const after = checkRateLimit(id, 1, 100);
            expect(after.allowed).toBe(true);
        } finally {
            vi.useRealTimers();
        }
    });
});

// ============================================================
// rateLimitMiddleware
// ============================================================

describe('rateLimitMiddleware', () => {
    function makeRequest(ip: string): NextRequest {
        return new NextRequest('http://localhost/api/test', {
            headers: { 'x-forwarded-for': ip },
        });
    }

    it('returns null (allow) when within limit', () => {
        const req = makeRequest('10.0.0.1');
        const result = rateLimitMiddleware(req, 10, 60_000);
        expect(result).toBeNull();
    });

    it('returns a 429 NextResponse when rate limited', () => {
        const req = makeRequest('10.99.0.1');
        // Exhaust the limit (limit=1)
        rateLimitMiddleware(req, 1, 60_000);
        const result = rateLimitMiddleware(req, 1, 60_000);
        expect(result).not.toBeNull();
        expect(result!.status).toBe(429);
    });

    it('429 response includes Retry-After header', () => {
        const req = makeRequest('10.99.0.2');
        rateLimitMiddleware(req, 1, 60_000);
        const result = rateLimitMiddleware(req, 1, 60_000);
        expect(result!.headers.has('Retry-After')).toBe(true);
    });
});

// ============================================================
// errorResponse
// ============================================================

describe('errorResponse', () => {
    it('returns a 400 response by default', () => {
        const res = errorResponse('Bad input', 'VALIDATION_ERROR');
        expect(res.status).toBe(400);
    });

    it('uses the provided status code', () => {
        const res = errorResponse('Not found', 'NOT_FOUND', 404);
        expect(res.status).toBe(404);
    });

    it('includes error and code in the JSON body', async () => {
        const res = errorResponse('Something went wrong', 'INTERNAL', 500);
        const body = await res.json();
        expect(body.error).toBe('Something went wrong');
        expect(body.code).toBe('INTERNAL');
    });

    it('includes details when provided', async () => {
        const details = { field: 'email', issue: 'invalid format' };
        const res = errorResponse('Validation failed', 'INVALID', 422, details);
        const body = await res.json();
        expect(body.details).toEqual(details);
    });

    it('omits details key when not provided', async () => {
        const res = errorResponse('Bad input', 'BAD');
        const body = await res.json();
        expect(Object.keys(body)).not.toContain('details');
    });
});

// ============================================================
// successResponse
// ============================================================

describe('successResponse', () => {
    it('returns a 200 response by default', () => {
        const res = successResponse({ id: 1 });
        expect(res.status).toBe(200);
    });

    it('uses the provided status code', () => {
        const res = successResponse({ id: 2 }, 201);
        expect(res.status).toBe(201);
    });

    it('returns the data as JSON', async () => {
        const data = { users: ['alice', 'bob'] };
        const res = successResponse(data);
        const body = await res.json();
        expect(body).toEqual(data);
    });
});
