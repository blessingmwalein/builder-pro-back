import { Injectable, NotFoundException } from '@nestjs/common';
import {
  InvoiceStatus,
  PaymentMethod,
  PaymentStatus,
  Prisma,
  SubscriptionStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PaynowProvider } from './paynow.provider';
import { PaymentInitiationRequest } from './interfaces/payment-provider.interface';

@Injectable()
export class BillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paynowProvider: PaynowProvider,
  ) {}

  async initiatePaynowPayment(input: PaymentInitiationRequest) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: input.invoiceId, companyId: input.companyId, deletedAt: null },
      select: { id: true },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    const initiated = await this.paynowProvider.initiatePayment(input);

    await this.prisma.payment.upsert({
      where: {
        companyId_transactionRef: {
          companyId: input.companyId,
          transactionRef: initiated.providerReference,
        },
      },
      create: {
        companyId: input.companyId,
        invoiceId: input.invoiceId,
        transactionRef: initiated.providerReference,
        method: PaymentMethod.PAYNOW,
        status: this.toPaymentStatus(initiated.status),
        amount: input.amount,
        providerPayload: {
          initiated: initiated.rawPayload,
          pollUrl: initiated.pollUrl,
          instructions: initiated.instructions,
          providerStatus: initiated.providerStatus,
        } as Prisma.InputJsonValue,
        paidAt: initiated.status === 'SUCCESS' ? new Date() : null,
      },
      update: {
        status: this.toPaymentStatus(initiated.status),
        providerPayload: {
          initiated: initiated.rawPayload,
          pollUrl: initiated.pollUrl,
          instructions: initiated.instructions,
          providerStatus: initiated.providerStatus,
        } as Prisma.InputJsonValue,
        paidAt: initiated.status === 'SUCCESS' ? new Date() : null,
      },
    });

    if (initiated.status === 'SUCCESS') {
      await this.syncInvoiceTotals(input.invoiceId!);
    }

    return {
      ...initiated,
      message:
        initiated.status === 'SUCCESS'
          ? 'Payment completed successfully.'
          : 'Payment initiated. Complete checkout then poll status or wait for webhook.',
    };
  }

  async pollPaynowStatus(payload: { reference?: string; companyId?: string; pollUrl?: string }) {
    const payment = await this.findPaymentForStatusCheck(payload);
    if (!payment) {
      return { acknowledged: false, reason: 'Payment reference not found' };
    }

    return this.applyPaynowStatusUpdate(payment.id, payment.status, payment.invoiceId, payment.subscriptionId, {
      reference: payment.transactionRef,
      pollurl: payload.pollUrl ?? this.extractPollUrl(payment.providerPayload),
    });
  }

  async handlePaynowWebhook(payload: Record<string, unknown>) {
    const parsed = this.paynowProvider.parseStatusUpdate(payload);

    const payment = await this.findPaymentForStatusCheck({
      reference: parsed.providerReference,
      companyId: payload.companyId ? String(payload.companyId) : undefined,
      pollUrl: parsed.pollUrl,
    });

    if (!payment) {
      return { acknowledged: false, reason: 'Payment reference not found' };
    }

    return this.applyPaynowStatusUpdate(
      payment.id,
      payment.status,
      payment.invoiceId,
      payment.subscriptionId,
      {
        reference: parsed.providerReference,
        pollurl: parsed.pollUrl ?? this.extractPollUrl(payment.providerPayload),
      },
      payload,
    );
  }

  private async applyPaynowStatusUpdate(
    paymentId: string,
    previousStatus: PaymentStatus,
    invoiceId: string | null,
    subscriptionId: string | null,
    verifier: { reference: string; pollurl?: string },
    webhookPayload?: Record<string, unknown>,
  ) {
    const pollUrl = verifier.pollurl;

    if (!pollUrl) {
      return {
        acknowledged: false,
        reason: 'Missing pollUrl for payment verification',
      };
    }

    const verified = await this.paynowProvider.verifyPayment(pollUrl);
    const paymentStatus = this.toPaymentStatus(verified.status);

    await this.prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: paymentStatus,
        providerPayload: {
          verified: verified.rawPayload,
          webhook: webhookPayload ?? null,
          pollUrl: verified.pollUrl ?? pollUrl,
          providerStatus: verified.providerStatus,
        } as Prisma.InputJsonValue,
        paidAt: paymentStatus === PaymentStatus.SUCCESS ? new Date() : null,
      },
    });

    if (paymentStatus === PaymentStatus.SUCCESS && previousStatus !== PaymentStatus.SUCCESS) {
      if (invoiceId) {
        await this.syncInvoiceTotals(invoiceId);
      }
      if (subscriptionId) {
        await this.activateSubscriptionAfterPayment(subscriptionId);
      }
    }

    return {
      acknowledged: true,
      providerReference: verified.providerReference,
      status: paymentStatus,
      pollUrl: verified.pollUrl ?? pollUrl,
    };
  }

  private async findPaymentForStatusCheck(payload: {
    reference?: string;
    companyId?: string;
    pollUrl?: string;
  }) {
    const reference = payload.reference;
    const pollUrl = payload.pollUrl;

    if (reference) {
      return this.prisma.payment.findFirst({
        where: {
          transactionRef: reference,
          ...(payload.companyId ? { companyId: payload.companyId } : {}),
        },
        select: {
          id: true,
          invoiceId: true,
          subscriptionId: true,
          status: true,
          transactionRef: true,
          providerPayload: true,
        },
      });
    }

    if (!pollUrl) {
      return null;
    }

    const candidates = await this.prisma.payment.findMany({
      where: {
        ...(payload.companyId ? { companyId: payload.companyId } : {}),
      },
      select: {
        id: true,
        invoiceId: true,
        subscriptionId: true,
        status: true,
        transactionRef: true,
        providerPayload: true,
      },
      take: 100,
      orderBy: { createdAt: 'desc' },
    });

    return candidates.find((item) => this.extractPollUrl(item.providerPayload) === pollUrl) ?? null;
  }

  private extractPollUrl(payload: Prisma.JsonValue | null): string | undefined {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return undefined;
    }

    const value = payload as Record<string, unknown>;
    const fromRoot = value.pollUrl;
    if (typeof fromRoot === 'string' && fromRoot.length > 0) return fromRoot;

    const fromInitiated = value.initiated;
    if (fromInitiated && typeof fromInitiated === 'object' && !Array.isArray(fromInitiated)) {
      const initiatedPollUrl = (fromInitiated as Record<string, unknown>).pollUrl;
      if (typeof initiatedPollUrl === 'string' && initiatedPollUrl.length > 0) return initiatedPollUrl;
    }

    const fromVerified = value.verified;
    if (fromVerified && typeof fromVerified === 'object' && !Array.isArray(fromVerified)) {
      const verifiedPollUrl = (fromVerified as Record<string, unknown>).pollUrl;
      if (typeof verifiedPollUrl === 'string' && verifiedPollUrl.length > 0) return verifiedPollUrl;
    }

    return undefined;
  }

  private async activateSubscriptionAfterPayment(subscriptionId: string) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { id: subscriptionId },
      select: { id: true, billingCycle: true, status: true },
    });

    if (!subscription || subscription.status === SubscriptionStatus.ACTIVE) return;

    const now = new Date();
    const periodEnd = new Date(now);
    subscription.billingCycle === 'ANNUAL'
      ? periodEnd.setFullYear(periodEnd.getFullYear() + 1)
      : periodEnd.setMonth(periodEnd.getMonth() + 1);

    await this.prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        status: SubscriptionStatus.ACTIVE,
        currentPeriodFrom: now,
        currentPeriodTo: periodEnd,
      },
    });
  }

  private async syncInvoiceTotals(invoiceId: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      select: { id: true, totalAmount: true },
    });

    if (!invoice) return;

    const paid = await this.prisma.payment.aggregate({
      where: { invoiceId, status: PaymentStatus.SUCCESS, deletedAt: null },
      _sum: { amount: true },
    });

    const paidAmount = Number(paid._sum.amount ?? 0);
    const totalAmount = Number(invoice.totalAmount);
    const balanceAmount = Math.max(totalAmount - paidAmount, 0);
    const status =
      balanceAmount === 0
        ? InvoiceStatus.PAID
        : paidAmount > 0
          ? InvoiceStatus.PARTIALLY_PAID
          : InvoiceStatus.SENT;

    await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: { paidAmount, balanceAmount, status },
    });
  }

  private toPaymentStatus(status: 'PENDING' | 'SUCCESS' | 'FAILED'): PaymentStatus {
    if (status === 'SUCCESS') return PaymentStatus.SUCCESS;
    if (status === 'FAILED') return PaymentStatus.FAILED;
    return PaymentStatus.PENDING;
  }
}
