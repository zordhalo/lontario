/**
 * @fileoverview CORS Utilities
 *
 * Origin validation and CORS header generation for API routes.
 *
 * Allow-list (Wave 2 hardened — no *.vercel.app wildcard):
 *   1. NEXT_PUBLIC_APP_URL (canonical production origin)
 *   2. https://${VERCEL_URL} — only on preview deployments (the deploy's own URL)
 *   3. http://localhost:3000 — only when NODE_ENV=development
 *
 * @module lib/security/cors
 */

import { NextRequest, NextResponse } from "next/server";

let _warnedMissingAppUrl = false;

/**
 * Build the list of allowed origins from environment variables.
 */
function getAllowedOrigins(): string[] {
  const origins: string[] = [];

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (appUrl) {
    origins.push(appUrl.replace(/\/$/, ""));
  } else if (!_warnedMissingAppUrl) {
    _warnedMissingAppUrl = true;
    // eslint-disable-next-line no-console
    console.warn(
      "[cors] NEXT_PUBLIC_APP_URL is unset — all cross-origin requests will be denied."
    );
  }

  // On Vercel preview deployments, allow the deploy's own URL so the preview
  // can call its own APIs. VERCEL_ENV === "preview" gates this to non-prod.
  const vercelEnv = process.env.VERCEL_ENV;
  const vercelUrl = process.env.VERCEL_URL;
  if (vercelEnv === "preview" && vercelUrl) {
    origins.push(`https://${vercelUrl}`);
  }

  // Local development
  if (process.env.NODE_ENV === "development") {
    origins.push("http://localhost:3000");
  }

  return origins;
}

/**
 * Check whether an origin is allowed.
 *
 * Exact match only. The previous `*.vercel.app` wildcard was removed because
 * any attacker could deploy to vercel.app and issue credentialed cross-origin
 * requests against production.
 */
export function isOriginAllowed(origin: string | null): boolean {
  if (!origin) return false;
  return getAllowedOrigins().includes(origin);
}

/**
 * Return CORS headers for a given origin.
 * Returns an empty object if the origin is not allowed.
 */
export function getCorsHeaders(
  origin: string | null
): Record<string, string> {
  if (!isOriginAllowed(origin)) return {};

  return {
    "Access-Control-Allow-Origin": origin!,
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, X-Requested-With",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

/**
 * Handle an OPTIONS preflight request.
 * Returns a 204 response if the request is a preflight, null otherwise.
 */
export function handleCorsPreflightIfNeeded(
  request: NextRequest
): NextResponse | null {
  if (request.method !== "OPTIONS") return null;

  const origin = request.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}
