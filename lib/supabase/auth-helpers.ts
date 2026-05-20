/**
 * @fileoverview Server-side auth helpers for API route handlers
 *
 * Provides:
 * - `requireRecruiter()`: validate the request has an authenticated recruiter
 *   session and return the user + a user-scoped Supabase client (RLS-honoring).
 * - `withRecruiter(handler)`: wrap a route handler to catch Unauthorized /
 *   Forbidden errors and return canonical 401/403 JSON responses.
 *
 * Defense in depth: the proxy already rejects unauthenticated requests to
 * non-public /api/* paths, but every handler should still call
 * `requireRecruiter()` so it has `user.id` available for inserts and so we
 * can never accidentally ship a handler that operates without a session.
 *
 * @module lib/supabase/auth-helpers
 */

import { NextResponse } from "next/server";
import type { User, SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "./server";

// ============================================================
// Errors
// ============================================================

export class UnauthorizedError extends Error {
  readonly code = "AUTH_REQUIRED";
  constructor(message = "Authentication is required for this endpoint.") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  readonly code = "FORBIDDEN";
  constructor(message = "Recruiter role is required for this endpoint.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

// ============================================================
// Require recruiter
// ============================================================

export interface RecruiterContext {
  user: User;
  supabase: SupabaseClient;
}

/**
 * Validate the request has a recruiter session.
 *
 * Returns the authenticated user and a user-scoped Supabase client. The
 * client honors RLS policies; writes will be attributed to `auth.uid()`.
 *
 * Throws `UnauthorizedError` if no session, `ForbiddenError` if the user is
 * not a recruiter (per `profiles.role`).
 */
export async function requireRecruiter(): Promise<RecruiterContext> {
  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new UnauthorizedError();
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    throw new ForbiddenError("Profile not found for authenticated user.");
  }

  if (profile.role !== "recruiter" && profile.role !== "admin") {
    throw new ForbiddenError();
  }

  return { user, supabase: supabase as unknown as SupabaseClient };
}

// ============================================================
// withRecruiter wrapper (optional convenience)
// ============================================================

type RouteHandler<C> = (req: Request, ctx: C) => Promise<Response> | Response;

/**
 * Wrap a route handler so that thrown UnauthorizedError / ForbiddenError
 * become canonical 401 / 403 JSON responses. Useful when handlers call
 * `requireRecruiter()` at the top.
 */
export function withRecruiter<C>(handler: RouteHandler<C>): RouteHandler<C> {
  return async (req, ctx) => {
    try {
      return await handler(req, ctx);
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        return NextResponse.json(
          { error: "Unauthorized", code: err.code, message: err.message },
          { status: 401 }
        );
      }
      if (err instanceof ForbiddenError) {
        return NextResponse.json(
          { error: "Forbidden", code: err.code, message: err.message },
          { status: 403 }
        );
      }
      throw err;
    }
  };
}

/**
 * Convert a thrown auth error into a canonical JSON response. Useful inside
 * a `try/catch` block when a handler does not use `withRecruiter`.
 */
export function authErrorResponse(err: unknown): NextResponse | null {
  if (err instanceof UnauthorizedError) {
    return NextResponse.json(
      { error: "Unauthorized", code: err.code, message: err.message },
      { status: 401 }
    );
  }
  if (err instanceof ForbiddenError) {
    return NextResponse.json(
      { error: "Forbidden", code: err.code, message: err.message },
      { status: 403 }
    );
  }
  return null;
}
