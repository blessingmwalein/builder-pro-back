import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from '../prisma/prisma.module';
import { MailModule } from '../mail/mail.module';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionConfigService } from './subscription-config.service';
import { SubscriptionReminderService } from './subscription-reminder.service';

@Module({
  imports: [ScheduleModule.forRoot(), PrismaModule, MailModule],
  controllers: [SubscriptionsController],
  providers: [SubscriptionsService, SubscriptionConfigService, SubscriptionReminderService],
  exports: [SubscriptionsService, SubscriptionConfigService],
})
export class SubscriptionsModule {}
