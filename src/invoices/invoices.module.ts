import { Module } from '@nestjs/common';
import { BillingModule } from '../billing/billing.module';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';

@Module({
	imports: [BillingModule],
	controllers: [InvoicesController],
	providers: [InvoicesService],
	exports: [InvoicesService],
})
export class InvoicesModule {}
