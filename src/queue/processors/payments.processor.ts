import { Process, Processor } from '@nestjs/bull';
import type { Job } from 'bull';
import { PaymentStatus } from '@prisma/client';
import { PaynowProvider } from '../../billing/paynow.provider';
import { PrismaService } from '../../prisma/prisma.service';

@Processor('payments')
export class PaymentsProcessor {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paynowProvider: PaynowProvider,
  ) {}

  @Process('verify')
  async handleVerify(job: Job<{ reference: string; companyId?: string }>) {
    const payment = await this.prisma.payment.findFirst({
      where: {
        transactionRef: job.data.reference,
        ...(job.data.companyId ? { companyId: job.data.companyId } : {}),
      },
      select: { providerPayload: true },
    });

    const pollUrl = this.extractPollUrl(payment?.providerPayload);
    if (!pollUrl) return;

    const verified = await this.paynowProvider.verifyPayment(pollUrl);

    const status =
      verified.status === 'SUCCESS'
        ? PaymentStatus.SUCCESS
        : verified.status === 'FAILED'
          ? PaymentStatus.FAILED
          : PaymentStatus.PENDING;

    await this.prisma.payment.updateMany({
      where: {
        transactionRef: job.data.reference,
        ...(job.data.companyId ? { companyId: job.data.companyId } : {}),
      },
      data: {
        status,
        paidAt: status === PaymentStatus.SUCCESS ? new Date() : null,
      },
    });
  }

  private extractPollUrl(payload: unknown): string | undefined {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return undefined;
    }

    const record = payload as Record<string, unknown>;
    const root = record.pollUrl;
    if (typeof root === 'string' && root.length > 0) return root;

    const initiated = record.initiated;
    if (initiated && typeof initiated === 'object' && !Array.isArray(initiated)) {
      const nested = (initiated as Record<string, unknown>).pollUrl;
      if (typeof nested === 'string' && nested.length > 0) return nested;
    }

    return undefined;
  }
}
