/**
 * @fileoverview Vercel BotID verification helper.
 *
 * Adds a server-side bot check to public endpoints (apply, waitlist,
 * resume-upload-url). The browser-side BotID script injects a token; we
 * verify it against Vercel's BotID endpoint here before doing any expensive
 * work (especially OpenAI calls).
 *
 * Behaviour:
 *   - Development (`NODE_ENV !== "production"`): no-op, returns `{ ok: true,
 *     isBot: false }`. This keeps local dev frictionless.
 *   - Production with BOTID_VERIFY_URL configured: POST the token; treat any
 *     successful response with `isBot: true` as a bot hit.
 *   - Production with BOTID_VERIFY_URL unset: log a warning to Sentry and
 *     FAIL OPEN. We can ship without BotID because rate limits + email
 *     idempotency + the GitHub-URL pre-validation gate still protect the
 *     expensive code path. This is intentional.
 *   - Verify endpoint returns 5xx / times out: also fail open (we'd rather
 *     accept a possible bot than reject a real applicant during a Vercel
 *     outage).
 *
 * The token is read from the `x-vercel-botid` header (Vercel's script
 * convention) or, as a fallback, a `botid_token` field in the JSON body.
 *
 * @module lib/security/botid
 */

import type { NextRequest } from "next/server";

import { isProd } from "@/lib/env";

/** Result of a BotID verification call. */
export interface BotIDVerifyResult {
  /** True when the call completed (verify endpoint reachable OR skipped). */
  ok: boolean;
  /** True when the verifier classified the request as a bot. */
  isBot?: boolean;
  /** Optional human-readable reason for logs / debugging. */
  reason?: string;
}

/** Timeout for the verify HTTP call. */
const BOTID_VERIFY_TIMEOUT_MS = 1500;

/**
 * Dynamically capture a message to Sentry without statically importing it
 * (keeps this module edge-safe and out of any client bundle that imports
 * from `@/lib/security/*`).
 */
function captureSentryMessageSafe(message: string): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mod: any;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    mod = require("@sentry/nextjs");
  } catch {
    // Sentry not available — swallow.
    return;
  }
  try {
    mod?.captureMessage?.(message, "warning");
  } catch {
    // never let an observability failure break the request
  }
}

/**
 * Read the BotID token from the request. We accept it on the
 * `x-vercel-botid` header (preferred) or, for clients that send JSON, on
 * `botid_token` in the body. Body parsing is best-effort and never throws —
 * the route handler still owns the canonical body parse.
 */
async function extractBotIdToken(
  request: NextRequest
): Promise<string | null> {
  const header = request.headers.get("x-vercel-botid");
  if (header && header.length > 0) return header;

  // Only attempt body parse for POST/PUT/PATCH.
  const method = request.method.toUpperCase();
  if (!["POST", "PUT", "PATCH"].includes(method)) return null;

  try {
    // Clone so the route handler can still read the body once.
    const cloned = request.clone();
    const text = await cloned.text();
    if (!text) return null;
    const parsed: unknown = JSON.parse(text);
    if (
      parsed &&
      typeof parsed === "object" &&
      "botid_token" in (parsed as Record<string, unknown>)
    ) {
      const t = (parsed as Record<string, unknown>).botid_token;
      if (typeof t === "string" && t.length > 0) return t;
    }
  } catch {
    // Body wasn't JSON, or already consumed. Not fatal.
  }

  return null;
}

/**
 * Verify a request against Vercel BotID.
 *
 * Pure, side-effect-free except for an optional Sentry warning when the
 * verifier is misconfigured in production.
 */
export async function verifyBotID(
  request: NextRequest
): Promise<BotIDVerifyResult> {
  // Dev mode is always allowed through.
  if (!isProd) {
    return { ok: true, isBot: false, reason: "dev-skip" };
  }

  // process.env access is intentional here — BOTID_VERIFY_URL is an optional
  // feature flag that lib/env.ts does not yet validate.
  const verifyUrl = process.env.BOTID_VERIFY_URL;

  if (!verifyUrl) {
    // Fail open. Other defenses (rate limits, email idempotency, GitHub
    // pre-validation) still protect the route.
    captureSentryMessageSafe(
      "[botid] BOTID_VERIFY_URL not set in production — failing open"
    );
    return { ok: true, isBot: false, reason: "verify-url-unset" };
  }

  const token = await extractBotIdToken(request);
  if (!token) {
    // No token at all — most legitimate clients will send one. Treat as bot
    // in production. (If the front-end isn't injecting tokens yet, set
    // BOTID_VERIFY_URL to empty/unset to bypass.)
    return { ok: true, isBot: true, reason: "missing-token" };
  }

  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    BOTID_VERIFY_TIMEOUT_MS
  );

  try {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    const userAgent = request.headers.get("user-agent") ?? null;

    const res = await fetch(verifyUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, ip, userAgent }),
      signal: controller.signal,
    });

    if (!res.ok) {
      // 5xx from verify endpoint → fail open.
      return {
        ok: true,
        isBot: false,
        reason: `verify-http-${res.status}`,
      };
    }

    const data: unknown = await res.json().catch(() => null);
    if (data && typeof data === "object") {
      const isBot = Boolean(
        (data as Record<string, unknown>).isBot ??
          (data as Record<string, unknown>).is_bot
      );
      return { ok: true, isBot, reason: isBot ? "verifier-flagged" : "ok" };
    }
    // Malformed response — fail open.
    return { ok: true, isBot: false, reason: "verify-malformed-response" };
  } catch (err) {
    // Network error / timeout / abort → fail open.
    const reason =
      err instanceof Error && err.name === "AbortError"
        ? "verify-timeout"
        : "verify-network-error";
    return { ok: true, isBot: false, reason };
  } finally {
    clearTimeout(timer);
  }
}
