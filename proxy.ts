/**
 * @fileoverview Next.js Proxy (formerly Middleware)
 *
 * Handles:
 * 1. API routes — CORS preflight, rate limiting, security headers, recruiter
 *    auth for non-public endpoints.
 * 2. Page routes — Supabase auth checks, security headers.
 *
 * Routing model (Wave 2 — MVP single-recruiter):
 *
 *   Public pages (no auth required):
 *     /                            marketing landing
 *     /jobs, /jobs/[id]            public job board (NOT /jobs/new)
 *     /apply, /apply/[jobId],
 *       /apply/[jobId]/success     public application flow
 *     /login, /register,
 *       /forgot-password,
 *       /reset-password,
 *       /verify-email              auth pages
 *     /auth/*                      Supabase auth callbacks
 *     /interview/[token]           candidate interview flow (token-gated)
 *     /sentry-example-page         (to be removed; allow for now)
 *
 *   Recruiter-only pages (require Supabase session):
 *     /dashboard, /dashboard/*
 *     /jobs/new, /jobs/[id]/edit
 *     /candidates, /candidates/*
 *     /interviews, /interviews/manage
 *     /settings, /profile
 *
 *   Public APIs (no recruiter session check; rate-limited):
 *     /api/public/*, /api/waitlist, /api/auth/*, /api/cron/*
 *
 *   All other /api/* requires a recruiter session via getUser().
 *
 * Rate limiting runs before auth on API routes to reject abusive traffic cheaply.
 *
 * TODO(w2-env-hardening): switch to `import { env } from "@/lib/env"` once that
 * module lands. For now we read process.env directly so this file can ship
 * independently.
 *
 * @module proxy
 */

import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getTierForPath, getRateLimiter } from "@/lib/rate-limit";
import { applySecurityHeaders } from "@/lib/security/headers";
import { getCorsHeaders, handleCorsPreflightIfNeeded } from "@/lib/security/cors";

// ============================================================
// Page route classification
// ============================================================

/**
 * Public page paths. A request matches if the pathname equals the entry or
 * starts with `${entry}/`. Dynamic segments are matched by their static prefix.
 *
 * Note: `/jobs/new` is intentionally excluded so it falls through to the
 * recruiter check below (more specific match wins via explicit ordering).
 */
const PUBLIC_PAGE_PREFIXES = [
  "/jobs", // /jobs and /jobs/[id]
  "/apply", // /apply, /apply/[jobId], /apply/[jobId]/success
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/auth", // /auth/callback, /auth/confirm, etc.
  "/interview", // candidate token flow — NOT /interviews
  "/sentry-example-page",
] as const;

/**
 * Recruiter-only page paths. Checked BEFORE the public allow-list so that
 * `/jobs/new` and `/jobs/[id]/edit` override the `/jobs` public prefix.
 */
const RECRUITER_PAGE_PREFIXES = [
  "/dashboard",
  "/candidates",
  "/interviews", // distinct from singular /interview/[token]
  "/settings",
  "/profile",
] as const;

/** Exact paths only the recruiter can hit (no descendants, except /edit). */
const RECRUITER_PAGE_EXACT_OR_NESTED: Array<(p: string) => boolean> = [
  (p) => p === "/jobs/new",
  // /jobs/[id]/edit or any nested /edit segment under /jobs
  (p) => /^\/jobs\/[^/]+\/edit(\/.*)?$/.test(p),
];

/** Auth pages — when authed, redirect away from these. */
const AUTH_REDIRECT_PAGES = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
];

function startsWithPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function isRecruiterPage(pathname: string): boolean {
  if (RECRUITER_PAGE_EXACT_OR_NESTED.some((fn) => fn(pathname))) return true;
  return RECRUITER_PAGE_PREFIXES.some((p) => startsWithPrefix(pathname, p));
}

function isPublicPage(pathname: string): boolean {
  if (pathname === "/") return true;
  return PUBLIC_PAGE_PREFIXES.some((p) => startsWithPrefix(pathname, p));
}

function isAuthPage(pathname: string): boolean {
  return AUTH_REDIRECT_PAGES.some((p) => startsWithPrefix(pathname, p));
}

// ============================================================
// API route classification
// ============================================================

const PUBLIC_API_PREFIXES = [
  "/api/public",
  "/api/waitlist",
  "/api/auth",
  "/api/cron", // has its own secret check inside the handler
] as const;

function isPublicApi(pathname: string): boolean {
  return PUBLIC_API_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
}

// ============================================================
// IP Extraction
// ============================================================

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

// ============================================================
// Supabase client builder (shared across API + page branches)
// ============================================================

function buildSupabase(request: NextRequest, response: NextResponse) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(
          cookiesToSet: {
            name: string;
            value: string;
            options?: Record<string, unknown>;
          }[]
        ) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );
}

