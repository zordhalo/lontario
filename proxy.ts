/**
 * @fileoverview Next.js Proxy (formerly Middleware)
 *
 * Handles:
 * 1. API routes — CORS preflight, rate limiting, security headers
 * 2. Page routes — Supabase auth checks, security headers
 *
 * Rate limiting runs before auth to reject abusive traffic cheaply.
 *
 * @module proxy
 */

import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getTierForPath, getRateLimiter } from "@/lib/rate-limit";
import { applySecurityHeaders } from "@/lib/security/headers";
import { getCorsHeaders, handleCorsPreflightIfNeeded } from "@/lib/security/cors";

// ============================================================
// Route Definitions (page auth)
// ============================================================

/** Routes that require authentication */
const PROTECTED_ROUTES = [
  "/dashboard",
  "/jobs/create",
  "/jobs/edit",
  "/candidates",
  "/interviews/manage",
  "/settings",
];

/** Routes only for unauthenticated users */
const AUTH_ROUTES = ["/login", "/register", "/forgot-password"];

/** Check if a path matches any route patterns */
function matchesRoute(path: string, routes: string[]): boolean {
  return routes.some(
    (route) => path === route || path.startsWith(`${route}/`)
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

    // 2. Rate limiting
    const tier = getTierForPath(pathname);
    if (tier) {
      const limiter = getRateLimiter();
      const ip = getClientIp(request);
      const result = await limiter.check(ip, tier);

      if (!result.allowed) {
        const retryAfter = Math.ceil(
          (result.reset - Date.now()) / 1000
        );
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

        // Add CORS headers to 429 so browsers can read the error
        const origin = request.headers.get("origin");
        for (const [k, v] of Object.entries(getCorsHeaders(origin))) {
          response.headers.set(k, v);
        }

        return applySecurityHeaders(response);
      }

      // 3. Pass through with rate-limit + CORS + security headers
      const response = NextResponse.next();
      response.headers.set("X-RateLimit-Limit", String(result.limit));
      response.headers.set(
        "X-RateLimit-Remaining",
        String(result.remaining)
      );
      response.headers.set("X-RateLimit-Reset", String(result.reset));

      const origin = request.headers.get("origin");
      for (const [k, v] of Object.entries(getCorsHeaders(origin))) {
        response.headers.set(k, v);
      }

      return applySecurityHeaders(response);
    }

    // Tier is null (e.g. cron) — pass through with security headers only
    return applySecurityHeaders(NextResponse.next());
  }

  // ----------------------------------------------------------
  // Page Routes — Supabase Auth
  // ----------------------------------------------------------

  let response = NextResponse.next({
    request: { headers: request.headers },
  });

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

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const isAuthenticated = !!session;

  if (!isAuthenticated && matchesRoute(pathname, PROTECTED_ROUTES)) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirectTo", pathname);
    return applySecurityHeaders(NextResponse.redirect(loginUrl));
  }

  if (isAuthenticated && matchesRoute(pathname, AUTH_ROUTES)) {
    const redirectTo = request.nextUrl.searchParams.get("redirectTo");
    const destination = redirectTo || "/dashboard";
    return applySecurityHeaders(
      NextResponse.redirect(new URL(destination, request.url))
    );
  }

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
