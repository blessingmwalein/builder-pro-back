import { createHmac } from 'crypto';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QuoteStatus, VariationStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import {
  ElectrosalesService,
  ELECTROSALES_SOURCE,
} from '../integrations/electrosales/electrosales.service';
import { MailService } from '../mail/mail.service';
import { CreateQuoteDto } from './dto/create-quote.dto';
import { CreateVariationDto } from './dto/create-variation.dto';
import { UpdateQuoteDto } from './dto/update-quote.dto';

type QuoteLineItemInput = {
  category: string;
  description: string;
  quantity: number;
  unit?: string;
  unitPrice: number;
  materialId?: string;
  externalSource?: string;
  externalProductId?: string;
  // Allow the frontend to ship the full Electrosales product so we can
  // back-fill Material catalog without a second network hop.
  externalProduct?: {
    id: number;
    name: string;
    sku: string;
    price: number;
    priceExclVat: number;
    availability: string;
    supplierName: string;
    description: string;
    breadcrumbs: string[];
    imageUrl: string | null;
  };
};

@Injectable()
export class QuotesService {
  private readonly logger = new Logger(QuotesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly electrosales: ElectrosalesService,
    private readonly mailService: MailService,
    private readonly configService: ConfigService,
  ) {}

  async create(companyId: string, dto: CreateQuoteDto) {
    const quoteNumber = await this.generateQuoteNumber(companyId);
    const lineItems = (dto.lineItems as unknown as QuoteLineItemInput[]) ?? [];
    const { subtotal, taxAmount, totalAmount } = this.calculateTotals(
      lineItems,
      (dto as any).taxRate ?? 0,
      (dto as any).discountAmount ?? 0,
    );

    // Resolve / upsert Materials for any Electrosales-sourced line items
    // BEFORE creating the quote, so QuoteLineItem.materialId can link.
    const resolvedLineItems = await Promise.all(
      lineItems.map(async (item) => {
        let materialId = item.materialId;

        // If the line item carries an Electrosales product payload, import it
        // as a Material (idempotent) and attach the id.
        if (!materialId && item.externalProduct) {
          const imported = await this.electrosales.importAsMaterial(
            companyId,
            item.externalProduct,
          );
          materialId = imported.id;
        } else if (
          !materialId &&
          item.externalSource === ELECTROSALES_SOURCE &&
          item.externalProductId
        ) {
          const imported = await this.electrosales.importByExternalId(
            companyId,
            item.externalProductId,
          );
          materialId = imported.id;
        }

        return { ...item, materialId };
      }),
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
          create: resolvedLineItems.map((item, i) => ({
            companyId,
            category: item.category,
            description: item.description,
            quantity: item.quantity,
            unit: item.unit,
            unitPrice: item.unitPrice,
            totalPrice: item.quantity * item.unitPrice,
            sortOrder: i,
            // Cast to any so this compiles before `prisma generate` picks up
            // the new fields (schema already has them).
            ...({ materialId: item.materialId ?? null,
                  externalSource: item.externalSource ?? null,
                  externalProductId: item.externalProductId ?? null } as any),
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

  async send(companyId: string, id: string, sendEmail = true) {
    const quote = await this.prisma.quote.findFirst({
      where: { id, companyId, deletedAt: null },
      include: {
        client: { select: { id: true, name: true, email: true } },
        lineItems: { where: { deletedAt: null }, orderBy: { sortOrder: 'asc' } },
      },
    });

    if (!quote) throw new NotFoundException('Quote not found');
    if (quote.status !== QuoteStatus.DRAFT) {
      throw new BadRequestException('Only draft quotes can be sent');
    }

    const updated = await this.prisma.quote.update({
      where: { id },
      data: { status: QuoteStatus.SENT, sentAt: new Date() },
      include: {
        lineItems: { where: { deletedAt: null }, orderBy: { sortOrder: 'asc' } },
        client: { select: { id: true, name: true, email: true } },
      },
    });

    if (sendEmail && quote.client?.email) {
      const company = await this.prisma.company.findUnique({
        where: { id: companyId },
        select: { name: true, defaultCurrency: true },
      });

      const sig = this.generateQuoteSignature(id);
      const viewUrl = `${this.mailService.buildQuoteUrl(id)}?sig=${sig}`;
      const currencySymbol = this.getCurrencySymbol(company?.defaultCurrency);

      this.mailService
        .sendQuote(quote.client.email, {
          clientName: quote.client.name,
          quoteNumber: quote.quoteNumber,
          quoteTitle: quote.title || 'Quote',
          issueDate: quote.issueDate
            ? new Date(quote.issueDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
            : '',
          expiryDate: quote.expiryDate
            ? new Date(quote.expiryDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
            : undefined,
          subtotal: Number(quote.subtotal),
          taxAmount: Number(quote.taxAmount),
          discountAmount: Number(quote.discountAmount),
          total: Number(quote.totalAmount),
          currencySymbol,
          viewUrl,
          senderCompanyName: company?.name || 'ownit2buildit',
          lineItems: quote.lineItems.map((li) => ({
            description: li.description,
            quantity: Number(li.quantity),
            unitPrice: Number(li.unitPrice),
            total: Number((li as any).totalPrice ?? Number(li.quantity) * Number(li.unitPrice)),
          })),
          notes: quote.notes ?? undefined,
        })
        .catch((err: Error) =>
          this.logger.error(`Quote email to ${quote.client!.email} failed: ${err.message}`),
        );
    }

    return updated;
  }

  private getCurrencySymbol(code?: string | null): string {
    const map: Record<string, string> = {
      USD: '$', EUR: '€', GBP: '£', ZWL: 'Z$', ZAR: 'R',
      ZMW: 'K', NAD: 'N$', BWP: 'P', KES: 'KSh', NGN: '₦',
    };
    return code ? (map[code] ?? code) : '$';
  }

  generateQuoteSignature(quoteId: string): string {
    const secret = this.configService.get<string>('auth.jwtSecret') ?? 'change-me';
    return createHmac('sha256', secret).update(quoteId).digest('hex').slice(0, 40);
  }

  private verifyQuoteSignature(quoteId: string, sig: string): boolean {
    return sig === this.generateQuoteSignature(quoteId);
  }

  async findPublic(id: string, sig: string) {
    if (!this.verifyQuoteSignature(id, sig)) {
      throw new ForbiddenException('Invalid or missing quote signature');
    }
    const quote = await this.prisma.quote.findFirst({
      where: { id, deletedAt: null },
      include: {
        lineItems: { where: { deletedAt: null }, orderBy: { sortOrder: 'asc' } },
        client: { select: { id: true, name: true, email: true } },
        company: { select: { name: true, defaultCurrency: true, logoUrl: true } },
      },
    });
    if (!quote) throw new NotFoundException('Quote not found');
    return quote;
  }

  async acceptPublic(id: string, sig: string) {
    if (!this.verifyQuoteSignature(id, sig)) {
      throw new ForbiddenException('Invalid or missing quote signature');
    }
    const quote = await this.prisma.quote.findFirst({
      where: { id, deletedAt: null },
    });
    if (!quote) throw new NotFoundException('Quote not found');
    if (quote.status !== QuoteStatus.SENT) {
      throw new BadRequestException('This quote is no longer awaiting acceptance');
    }
    return this.prisma.quote.update({
      where: { id },
      data: { status: QuoteStatus.APPROVED, approvedAt: new Date() },
      include: {
        lineItems: { where: { deletedAt: null }, orderBy: { sortOrder: 'asc' } },
        client: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async approve(companyId: string, id: string) {
    const quote = await this.prisma.quote.findFirst({
      where: { id, companyId, deletedAt: null },
      select: {
        id: true,
        status: true,
        projectId: true,
        lineItems: {
          where: { deletedAt: null },
          select: {
            id: true,
            quantity: true,
            unitPrice: true,
            description: true,
            // Cast avoids lag between schema and generated client — fields
            // exist in schema.prisma already.
            ...({ materialId: true } as any),
          },
        },
      },
    });

    if (!quote) throw new NotFoundException('Quote not found');
    if (quote.status !== QuoteStatus.SENT) {
      throw new BadRequestException('Only sent quotes can be approved');
    }

    const updated = await this.prisma.quote.update({
      where: { id },
      data: { status: QuoteStatus.APPROVED, approvedAt: new Date() },
      include: {
        lineItems: { where: { deletedAt: null }, orderBy: { sortOrder: 'asc' } },
        client: { select: { id: true, name: true, email: true } },
      },
    });

    // If the quote is tied to a project, record material usage for every
    // linked material. This keeps Project > Financials > Material Cost in
    // sync with what was actually quoted + approved.
    await this.logMaterialUsageFromQuote(companyId, quote as unknown as {
      projectId: string | null;
      lineItems: Array<{
        id: string;
        quantity: unknown;
        unitPrice: unknown;
        description: string;
        materialId?: string | null;
      }>;
    }, id);

    return updated;
  }

  private async logMaterialUsageFromQuote(
    companyId: string,
    quote: {
      projectId: string | null;
      lineItems: Array<{
        id: string;
        quantity: unknown;
        unitPrice: unknown;
        description: string;
        materialId?: string | null;
      }>;
    },
    quoteId: string,
  ) {
    if (!quote.projectId) return;

    const logs = quote.lineItems
      .filter((li) => !!li.materialId)
      .map((li) => {
        const quantity = Number(li.quantity);
        const unitCost = Number(li.unitPrice);
        return {
          companyId,
          projectId: quote.projectId!,
          materialId: li.materialId as string,
          quantity,
          unitCost,
          totalCost: quantity * unitCost,
          usedAt: new Date(),
          notes: `Auto-logged from approved quote ${quoteId}: ${li.description}`,
        };
      });

    if (logs.length === 0) return;
    try {
      await (this.prisma as any).materialLog.createMany({ data: logs });
    } catch (err) {
      // Non-fatal — surface via logs but don't block approval.
      // eslint-disable-next-line no-console
      console.error('Failed to auto-log material usage', err);
    }
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
