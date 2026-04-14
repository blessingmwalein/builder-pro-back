import { Process, Processor } from '@nestjs/bull';
import type { Job } from 'bull';
import { PrismaService } from '../../prisma/prisma.service';

@Processor('reports')
export class ReportsProcessor {
  constructor(private readonly prisma: PrismaService) {}

  @Process('generate')
  async handleGenerate(job: Job<{ reportId: string; companyId: string }>) {
    await this.prisma.report.updateMany({
      where: {
        id: job.data.reportId,
        companyId: job.data.companyId,
      },
      data: {
        fileKey: `reports/${job.data.reportId}.csv`,
      },
    });
  }
}
