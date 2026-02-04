/**
 * @fileoverview Unit tests for lib/security/headers
 *
 * Tests that all expected security headers are defined and applied.
 */

import { describe, it, expect } from "vitest";
import { NextResponse } from "next/server";
import { SECURITY_HEADERS, applySecurityHeaders } from "@/lib/security/headers";

describe("SECURITY_HEADERS", () => {
  it("contains Strict-Transport-Security", () => {
    expect(SECURITY_HEADERS["Strict-Transport-Security"]).toContain(
      "max-age="
    );
  });

  it("contains X-Frame-Options set to DENY", () => {
    expect(SECURITY_HEADERS["X-Frame-Options"]).toBe("DENY");
  });

  it("contains X-Content-Type-Options set to nosniff", () => {
    expect(SECURITY_HEADERS["X-Content-Type-Options"]).toBe("nosniff");
  });

  it("contains Referrer-Policy", () => {
    expect(SECURITY_HEADERS["Referrer-Policy"]).toBe(
      "strict-origin-when-cross-origin"
    );
  });

  it("contains Permissions-Policy", () => {
    expect(SECURITY_HEADERS["Permissions-Policy"]).toBeDefined();
    expect(SECURITY_HEADERS["Permissions-Policy"]).toContain("camera=()");
  });
});

describe("applySecurityHeaders", () => {
  it("sets all security headers on a NextResponse", () => {
    const response = NextResponse.next();
    applySecurityHeaders(response);

    for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
      expect(response.headers.get(key)).toBe(value);
    }
  });

  it("returns the same response object", () => {
    const response = NextResponse.next();
    const result = applySecurityHeaders(response);
    expect(result).toBe(response);
  });
});
