import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { CreateBudgetCategoryDto } from './dto/create-budget-category.dto';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { SetProjectBudgetDto } from './dto/set-project-budget.dto';

/**
 * Default construction-industry budget categories we ensure every company has.
 * Seeded lazily the first time `listBudgetCategories` or `createTransaction`
 * is called, so existing tenants automatically gain P&Gs, Contingency and
 * Unexpected Expenses without a data migration.
 *
 * `code` is the stable identifier — safe to reference from the frontend for
 * things like the "Record Unexpected Cost" quick action.
 */
export const DEFAULT_BUDGET_CATEGORIES = [
  { code: 'LABOUR', name: 'Labour' },
  { code: 'MATERIALS', name: 'Materials' },
  { code: 'EQUIPMENT', name: 'Equipment' },
  { code: 'SUBCONTRACTORS', name: 'Subcontractors' },
  { code: 'P_AND_GS', name: 'Preliminary & Generals (P&Gs)' },
  { code: 'CONTINGENCY', name: 'Contingency' },
  { code: 'UNEXPECTED', name: 'Unexpected Expenses' },
  { code: 'OVERHEADS', name: 'Overheads' },
] as const;

@Injectable()
export class FinancialsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Idempotent: inserts any missing default categories for the tenant.
   * Safe to call on every list/create request.
   */
  private async ensureDefaultBudgetCategories(companyId: string) {
    const existing = await this.prisma.budgetCategory.findMany({
      where: { companyId, deletedAt: null },
      select: { code: true },
    });
    const existingCodes = new Set(existing.map((c) => c.code));
    const missing = DEFAULT_BUDGET_CATEGORIES.filter(
      (c) => !existingCodes.has(c.code),
    );
    if (missing.length === 0) return;
    await this.prisma.budgetCategory.createMany({
      data: missing.map((c) => ({
        companyId,
        code: c.code,
        name: c.name,
      })),
      skipDuplicates: true,
    });
  }

  async summary(companyId: string, projectId?: string) {
    const projectFilter = projectId ? { projectId } : {};

    const [budgetRows, costRows, paidRows] = await Promise.all([
      this.prisma.budget.findMany({
        where: { companyId, deletedAt: null, ...projectFilter },
        select: { plannedAmount: true, actualAmount: true },
      }),
      this.prisma.financialTransaction.findMany({
        where: { companyId, deletedAt: null, ...projectFilter },
        select: { amount: true },
      }),
      this.prisma.invoice.findMany({
        where: { companyId, deletedAt: null, ...projectFilter },
        select: { paidAmount: true, totalAmount: true, balanceAmount: true },
      }),
    ]);

    const budgetPlanned = budgetRows.reduce((s, r) => s + Number(r.plannedAmount), 0);
    const budgetActual = budgetRows.reduce((s, r) => s + Number(r.actualAmount), 0);
    const transactionCosts = costRows.reduce((s, r) => s + Number(r.amount), 0);
    const revenueCollected = paidRows.reduce((s, r) => s + Number(r.paidAmount), 0);
    const revenueExpected = paidRows.reduce((s, r) => s + Number(r.totalAmount), 0);
    const outstanding = paidRows.reduce((s, r) => s + Number(r.balanceAmount), 0);

    const actualCost = Math.max(budgetActual, transactionCosts);
    const profit = revenueCollected - actualCost;

    return {
      budgetPlanned,
      actualCost,
      variance: budgetPlanned - actualCost,
      revenueCollected,
      revenueExpected,
      outstanding,
      profit,
      profitMarginPct: revenueExpected > 0 ? Math.round((profit / revenueExpected) * 100) : 0,
      costToComplete: Math.max(budgetPlanned - actualCost, 0),
    };
  }

  async getCompanyDashboard(companyId: string) {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      activeProjects,
      totalRevenue,
      totalOutstanding,
      budgetAlert,
      recentInvoices,
      monthlyRevenue,
    ] = await Promise.all([
      this.prisma.project.count({
        where: { companyId, status: 'ACTIVE', deletedAt: null },
      }),
      this.prisma.invoice.aggregate({
        where: { companyId, deletedAt: null },
        _sum: { paidAmount: true, totalAmount: true, balanceAmount: true },
      }),
      this.prisma.invoice.aggregate({
        where: {
          companyId,
          deletedAt: null,
          status: { in: ['SENT', 'PARTIALLY_PAID', 'OVERDUE'] },
        },
        _sum: { balanceAmount: true },
      }),
      this.prisma.budget.findMany({
        where: { companyId, deletedAt: null },
        select: { plannedAmount: true, actualAmount: true, thresholdPct: true, project: { select: { name: true, id: true } } },
      }),
      this.prisma.invoice.findMany({
        where: { companyId, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          invoiceNumber: true,
          status: true,
          totalAmount: true,
          dueDate: true,
          client: { select: { name: true } },
        },
      }),
      this.prisma.invoice.findMany({
        where: {
          companyId,
          deletedAt: null,
          issueDate: { gte: monthStart },
        },
        select: { paidAmount: true, totalAmount: true },
      }),
    ]);

    const budgetAlerts = budgetAlert
      .filter((b) => {
        const pct = Number(b.plannedAmount) > 0
          ? (Number(b.actualAmount) / Number(b.plannedAmount)) * 100
          : 0;
        return pct >= b.thresholdPct;
      })
      .map((b) => ({
        project: b.project,
        percentUsed: Math.round(
          (Number(b.actualAmount) / Number(b.plannedAmount)) * 100,
        ),
      }));

    return {
      activeProjects,
      revenue: {
        totalBilled: Number(totalRevenue._sum.totalAmount ?? 0),
        totalCollected: Number(totalRevenue._sum.paidAmount ?? 0),
        totalOutstanding: Number(totalOutstanding._sum.balanceAmount ?? 0),
        monthlyBilled: monthlyRevenue.reduce((s, i) => s + Number(i.totalAmount), 0),
        monthlyCollected: monthlyRevenue.reduce((s, i) => s + Number(i.paidAmount), 0),
      },
      budgetAlerts,
      recentInvoices,
    };
  }

  async getProjectBudget(companyId: string, projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, companyId, deletedAt: null },
      select: { id: true, name: true, baselineBudget: true, actualCost: true },
    });

    if (!project) throw new NotFoundException('Project not found');

    const budgets = await this.prisma.budget.findMany({
      where: { companyId, projectId, deletedAt: null },
      include: { category: true },
    });

    const totalPlanned = budgets.reduce((s, b) => s + Number(b.plannedAmount), 0);
    const totalActual = budgets.reduce((s, b) => s + Number(b.actualAmount), 0);

    return {
      project,
      budgets,
      totalPlanned,
      totalActual,
      variance: totalPlanned - totalActual,
      percentUsed: totalPlanned > 0 ? Math.round((totalActual / totalPlanned) * 100) : 0,
    };
  }

  async setProjectBudget(companyId: string, projectId: string, dto: SetProjectBudgetDto) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, companyId, deletedAt: null },
      select: { id: true },
    });

    if (!project) throw new NotFoundException('Project not found');

    const budgets = await Promise.all(
      dto.lines.map((line) =>
        this.prisma.budget.upsert({
          where: {
            companyId_projectId_categoryId: {
              companyId,
              projectId,
              categoryId: line.categoryId,
            },
          },
          create: {
            companyId,
            projectId,
            categoryId: line.categoryId,
            plannedAmount: line.plannedAmount,
            thresholdPct: line.thresholdPct ?? 80,
          },
          update: {
            plannedAmount: line.plannedAmount,
            thresholdPct: line.thresholdPct ?? 80,
            deletedAt: null,
          },
          include: { category: true },
        }),
      ),
    );

    return budgets;
  }

  async createTransaction(companyId: string, dto: CreateTransactionDto) {
    const project = await this.prisma.project.findFirst({
      where: { id: dto.projectId, companyId, deletedAt: null },
      select: { id: true },
    });

    if (!project) throw new NotFoundException('Project not found');

    const tx = await this.prisma.financialTransaction.create({
      data: {
        companyId,
        projectId: dto.projectId,
        categoryId: dto.categoryId,
        description: dto.description,
        amount: dto.amount,
        occurredAt: dto.occurredAt ? new Date(dto.occurredAt) : new Date(),
        reference: dto.reference,
        sourceType: dto.sourceType ?? 'MANUAL',
      },
    });

    await this.prisma.budget.updateMany({
      where: { companyId, projectId: dto.projectId, categoryId: dto.categoryId, deletedAt: null },
      data: { actualAmount: { increment: dto.amount } },
    });

    await this.prisma.project.update({
      where: { id: dto.projectId },
      data: { actualCost: { increment: dto.amount } },
    });

    return tx;
  }

  async listTransactions(
    companyId: string,
    projectId: string,
    query: PaginationQueryDto,
  ) {
    const limit = Math.min(query.limit, 100);
    const skip = (query.page - 1) * limit;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.financialTransaction.findMany({
        where: { companyId, projectId, deletedAt: null },
        include: { category: true },
        orderBy: { occurredAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.financialTransaction.count({
        where: { companyId, projectId, deletedAt: null },
      }),
    ]);

    return { items, meta: { page: query.page, limit, total } };
  }

  async listBudgetCategories(companyId: string) {
    await this.ensureDefaultBudgetCategories(companyId);
    return this.prisma.budgetCategory.findMany({
      where: { companyId, deletedAt: null },
      orderBy: { name: 'asc' },
    });
  }

  async createBudgetCategory(companyId: string, dto: CreateBudgetCategoryDto) {
    return this.prisma.budgetCategory.create({
      data: {
        companyId,
        name: dto.name,
        code: dto.code.toUpperCase(),
      },
    });
  }
}
