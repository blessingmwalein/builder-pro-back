import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { CreatePrDto } from './dto/create-pr.dto';
import { CreatePoDto } from './dto/create-po.dto';
import { ReceiveDeliveryDto } from './dto/receive-delivery.dto';

@Injectable()
export class ProcurementService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Purchase Requests ──────────────────────────────────────────────────────

  async createPR(companyId: string, requestedById: string, dto: CreatePrDto) {
    const prNumber = await this.generatePrNumber(companyId);
    return (this.prisma as any).purchaseRequest.create({
      data: {
        companyId,
        requestedById,
        prNumber,
        projectId: dto.projectId ?? null,
        notes: dto.notes ?? null,
        items: {
          create: dto.items.map((i) => ({
            description: i.description,
            materialId: i.materialId ?? null,
            quantity: i.quantity,
            unit: i.unit,
            estimatedUnitCost: i.estimatedUnitCost ?? null,
          })),
        },
      },
      include: { items: { include: { material: { select: { id: true, name: true, unit: true } } } }, requestedBy: { select: { id: true, firstName: true, lastName: true } } },
    });
  }

  async submitPR(companyId: string, id: string) {
    const pr = await this.findOnePR(companyId, id);
    if (pr.status !== 'DRAFT') throw new BadRequestException('Only DRAFT requests can be submitted');
    return (this.prisma as any).purchaseRequest.update({ where: { id }, data: { status: 'SUBMITTED' } });
  }

  async approvePR(companyId: string, id: string, approverId: string) {
    const pr = await this.findOnePR(companyId, id);
    if (pr.status !== 'SUBMITTED') throw new BadRequestException('Only SUBMITTED requests can be approved');
    return (this.prisma as any).purchaseRequest.update({
      where: { id },
      data: { status: 'APPROVED', approvedById: approverId, approvedAt: new Date() },
    });
  }

  async rejectPR(companyId: string, id: string, approverId: string, notes?: string) {
    const pr = await this.findOnePR(companyId, id);
    if (!['SUBMITTED', 'DRAFT'].includes(pr.status)) throw new BadRequestException('Cannot reject in current state');
    return (this.prisma as any).purchaseRequest.update({
      where: { id },
      data: { status: 'REJECTED', approvedById: approverId, rejectedAt: new Date(), notes: notes ?? pr.notes },
    });
  }

  async listPRs(companyId: string, query: PaginationQueryDto & { projectId?: string; status?: string }) {
    const limit = Math.min(query.limit ?? 20, 100);
    const skip = ((query.page ?? 1) - 1) * limit;
    const where: any = { companyId, deletedAt: null };
    if (query.projectId) where.projectId = query.projectId;
    if (query.status) where.status = query.status;
    const [items, total] = await this.prisma.$transaction([
      (this.prisma as any).purchaseRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          requestedBy: { select: { id: true, firstName: true, lastName: true } },
          approvedBy: { select: { id: true, firstName: true, lastName: true } },
          project: { select: { id: true, name: true } },
          _count: { select: { items: true, orders: true } },
        },
      }),
      (this.prisma as any).purchaseRequest.count({ where }),
    ]);
    return { items, meta: { page: query.page ?? 1, limit, total } };
  }

  async findOnePR(companyId: string, id: string) {
    const pr = await (this.prisma as any).purchaseRequest.findFirst({
      where: { id, companyId, deletedAt: null },
      include: {
        items: { include: { material: { select: { id: true, name: true, unit: true } } } },
        requestedBy: { select: { id: true, firstName: true, lastName: true } },
        approvedBy: { select: { id: true, firstName: true, lastName: true } },
        project: { select: { id: true, name: true } },
        orders: { select: { id: true, poNumber: true, status: true, totalAmount: true } },
      },
    });
    if (!pr) throw new NotFoundException('Purchase request not found');
    return pr;
  }

  // ─── Purchase Orders ────────────────────────────────────────────────────────

  async createPO(companyId: string, dto: CreatePoDto) {
    const poNumber = await this.generatePoNumber(companyId);

    const totalAmount = dto.items.reduce((sum, i) => sum + i.quantity * i.unitCost, 0);

    if (dto.purchaseRequestId) {
      const pr = await (this.prisma as any).purchaseRequest.findFirst({
        where: { id: dto.purchaseRequestId, companyId, deletedAt: null },
      });
      if (!pr) throw new NotFoundException('Purchase request not found');
      if (pr.status !== 'APPROVED') throw new BadRequestException('Purchase request must be APPROVED before creating a PO');
    }

    const po = await (this.prisma as any).purchaseOrder.create({
      data: {
        companyId,
        supplierId: dto.supplierId,
        purchaseRequestId: dto.purchaseRequestId ?? null,
        poNumber,
        totalAmount,
        expectedDelivery: dto.expectedDelivery ? new Date(dto.expectedDelivery) : null,
        notes: dto.notes ?? null,
        items: {
          create: dto.items.map((i) => ({
            description: i.description,
            materialId: i.materialId ?? null,
            quantity: i.quantity,
            unitCost: i.unitCost,
            totalCost: i.quantity * i.unitCost,
          })),
        },
      },
      include: {
        items: { include: { material: { select: { id: true, name: true, unit: true } } } },
        supplier: { select: { id: true, name: true } },
      },
    });

    // Mark linked PR as ORDERED
    if (dto.purchaseRequestId) {
      await (this.prisma as any).purchaseRequest.update({
        where: { id: dto.purchaseRequestId },
        data: { status: 'ORDERED' },
      });
    }

    return po;
  }

  async sendPO(companyId: string, id: string) {
    const po = await this.findOnePO(companyId, id);
    if (po.status !== 'DRAFT') throw new BadRequestException('Only DRAFT POs can be sent');
    return (this.prisma as any).purchaseOrder.update({ where: { id }, data: { status: 'SENT' } });
  }

  async listPOs(companyId: string, query: PaginationQueryDto & { supplierId?: string; status?: string }) {
    const limit = Math.min(query.limit ?? 20, 100);
    const skip = ((query.page ?? 1) - 1) * limit;
    const where: any = { companyId, deletedAt: null };
    if (query.supplierId) where.supplierId = query.supplierId;
    if (query.status) where.status = query.status;
    const [items, total] = await this.prisma.$transaction([
      (this.prisma as any).purchaseOrder.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          supplier: { select: { id: true, name: true } },
          _count: { select: { items: true, deliveryNotes: true } },
        },
      }),
      (this.prisma as any).purchaseOrder.count({ where }),
    ]);
    return { items, meta: { page: query.page ?? 1, limit, total } };
  }

  async findOnePO(companyId: string, id: string) {
    const po = await (this.prisma as any).purchaseOrder.findFirst({
      where: { id, companyId, deletedAt: null },
      include: {
        items: { include: { material: { select: { id: true, name: true, unit: true } } } },
        supplier: { select: { id: true, name: true, email: true } },
        purchaseRequest: { select: { id: true, prNumber: true } },
        deliveryNotes: { include: { items: true } },
      },
    });
    if (!po) throw new NotFoundException('Purchase order not found');
    return po;
  }

  // ─── Delivery Notes ─────────────────────────────────────────────────────────

  async receiveDelivery(companyId: string, poId: string, receivedById: string, dto: ReceiveDeliveryDto) {
    const po = await this.findOnePO(companyId, poId);
    if (!['SENT', 'PARTIAL'].includes(po.status)) {
      throw new BadRequestException('PO must be SENT or PARTIAL to record a delivery');
    }

    return this.prisma.$transaction(async (tx) => {
      const dn = await (tx as any).deliveryNote.create({
        data: {
          companyId,
          purchaseOrderId: poId,
          deliveryDate: new Date(dto.deliveryDate),
          notes: dto.notes ?? null,
          receivedById,
          items: {
            create: dto.items.map((i) => ({
              description: i.description,
              materialId: i.materialId ?? null,
              quantityOrdered: i.quantityOrdered,
              quantityReceived: i.quantityReceived,
            })),
          },
        },
        include: { items: true },
      });

      // Update stock for each item with a linked material
      for (const item of dto.items) {
        if (item.materialId && item.quantityReceived > 0) {
          // Increment stockOnHand
          await (tx as any).material.update({
            where: { id: item.materialId },
            data: { stockOnHand: { increment: item.quantityReceived } },
          });

          // Create a MaterialLog entry (entryType=PURCHASE)
          const poItem = po.items.find((pi: any) => pi.materialId === item.materialId);
          const unitCost = poItem?.unitCost ?? 0;
          await (tx as any).materialLog.create({
            data: {
              companyId,
              materialId: item.materialId,
              quantity: item.quantityReceived,
              unitCost,
              totalCost: Number(unitCost) * item.quantityReceived,
              entryType: 'PURCHASE',
              usedAt: new Date(dto.deliveryDate),
              notes: `PO ${po.poNumber} — delivery note`,
            },
          });
        }
      }

      // Check if PO is fully received
      const totalOrdered = dto.items.reduce((s, i) => s + i.quantityOrdered, 0);
      const totalReceived = dto.items.reduce((s, i) => s + i.quantityReceived, 0);
      const poStatus = totalReceived >= totalOrdered ? 'RECEIVED' : 'PARTIAL';

      await (tx as any).purchaseOrder.update({
        where: { id: poId },
        data: {
          status: poStatus,
          deliveredAt: poStatus === 'RECEIVED' ? new Date() : null,
        },
      });

      return dn;
    });
  }

  async listDeliveries(companyId: string, query: PaginationQueryDto & { poId?: string }) {
    const limit = Math.min(query.limit ?? 20, 100);
    const skip = ((query.page ?? 1) - 1) * limit;
    const where: any = { companyId };
    if (query.poId) where.purchaseOrderId = query.poId;
    const [items, total] = await this.prisma.$transaction([
      (this.prisma as any).deliveryNote.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          purchaseOrder: { select: { id: true, poNumber: true, supplier: { select: { name: true } } } },
          receivedBy: { select: { id: true, firstName: true, lastName: true } },
          _count: { select: { items: true } },
        },
      }),
      (this.prisma as any).deliveryNote.count({ where }),
    ]);
    return { items, meta: { page: query.page ?? 1, limit, total } };
  }

  // ─── helpers ────────────────────────────────────────────────────────────────

  private async generatePrNumber(companyId: string): Promise<string> {
    const year = new Date().getFullYear();
    const count = await (this.prisma as any).purchaseRequest.count({ where: { companyId } });
    return `PR-${year}-${String(count + 1).padStart(4, '0')}`;
  }

  private async generatePoNumber(companyId: string): Promise<string> {
    const year = new Date().getFullYear();
    const count = await (this.prisma as any).purchaseOrder.count({ where: { companyId } });
    const settings = await (this.prisma as any).companySettings.findUnique({ where: { companyId } });
    const prefix = settings?.purchaseOrderPrefix ?? 'PO';
    return `${prefix}-${year}-${String(count + 1).padStart(4, '0')}`;
  }
}
