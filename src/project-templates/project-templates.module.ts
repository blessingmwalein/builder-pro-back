import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ProjectTemplatesController } from './project-templates.controller';
import { ProjectTemplatesService } from './project-templates.service';

@Module({
  imports: [PrismaModule],
  controllers: [ProjectTemplatesController],
  providers: [ProjectTemplatesService],
  exports: [ProjectTemplatesService],
})
export class ProjectTemplatesModule {}
