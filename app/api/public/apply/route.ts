/**
 * @fileoverview POST /api/public/apply
 *
 * Public candidate application endpoint. Hardened against bot/cost abuse:
 *
 *  1. Vercel BotID verification (fail-CLOSED — bots get 403). This is the
 *     first line of defense before we spend any backend cycles.
 *  2. Per-IP rate limit via the `apply` tier (handled by proxy.ts).
 *  3. Per-email rate limit (2/hour) — stops single-email abuse across IPs.
 *  4. Job existence + active gate.
 *  5. GitHub URL pre-validation: hits api.github.com/users/{username} with a
 *     3s timeout. 404 → 400 (invalid profile). 5xx / timeout → allow through
 *     (don't break apply flow on GitHub outages). This is the cost-DoS gate
 *     — if it fails we DO NOT trigger any OpenAI work.
 *  6. Idempotent insert: unique index on (job_id, lower(email)) gives 409.
 *  7. Background AI scoring fires via `next/server` `after()` (Next 16) so
 *     the response returns quickly. Email confirmation also fires in the
 *     background.
 *
 * The response never leaks AI scoring data — that is recruiter-only.
 *
 * @module app/api/public/apply/route
 */

import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import { verifyBotID } from "@/lib/security/botid";
import { checkEmailRateLimit } from "@/lib/rate-limit";
import { processAndScoreCandidate } from "@/lib/ai/scoring";
import { sendApplicationReceivedEmail } from "@/lib/email/applications";

export const runtime = "nodejs";
export const maxDuration = 30;

// ============================================================
// Validation
// ============================================================

const httpsUrl = z
  .string()
  .url()
  .max(2048)
  .refine((u) => u.startsWith("https://"), {
    message: "URL must use https",
  });

const BodySchema = z.object({
  job_id: z.string().uuid(),
  email: z.string().email().min(3).max(254),
  full_name: z.string().min(1).max(200),
  // GitHub URL is REQUIRED — this is intentional per product spec and is the
  // cost-DoS gate (we validate the username with the GitHub API before we
  // create the candidate, so AI scoring never fires on fake profiles).
  github_url: httpsUrl.refine(
    (u) => /^https:\/\/(www\.)?github\.com\/[^/]+\/?$/i.test(u),
    { message: "Expected a https://github.com/<username> URL" },
  ),
  linkedin_url: httpsUrl.optional(),
  portfolio_url: httpsUrl.optional(),
  resume_path: z.string().min(1).max(512).optional(),
  cover_letter: z.string().max(5000).optional(),
});

// ============================================================
// Helpers
// ============================================================

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

/**
 * Extract the GitHub username from a github.com URL. Returns null if the URL
 * shape doesn't match (the zod refine above should have already rejected
 * those, but we never want to throw inside the pre-validation gate).
 */
