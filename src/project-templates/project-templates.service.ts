import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';

@Injectable()
export class ProjectTemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(companyId: string, dto: CreateTemplateDto) {
    const template = await (this.prisma as any).projectTemplate.create({
      data: {
        companyId,
        name: dto.name,
        description: dto.description,
        constructionType: dto.constructionType,
        isDefault: dto.isDefault ?? false,
        stages: dto.stages
          ? {
              create: dto.stages.map((s) => ({
                workflowCode: s.workflowCode,
                stageOrder: s.stageOrder,
                isRequired: s.isRequired ?? true,
                requiresApproval: s.requiresApproval ?? false,
                approvalRoles: s.approvalRoles ?? [],
              })),
            }
          : undefined,
        roles: dto.roles
          ? {
              create: dto.roles.map((r) => ({
                roleCode: r.roleCode,
                isRequired: r.isRequired ?? false,
              })),
            }
          : undefined,
        budgetLines: dto.budgetLines
          ? {
              create: dto.budgetLines.map((b) => ({
                categoryCode: b.categoryCode,
                suggestedPct: b.suggestedPct ?? null,
              })),
            }
          : undefined,
        approvalRules: dto.approvalRules
          ? {
              create: dto.approvalRules.map((a) => ({
                entityType: a.entityType,
                approverRoles: a.approverRoles,
                minApprovers: a.minApprovers ?? 1,
              })),
            }
          : undefined,
      },
      include: this.fullInclude(),
    });

    // Handle tasks and documents after stages are created (need stage IDs for lookup)
    if (dto.tasks?.length || dto.documents?.length) {
      await this.upsertTasksAndDocs(template.id, template.stages, dto);
    }

