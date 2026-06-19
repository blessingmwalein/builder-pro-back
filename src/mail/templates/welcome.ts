import { button, divider, escapeHtml, renderLayout, type RenderedEmail } from './layout';

export interface WelcomeEmailInput {
  firstName: string;
  companyName: string;
  dashboardUrl: string;
  brandName?: string;
  appUrl?: string;
}

export function renderWelcomeEmail(input: WelcomeEmailInput): RenderedEmail {
  const { firstName, companyName, dashboardUrl, brandName = 'ownit2buildit', appUrl } = input;
  const subject = `Welcome to ${brandName}, ${escapeHtml(firstName)}!`;

  const body = `
    <h1 style="margin:0 0 20px;font-size:24px;font-weight:700;color:#19130F;letter-spacing:-0.02em;">
      Welcome to ${brandName}, ${escapeHtml(firstName)}!
    </h1>

    <p style="margin:0 0 16px;color:#3D2D27;">
      Your <strong style="color:#19130F;">${escapeHtml(companyName)}</strong> workspace is ready.
      You now have access to the full ${brandName} platform — built for construction professionals like you.
    </p>

    <p style="margin:0 0 8px;color:#3D2D27;font-weight:600;">Here's how to get started:</p>

    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:12px 0 24px;">
      ${[
        ['Set up your workspace', 'Add your company details, logo, and branding.'],
        ['Invite your team', 'Go to Settings → Users and send team invitations.'],
        ['Create your first project', 'Set up milestones, budgets, and task assignments.'],
        ['Send a quote', 'Draft and send a professional quote to a client in minutes.'],
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
    preheader: `Your ${companyName} workspace is ready — let's get building.`,
    title: subject,
    body,
    brandName,
    appUrl,
  });

  const text = [
    `Welcome to ${brandName}, ${firstName}!`,
    ``,
    `Your ${companyName} workspace is ready. You now have full access to the ${brandName} platform.`,
    ``,
    `Get started:`,
    `  • Set up your company profile and branding`,
    `  • Invite your team via Settings → Users`,
    `  • Create your first project and set up its budget`,
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
