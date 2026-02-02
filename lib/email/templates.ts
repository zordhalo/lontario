/**
 * @fileoverview Email templates for interview notifications
 * 
 * This module contains all email templates used by the platform:
 * - Interview scheduled
 * - Interview reminders (24h and 1h)
 * - Interview completed
 * - Interview rescheduled
 * - Interview cancelled
 * 
 * Each template returns HTML and plain text versions for email clients.
 * 
 * @module lib/email/templates
 */

import { format } from "date-fns";

// ============================================================
// TYPE DEFINITIONS
// ============================================================

/**
 * Data required to populate email templates
 * All templates receive this common data structure
 */
export interface EmailTemplateData {
  /** Candidate's display name */
  candidateName: string;
  /** Job title they're interviewing for */
  jobTitle: string;
  /** Company name (defaults to "Lontario") */
  companyName?: string;
  /** Full URL to access the interview */
  interviewLink: string;
  /** ISO 8601 datetime of scheduled interview */
  scheduledAt: string;
  /** Expected interview duration in minutes */
  durationMinutes: number;
  /** Custom message from recruiter */
  customMessage?: string;
  /** Previous scheduled time (for reschedule emails) */
  oldScheduledAt?: string;
  /** Reason for cancellation (for cancellation emails) */
  cancellationReason?: string;
}

/**
 * Complete email template with subject and body
 */
interface EmailTemplate {
  /** Email subject line */
  subject: string;
  /** HTML version of email body */
  html: string;
  /** Plain text version of email body */
  text: string;
}

// Base styles for emails
const baseStyles = `
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; }
  .container { max-width: 600px; margin: 0 auto; padding: 20px; }
  .header { text-align: center; margin-bottom: 30px; }
  .logo { font-size: 24px; font-weight: bold; color: #6366f1; }
  .content { background: #f9fafb; border-radius: 8px; padding: 24px; margin-bottom: 24px; }
  .button { display: inline-block; background: #6366f1; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500; }
  .button:hover { background: #4f46e5; }
  .details { margin: 20px 0; }
  .details-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
  .details-label { color: #6b7280; }
  .details-value { font-weight: 500; }
  .footer { text-align: center; color: #9ca3af; font-size: 12px; margin-top: 30px; }
  .tips { background: #fef3c7; border-radius: 8px; padding: 16px; margin: 20px 0; }
  .tips-title { font-weight: 600; color: #92400e; margin-bottom: 8px; }
  .tips-list { color: #78350f; font-size: 14px; padding-left: 20px; margin: 0; }
`;

function formatScheduledTime(dateStr: string): string {
  const date = new Date(dateStr);
  return format(date, "EEEE, MMMM d, yyyy 'at' h:mm a");
}

/**
 * Interview Scheduled Template
 */
