import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { enforcePlanLimit } from '../common/helpers/plan-limits.helper';
import { AddProjectMemberDto } from './dto/add-project-member.dto';
import { CreateProjectDto } from './dto/create-project.dto';
import { QueryProjectsDto } from './dto/query-projects.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(companyId: string, dto: CreateProjectDto) {
    await enforcePlanLimit(this.prisma, companyId, 'projects');
    const code = await this.resolveProjectCode(companyId, dto.code, dto.name);

    return this.prisma.project.create({
      data: {
        companyId,
        clientId: dto.clientId,
        projectManagerId: dto.projectManagerId,
        code,
        name: dto.name,
        description: dto.description,
        status: dto.status,
        projectType: dto.projectType,
        siteAddress: dto.siteAddress,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        baselineBudget: dto.baselineBudget,
      },
      include: {
        client: { select: { id: true, name: true } },
      },
    });
  }

  async findMany(companyId: string, query: QueryProjectsDto) {
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

    if (query.status) {
      where.status = query.status;
    }

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' as const } },
        { code: { contains: query.search, mode: 'insensitive' as const } },
      ];
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.project.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          client: { select: { id: true, name: true } },
          _count: {
            select: { tasks: true, members: true },
          },
        },
      }),
      this.prisma.project.count({ where }),
    ]);

    return {
      items,
      meta: { page, limit, total },
    };
  }

  private async resolveProjectCode(companyId: string, providedCode: string | undefined, name: string): Promise<string> {
    const manualCode = providedCode?.trim();
    if (manualCode) {
      return manualCode;
    }

    const initials = name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 3)
      .map((part) => part[0]?.toUpperCase())
      .join('') || 'PRJ';
    const year = new Date().getFullYear();

    for (let attempt = 1; attempt <= 10; attempt++) {
      const candidate = `${initials}-${year}-${Math.floor(100 + Math.random() * 900)}`;
      const exists = await this.prisma.project.findFirst({
        where: { companyId, code: candidate },
        select: { id: true },
      });

      if (!exists) {
        return candidate;
      }
    }

    return `${initials}-${year}-${Date.now().toString().slice(-6)}`;
  }

  async findOne(companyId: string, id: string) {
    const project = await this.prisma.project.findFirst({
      where: { id, companyId, deletedAt: null },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            contactPerson: true,
            clientType: true,
            email: true,
            phone: true,
            address: true,
            notes: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        members: {
          where: { deletedAt: null },
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true },
            },
          },
        },
        _count: {
          select: {
            tasks: true,
            timeEntries: true,
            materialLogs: true,
            documents: true,
          },
        },
      },
    });

    if (!project) throw new NotFoundException('Project not found');
    return project;
  }

  async getDashboard(companyId: string, projectId: string) {
    const project = await this.findOne(companyId, projectId);

    const [
      taskStats,
      recentActivity,
      budgetData,
      overdueCount,
      quoteStats,
      invoiceStats,
      variationStats,
      timeEntryStats,
      materialStats,
      latestQuote,
      latestInvoice,
      latestForecast,
      projectManager,
    ] =
      await Promise.all([
        this.prisma.task.groupBy({
          by: ['status'],
          where: { companyId, projectId, deletedAt: null },
          _count: { _all: true },
        }),
        this.prisma.task.findMany({
          where: { companyId, projectId, deletedAt: null },
          orderBy: { updatedAt: 'desc' },
          take: 5,
          select: {
            id: true,
            title: true,
            status: true,
            updatedAt: true,
            assignees: {
              include: {
                user: { select: { firstName: true, lastName: true } },
              },
            },
          },
        }),
        this.prisma.budget.findMany({
          where: { companyId, projectId, deletedAt: null },
          include: {
            category: { select: { name: true, code: true } },
          },
        }),
        this.prisma.task.count({
          where: {
            companyId,
            projectId,
            deletedAt: null,
            dueDate: { lt: new Date() },
            status: { notIn: ['DONE'] },
          },
        }),
        this.prisma.quote.aggregate({
          where: { companyId, projectId, deletedAt: null },
          _count: { _all: true },
          _sum: { totalAmount: true },
        }),
        this.prisma.invoice.aggregate({
          where: { companyId, projectId, deletedAt: null },
          _count: { _all: true },
          _sum: { totalAmount: true, paidAmount: true, balanceAmount: true },
        }),
        this.prisma.variation.aggregate({
          where: { companyId, projectId, deletedAt: null },
          _count: { _all: true },
          _sum: { totalAmount: true },
        }),
        this.prisma.timeEntry.aggregate({
          where: { companyId, projectId, deletedAt: null },
          _count: { _all: true },
          _sum: { regularHours: true, overtimeHours: true, labourCost: true },
        }),
        this.prisma.materialLog.aggregate({
          where: { companyId, projectId, deletedAt: null },
          _count: { _all: true },
          _sum: { totalCost: true },
        }),
        this.prisma.quote.findFirst({
          where: { companyId, projectId, deletedAt: null },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            quoteNumber: true,
            status: true,
            totalAmount: true,
            issueDate: true,
            expiryDate: true,
            createdAt: true,
          },
        }),
        this.prisma.invoice.findFirst({
          where: { companyId, projectId, deletedAt: null },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            invoiceNumber: true,
            status: true,
            totalAmount: true,
            paidAmount: true,
            balanceAmount: true,
            issueDate: true,
            dueDate: true,
            createdAt: true,
          },
        }),
        this.prisma.costForecast.findFirst({
          where: { companyId, projectId, deletedAt: null },
          orderBy: { estimateAt: 'desc' },
        }),
        project.projectManagerId
          ? this.prisma.user.findFirst({
              where: { id: project.projectManagerId, companyId, deletedAt: null },
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
                avatarUrl: true,
                employee: {
                  select: { employeeCode: true, jobTitle: true, department: true, trade: true },
                },
              },
            })
          : Promise.resolve(null),
      ]);

    const tasksByStatus = Object.fromEntries(
      taskStats.map((s) => [s.status, s._count._all]),
    );

    const budgetPlanned = budgetData.reduce(
      (s, b) => s + Number(b.plannedAmount),
      0,
    );
    const budgetActual = budgetData.reduce(
      (s, b) => s + Number(b.actualAmount),
      0,
    );
    const baselineBudget = Number(project.baselineBudget ?? 0);
    const actualProjectCost = Number(project.actualCost ?? 0);

    const totalTasks = taskStats.reduce((sum, s) => sum + s._count._all, 0);
    const doneTasks = taskStats.find((s) => s.status === 'DONE')?._count._all ?? 0;

    const daysElapsed = project.startDate
      ? Math.floor(
          (Date.now() - project.startDate.getTime()) / (1000 * 60 * 60 * 24),
        )
      : 0;
    const totalDays =
      project.startDate && project.endDate
        ? Math.floor(
            (project.endDate.getTime() - project.startDate.getTime()) /
              (1000 * 60 * 60 * 24),
          )
        : null;
    const daysRemaining = project.endDate
      ? Math.ceil((project.endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      : null;

    const members = project.members.map((member) => ({
      id: member.id,
      role: member.role,
      userId: member.userId,
      fullName: `${member.user.firstName} ${member.user.lastName}`.trim(),
      email: member.user.email,
      avatarUrl: member.user.avatarUrl,
      createdAt: member.createdAt,
    }));

    return {
      project: {
        id: project.id,
        companyId: project.companyId,
        name: project.name,
        code: project.code,
        description: project.description,
        status: project.status,
        projectType: project.projectType,
        siteAddress: project.siteAddress,
        gpsLat: project.gpsLat !== null ? Number(project.gpsLat) : null,
        gpsLng: project.gpsLng !== null ? Number(project.gpsLng) : null,
        clientId: project.clientId,
        projectManagerId: project.projectManagerId,
        baselineBudget,
        actualCost: actualProjectCost,
        completionPercent: project.completionPercent,
        isArchived: project.isArchived,
        startDate: project.startDate,
        endDate: project.endDate,
        actualEndDate: project.actualEndDate,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
        counts: project._count,
      },
      client: project.client,
      team: {
        projectManager,
        membersCount: members.length,
        members,
      },
      timeline: {
        daysElapsed,
        totalDays,
        daysRemaining,
        completionFromTasks: totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0,
      },
      budget: {
        baselineBudget,
        planned: budgetPlanned,
        actual: budgetActual,
        variance: budgetPlanned - budgetActual,
        baselineVariance: baselineBudget - actualProjectCost,
        projectRecordedVariance: budgetPlanned - actualProjectCost,
        percentUsed:
          budgetPlanned > 0
            ? Math.round((budgetActual / budgetPlanned) * 100)
            : 0,
        baselineUtilization:
          baselineBudget > 0
            ? Math.round((actualProjectCost / baselineBudget) * 100)
            : 0,
        byCategory: budgetData,
      },
      financials: {
        quotes: {
          count: quoteStats._count._all,
          totalAmount: Number(quoteStats._sum.totalAmount ?? 0),
          latest: latestQuote
            ? {
                ...latestQuote,
                totalAmount: Number(latestQuote.totalAmount),
              }
            : null,
        },
        invoices: {
          count: invoiceStats._count._all,
          totalAmount: Number(invoiceStats._sum.totalAmount ?? 0),
          paidAmount: Number(invoiceStats._sum.paidAmount ?? 0),
          balanceAmount: Number(invoiceStats._sum.balanceAmount ?? 0),
          latest: latestInvoice
            ? {
                ...latestInvoice,
                totalAmount: Number(latestInvoice.totalAmount),
                paidAmount: Number(latestInvoice.paidAmount),
                balanceAmount: Number(latestInvoice.balanceAmount),
              }
            : null,
        },
        variations: {
          count: variationStats._count._all,
          totalAmount: Number(variationStats._sum.totalAmount ?? 0),
        },
        labour: {
          entries: timeEntryStats._count._all,
          regularHours: Number(timeEntryStats._sum.regularHours ?? 0),
          overtimeHours: Number(timeEntryStats._sum.overtimeHours ?? 0),
          totalLabourCost: Number(timeEntryStats._sum.labourCost ?? 0),
        },
        materials: {
          logs: materialStats._count._all,
          totalCost: Number(materialStats._sum.totalCost ?? 0),
        },
        latestForecast: latestForecast
          ? {
              ...latestForecast,
              costToComplete: Number(latestForecast.costToComplete),
              projectedProfit: Number(latestForecast.projectedProfit),
            }
          : null,
      },
      tasks: {
        total: totalTasks,
        done: doneTasks,
        byStatus: tasksByStatus,
        overdueCount,
        recentActivity,
      },
      alerts: {
        budgetExceeded: budgetActual > budgetPlanned,
        baselineBudgetExceeded: actualProjectCost > baselineBudget,
        budgetWarning: budgetPlanned > 0 && budgetActual / budgetPlanned >= 0.8,
        overdueTasksExist: overdueCount > 0,
        projectPastDeadline:
          !!project.endDate && project.endDate.getTime() < Date.now() && project.status !== 'COMPLETED',
      },
    };
  }

  async update(companyId: string, id: string, dto: UpdateProjectDto) {
    const project = await this.prisma.project.findFirst({
      where: { id, companyId, deletedAt: null },
      select: { id: true },
    });

    if (!project) throw new NotFoundException('Project not found');

    return this.prisma.project.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        status: dto.status,
        projectType: dto.projectType,
        siteAddress: dto.siteAddress,
        clientId: dto.clientId,
        projectManagerId: dto.projectManagerId,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        actualEndDate: dto.actualEndDate ? new Date(dto.actualEndDate) : undefined,
        baselineBudget: dto.baselineBudget,
      },
    });
  }

  async remove(companyId: string, id: string) {
    const project = await this.prisma.project.findFirst({
      where: { id, companyId, deletedAt: null },
      select: { id: true },
    });

    if (!project) throw new NotFoundException('Project not found');

    await this.prisma.project.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return { success: true };
  }

  async addMember(companyId: string, projectId: string, dto: AddProjectMemberDto) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, companyId, deletedAt: null },
      select: { id: true },
    });

    if (!project) throw new NotFoundException('Project not found');

    const user = await this.prisma.user.findFirst({
      where: { id: dto.userId, companyId, deletedAt: null },
      select: { id: true },
    });

    if (!user) throw new NotFoundException('User not found');

    const existing = await this.prisma.projectMember.findFirst({
      where: { companyId, projectId, userId: dto.userId, deletedAt: null },
    });

    if (existing) throw new ConflictException('User is already a project member');

    return this.prisma.projectMember.create({
      data: {
        companyId,
        projectId,
        userId: dto.userId,
        role: dto.role,
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });
  }

  async removeMember(companyId: string, projectId: string, userId: string) {
    await this.prisma.projectMember.updateMany({
      where: { companyId, projectId, userId },
      data: { deletedAt: new Date() },
    });

    return { success: true };
  }

  async listMembers(companyId: string, projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, companyId, deletedAt: null },
      select: { id: true },
    });

    if (!project) throw new NotFoundException('Project not found');

    return this.prisma.projectMember.findMany({
      where: { companyId, projectId, deletedAt: null },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatarUrl: true,
            employee: { select: { jobTitle: true, department: true } },
          },
        },
      },
    });
  }

  async recalculateCompletion(companyId: string, projectId: string) {
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

    return pct;
  }
}
