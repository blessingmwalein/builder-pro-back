import { Module } from '@nestjs/common';
import { ElectrosalesModule } from '../integrations/electrosales/electrosales.module';
import { QuotesController } from './quotes.controller';
import { QuotesService } from './quotes.service';

@Module({
	imports: [ElectrosalesModule],
	controllers: [QuotesController],
	providers: [QuotesService],
	exports: [QuotesService],
})
export class QuotesModule {}
