import { button, divider, escapeHtml, renderLayout, type RenderedEmail } from './layout';

export interface InviteEmailInput {
  inviteeFirstName: string;
  inviteeEmail: string;
  companyName: string;
  inviterName: string;
  roleName?: string;
  acceptUrl: string;
  expiresAt: Date;
  brandName?: string;
  appUrl?: string;
}

export function renderInviteEmail(input: InviteEmailInput): RenderedEmail {
  const {
    inviteeFirstName,
    companyName,
    inviterName,
    roleName,
    acceptUrl,
    expiresAt,
    brandName = 'ownit2buildit',
    appUrl,
  } = input;

  const subject = `${inviterName} invited you to join ${companyName} on ${brandName}`;

  const expiresText = expiresAt.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const body = `
    <h1 style="margin:0 0 20px;font-size:24px;font-weight:700;color:#19130F;letter-spacing:-0.02em;">
      You've been invited 🎉
    </h1>

    <p style="margin:0 0 16px;color:#3D2D27;">
      Hi ${escapeHtml(inviteeFirstName)},
    </p>

    <p style="margin:0 0 20px;color:#3D2D27;">
      <strong style="color:#19130F;">${escapeHtml(inviterName)}</strong> has invited you to join
      <strong style="color:#19130F;">${escapeHtml(companyName)}</strong>${roleName ? ` as <strong style="color:#7C3018;">${escapeHtml(roleName)}</strong>` : ''} on ${escapeHtml(brandName)}.
    </p>

    <!-- Invitation card -->
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%"
           style="margin:0 0 24px;background-color:#F7F3F0;border-radius:8px;border:1px solid #DDD6CF;">
      <tr>
        <td style="padding:20px 24px;">
          <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#776560;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">Workspace</p>
          <p style="margin:0 0 12px;font-size:16px;font-weight:700;color:#19130F;">${escapeHtml(companyName)}</p>
          ${roleName ? `
          <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#776560;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">Role</p>
          <p style="margin:0;font-size:15px;font-weight:600;color:#7C3018;">${escapeHtml(roleName)}</p>
          ` : ''}
        </td>
      </tr>
    </table>

    <p style="margin:0 0 4px;color:#3D2D27;">Click the button below to set your password and get started:</p>
    ${button('Accept invitation', acceptUrl)}

    ${divider()}

    <p style="margin:0 0 8px;font-size:13px;color:#776560;">
      ⏱ This invitation expires on <strong style="color:#19130F;">${escapeHtml(expiresText)}</strong>.
    </p>
    <p style="margin:0 0 8px;font-size:13px;color:#776560;">
      If the button doesn't work, paste this link into your browser:<br/>
      <a href="${escapeHtml(acceptUrl)}" style="color:#7C3018;word-break:break-all;">${escapeHtml(acceptUrl)}</a>
    </p>
    <p style="margin:16px 0 0;font-size:13px;color:#9A8E89;">
      If you weren't expecting this invitation, you can safely ignore this email.
    </p>
  `;

  const html = renderLayout({
    preheader: `${inviterName} invited you to join ${companyName} — accept before it expires on ${expiresText}.`,
    title: subject,
    body,
    brandName,
    appUrl,
  });

  const text = [
    `Hi ${inviteeFirstName},`,
    ``,
    `${inviterName} has invited you to join ${companyName}${roleName ? ` as ${roleName}` : ''} on ${brandName}.`,
    ``,
    `Accept the invitation and set your password:`,
    acceptUrl,
    ``,
    `This invitation expires on ${expiresText}.`,
    ``,
    `If you weren't expecting this email, you can safely ignore it.`,
    ``,
    `— The ${brandName} team`,
  ].join('\n');

  return { subject, html, text };
}
