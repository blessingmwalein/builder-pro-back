import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import type { IMailAdapter, SendMailOpts } from './mail-adapter.interface';

@Injectable()
export class SmtpMailAdapter implements IMailAdapter {
  private readonly logger = new Logger(SmtpMailAdapter.name);
  private readonly transporter: Transporter;
  private readonly from: string;

  constructor(configService: ConfigService) {
    const cfg = configService.get('mail')!;
    this.from = `"${cfg.fromName}" <${cfg.fromAddress}>`;
    this.transporter = nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.secure,
      auth: { user: cfg.user, pass: cfg.password },
    });
  }

  async verify(): Promise<void> {
    await this.transporter.verify();
    this.logger.log('SMTP transport ready.');
  }

  async send(opts: SendMailOpts): Promise<void> {
    const info = await this.transporter.sendMail({
      from: this.from,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
    });
    this.logger.log(`Mail sent → ${opts.to}  (messageId=${info.messageId})`);
  }
}
