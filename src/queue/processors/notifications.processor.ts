import { Process, Processor } from '@nestjs/bull';
import type { Job } from 'bull';
import { PrismaService } from '../../prisma/prisma.service';

@Processor('notifications')
export class NotificationsProcessor {
  constructor(private readonly prisma: PrismaService) {}

  @Process('send')
  async handleSend(job: Job<{
    companyId: string;
    userId: string;
    title: string;
    body: string;
    type: 'GENERAL' | 'TASK_ASSIGNED' | 'INVOICE_PAID' | 'BUDGET_THRESHOLD' | 'TIMESHEET_APPROVAL_REQUIRED';
  }>) {
    await this.prisma.notification.create({
      data: {
        companyId: job.data.companyId,
        userId: job.data.userId,
        title: job.data.title,
        body: job.data.body,
        type: job.data.type,
      },
    });
  }
}
