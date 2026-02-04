/**
 * @fileoverview Unit tests for lib/security/cors
 *
 * Tests origin validation, CORS headers, and preflight handling.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import {
  isOriginAllowed,
  getCorsHeaders,
  handleCorsPreflightIfNeeded,
} from "@/lib/security/cors";

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000");
  vi.stubEnv("VERCEL_URL", "");
  vi.stubEnv("VERCEL_BRANCH_URL", "");
});

// ============================================================
// isOriginAllowed
// ============================================================

describe("isOriginAllowed", () => {
  it("allows the configured app URL", () => {
    expect(isOriginAllowed("http://localhost:3000")).toBe(true);
  });

  it("rejects null origin", () => {
    expect(isOriginAllowed(null)).toBe(false);
  });

  it("rejects unknown origins", () => {
    expect(isOriginAllowed("https://evil.com")).toBe(false);
  });

  it("allows Vercel preview URLs (*.vercel.app)", () => {
    expect(isOriginAllowed("https://my-app-abc123.vercel.app")).toBe(true);
  });

  it("rejects malformed Vercel URLs", () => {
    expect(isOriginAllowed("https://my-app.vercel.app.evil.com")).toBe(false);
  });

  it("allows VERCEL_URL when set", () => {
    vi.stubEnv("VERCEL_URL", "my-deploy.vercel.app");
    expect(isOriginAllowed("https://my-deploy.vercel.app")).toBe(true);
  });

  it("strips trailing slash from app URL", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000/");
    expect(isOriginAllowed("http://localhost:3000")).toBe(true);
  });
});

// ============================================================
// getCorsHeaders
// ============================================================

describe("getCorsHeaders", () => {
  it("returns CORS headers for an allowed origin", () => {
    const headers = getCorsHeaders("http://localhost:3000");

    expect(headers["Access-Control-Allow-Origin"]).toBe(
      "http://localhost:3000"
    );
    expect(headers["Access-Control-Allow-Methods"]).toContain("GET");
    expect(headers["Access-Control-Allow-Headers"]).toContain("Authorization");
    expect(headers["Access-Control-Allow-Credentials"]).toBe("true");
  });

  it("returns empty object for a disallowed origin", () => {
    const headers = getCorsHeaders("https://evil.com");
    expect(Object.keys(headers)).toHaveLength(0);
  });

  it("returns empty object for null origin", () => {
    const headers = getCorsHeaders(null);
    expect(Object.keys(headers)).toHaveLength(0);
  });
});

// ============================================================
// handleCorsPreflightIfNeeded
// ============================================================

describe("handleCorsPreflightIfNeeded", () => {
  function makeRequest(method: string, origin?: string): NextRequest {
    const headers = new Headers();
    if (origin) headers.set("origin", origin);
    return new NextRequest("http://localhost:3000/api/test", {
      method,
      headers,
    });
  }

  it("returns a 204 response for OPTIONS requests", () => {
    const request = makeRequest("OPTIONS", "http://localhost:3000");
    const response = handleCorsPreflightIfNeeded(request);

    expect(response).not.toBeNull();
    expect(response!.status).toBe(204);
  });

  it("includes CORS headers in the preflight response for allowed origins", () => {
    const request = makeRequest("OPTIONS", "http://localhost:3000");
    const response = handleCorsPreflightIfNeeded(request);

    expect(response!.headers.get("Access-Control-Allow-Origin")).toBe(
      "http://localhost:3000"
    );
  });

  it("returns null for non-OPTIONS requests", () => {
    const request = makeRequest("GET", "http://localhost:3000");
    expect(handleCorsPreflightIfNeeded(request)).toBeNull();
  });

  it("returns null for POST requests", () => {
    const request = makeRequest("POST", "http://localhost:3000");
    expect(handleCorsPreflightIfNeeded(request)).toBeNull();
  });
});
