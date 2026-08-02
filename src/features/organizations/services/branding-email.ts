import type { OrganizationBranding } from "../types";
import { readableOn } from "./branding-theme";

export type BrandedEmail = {
  /** Display name for the From header, e.g. `Acme Academy`. */
  fromName: string;
  /** Reply-to address, when the tenant configured its own support identity. */
  replyTo: string | null;
  subject: string;
  html: string;
  text: string;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Wraps a plain-text notification body in the tenant's email branding and
 * returns matching HTML and plain-text parts plus the sender identity.
 *
 * Branding is applied per organisation only — platform notifications that pass
 * `null` keep the default AskMeExam identity untouched.
 */
export function buildBrandedEmail(
  branding: OrganizationBranding | null,
  subject: string,
  body: string,
): BrandedEmail {
  const appName = branding?.app_name?.trim() || "AskMeExam";
  const fromName = branding?.email_from_name?.trim() || appName;
  const headerColor = branding?.email_header_color || "#1e3a5f";
  const headerText = readableOn(headerColor);
  const footer =
    branding?.email_footer_text?.trim() ||
    `${appName} is an independent practice platform and is not affiliated with Microsoft.`;
  const support = branding?.support_email?.trim() || null;
  const logo = branding?.logo_url?.trim() || null;

  const paragraphs = body
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8" /><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background-color:#ffffff;font-family:Arial,Helvetica,sans-serif;color:#111a2b;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#ffffff;">
    <tr><td align="center" style="padding:24px 12px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;border:1px solid #e2e6ee;border-radius:8px;overflow:hidden;">
        <tr><td style="background-color:${headerColor};padding:20px 24px;color:${headerText};font-size:18px;font-weight:bold;">
          ${logo ? `<img src="${escapeHtml(logo)}" alt="${escapeHtml(appName)}" height="32" style="height:32px;display:block;border:0;" />` : escapeHtml(appName)}
        </td></tr>
        <tr><td style="padding:24px;font-size:15px;line-height:1.6;">
          <h1 style="margin:0 0 16px;font-size:18px;">${escapeHtml(subject)}</h1>
          ${paragraphs.map((p) => `<p style="margin:0 0 14px;">${escapeHtml(p).replace(/\n/g, "<br />")}</p>`).join("")}
          ${support ? `<p style="margin:16px 0 0;font-size:13px;color:#5a6779;">Need help? Contact <a href="mailto:${escapeHtml(support)}" style="color:${headerColor};">${escapeHtml(support)}</a>.</p>` : ""}
        </td></tr>
        <tr><td style="padding:16px 24px;background-color:#f4f6f9;font-size:12px;color:#5a6779;">${escapeHtml(footer)}</td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  const text = [
    appName,
    "",
    subject,
    "",
    paragraphs.join("\n\n"),
    support ? `\nNeed help? Contact ${support}.` : "",
    "",
    footer,
  ]
    .filter((line) => line !== null)
    .join("\n")
    .trim();

  return {
    fromName,
    replyTo: branding?.email_reply_to?.trim() || support,
    subject,
    html,
    text,
  };
}