    return (this.prisma as any).projectTemplate.findUnique({
      where: { id: template.id },
      include: this.fullInclude(),
    });
  }

  async findMany(companyId: string) {
    return (this.prisma as any).projectTemplate.findMany({
      where: { companyId, isArchived: false, deletedAt: null },
      include: {
        stages: true,
        roles: true,
        budgetLines: true,
        _count: { select: { tasks: true, documents: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(companyId: string, id: string) {
    const tpl = await (this.prisma as any).projectTemplate.findFirst({
      where: { id, companyId, deletedAt: null },
      include: this.fullInclude(),
    });
    if (!tpl) throw new NotFoundException('Template not found');
    return tpl;
  }

  async update(companyId: string, id: string, dto: UpdateTemplateDto) {
    const existing = await this.findOne(companyId, id);

    // Delete and recreate nested relations if provided
    await this.prisma.$transaction(async (tx) => {
      if (dto.stages !== undefined) {
        await (tx as any).templateTask.deleteMany({ where: { templateId: id } });
        await (tx as any).templateDocument.deleteMany({ where: { templateId: id } });
        await (tx as any).templateStage.deleteMany({ where: { templateId: id } });
      }
      if (dto.roles !== undefined) {
        await (tx as any).templateRole.deleteMany({ where: { templateId: id } });
      }
      if (dto.budgetLines !== undefined) {
        await (tx as any).templateBudgetLine.deleteMany({ where: { templateId: id } });
      }
      if (dto.approvalRules !== undefined) {
        await (tx as any).templateApprovalRule.deleteMany({ where: { templateId: id } });
      }

      await (tx as any).projectTemplate.update({
        where: { id },
        data: {
          name: dto.name ?? existing.name,
          description: dto.description ?? existing.description,
          constructionType: dto.constructionType ?? existing.constructionType,
          isDefault: dto.isDefault ?? existing.isDefault,
          version: { increment: 1 },
          stages: dto.stages
            ? {
                create: dto.stages.map((s) => ({
                  workflowCode: s.workflowCode,
                  stageOrder: s.stageOrder,
                  isRequired: s.isRequired ?? true,
                  requiresApproval: s.requiresApproval ?? false,
                  approvalRoles: s.approvalRoles ?? [],
                })),
              }
            : undefined,
          roles: dto.roles
            ? { create: dto.roles.map((r) => ({ roleCode: r.roleCode, isRequired: r.isRequired ?? false })) }
            : undefined,
          budgetLines: dto.budgetLines
            ? { create: dto.budgetLines.map((b) => ({ categoryCode: b.categoryCode, suggestedPct: b.suggestedPct ?? null })) }
            : undefined,
          approvalRules: dto.approvalRules
            ? { create: dto.approvalRules.map((a) => ({ entityType: a.entityType, approverRoles: a.approverRoles, minApprovers: a.minApprovers ?? 1 })) }
            : undefined,
        },
      });
    });

    const updated = await (this.prisma as any).projectTemplate.findUnique({
      where: { id },
      include: { stages: true },
    });

    if (dto.tasks?.length || dto.documents?.length) {
      await this.upsertTasksAndDocs(id, updated.stages, dto);
    }

    return this.findOne(companyId, id);
  }

  async duplicate(companyId: string, id: string) {
    const source = await this.findOne(companyId, id);

    const copy = await (this.prisma as any).projectTemplate.create({
      data: {
        companyId,
        name: `${source.name} (Copy)`,
        description: source.description,
        constructionType: source.constructionType,
        isDefault: false,
      },
    });

    // Replicate stages, capturing old → new ID map for tasks/docs
    const stageIdMap: Record<string, string> = {};
    for (const stage of source.stages) {
      const newStage = await (this.prisma as any).templateStage.create({
        data: {
          templateId: copy.id,
          workflowCode: stage.workflowCode,
          stageOrder: stage.stageOrder,
          isRequired: stage.isRequired,
          requiresApproval: stage.requiresApproval,
          approvalRoles: stage.approvalRoles,
        },
      });
      stageIdMap[stage.id] = newStage.id;
    }

    const taskData = source.tasks.map((t: any) => ({
      templateId: copy.id,
      stageId: t.stageId ? stageIdMap[t.stageId] ?? null : null,
      title: t.title,
      description: t.description,
      roleCode: t.roleCode,
      priority: t.priority,
      order: t.order,
    }));
    if (taskData.length) await (this.prisma as any).templateTask.createMany({ data: taskData });

    const docData = source.documents.map((d: any) => ({
      templateId: copy.id,
      stageId: d.stageId ? stageIdMap[d.stageId] ?? null : null,
      documentType: d.documentType,
      name: d.name,
      description: d.description,
      isRequired: d.isRequired,
      requiresApproval: d.requiresApproval,
    }));
    if (docData.length) await (this.prisma as any).templateDocument.createMany({ data: docData });

    const roleData = source.roles.map((r: any) => ({ templateId: copy.id, roleCode: r.roleCode, isRequired: r.isRequired }));
    if (roleData.length) await (this.prisma as any).templateRole.createMany({ data: roleData });

    const budgetData = source.budgetLines.map((b: any) => ({ templateId: copy.id, categoryCode: b.categoryCode, suggestedPct: b.suggestedPct }));
    if (budgetData.length) await (this.prisma as any).templateBudgetLine.createMany({ data: budgetData });

    const approvalData = source.approvalRules.map((a: any) => ({ templateId: copy.id, entityType: a.entityType, approverRoles: a.approverRoles, minApprovers: a.minApprovers }));
    if (approvalData.length) await (this.prisma as any).templateApprovalRule.createMany({ data: approvalData });

    return (this.prisma as any).projectTemplate.findUnique({
      where: { id: copy.id },
      include: this.fullInclude(),
    });
  }

  async archive(companyId: string, id: string) {
    await this.findOne(companyId, id);
    await (this.prisma as any).projectTemplate.update({
      where: { id },
      data: { isArchived: true, deletedAt: new Date() },
    });
    return { success: true };
  }

  /**
   * Core instantiation engine — called when a project is created from a template.
   * Creates ProjectStage rows, Task rows, and Budget rows for the new project.
   */
  async instantiate(
    companyId: string,
    projectId: string,
    templateId: string,
    baselineBudget: number,
  ) {
    const tpl = await (this.prisma as any).projectTemplate.findFirst({
      where: { id: templateId, companyId, deletedAt: null },
      include: this.fullInclude(),
    });
    if (!tpl) throw new NotFoundException('Template not found');

    // 1. Create ProjectStage rows from template stages
    if (tpl.stages.length > 0) {
      const stageData = tpl.stages.map((s: any) => ({
        companyId,
        projectId,
        workflowCode: s.workflowCode,
        stageName: s.workflowCode,
        stageOrder: s.stageOrder,
        requiresApproval: s.requiresApproval,
      }));
      await (this.prisma as any).projectStage.createMany({ data: stageData, skipDuplicates: true });
    }

    // 2. Create Task rows from template tasks
    if (tpl.tasks.length > 0) {
      const taskData = tpl.tasks.map((t: any) => ({
        companyId,
        projectId,
        title: t.title,
        description: t.roleCode ? `[${t.roleCode}] ${t.description ?? ''}`.trim() : t.description,
        priority: t.priority,
        status: 'TODO',
      }));
      await this.prisma.task.createMany({ data: taskData });
    }

    // 3. Create Budget rows from template budget lines
    if (tpl.budgetLines.length > 0 && baselineBudget > 0) {
      const budgetData = tpl.budgetLines
        .filter((b: any) => b.suggestedPct != null)
        .map((b: any) => ({
          companyId,
          projectId,
          categoryCode: b.categoryCode,
          plannedAmount: parseFloat((baselineBudget * (Number(b.suggestedPct) / 100)).toFixed(2)),
        }));
      if (budgetData.length) {
        await (this.prisma as any).budget.createMany({ data: budgetData, skipDuplicates: true });
      }
    }

    return {
      stagesCreated: tpl.stages.length,
      tasksCreated: tpl.tasks.length,
      budgetLinesCreated: tpl.budgetLines.filter((b: any) => b.suggestedPct != null).length,
      suggestedRoles: tpl.roles,
    };
  }

  private fullInclude() {
    return {
      stages: { include: { tasks: true, documents: true } },
      tasks: true,
      documents: true,
      roles: true,
      budgetLines: true,
      approvalRules: true,
    };
  }

  private async upsertTasksAndDocs(
    templateId: string,
    stages: any[],
    dto: CreateTemplateDto | UpdateTemplateDto,
  ) {
    // Build workflowCode → stage ID map
    const stageMap: Record<string, string> = {};
    for (const s of stages) stageMap[s.workflowCode] = s.id;

    if (dto.tasks?.length) {
      const taskData = dto.tasks.map((t) => ({
        templateId,
        stageId: t.stageWorkflowCode ? (stageMap[t.stageWorkflowCode] ?? null) : null,
        title: t.title,
        description: t.description ?? null,
        roleCode: t.roleCode ?? null,
        priority: t.priority ?? 'MEDIUM',
        order: t.order ?? 0,
      }));
      await (this.prisma as any).templateTask.createMany({ data: taskData });
    }

    if (dto.documents?.length) {
      const docData = dto.documents.map((d) => ({
        templateId,
        stageId: d.stageWorkflowCode ? (stageMap[d.stageWorkflowCode] ?? null) : null,
        documentType: d.documentType,
        name: d.name,
        description: d.description ?? null,
        isRequired: d.isRequired ?? true,
        requiresApproval: d.requiresApproval ?? false,
      }));
      await (this.prisma as any).templateDocument.createMany({ data: docData });
    }
  }
}
