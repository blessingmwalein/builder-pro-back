import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Permissions } from '../common/decorators/permissions.decorator';
import { Tenant } from '../common/decorators/tenant.decorator';
import type { RequestTenant } from '../common/interfaces/request-context.interface';
import { AddProjectMemberDto } from './dto/add-project-member.dto';
import { CreateProjectDto } from './dto/create-project.dto';
import { QueryProjectsDto } from './dto/query-projects.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ProjectsService } from './projects.service';

@ApiTags('Projects')
@ApiBearerAuth()
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Permissions('projects.*', 'projects.create')
  @Post()
  @ApiOperation({ summary: 'Create a new project' })
  create(@Tenant() tenant: RequestTenant, @Body() dto: CreateProjectDto) {
    return this.projectsService.create(tenant.companyId, dto);
  }

  @Permissions('projects.*', 'projects.view')
  @Get()
  @ApiOperation({ summary: 'List all projects with pagination and filters' })
  findMany(@Tenant() tenant: RequestTenant, @Query() query: QueryProjectsDto) {
    return this.projectsService.findMany(tenant.companyId, query);
  }

  @Permissions('projects.*', 'projects.view')
  @Get(':id')
  @ApiOperation({ summary: 'Get project details' })
  findOne(@Tenant() tenant: RequestTenant, @Param('id') id: string) {
    return this.projectsService.findOne(tenant.companyId, id);
  }

  @Permissions('projects.*', 'projects.view')
  @Get(':id/dashboard')
  @ApiOperation({ summary: 'Get project dashboard (tasks, budget, timeline, alerts)' })
  getDashboard(@Tenant() tenant: RequestTenant, @Param('id') id: string) {
    return this.projectsService.getDashboard(tenant.companyId, id);
  }

  @Permissions('projects.*')
  @Put(':id')
  @ApiOperation({ summary: 'Update project details' })
  update(
    @Tenant() tenant: RequestTenant,
    @Param('id') id: string,
    @Body() dto: UpdateProjectDto,
  ) {
    return this.projectsService.update(tenant.companyId, id, dto);
  }

  @Permissions('projects.*', 'projects.delete')
  @Delete(':id')
  @ApiOperation({ summary: 'Soft-delete a project' })
  remove(@Tenant() tenant: RequestTenant, @Param('id') id: string) {
    return this.projectsService.remove(tenant.companyId, id);
  }

  @Permissions('projects.*')
  @Get(':id/members')
  @ApiOperation({ summary: 'List project team members' })
  listMembers(@Tenant() tenant: RequestTenant, @Param('id') id: string) {
    return this.projectsService.listMembers(tenant.companyId, id);
  }

  @Permissions('projects.*')
  @Post(':id/members')
  @ApiOperation({ summary: 'Add a team member to the project' })
  addMember(
    @Tenant() tenant: RequestTenant,
    @Param('id') id: string,
    @Body() dto: AddProjectMemberDto,
  ) {
    return this.projectsService.addMember(tenant.companyId, id, dto);
  }

  @Permissions('projects.*')
  @Delete(':id/members/:userId')
  @ApiOperation({ summary: 'Remove a team member from the project' })
  removeMember(
    @Tenant() tenant: RequestTenant,
    @Param('id') id: string,
    @Param('userId') userId: string,
  ) {
    return this.projectsService.removeMember(tenant.companyId, id, userId);
  }
}
