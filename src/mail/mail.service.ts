import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import {
  renderWelcomeEmail,
  type WelcomeEmailInput,
  type RenderedEmail,
} from './templates/welcome';
import { renderInviteEmail, type InviteEmailInput } from './templates/invite';

interface MailConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  fromName: string;
  fromAddress: string;
  appUrl: string;
  enabled: boolean;
}

export interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
  text: string;
}

@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;
  private config!: MailConfig;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const cfg = this.configService.get<MailConfig>('mail');
    if (!cfg) {
      this.logger.warn('Mail config missing — emails will be skipped.');
      this.config = {} as MailConfig;
      return;
    }
    this.config = cfg;

    if (!cfg.enabled) {
      this.logger.log('Mail delivery is disabled (MAIL_ENABLED=false).');
      return;
    }

    if (!cfg.password) {
      this.logger.warn(
        'SMTP password is not configured — mail delivery is effectively disabled until SMTP_PASSWORD is set.',
      );
      return;
    }

    this.transporter = nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.secure, // true for 465, false for 587
      auth: { user: cfg.user, pass: cfg.password },
    });

    this.transporter
      .verify()
      .then(() =>
        this.logger.log(`SMTP transport ready (host=${cfg.host}, port=${cfg.port}).`),
      )
      .catch((err) =>
        this.logger.error(`SMTP verify failed: ${(err as Error).message}`),
      );
  }

  /**
   * Low-level send. No-ops (but logs) if the transporter is not configured, so
   * developers can run the app without SMTP credentials in local dev.
   */
  async send(opts: SendMailOptions): Promise<void> {
    if (!this.transporter || !this.config.enabled) {
      this.logger.log(
        `[mail:dry-run] to=${opts.to} subject="${opts.subject}" (transport not configured)`,
      );
      return;
    }

    try {
      const info = await this.transporter.sendMail({
        from: `"${this.config.fromName}" <${this.config.fromAddress}>`,
        to: opts.to,
        subject: opts.subject,
        html: opts.html,
        text: opts.text,
      });
      this.logger.log(`Mail sent to ${opts.to} (messageId=${info.messageId}).`);
    } catch (err) {
      // We deliberately do not throw — failed welcome/invite emails should not block
      // signup or invite creation. The caller has the invite token to retry/resurface.
      this.logger.error(
        `Failed to send mail to ${opts.to}: ${(err as Error).message}`,
      );
    }
  }

  // ---- High-level helpers ----------------------------------------------------

  async sendWelcome(to: string, payload: Omit<WelcomeEmailInput, 'brandName' | 'appUrl'>) {
    const rendered = renderWelcomeEmail({
      ...payload,
      brandName: this.config.fromName,
      appUrl: this.config.appUrl,
    });
    await this.sendRendered(to, rendered);
  }

  async sendInvite(to: string, payload: Omit<InviteEmailInput, 'brandName' | 'appUrl'>) {
    const rendered = renderInviteEmail({
      ...payload,
      brandName: this.config.fromName,
      appUrl: this.config.appUrl,
    });
    await this.sendRendered(to, rendered);
  }

  private async sendRendered(to: string, rendered: RenderedEmail) {
    await this.send({
      to,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    });
  }

  /**
   * Build a full accept-invite URL for the web app.
   * Used by anything that needs to include the URL in an email.
   */
  buildAcceptInviteUrl(token: string): string {
    const base = this.config.appUrl.replace(/\/$/, '');
    return `${base}/accept-invite?token=${encodeURIComponent(token)}`;
  }

  buildDashboardUrl(): string {
    const base = this.config.appUrl.replace(/\/$/, '');
    return `${base}/dashboard`;
  }
}
