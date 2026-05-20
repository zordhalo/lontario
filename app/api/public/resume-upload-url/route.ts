/**
 * @fileoverview POST /api/public/resume-upload-url
 *
 * Public endpoint that mints a short-lived signed upload URL for a candidate
 * to PUT their resume directly to Supabase Storage. The route does NOT touch
 * OpenAI or any other paid API. It only validates the file shape, verifies
 * the job exists and is active, runs BotID, and is protected by the `apply`
 * tier rate limit in proxy.ts.
 *
 * @module app/api/public/resume-upload-url/route
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/server";
import {
  createSignedResumeUploadUrl,
  validateResumeUpload,
  type ResumeFileExt,
} from "@/lib/supabase/storage";
import { verifyBotID } from "@/lib/security/botid";

export const runtime = "nodejs";
export const maxDuration = 10;

const BodySchema = z.object({
  job_id: z.string().uuid(),
  fileName: z.string().min(1).max(255),
  fileSize: z.number().int().positive(),
  contentType: z.enum([
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ]),
});

function extFromContentType(ct: string): ResumeFileExt | null {
  switch (ct) {
    case "application/pdf":
      return "pdf";
    case "application/msword":
      return "doc";
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      return "docx";
    default:
      return null;
  }
}

async function captureToSentry(err: unknown, context: Record<string, unknown> = {}) {
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

export async function POST(request: NextRequest) {
  try {
    // 1. BotID
    const botid = await verifyBotID(request);
    if (botid.isBot) {
      return NextResponse.json(
        { error: "Forbidden", code: "BOT_DETECTED" },
        { status: 403 },
      );
    }

    // 2. Parse + validate body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 },
      );
    }

    const parsed = BodySchema.safeParse(body);
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

    const { job_id, fileName, fileSize, contentType } = parsed.data;

    // 3. File validation (defense in depth: bucket policy also enforces).
    const fileCheck = validateResumeUpload({
      name: fileName,
      size: fileSize,
      type: contentType,
    });
    if (!fileCheck.ok) {
      return NextResponse.json(
        { error: fileCheck.reason },
        { status: 400 },
      );
    }

    const fileExt = extFromContentType(contentType);
    if (!fileExt) {
      return NextResponse.json(
        { error: "Unsupported content type" },
        { status: 400 },
      );
    }

    // 4. Verify job exists and is active.
    const admin = createAdminClient();
    const { data: job, error: jobErr } = await admin
      .from("jobs")
      .select("id, status, is_archived")
      .eq("id", job_id)
      .maybeSingle();

    if (jobErr) {
      await captureToSentry(jobErr, { route: "resume-upload-url", job_id });
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

    // 5. Mint signed upload URL.
    const signed = await createSignedResumeUploadUrl({
      jobId: job_id,
      fileExt,
      contentType,
    });

    return NextResponse.json(signed, { status: 200 });
  } catch (err) {
    await captureToSentry(err, { route: "resume-upload-url" });
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500 },
    );
  }
}
