import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailService } from './mail.service';
import { MAIL_ADAPTER } from './adapters/mail-adapter.interface';
import { SmtpMailAdapter } from './adapters/smtp.adapter';
import { TestmailAdapter } from './adapters/testmail.adapter';
import { ZeptomailAdapter } from './adapters/zeptomail.adapter';

@Global()
@Module({
  providers: [
    {
      provide: MAIL_ADAPTER,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const adapter = configService.get<string>('testmail.adapter') ?? 'smtp';
        switch (adapter) {
          case 'zeptomail': return new ZeptomailAdapter(configService);
          case 'testmail':  return new TestmailAdapter(configService);
          default:          return new SmtpMailAdapter(configService);
        }
      },
    },
    MailService,
  ],
  exports: [MailService],
})
export class MailModule {}
