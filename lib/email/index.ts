/**
 * @fileoverview Email service using Resend
 * 
 * This module handles all transactional email sending for the platform:
 * - Interview scheduled notifications
 * - Interview reminders (24h and 1h before)
 * - Interview completed confirmations
 * - Reschedule and cancellation notifications
 * 
 * Uses Resend API for reliable email delivery.
 * 
 * @module lib/email
 * @requires RESEND_API_KEY environment variable
 * @see https://resend.com/docs
 */

import { Resend } from "resend";
import { env } from "@/lib/env";
import {
  getInterviewScheduledTemplate,
  getInterviewReminderTemplate,
  getInterviewCompletedTemplate,
  getInterviewRescheduledTemplate,
  getInterviewCancelledTemplate,
  type EmailTemplateData,
} from "./templates";

// ============================================================
// CLIENT INITIALIZATION
// ============================================================

/** Singleton Resend client instance */
let resendClient: Resend | null = null;

/**
 * Gets or creates the Resend client instance
 * Uses lazy initialization to avoid build-time errors
 * 
 * @returns Resend client instance
 * @throws Error if RESEND_API_KEY is not configured
 */
function getResendClient(): Resend {
  if (!resendClient) {
    const apiKey = env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error("RESEND_API_KEY environment variable is not set");
    }
    resendClient = new Resend(apiKey);
  }
  return resendClient;
}

/**
 * Returns true if email sending is configured (Resend API key present).
 * Callers (e.g. cron jobs) should check this before attempting to send and
 * gracefully skip otherwise.
 */
export function isEmailConfigured(): boolean {
  return Boolean(env.RESEND_API_KEY);
}

/** Default sender address - should be verified domain in Resend dashboard */
const DEFAULT_FROM = env.EMAIL_FROM;

// ============================================================
// TYPE DEFINITIONS
// ============================================================

/**
 * Supported email types
 * Each type corresponds to a specific email template
 */
export type EmailType =
  | "interview_scheduled"
  | "interview_reminder_24h"
  | "interview_reminder_1h"
  | "interview_completed"
  | "interview_rescheduled"
  | "interview_cancelled";

/** Options for sending an email */
interface SendEmailOptions {
  /** Recipient email address */
  to: string;
  /** Email type determining template to use */
  type: EmailType;
  /** Data to populate the template */
  data: EmailTemplateData;
}

/** Result of a send email operation */
interface SendEmailResult {
  /** Whether the email was sent successfully */
  success: boolean;
  /** Resend message ID if successful */
  messageId?: string;
  /** Error message if failed */
  error?: string;
}

/**
 * Send an email using Resend
 */
export async function sendEmail({
  to,
  type,
  data,
}: SendEmailOptions): Promise<SendEmailResult> {
  try {
    const resend = getResendClient();

    const { subject, html, text } = getEmailContent(type, data);

    const result = await resend.emails.send({
      from: DEFAULT_FROM,
      to,
      subject,
      html,
      text,
    });

    if (result.error) {
      console.error("Resend error:", result.error);
      return {
        success: false,
        error: result.error.message,
      };
    }

    return {
      success: true,
      messageId: result.data?.id,
    };
  } catch (error) {
    console.error("Failed to send email:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Send interview scheduled email
 */
export async function sendInterviewScheduledEmail(
  to: string,
  data: EmailTemplateData
): Promise<SendEmailResult> {
  return sendEmail({ to, type: "interview_scheduled", data });
}

/**
 * Send interview reminder email
 */
export async function sendInterviewReminderEmail(
  to: string,
  data: EmailTemplateData,
  hoursUntil: 24 | 1
): Promise<SendEmailResult> {
  const type = hoursUntil === 24 ? "interview_reminder_24h" : "interview_reminder_1h";
  return sendEmail({ to, type, data });
}

/**
 * Send interview completed email
 */
export async function sendInterviewCompletedEmail(
  to: string,
  data: EmailTemplateData
): Promise<SendEmailResult> {
  return sendEmail({ to, type: "interview_completed", data });
}

/**
 * Send interview rescheduled email
 */
export async function sendInterviewRescheduledEmail(
  to: string,
  data: EmailTemplateData
): Promise<SendEmailResult> {
  return sendEmail({ to, type: "interview_rescheduled", data });
}

/**
 * Send interview cancelled email
 */
export async function sendInterviewCancelledEmail(
  to: string,
  data: EmailTemplateData
): Promise<SendEmailResult> {
  return sendEmail({ to, type: "interview_cancelled", data });
}

/**
 * Get email content (subject, html, text) based on type
 */
function getEmailContent(
  type: EmailType,
  data: EmailTemplateData
): { subject: string; html: string; text: string } {
  switch (type) {
    case "interview_scheduled":
      return getInterviewScheduledTemplate(data);
    case "interview_reminder_24h":
      return getInterviewReminderTemplate(data, 24);
    case "interview_reminder_1h":
      return getInterviewReminderTemplate(data, 1);
    case "interview_completed":
      return getInterviewCompletedTemplate(data);
    case "interview_rescheduled":
      return getInterviewRescheduledTemplate(data);
    case "interview_cancelled":
      return getInterviewCancelledTemplate(data);
    default:
      throw new Error(`Unknown email type: ${type}`);
  }
}

/**
 * Batch send emails (for reminders cron)
 */
export async function sendBatchEmails(
  emails: Array<{ to: string; type: EmailType; data: EmailTemplateData }>
): Promise<{ sent: number; failed: number; errors: string[] }> {
  const results = await Promise.allSettled(
    emails.map(({ to, type, data }) => sendEmail({ to, type, data }))
  );

  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  results.forEach((result, index) => {
    if (result.status === "fulfilled" && result.value.success) {
      sent++;
    } else {
      failed++;
      const error =
        result.status === "rejected"
          ? result.reason?.message
          : result.value.error;
      errors.push(`Email to ${emails[index].to}: ${error}`);
    }
  });

  return { sent, failed, errors };
}
