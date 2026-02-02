const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Generates HTML email template for waitlist confirmation
 * Uses UPNEXT brand colors: #BFFF00 (primary), #050505 (background), #121212 (surface)
 * @param {Object} params
 * @param {string} params.name - User's full name
 * @returns {string} HTML email body
 */
function waitlistEmailHtml({ name }) {
  const firstName = name?.split(' ')[0] || 'there';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>You're on the UPNEXT waitlist</title>
</head>
<body style="margin:0;padding:0;background:#050505;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <div style="background:#050505;padding:32px;min-height:100vh;">
    <div style="max-width:520px;margin:0 auto;background:#121212;border-radius:16px;padding:24px;box-shadow:0 4px 6px rgba(0,0,0,0.1);">
      <h1 style="margin:0 0 12px;font-size:24px;font-weight:900;letter-spacing:0.08em;color:#BFFF00;text-transform:uppercase;">
        UPNEXT
      </h1>
      <p style="margin:0 0 16px;font-size:16px;color:#f5f5f5;font-weight:500;">
        Hey ${firstName},
      </p>
      <p style="margin:0 0 12px;line-height:1.6;font-size:14px;color:#e5e5e5;">
        You're officially on the UPNEXT waitlist. Applications for the next cohort
        aren't open just yet, but you're early — and that matters.
      </p>
      <p style="margin:0 0 12px;line-height:1.6;font-size:14px;color:#e5e5e5;">
        We'll email you as soon as spots open up, with details on how to apply,
        what the cohort looks like, and how we'll help you dominate LinkedIn.
      </p>
      <p style="margin:0 0 20px;line-height:1.6;font-size:14px;color:#a3a3a3;">
        In the meantime, keep building in public, sharing your work, and showing up.
        When applications open, you'll be the first to know.
      </p>
      <p style="margin:0;font-size:13px;color:#737373;font-style:italic;">
        — The UPNEXT team
      </p>
    </div>
    <p style="margin:16px auto 0;max-width:520px;font-size:11px;color:#6b7280;text-align:center;">
      You're receiving this because you joined the UPNEXT waitlist on our site.
    </p>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Sends waitlist confirmation email via Resend
 * @param {Object} params
 * @param {string} params.name - User's full name
 * @param {string} params.email - User's email address
 * @param {string} [params.linkedin] - User's LinkedIn URL (optional)
 * @param {boolean} [params.subscribe] - Whether user subscribed to updates (optional)
 * @throws {Error} If email sending fails or env vars are missing
 */
async function sendWaitlistConfirmationEmail({ name, email, linkedin, subscribe }) {
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) {
    console.error('Resend environment variables missing: RESEND_API_KEY or RESEND_FROM_EMAIL');
    throw new Error('EMAIL_CONFIG_MISSING');
  }

  const html = waitlistEmailHtml({ name });

  const { data, error } = await resend.emails.send({
    from: `UPNEXT <${process.env.RESEND_FROM_EMAIL}>`,
    to: email,
    subject: "You're on the UPNEXT waitlist",
    html,
  });

  if (error) {
    console.error('Error sending waitlist email:', error);
    throw new Error('EMAIL_SEND_FAILED');
  }

  console.log('Waitlist confirmation email sent successfully:', data?.id);
  return data;
}

module.exports = {
  waitlistEmailHtml,
  sendWaitlistConfirmationEmail,
};
