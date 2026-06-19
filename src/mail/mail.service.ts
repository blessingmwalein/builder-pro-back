import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  MAIL_ADAPTER,
  type IMailAdapter,
  type SendMailOpts,
} from './adapters/mail-adapter.interface';
import { renderWelcomeEmail, type WelcomeEmailInput } from './templates/welcome';
import { renderInviteEmail, type InviteEmailInput } from './templates/invite';
import { renderPasswordResetEmail, type PasswordResetEmailInput } from './templates/password-reset';
import { renderQuoteEmail, type QuoteEmailInput } from './templates/quote';
import { renderInvoiceEmail, type InvoiceEmailInput } from './templates/invoice';
import { renderSubscriptionReminderEmail, type SubscriptionReminderEmailInput } from './templates/subscription-reminder';
import { renderSubscriptionActivatedEmail, type SubscriptionActivatedEmailInput } from './templates/subscription-activated';
import { type RenderedEmail } from './templates/layout';

@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger(MailService.name);
  private enabled = false;
  private fromName = 'ownit2buildit';
  private appUrl = 'http://localhost:3001';

  constructor(
    @Inject(MAIL_ADAPTER) private readonly adapter: IMailAdapter,
    private readonly configService: ConfigService,
  ) {}

  onModuleInit() {
    const cfg = this.configService.get('mail');
    if (!cfg) {
      this.logger.warn('Mail config missing — emails will be skipped.');
      return;
    }
    this.enabled = cfg.enabled ?? false;
    this.fromName = cfg.fromName ?? 'ownit2buildit';
    this.appUrl = cfg.appUrl ?? 'http://localhost:3001';

    if (!this.enabled) {
      this.logger.log('Mail delivery disabled (MAIL_ENABLED=false).');
      return;
    }

    this.adapter
      .verify()
      .catch((err: Error) =>
        this.logger.error(`Mail adapter verify failed: ${err.message}`),
      );
  }

  // ── Low-level ──────────────────────────────────────────────────────────────

  async send(opts: SendMailOpts): Promise<void> {
    if (!this.enabled) {
      this.logger.log(
        `[mail:dry-run] to=${opts.to} subject="${opts.subject}" (MAIL_ENABLED=false)`,
      );
      return;
    }
    try {
      await this.adapter.send(opts);
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : err != null
            ? JSON.stringify(err)
            : 'unknown error';
      this.logger.error(`Failed to send mail to ${opts.to}: ${msg}`);
    }
  }

  // ── High-level helpers ─────────────────────────────────────────────────────

  async sendWelcome(
    to: string,
    payload: Omit<WelcomeEmailInput, 'brandName' | 'appUrl'>,
  ) {
    await this.sendRendered(
      to,
      renderWelcomeEmail({ ...payload, brandName: this.fromName, appUrl: this.appUrl }),
    );
  }

  async sendInvite(
    to: string,
    payload: Omit<InviteEmailInput, 'brandName' | 'appUrl'>,
  ) {
    await this.sendRendered(
      to,
      renderInviteEmail({ ...payload, brandName: this.fromName, appUrl: this.appUrl }),
    );
  }

  async sendPasswordResetOtp(
    to: string,
    payload: Omit<PasswordResetEmailInput, 'brandName' | 'appUrl'>,
  ) {
    await this.sendRendered(
      to,
      renderPasswordResetEmail({ ...payload, brandName: this.fromName, appUrl: this.appUrl }),
    );
  }

  async sendQuote(
    to: string,
    payload: Omit<QuoteEmailInput, 'brandName' | 'appUrl'>,
  ) {
    await this.sendRendered(
      to,
      renderQuoteEmail({ ...payload, brandName: this.fromName, appUrl: this.appUrl }),
    );
  }

  async sendInvoice(
    to: string,
    payload: Omit<InvoiceEmailInput, 'brandName' | 'appUrl'>,
  ) {
    await this.sendRendered(
      to,
      renderInvoiceEmail({ ...payload, brandName: this.fromName, appUrl: this.appUrl }),
    );
  }

  async sendSubscriptionActivated(
    to: string,
    payload: Omit<SubscriptionActivatedEmailInput, 'brandName' | 'appUrl'>,
  ) {
    await this.sendRendered(
      to,
      renderSubscriptionActivatedEmail({ ...payload, brandName: this.fromName, appUrl: this.appUrl }),
    );
  }

  async sendSubscriptionReminder(
    to: string,
    payload: Omit<SubscriptionReminderEmailInput, 'brandName' | 'appUrl'>,
  ) {
    await this.sendRendered(
      to,
      renderSubscriptionReminderEmail({ ...payload, brandName: this.fromName, appUrl: this.appUrl }),
    );
  }

  private async sendRendered(to: string, rendered: RenderedEmail) {
    await this.send({ to, subject: rendered.subject, html: rendered.html, text: rendered.text });
  }

  // ── URL builders ──────────────────────────────────────────────────────────

  buildAcceptInviteUrl(token: string): string {
    return `${this.appUrl.replace(/\/$/, '')}/accept-invite?token=${encodeURIComponent(token)}`;
  }

  buildDashboardUrl(): string {
    return `${this.appUrl.replace(/\/$/, '')}/dashboard`;
  }

  buildQuoteUrl(quoteId: string): string {
    return `${this.appUrl.replace(/\/$/, '')}/portal/quotes/${quoteId}`;
  }

  buildInvoiceUrl(invoiceId: string): string {
    return `${this.appUrl.replace(/\/$/, '')}/portal/invoices/${invoiceId}`;
  }

  buildSubscriptionUrl(): string {
    return `${this.appUrl.replace(/\/$/, '')}/subscription`;
  }
}
