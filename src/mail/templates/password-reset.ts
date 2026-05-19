import { divider, escapeHtml, renderLayout, type RenderedEmail } from './layout';

export interface PasswordResetEmailInput {
  firstName: string;
  otp: string;
  brandName?: string;
  appUrl?: string;
}

export function renderPasswordResetEmail(input: PasswordResetEmailInput): RenderedEmail {
  const { firstName, otp, brandName = 'ownit2buildit', appUrl } = input;
  const subject = `Your password reset code — ${brandName}`;

  const body = `
    <h1 style="margin:0 0 20px;font-size:24px;font-weight:700;color:#19130F;letter-spacing:-0.02em;">
      Reset your password
    </h1>

    <p style="margin:0 0 16px;color:#3D2D27;">
      Hi ${escapeHtml(firstName)},
    </p>
    <p style="margin:0 0 24px;color:#3D2D27;">
      We received a request to reset the password for your ${escapeHtml(brandName)} account.
      Use the verification code below — it expires in <strong>15 minutes</strong>.
    </p>

    <!-- OTP box -->
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 24px;">
      <tr>
        <td align="center">
          <table role="presentation" cellpadding="0" cellspacing="0">
            <tr>
              <td style="background-color:#F7F3F0;border:2px solid #DDD6CF;border-radius:10px;padding:20px 40px;text-align:center;">
                <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#776560;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">Verification code</p>
                <p style="margin:0;font-size:36px;font-weight:700;letter-spacing:0.18em;color:#19130F;font-family:'Courier New',monospace;">${escapeHtml(otp)}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    ${divider()}

    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 8px;">
      <tr>
        <td style="width:20px;vertical-align:top;padding-top:3px;font-size:14px;">⚠️</td>
        <td style="padding-left:8px;font-size:13px;color:#776560;">
          <strong style="color:#19130F;">Never share this code</strong> with anyone.
          ${escapeHtml(brandName)} staff will never ask for your verification code.
        </td>
      </tr>
    </table>

    <p style="margin:0;font-size:13px;color:#9A8E89;">
      If you didn't request a password reset, you can safely ignore this email. Your password will not change.
    </p>
  `;

  const html = renderLayout({
    preheader: `Your ${brandName} password reset code — expires in 15 minutes.`,
    title: subject,
    body,
    brandName,
    appUrl,
  });

  const text = [
    `Hi ${firstName},`,
    ``,
    `We received a request to reset your ${brandName} password.`,
    ``,
    `Your verification code: ${otp}`,
    ``,
    `This code expires in 15 minutes.`,
    ``,
    `IMPORTANT: Never share this code with anyone. ${brandName} staff will never ask for it.`,
    ``,
    `If you didn't request a reset, you can safely ignore this email.`,
    ``,
    `— The ${brandName} team`,
  ].join('\n');

  return { subject, html, text };
}
