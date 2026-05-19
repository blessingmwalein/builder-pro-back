import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '../prisma/prisma.module';
import { SubscriptionConfigService } from '../subscriptions/subscription-config.service';
import { PromoCodesService } from './promo-codes.service';
import { PlatformAdminAuthController } from './platform-admin-auth.controller';
import { PlatformAdminController } from './platform-admin.controller';
import { PlatformAdminService } from './platform-admin.service';
import { PlatformAdminGuard } from './guards/platform-admin.guard';

@Module({
  imports: [
    PrismaModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret:
          configService.get<string>('platformAdmin.jwtSecret') ??
          'change-me-platform-admin-jwt-secret',
      }),
    }),
  ],
  controllers: [PlatformAdminController, PlatformAdminAuthController],
  providers: [PlatformAdminService, PlatformAdminGuard, SubscriptionConfigService, PromoCodesService],
  exports: [PlatformAdminService, PromoCodesService],
})
export class PlatformAdminModule {}
