/**
 * @fileoverview Next.js Middleware for Authentication
 *
 * Handles route protection based on authentication status.
 * Redirects unauthenticated users away from protected routes
 * and authenticated users away from auth-only routes.
 *
 * @module middleware
 */

import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Routes that require authentication
const PROTECTED_ROUTES = [
  "/dashboard",
  "/jobs/create",
  "/jobs/edit",
  "/candidates",
  "/interviews/manage",
  "/settings",
];

// Routes only for unauthenticated users
const AUTH_ROUTES = ["/login", "/register", "/forgot-password"];

// Public routes that don't require any auth check
const PUBLIC_ROUTES = [
  "/",
  "/about",
  "/contact",
  "/interview", // Public interview access via token
  "/auth/callback",
  "/reset-password",
  "/verify-email",
];

/**
 * Check if a path matches any of the route patterns
 */
function matchesRoute(path: string, routes: string[]): boolean {
  return routes.some((route) => {
    // Exact match or starts with route path
    return path === route || path.startsWith(`${route}/`);
  });
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip middleware for static files and API routes
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // Create a response to potentially modify
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  // Create Supabase client for middleware
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response = NextResponse.next({
              request: {
                headers: request.headers,
              },
            });
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // Get session - this refreshes tokens if needed
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const isAuthenticated = !!session;

  // Check if accessing a protected route without auth
  if (!isAuthenticated && matchesRoute(pathname, PROTECTED_ROUTES)) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Check if accessing auth routes while authenticated
  if (isAuthenticated && matchesRoute(pathname, AUTH_ROUTES)) {
    const redirectTo = request.nextUrl.searchParams.get("redirectTo");
    const destination = redirectTo || "/dashboard";
    return NextResponse.redirect(new URL(destination, request.url));
  }

  return response;
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
