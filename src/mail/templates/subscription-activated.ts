import { button, divider, escapeHtml, renderLayout, type RenderedEmail } from './layout';

export interface SubscriptionActivatedEmailInput {
  firstName: string;
  companyName: string;
  planName: string;
  billingCycle: 'MONTHLY' | 'ANNUAL';
  periodTo: Date;
  dashboardUrl: string;
  brandName?: string;
  appUrl?: string;
}

export function renderSubscriptionActivatedEmail(input: SubscriptionActivatedEmailInput): RenderedEmail {
  const {
    firstName,
    companyName,
    planName,
    billingCycle,
    periodTo,
    dashboardUrl,
    brandName = 'ownit2buildit',
    appUrl,
  } = input;

  const subject = `Your ${planName} plan is now active — welcome to ${brandName}!`;

  const renewalDate = periodTo.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const cycleLabel = billingCycle === 'ANNUAL' ? 'annually' : 'monthly';

  const body = `
    <h1 style="margin:0 0 20px;font-size:24px;font-weight:700;color:#19130F;letter-spacing:-0.02em;">
      Your subscription is active, ${escapeHtml(firstName)}!
    </h1>

    <p style="margin:0 0 16px;color:#3D2D27;">
      Payment received. The <strong style="color:#7C3018;">${escapeHtml(planName)}</strong> plan for
      <strong style="color:#19130F;">${escapeHtml(companyName)}</strong> is now fully active.
      Your team has complete access to ${brandName}.
    </p>

    <table role="presentation" cellpadding="0" cellspacing="0" width="100%"
      style="margin:0 0 24px;border:1px solid #DDD6CF;border-radius:8px;overflow:hidden;">
      <tr>
        <td style="padding:16px 20px;background:#F1EDE9;">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td style="padding:6px 0;width:50%;">
                <span style="font-size:12px;color:#776560;text-transform:uppercase;letter-spacing:.06em;">Plan</span><br/>
                <span style="font-size:15px;font-weight:600;color:#19130F;">${escapeHtml(planName)}</span>
              </td>
              <td style="padding:6px 0;width:50%;">
                <span style="font-size:12px;color:#776560;text-transform:uppercase;letter-spacing:.06em;">Billing</span><br/>
                <span style="font-size:15px;font-weight:600;color:#19130F;">${cycleLabel.charAt(0).toUpperCase() + cycleLabel.slice(1)}</span>
              </td>
            </tr>
            <tr>
              <td style="padding:6px 0;" colspan="2">
                <span style="font-size:12px;color:#776560;text-transform:uppercase;letter-spacing:.06em;">Next renewal</span><br/>
                <span style="font-size:15px;font-weight:600;color:#19130F;">${renewalDate}</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    ${button('Go to your dashboard', dashboardUrl)}

    ${divider()}

    <p style="margin:0;font-size:13px;color:#776560;">
      Need help getting your team set up? Reply to this email — we're happy to assist.<br/>
      Thank you for choosing ${brandName}.
    </p>
  `;

  const html = renderLayout({
    preheader: `Your ${planName} plan is active — full access unlocked for ${companyName}.`,
    title: subject,
    body,
    brandName,
    appUrl,
  });

  const text = [
    `Your subscription is active, ${firstName}!`,
    ``,
    `Payment received. The ${planName} plan for ${companyName} is now fully active.`,
    ``,
    `Plan:         ${planName}`,
    `Billing:      ${cycleLabel}`,
    `Next renewal: ${renewalDate}`,
    ``,
    `Open your dashboard: ${dashboardUrl}`,
    ``,
    `Need help? Just reply to this email.`,
    ``,
    `— The ${brandName} team`,
  ].join('\n');

  return { subject, html, text };
}
