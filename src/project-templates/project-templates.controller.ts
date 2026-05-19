import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Permissions } from '../common/decorators/permissions.decorator';
import { Tenant } from '../common/decorators/tenant.decorator';
import type { RequestTenant } from '../common/interfaces/request-context.interface';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';
import { ProjectTemplatesService } from './project-templates.service';

@ApiTags('Project Templates')
@ApiBearerAuth()
@Controller('project-templates')
export class ProjectTemplatesController {
  constructor(private readonly service: ProjectTemplatesService) {}

  @Permissions('projects.*', 'projects.manage')
  @Post()
  @ApiOperation({ summary: 'Create a project template' })
  create(@Tenant() tenant: RequestTenant, @Body() dto: CreateTemplateDto) {
    return this.service.create(tenant.companyId, dto);
  }

  @Permissions('projects.*', 'projects.view')
  @Get()
  @ApiOperation({ summary: 'List project templates' })
  findAll(@Tenant() tenant: RequestTenant) {
    return this.service.findMany(tenant.companyId);
  }

  @Permissions('projects.*', 'projects.view')
  @Get(':id')
  @ApiOperation({ summary: 'Get a project template with all details' })
  findOne(@Tenant() tenant: RequestTenant, @Param('id') id: string) {
    return this.service.findOne(tenant.companyId, id);
  }

  @Permissions('projects.*', 'projects.manage')
  @Patch(':id')
  @ApiOperation({ summary: 'Update a project template' })
  update(
    @Tenant() tenant: RequestTenant,
    @Param('id') id: string,
    @Body() dto: UpdateTemplateDto,
  ) {
    return this.service.update(tenant.companyId, id, dto);
  }

  @Permissions('projects.*', 'projects.manage')
  @Post(':id/duplicate')
  @ApiOperation({ summary: 'Duplicate a project template' })
  duplicate(@Tenant() tenant: RequestTenant, @Param('id') id: string) {
    return this.service.duplicate(tenant.companyId, id);
  }

  @Permissions('projects.*', 'projects.manage')
  @Delete(':id')
  @ApiOperation({ summary: 'Archive a project template' })
  archive(@Tenant() tenant: RequestTenant, @Param('id') id: string) {
    return this.service.archive(tenant.companyId, id);
  }

  @Permissions('projects.*', 'projects.manage')
  @Post(':id/instantiate')
  @ApiOperation({ summary: 'Instantiate a template onto an existing project' })
  instantiate(
    @Tenant() tenant: RequestTenant,
    @Param('id') templateId: string,
    @Body() body: { projectId: string; baselineBudget?: number },
  ) {
    return this.service.instantiate(
      tenant.companyId,
      body.projectId,
      templateId,
      body.baselineBudget ?? 0,
    );
  }
}
