import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { BillingModule } from '../billing/billing.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PromoCodesService } from '../platform-admin/promo-codes.service';
import { SubscriptionConfigService } from '../subscriptions/subscription-config.service';
import { OnboardingController } from './onboarding.controller';
import { OnboardingService } from './onboarding.service';

@Module({
  imports: [PrismaModule, JwtModule.register({}), BillingModule],
  controllers: [OnboardingController],
  providers: [OnboardingService, SubscriptionConfigService, PromoCodesService],
})
export class OnboardingModule {}
