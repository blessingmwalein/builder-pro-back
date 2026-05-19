import { Module } from '@nestjs/common';
import { ProjectStagesController } from './project-stages.controller';
import { ProjectStagesService } from './project-stages.service';

@Module({
  controllers: [ProjectStagesController],
  providers: [ProjectStagesService],
  exports: [ProjectStagesService],
})
export class ProjectStagesModule {}
