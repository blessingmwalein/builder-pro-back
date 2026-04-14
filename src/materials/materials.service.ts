import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { CreateMaterialDto } from './dto/create-material.dto';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { LogMaterialUsageDto } from './dto/log-material-usage.dto';
import { UpdateMaterialDto } from './dto/update-material.dto';

@Injectable()
export class MaterialsService {
  constructor(private readonly prisma: PrismaService) {}

  create(companyId: string, dto: CreateMaterialDto) {
    return this.prisma.material.create({
      data: {
        companyId,
        name: dto.name,
        category: (dto as any).category,
        sku: dto.sku,
        unit: dto.unit,
        unitCost: dto.unitCost,
        supplierId: dto.supplierId,
      },
      include: { supplier: { select: { id: true, name: true } } },
    });
  }

  async list(companyId: string, query: PaginationQueryDto & { search?: string; lowStock?: boolean }) {
    const limit = Math.min(query.limit, 100);
    const skip = (query.page - 1) * limit;

    const where: any = {
      companyId,
      deletedAt: null,
      OR: query.search
        ? [
            { name: { contains: query.search, mode: 'insensitive' as const } },
            { sku: { contains: query.search, mode: 'insensitive' as const } },
          ]
        : undefined,
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.material.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: { supplier: { select: { id: true, name: true } } },
      }),
      this.prisma.material.count({ where }),
    ]);

    const result = query.lowStock
      ? items.filter(
          (m) => m.reorderAt !== null && Number(m.stockOnHand) <= Number(m.reorderAt),
        )
      : items;

    return { items: result, meta: { page: query.page, limit, total } };
  }

  async findOne(companyId: string, id: string) {
    const material = await this.prisma.material.findFirst({
      where: { id, companyId, deletedAt: null },
      include: {
        supplier: true,
        logs: {
          where: { deletedAt: null },
          orderBy: { usedAt: 'desc' },
          take: 20,
          include: {
            project: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!material) throw new NotFoundException('Material not found');
    return material;
  }

  async update(companyId: string, id: string, dto: UpdateMaterialDto) {
    const material = await this.prisma.material.findFirst({
      where: { id, companyId, deletedAt: null },
      select: { id: true },
    });

    if (!material) throw new NotFoundException('Material not found');

    return this.prisma.material.update({
      where: { id },
      data: {
        name: dto.name,
        category: dto.category,
        sku: dto.sku,
        unit: dto.unit,
        unitCost: dto.unitCost,
        reorderAt: dto.reorderAt,
        supplierId: dto.supplierId,
      },
    });
  }

  async remove(companyId: string, id: string) {
    const material = await this.prisma.material.findFirst({
      where: { id, companyId, deletedAt: null },
      select: { id: true },
    });

    if (!material) throw new NotFoundException('Material not found');

    await this.prisma.material.update({ where: { id }, data: { deletedAt: new Date() } });
    return { success: true };
  }

  async logUsage(companyId: string, dto: LogMaterialUsageDto) {
    const material = await this.prisma.material.findFirst({
      where: { id: dto.materialId, companyId, deletedAt: null },
    });

    if (!material) throw new NotFoundException('Material not found');

    const totalCost = dto.quantity * dto.unitCost;

    const [log] = await this.prisma.$transaction([
      this.prisma.materialLog.create({
        data: {
          companyId,
          projectId: dto.projectId,
          materialId: dto.materialId,
          supplierId: dto.supplierId,
          quantity: dto.quantity,
          unitCost: dto.unitCost,
          totalCost,
          notes: dto.notes,
          usedAt: new Date(),
        },
      }),
      this.prisma.material.update({
        where: { id: dto.materialId },
        data: { stockOnHand: { decrement: dto.quantity } },
      }),
    ]);

    return log;
  }

  async listLogs(
    companyId: string,
    query: PaginationQueryDto & { projectId?: string; materialId?: string },
  ) {
    const limit = Math.min(query.limit, 100);
    const skip = (query.page - 1) * limit;

    const where = {
      companyId,
      deletedAt: null,
      projectId: query.projectId,
      materialId: query.materialId,
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.materialLog.findMany({
        where,
        include: {
          material: { select: { id: true, name: true, unit: true } },
          project: { select: { id: true, name: true } },
        },
        orderBy: { usedAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.materialLog.count({ where }),
    ]);

    return { items, meta: { page: query.page, limit, total } };
  }

  async stockAdjust(companyId: string, id: string, qty: number) {
    const material = await this.prisma.material.findFirst({
      where: { id, companyId, deletedAt: null },
      select: { id: true },
    });

    if (!material) throw new NotFoundException('Material not found');

    return this.prisma.material.update({
      where: { id },
      data: { stockOnHand: { increment: qty } },
    });
  }

  async getLowStockAlerts(companyId: string) {
    const materials = await this.prisma.material.findMany({
      where: { companyId, deletedAt: null, reorderAt: { not: null } },
    });

    return materials.filter(
      (m) => m.reorderAt !== null && Number(m.stockOnHand) <= Number(m.reorderAt),
    );
  }

  createSupplier(companyId: string, dto: CreateSupplierDto) {
    return this.prisma.supplier.create({
      data: {
        companyId,
        name: dto.name,
        email: dto.email,
        phone: dto.phone,
        address: dto.address,
        website: dto.website,
        notes: dto.notes,
      },
    });
  }

  async listSuppliers(companyId: string, query: PaginationQueryDto) {
    const limit = Math.min(query.limit, 100);
    const skip = (query.page - 1) * limit;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.supplier.findMany({
        where: { companyId, deletedAt: null },
        include: { _count: { select: { materials: true } } },
        orderBy: { name: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.supplier.count({ where: { companyId, deletedAt: null } }),
    ]);

    return { items, meta: { page: query.page, limit, total } };
  }

  async deleteSupplier(companyId: string, id: string) {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id, companyId, deletedAt: null },
      select: { id: true },
    });

    if (!supplier) throw new NotFoundException('Supplier not found');

    await this.prisma.supplier.update({ where: { id }, data: { deletedAt: new Date() } });
    return { success: true };
  }
}
