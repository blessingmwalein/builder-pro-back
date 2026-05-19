import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { SendMailClient } = require('zeptomail');
import type { IMailAdapter, SendMailOpts } from './mail-adapter.interface';

@Injectable()
export class ZeptomailAdapter implements IMailAdapter {
  private readonly logger = new Logger(ZeptomailAdapter.name);
  private readonly client: any;
  private readonly from: { address: string; name: string };

  constructor(configService: ConfigService) {
    const cfg = configService.get('zeptomail')!;
    this.from = { address: cfg.fromAddress, name: cfg.fromName };
    this.client = new SendMailClient({
      url: 'https://api.zeptomail.com/v1.1/email',
      token: cfg.token,
    });
  }

  async verify(): Promise<void> {
    this.logger.log(
      `ZeptoMail adapter ready — from=${this.from.address}`,
    );
  }

  async send(opts: SendMailOpts): Promise<void> {
    const payload = {
      from: this.from,
      to: [
        {
          email_address: {
            address: opts.to,
            name: opts.to.split('@')[0],
          },
        },
      ],
      subject: opts.subject,
      htmlbody: opts.html,
      textbody: opts.text,
    };

    try {
      const resp = await this.client.sendMail(payload);
      this.logger.log(
        `[zeptomail] Sent → ${opts.to}  (message_id=${resp?.data?.message_id ?? 'n/a'})`,
      );
    } catch (err: any) {
      const detail =
        err?.error?.message ??
        err?.message ??
        (err != null ? JSON.stringify(err) : 'unknown error');
      throw new Error(`ZeptoMail delivery failed: ${detail}`);
    }
  }
}