// ============================================================
// Proxy
// ============================================================

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip static assets, image optimization, and the Sentry tunnel
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/monitoring") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // ----------------------------------------------------------
  // API Routes
  // ----------------------------------------------------------
  if (pathname.startsWith("/api")) {
    // 1. CORS preflight — immediate 204
    const preflightResponse = handleCorsPreflightIfNeeded(request);
    if (preflightResponse) {
      return applySecurityHeaders(preflightResponse);
    }

    // 2. Rate limiting (runs before auth so abusive traffic is cheap to reject)
    const tier = getTierForPath(pathname);
    let rateLimitHeaders: Record<string, string> | null = null;

    if (tier) {
      const limiter = getRateLimiter();
      const ip = getClientIp(request);
      const result = await limiter.check(ip, tier);

      if (!result.allowed) {
        const retryAfter = Math.ceil((result.reset - Date.now()) / 1000);
        const response = NextResponse.json(
          {
            error: "Too Many Requests",
            code: "RATE_LIMIT_EXCEEDED",
            message:
              "You have exceeded the rate limit. Please try again later.",
            retryAfter,
          },
          {
            status: 429,
            headers: {
              "Retry-After": String(retryAfter),
              "X-RateLimit-Limit": String(result.limit),
              "X-RateLimit-Remaining": "0",
              "X-RateLimit-Reset": String(result.reset),
            },
          }
        );

        const origin = request.headers.get("origin");
        for (const [k, v] of Object.entries(getCorsHeaders(origin))) {
          response.headers.set(k, v);
        }

        return applySecurityHeaders(response);
      }

      rateLimitHeaders = {
        "X-RateLimit-Limit": String(result.limit),
        "X-RateLimit-Remaining": String(result.remaining),
        "X-RateLimit-Reset": String(result.reset),
      };
    }

    // 3. Recruiter auth for protected API routes
    const baseResponse = NextResponse.next({
      request: { headers: request.headers },
    });

    if (!isPublicApi(pathname)) {
      const supabase = buildSupabase(request, baseResponse);
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (error || !user) {
        const response = NextResponse.json(
          {
            error: "Unauthorized",
            code: "AUTH_REQUIRED",
            message: "Authentication is required for this endpoint.",
          },
          { status: 401 }
        );

        const origin = request.headers.get("origin");
        for (const [k, v] of Object.entries(getCorsHeaders(origin))) {
          response.headers.set(k, v);
        }
        if (rateLimitHeaders) {
          for (const [k, v] of Object.entries(rateLimitHeaders)) {
            response.headers.set(k, v);
          }
        }

        return applySecurityHeaders(response);
      }
    }

    // 4. Pass through with rate-limit + CORS + security headers
    if (rateLimitHeaders) {
      for (const [k, v] of Object.entries(rateLimitHeaders)) {
        baseResponse.headers.set(k, v);
      }
    }

    const origin = request.headers.get("origin");
    for (const [k, v] of Object.entries(getCorsHeaders(origin))) {
      baseResponse.headers.set(k, v);
    }

    return applySecurityHeaders(baseResponse);
  }

  // ----------------------------------------------------------
  // Page Routes — Supabase Auth
  // ----------------------------------------------------------

  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  // We need to rebuild the response whenever Supabase rotates cookies, so we
  // create a small wrapper closure rather than the shared builder.
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(
          cookiesToSet: {
            name: string;
            value: string;
            options?: Record<string, unknown>;
          }[]
        ) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response = NextResponse.next({
              request: { headers: request.headers },
            });
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // Per Supabase SSR docs: getUser() validates the JWT with the auth server;
  // getSession() reads cookies without verification and must not be trusted.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isAuthenticated = !!user;

  // Recruiter-only pages take precedence over public-page matches
  // (e.g. /jobs/new must NOT be treated as public via the /jobs prefix).
  if (isRecruiterPage(pathname)) {
    if (!isAuthenticated) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirectTo", pathname);
      return applySecurityHeaders(NextResponse.redirect(loginUrl));
    }
    return applySecurityHeaders(response);
  }

  // Authenticated user hitting /login etc. → bounce to dashboard
  if (isAuthenticated && isAuthPage(pathname)) {
    const redirectTo = request.nextUrl.searchParams.get("redirectTo");
    const destination = redirectTo || "/dashboard";
    return applySecurityHeaders(
      NextResponse.redirect(new URL(destination, request.url))
    );
  }

  // Public pages and anything else: let it through. Server Components are
  // responsible for their own data-scope; the proxy only gates access.
  void isPublicPage; // referenced for documentation/symmetry
  return applySecurityHeaders(response);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder assets
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
