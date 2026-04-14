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
      status: 'APPROVED',
      deletedAt: null,
      clockInAt: {
        gte: new Date(from),
        lte: new Date(to),
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
        material: { select: { name: true, category: true, unit: true } },
        project: { select: { name: true } },
      },
      orderBy: { usedAt: 'desc' },
    });

    const byCategory = new Map<string, { category: string; totalCost: number; quantity: number }>();

    for (const log of logs) {
      const cat = log.material.category ?? 'Uncategorised';
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
            where: { deletedAt: null },
            select: { totalAmount: true, paidAmount: true, balanceAmount: true, status: true },
          },
        },
      }),
      this.prisma.invoice.findMany({
        where: { ...projectFilter },
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
}
