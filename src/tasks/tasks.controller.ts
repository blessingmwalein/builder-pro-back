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
