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
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { Tenant } from '../common/decorators/tenant.decorator';
import type {
  RequestTenant,
  RequestUser,
} from '../common/interfaces/request-context.interface';
import { CreateChecklistDto } from './dto/create-checklist.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { CreateTaskDto } from './dto/create-task.dto';
import { QueryTasksDto } from './dto/query-tasks.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { UpdateTaskStatusDto } from './dto/update-task-status.dto';
import { TasksService } from './tasks.service';

@ApiTags('Tasks')
@ApiBearerAuth()
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Permissions('tasks.*', 'tasks.create')
  @Post()
  @ApiOperation({ summary: 'Create a new task' })
  create(@Tenant() tenant: RequestTenant, @Body() dto: CreateTaskDto) {
    return this.tasksService.create(tenant.companyId, dto);
  }

  @Permissions('tasks.*', 'tasks.view')
  @Get()
  @ApiOperation({ summary: 'List tasks with filters' })
  findMany(@Tenant() tenant: RequestTenant, @Query() query: QueryTasksDto) {
    return this.tasksService.findMany(tenant.companyId, query);
  }

  @Permissions('tasks.*', 'tasks.view')
  @Get('my-queue')
  @ApiOperation({ summary: 'Get current user personal task queue' })
  myQueue(@Tenant() tenant: RequestTenant, @CurrentUser() user: RequestUser) {
    return this.tasksService.getWorkerQueue(tenant.companyId, user.userId);
  }

  @Permissions('tasks.*', 'tasks.view')
  @Get(':id')
  @ApiOperation({ summary: 'Get a single task with comments, checklists, subtasks' })
  findOne(@Tenant() tenant: RequestTenant, @Param('id') id: string) {
    return this.tasksService.findOne(tenant.companyId, id);
  }

  @Permissions('tasks.*')
  @Put(':id')
  @ApiOperation({ summary: 'Update task details' })
  update(
    @Tenant() tenant: RequestTenant,
    @Param('id') id: string,
    @Body() dto: UpdateTaskDto,
  ) {
    return this.tasksService.update(tenant.companyId, id, dto);
  }

  @Permissions('tasks.*', 'tasks.complete')
  @Put(':id/status')
  @ApiOperation({ summary: 'Update task status' })
  updateStatus(
    @Tenant() tenant: RequestTenant,
    @Param('id') id: string,
    @Body() dto: UpdateTaskStatusDto,
  ) {
    return this.tasksService.updateStatus(tenant.companyId, id, dto);
  }

  @Permissions('tasks.*')
  @Delete(':id')
  @ApiOperation({ summary: 'Delete a task' })
  remove(@Tenant() tenant: RequestTenant, @Param('id') id: string) {
    return this.tasksService.remove(tenant.companyId, id);
  }

  @Permissions('tasks.*', 'tasks.assign')
  @Post(':id/assignees/:userId')
  @ApiOperation({ summary: 'Add assignee to task' })
  addAssignee(
    @Tenant() tenant: RequestTenant,
    @Param('id') id: string,
    @Param('userId') userId: string,
  ) {
    return this.tasksService.addAssignee(tenant.companyId, id, userId);
  }

  @Permissions('tasks.*', 'tasks.assign')
  @Delete(':id/assignees/:userId')
  @ApiOperation({ summary: 'Remove assignee from task' })
  removeAssignee(
    @Tenant() tenant: RequestTenant,
    @Param('id') id: string,
    @Param('userId') userId: string,
  ) {
    return this.tasksService.removeAssignee(tenant.companyId, id, userId);
  }

  @Permissions('tasks.*', 'tasks.view')
  @Get(':id/comments')
  @ApiOperation({ summary: 'List task comments' })
  listComments(@Tenant() tenant: RequestTenant, @Param('id') id: string) {
    return this.tasksService.listComments(tenant.companyId, id);
  }

  @Permissions('tasks.*')
  @Post(':id/comments')
  @ApiOperation({ summary: 'Add comment to task' })
  addComment(
    @Tenant() tenant: RequestTenant,
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: CreateCommentDto,
  ) {
    return this.tasksService.addComment(tenant.companyId, id, user.userId, dto);
  }

  @Permissions('tasks.*')
  @Post(':id/checklists')
  @ApiOperation({ summary: 'Create a checklist on a task' })
  createChecklist(
    @Tenant() tenant: RequestTenant,
    @Param('id') id: string,
    @Body() dto: CreateChecklistDto,
  ) {
    return this.tasksService.createChecklist(tenant.companyId, id, dto);
  }

  @Permissions('tasks.*', 'tasks.view')
  @Get(':id/attachments')
  @ApiOperation({ summary: 'List task attachments' })
  listAttachments(@Tenant() tenant: RequestTenant, @Param('id') id: string) {
    return this.tasksService.listAttachments(tenant.companyId, id);
  }

  @Permissions('tasks.*')
  @Post(':id/attachments')
  @ApiOperation({ summary: 'Upload a task attachment' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 20 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const ALLOWED = [
          'image/jpeg', 'image/png', 'image/webp', 'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ];
        if (ALLOWED.includes(file.mimetype)) cb(null, true);
        else cb(new BadRequestException('File type not allowed'), false);
      },
    }),
  )
  async uploadAttachment(
    @Tenant() tenant: RequestTenant,
    @Param('id') id: string,
    @UploadedFile() file: { originalname: string; mimetype: string; buffer: Buffer; size: number },
  ) {
    if (!file) throw new BadRequestException('No file provided');
    const ext = extname(file.originalname).toLowerCase() || '.bin';
    const filename = `${randomUUID()}${ext}`;
    const uploadsDir = join(process.cwd(), 'uploads', 'tasks');
    await fs.mkdir(uploadsDir, { recursive: true });
    await fs.writeFile(join(uploadsDir, filename), file.buffer);
    const baseUrl = process.env.FILE_STORAGE_BASE_URL ?? `http://localhost:${process.env.PORT ?? 3000}`;
    const url = `${baseUrl}/uploads/tasks/${filename}`;
    return this.tasksService.addAttachment(tenant.companyId, id, {
      fileName: file.originalname,
      fileKey: `tasks/${filename}`,
      url,
      contentType: file.mimetype,
      sizeBytes: file.size,
    });
  }

  @Permissions('tasks.*')
  @Put(':taskId/checklists/:checklistId/items/:itemId/toggle')
  @ApiOperation({ summary: 'Toggle checklist item done/undone' })
  toggleChecklistItem(
    @Tenant() tenant: RequestTenant,
    @Param('taskId') taskId: string,
    @Param('checklistId') checklistId: string,
    @Param('itemId') itemId: string,
  ) {
    return this.tasksService.toggleChecklistItem(
      tenant.companyId,
      taskId,
      checklistId,
      itemId,
    );
  }
}
