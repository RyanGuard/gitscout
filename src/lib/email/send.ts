/**
 * Resend email sending utility for outreach sequences.
 * Uses the REST API directly (matching the pattern in auth.ts).
 */

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}

interface SendEmailResult {
  id: string;
}

export async function sendOutreachEmail({
  to,
  subject,
  html,
  replyTo,
}: SendEmailParams): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not configured");
  }

  const from =
    process.env.OUTREACH_FROM ||
    process.env.EMAIL_FROM ||
    "Scout <onboarding@resend.dev>";

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      subject,
      html,
      ...(replyTo ? { reply_to: replyTo } : {}),
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(`Resend error: ${JSON.stringify(data)}`);
  }

  return data as SendEmailResult;
}

/**
 * Wrap outreach message body in a clean HTML email template.
 */
export function wrapInEmailTemplate(body: string): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;font-family:'Instrument Sans',system-ui,sans-serif;color:#1c1c1a;background:#f5f5f3">
  <div style="max-width:580px;margin:0 auto;padding:32px 20px">
    ${body.split("\n").map((line) => `<p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#333">${line}</p>`).join("")}
  </div>
</body>
</html>`.trim();
}
