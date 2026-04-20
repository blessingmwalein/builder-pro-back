import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { ElectrosalesController } from './electrosales.controller';
import { ElectrosalesService } from './electrosales.service';

@Module({
  imports: [PrismaModule],
  controllers: [ElectrosalesController],
  providers: [ElectrosalesService],
  exports: [ElectrosalesService],
})
export class ElectrosalesModule {}
