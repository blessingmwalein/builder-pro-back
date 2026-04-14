import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';

@Injectable()
export class CrmService {
  constructor(private readonly prisma: PrismaService) {}

  createClient(companyId: string, dto: CreateClientDto) {
    return this.prisma.client.create({
      data: {
        companyId,
        name: dto.name,
        contactPerson: (dto as any).contactPerson,
        clientType: (dto as any).clientType,
        email: dto.email,
        phone: dto.phone,
        address: dto.address,
        notes: (dto as any).notes,
      },
    });
  }

  async listClients(companyId: string, query: PaginationQueryDto & { search?: string }) {
    const pageRaw = Number(query.page);
    const limitRaw = Number(query.limit);
    const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;
    const limit = Number.isFinite(limitRaw) && limitRaw > 0
      ? Math.min(Math.floor(limitRaw), 100)
      : 20;
    const skip = (page - 1) * limit;

    const where: any = {
      companyId,
      deletedAt: null,
    };

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' as const } },
        { email: { contains: query.search, mode: 'insensitive' as const } },
      ];
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.client.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          _count: {
            select: { projects: true, quotes: true, invoices: true },
          },
        },
      }),
      this.prisma.client.count({ where }),
    ]);

    return { items, meta: { page, limit, total } };
  }

  async getClient(companyId: string, id: string) {
    const client = await this.prisma.client.findFirst({
      where: { id, companyId, deletedAt: null },
      include: {
        projects: {
          where: { deletedAt: null },
          select: { id: true, name: true, code: true, status: true, startDate: true, endDate: true },
          orderBy: { createdAt: 'desc' },
        },
        quotes: {
          where: { deletedAt: null },
          select: { id: true, quoteNumber: true, status: true, totalAmount: true, issueDate: true },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        invoices: {
          where: { deletedAt: null },
          select: {
            id: true,
            invoiceNumber: true,
            status: true,
            totalAmount: true,
            paidAmount: true,
            balanceAmount: true,
            dueDate: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!client) throw new NotFoundException('Client not found');

    const invoiceAgg = await this.prisma.invoice.aggregate({
      where: { companyId, clientId: id, deletedAt: null },
      _sum: { totalAmount: true, paidAmount: true, balanceAmount: true },
    });

    return {
      ...client,
      financialSummary: {
        totalInvoiced: Number(invoiceAgg._sum.totalAmount ?? 0),
        totalPaid: Number(invoiceAgg._sum.paidAmount ?? 0),
        outstandingBalance: Number(invoiceAgg._sum.balanceAmount ?? 0),
      },
    };
  }

  async updateClient(companyId: string, id: string, dto: UpdateClientDto) {
    const client = await this.prisma.client.findFirst({
      where: { id, companyId, deletedAt: null },
      select: { id: true },
    });

    if (!client) throw new NotFoundException('Client not found');

    return this.prisma.client.update({
      where: { id },
      data: {
        name: dto.name,
        contactPerson: dto.contactPerson,
        clientType: dto.clientType,
        email: dto.email,
        phone: dto.phone,
        address: dto.address,
        notes: dto.notes,
      },
    });
  }

  async deleteClient(companyId: string, id: string) {
    const client = await this.prisma.client.findFirst({
      where: { id, companyId, deletedAt: null },
      select: { id: true },
    });

    if (!client) throw new NotFoundException('Client not found');

    await this.prisma.client.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return { success: true };
  }
}
