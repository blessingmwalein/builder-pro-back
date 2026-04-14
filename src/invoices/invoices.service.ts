import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InvoiceStatus, PaymentMethod, PaymentStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { BillingService } from '../billing/billing.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { RecordPaymentDto } from './dto/record-payment.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';

@Injectable()
export class InvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly billingService: BillingService,
  ) {}

  async create(companyId: string, dto: CreateInvoiceDto) {
    const invoiceNumber = await this.generateInvoiceNumber(companyId);
    const subtotal = dto.lineItems.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0,
    );

    return this.prisma.invoice.create({
      data: {
        companyId,
        clientId: dto.clientId,
        projectId: dto.projectId,
        quoteId: dto.quoteId,
        invoiceNumber,
        issueDate: new Date(dto.issueDate),
        dueDate: new Date(dto.dueDate),
        notes: (dto as any).notes,
        paymentTerms: (dto as any).paymentTerms,
        retentionPct: (dto as any).retentionPct ?? 0,
        subtotal,
        totalAmount: subtotal,
        balanceAmount: subtotal,
        status: InvoiceStatus.DRAFT,
        lineItems: {
          create: dto.lineItems.map((item, i) => ({
            companyId,
            description: item.description,
            unit: (item as any).unit,
            quantity: item.quantity,
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

  async list(
    companyId: string,
    query: PaginationQueryDto & { status?: InvoiceStatus; clientId?: string; projectId?: string },
  ) {
    const limit = Math.min(query.limit, 100);
    const skip = (query.page - 1) * limit;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.invoice.findMany({
        where: {
          companyId,
          deletedAt: null,
          status: query.status,
          clientId: query.clientId,
          projectId: query.projectId,
        },
        include: {
          client: { select: { id: true, name: true } },
          payments: { where: { deletedAt: null }, orderBy: { createdAt: 'desc' } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.invoice.count({
        where: {
          companyId,
          deletedAt: null,
          status: query.status,
          clientId: query.clientId,
          projectId: query.projectId,
        },
      }),
    ]);
    return { items, meta: { page: query.page, limit, total } };
  }

  async findOne(companyId: string, id: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, companyId, deletedAt: null },
      include: {
        lineItems: { where: { deletedAt: null }, orderBy: { sortOrder: 'asc' } },
        client: true,
        project: { select: { id: true, name: true, code: true } },
        quote: { select: { id: true, quoteNumber: true } },
        payments: { where: { deletedAt: null }, orderBy: { createdAt: 'desc' } },
      },
    });

    if (!invoice) throw new NotFoundException('Invoice not found');
    return invoice;
  }

  async update(companyId: string, id: string, dto: UpdateInvoiceDto) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, companyId, deletedAt: null },
      select: { id: true, status: true },
    });

    if (!invoice) throw new NotFoundException('Invoice not found');

    if (invoice.status === InvoiceStatus.PAID || invoice.status === InvoiceStatus.VOID) {
      throw new BadRequestException('Cannot edit a paid or void invoice');
    }

    return this.prisma.$transaction(async (tx) => {
      if (dto.lineItems) {
        await tx.invoiceLineItem.updateMany({
          where: { invoiceId: id, companyId },
          data: { deletedAt: new Date() },
        });

        const subtotal = dto.lineItems.reduce((s, i) => s + i.quantity * i.unitPrice, 0);

        return tx.invoice.update({
          where: { id },
          data: {
            dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
            notes: dto.notes,
            paymentTerms: dto.paymentTerms,
            retentionPct: dto.retentionPct,
            subtotal,
            totalAmount: subtotal,
            balanceAmount: subtotal,
            lineItems: {
              create: dto.lineItems.map((item, i) => ({
                companyId,
                description: item.description,
                unit: item.unit,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                totalPrice: item.quantity * item.unitPrice,
                sortOrder: i,
              })),
            },
          },
          include: { lineItems: { where: { deletedAt: null } } },
        });
      }

      return tx.invoice.update({
        where: { id },
        data: {
          dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
          notes: dto.notes,
          paymentTerms: dto.paymentTerms,
          retentionPct: dto.retentionPct,
        },
      });
    });
  }

  async send(companyId: string, id: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, companyId, deletedAt: null },
      select: { id: true, status: true },
    });

    if (!invoice) throw new NotFoundException('Invoice not found');
    if (invoice.status !== InvoiceStatus.DRAFT) {
      throw new BadRequestException('Only draft invoices can be sent');
    }

    return this.prisma.invoice.update({
      where: { id },
      data: { status: InvoiceStatus.SENT, sentAt: new Date() },
    });
  }

  async void(companyId: string, id: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, companyId, deletedAt: null },
      select: { id: true, status: true },
    });

    if (!invoice) throw new NotFoundException('Invoice not found');
    if (invoice.status === InvoiceStatus.PAID) {
      throw new BadRequestException('Cannot void a paid invoice');
    }

    return this.prisma.invoice.update({
      where: { id },
      data: { status: InvoiceStatus.VOID, voidedAt: new Date() },
    });
  }

  async remove(companyId: string, id: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, companyId, deletedAt: null },
      select: { id: true, status: true },
    });

    if (!invoice) throw new NotFoundException('Invoice not found');
    if (invoice.status === InvoiceStatus.PAID) {
      throw new BadRequestException('Cannot delete a paid invoice');
    }

    await this.prisma.invoice.update({ where: { id }, data: { deletedAt: new Date() } });
    return { success: true };
  }

  async recordPayment(companyId: string, invoiceId: string, dto: RecordPaymentDto) {
    const invoice = await this.prisma.invoice.findFirstOrThrow({
      where: { id: invoiceId, companyId, deletedAt: null },
    });

    let transactionRef: string;
    let paymentStatus: PaymentStatus = PaymentStatus.SUCCESS;

    if (dto.method === PaymentMethod.PAYNOW || dto.method === PaymentMethod.ECOCASH) {
      const paymentInit = await this.billingService.initiatePaynowPayment({
        companyId,
        invoiceId,
        amount: dto.amount,
        currency: 'USD',
      });
      transactionRef = paymentInit.providerReference;
      paymentStatus = paymentInit.status === 'SUCCESS' ? PaymentStatus.SUCCESS : PaymentStatus.PENDING;
    } else {
      transactionRef = `MANUAL-${Date.now()}`;
      paymentStatus = PaymentStatus.SUCCESS;
    }

    const payment = await this.prisma.payment.create({
      data: {
        companyId,
        invoiceId,
        method: (dto.method as PaymentMethod) ?? PaymentMethod.CASH,
        amount: dto.amount,
        transactionRef,
        status: paymentStatus,
        notes: (dto as any).notes,
        paidAt: paymentStatus === PaymentStatus.SUCCESS ? new Date() : null,
      },
    });

    if (paymentStatus === PaymentStatus.SUCCESS) {
      const paidAmount = Number(invoice.paidAmount) + dto.amount;
      const balanceAmount = Math.max(Number(invoice.totalAmount) - paidAmount, 0);
      const status =
        balanceAmount === 0
          ? InvoiceStatus.PAID
          : paidAmount > 0
            ? InvoiceStatus.PARTIALLY_PAID
            : invoice.status;

      await this.prisma.invoice.update({
        where: { id: invoiceId },
        data: {
          paidAmount,
          balanceAmount,
          status,
          paidAt: status === InvoiceStatus.PAID ? new Date() : null,
        },
      });
    }

    return payment;
  }

  async getAgingReport(companyId: string) {
    const invoices = await this.prisma.invoice.findMany({
      where: {
        companyId,
        deletedAt: null,
        status: { in: [InvoiceStatus.SENT, InvoiceStatus.PARTIALLY_PAID, InvoiceStatus.OVERDUE] },
      },
      include: { client: { select: { id: true, name: true } } },
    });

    const now = new Date();
    const buckets = {
      current: [] as any[],
      days1to30: [] as any[],
      days31to60: [] as any[],
      days61to90: [] as any[],
      over90: [] as any[],
    };

    for (const inv of invoices) {
      const daysOverdue = Math.floor(
        (now.getTime() - inv.dueDate.getTime()) / (1000 * 60 * 60 * 24),
      );

      const entry = {
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        client: inv.client,
        dueDate: inv.dueDate,
        balanceAmount: Number(inv.balanceAmount),
        daysOverdue: Math.max(daysOverdue, 0),
      };

      if (daysOverdue <= 0) buckets.current.push(entry);
      else if (daysOverdue <= 30) buckets.days1to30.push(entry);
      else if (daysOverdue <= 60) buckets.days31to60.push(entry);
      else if (daysOverdue <= 90) buckets.days61to90.push(entry);
      else buckets.over90.push(entry);
    }

    return {
      buckets,
      totals: {
        current: buckets.current.reduce((s, i) => s + i.balanceAmount, 0),
        days1to30: buckets.days1to30.reduce((s, i) => s + i.balanceAmount, 0),
        days31to60: buckets.days31to60.reduce((s, i) => s + i.balanceAmount, 0),
        days61to90: buckets.days61to90.reduce((s, i) => s + i.balanceAmount, 0),
        over90: buckets.over90.reduce((s, i) => s + i.balanceAmount, 0),
      },
    };
  }

  async getClientStatement(companyId: string, clientId: string) {
    const invoices = await this.prisma.invoice.findMany({
      where: { companyId, clientId, deletedAt: null },
      include: { payments: { where: { deletedAt: null } } },
      orderBy: { issueDate: 'asc' },
    });

    const totalInvoiced = invoices.reduce((s, i) => s + Number(i.totalAmount), 0);
    const totalPaid = invoices.reduce((s, i) => s + Number(i.paidAmount), 0);
    const balance = totalInvoiced - totalPaid;

    return { invoices, totalInvoiced, totalPaid, balance };
  }

  async markOverdueInvoices(companyId: string) {
    const now = new Date();
    const result = await this.prisma.invoice.updateMany({
      where: {
        companyId,
        deletedAt: null,
        status: { in: [InvoiceStatus.SENT, InvoiceStatus.PARTIALLY_PAID] },
        dueDate: { lt: now },
      },
      data: { status: InvoiceStatus.OVERDUE },
    });

    return { markedOverdue: result.count };
  }

  private async generateInvoiceNumber(companyId: string): Promise<string> {
    const count = await this.prisma.invoice.count({ where: { companyId } });
    const year = new Date().getFullYear();
    return `INV-${year}-${String(count + 1).padStart(4, '0')}`;
  }
}
