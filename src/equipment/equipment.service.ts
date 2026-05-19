import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { CreateEquipmentDto } from './dto/create-equipment.dto';
import { AllocateEquipmentDto } from './dto/allocate-equipment.dto';

@Injectable()
export class EquipmentService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Categories ─────────────────────────────────────────────────────────────

  async listCategories(companyId: string) {
    return (this.prisma as any).equipmentCategory.findMany({
      where: { companyId },
      orderBy: { name: 'asc' },
      include: { _count: { select: { equipment: true } } },
    });
  }

  async createCategory(companyId: string, name: string) {
    return (this.prisma as any).equipmentCategory.create({
      data: { companyId, name },
    });
  }

  // ─── Equipment CRUD ──────────────────────────────────────────────────────────

  async create(companyId: string, dto: CreateEquipmentDto) {
    return (this.prisma as any).equipment.create({
      data: {
        companyId,
        name: dto.name,
        description: dto.description ?? null,
        serialNumber: dto.serialNumber ?? null,
        categoryId: dto.categoryId ?? null,
        status: dto.status ?? 'AVAILABLE',
        dailyRate: dto.dailyRate ?? null,
        purchaseCost: dto.purchaseCost ?? null,
        purchasedAt: dto.purchasedAt ? new Date(dto.purchasedAt) : null,
      },
      include: { category: { select: { id: true, name: true } } },
    });
  }

  async list(companyId: string, query: PaginationQueryDto & { status?: string; categoryId?: string; search?: string }) {
    const limit = Math.min(query.limit ?? 20, 100);
    const skip = ((query.page ?? 1) - 1) * limit;
    const where: any = { companyId, deletedAt: null };
    if (query.status) where.status = query.status;
    if (query.categoryId) where.categoryId = query.categoryId;
    if (query.search) where.name = { contains: query.search, mode: 'insensitive' };

    const [items, total] = await this.prisma.$transaction([
      (this.prisma as any).equipment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          category: { select: { id: true, name: true } },
          _count: { select: { allocations: true } },
        },
      }),
      (this.prisma as any).equipment.count({ where }),
    ]);
    return { items, meta: { page: query.page ?? 1, limit, total } };
  }

  async findOne(companyId: string, id: string) {
    const eq = await (this.prisma as any).equipment.findFirst({
      where: { id, companyId, deletedAt: null },
      include: {
        category: { select: { id: true, name: true } },
        allocations: {
          orderBy: { startDate: 'desc' },
          take: 10,
          include: {
            project: { select: { id: true, name: true } },
            allocatedBy: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
    });
    if (!eq) throw new NotFoundException('Equipment not found');
    return eq;
  }

  async update(companyId: string, id: string, dto: Partial<CreateEquipmentDto>) {
    await this.findOne(companyId, id);
    return (this.prisma as any).equipment.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.serialNumber !== undefined && { serialNumber: dto.serialNumber }),
        ...(dto.categoryId !== undefined && { categoryId: dto.categoryId }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.dailyRate !== undefined && { dailyRate: dto.dailyRate }),
        ...(dto.purchaseCost !== undefined && { purchaseCost: dto.purchaseCost }),
        ...(dto.purchasedAt !== undefined && { purchasedAt: dto.purchasedAt ? new Date(dto.purchasedAt) : null }),
      },
      include: { category: { select: { id: true, name: true } } },
    });
  }

  async remove(companyId: string, id: string) {
    await this.findOne(companyId, id);
    return (this.prisma as any).equipment.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  // ─── Allocations ─────────────────────────────────────────────────────────────

  async allocate(companyId: string, equipmentId: string, allocatedById: string, dto: AllocateEquipmentDto) {
    const eq = await this.findOne(companyId, equipmentId);
    if (eq.status !== 'AVAILABLE') {
      throw new BadRequestException(`Equipment is currently ${eq.status} and cannot be allocated`);
    }

    return this.prisma.$transaction(async (tx) => {
      const allocation = await (tx as any).equipmentAllocation.create({
        data: {
          companyId,
          equipmentId,
          projectId: dto.projectId,
          allocatedById,
          startDate: new Date(dto.startDate),
          endDate: dto.endDate ? new Date(dto.endDate) : null,
          notes: dto.notes ?? null,
        },
        include: {
          project: { select: { id: true, name: true } },
          allocatedBy: { select: { id: true, firstName: true, lastName: true } },
        },
      });

      await (tx as any).equipment.update({
        where: { id: equipmentId },
        data: { status: 'IN_USE' },
      });

      return allocation;
    });
  }

  async returnEquipment(companyId: string, equipmentId: string, allocationId: string) {
    const eq = await this.findOne(companyId, equipmentId);
    if (eq.status !== 'IN_USE') {
      throw new BadRequestException('Equipment is not currently in use');
    }

    return this.prisma.$transaction(async (tx) => {
      await (tx as any).equipmentAllocation.update({
        where: { id: allocationId },
        data: { returnedAt: new Date() },
      });

      await (tx as any).equipment.update({
        where: { id: equipmentId },
        data: { status: 'AVAILABLE' },
      });

      return { success: true };
    });
  }

  async listAllocations(companyId: string, query: PaginationQueryDto & { equipmentId?: string; projectId?: string }) {
    const limit = Math.min(query.limit ?? 20, 100);
    const skip = ((query.page ?? 1) - 1) * limit;
    const where: any = { companyId };
    if (query.equipmentId) where.equipmentId = query.equipmentId;
    if (query.projectId) where.projectId = query.projectId;

    const [items, total] = await this.prisma.$transaction([
      (this.prisma as any).equipmentAllocation.findMany({
        where,
        orderBy: { startDate: 'desc' },
        skip,
        take: limit,
        include: {
          equipment: { select: { id: true, name: true, status: true } },
          project: { select: { id: true, name: true } },
          allocatedBy: { select: { id: true, firstName: true, lastName: true } },
        },
      }),
      (this.prisma as any).equipmentAllocation.count({ where }),
    ]);
    return { items, meta: { page: query.page ?? 1, limit, total } };
  }
}
