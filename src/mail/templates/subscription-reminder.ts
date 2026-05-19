import { renderLayout, button, type RenderedEmail } from './layout';

export interface SubscriptionReminderEmailInput {
  firstName: string;
  companyName: string;
  /** 'trial_ending' | 'trial_expired' | 'subscription_ending' | 'subscription_expired' */
  eventType: 'trial_ending' | 'trial_expired' | 'subscription_ending' | 'subscription_expired';
  daysLeft?: number;    // days until expiry (for *_ending events)
  daysAgo?: number;     // days since expiry (for *_expired events)
  planName?: string;
  upgradeUrl: string;
  brandName?: string;
  appUrl?: string;
}

export function renderSubscriptionReminderEmail(input: SubscriptionReminderEmailInput): RenderedEmail {
  const brand = input.brandName ?? 'ownit2buildit';
  const { firstName, companyName, eventType, daysLeft, daysAgo, planName, upgradeUrl } = input;

  const isExpired = eventType === 'trial_expired' || eventType === 'subscription_expired';
  const isTrial = eventType === 'trial_ending' || eventType === 'trial_expired';

  // Subject & preheader
  let subject: string;
  let preheader: string;

  if (eventType === 'trial_ending') {
    subject = `Your free trial ends in ${daysLeft} day${daysLeft === 1 ? '' : 's'} — ${brand}`;
    preheader = `Don't lose access. Upgrade ${companyName} to keep managing projects seamlessly.`;
  } else if (eventType === 'trial_expired') {
    subject = `Your free trial has expired — ${brand}`;
    preheader = `Reactivate ${companyName} to regain full access to all features.`;
  } else if (eventType === 'subscription_ending') {
    subject = `Your subscription renews in ${daysLeft} day${daysLeft === 1 ? '' : 's'} — ${brand}`;
    preheader = `Your ${planName ?? 'subscription'} for ${companyName} is coming up for renewal.`;
  } else {
    subject = `Your subscription has expired — action required`;
    preheader = `Your access to ${companyName} on ${brand} has been suspended. Renew now to restore it.`;
  }

  // Banner colour
  const bannerBg = isExpired ? '#7C3018' : '#2E6B3E'; // red-brown for expired, green for reminder
  const bannerLabel = isExpired ? (isTrial ? 'Trial Expired' : 'Subscription Expired') : (isTrial ? 'Trial Ending Soon' : 'Renewal Reminder');

  // Body text
  let bodyHtml = '';

  if (eventType === 'trial_ending') {
    bodyHtml = `
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#19130F;">
        Hi ${firstName},
      </p>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#19130F;">
        Your free trial for <strong>${companyName}</strong> ends in
        <strong>${daysLeft} day${daysLeft === 1 ? '' : 's'}</strong>.
        After that, access to your projects, quotes, invoices and team management will be paused.
      </p>
      <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#19130F;">
        Upgrade now to keep everything running without interruption.
      </p>
    `;
  } else if (eventType === 'trial_expired') {
    bodyHtml = `
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#19130F;">
        Hi ${firstName},
      </p>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#19130F;">
        Your free trial for <strong>${companyName}</strong> has expired.
        Your account data is safe — activate a plan to restore access immediately.
      </p>
      <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#19130F;">
        Choose a plan that fits your operation — from sole traders to large construction companies.
      </p>
    `;
  } else if (eventType === 'subscription_ending') {
    bodyHtml = `
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#19130F;">
        Hi ${firstName},
      </p>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#19130F;">
        Your <strong>${planName ?? 'subscription'}</strong> for <strong>${companyName}</strong>
        will expire in <strong>${daysLeft} day${daysLeft === 1 ? '' : 's'}</strong>.
        Please ensure your payment is up to date to avoid any disruption to your team.
      </p>
      <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#19130F;">
        Visit your billing page to review your plan or renew early.
      </p>
    `;
  } else {
    bodyHtml = `
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#19130F;">
        Hi ${firstName},
      </p>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#19130F;">
        Your <strong>${planName ?? 'subscription'}</strong> for <strong>${companyName}</strong>
        expired ${daysAgo === 1 ? 'yesterday' : `${daysAgo} days ago`}.
        Access to your account has been paused — your data remains intact and will be
        restored as soon as you renew.
      </p>
      <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#19130F;">
        Renew now to get your team back on track.
      </p>
    `;
  }

  const body = `
    <!-- Status banner -->
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:28px;">
      <tr>
        <td style="background:${bannerBg};border-radius:6px;padding:12px 20px;text-align:center;">
          <span style="color:#ffffff;font-weight:700;font-size:13px;letter-spacing:0.5px;text-transform:uppercase;">
            ${bannerLabel}
          </span>
        </td>
      </tr>
    </table>

    ${bodyHtml}

    <!-- CTA -->
    ${button(isExpired ? 'Reactivate My Account' : 'Upgrade My Plan', upgradeUrl)}

    <!-- Reassurance -->
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-top:28px;">
      <tr>
        <td style="background:#F7F3F0;border:1px solid #DDD6CF;border-radius:6px;padding:16px 20px;">
          <p style="margin:0;font-size:13px;line-height:1.6;color:#776560;">
            <strong>Your data is safe.</strong>
            All your projects, documents, and financial records are preserved.
            They will be fully accessible as soon as you${isExpired ? ' renew' : ' upgrade'}.
          </p>
        </td>
      </tr>
    </table>
  `;

  const html = renderLayout({
    preheader,
    title: subject,
    body,
    brandName: brand,
    appUrl: input.appUrl,
  });

  // Plain text
  const textLines: string[] = [
    subject,
    '',
    `Hi ${firstName},`,
    '',
  ];

  if (eventType === 'trial_ending') {
    textLines.push(`Your free trial for ${companyName} ends in ${daysLeft} day${daysLeft === 1 ? '' : 's'}.`);
    textLines.push('Upgrade now to keep your projects running without interruption.');
  } else if (eventType === 'trial_expired') {
    textLines.push(`Your free trial for ${companyName} has expired.`);
    textLines.push('Activate a plan to restore access — your data is safe.');
  } else if (eventType === 'subscription_ending') {
    textLines.push(`Your ${planName ?? 'subscription'} for ${companyName} expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}.`);
    textLines.push('Please renew to avoid disruption.');
  } else {
    textLines.push(`Your subscription for ${companyName} has expired.`);
    textLines.push('Renew now to restore access — your data is intact.');
  }

  textLines.push('', `Upgrade / Renew: ${upgradeUrl}`, '');
  textLines.push('Questions? Reply to this email — we\'re happy to help.', '');
  textLines.push(`— The ${brand} Team`);

  return { subject, html, text: textLines.join('\n') };
}
