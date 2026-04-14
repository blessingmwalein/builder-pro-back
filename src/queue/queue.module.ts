import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ConfigService } from '@nestjs/config';
import { BillingModule } from '../billing/billing.module';
import { NotificationsProcessor } from './processors/notifications.processor';
import { PaymentsProcessor } from './processors/payments.processor';
import { ReportsProcessor } from './processors/reports.processor';

@Module({
	imports: [
		BillingModule,
		BullModule.forRootAsync({
			inject: [ConfigService],
			useFactory: (configService: ConfigService) => ({
				redis: {
					host: configService.get<string>('redis.host'),
					port: configService.get<number>('redis.port'),
				},
			}),
		}),
		BullModule.registerQueue(
			{
				name: 'notifications',
			},
			{
				name: 'reports',
			},
			{
				name: 'payments',
			},
		),
	],
	providers: [NotificationsProcessor, ReportsProcessor, PaymentsProcessor],
	exports: [BullModule],
})
export class QueueModule {}
