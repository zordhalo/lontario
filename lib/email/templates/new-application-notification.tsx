/**
 * @fileoverview Recruiter notification email sent when a candidate applies.
 *
 * Optimized for fast inbox triage:
 * - Candidate name, email, job in the first visible lines
 * - GitHub link rendered as a real anchor
 * - One CTA: "View in dashboard" deep-linking to the job
 *
 * Plain-HTML template (no @react-email dependency). Inline styles, no remote
 * assets.
 *
 * @module lib/email/templates/new-application-notification
 */

import type { RenderedEmail } from "./application-received";

export interface NewApplicationNotificationData {
  fullName: string;
  email: string;
  jobTitle: string;
  jobId: string;
  /** Optional candidate GitHub profile URL. */
  githubUrl?: string | null;
  /** Optional candidate id (for audit / linkability). */
  candidateId?: string;
  /** Public app URL — defaults to https://lontario.lol. */
  appUrl?: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(value: string): string {
  return escapeHtml(value);
}

export function getNewApplicationNotificationTemplate(
  data: NewApplicationNotificationData,
): RenderedEmail {
  const name = escapeHtml(data.fullName);
  const email = escapeHtml(data.email);
  const job = escapeHtml(data.jobTitle);
  const appUrl = (data.appUrl ?? "https://lontario.lol").replace(/\/$/, "");
  const dashboardUrl = `${appUrl}/dashboard/jobs/${encodeURIComponent(data.jobId)}`;

  const subject = `New application from ${data.fullName} — ${data.jobTitle}`;
  const preheader = `${data.fullName} (${data.email}) applied to ${data.jobTitle}.`;

  const githubBlock = data.githubUrl
    ? `<tr>
            <td style="padding:8px 0;font-size:14px;color:#71717a;width:120px;">GitHub</td>
            <td style="padding:8px 0;font-size:14px;color:#18181b;"><a href="${escapeAttr(data.githubUrl)}" style="color:#2563eb;text-decoration:underline;">${escapeHtml(data.githubUrl)}</a></td>
          </tr>`
    : "";

  const candidateBlock = data.candidateId
    ? `<tr>
            <td style="padding:8px 0;font-size:14px;color:#71717a;width:120px;">Candidate ID</td>
            <td style="padding:8px 0;font-size:14px;color:#18181b;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;">${escapeHtml(data.candidateId)}</td>
          </tr>`
    : "";

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
              <div style="font-size:12px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#71717a;">New application</div>
              <h1 style="margin:8px 0 0 0;font-size:22px;line-height:1.3;font-weight:600;color:#18181b;">${name}</h1>
              <p style="margin:4px 0 0 0;font-size:14px;color:#52525b;">applied to <strong style="color:#18181b;">${job}</strong></p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px 8px 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding:8px 0;font-size:14px;color:#71717a;width:120px;">Email</td>
                  <td style="padding:8px 0;font-size:14px;color:#18181b;"><a href="mailto:${escapeAttr(data.email)}" style="color:#2563eb;text-decoration:underline;">${email}</a></td>
                </tr>
                ${githubBlock}
                ${candidateBlock}
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px 32px 32px;">
              <a href="${escapeAttr(dashboardUrl)}" style="display:inline-block;background-color:#18181b;color:#ffffff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">View in dashboard</a>
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

  const textLines = [
    `New application: ${data.fullName} (${data.email}) — ${data.jobTitle}`,
    "",
    `Email:   ${data.email}`,
  ];
  if (data.githubUrl) textLines.push(`GitHub:  ${data.githubUrl}`);
  if (data.candidateId) textLines.push(`Candidate ID: ${data.candidateId}`);
  textLines.push("", `View in dashboard: ${dashboardUrl}`, "", "Sent from lontario.lol", "");

  return { subject, html, text: textLines.join("\n") };
}
