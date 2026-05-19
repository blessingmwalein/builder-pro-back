import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ChangeRequestStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ApproveChangeRequestDto } from './dto/approve-change-request.dto';
import { CreateChangeRequestDto } from './dto/create-change-request.dto';
import { RejectChangeRequestDto } from './dto/reject-change-request.dto';
import { ReviewChangeRequestDto } from './dto/review-change-request.dto';
import { UpdateChangeRequestDto } from './dto/update-change-request.dto';

@Injectable()
export class ChangeRequestsService {
  constructor(private readonly prisma: PrismaService) {}

  private async generateRequestNumber(companyId: string): Promise<string> {
    const year = new Date().getFullYear();
    const count = await (this.prisma as any).changeRequest.count({
      where: { companyId },
    });
    const seq = String(count + 1).padStart(4, '0');
    return `CR-${year}-${seq}`;
  }

  async create(companyId: string, projectId: string, userId: string, dto: CreateChangeRequestDto) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, companyId, deletedAt: null },
      select: { id: true },
    });
    if (!project) throw new NotFoundException('Project not found');

    const requestNumber = await this.generateRequestNumber(companyId);

    const items = (dto.items ?? []).map((item) => ({
      description: item.description,
      category: item.category,
      quantity: item.quantity,
      unitCost: item.unitCost,
      estimatedCost:
        item.quantity != null && item.unitCost != null
          ? item.quantity * item.unitCost
          : undefined,
    }));

    return (this.prisma as any).changeRequest.create({
      data: {
        companyId,
        projectId,
        requestNumber,
        title: dto.title,
        description: dto.description,
        type: dto.type,
        requestedById: userId,
        items: items.length > 0 ? { create: items } : undefined,
      },
      include: { items: true },
    });
  }

  async findMany(companyId: string, projectId: string, status?: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, companyId, deletedAt: null },
      select: { id: true },
    });
    if (!project) throw new NotFoundException('Project not found');

    const where: any = { companyId, projectId, deletedAt: null };
    if (status) where.status = status;

    return (this.prisma as any).changeRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        requestedBy: { select: { id: true, firstName: true, lastName: true } },
        _count: { select: { items: true } },
      },
    });
  }

  async findOne(companyId: string, id: string) {
    const cr = await (this.prisma as any).changeRequest.findFirst({
      where: { id, companyId, deletedAt: null },
      include: {
        items: true,
        requestedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        reviewedBy: { select: { id: true, firstName: true, lastName: true } },
        approvedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    if (!cr) throw new NotFoundException('Change request not found');
    return cr;
  }

  async update(companyId: string, id: string, dto: UpdateChangeRequestDto) {
    const cr = await (this.prisma as any).changeRequest.findFirst({
      where: { id, companyId, deletedAt: null },
      select: { id: true, status: true },
    });
    if (!cr) throw new NotFoundException('Change request not found');
    if (cr.status !== ChangeRequestStatus.DRAFT) {
      throw new BadRequestException('Only DRAFT change requests can be edited');
    }

    return (this.prisma as any).changeRequest.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.type !== undefined && { type: dto.type }),
      },
      include: { items: true },
    });
  }

  async submit(companyId: string, id: string) {
    const cr = await (this.prisma as any).changeRequest.findFirst({
      where: { id, companyId, deletedAt: null },
      select: { id: true, status: true },
    });
    if (!cr) throw new NotFoundException('Change request not found');
    if (cr.status !== ChangeRequestStatus.DRAFT) {
      throw new BadRequestException('Only DRAFT change requests can be submitted');
    }

    return (this.prisma as any).changeRequest.update({
      where: { id },
      data: { status: ChangeRequestStatus.SUBMITTED },
    });
  }

  async review(companyId: string, id: string, userId: string, dto: ReviewChangeRequestDto) {
    const cr = await (this.prisma as any).changeRequest.findFirst({
      where: { id, companyId, deletedAt: null },
      select: { id: true, status: true },
    });
    if (!cr) throw new NotFoundException('Change request not found');
    if (cr.status !== ChangeRequestStatus.SUBMITTED) {
      throw new BadRequestException('Change request must be SUBMITTED to review');
    }

    return (this.prisma as any).changeRequest.update({
      where: { id },
      data: {
        status: ChangeRequestStatus.UNDER_REVIEW,
        reviewedById: userId,
        reviewedAt: new Date(),
        ...(dto.estimatedCost !== undefined && { estimatedCost: dto.estimatedCost }),
        ...(dto.estimatedDays !== undefined && { estimatedDays: dto.estimatedDays }),
        ...(dto.reviewNotes !== undefined && { reviewNotes: dto.reviewNotes }),
      },
    });
  }

  async approve(companyId: string, id: string, userId: string, dto: ApproveChangeRequestDto) {
    const cr = await (this.prisma as any).changeRequest.findFirst({
      where: { id, companyId, deletedAt: null },
      select: { id: true, status: true, projectId: true },
    });
    if (!cr) throw new NotFoundException('Change request not found');
    if (cr.status !== ChangeRequestStatus.UNDER_REVIEW) {
      throw new BadRequestException('Change request must be UNDER_REVIEW to approve');
    }

    const [updated] = await this.prisma.$transaction(async (tx) => {
      const updateData: any = {
        status: ChangeRequestStatus.APPROVED,
        approvedById: userId,
        approvedAt: new Date(),
        ...(dto.approvedCost !== undefined && { approvedCost: dto.approvedCost }),
        ...(dto.approvedDays !== undefined && { approvedDays: dto.approvedDays }),
        ...(dto.approvalNotes !== undefined && { approvalNotes: dto.approvalNotes }),
      };

      const result = await (tx as any).changeRequest.update({
        where: { id },
        data: updateData,
      });

      if (dto.approvedCost && dto.approvedCost > 0) {
        const project = await tx.project.findFirst({
          where: { id: cr.projectId },
          select: { baselineBudget: true },
        });
        if (project) {
          await tx.project.update({
            where: { id: cr.projectId },
            data: {
              baselineBudget: Number(project.baselineBudget ?? 0) + dto.approvedCost,
            },
          });
        }
      }

      if (dto.approvedDays && dto.approvedDays > 0) {
        const project = await tx.project.findFirst({
          where: { id: cr.projectId },
          select: { endDate: true },
        });
        if (project?.endDate) {
          const newEnd = new Date(project.endDate);
          newEnd.setDate(newEnd.getDate() + dto.approvedDays);
          await tx.project.update({
            where: { id: cr.projectId },
            data: { endDate: newEnd },
          });
        }
      }

      return [result];
    });

    return updated;
  }

  async reject(companyId: string, id: string, userId: string, dto: RejectChangeRequestDto) {
    const cr = await (this.prisma as any).changeRequest.findFirst({
      where: { id, companyId, deletedAt: null },
      select: { id: true, status: true },
    });
    if (!cr) throw new NotFoundException('Change request not found');
    if (
      cr.status === ChangeRequestStatus.IMPLEMENTED ||
      cr.status === ChangeRequestStatus.REJECTED
    ) {
      throw new BadRequestException('Change request cannot be rejected in its current state');
    }

    return (this.prisma as any).changeRequest.update({
      where: { id },
      data: {
        status: ChangeRequestStatus.REJECTED,
        approvedById: userId,
        rejectedAt: new Date(),
        rejectionNotes: dto.rejectionNotes,
      },
    });
  }

  async implement(companyId: string, id: string, userId: string) {
    const cr = await (this.prisma as any).changeRequest.findFirst({
      where: { id, companyId, deletedAt: null },
      select: { id: true, status: true },
    });
    if (!cr) throw new NotFoundException('Change request not found');
    if (cr.status !== ChangeRequestStatus.APPROVED) {
      throw new BadRequestException('Change request must be APPROVED to implement');
    }

    return (this.prisma as any).changeRequest.update({
      where: { id },
      data: {
        status: ChangeRequestStatus.IMPLEMENTED,
        implementedAt: new Date(),
      },
    });
  }
}
