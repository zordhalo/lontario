/**
 * @fileoverview POST /api/waitlist
 *
 * Marketing-page email capture. Hardened with BotID, per-IP rate limit
 * (proxy `waitlist` tier), and per-email rate limit (1/hour). Idempotent —
 * a duplicate email returns 200 with `already_subscribed: true`.
 *
 * Privacy: stores only a salted SHA-256 hash of the client IP, never the
 * raw value. The User-Agent and referrer are kept verbatim but truncated.
 *
 * @module app/api/waitlist/route
 */

import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { createHash } from "node:crypto";
import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import { verifyBotID } from "@/lib/security/botid";
import { checkEmailRateLimit } from "@/lib/rate-limit";
import { sendWaitlistConfirmation } from "@/lib/email/waitlist";

export const runtime = "nodejs";
export const maxDuration = 5;

const BodySchema = z.object({
  email: z.string().email().min(3).max(254),
  source: z.enum(["landing", "apply_disabled"]).optional(),
});

async function captureToSentry(
  err: unknown,
  context: Record<string, unknown> = {},
) {
  try {
    const Sentry = await import("@sentry/nextjs");
    if (err instanceof Error) {
      Sentry.captureException(err, { extra: context });
    } else {
      Sentry.captureMessage(String(err), { level: "error", extra: context });
    }
  } catch {
    /* Sentry not available */
  }
}

/** SHA-256 hash of `<ip>:<salt>`. Returns null when ip is unknown. */
function hashIp(ip: string | null): string | null {
  if (!ip) return null;
  // Use SUPABASE_SERVICE_ROLE_KEY-derived salt as a stable per-deploy secret.
  // It never leaves the server. If unset (dev), use a constant placeholder so
  // dev hashes remain stable across requests.
  const salt = env.SUPABASE_SERVICE_ROLE_KEY ?? "dev-waitlist-salt";
  return createHash("sha256").update(`${ip}:${salt}`).digest("hex");
}

function getClientIp(request: NextRequest): string | null {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]?.trim() || null;
  const real = request.headers.get("x-real-ip");
  if (real) return real.trim();
  return null;
}

export async function POST(request: NextRequest) {
  try {
    // 1. BotID — fail-CLOSED.
    const botid = await verifyBotID(request);
    if (botid.isBot) {
      return NextResponse.json(
        { error: "Forbidden", code: "BOT_DETECTED" },
        { status: 403 },
      );
    }

    // 2. Parse body.
    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          issues: parsed.error.issues.map((i) => ({
            path: i.path.join("."),
            message: i.message,
          })),
        },
        { status: 400 },
      );
    }
    const { email, source = "landing" } = parsed.data;

    // 3. Per-email rate limit.
    const emailLimit = await checkEmailRateLimit(email, "waitlist");
    if (!emailLimit.allowed) {
      const retryAfter = Math.max(
        1,
        Math.ceil((emailLimit.reset - Date.now()) / 1000),
      );
      return NextResponse.json(
        {
          error: "Too Many Requests",
          code: "EMAIL_RATE_LIMITED",
          retryAfter,
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(retryAfter),
            "X-RateLimit-Limit": String(emailLimit.limit),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": String(emailLimit.reset),
          },
        },
      );
    }

    // 4. Insert. Idempotent on UNIQUE(email).
    const ipHash = hashIp(getClientIp(request));
    const userAgent =
      request.headers.get("user-agent")?.slice(0, 1024) ?? null;
    const referrer = request.headers.get("referer")?.slice(0, 2048) ?? null;

    const admin = createAdminClient();
    const { error: insertErr } = await admin.from("waitlist").insert({
      email: email.trim(),
      source,
      ip_hash: ipHash,
      user_agent: userAgent,
      referrer,
    });

    if (insertErr) {
      const code = (insertErr as { code?: string }).code;
      if (code === "23505") {
        // Already on the list — friendly idempotent success.
        return NextResponse.json(
          { ok: true, already_subscribed: true },
          { status: 200 },
        );
      }
      await captureToSentry(insertErr, { route: "waitlist" });
      return NextResponse.json(
        { error: "Could not subscribe" },
        { status: 500 },
      );
    }

    // 5. Background confirmation email (best-effort).
    after(async () => {
      try {
        await sendWaitlistConfirmation({ to: email.trim() });
      } catch (e) {
        await captureToSentry(e, { route: "waitlist.after.email" });
      }
    });

    return NextResponse.json(
      { ok: true, already_subscribed: false },
      { status: 201 },
    );
  } catch (err) {
    await captureToSentry(err, { route: "waitlist" });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
