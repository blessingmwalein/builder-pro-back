import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ReportingController } from './reporting.controller';
import { ReportingService } from './reporting.service';

@Module({
	imports: [BullModule.registerQueue({ name: 'reports' })],
	controllers: [ReportingController],
	providers: [ReportingService],
	exports: [ReportingService],
})
export class ReportingModule {}