function extractGithubUsername(url: string): string | null {
  const m = url.match(/^https:\/\/(?:www\.)?github\.com\/([^/?#]+)\/?$/i);
  if (!m) return null;
  const username = m[1];
  // Reserved paths that aren't user accounts.
  const reserved = new Set([
    "about",
    "pricing",
    "features",
    "enterprise",
    "topics",
    "trending",
    "marketplace",
    "explore",
    "settings",
    "login",
    "join",
  ]);
  if (reserved.has(username.toLowerCase())) return null;
  return username;
}

/**
 * Pre-validate the GitHub username with the GitHub API.
 *
 * Returns:
 *   - 'valid'    when the user exists (200).
 *   - 'invalid'  when GitHub returned 404 (or the URL didn't parse).
 *   - 'unknown'  on 5xx / network failure / rate limit — caller treats as
 *                "let it through, don't fail apply on GitHub outage".
 */
async function preValidateGithub(
  url: string,
): Promise<"valid" | "invalid" | "unknown"> {
  const username = extractGithubUsername(url);
  if (!username) return "invalid";

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3000);

  try {
    const headers: Record<string, string> = {
      Accept: "application/vnd.github+json",
      "User-Agent": "lontario-public-apply",
    };
    if (env.GITHUB_TOKEN) {
      headers.Authorization = `Bearer ${env.GITHUB_TOKEN}`;
    }

    const res = await fetch(
      `https://api.github.com/users/${encodeURIComponent(username)}`,
      { headers, signal: controller.signal },
    );

    if (res.status === 200) return "valid";
    if (res.status === 404) return "invalid";
    // 403 (rate limited / abuse), 5xx, etc → fail open.
    return "unknown";
  } catch {
    return "unknown";
  } finally {
    clearTimeout(timer);
  }
}

// ============================================================
// Handler
// ============================================================

export async function POST(request: NextRequest) {
  try {
    // 1. BotID — fail-CLOSED on this route. Every OpenAI cost starts here.
    const botid = await verifyBotID(request);
    if (botid.isBot) {
      return NextResponse.json(
        { error: "Forbidden", code: "BOT_DETECTED" },
        { status: 403 },
      );
    }

    // 2. Parse + validate body.
    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 },
      );
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
    const body = parsed.data;

    // 3. Per-email rate limit (longer window than per-IP).
    const emailLimit = await checkEmailRateLimit(body.email, "apply");
    if (!emailLimit.allowed) {
      const retryAfter = Math.max(
        1,
        Math.ceil((emailLimit.reset - Date.now()) / 1000),
      );
      return NextResponse.json(
        {
          error: "Too Many Requests",
          code: "EMAIL_RATE_LIMITED",
          message:
            "You've submitted too many applications recently. Please try again later.",
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

    // 4. Verify job is open BEFORE the GitHub call.
    const admin = createAdminClient();
    const { data: job, error: jobErr } = await admin
      .from("jobs")
      .select("id, title, status, is_archived")
      .eq("id", body.job_id)
      .maybeSingle();

    if (jobErr) {
      await captureToSentry(jobErr, { route: "apply", job_id: body.job_id });
      return NextResponse.json(
        { error: "Internal error" },
        { status: 500 },
      );
    }
    if (!job || job.is_archived || job.status !== "active") {
      return NextResponse.json(
        { error: "Job not available" },
        { status: 404 },
      );
    }

    // 5. GitHub URL pre-validation (the cost-DoS gate).
    const ghStatus = await preValidateGithub(body.github_url);
    if (ghStatus === "invalid") {
      return NextResponse.json(
        {
          error: "Invalid GitHub profile",
          code: "GITHUB_PROFILE_NOT_FOUND",
        },
        { status: 400 },
      );
    }
    // 'unknown' → allow through (GitHub outage shouldn't break apply flow).

    // 6. Insert candidate. Idempotency via unique (job_id, lower(email)).
    const insertPayload = {
      job_id: body.job_id,
      email: body.email.trim(),
      full_name: body.full_name.trim(),
      github_url: body.github_url,
      linkedin_url: body.linkedin_url ?? null,
      portfolio_url: body.portfolio_url ?? null,
      // We store the storage path; recruiter view mints signed URLs on demand.
      resume_url: body.resume_path ?? null,
      cover_letter: body.cover_letter ?? null,
      source: "public_apply" as const,
      stage: "applied" as const,
    };

    const { data: candidate, error: insertErr } = await admin
      .from("candidates")
      .insert(insertPayload)
      .select("id, email, full_name")
      .single();

    if (insertErr) {
      // 23505 = unique_violation. Friendly idempotent response.
      // Some Supabase responses surface this as a code on the error object.
      const code = (insertErr as { code?: string }).code;
      if (code === "23505") {
        return NextResponse.json(
          {
            error: "Already applied",
            code: "DUPLICATE_APPLICATION",
            message:
              "You've already applied to this job. We'll be in touch soon.",
          },
          { status: 409 },
        );
      }
      await captureToSentry(insertErr, {
        route: "apply",
        job_id: body.job_id,
      });
      return NextResponse.json(
        { error: "Could not create application" },
        { status: 500 },
      );
    }

    // 7. Background work — runs AFTER the response is sent. Both are best-
    //    effort and swallow their own errors into Sentry.
    after(async () => {
      try {
        await processAndScoreCandidate({
          id: candidate.id,
          job_id: body.job_id,
          full_name: candidate.full_name,
          email: candidate.email,
          github_url: body.github_url,
          linkedin_url: body.linkedin_url ?? null,
          cover_letter: body.cover_letter ?? null,
          resume_text: null,
        });
      } catch (e) {
        await captureToSentry(e, {
          route: "apply.after.score",
          candidate_id: candidate.id,
        });
      }
    });

    after(async () => {
      try {
        await sendApplicationReceivedEmail({
          to: candidate.email,
          fullName: candidate.full_name,
          jobTitle: job.title,
          jobId: job.id,
        });
      } catch (e) {
        await captureToSentry(e, {
          route: "apply.after.email",
          candidate_id: candidate.id,
        });
      }
    });

    return NextResponse.json(
      {
        candidate_id: candidate.id,
        message: "Application received",
      },
      { status: 201 },
    );
  } catch (err) {
    await captureToSentry(err, { route: "apply" });
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500 },
    );
  }
}
