import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateChecklistDto } from './dto/create-checklist.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { CreateTaskDto } from './dto/create-task.dto';
import { QueryTasksDto } from './dto/query-tasks.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { UpdateTaskStatusDto } from './dto/update-task-status.dto';

const TASK_INCLUDE = {
  project: {
    select: {
      id: true,
      code: true,
      name: true,
      status: true,
      projectType: true,
      siteAddress: true,
      startDate: true,
      endDate: true,
      completionPercent: true,
      client: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
        },
      },
    },
  },
  assignees: {
    where: { deletedAt: null },
    include: {
      user: {
        select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true },
      },
    },
  },
  checklists: {
    where: { deletedAt: null },
    include: { items: { where: { deletedAt: null } } },
  },
  _count: { select: { comments: true, attachments: true } },
};

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  async create(companyId: string, dto: CreateTaskDto) {
    const project = await this.prisma.project.findFirst({
      where: { id: dto.projectId, companyId, deletedAt: null },
      select: { id: true },
    });

    if (!project) throw new NotFoundException('Project not found');

    if (dto.parentTaskId) {
      const parent = await this.prisma.task.findFirst({
        where: { id: dto.parentTaskId, companyId, projectId: dto.projectId, deletedAt: null },
        select: { id: true },
      });

      if (!parent) throw new BadRequestException('Invalid parent task');
    }

    return this.prisma.task.create({
      data: {
        companyId,
        projectId: dto.projectId,
        parentTaskId: dto.parentTaskId,
        title: dto.title,
        description: dto.description,
        status: dto.status,
        priority: dto.priority,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        estimatedHours: dto.estimatedHours,
        assignees: dto.assigneeIds?.length
          ? {
              createMany: {
                data: dto.assigneeIds.map((userId) => ({ companyId, userId })),
                skipDuplicates: true,
              },
            }
          : undefined,
      },
      include: TASK_INCLUDE,
    });
  }

  async findMany(companyId: string, query: QueryTasksDto) {
    const pageRaw = Number(query.page);
    const limitRaw = Number(query.limit);
    const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;
    const limit = Number.isFinite(limitRaw) && limitRaw > 0
      ? Math.min(Math.floor(limitRaw), 100)
      : 20;
    const skip = (page - 1) * limit;

    const where: any = {
      companyId,
      deletedAt: null,
    };

    if (query.projectId) {
      where.projectId = query.projectId;
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.priority) {
      where.priority = query.priority;
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.task.findMany({
        where,
        include: TASK_INCLUDE,
        orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
      }),
      this.prisma.task.count({ where }),
    ]);

    return { items, meta: { page, limit, total } };
  }

  async findOne(companyId: string, id: string) {
    const task = await this.prisma.task.findFirst({
      where: { id, companyId, deletedAt: null },
      include: {
        ...TASK_INCLUDE,
        comments: {
          where: { deletedAt: null },
          include: {
            user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
        subtasks: {
          where: { deletedAt: null },
          include: { assignees: { include: { user: { select: { firstName: true, lastName: true } } } } },
        },
        project: { select: { id: true, name: true, code: true } },
      },
    });

    if (!task) throw new NotFoundException('Task not found');
    return task;
  }

  async getWorkerQueue(companyId: string, userId: string) {
    return this.prisma.task.findMany({
      where: {
        companyId,
        deletedAt: null,
        status: { notIn: ['DONE'] },
        assignees: {
          some: { userId, deletedAt: null },
        },
      },
      include: TASK_INCLUDE,
      orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }],
      take: 50,
    });
  }

  async update(companyId: string, id: string, dto: UpdateTaskDto) {
    const task = await this.prisma.task.findFirst({
      where: { id, companyId, deletedAt: null },
      select: { id: true, projectId: true },
    });

    if (!task) throw new NotFoundException('Task not found');

    const nextProjectId = dto.projectId ?? task.projectId;
    if (dto.projectId && dto.projectId !== task.projectId) {
      const targetProject = await this.prisma.project.findFirst({
        where: { id: dto.projectId, companyId, deletedAt: null },
        select: { id: true },
      });

      if (!targetProject) throw new BadRequestException('Invalid projectId');
    }

    const updated = await this.prisma.task.update({
      where: { id },
      data: {
        projectId: dto.projectId,
        title: dto.title,
        description: dto.description,
        status: dto.status,
        priority: dto.priority,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        estimatedHours: dto.estimatedHours,
      },
      include: TASK_INCLUDE,
    });

    if (dto.status || dto.projectId) {
      await this.recalculateProjectCompletion(companyId, task.projectId);
      if (nextProjectId !== task.projectId) {
        await this.recalculateProjectCompletion(companyId, nextProjectId);
      }
    }

    return updated;
  }

  async updateStatus(companyId: string, id: string, dto: UpdateTaskStatusDto) {
    const task = await this.prisma.task.findFirst({
      where: { id, companyId, deletedAt: null },
      select: { id: true, projectId: true },
    });

    if (!task) throw new NotFoundException('Task not found');

    const updated = await this.prisma.task.update({
      where: { id },
      data: { status: dto.status },
    });

    await this.recalculateProjectCompletion(companyId, task.projectId);

    return updated;
  }

  async remove(companyId: string, id: string) {
    const task = await this.prisma.task.findFirst({
      where: { id, companyId, deletedAt: null },
      select: { id: true, projectId: true },
    });

    if (!task) throw new NotFoundException('Task not found');

    await this.prisma.task.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.recalculateProjectCompletion(companyId, task.projectId);
    return { success: true };
  }

  async addAssignee(companyId: string, taskId: string, userId: string) {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, companyId, deletedAt: null },
      select: { id: true },
    });

    if (!task) throw new NotFoundException('Task not found');

    const user = await this.prisma.user.findFirst({
      where: { id: userId, companyId, deletedAt: null },
      select: { id: true },
    });

    if (!user) throw new NotFoundException('User not found');

    return this.prisma.taskAssignee.upsert({
      where: { companyId_taskId_userId: { companyId, taskId, userId } },
      create: { companyId, taskId, userId },
      update: { deletedAt: null },
    });
  }

  async removeAssignee(companyId: string, taskId: string, userId: string) {
    await this.prisma.taskAssignee.updateMany({
      where: { companyId, taskId, userId },
      data: { deletedAt: new Date() },
    });

    return { success: true };
  }

  async addComment(companyId: string, taskId: string, userId: string, dto: CreateCommentDto) {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, companyId, deletedAt: null },
      select: { id: true },
    });

    if (!task) throw new NotFoundException('Task not found');

    return this.prisma.taskComment.create({
      data: { companyId, taskId, userId, content: dto.content },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
      },
    });
  }

  async listComments(companyId: string, taskId: string) {
    return this.prisma.taskComment.findMany({
      where: { companyId, taskId, deletedAt: null },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async createChecklist(companyId: string, taskId: string, dto: CreateChecklistDto) {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, companyId, deletedAt: null },
      select: { id: true },
    });

    if (!task) throw new NotFoundException('Task not found');

    return this.prisma.taskChecklist.create({
      data: {
        companyId,
        taskId,
        title: dto.title,
        items: dto.items?.length
          ? {
              create: dto.items.map((content) => ({ companyId, content })),
            }
          : undefined,
      },
      include: { items: true },
    });
  }

  async toggleChecklistItem(
    companyId: string,
    taskId: string,
    checklistId: string,
    itemId: string,
  ) {
    const item = await this.prisma.taskChecklistItem.findFirst({
      where: { id: itemId, companyId, checklistId },
    });

    if (!item) throw new NotFoundException('Checklist item not found');

    return this.prisma.taskChecklistItem.update({
      where: { id: itemId },
      data: { isDone: !item.isDone },
    });
  }

  private async recalculateProjectCompletion(companyId: string, projectId: string) {
    const [total, done] = await Promise.all([
      this.prisma.task.count({
        where: { companyId, projectId, deletedAt: null, parentTaskId: null },
      }),
      this.prisma.task.count({
        where: { companyId, projectId, deletedAt: null, parentTaskId: null, status: 'DONE' },
      }),
    ]);

    const pct = total > 0 ? Math.round((done / total) * 100) : 0;

    await this.prisma.project.update({
      where: { id: projectId },
      data: { completionPercent: pct },
    });
  }
}