export function getInterviewScheduledTemplate(data: EmailTemplateData): EmailTemplate {
  const scheduledTime = formatScheduledTime(data.scheduledAt);

  const subject = `Your AI Interview for ${data.jobTitle} is Scheduled`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>${baseStyles}</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">${data.companyName || "Lontario"}</div>
    </div>
    
    <h2 style="text-align: center; color: #111827;">Your Interview is Scheduled!</h2>
    
    <p>Hi ${data.candidateName},</p>
    
    <p>Great news! Your AI interview for the <strong>${data.jobTitle}</strong> position has been scheduled.</p>
    
    ${data.customMessage ? `<div class="content"><p style="margin: 0;">${data.customMessage}</p></div>` : ""}
    
    <div class="content">
      <div class="details">
        <div class="details-row">
          <span class="details-label">Position</span>
          <span class="details-value">${data.jobTitle}</span>
        </div>
        <div class="details-row">
          <span class="details-label">When</span>
          <span class="details-value">${scheduledTime}</span>
        </div>
        <div class="details-row">
          <span class="details-label">Duration</span>
          <span class="details-value">~${data.durationMinutes} minutes</span>
        </div>
      </div>
      
      <div style="text-align: center; margin-top: 24px;">
        <a href="${data.interviewLink}" class="button">Start Interview</a>
      </div>
      <p style="text-align: center; font-size: 12px; color: #6b7280; margin-top: 12px;">
        You can access the interview 5 minutes before the scheduled time.
      </p>
    </div>
    
    <div class="tips">
      <div class="tips-title">Tips for your interview:</div>
      <ul class="tips-list">
        <li>Find a quiet place with stable internet</li>
        <li>Take your time to think through each question</li>
        <li>Provide specific examples when possible</li>
        <li>Your answers are automatically saved</li>
      </ul>
    </div>
    
    <p>If you have any questions, please reply to this email.</p>
    
    <p>Good luck!</p>
    
    <div class="footer">
      <p>This email was sent by ${data.companyName || "Lontario"}</p>
      <p>If you didn't apply for this position, please ignore this email.</p>
    </div>
  </div>
</body>
</html>`;

  const text = `
Your Interview is Scheduled!

Hi ${data.candidateName},

Your AI interview for the ${data.jobTitle} position has been scheduled.

${data.customMessage ? `Message from the recruiter:\n${data.customMessage}\n` : ""}
Details:
- Position: ${data.jobTitle}
- When: ${scheduledTime}
- Duration: ~${data.durationMinutes} minutes

Start your interview here: ${data.interviewLink}

You can access the interview 5 minutes before the scheduled time.

Tips for your interview:
- Find a quiet place with stable internet
- Take your time to think through each question
- Provide specific examples when possible
- Your answers are automatically saved

Good luck!
`;

  return { subject, html, text };
}

/**
 * Interview Reminder Template
 */
export function getInterviewReminderTemplate(
  data: EmailTemplateData,
  hoursUntil: 24 | 1
): EmailTemplate {
  const scheduledTime = formatScheduledTime(data.scheduledAt);
  const timeLabel = hoursUntil === 24 ? "tomorrow" : "in 1 hour";

  const subject =
    hoursUntil === 24
      ? `Reminder: Your AI Interview for ${data.jobTitle} is Tomorrow`
      : `Starting Soon: Your AI Interview for ${data.jobTitle}`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>${baseStyles}</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">${data.companyName || "Lontario"}</div>
    </div>
    
    <h2 style="text-align: center; color: #111827;">Interview Reminder</h2>
    
    <p>Hi ${data.candidateName},</p>
    
    <p>This is a friendly reminder that your AI interview for <strong>${data.jobTitle}</strong> is ${timeLabel}.</p>
    
    <div class="content">
      <div class="details">
        <div class="details-row">
          <span class="details-label">Position</span>
          <span class="details-value">${data.jobTitle}</span>
        </div>
        <div class="details-row">
          <span class="details-label">When</span>
          <span class="details-value">${scheduledTime}</span>
        </div>
        <div class="details-row">
          <span class="details-label">Duration</span>
          <span class="details-value">~${data.durationMinutes} minutes</span>
        </div>
      </div>
      
      <div style="text-align: center; margin-top: 24px;">
        <a href="${data.interviewLink}" class="button">Go to Interview</a>
      </div>
    </div>
    
    ${
      hoursUntil === 24
        ? `
    <div class="tips">
      <div class="tips-title">Get ready:</div>
      <ul class="tips-list">
        <li>Review the job description</li>
        <li>Prepare examples from your experience</li>
        <li>Test your internet connection</li>
      </ul>
    </div>
    `
        : `
    <p style="text-align: center; font-weight: 500; color: #6366f1;">
      You can start your interview now!
    </p>
    `
    }
    
    <div class="footer">
      <p>This email was sent by ${data.companyName || "Lontario"}</p>
    </div>
  </div>
</body>
</html>`;

  const text = `
Interview Reminder

Hi ${data.candidateName},

Your AI interview for ${data.jobTitle} is ${timeLabel}.

Details:
- Position: ${data.jobTitle}
- When: ${scheduledTime}
- Duration: ~${data.durationMinutes} minutes

Go to your interview: ${data.interviewLink}
`;

  return { subject, html, text };
}

/**
 * Interview Completed Template
 */
