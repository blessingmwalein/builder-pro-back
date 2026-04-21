import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { CreateMaterialDto } from './dto/create-material.dto';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { LogMaterialUsageDto } from './dto/log-material-usage.dto';
import { UpdateMaterialDto } from './dto/update-material.dto';

export const DEFAULT_MATERIAL_CATEGORIES = [
  { code: 'ELECTRICAL', name: 'Electrical', description: 'Cables, fittings, switches, conduits.' },
  { code: 'PLUMBING', name: 'Plumbing', description: 'Pipes, fittings, valves, sanitaryware.' },
  { code: 'CEMENT_CONCRETE', name: 'Cement & Concrete', description: 'Cement, aggregates, concrete mixes.' },
  { code: 'STEEL', name: 'Steel & Reinforcement', description: 'Rebar, mesh, angle iron.' },
  { code: 'TOOLS', name: 'Tools & Hardware', description: 'Hand tools, power tools, fasteners.' },
  { code: 'PAINTS', name: 'Paints & Finishes', description: 'Paints, primers, sealants.' },
  { code: 'ROOFING', name: 'Roofing', description: 'IBR sheets, trusses, gutters.' },
  { code: 'DOORS_WINDOWS', name: 'Doors & Windows', description: 'Frames, panels, glass.' },
  { code: 'TIMBER', name: 'Timber', description: 'Formwork, shuttering, framing.' },
  { code: 'CONSUMABLES', name: 'Consumables', description: 'PPE, fuel, cleaning, misc.' },
] as const;

export const DEFAULT_SUPPLIERS = [
  {
    name: 'Electrosales',
    email: 'info@electrosales.co.zw',
    phone: '+263 24 2772801',
    website: 'https://www.electrosales.co.zw',
    address: 'Harare, Zimbabwe',
    notes: 'Electrical, tools, plumbing, hardware — live catalog integrated.',
    categories: 'ELECTRICAL,TOOLS,PLUMBING,CONSUMABLES',
  },
  {
    name: 'Halsteds',
    email: 'info@halsteds.co.zw',
    phone: '+263 24 2793981',
    website: 'https://halsteds.co.zw',
    address: 'Harare, Zimbabwe',
    notes: 'Building materials, hardware, paints and finishes.',
    categories: 'CEMENT_CONCRETE,TOOLS,PAINTS,ROOFING,TIMBER',
  },
  {
    name: 'Bhola Hardware',
    email: 'sales@bholahardware.co.zw',
    phone: '+263 24 2744015',
    address: 'Harare, Zimbabwe',
    notes: 'Cement, steel, doors and windows, general building supplies.',
    categories: 'CEMENT_CONCRETE,STEEL,DOORS_WINDOWS,ROOFING',
  },
] as const;

@Injectable()
export class MaterialsService {
  constructor(private readonly prisma: PrismaService) {}

  private prismaAny() {
    return this.prisma as unknown as {
      materialCategory: {
        findMany: (args: unknown) => Promise<Array<{ id: string; code: string; name: string }>>;
        createMany: (args: { data: unknown[]; skipDuplicates?: boolean }) => Promise<unknown>;
      };
      supplier: {
        findMany: (args: unknown) => Promise<Array<{ id: string }>>;
        createMany: (args: { data: unknown[]; skipDuplicates?: boolean }) => Promise<unknown>;
      };
      materialPurchase: {
        create: (args: unknown) => Promise<{ id: string; totalAmount: unknown }>;
        findMany: (args: unknown) => Promise<unknown[]>;
        count: (args: unknown) => Promise<number>;
      };
    };
  }

  /** Idempotent: inserts any default material categories the tenant is missing. */
  async ensureDefaultCategories(companyId: string) {
    const existing = await this.prismaAny().materialCategory.findMany({
      where: { companyId, deletedAt: null },
      select: { code: true },
    });
    const have = new Set((existing as Array<{ code: string }>).map((c) => c.code));
    const missing = DEFAULT_MATERIAL_CATEGORIES.filter((c) => !have.has(c.code));
    if (missing.length === 0) return;
    await this.prismaAny().materialCategory.createMany({
      data: missing.map((c) => ({ companyId, ...c })),
      skipDuplicates: true,
    });
  }

