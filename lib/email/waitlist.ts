/**
 * @fileoverview Waitlist confirmation email sender.
 *
 * Same failure contract as lib/email/applications.ts: never throws, returns
 * `{ ok: false, error: 'email_disabled' }` when RESEND_API_KEY is unset,
 * 10s timeout via Promise.race. Callers wrap in waitUntil.
 *
 * @module lib/email/waitlist
 */

import { Resend } from "resend";
import { env } from "@/lib/env";
import { getWaitlistConfirmationTemplate } from "./templates/waitlist-confirmation";

const SEND_TIMEOUT_MS = 10_000;

export interface WaitlistSendResult {
  ok: boolean;
  messageId?: string;
  error?: string;
}

let resendClient: Resend | null = null;
function getClient(): Resend {
  if (!resendClient) {
    resendClient = new Resend(env.RESEND_API_KEY as string);
  }
  return resendClient;
}

function replyTo(): string {
  return process.env.RESEND_REPLY_TO ?? "brian@creatin.ca";
}

async function captureToSentry(
  message: string,
  context?: Record<string, unknown>,
): Promise<void> {
  try {
    const Sentry = await import("@sentry/nextjs");
    if (Sentry?.captureMessage) {
      Sentry.captureMessage(message, { level: "warning", extra: context });
    }
  } catch {
    // Sentry not installed — fall through silently.
  }
}

export interface SendWaitlistConfirmationInput {
  to: string;
}

/**
 * Send the "you're on the Lontario waitlist" confirmation. Never throws.
 */
export async function sendWaitlistConfirmation(
  input: SendWaitlistConfirmationInput,
): Promise<WaitlistSendResult> {
  if (!env.RESEND_API_KEY) {
    await captureToSentry(
      "[email] sendWaitlistConfirmation skipped: RESEND_API_KEY unset",
      { to: input.to },
    );
    return { ok: false, error: "email_disabled" };
  }

  const { subject, html, text } = getWaitlistConfirmationTemplate();
  const client = getClient();

  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      client.emails.send({
        from: env.EMAIL_FROM,
        to: input.to,
        replyTo: replyTo(),
        subject,
        html,
        text,
        tags: [{ name: "category", value: "waitlist_confirmation" }],
      }),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("email_send_timeout")),
          SEND_TIMEOUT_MS,
        );
      }),
    ]);

    if (result.error) {
      await captureToSentry(
        `[email] sendWaitlistConfirmation failed: ${result.error.message}`,
        { to: input.to, error: result.error.message },
      );
      return { ok: false, error: result.error.message ?? "resend_error" };
    }
    return { ok: true, messageId: result.data?.id };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown_error";
    const normalized = msg === "email_send_timeout" ? "timeout" : msg;
    await captureToSentry(
      `[email] sendWaitlistConfirmation failed: ${normalized}`,
      { to: input.to, error: normalized },
    );
    return { ok: false, error: normalized };
  } finally {
    if (timer) clearTimeout(timer);
  }
}
