import { Module } from '@nestjs/common';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { ProjectTemplatesModule } from '../project-templates/project-templates.module';

@Module({
	imports: [ProjectTemplatesModule],
	controllers: [ProjectsController],
	providers: [ProjectsService],
	exports: [ProjectsService],
})
export class ProjectsModule {}
