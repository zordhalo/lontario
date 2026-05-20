/**
 * @fileoverview "Application received" confirmation email to the candidate.
 *
 * Plain-HTML template (no @react-email dependency installed). Returns both
 * an HTML and plain-text version so Resend can serve the right body per
 * client. Inline styles only — most email clients strip <style> blocks or
 * external CSS.
 *
 * Design constraints:
 * - max-width 600px, single column, responsive
 * - Light/dark friendly palette (off-white #fafafa background, near-black
 *   #18181b text)
 * - Preheader (hidden first line previewed in inbox)
 * - No remote assets — Lontario wordmark is text only
 *
 * Voice: transactional, warm, no jokes about the application.
 *
 * @module lib/email/templates/application-received
 */

export interface ApplicationReceivedData {
  /** Candidate's full name as they typed it on the form. */
  fullName: string;
  /** Job title they applied to. */
  jobTitle: string;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function getApplicationReceivedTemplate(
  data: ApplicationReceivedData,
): RenderedEmail {
  const name = escapeHtml(data.fullName);
  const job = escapeHtml(data.jobTitle);

  const subject = `We got your application — ${data.jobTitle}`;
  const preheader = `Thanks ${data.fullName} — your application for ${data.jobTitle} is in.`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light dark" />
  <meta name="supported-color-schemes" content="light dark" />
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#fafafa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;color:#18181b;">
  <span style="display:none!important;visibility:hidden;mso-hide:all;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${escapeHtml(preheader)}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#fafafa;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background-color:#ffffff;border:1px solid #e4e4e7;border-radius:12px;">
          <tr>
            <td style="padding:32px 32px 8px 32px;">
              <div style="font-size:20px;font-weight:700;letter-spacing:-0.01em;color:#18181b;">Lontario</div>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 32px 24px 32px;">
              <h1 style="margin:0 0 16px 0;font-size:22px;line-height:1.3;font-weight:600;color:#18181b;">Your application is in.</h1>
              <p style="margin:0 0 16px 0;font-size:16px;line-height:1.6;color:#27272a;">Hi ${name},</p>
              <p style="margin:0 0 16px 0;font-size:16px;line-height:1.6;color:#27272a;">Thanks for applying to <strong style="color:#18181b;">${job}</strong>. I read every application personally — you should hear back within about 7 days, whether it's a yes, a no, or a follow-up question.</p>
              <p style="margin:0 0 16px 0;font-size:16px;line-height:1.6;color:#27272a;">If you forgot to send something or want to add context, just reply to this email.</p>
              <p style="margin:24px 0 0 0;font-size:16px;line-height:1.6;color:#27272a;">— Brian @ Lontario</p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 32px 32px;">
              <hr style="border:none;border-top:1px solid #e4e4e7;margin:0 0 16px 0;" />
              <p style="margin:0;font-size:12px;line-height:1.5;color:#71717a;">Sent from lontario.lol</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = `Your application is in.

Hi ${data.fullName},

Thanks for applying to ${data.jobTitle}. I read every application personally — you should hear back within about 7 days, whether it's a yes, a no, or a follow-up question.

If you forgot to send something or want to add context, just reply to this email.

— Brian @ Lontario

Sent from lontario.lol
`;

  return { subject, html, text };
}
