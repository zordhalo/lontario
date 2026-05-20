/**
 * @fileoverview Transactional emails for the public application flow.
 *
 * Two senders:
 *   - sendApplicationReceivedEmail: candidate-facing confirmation
 *   - sendNewApplicationNotification: recruiter-facing inbox triage email
 *
 * Both follow the same failure contract: they never throw. If
 * `env.RESEND_API_KEY` is unset they resolve `{ ok: false, error:
 * 'email_disabled' }` and report to Sentry (when available). Callers
 * (typically the /api/jobs/[id]/apply route) wrap the call in
 * `waitUntil(...)` so a failed email never breaks the candidate-facing
 * request.
 *
 * A 10s Promise.race timeout is enforced per send to keep waitUntil from
 * holding compute open indefinitely if Resend stalls.
 *
 * @module lib/email/applications
 */

import { Resend } from "resend";
import { env } from "@/lib/env";
import { getApplicationReceivedTemplate } from "./templates/application-received";
import { getNewApplicationNotificationTemplate } from "./templates/new-application-notification";

// ============================================================
// SHARED HELPERS
// ============================================================

const SEND_TIMEOUT_MS = 10_000;

export interface EmailSendResult {
  ok: boolean;
  /** Resend message id, when send succeeded. */
  messageId?: string;
  /**
   * One of: 'email_disabled' (no API key), 'timeout', 'resend_error',
   * 'unknown_error', or a raw error message.
   */
  error?: string;
}

let resendClient: Resend | null = null;
function getClient(): Resend {
  if (!resendClient) {
    // env.RESEND_API_KEY guarded by caller — this is only reached when set.
    resendClient = new Resend(env.RESEND_API_KEY as string);
  }
  return resendClient;
}

/** Recruiter inbox for new-application notifications. */
function recruiterInbox(): string {
  return process.env.RECRUITER_NOTIFICATION_EMAIL ?? "brian@creatin.ca";
}

/** Reply-to header for candidate-facing emails. */
function replyTo(): string {
  return process.env.RESEND_REPLY_TO ?? "brian@creatin.ca";
}

/**
 * Lazy, best-effort Sentry capture. Avoids static import so this module
 * stays usable in environments where @sentry/nextjs isn't initialized.
 */
async function captureToSentry(
  message: string,
  context?: Record<string, unknown>,
): Promise<void> {
  try {
    const Sentry = await import("@sentry/nextjs");
    if (Sentry?.captureMessage) {
      Sentry.captureMessage(message, {
        level: "warning",
        extra: context,
      });
    }
  } catch {
    // Sentry not installed — fall through silently.
  }
}

/**
 * Race a Resend send against a 10s timeout so a stuck request can't block
 * a `waitUntil` indefinitely.
 */
async function sendWithTimeout(
  send: () => Promise<{ data?: { id?: string } | null; error?: { message?: string } | null }>,
): Promise<EmailSendResult> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      send(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("email_send_timeout")),
          SEND_TIMEOUT_MS,
        );
      }),
    ]);
    if (result.error) {
      return { ok: false, error: result.error.message ?? "resend_error" };
    }
    return { ok: true, messageId: result.data?.id };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown_error";
    if (msg === "email_send_timeout") return { ok: false, error: "timeout" };
    return { ok: false, error: msg };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

// ============================================================
// CANDIDATE: APPLICATION RECEIVED
// ============================================================

export interface SendApplicationReceivedInput {
  to: string;
  fullName: string;
  jobTitle: string;
  jobId: string;
}

/**
 * Send the "we got your application" confirmation to a candidate.
 * Never throws.
 */
export async function sendApplicationReceivedEmail(
  input: SendApplicationReceivedInput,
): Promise<EmailSendResult> {
  if (!env.RESEND_API_KEY) {
    await captureToSentry(
      "[email] sendApplicationReceivedEmail skipped: RESEND_API_KEY unset",
      { jobId: input.jobId, to: input.to },
    );
    return { ok: false, error: "email_disabled" };
  }

  const { subject, html, text } = getApplicationReceivedTemplate({
    fullName: input.fullName,
    jobTitle: input.jobTitle,
  });

  const client = getClient();
  const result = await sendWithTimeout(() =>
    client.emails.send({
      from: env.EMAIL_FROM,
      to: input.to,
      replyTo: replyTo(),
      subject,
      html,
      text,
      tags: [
        { name: "category", value: "application_received" },
        { name: "job_id", value: input.jobId },
      ],
    }),
  );

  if (!result.ok) {
    await captureToSentry(
      `[email] sendApplicationReceivedEmail failed: ${result.error}`,
      { jobId: input.jobId, to: input.to, error: result.error },
    );
  }

  return result;
}

// ============================================================
// RECRUITER: NEW APPLICATION NOTIFICATION
// ============================================================

export interface SendNewApplicationNotificationInput {
  candidateId: string;
  fullName: string;
  email: string;
  jobTitle: string;
  jobId: string;
  githubUrl?: string | null;
}

/**
 * Notify the recruiter inbox that a new application landed.
 * Never throws.
 */
export async function sendNewApplicationNotification(
  input: SendNewApplicationNotificationInput,
): Promise<EmailSendResult> {
  if (!env.RESEND_API_KEY) {
    await captureToSentry(
      "[email] sendNewApplicationNotification skipped: RESEND_API_KEY unset",
      { jobId: input.jobId, candidateId: input.candidateId },
    );
    return { ok: false, error: "email_disabled" };
  }

  const { subject, html, text } = getNewApplicationNotificationTemplate({
    fullName: input.fullName,
    email: input.email,
    jobTitle: input.jobTitle,
    jobId: input.jobId,
    githubUrl: input.githubUrl,
    candidateId: input.candidateId,
    appUrl: env.NEXT_PUBLIC_APP_URL,
  });

  const client = getClient();
  const result = await sendWithTimeout(() =>
    client.emails.send({
      from: env.EMAIL_FROM,
      to: recruiterInbox(),
      replyTo: input.email,
      subject,
      html,
      text,
      tags: [
        { name: "category", value: "new_application_notification" },
        { name: "job_id", value: input.jobId },
      ],
    }),
  );

  if (!result.ok) {
    await captureToSentry(
      `[email] sendNewApplicationNotification failed: ${result.error}`,
      {
        jobId: input.jobId,
        candidateId: input.candidateId,
        error: result.error,
      },
    );
  }

  return result;
}
