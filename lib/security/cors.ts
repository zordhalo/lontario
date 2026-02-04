/**
 * @fileoverview CORS Utilities
 *
 * Origin validation and CORS header generation for API routes.
 *
 * @module lib/security/cors
 */

import { NextRequest, NextResponse } from "next/server";

/**
 * Build the list of allowed origins from environment variables.
 */
function getAllowedOrigins(): string[] {
  const origins: string[] = [];

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (appUrl) {
    origins.push(appUrl.replace(/\/$/, ""));
  }

  // Vercel preview deployments
  const vercelUrl = process.env.VERCEL_URL;
  if (vercelUrl) {
    origins.push(`https://${vercelUrl}`);
  }

  // Vercel branch preview URLs
  const vercelBranchUrl = process.env.VERCEL_BRANCH_URL;
  if (vercelBranchUrl) {
    origins.push(`https://${vercelBranchUrl}`);
  }

  return origins;
}

/**
 * Check whether an origin is allowed.
 */
export function isOriginAllowed(origin: string | null): boolean {
  if (!origin) return false;

  const allowed = getAllowedOrigins();

  // Exact match
  if (allowed.includes(origin)) return true;

  // Allow any *.vercel.app preview
  if (/^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(origin)) return true;

  return false;
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
