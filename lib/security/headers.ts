/**
 * @fileoverview Security Headers
 *
 * Common security headers applied to all responses via middleware
 * and next.config.mjs.
 *
 * @module lib/security/headers
 */

import { NextResponse } from "next/server";

export const SECURITY_HEADERS: Record<string, string> = {
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy":
    "camera=(), microphone=(), geolocation=(), browsing-topics=()",
};

/**
 * Apply security headers to a NextResponse.
 */
export function applySecurityHeaders(response: NextResponse): NextResponse {
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(key, value);
  }
  return response;
}
