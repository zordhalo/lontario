/**
 * @fileoverview Waitlist signup confirmation email.
 *
 * One sentence. No fluff. The landing page is the joke; this is the receipt.
 *
 * @module lib/email/templates/waitlist-confirmation
 */

import type { RenderedEmail } from "./application-received";

export function getWaitlistConfirmationTemplate(): RenderedEmail {
  const subject = "You're on the Lontario waitlist";
  const preheader =
    "Thanks for signing up — I'll email you when there's something to share.";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light dark" />
  <meta name="supported-color-schemes" content="light dark" />
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background-color:#fafafa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;color:#18181b;">
  <span style="display:none!important;visibility:hidden;mso-hide:all;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${preheader}</span>
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
            <td style="padding:8px 32px 32px 32px;">
              <h1 style="margin:0 0 16px 0;font-size:22px;line-height:1.3;font-weight:600;color:#18181b;">You're on the list.</h1>
              <p style="margin:0 0 16px 0;font-size:16px;line-height:1.6;color:#27272a;">Thanks for signing up — I'll email you when there's something to share.</p>
              <p style="margin:24px 0 0 0;font-size:16px;line-height:1.6;color:#27272a;">— The Lontario team</p>
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

  const text = `You're on the list.

Thanks for signing up — I'll email you when there's something to share.

— The Lontario team

Sent from lontario.lol
`;

  return { subject, html, text };
}
