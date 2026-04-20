/**
 * Shared HTML email layout. All templates render their `body` inside this wrapper.
 * Uses inline styles so webmail clients (Gmail, Outlook, Apple Mail) render consistently.
 */
export interface LayoutOptions {
  preheader?: string;
  title: string;
  body: string;
  brandName?: string;
  appUrl?: string;
}

export function renderLayout({
  preheader = '',
  title,
  body,
  brandName = 'BuilderPro',
  appUrl = 'https://builderpro.app',
}: LayoutOptions): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1.0" />
<title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#111827;">
<span style="display:none !important;opacity:0;color:transparent;height:0;width:0;overflow:hidden;">${escapeHtml(preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f6;">
  <tr>
    <td align="center" style="padding:32px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
        <!-- Header -->
        <tr>
          <td style="padding:24px 32px;background-color:#1f2937;color:#f9fafb;">
            <a href="${escapeAttr(appUrl)}" style="color:#f9fafb;text-decoration:none;font-size:18px;font-weight:700;letter-spacing:-0.01em;">
              ${escapeHtml(brandName)}
            </a>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:32px;font-size:15px;line-height:1.55;color:#111827;">
            ${body}
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding:20px 32px;background-color:#f9fafb;border-top:1px solid #e5e7eb;font-size:12px;color:#6b7280;text-align:center;">
            &copy; ${new Date().getFullYear()} ${escapeHtml(brandName)}. All rights reserved.<br/>
            You received this email because an account was created or updated for your address.
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

export function button(label: string, href: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;">
    <tr>
      <td style="background:#111827;border-radius:8px;">
        <a href="${escapeAttr(href)}"
           style="display:inline-block;padding:12px 22px;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;border-radius:8px;">
          ${escapeHtml(label)}
        </a>
      </td>
    </tr>
  </table>`;
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function escapeAttr(s: string): string {
  return escapeHtml(s);
}
