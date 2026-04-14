import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { PaynowProvider } from './paynow.provider';

@Module({
	controllers: [BillingController],
	providers: [BillingService, PaynowProvider],
	exports: [BillingService, PaynowProvider],
})
export class BillingModule {}