export function getInterviewCompletedTemplate(data: EmailTemplateData): EmailTemplate {
  const subject = `Thank You for Completing Your Interview - ${data.jobTitle}`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>${baseStyles}</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">${data.companyName || "Lontario"}</div>
    </div>
    
    <h2 style="text-align: center; color: #111827;">Interview Complete!</h2>
    
    <p>Hi ${data.candidateName},</p>
    
    <p>Thank you for completing your AI interview for the <strong>${data.jobTitle}</strong> position.</p>
    
    <div class="content">
      <h3 style="margin-top: 0;">What happens next?</h3>
      <ul style="color: #4b5563;">
        <li>Your responses are being reviewed by our AI system</li>
        <li>The hiring team will evaluate your interview</li>
        <li>We'll be in touch within the next few days</li>
      </ul>
    </div>
    
    <p>If you have any questions in the meantime, feel free to reply to this email.</p>
    
    <p>Thank you for your interest in joining our team!</p>
    
    <div class="footer">
      <p>This email was sent by ${data.companyName || "Lontario"}</p>
    </div>
  </div>
</body>
</html>`;

  const text = `
Interview Complete!

Hi ${data.candidateName},

Thank you for completing your AI interview for the ${data.jobTitle} position.

What happens next?
- Your responses are being reviewed by our AI system
- The hiring team will evaluate your interview
- We'll be in touch within the next few days

Thank you for your interest in joining our team!
`;

  return { subject, html, text };
}

/**
 * Interview Rescheduled Template
 */
export function getInterviewRescheduledTemplate(data: EmailTemplateData): EmailTemplate {
  const newTime = formatScheduledTime(data.scheduledAt);
  const oldTime = data.oldScheduledAt ? formatScheduledTime(data.oldScheduledAt) : null;

  const subject = `Your Interview for ${data.jobTitle} Has Been Rescheduled`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>${baseStyles}</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">${data.companyName || "Lontario"}</div>
    </div>
    
    <h2 style="text-align: center; color: #111827;">Interview Rescheduled</h2>
    
    <p>Hi ${data.candidateName},</p>
    
    <p>Your AI interview for <strong>${data.jobTitle}</strong> has been rescheduled.</p>
    
    <div class="content">
      ${oldTime ? `<p style="color: #6b7280; text-decoration: line-through;">Previously: ${oldTime}</p>` : ""}
      
      <div class="details">
        <div class="details-row">
          <span class="details-label">New Date & Time</span>
          <span class="details-value" style="color: #059669;">${newTime}</span>
        </div>
        <div class="details-row">
          <span class="details-label">Duration</span>
          <span class="details-value">~${data.durationMinutes} minutes</span>
        </div>
      </div>
      
      <div style="text-align: center; margin-top: 24px;">
        <a href="${data.interviewLink}" class="button">View Interview</a>
      </div>
    </div>
    
    <p>We apologize for any inconvenience this may cause.</p>
    
    <div class="footer">
      <p>This email was sent by ${data.companyName || "Lontario"}</p>
    </div>
  </div>
</body>
</html>`;

  const text = `
Interview Rescheduled

Hi ${data.candidateName},

Your AI interview for ${data.jobTitle} has been rescheduled.

${oldTime ? `Previously: ${oldTime}\n` : ""}
New Date & Time: ${newTime}
Duration: ~${data.durationMinutes} minutes

View your interview: ${data.interviewLink}

We apologize for any inconvenience.
`;

  return { subject, html, text };
}

/**
 * Interview Cancelled Template
 */
export function getInterviewCancelledTemplate(data: EmailTemplateData): EmailTemplate {
  const subject = `Your Interview for ${data.jobTitle} Has Been Cancelled`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>${baseStyles}</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">${data.companyName || "Lontario"}</div>
    </div>
    
    <h2 style="text-align: center; color: #111827;">Interview Cancelled</h2>
    
    <p>Hi ${data.candidateName},</p>
    
    <p>We regret to inform you that your AI interview for <strong>${data.jobTitle}</strong> has been cancelled.</p>
    
    ${
      data.cancellationReason
        ? `
    <div class="content">
      <p style="margin: 0;"><strong>Reason:</strong> ${data.cancellationReason}</p>
    </div>
    `
        : ""
    }
    
    <p>If you have any questions or believe this was done in error, please reply to this email.</p>
    
    <p>We appreciate your interest and wish you the best in your job search.</p>
    
    <div class="footer">
      <p>This email was sent by ${data.companyName || "Lontario"}</p>
    </div>
  </div>
</body>
</html>`;

  const text = `
Interview Cancelled

Hi ${data.candidateName},

We regret to inform you that your AI interview for ${data.jobTitle} has been cancelled.

${data.cancellationReason ? `Reason: ${data.cancellationReason}\n` : ""}

If you have any questions, please reply to this email.

We appreciate your interest and wish you the best.
`;

  return { subject, html, text };
}
