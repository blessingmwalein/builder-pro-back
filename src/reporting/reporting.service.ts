import { InjectQueue } from '@nestjs/bull';
import { Injectable } from '@nestjs/common';
import type { Queue } from 'bull';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { GenerateReportDto } from './dto/generate-report.dto';

@Injectable()
export class ReportingService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('reports') private readonly reportsQueue: Queue,
  ) {}

  async generate(companyId: string, generatedById: string, dto: GenerateReportDto) {
    const report = await this.prisma.report.create({
      data: {
        companyId,
        generatedById,
        reportType: dto.reportType,
        filterPayload: dto.filters as Prisma.InputJsonValue | undefined,
        status: 'PENDING',
      },
    });

    await this.reportsQueue.add(
      'generate',
      { reportId: report.id, companyId },
      { attempts: 3, removeOnComplete: true },
    );

    return report;
  }

  async getProjectProgressReport(companyId: string, projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, companyId, deletedAt: null },
      include: {
        tasks: {
          where: { deletedAt: null, parentTaskId: null },
          include: {
            assignees: { include: { user: { select: { firstName: true, lastName: true } } } },
            subtasks: { where: { deletedAt: null }, select: { status: true } },
          },
        },
        budgets: { include: { category: true } },
        materialLogs: {
          select: { totalCost: true },
        },
      },
    });

    if (!project) return null;

    const tasksByStatus = project.tasks.reduce(
      (acc, t) => {
        acc[t.status] = (acc[t.status] ?? 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    const budgetPlanned = project.budgets.reduce((s, b) => s + Number(b.plannedAmount), 0);
    const budgetActual = project.budgets.reduce((s, b) => s + Number(b.actualAmount), 0);
    const materialCosts = project.materialLogs.reduce((s, l) => s + Number(l.totalCost), 0);

    return {
      reportType: 'PROJECT_PROGRESS',
      generatedAt: new Date(),
      project: {
        id: project.id,
        name: project.name,
        code: project.code,
        status: project.status,
        completionPercent: project.completionPercent,
        startDate: project.startDate,
        endDate: project.endDate,
      },
      tasks: { byStatus: tasksByStatus, total: project.tasks.length },
      budget: {
        planned: budgetPlanned,
        actual: budgetActual,
        variance: budgetPlanned - budgetActual,
        percentUsed: budgetPlanned > 0 ? Math.round((budgetActual / budgetPlanned) * 100) : 0,
        breakdown: project.budgets.map((b) => ({
          category: b.category.name,
          planned: Number(b.plannedAmount),
          actual: Number(b.actualAmount),
        })),
      },
      materialCosts,
    };
  }

  async getLabourReport(
    companyId: string,
    from: string,
    to: string,
    projectId?: string,
  ) {
    const where: any = {
      companyId,
      status: { in: ['APPROVED', 'PENDING'] },
      deletedAt: null,
      clockInAt: {
        gte: new Date(from),
        lte: new Date(to + 'T23:59:59'),
      },
    };

    if (projectId) where.projectId = projectId;

    const entries = await this.prisma.timeEntry.findMany({
      where,
      include: {
        worker: { select: { id: true, firstName: true, lastName: true } },
        project: { select: { id: true, name: true } },
      },
    });

    const byWorker = new Map<string, {
      workerId: string;
      name: string;
      regularHours: number;
      overtimeHours: number;
      totalHours: number;
      labourCost: number;
      projects: Set<string>;
    }>();

    for (const entry of entries) {
      const key = entry.workerId;
      if (!byWorker.has(key)) {
        byWorker.set(key, {
          workerId: entry.workerId,
          name: `${entry.worker.firstName} ${entry.worker.lastName}`,
          regularHours: 0,
          overtimeHours: 0,
          totalHours: 0,
          labourCost: 0,
          projects: new Set(),
        });
      }

      const row = byWorker.get(key)!;
      row.regularHours += Number(entry.regularHours);
      row.overtimeHours += Number(entry.overtimeHours);
      row.totalHours += Number(entry.regularHours) + Number(entry.overtimeHours);
      row.labourCost += Number(entry.labourCost);
      row.projects.add(entry.project.name);
    }

    const rows = Array.from(byWorker.values()).map((r) => ({
      ...r,
      projects: Array.from(r.projects),
    }));

    const totals = rows.reduce(
      (s, r) => ({
        regularHours: s.regularHours + r.regularHours,
        overtimeHours: s.overtimeHours + r.overtimeHours,
        totalHours: s.totalHours + r.totalHours,
        labourCost: s.labourCost + r.labourCost,
      }),
      { regularHours: 0, overtimeHours: 0, totalHours: 0, labourCost: 0 },
    );

    return {
      reportType: 'LABOUR',
      generatedAt: new Date(),
      period: { from, to },
      rows,
      totals,
    };
  }

  async getMaterialsReport(companyId: string, projectId?: string, from?: string, to?: string) {
    const where: any = {
      companyId,
      deletedAt: null,
    };

    if (projectId) where.projectId = projectId;
    if (from || to) {
      where.usedAt = {
        gte: from ? new Date(from) : undefined,
        lte: to ? new Date(to) : undefined,
      };
    }

    const logs = await this.prisma.materialLog.findMany({
      where,
      include: {
        material: {
          select: {
            name: true,
            category: true,
            unit: true,
            categoryRef: { select: { name: true } } as any,
          },
        },
        project: { select: { name: true } },
      },
      orderBy: { usedAt: 'desc' },
    });

    const byCategory = new Map<string, { category: string; totalCost: number; quantity: number }>();

    for (const log of logs) {
      const mat = log.material as typeof log.material & { categoryRef?: { name: string } | null };
      const cat = mat.categoryRef?.name ?? mat.category ?? 'Uncategorised';
      if (!byCategory.has(cat)) {
        byCategory.set(cat, { category: cat, totalCost: 0, quantity: 0 });
      }
      const row = byCategory.get(cat)!;
      row.totalCost += Number(log.totalCost);
      row.quantity += Number(log.quantity);
    }

    const totalCost = logs.reduce((s, l) => s + Number(l.totalCost), 0);

    return {
      reportType: 'MATERIALS',
      generatedAt: new Date(),
      totalCost,
      byCategory: Array.from(byCategory.values()),
      logs,
    };
  }

  async getFinancialSummaryReport(companyId: string, from?: string, to?: string) {
    const projectFilter: any = { companyId, deletedAt: null };
    const dateFilter = (from || to)
      ? { issueDate: { gte: from ? new Date(from) : undefined, lte: to ? new Date(to + 'T23:59:59') : undefined } }
      : {};

    const [projects, invoices] = await Promise.all([
      this.prisma.project.findMany({
        where: { ...projectFilter, status: { not: 'DRAFT' } },
        select: {
          id: true,
          name: true,
          code: true,
          status: true,
          baselineBudget: true,
          actualCost: true,
          invoices: {
            where: { deletedAt: null, ...dateFilter },
            select: { totalAmount: true, paidAmount: true, balanceAmount: true, status: true },
          },
        },
      }),
      this.prisma.invoice.findMany({
        where: { ...projectFilter, ...dateFilter },
        select: { totalAmount: true, paidAmount: true, balanceAmount: true, status: true },
      }),
    ]);

    const totalRevenue = invoices.reduce((s, i) => s + Number(i.totalAmount), 0);
    const totalCollected = invoices.reduce((s, i) => s + Number(i.paidAmount), 0);
    const totalOutstanding = invoices.reduce((s, i) => s + Number(i.balanceAmount), 0);

    return {
      reportType: 'FINANCIAL_SUMMARY',
      generatedAt: new Date(),
      totals: { totalRevenue, totalCollected, totalOutstanding },
      projects: projects.map((p) => {
        const rev = p.invoices.reduce((s, i) => s + Number(i.totalAmount), 0);
        const paid = p.invoices.reduce((s, i) => s + Number(i.paidAmount), 0);
        const cost = Number(p.actualCost);
        const margin = rev > 0 ? Math.round(((rev - cost) / rev) * 100) : 0;
        return {
          id: p.id,
          name: p.name,
          code: p.code,
          status: p.status,
          baselineBudget: Number(p.baselineBudget),
          actualCost: cost,
          revenue: rev,
          collected: paid,
          profitMargin: margin,
        };
      }),
    };
  }

  async listReports(companyId: string) {
    return this.prisma.report.findMany({
      where: { companyId, deletedAt: null },
      include: { generatedBy: { select: { firstName: true, lastName: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  // ─── Phase 5 new reports ─────────────────────────────────────────────────────

  async getBudgetVarianceReport(companyId: string, projectId?: string) {
    const where: any = { companyId, deletedAt: null };
    if (projectId) where.projectId = projectId;

    const budgets = await this.prisma.budget.findMany({
      where,
      include: {
        category: { select: { name: true, code: true } },
        project: { select: { id: true, name: true, code: true } },
      },
    });

    const rows = budgets.map((b) => {
      const planned = Number(b.plannedAmount);
      const actual = Number(b.actualAmount);
      const variance = planned - actual;
      const pctUsed = planned > 0 ? Math.round((actual / planned) * 100) : 0;
      return {
        projectId: b.projectId,
        projectName: b.project.name,
        category: b.category.name,
        planned,
        actual,
        variance,
        pctUsed,
        overBudget: actual > planned,
        atRisk: pctUsed >= b.thresholdPct,
      };
    });

    const totals = rows.reduce(
      (s, r) => ({ planned: s.planned + r.planned, actual: s.actual + r.actual }),
      { planned: 0, actual: 0 },
    );

    return {
      reportType: 'BUDGET_VARIANCE',
      generatedAt: new Date(),
      rows,
      totals: { ...totals, variance: totals.planned - totals.actual },
      overBudgetCount: rows.filter((r) => r.overBudget).length,
      atRiskCount: rows.filter((r) => r.atRisk && !r.overBudget).length,
    };
  }

  async getDelayReport(companyId: string) {
    const now = new Date();
    const projects = await this.prisma.project.findMany({
      where: { companyId, deletedAt: null, status: { in: ['ACTIVE', 'ON_HOLD'] } },
      select: {
        id: true,
        name: true,
        code: true,
        status: true,
        startDate: true,
        endDate: true,
        completionPercent: true,
        stages: {
          select: { stageName: true, status: true, plannedStartDate: true, plannedEndDate: true },
          orderBy: { stageOrder: 'asc' },
        },
      },
    });

    const rows = projects.map((p) => {
      const daysDelayed = p.endDate && p.endDate < now
        ? Math.floor((now.getTime() - p.endDate.getTime()) / 86400000)
        : 0;

      const blockedStages = p.stages.filter(
        (s) => s.plannedEndDate && s.plannedEndDate < now && s.status !== 'COMPLETED',
      );

      return {
        id: p.id,
        name: p.name,
        code: p.code,
        status: p.status,
        endDate: p.endDate,
        completionPercent: p.completionPercent,
        daysDelayed,
        isDelayed: daysDelayed > 0,
        blockedStages: blockedStages.map((s) => ({
          name: s.stageName,
          status: s.status,
          daysOverdue: s.plannedEndDate
            ? Math.floor((now.getTime() - s.plannedEndDate.getTime()) / 86400000)
            : 0,
        })),
      };
    });

    rows.sort((a, b) => b.daysDelayed - a.daysDelayed);

    return {
      reportType: 'DELAY',
      generatedAt: new Date(),
      rows,
      delayedCount: rows.filter((r) => r.isDelayed).length,
      onTrackCount: rows.filter((r) => !r.isDelayed).length,
    };
  }

  async getProfitabilityReport(companyId: string, from?: string, to?: string) {
    const projectFilter: any = { companyId, deletedAt: null, status: { not: 'DRAFT' } };

    const projects = await this.prisma.project.findMany({
      where: projectFilter,
      select: {
        id: true,
        name: true,
        code: true,
        status: true,
        baselineBudget: true,
        actualCost: true,
        startDate: true,
        endDate: true,
        invoices: {
          where: {
            deletedAt: null,
            ...(from || to
              ? { issueDate: { gte: from ? new Date(from) : undefined, lte: to ? new Date(to + 'T23:59:59') : undefined } }
              : {}),
          },
          select: { totalAmount: true, paidAmount: true, status: true },
        },
      },
    });

    const rows = projects.map((p) => {
      const revenue = p.invoices.reduce((s, i) => s + Number(i.totalAmount), 0);
      const collected = p.invoices.reduce((s, i) => s + Number(i.paidAmount), 0);
      const cost = Number(p.actualCost);
      const grossProfit = revenue - cost;
      const margin = revenue > 0 ? Math.round((grossProfit / revenue) * 100) : 0;
      return {
        id: p.id,
        name: p.name,
        code: p.code,
        status: p.status,
        baselineBudget: Number(p.baselineBudget),
        actualCost: cost,
        revenue,
        collected,
        grossProfit,
        margin,
        invoiceCount: p.invoices.length,
      };
    });

    rows.sort((a, b) => b.grossProfit - a.grossProfit);

    const totals = rows.reduce(
      (s, r) => ({
        revenue: s.revenue + r.revenue,
        actualCost: s.actualCost + r.actualCost,
        grossProfit: s.grossProfit + r.grossProfit,
      }),
      { revenue: 0, actualCost: 0, grossProfit: 0 },
    );

    return {
      reportType: 'PROFITABILITY',
      generatedAt: new Date(),
      period: { from, to },
      rows,
      totals: {
        ...totals,
        margin: totals.revenue > 0 ? Math.round((totals.grossProfit / totals.revenue) * 100) : 0,
        cost: totals.actualCost,
      },
    };
  }

  async getProductivityReport(companyId: string, projectId?: string) {
    const taskWhere: any = { companyId, deletedAt: null, parentTaskId: null };
    if (projectId) taskWhere.projectId = projectId;

    const [tasks, timeEntries] = await Promise.all([
      this.prisma.task.findMany({
        where: taskWhere,
        select: {
          id: true,
          status: true,
          priority: true,
          estimatedHours: true,
          project: { select: { id: true, name: true } },
        },
      }),
      this.prisma.timeEntry.findMany({
        where: { companyId, status: 'APPROVED', deletedAt: null, ...(projectId ? { projectId } : {}) },
        select: { projectId: true, regularHours: true, overtimeHours: true, project: { select: { name: true } } },
      }),
    ]);

    const byProject = new Map<string, {
      projectId: string;
      projectName: string;
      total: number;
      done: number;
      inProgress: number;
      blocked: number;
      estimatedHours: number;
      actualHours: number;
    }>();

    for (const t of tasks) {
      const key = t.project.id;
      if (!byProject.has(key)) {
        byProject.set(key, {
          projectId: key,
          projectName: t.project.name,
          total: 0,
          done: 0,
          inProgress: 0,
          blocked: 0,
          estimatedHours: 0,
          actualHours: 0,
        });
      }
      const row = byProject.get(key)!;
      row.total++;
      if (t.status === 'DONE') row.done++;
      else if (t.status === 'IN_PROGRESS') row.inProgress++;
      else if (t.status === 'BLOCKED') row.blocked++;
      row.estimatedHours += Number(t.estimatedHours ?? 0);
    }

    for (const e of timeEntries) {
      if (!byProject.has(e.projectId)) {
        byProject.set(e.projectId, {
          projectId: e.projectId,
          projectName: e.project.name,
          total: 0,
          done: 0,
          inProgress: 0,
          blocked: 0,
          estimatedHours: 0,
          actualHours: 0,
        });
      }
      byProject.get(e.projectId)!.actualHours +=
        Number(e.regularHours) + Number(e.overtimeHours);
    }

    const rows = Array.from(byProject.values()).map((r) => ({
      ...r,
      completionRate: r.total > 0 ? Math.round((r.done / r.total) * 100) : 0,
      hoursEfficiency:
        r.estimatedHours > 0 ? Math.round((r.estimatedHours / r.actualHours) * 100) : null,
    }));

    const totals = rows.reduce(
      (s, r) => ({ total: s.total + r.total, done: s.done + r.done }),
      { total: 0, done: 0 },
    );

    return {
      reportType: 'PRODUCTIVITY',
      generatedAt: new Date(),
      rows,
      totals: {
        ...totals,
        completionRate: totals.total > 0 ? Math.round((totals.done / totals.total) * 100) : 0,
      },
    };
  }
}
