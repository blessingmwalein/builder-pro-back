import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { extname, join } from 'path';
import { promises as fs } from 'fs';
import { randomUUID } from 'crypto';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Permissions } from '../common/decorators/permissions.decorator';
import { Tenant } from '../common/decorators/tenant.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestTenant } from '../common/interfaces/request-context.interface';
import { AddProjectMemberDto } from './dto/add-project-member.dto';
import { CreateProjectDto } from './dto/create-project.dto';
import { QueryProjectsDto } from './dto/query-projects.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ProjectsService } from './projects.service';

const ALLOWED_DOC_MIME = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
const MAX_DOC_SIZE = 20 * 1024 * 1024; // 20 MB

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

  @Permissions('projects.*', 'projects.view')
  @Get(':id/stages')
  @ApiOperation({ summary: 'List project stages sorted by stageOrder' })
  listStages(@Tenant() tenant: RequestTenant, @Param('id') id: string) {
    return this.projectsService.listStages(tenant.companyId, id);
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
  @Get(':id/closure-preview')
  @ApiOperation({
    summary: 'Preview project closure analytics without persisting',
    description:
      'Computes the same cost/budget/labour/materials breakdown that closeProject ' +
      'would freeze. Safe to call before the user confirms closure.',
  })
  closurePreview(@Tenant() tenant: RequestTenant, @Param('id') id: string) {
    return this.projectsService.buildClosureSummary(tenant.companyId, id);
  }

  @Permissions('projects.*')
  @Post(':id/close')
  @ApiOperation({
    summary: 'Close (complete) a project and snapshot its final analytics',
    description:
      'Sets status=COMPLETED, closedAt=now, and writes a JSON snapshot with total ' +
      'cost vs budget, material-usage breakdown, labour breakdown, and P/L.',
  })
  close(
    @Tenant() tenant: RequestTenant,
    @Param('id') id: string,
    @Body() body: { notes?: string } = {},
  ) {
    return this.projectsService.closeProject(tenant.companyId, id, body.notes);
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

  // ─── Documents ──────────────────────────────────────────────────────────────

  @Permissions('projects.*', 'projects.view')
  @Get(':id/documents')
  @ApiOperation({ summary: 'List project documents (optionally filter by stageId)' })
  listDocuments(
    @Tenant() tenant: RequestTenant,
    @Param('id') id: string,
    @Query('stageId') stageId?: string,
  ) {
    return this.projectsService.listDocuments(tenant.companyId, id, stageId);
  }

  @Permissions('projects.*')
  @Post(':id/documents')
  @ApiOperation({ summary: 'Upload a project document' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_DOC_SIZE },
      fileFilter: (_req, file, cb) => {
        if (ALLOWED_DOC_MIME.includes(file.mimetype)) cb(null, true);
        else cb(new BadRequestException('File type not allowed'), false);
      },
    }),
  )
  async uploadDocument(
    @Tenant() tenant: RequestTenant,
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @UploadedFile() file: { originalname: string; mimetype: string; buffer: Buffer; size: number },
    @Body() body: { stageId?: string; type?: string; isRequired?: string; name?: string },
  ) {
    if (!file) throw new BadRequestException('No file provided');
    const ext = extname(file.originalname).toLowerCase() || '.bin';
    const filename = `${randomUUID()}${ext}`;
    const uploadsDir = join(process.cwd(), 'uploads', 'documents');
    await fs.mkdir(uploadsDir, { recursive: true });
    await fs.writeFile(join(uploadsDir, filename), file.buffer);
    const baseUrl = process.env.FILE_STORAGE_BASE_URL ?? `http://localhost:${process.env.PORT ?? 3000}`;
    const url = `${baseUrl}/uploads/documents/${filename}`;
    return this.projectsService.createDocument(tenant.companyId, id, user.id, {
      name: body.name || file.originalname,
      fileName: file.originalname,
      fileKey: `documents/${filename}`,
      url,
      contentType: file.mimetype,
      sizeBytes: file.size,
      type: body.type,
      stageId: body.stageId,
      isRequired: body.isRequired === 'true',
    });
  }

  @Permissions('projects.*')
  @Patch(':id/documents/:docId/approve')
  @ApiOperation({ summary: 'Approve a project document' })
  approveDocument(
    @Tenant() tenant: RequestTenant,
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Param('docId') docId: string,
    @Body() body: { notes?: string } = {},
  ) {
    return this.projectsService.approveDocument(tenant.companyId, id, docId, user.id, body.notes);
  }

  @Permissions('projects.*')
  @Delete(':id/documents/:docId')
  @ApiOperation({ summary: 'Delete a project document' })
  removeDocument(
    @Tenant() tenant: RequestTenant,
    @Param('id') id: string,
    @Param('docId') docId: string,
  ) {
    return this.projectsService.removeDocument(tenant.companyId, id, docId);
  }

  // ─── Analytics ──────────────────────────────────────────────────────────────

  @Permissions('projects.*', 'projects.view')
  @Get(':id/analytics')
  @ApiOperation({ summary: 'Get project analytics (budget, tasks, timeline, productivity, profitability)' })
  getAnalytics(@Tenant() tenant: RequestTenant, @Param('id') id: string) {
    return this.projectsService.getAnalytics(tenant.companyId, id);
  }
}
