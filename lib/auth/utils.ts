/**
 * @fileoverview API Route Authorization Utilities
 *
 * Provides middleware-like functions for protecting API routes.
 * Use these to authenticate requests and check user roles.
 *
 * @module lib/auth/utils
 *
 * @example
 * // In an API route
 * export async function GET(request: NextRequest) {
 *   const authResult = await requireAuth(request);
 *   if (authResult instanceof NextResponse) {
 *     return authResult; // 401 response
 *   }
 *   const user = authResult;
 *   // Continue with authenticated user...
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/types";
import type { UserRole } from "@/lib/supabase/auth";

// ============================================================
// Types
// ============================================================

export interface AuthenticatedUser {
    /** Supabase Auth user ID */
    id: string;
    /** User's email address */
    email: string;
    /** User's profile from the database */
    profile: Profile;
}

// Simple in-memory rate limiter (for development/small scale)
// In production, use Redis or similar
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

// ============================================================
// Auth Functions
// ============================================================

/**
 * Get the authenticated user from a request
 * Returns null if not authenticated (does not throw/return error response)
 */
export async function getAuthenticatedUser(
    _request?: NextRequest
): Promise<AuthenticatedUser | null> {
    try {
        const supabase = await createClient();

        // Get authenticated user
        const {
            data: { user },
            error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
            return null;
        }

        // Get user profile
        const { data: profile, error: profileError } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", user.id)
            .single();

        if (profileError || !profile) {
            return null;
        }

        return {
            id: user.id,
            email: user.email!,
            profile: profile as Profile,
        };
    } catch (error) {
        console.error("Error getting authenticated user:", error);
        return null;
    }
}

/**
 * Require authentication for an API route
 * Returns the authenticated user or a 401 NextResponse
 */
export async function requireAuth(
    request?: NextRequest
): Promise<AuthenticatedUser | NextResponse> {
    const user = await getAuthenticatedUser(request);

    if (!user) {
        return NextResponse.json(
            {
                error: "Unauthorized",
                code: "UNAUTHORIZED",
                message: "You must be logged in to access this resource",
            },
            { status: 401 }
        );
    }

    return user;
}

/**
 * Require specific role(s) for an API route
 * Returns the authenticated user or an error NextResponse
 */
export async function requireRole(
    request: NextRequest,
    roles: UserRole[]
): Promise<AuthenticatedUser | NextResponse> {
    const authResult = await requireAuth(request);

    // If requireAuth returned an error response, pass it through
    if (authResult instanceof NextResponse) {
        return authResult;
    }

    const user = authResult;

    // Check if user has required role
    if (!roles.includes(user.profile.role as UserRole)) {
        return NextResponse.json(
            {
                error: "Forbidden",
                code: "FORBIDDEN",
                message: "You don't have permission to access this resource",
                requiredRoles: roles,
                userRole: user.profile.role,
            },
            { status: 403 }
        );
    }

    return user;
}

/**
 * Convenience function to require admin role
 */
export async function requireAdmin(
    request: NextRequest
): Promise<AuthenticatedUser | NextResponse> {
    return requireRole(request, ["admin"]);
}

/**
 * Convenience function to require recruiter or admin role
 */
export async function requireRecruiterOrAdmin(
    request: NextRequest
): Promise<AuthenticatedUser | NextResponse> {
    return requireRole(request, ["recruiter", "hiring_manager", "admin"]);
}

// ============================================================
// Rate Limiting
// ============================================================

/**
 * Simple rate limiting for API endpoints
 * Uses in-memory storage (not suitable for multi-instance deployments)
 *
 * @param identifier - Unique identifier for the rate limit (e.g., IP, user ID)
 * @param limit - Maximum number of requests allowed
 * @param windowMs - Time window in milliseconds
 * @returns true if within limit, false if exceeded
 */
export function checkRateLimit(
    identifier: string,
    limit: number,
    windowMs: number
): { allowed: boolean; remaining: number; resetIn: number } {
    const now = Date.now();
    const record = rateLimitMap.get(identifier);

    // Clean up old entries periodically
    if (Math.random() < 0.01) {
        cleanupRateLimitMap();
    }

    if (!record || now > record.resetTime) {
        // First request or window expired
        rateLimitMap.set(identifier, {
            count: 1,
            resetTime: now + windowMs,
        });
        return {
            allowed: true,
            remaining: limit - 1,
            resetIn: windowMs,
        };
    }

    if (record.count >= limit) {
        // Rate limit exceeded
        return {
            allowed: false,
            remaining: 0,
            resetIn: record.resetTime - now,
        };
    }

    // Increment count
    record.count++;
    return {
        allowed: true,
        remaining: limit - record.count,
        resetIn: record.resetTime - now,
    };
}

/**
 * Rate limit middleware that returns a response if exceeded
 */
export function rateLimitMiddleware(
    request: NextRequest,
    limit: number = 100,
    windowMs: number = 60 * 1000 // 1 minute default
): NextResponse | null {
    // Use IP or forwarded IP as identifier
    const ip =
        request.headers.get("x-forwarded-for")?.split(",")[0] ||
        request.headers.get("x-real-ip") ||
        "unknown";

    const result = checkRateLimit(ip, limit, windowMs);

    if (!result.allowed) {
        return NextResponse.json(
            {
                error: "Too Many Requests",
                code: "RATE_LIMIT_EXCEEDED",
                message: "You have exceeded the rate limit. Please try again later.",
                retryAfter: Math.ceil(result.resetIn / 1000),
            },
            {
                status: 429,
                headers: {
                    "Retry-After": String(Math.ceil(result.resetIn / 1000)),
                    "X-RateLimit-Limit": String(limit),
                    "X-RateLimit-Remaining": String(result.remaining),
                    "X-RateLimit-Reset": String(Math.ceil(result.resetIn / 1000)),
                },
            }
        );
    }

    return null;
}

/**
 * Cleanup old rate limit entries
 */
function cleanupRateLimitMap() {
    const now = Date.now();
    for (const [key, value] of rateLimitMap.entries()) {
        if (now > value.resetTime) {
            rateLimitMap.delete(key);
        }
    }
}

// ============================================================
// Response Helpers
// ============================================================

/**
 * Create a standardized error response
 */
export function errorResponse(
    message: string,
    code: string,
    status: number = 400,
    details?: unknown
): NextResponse {
    const body: { error: string; code: string; details?: unknown } = {
        error: message,
        code,
    };

    if (details !== undefined) {
        body.details = details;
    }

    return NextResponse.json(body, { status });
}

/**
 * Create a standardized success response
 */
export function successResponse<T>(data: T, status: number = 200): NextResponse {
    return NextResponse.json(data, { status });
}
