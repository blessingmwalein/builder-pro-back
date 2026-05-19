import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import type { IMailAdapter, SendMailOpts } from './mail-adapter.interface';

/**
 * Routes all outgoing emails to testmail.app inboxes.
 *
 * How it works:
 *   1. The original recipient (e.g. john@acme.com) is converted to a stable
 *      tag: "john_acme_com".
 *   2. The email is delivered to {namespace}.{tag}@inbox.testmail.app using
 *      the same SMTP transport as production.
 *   3. The original To address is preserved in the subject prefix and in an
 *      X-Original-To header so you can see who the email was "for".
 *   4. A retrieval URL is printed to the server log.
 *
 * Retrieve emails:
 *   GET https://api.testmail.app/api/json?apikey=KEY&namespace=NS&tag=TAG
 */
@Injectable()
export class TestmailAdapter implements IMailAdapter {
  private readonly logger = new Logger(TestmailAdapter.name);
  private readonly transporter: Transporter;
  private readonly from: string;
  private readonly namespace: string;
  private readonly apiKey: string;

  constructor(configService: ConfigService) {
    const mail = configService.get('mail')!;
    const testmail = configService.get('testmail')!;

    this.namespace = testmail.namespace;
    this.apiKey = testmail.apiKey;
    this.from = `"${mail.fromName}" <${mail.fromAddress}>`;

    this.transporter = nodemailer.createTransport({
      host: mail.host,
      port: mail.port,
      secure: mail.secure,
      auth: { user: mail.user, pass: mail.password },
    });
  }

  async verify(): Promise<void> {
    await this.transporter.verify();
    this.logger.log(
      `Testmail adapter ready — namespace="${this.namespace}". ` +
        `View inbox at https://app.testmail.app`,
    );
  }

  async send(opts: SendMailOpts): Promise<void> {
    const tag = this.toTag(opts.to);
    const inboxAddress = `${this.namespace}.${tag}@inbox.testmail.app`;

    const info = await this.transporter.sendMail({
      from: this.from,
      to: inboxAddress,
      subject: `[to:${opts.to}] ${opts.subject}`,
      html: opts.html,
      text: opts.text,
      headers: { 'X-Original-To': opts.to },
    });

    const retrieveUrl =
      `https://api.testmail.app/api/json` +
      `?apikey=${this.apiKey}&namespace=${this.namespace}&tag=${tag}&livequery=true`;

    this.logger.log(
      `[testmail] Delivered → ${inboxAddress}  (original: ${opts.to})\n` +
        `  subject : ${opts.subject}\n` +
        `  message : ${info.messageId}\n` +
        `  retrieve: ${retrieveUrl}`,
    );
  }

  /** Convert an email address to a safe testmail tag (max 60 chars). */
  private toTag(email: string): string {
    return email
      .toLowerCase()
      .replace(/[@.+]/g, '_')
      .replace(/[^a-z0-9_]/g, '')
      .slice(0, 60);
  }
}
