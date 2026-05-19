import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { CreateApprovalDto } from './dto/create-approval.dto';
import { DecideStepDto } from './dto/decide-step.dto';

const APPROVAL_INCLUDE = {
  requestedBy: { select: { id: true, firstName: true, lastName: true } },
  steps: {
    orderBy: { stepOrder: 'asc' as const },
    include: { approver: { select: { id: true, firstName: true, lastName: true } } },
  },
};

@Injectable()
export class ApprovalsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(companyId: string, requestedById: string, dto: CreateApprovalDto) {
    if (!dto.approverIds.length) {
      throw new BadRequestException('At least one approver is required');
    }

    return this.prisma.$transaction(async (tx) => {
      const ar = await (tx as any).approvalRequest.create({
        data: {
          companyId,
          entityType: dto.entityType,
          entityId: dto.entityId,
          requestedById,
          notes: dto.notes ?? null,
          steps: {
            create: dto.approverIds.map((approverId, idx) => ({
              stepOrder: idx + 1,
              approverId,
              status: idx === 0 ? 'PENDING' : 'PENDING',
            })),
          },
        },
        include: APPROVAL_INCLUDE,
      });
      return ar;
    });
  }

  async list(
    companyId: string,
    query: PaginationQueryDto & { entityType?: string; status?: string; myPending?: string },
    userId: string,
  ) {
    const limit = Math.min(query.limit ?? 20, 100);
    const skip = ((query.page ?? 1) - 1) * limit;
    const where: any = { companyId };
    if (query.entityType) where.entityType = query.entityType;
    if (query.status) where.status = query.status;
    if (query.myPending === 'true') {
      where.steps = { some: { approverId: userId, status: 'PENDING' } };
      where.status = 'PENDING';
    }

    const [items, total] = await this.prisma.$transaction([
      (this.prisma as any).approvalRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: APPROVAL_INCLUDE,
      }),
      (this.prisma as any).approvalRequest.count({ where }),
    ]);
    return { items, meta: { page: query.page ?? 1, limit, total } };
  }

  async findOne(companyId: string, id: string) {
    const ar = await (this.prisma as any).approvalRequest.findFirst({
      where: { id, companyId },
      include: APPROVAL_INCLUDE,
    });
    if (!ar) throw new NotFoundException('Approval request not found');
    return ar;
  }

  async pendingCount(companyId: string, userId: string): Promise<{ count: number }> {
    const count = await (this.prisma as any).approvalRequest.count({
      where: {
        companyId,
        status: 'PENDING',
        steps: { some: { approverId: userId, status: 'PENDING' } },
      },
    });
    return { count };
  }

  async decide(companyId: string, requestId: string, stepId: string, userId: string, dto: DecideStepDto) {
    const ar = await this.findOne(companyId, requestId);

    if (ar.status !== 'PENDING') {
      throw new BadRequestException('Approval request is no longer pending');
    }

    const step = ar.steps.find((s: any) => s.id === stepId);
    if (!step) throw new NotFoundException('Step not found');
    if (step.approverId !== userId) throw new ForbiddenException('You are not the assigned approver for this step');
    if (step.status !== 'PENDING') throw new BadRequestException('This step has already been decided');

    return this.prisma.$transaction(async (tx) => {
      // Update the step
      await (tx as any).approvalStep.update({
        where: { id: stepId },
        data: { status: dto.decision, comment: dto.comment ?? null, decidedAt: new Date() },
      });

      if (dto.decision === 'REJECTED') {
        // Reject the whole request immediately
        await (tx as any).approvalRequest.update({
          where: { id: requestId },
          data: { status: 'REJECTED', updatedAt: new Date() },
        });
        await this.propagateEntityStatus(tx, ar.entityType, ar.entityId, 'REJECTED');
      } else {
        // Check if all steps approved
        const pendingSteps = ar.steps.filter((s: any) => s.id !== stepId && s.status === 'PENDING');
        if (pendingSteps.length === 0) {
          // All approved
          await (tx as any).approvalRequest.update({
            where: { id: requestId },
            data: { status: 'APPROVED', updatedAt: new Date() },
          });
          await this.propagateEntityStatus(tx, ar.entityType, ar.entityId, 'APPROVED');
        }
      }

      return (tx as any).approvalRequest.findFirst({
        where: { id: requestId },
        include: APPROVAL_INCLUDE,
      });
    });
  }

  async cancel(companyId: string, id: string, requestedById: string) {
    const ar = await this.findOne(companyId, id);
    if (ar.requestedById !== requestedById) throw new ForbiddenException('Only the requester can cancel');
    if (ar.status !== 'PENDING') throw new BadRequestException('Can only cancel a PENDING request');
    return (this.prisma as any).approvalRequest.update({
      where: { id },
      data: { status: 'CANCELLED', updatedAt: new Date() },
    });
  }

  private async propagateEntityStatus(tx: any, entityType: string, entityId: string, decision: 'APPROVED' | 'REJECTED') {
    switch (entityType) {
      case 'PROCUREMENT_PR':
        await (tx as any).purchaseRequest.updateMany({
          where: { id: entityId },
          data: { status: decision === 'APPROVED' ? 'APPROVED' : 'REJECTED' },
        });
        break;
      case 'PROCUREMENT_PO':
        if (decision === 'APPROVED') {
          await (tx as any).purchaseOrder.updateMany({
            where: { id: entityId },
            data: { status: 'SENT' },
          });
        }
        break;
      case 'CHANGE_REQUEST':
        await (tx as any).changeRequest.updateMany({
          where: { id: entityId },
          data: { status: decision === 'APPROVED' ? 'APPROVED' : 'REJECTED' },
        });
        break;
      // BUDGET, DOCUMENT, STAGE — no automatic status change, caller handles
      default:
        break;
    }
  }
}
