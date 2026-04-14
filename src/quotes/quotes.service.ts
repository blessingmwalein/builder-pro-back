import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { QuoteStatus, VariationStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { CreateQuoteDto } from './dto/create-quote.dto';
import { CreateVariationDto } from './dto/create-variation.dto';
import { UpdateQuoteDto } from './dto/update-quote.dto';

@Injectable()
export class QuotesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(companyId: string, dto: CreateQuoteDto) {
    const quoteNumber = await this.generateQuoteNumber(companyId);
    const { subtotal, taxAmount, totalAmount } = this.calculateTotals(
      dto.lineItems,
      (dto as any).taxRate ?? 0,
      (dto as any).discountAmount ?? 0,
    );

    return this.prisma.quote.create({
      data: {
        companyId,
        clientId: dto.clientId,
        projectId: dto.projectId,
        quoteNumber,
        title: dto.title,
        notes: (dto as any).notes,
        paymentTerms: (dto as any).paymentTerms,
        status: QuoteStatus.DRAFT,
        issueDate: new Date(dto.issueDate),
        expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : undefined,
        taxRate: (dto as any).taxRate ?? 0,
        discountAmount: (dto as any).discountAmount ?? 0,
        subtotal,
        taxAmount,
        totalAmount,
        lineItems: {
          create: dto.lineItems.map((item, i) => ({
            companyId,
            category: item.category,
            description: item.description,
            quantity: item.quantity,
            unit: (item as any).unit,
            unitPrice: item.unitPrice,
            totalPrice: item.quantity * item.unitPrice,
            sortOrder: i,
          })),
        },
      },
      include: {
        lineItems: { orderBy: { sortOrder: 'asc' } },
        client: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async list(companyId: string, query: PaginationQueryDto & { status?: QuoteStatus; clientId?: string }) {
    const limit = Math.min(query.limit, 100);
    const skip = (query.page - 1) * limit;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.quote.findMany({
        where: {
          companyId,
          deletedAt: null,
          status: query.status,
          clientId: query.clientId,
        },
        include: {
          lineItems: { where: { deletedAt: null }, orderBy: { sortOrder: 'asc' } },
          client: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.quote.count({
        where: { companyId, deletedAt: null, status: query.status, clientId: query.clientId },
      }),
    ]);
    return { items, meta: { page: query.page, limit, total } };
  }

  async findOne(companyId: string, id: string) {
    const quote = await this.prisma.quote.findFirst({
      where: { id, companyId, deletedAt: null },
      include: {
        lineItems: { where: { deletedAt: null }, orderBy: { sortOrder: 'asc' } },
        client: true,
        project: { select: { id: true, name: true, code: true } },
        variations: {
          where: { deletedAt: null },
          include: { lineItems: { where: { deletedAt: null } } },
        },
      },
    });

    if (!quote) throw new NotFoundException('Quote not found');
    return quote;
  }

  async update(companyId: string, id: string, dto: UpdateQuoteDto) {
    const quote = await this.prisma.quote.findFirst({
      where: { id, companyId, deletedAt: null },
      select: { id: true, status: true },
    });

    if (!quote) throw new NotFoundException('Quote not found');

    if (quote.status === QuoteStatus.APPROVED || quote.status === QuoteStatus.CONVERTED) {
      throw new BadRequestException('Cannot edit an approved or converted quote');
    }

    return this.prisma.$transaction(async (tx) => {
      if (dto.lineItems) {
        await tx.quoteLineItem.updateMany({
          where: { quoteId: id, companyId },
          data: { deletedAt: new Date() },
        });

        const { subtotal, taxAmount, totalAmount } = this.calculateTotals(
          dto.lineItems,
          dto.taxRate ?? 0,
          dto.discountAmount ?? 0,
        );

        await tx.quote.update({
          where: { id },
          data: {
            title: dto.title,
            notes: dto.notes,
            paymentTerms: dto.paymentTerms,
            expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : undefined,
            taxRate: dto.taxRate,
            discountAmount: dto.discountAmount,
            subtotal,
            taxAmount,
            totalAmount,
            lineItems: {
              create: dto.lineItems.map((item, i) => ({
                companyId,
                category: item.category,
                description: item.description,
                quantity: item.quantity,
                unit: item.unit,
                unitPrice: item.unitPrice,
                totalPrice: item.quantity * item.unitPrice,
                sortOrder: i,
              })),
            },
          },
        });
      } else {
        await tx.quote.update({
          where: { id },
          data: {
            title: dto.title,
            notes: dto.notes,
            paymentTerms: dto.paymentTerms,
            expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : undefined,
            taxRate: dto.taxRate,
            discountAmount: dto.discountAmount,
          },
        });
      }

      return tx.quote.findUnique({
        where: { id },
        include: { lineItems: { where: { deletedAt: null } } },
      });
    });
  }

  async send(companyId: string, id: string) {
    const quote = await this.prisma.quote.findFirst({
      where: { id, companyId, deletedAt: null },
      select: { id: true, status: true },
    });

    if (!quote) throw new NotFoundException('Quote not found');
    if (quote.status !== QuoteStatus.DRAFT) {
      throw new BadRequestException('Only draft quotes can be sent');
    }

    return this.prisma.quote.update({
      where: { id },
      data: { status: QuoteStatus.SENT, sentAt: new Date() },
    });
  }

  async approve(companyId: string, id: string) {
    const quote = await this.prisma.quote.findFirst({
      where: { id, companyId, deletedAt: null },
      select: { id: true, status: true },
    });

    if (!quote) throw new NotFoundException('Quote not found');
    if (quote.status !== QuoteStatus.SENT) {
      throw new BadRequestException('Only sent quotes can be approved');
    }

    return this.prisma.quote.update({
      where: { id },
      data: { status: QuoteStatus.APPROVED, approvedAt: new Date() },
    });
  }

  async reject(companyId: string, id: string, rejectionNotes?: string) {
    const quote = await this.prisma.quote.findFirst({
      where: { id, companyId, deletedAt: null },
      select: { id: true, status: true },
    });

    if (!quote) throw new NotFoundException('Quote not found');
    if (quote.status !== QuoteStatus.SENT) {
      throw new BadRequestException('Only sent quotes can be rejected');
    }

    return this.prisma.quote.update({
      where: { id },
      data: { status: QuoteStatus.REJECTED, rejectedAt: new Date(), rejectionNotes },
    });
  }

  async convertToProject(companyId: string, quoteId: string) {
    const quote = await this.prisma.quote.findFirst({
      where: { id: quoteId, companyId, deletedAt: null },
      select: { id: true, status: true },
    });

    if (!quote) throw new NotFoundException('Quote not found');
    if (quote.status !== QuoteStatus.APPROVED) {
      throw new BadRequestException('Only approved quotes can be converted to projects');
    }

    return this.prisma.quote.update({
      where: { id: quoteId },
      data: { status: QuoteStatus.CONVERTED, convertedAt: new Date() },
    });
  }

  async remove(companyId: string, id: string) {
    const quote = await this.prisma.quote.findFirst({
      where: { id, companyId, deletedAt: null },
      select: { id: true },
    });

    if (!quote) throw new NotFoundException('Quote not found');

    await this.prisma.quote.update({ where: { id }, data: { deletedAt: new Date() } });
    return { success: true };
  }

  async createVariation(companyId: string, projectId: string, dto: CreateVariationDto) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, companyId, deletedAt: null },
      select: { id: true },
    });

    if (!project) throw new NotFoundException('Project not found');

    const variationNumber = await this.generateVariationNumber(companyId, projectId);
    const subtotal = dto.lineItems.reduce((s, i) => s + i.quantity * i.unitPrice, 0);

    return this.prisma.variation.create({
      data: {
        companyId,
        projectId,
        quoteId: dto.quoteId,
        variationNumber,
        title: dto.title,
        description: dto.description,
        type: dto.type ?? 'ADDITION',
        status: VariationStatus.DRAFT,
        subtotal,
        totalAmount: subtotal,
        lineItems: {
          create: dto.lineItems.map((item) => ({
            companyId,
            category: item.category,
            description: item.description,
            quantity: item.quantity,
            unit: item.unit,
            unitPrice: item.unitPrice,
            totalPrice: item.quantity * item.unitPrice,
          })),
        },
      },
      include: { lineItems: true },
    });
  }

  async listVariations(companyId: string, projectId: string) {
    return this.prisma.variation.findMany({
      where: { companyId, projectId, deletedAt: null },
      include: { lineItems: { where: { deletedAt: null } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async approveVariation(companyId: string, variationId: string) {
    const variation = await this.prisma.variation.findFirst({
      where: { id: variationId, companyId, deletedAt: null },
    });

    if (!variation) throw new NotFoundException('Variation not found');

    const updated = await this.prisma.variation.update({
      where: { id: variationId },
      data: { status: VariationStatus.APPROVED, approvedAt: new Date() },
    });

    await this.prisma.project.update({
      where: { id: variation.projectId },
      data: { baselineBudget: { increment: Number(variation.totalAmount) } },
    });

    return updated;
  }

  async rejectVariation(companyId: string, variationId: string, notes?: string) {
    const variation = await this.prisma.variation.findFirst({
      where: { id: variationId, companyId, deletedAt: null },
      select: { id: true },
    });

    if (!variation) throw new NotFoundException('Variation not found');

    return this.prisma.variation.update({
      where: { id: variationId },
      data: { status: VariationStatus.REJECTED, rejectedAt: new Date(), rejectionNotes: notes },
    });
  }

  private calculateTotals(
    lineItems: { quantity: number; unitPrice: number }[],
    taxRate: number,
    discountAmount: number,
  ) {
    const subtotal = lineItems.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
    const discounted = Math.max(subtotal - discountAmount, 0);
    const taxAmount = discounted * (taxRate / 100);
    const totalAmount = discounted + taxAmount;
    return { subtotal, taxAmount, totalAmount };
  }

  private async generateQuoteNumber(companyId: string): Promise<string> {
    const count = await this.prisma.quote.count({ where: { companyId } });
    const year = new Date().getFullYear();
    return `Q-${year}-${String(count + 1).padStart(4, '0')}`;
  }

  private async generateVariationNumber(companyId: string, projectId: string): Promise<string> {
    const count = await this.prisma.variation.count({ where: { companyId, projectId } });
    return `VAR-${String(count + 1).padStart(3, '0')}`;
  }
}
