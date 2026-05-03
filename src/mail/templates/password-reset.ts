import { renderLayout, type RenderedEmail } from './layout';

export interface PasswordResetEmailInput {
  firstName: string;
  otp: string;
  brandName?: string;
  appUrl?: string;
}

export function renderPasswordResetEmail(input: PasswordResetEmailInput): RenderedEmail {
  const { firstName, otp, brandName, appUrl } = input;
  
  const subject = `Reset Your Password - ${brandName || 'BuilderPro'}`;
  
  const body = `
    <p>Hi ${firstName},</p>
    <p>We received a request to reset your password. Use the verification code below to proceed:</p>
    
    <div style="margin: 32px 0; text-align: center;">
      <div style="display: inline-block; padding: 16px 32px; background-color: #f3f4f6; border-radius: 8px; font-size: 32px; font-weight: 700; letter-spacing: 0.1em; color: #111827; border: 1px solid #e5e7eb;">
        ${otp}
      </div>
    </div>
    
    <p>This code will expire in 15 minutes. If you didn't request a password reset, you can safely ignore this email.</p>
    
    <p>For security, never share this code with anyone. Our team will never ask for your verification code.</p>
    
    <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 32px 0;" />
    
    <p style="font-size: 13px; color: #6b7280;">
      If the button above doesn't work, you can copy and paste the OTP code directly into the application.
    </p>
  `;

  const html = renderLayout({
    title: subject,
    preheader: 'Use this code to reset your password.',
    body,
    brandName,
    appUrl,
  });

  const text = `
    Hi ${firstName},
    
    We received a request to reset your password. Use the verification code below to proceed:
    
    ${otp}
    
    This code will expire in 15 minutes. If you didn't request a password reset, you can safely ignore this email.
    
    For security, never share this code with anyone.
    
    © ${new Date().getFullYear()} ${brandName || 'BuilderPro'}. All rights reserved.
  `;

  return { subject, html, text };
}
