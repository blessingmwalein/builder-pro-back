import { button, divider, escapeHtml, renderLayout, type RenderedEmail } from './layout';

export interface WelcomeEmailInput {
  firstName: string;
  companyName: string;
  trialDays: number;
  dashboardUrl: string;
  brandName?: string;
  appUrl?: string;
}

export function renderWelcomeEmail(input: WelcomeEmailInput): RenderedEmail {
  const { firstName, companyName, trialDays, dashboardUrl, brandName = 'ownit2buildit', appUrl } = input;
  const subject = `Welcome to ${brandName}, ${firstName} — your ${trialDays}-day trial has started`;

  const body = `
    <h1 style="margin:0 0 20px;font-size:24px;font-weight:700;color:#19130F;letter-spacing:-0.02em;">
      Welcome aboard, ${escapeHtml(firstName)}! 🏗️
    </h1>

    <p style="margin:0 0 16px;color:#3D2D27;">
      Your <strong style="color:#19130F;">${escapeHtml(companyName)}</strong> workspace is ready.
      You've been set up with a <strong style="color:#7C3018;">${trialDays}-day free trial</strong> — no credit card required.
    </p>

    <p style="margin:0 0 8px;color:#3D2D27;font-weight:600;">Here's how to get the most out of it:</p>

    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:12px 0 24px;">
      ${[
        ['Add your first client', 'Head to the CRM and create a client profile.'],
        ['Invite your team', 'Go to Settings → Users and send team invitations.'],
        ['Create a project', 'Set up your first project, budget, and milestones.'],
        ['Send a quote', 'Draft and send a professional quote in minutes.'],
      ].map(([title, desc]) => `
      <tr>
        <td style="padding:8px 0;vertical-align:top;">
          <table role="presentation" cellpadding="0" cellspacing="0">
            <tr>
              <td style="width:20px;vertical-align:top;padding-top:2px;">
                <div style="width:6px;height:6px;border-radius:50%;background-color:#7C3018;margin-top:5px;"></div>
              </td>
              <td style="padding-left:8px;">
                <span style="font-weight:600;color:#19130F;">${escapeHtml(title as string)}</span>
                <span style="color:#776560;"> — ${escapeHtml(desc as string)}</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>`).join('')}
    </table>

    ${button('Open your dashboard', dashboardUrl)}

    ${divider()}

    <p style="margin:0;font-size:13px;color:#776560;">
      Questions? Just reply to this email — a real person will help.<br/>
      We're excited to see what you build.
    </p>
  `;

  const html = renderLayout({
    preheader: `Your ${trialDays}-day trial has started — here's how to hit the ground running.`,
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
    `  • Add your first client in the CRM`,
    `  • Invite your team via Settings → Users`,
    `  • Create a project and set up its budget`,
    `  • Draft and send your first professional quote`,
    ``,
    `Open your dashboard: ${dashboardUrl}`,
    ``,
    `Questions? Just reply to this email.`,
    ``,
    `— The ${brandName} team`,
  ].join('\n');

  return { subject, html, text };
}
