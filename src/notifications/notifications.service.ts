import { Injectable } from '@nestjs/common';
import type { Queue } from 'bull';
import { InjectQueue } from '@nestjs/bull';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('notifications') private readonly notificationsQueue: Queue,
  ) {}

  async listForUser(companyId: string, userId: string, query: PaginationQueryDto) {
    const limit = Math.min(query.limit, 100);
    const skip = (query.page - 1) * limit;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where: { companyId, userId, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.notification.count({ where: { companyId, userId, deletedAt: null } }),
    ]);

    return { items, meta: { page: query.page, limit, total } };
  }

  markRead(companyId: string, userId: string, notificationId: string, isRead: boolean) {
    return this.prisma.notification.updateMany({
      where: { id: notificationId, companyId, userId },
      data: { isRead },
    });
  }

  async enqueueNotification(payload: {
    companyId: string;
    userId: string;
    title: string;
    body: string;
    type: 'GENERAL' | 'TASK_ASSIGNED' | 'INVOICE_PAID' | 'BUDGET_THRESHOLD' | 'TIMESHEET_APPROVAL_REQUIRED';
  }) {
    await this.notificationsQueue.add('send', payload, { attempts: 3, removeOnComplete: true });
  }
}
