import { button, escapeHtml, renderLayout } from './layout';

export interface WelcomeEmailInput {
  firstName: string;
  companyName: string;
  trialDays: number;
  dashboardUrl: string;
  brandName?: string;
  appUrl?: string;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export function renderWelcomeEmail(input: WelcomeEmailInput): RenderedEmail {
  const { firstName, companyName, trialDays, dashboardUrl, brandName, appUrl } = input;
  const subject = `Welcome to ${brandName ?? 'BuilderPro'}, ${firstName}!`;

  const body = `
    <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;">Welcome aboard, ${escapeHtml(firstName)}! 👷</h1>
    <p style="margin:0 0 16px;">
      Your <strong>${escapeHtml(companyName)}</strong> workspace is ready. You&rsquo;ve been set up with a
      <strong>${trialDays}-day free trial</strong> &mdash; no credit card required.
    </p>
    <p style="margin:0 0 8px;">Here&rsquo;s what you can do first:</p>
    <ul style="margin:0 0 16px;padding-left:20px;color:#374151;">
      <li>Add your first client in the CRM.</li>
      <li>Invite teammates and assign roles.</li>
      <li>Create a project and set up its budget.</li>
      <li>Send your first professional quote.</li>
    </ul>
    ${button('Open your dashboard', dashboardUrl)}
    <p style="margin:16px 0 0;color:#6b7280;font-size:13px;">
      Any questions, just reply to this email and a real person will help.
    </p>
  `;

  const html = renderLayout({
    preheader: `Your ${trialDays}-day trial has started — here's how to get the most out of it.`,
    title: subject,
    body,
    brandName,
    appUrl,
  });

  const text = [
    `Welcome aboard, ${firstName}!`,
    ``,
    `Your ${companyName} workspace is ready. You've been set up with a ${trialDays}-day free trial — no credit card required.`,
    ``,
    `Get started:`,
    `- Add your first client in the CRM`,
    `- Invite teammates and assign roles`,
    `- Create a project and set up its budget`,
    `- Send your first professional quote`,
    ``,
    `Open your dashboard: ${dashboardUrl}`,
    ``,
    `Any questions, just reply to this email.`,
  ].join('\n');

  return { subject, html, text };
}