  /** Idempotent: inserts any default Zimbabwe suppliers the tenant is missing. */
  async ensureDefaultSuppliers(companyId: string) {
    const existing = await this.prisma.supplier.findMany({
      where: { companyId, deletedAt: null },
      select: { name: true },
    });
    const have = new Set(existing.map((s) => s.name.toLowerCase()));
    const missing = DEFAULT_SUPPLIERS.filter((s) => !have.has(s.name.toLowerCase()));
    if (missing.length === 0) return;
    await this.prisma.supplier.createMany({
      data: missing.map((s) => ({ companyId, ...s })),
      skipDuplicates: true,
    });
  }

  async listCategories(companyId: string) {
    await this.ensureDefaultCategories(companyId);
    return this.prismaAny().materialCategory.findMany({
      where: { companyId, deletedAt: null },
      orderBy: { name: 'asc' },
    });
  }

  async createCategory(companyId: string, data: { code: string; name: string; description?: string }) {
    return (this.prisma as any).materialCategory.create({
      data: {
        companyId,
        code: data.code.toUpperCase().replace(/[^A-Z0-9_]+/g, '_'),
        name: data.name,
        description: data.description,
      },
    });
  }

  create(companyId: string, dto: CreateMaterialDto) {
    return this.prisma.material.create({
      data: {
        companyId,
        name: dto.name,
        category: dto.category,
        // Prefer the structured categoryId when provided.
        ...(dto.categoryId ? { categoryId: dto.categoryId } : {}),
        sku: dto.sku,
        unit: dto.unit,
        unitCost: dto.unitCost,
        supplierId: dto.supplierId,
        ...(dto.reorderAt != null ? { reorderAt: dto.reorderAt } : {}),
        ...(dto.description ? { description: dto.description } : {}),
        ...(dto.stockOnHand != null ? { stockOnHand: dto.stockOnHand } : {}),
      } as any,
      include: {
        supplier: { select: { id: true, name: true } },
        categoryRef: { select: { id: true, code: true, name: true } } as any,
      } as any,
    });
  }

  async list(
    companyId: string,
    query: PaginationQueryDto & {
      search?: string;
      lowStock?: boolean;
      categoryId?: string;
      supplierId?: string;
    },
  ) {
    const limit = Math.min(query.limit, 100);
    const skip = (query.page - 1) * limit;

    const where: any = {
      companyId,
      deletedAt: null,
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.supplierId ? { supplierId: query.supplierId } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' as const } },
              { sku: { contains: query.search, mode: 'insensitive' as const } },
              { description: { contains: query.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.material.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          supplier: { select: { id: true, name: true } },
          categoryRef: { select: { id: true, code: true, name: true } } as any,
        } as any,
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
        categoryRef: { select: { id: true, code: true, name: true } } as any,
        logs: {
          where: { deletedAt: null },
          orderBy: { usedAt: 'desc' },
          take: 20,
          include: {
            project: { select: { id: true, name: true } },
          },
        },
      } as any,
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
        ...(dto.categoryId ? { categoryId: dto.categoryId } : {}),
        sku: dto.sku,
        unit: dto.unit,
        unitCost: dto.unitCost,
        reorderAt: dto.reorderAt,
        supplierId: dto.supplierId,
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.stockOnHand !== undefined ? { stockOnHand: dto.stockOnHand } : {}),
      },
      include: {
        supplier: { select: { id: true, name: true } },
        categoryRef: { select: { id: true, code: true, name: true } } as any,
      } as any,
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
    await this.ensureDefaultSuppliers(companyId);
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

