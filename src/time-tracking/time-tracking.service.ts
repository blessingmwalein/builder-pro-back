import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TimeEntryStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ApproveTimeEntryDto } from './dto/approve-time-entry.dto';
import { ClockInDto } from './dto/clock-in.dto';
import { ClockOutDto } from './dto/clock-out.dto';
import { ManualTimeEntryDto } from './dto/manual-entry.dto';
import { QueryTimeEntriesDto } from './dto/query-time-entries.dto';

@Injectable()
export class TimeTrackingService {
  constructor(private readonly prisma: PrismaService) {}

  async clockIn(companyId: string, workerId: string, dto: ClockInDto) {
    const openEntry = await this.prisma.timeEntry.findFirst({
      where: {
        companyId,
        workerId,
        clockOutAt: null,
        deletedAt: null,
      },
      select: { id: true },
    });

    if (openEntry) {
      throw new BadRequestException('Open time entry already exists. Clock out first.');
    }

    const employee = await this.prisma.employee.findFirst({
      where: { userId: workerId, companyId, deletedAt: null },
      select: { hourlyRate: true },
    });

    return this.prisma.timeEntry.create({
      data: {
        companyId,
        workerId,
        projectId: dto.projectId,
        taskId: dto.taskId,
        clockInAt: new Date(),
        gpsInLat: dto.gpsInLat,
        gpsInLng: dto.gpsInLng,
        hourlyRate: employee?.hourlyRate ?? 0,
      },
    });
  }

  async clockOut(
    companyId: string,
    workerId: string,
    id: string,
    dto: ClockOutDto,
  ) {
    const entry = await this.prisma.timeEntry.findFirst({
      where: { id, companyId, workerId, deletedAt: null },
    });

    if (!entry) throw new NotFoundException('Time entry not found');
    if (entry.clockOutAt) throw new BadRequestException('Time entry already closed');

    const now = new Date();
    const breakMinutes = dto.breakMinutes ?? 0;
    const totalMinutes = Math.max(
      Math.floor((now.getTime() - entry.clockInAt.getTime()) / 60000) - breakMinutes,
      0,
    );
    const totalHours = totalMinutes / 60;
    const regularHours = Math.min(totalHours, 8);
    const overtimeHours = Math.max(totalHours - 8, 0);
    const labourCost = totalHours * Number(entry.hourlyRate || 0);

    return this.prisma.timeEntry.update({
      where: { id },
      data: {
        clockOutAt: now,
        breakMinutes,
        gpsOutLat: dto.gpsOutLat,
        gpsOutLng: dto.gpsOutLng,
        regularHours,
        overtimeHours,
        labourCost,
      },
    });
  }

  async createManualEntry(
    companyId: string,
    workerId: string,
    dto: ManualTimeEntryDto,
  ) {
    const clockIn = new Date(dto.clockInAt);
    const clockOut = new Date(dto.clockOutAt);

    if (clockOut <= clockIn) {
      throw new BadRequestException('Clock out must be after clock in');
    }

    const breakMinutes = dto.breakMinutes ?? 0;
    const totalMinutes = Math.max(
      Math.floor((clockOut.getTime() - clockIn.getTime()) / 60000) - breakMinutes,
      0,
    );
    const totalHours = totalMinutes / 60;
    const regularHours = Math.min(totalHours, 8);
    const overtimeHours = Math.max(totalHours - 8, 0);

    const employee = await this.prisma.employee.findFirst({
      where: { userId: workerId, companyId, deletedAt: null },
      select: { hourlyRate: true },
    });

    const hourlyRate = Number(employee?.hourlyRate ?? 0);
    const labourCost = totalHours * hourlyRate;

    return this.prisma.timeEntry.create({
      data: {
        companyId,
        workerId,
        projectId: dto.projectId,
        taskId: dto.taskId,
        clockInAt: clockIn,
        clockOutAt: clockOut,
        breakMinutes,
        regularHours,
        overtimeHours,
        hourlyRate,
        labourCost,
        notes: dto.notes,
        isManualEntry: true,
        status: TimeEntryStatus.PENDING,
      },
    });
  }

  async approve(
    companyId: string,
    approverId: string,
    id: string,
    dto: ApproveTimeEntryDto,
  ) {
    const entry = await this.prisma.timeEntry.findFirst({
      where: { id, companyId, deletedAt: null },
      select: { id: true, clockOutAt: true },
    });

    if (!entry) throw new NotFoundException('Time entry not found');
    if (!entry.clockOutAt) throw new BadRequestException('Cannot approve active clock-in');

    if (
      dto.status !== TimeEntryStatus.APPROVED &&
      dto.status !== TimeEntryStatus.REJECTED
    ) {
      throw new BadRequestException('Status must be APPROVED or REJECTED');
    }

    return this.prisma.timeEntry.update({
      where: { id },
      data: {
        status: dto.status,
        approvedById: approverId,
        approvalComment: dto.approvalComment,
      },
    });
  }

  async listEntries(companyId: string, userId: string, userPermissions: string[], query: QueryTimeEntriesDto) {
    const limit = Math.min(query.limit, 100);
    const skip = (query.page - 1) * limit;

    const canViewAll = userPermissions.includes('timesheets.*') ||
      userPermissions.includes('timesheets.view_all');

    const where: any = {
      companyId,
      deletedAt: null,
      projectId: query.projectId,
      status: query.status,
    };

    if (!canViewAll) {
      where.workerId = userId;
    } else if (query.workerId) {
      where.workerId = query.workerId;
    }

    if (query.from || query.to) {
      where.clockInAt = {
        gte: query.from ? new Date(query.from) : undefined,
        lte: query.to ? new Date(query.to) : undefined,
      };
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.timeEntry.findMany({
        where,
        include: {
          worker: { select: { id: true, firstName: true, lastName: true } },
          project: { select: { id: true, name: true, code: true } },
          task: { select: { id: true, title: true } },
        },
        orderBy: { clockInAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.timeEntry.count({ where }),
    ]);

    return { items, meta: { page: query.page, limit, total } };
  }

  async getWeeklySummary(companyId: string, userId: string, weekStart: string) {
    const start = new Date(weekStart);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);

    const entries = await this.prisma.timeEntry.findMany({
      where: {
        companyId,
        workerId: userId,
        clockInAt: { gte: start, lt: end },
        deletedAt: null,
      },
      include: {
        project: { select: { id: true, name: true } },
        task: { select: { id: true, title: true } },
      },
    });

    const totalRegular = entries.reduce((s, e) => s + Number(e.regularHours), 0);
    const totalOvertime = entries.reduce((s, e) => s + Number(e.overtimeHours), 0);
    const totalPay = entries.reduce((s, e) => s + Number(e.labourCost), 0);

    return {
      weekStart: start,
      weekEnd: end,
      totalRegularHours: totalRegular,
      totalOvertimeHours: totalOvertime,
      totalHours: totalRegular + totalOvertime,
      estimatedGrossPay: totalPay,
      entries,
    };
  }

  async getActiveEntry(companyId: string, workerId: string) {
    return this.prisma.timeEntry.findFirst({
      where: { companyId, workerId, clockOutAt: null, deletedAt: null },
      include: {
        project: { select: { id: true, name: true } },
        task: { select: { id: true, title: true } },
      },
    });
  }
}
