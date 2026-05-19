import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { StageStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ApproveStageDto } from './dto/approve-stage.dto';
import { InitializeStagesDto } from './dto/initialize-stages.dto';
import { UpdateProjectStageDto } from './dto/update-project-stage.dto';

@Injectable()
export class ProjectStagesService {
  constructor(private readonly prisma: PrismaService) {}

  async initializeFromTemplate(
    companyId: string,
    projectId: string,
    dto: InitializeStagesDto,
  ) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, companyId, deletedAt: null },
      select: { id: true },
    });
    if (!project) throw new NotFoundException('Project not found');

    const templates = await (this.prisma as any).workflowTemplate.findMany({
      where: {
        companyId,
        code: { in: dto.workflowCodes },
        isEnabled: true,
      },
    });

    const createData: any[] = [];
    for (const tpl of templates) {
      const stages = Array.isArray(tpl.stages) ? tpl.stages : [];
      for (const stage of stages as any[]) {
        createData.push({
          companyId,
          projectId,
          workflowCode: tpl.code,
          stageName: stage.name,
          stageOrder: stage.order,
          requiresApproval: stage.requiresApproval ?? false,
        });
      }
    }

    if (createData.length === 0) return { created: 0, stages: [] };

    await (this.prisma as any).projectStage.createMany({
      data: createData,
      skipDuplicates: true,
    });

    return this.findByProject(companyId, projectId);
  }

  async findByProject(companyId: string, projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, companyId, deletedAt: null },
      select: { id: true },
    });
    if (!project) throw new NotFoundException('Project not found');

    return (this.prisma as any).projectStage.findMany({
      where: { companyId, projectId },
      orderBy: [{ workflowCode: 'asc' }, { stageOrder: 'asc' }],
      include: {
        approvedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async updateStatus(
    companyId: string,
    projectId: string,
    stageId: string,
    dto: UpdateProjectStageDto,
  ) {
    const stage = await (this.prisma as any).projectStage.findFirst({
      where: { id: stageId, companyId, projectId },
    });
    if (!stage) throw new NotFoundException('Stage not found');

    return (this.prisma as any).projectStage.update({
      where: { id: stageId },
      data: {
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.plannedStartDate !== undefined && { plannedStartDate: new Date(dto.plannedStartDate) }),
        ...(dto.plannedEndDate !== undefined && { plannedEndDate: new Date(dto.plannedEndDate) }),
        ...(dto.actualStartDate !== undefined && { actualStartDate: new Date(dto.actualStartDate) }),
        ...(dto.actualEndDate !== undefined && { actualEndDate: new Date(dto.actualEndDate) }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
      include: {
        approvedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async approveStage(
    companyId: string,
    projectId: string,
    stageId: string,
    userId: string,
    dto: ApproveStageDto,
  ) {
    const stage = await (this.prisma as any).projectStage.findFirst({
      where: { id: stageId, companyId, projectId },
    });
    if (!stage) throw new NotFoundException('Stage not found');
    if (!stage.requiresApproval) {
      throw new BadRequestException('This stage does not require approval');
    }
    if (stage.status === StageStatus.COMPLETED) {
      throw new BadRequestException('Stage is already completed');
    }

    return (this.prisma as any).projectStage.update({
      where: { id: stageId },
      data: {
        status: StageStatus.COMPLETED,
        approvedById: userId,
        approvedAt: new Date(),
        approvalNotes: dto.notes ?? null,
        actualEndDate: new Date(),
      },
      include: {
        approvedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }
}