  /**
   * Bulk material purchase — one supplier receipt covering multiple line items.
   * - Creates a MaterialPurchase parent row with the receipt metadata.
   * - For each line: creates a MaterialLog (entryType PURCHASE), increments the
   *   material's stockOnHand, updates its unitCost to the most recent paid
   *   price, and optionally writes a FinancialTransaction against the project
   *   (under the MATERIALS budget category).
   */
  async createPurchase(
    companyId: string,
    dto: {
      supplierId?: string;
      projectId?: string;
      purchaseNumber?: string;
      purchasedAt?: string;
      notes?: string;
      receiptKey?: string;
      receiptUrl?: string;
      items: Array<{
        materialId: string;
        quantity: number;
        unitCost: number;
        description?: string;
      }>;
    },
  ) {
    if (!dto.items?.length) {
      throw new NotFoundException('Purchase must have at least one line item');
    }

    const purchasedAt = dto.purchasedAt ? new Date(dto.purchasedAt) : new Date();
    const totalAmount = dto.items.reduce(
      (s, item) => s + Number(item.quantity) * Number(item.unitCost),
      0,
    );

    // Validate all materials belong to this tenant.
    const materials = await this.prisma.material.findMany({
      where: {
        id: { in: dto.items.map((i) => i.materialId) },
        companyId,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (materials.length !== new Set(dto.items.map((i) => i.materialId)).size) {
      throw new NotFoundException('One or more materials not found');
    }

    const purchase = await (this.prisma as any).$transaction(async (tx: any) => {
      const created = await tx.materialPurchase.create({
        data: {
          companyId,
          supplierId: dto.supplierId ?? null,
          projectId: dto.projectId ?? null,
          purchaseNumber: dto.purchaseNumber ?? null,
          purchasedAt,
          totalAmount,
          notes: dto.notes ?? null,
          receiptKey: dto.receiptKey ?? null,
          receiptUrl: dto.receiptUrl ?? null,
        },
      });

      for (const item of dto.items) {
        const lineTotal = Number(item.quantity) * Number(item.unitCost);
        // Stock-in log (entryType PURCHASE means positive inventory movement).
        await tx.materialLog.create({
          data: {
            companyId,
            projectId: dto.projectId ?? null,
            materialId: item.materialId,
            supplierId: dto.supplierId ?? null,
            purchaseId: created.id,
            entryType: 'PURCHASE',
            quantity: item.quantity,
            unitCost: item.unitCost,
            totalCost: lineTotal,
            usedAt: purchasedAt,
            notes: item.description ?? null,
            receiptKey: dto.receiptKey ?? null,
            receiptUrl: dto.receiptUrl ?? null,
          },
        });

        // Increase stock, and refresh the per-unit cost to the latest paid price.
        await tx.material.update({
          where: { id: item.materialId },
          data: {
            stockOnHand: { increment: item.quantity },
            unitCost: item.unitCost,
          },
        });
      }

      // If tied to a project, record the aggregate as a FinancialTransaction
      // in the MATERIALS budget category (auto-seeded earlier).
      if (dto.projectId) {
        const materialsCategory = await tx.budgetCategory.findFirst({
          where: { companyId, code: 'MATERIALS', deletedAt: null },
          select: { id: true },
        });
        if (materialsCategory) {
          await tx.financialTransaction.create({
            data: {
              companyId,
              projectId: dto.projectId,
              categoryId: materialsCategory.id,
              description: dto.purchaseNumber
                ? `Bulk purchase ${dto.purchaseNumber}`
                : 'Bulk material purchase',
              amount: totalAmount,
              occurredAt: purchasedAt,
              sourceType: 'MATERIAL_PURCHASE',
              sourceId: created.id,
              reference: dto.purchaseNumber ?? null,
              receiptKey: dto.receiptKey ?? null,
              receiptUrl: dto.receiptUrl ?? null,
            },
          });
        }
      }

      return created;
    });

    return purchase;
  }

  async listPurchases(
    companyId: string,
    query: PaginationQueryDto & { projectId?: string; supplierId?: string },
  ) {
    const limit = Math.min(query.limit, 100);
    const skip = (query.page - 1) * limit;

    const where = {
      companyId,
      deletedAt: null,
      ...(query.projectId ? { projectId: query.projectId } : {}),
      ...(query.supplierId ? { supplierId: query.supplierId } : {}),
    };

    const [items, total] = await Promise.all([
      this.prismaAny().materialPurchase.findMany({
        where,
        orderBy: { purchasedAt: 'desc' },
        skip,
        take: limit,
        include: {
          supplier: { select: { id: true, name: true } },
          project: { select: { id: true, name: true } },
          logs: {
            include: {
              material: { select: { id: true, name: true, unit: true } },
            },
          },
        } as any,
      } as any),
      this.prismaAny().materialPurchase.count({ where } as any),
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
