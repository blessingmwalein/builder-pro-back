import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Permissions } from '../common/decorators/permissions.decorator';
import { Tenant } from '../common/decorators/tenant.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestTenant } from '../common/interfaces/request-context.interface';
import { ApproveStageDto } from './dto/approve-stage.dto';
import { InitializeStagesDto } from './dto/initialize-stages.dto';
import { UpdateProjectStageDto } from './dto/update-project-stage.dto';
import { ProjectStagesService } from './project-stages.service';

@ApiTags('Project Stages')
@ApiBearerAuth()
@Controller('projects/:projectId/stages')
export class ProjectStagesController {
  constructor(private readonly stagesService: ProjectStagesService) {}

  @Permissions('projects.*', 'projects.view')
  @Get()
  @ApiOperation({ summary: 'List all stages for a project' })
  findAll(
    @Tenant() tenant: RequestTenant,
    @Param('projectId') projectId: string,
  ) {
    return this.stagesService.findByProject(tenant.companyId, projectId);
  }

  @Permissions('projects.*', 'projects.update')
  @Post('initialize')
  @ApiOperation({ summary: 'Initialize stages from workflow template codes' })
  initialize(
    @Tenant() tenant: RequestTenant,
    @Param('projectId') projectId: string,
    @Body() dto: InitializeStagesDto,
  ) {
    return this.stagesService.initializeFromTemplate(tenant.companyId, projectId, dto);
  }

  @Permissions('projects.*', 'projects.update')
  @Patch(':stageId')
  @ApiOperation({ summary: 'Update stage status, dates, or notes' })
  update(
    @Tenant() tenant: RequestTenant,
    @Param('projectId') projectId: string,
    @Param('stageId') stageId: string,
    @Body() dto: UpdateProjectStageDto,
  ) {
    return this.stagesService.updateStatus(tenant.companyId, projectId, stageId, dto);
  }

  @Permissions('projects.*')
  @Post(':stageId/approve')
  @ApiOperation({ summary: 'Approve a stage that requires approval' })
  approve(
    @Tenant() tenant: RequestTenant,
    @CurrentUser() user: { id: string },
    @Param('projectId') projectId: string,
    @Param('stageId') stageId: string,
    @Body() dto: ApproveStageDto,
  ) {
    return this.stagesService.approveStage(tenant.companyId, projectId, stageId, user.id, dto);
  }
}
