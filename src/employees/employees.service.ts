import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';

@Injectable()
export class EmployeesService {
  constructor(private readonly prisma: PrismaService) {}

  create(companyId: string, dto: CreateEmployeeDto) {
    return this.prisma.employee.create({
      data: {
        companyId,
        userId: dto.userId,
        employeeCode: dto.employeeCode,
        jobTitle: dto.jobTitle,
        department: (dto as any).department,
        trade: (dto as any).trade,
        idNumber: (dto as any).idNumber,
        employmentType: (dto as any).employmentType ?? 'FULL_TIME',
        hourlyRate: dto.hourlyRate,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });
  }

  async list(companyId: string, query: PaginationQueryDto & { search?: string; isActive?: boolean | string }) {
    const pageRaw = Number(query.page);
    const limitRaw = Number(query.limit);
    const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;
    const limit = Number.isFinite(limitRaw) && limitRaw > 0
      ? Math.min(Math.floor(limitRaw), 100)
      : 20;
    const skip = (page - 1) * limit;
    const isActive = this.toBoolean(query.isActive);

    const where: any = {
      companyId,
      deletedAt: null,
    };

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    if (query.search) {
      where.OR = [
        { jobTitle: { contains: query.search, mode: 'insensitive' as const } },
        { department: { contains: query.search, mode: 'insensitive' as const } },
        { trade: { contains: query.search, mode: 'insensitive' as const } },
      ];
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.employee.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true } },
        },
      }),
      this.prisma.employee.count({ where }),
    ]);

    return { items, meta: { page, limit, total } };
  }

  private toBoolean(value: boolean | string | undefined): boolean | undefined {
    if (typeof value === 'boolean') return value;
    if (typeof value !== 'string') return undefined;

    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
    return undefined;
  }

  async findOne(companyId: string, id: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { id, companyId, deletedAt: null },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, avatarUrl: true } },
      },
    });

    if (!employee) throw new NotFoundException('Employee not found');

    const [hoursWorked, tasksCompleted] = await Promise.all([
      this.prisma.timeEntry.aggregate({
        where: { companyId, workerId: employee.userId ?? '', status: 'APPROVED', deletedAt: null },
        _sum: { regularHours: true, overtimeHours: true, labourCost: true },
        _count: { _all: true },
      }),
      this.prisma.task.count({
        where: {
          companyId,
          status: 'DONE',
          deletedAt: null,
          assignees: { some: { userId: employee.userId ?? '', deletedAt: null } },
        },
      }),
    ]);

    return {
      ...employee,
      performance: {
        totalRegularHours: Number(hoursWorked._sum.regularHours ?? 0),
        totalOvertimeHours: Number(hoursWorked._sum.overtimeHours ?? 0),
        totalLabourCost: Number(hoursWorked._sum.labourCost ?? 0),
        totalTimesheetEntries: hoursWorked._count._all,
        tasksCompleted,
      },
    };
  }

  async update(companyId: string, id: string, dto: UpdateEmployeeDto) {
    const employee = await this.prisma.employee.findFirst({
      where: { id, companyId, deletedAt: null },
      select: { id: true },
    });

    if (!employee) throw new NotFoundException('Employee not found');

    return this.prisma.employee.update({
      where: { id },
      data: {
        userId: dto.userId,
        employeeCode: dto.employeeCode,
        jobTitle: dto.jobTitle,
        department: (dto as any).department,
        trade: (dto as any).trade,
        idNumber: (dto as any).idNumber,
        employmentType: (dto as any).employmentType,
        hourlyRate: dto.hourlyRate,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
      },
    });
  }

  async toggleStatus(companyId: string, id: string, isActive: boolean) {
    const employee = await this.prisma.employee.findFirst({
      where: { id, companyId, deletedAt: null },
      select: { id: true },
    });

    if (!employee) throw new NotFoundException('Employee not found');

    return this.prisma.employee.update({
      where: { id },
      data: { isActive, endDate: !isActive ? new Date() : null },
    });
  }

  async remove(companyId: string, id: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { id, companyId, deletedAt: null },
      select: { id: true },
    });

    if (!employee) throw new NotFoundException('Employee not found');

    await this.prisma.employee.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return { success: true };
  }

  async getPayrollExport(
    companyId: string,
    from: string,
    to: string,
  ): Promise<{ rows: any[] }> {
    const entries = await this.prisma.timeEntry.findMany({
      where: {
        companyId,
        status: 'APPROVED',
        deletedAt: null,
        clockInAt: {
          gte: new Date(from),
          lte: new Date(to),
        },
      },
      include: {
        worker: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });

    const employeeMap = new Map<string, {
      userId: string;
      firstName: string;
      lastName: string;
      email: string;
      regularHours: number;
      overtimeHours: number;
      grossPay: number;
      entries: number;
    }>();

    for (const entry of entries) {
      const key = entry.workerId;
      if (!employeeMap.has(key)) {
        employeeMap.set(key, {
          userId: entry.workerId,
          firstName: entry.worker.firstName,
          lastName: entry.worker.lastName,
          email: entry.worker.email,
          regularHours: 0,
          overtimeHours: 0,
          grossPay: 0,
          entries: 0,
        });
      }

      const row = employeeMap.get(key)!;
      row.regularHours += Number(entry.regularHours);
      row.overtimeHours += Number(entry.overtimeHours);
      row.grossPay += Number(entry.labourCost);
      row.entries += 1;
    }

    return { rows: Array.from(employeeMap.values()) };
  }
}
