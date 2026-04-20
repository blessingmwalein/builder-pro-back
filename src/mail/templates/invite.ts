import { button, escapeHtml, renderLayout } from './layout';
import { RenderedEmail } from './welcome';

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
    brandName,
    appUrl,
  } = input;

  const subject = `${inviterName} invited you to join ${companyName} on ${brandName ?? 'BuilderPro'}`;

  const expiresText = expiresAt.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const body = `
    <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;">You&rsquo;ve been invited 🎉</h1>
    <p style="margin:0 0 16px;">
      Hi ${escapeHtml(inviteeFirstName)},
    </p>
    <p style="margin:0 0 16px;">
      <strong>${escapeHtml(inviterName)}</strong> has invited you to join
      <strong>${escapeHtml(companyName)}</strong>${roleName ? ` as <strong>${escapeHtml(roleName)}</strong>` : ''}.
    </p>
    <p style="margin:0 0 8px;">Click the button below to set your password and get started:</p>
    ${button('Accept invitation', acceptUrl)}
    <p style="margin:16px 0 0;color:#6b7280;font-size:13px;">
      This invitation expires on <strong>${escapeHtml(expiresText)}</strong>.
      If the button doesn&rsquo;t work, paste this link into your browser:<br/>
      <a href="${escapeHtml(acceptUrl)}" style="color:#2563eb;word-break:break-all;">${escapeHtml(acceptUrl)}</a>
    </p>
    <p style="margin:16px 0 0;color:#6b7280;font-size:13px;">
      If you weren&rsquo;t expecting this email, you can safely ignore it.
    </p>
  `;

  const html = renderLayout({
    preheader: `${inviterName} invited you to join ${companyName} — accept before it expires.`,
    title: subject,
    body,
    brandName,
    appUrl,
  });

  const text = [
    `Hi ${inviteeFirstName},`,
    ``,
    `${inviterName} has invited you to join ${companyName}${roleName ? ` as ${roleName}` : ''}.`,
    ``,
    `Accept the invitation and set your password:`,
    acceptUrl,
    ``,
    `This invitation expires on ${expiresText}.`,
    ``,
    `If you weren't expecting this email, you can safely ignore it.`,
  ].join('\n');

  return { subject, html, text };
}
