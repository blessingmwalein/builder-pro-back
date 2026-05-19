/**
 * Shared HTML email layout — all templates render their body inside this shell.
 * Uses inline styles + MSO conditionals so Gmail, Outlook, and Apple Mail all
 * render consistently. Colour palette mirrors the app's warm-gray design tokens.
 *
 * Brand palette (inline hex equivalents of CSS custom props):
 *   --header-bg  #2E2118  (sidebar / dark panel)
 *   --primary    #7C3018  (terracotta CTA)
 *   --bg         #F1EDE9  (warm light-gray canvas)
 *   --card       #FFFFFF  (white surface)
 *   --border     #DDD6CF  (warm visible border)
 *   --text       #19130F  (near-black warm)
 *   --muted      #776560  (warm gray secondary text)
 */

export interface LayoutOptions {
  preheader?: string;
  title: string;
  body: string;
  brandName?: string;
  appUrl?: string;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export function renderLayout({
  preheader = '',
  title,
  body,
  brandName = 'ownit2buildit',
  appUrl = 'https://builderpro.app',
}: LayoutOptions): string {
  const year = new Date().getFullYear();
  return `<!DOCTYPE html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<meta http-equiv="X-UA-Compatible" content="IE=edge"/>
<meta name="x-apple-disable-message-reformatting"/>
<title>${escapeHtml(title)}</title>
<!--[if mso]>
<noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
<![endif]-->
<style>
  @media only screen and (max-width:600px){
    .email-body-cell{padding:24px 20px !important;}
    .email-header{padding:20px !important;}
  }
</style>
</head>
<body style="margin:0;padding:0;word-spacing:normal;background-color:#F1EDE9;">

<!-- Preheader (hidden) -->
<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">
  ${escapeHtml(preheader)}
</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F1EDE9;">
  <tr>
    <td align="center" style="padding:40px 16px;">
      <!--[if mso]><table role="presentation" align="center" style="width:600px;"><tr><td><![endif]-->
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:600px;">

        <!-- ── HEADER ─────────────────────────────────── -->
        <tr>
          <td class="email-header" style="background-color:#2E2118;border-radius:12px 12px 0 0;padding:24px 32px;">
            <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
              <tr>
                <td>
                  <!-- Logo pill -->
                  <table role="presentation" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="background-color:#7C3018;border-radius:8px;width:38px;height:38px;text-align:center;vertical-align:middle;mso-line-height-rule:exactly;">
                        <a href="${escapeAttr(appUrl)}" style="display:block;width:38px;height:38px;line-height:38px;color:#FFFFFF;font-size:12px;font-weight:700;text-align:center;text-decoration:none;font-family:Arial,sans-serif;">O2B</a>
                      </td>
                      <td style="padding-left:10px;vertical-align:middle;">
                        <a href="${escapeAttr(appUrl)}" style="color:#FFFFFF;font-size:17px;font-weight:700;letter-spacing:-0.02em;text-decoration:none;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">${escapeHtml(brandName)}</a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- ── BODY ──────────────────────────────────── -->
        <tr>
          <td class="email-body-cell" style="background-color:#FFFFFF;padding:40px 32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:15px;line-height:1.65;color:#19130F;">
            ${body}
          </td>
        </tr>

        <!-- ── FOOTER ─────────────────────────────────── -->
        <tr>
          <td style="background-color:#F7F3F0;border-top:1px solid #DDD6CF;border-radius:0 0 12px 12px;padding:20px 32px;text-align:center;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:12px;line-height:1.6;color:#776560;">
            <p style="margin:0 0 6px;">
              &copy; ${year} ${escapeHtml(brandName)} &mdash; Built for construction professionals.
            </p>
            <p style="margin:0;color:#9A8E89;">
              You received this email because you have an active account or a pending invitation.
            </p>
          </td>
        </tr>

      </table>
      <!--[if mso]></td></tr></table><![endif]-->
    </td>
  </tr>
</table>
</body>
</html>`;
}

// ── Button helper ──────────────────────────────────────────────────────────────

export function button(label: string, href: string, secondary = false): string {
  const bg = secondary ? '#4A3630' : '#7C3018';
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;">
  <tr>
    <td style="border-radius:8px;background-color:${bg};mso-padding-alt:0;">
      <!--[if mso]><a href="${escapeAttr(href)}" style="display:inline-block;padding:13px 26px;color:#FFFFFF;font-size:14px;font-weight:600;text-decoration:none;border-radius:8px;font-family:Arial,sans-serif;">${escapeHtml(label)}</a><![endif]-->
      <!--[if !mso]><!-->
      <a href="${escapeAttr(href)}"
         style="display:inline-block;padding:13px 26px;color:#FFFFFF;font-size:14px;font-weight:600;text-decoration:none;border-radius:8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;background-color:${bg};">
        ${escapeHtml(label)}
      </a>
      <!--<![endif]-->
    </td>
  </tr>
</table>`;
}

// ── Divider helper ─────────────────────────────────────────────────────────────

export function divider(): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:24px 0;">
  <tr><td style="border-top:1px solid #DDD6CF;font-size:0;line-height:0;">&nbsp;</td></tr>
</table>`;
}

// ── Key/value row helper (for financial summaries) ─────────────────────────────

export function summaryRow(label: string, value: string, bold = false, borderTop = false): string {
  const weight = bold ? '700' : '400';
  const color = bold ? '#19130F' : '#776560';
  const borderStyle = borderTop ? 'border-top:2px solid #DDD6CF;padding-top:10px;' : '';
  return `<tr>
  <td style="padding:5px 0;font-size:14px;color:${color};font-weight:${weight};${borderStyle}font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">${escapeHtml(label)}</td>
  <td style="padding:5px 0;font-size:14px;color:${color};font-weight:${weight};text-align:right;${borderStyle}font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">${escapeHtml(value)}</td>
</tr>`;
}

// ── Utility ────────────────────────────────────────────────────────────────────

export function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function escapeAttr(s: string): string {
  return escapeHtml(s);
}
