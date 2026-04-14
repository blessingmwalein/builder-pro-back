import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { Paynow } from 'paynow';
import {
  PaymentInitiationRequest,
  PaymentInitiationResult,
  PaymentProvider,
} from './interfaces/payment-provider.interface';

@Injectable()
export class PaynowProvider implements PaymentProvider {
  private readonly integrationId = process.env.PAYNOW_INTEGRATION_ID;
  private readonly integrationKey = process.env.PAYNOW_INTEGRATION_KEY;
  private readonly resultUrl = process.env.PAYNOW_RESULT_URL;
  private readonly returnUrl = process.env.PAYNOW_RETURN_URL;
  private readonly useStub = process.env.PAYNOW_USE_STUB === 'true';

  async initiatePayment(
    input: PaymentInitiationRequest,
  ): Promise<PaymentInitiationResult> {
    if (this.useStub) {
      const providerReference = input.reference ?? `paynow_${input.invoiceId}_${Date.now()}`;
      return {
        providerReference,
        providerStatus: 'ok',
        pollUrl: `stub://poll/${encodeURIComponent(providerReference)}`,
        instructions: input.mode === 'MOBILE' ? 'Dial *151# and complete payment prompt.' : undefined,
        success: true,
        redirectUrl: input.mode === 'WEB' ? `https://example.test/paynow/${encodeURIComponent(providerReference)}` : undefined,
        status: 'PENDING',
        rawPayload: {
          adapter: 'paynow-stub',
          mode: input.mode ?? 'WEB',
          amount: input.amount,
          currency: input.currency,
        },
      };
    }

    this.assertConfigured();
    const paynow = this.buildClient();
    const reference = input.reference ?? `${input.companyId}-${input.invoiceId}-${Date.now()}`;
    const authEmail = input.payerEmail ?? 'billing@builderpro.local';
    const payment = paynow.createPayment(reference, authEmail);
    payment.add(input.description ?? `Payment ${reference}`, input.amount);

    const useMobile = input.mode === 'MOBILE';
    const mobileMethod = input.mobileMethod ?? 'ecocash';

    let response: any;

    if (useMobile) {
      if (!input.payerPhone) {
        throw new InternalServerErrorException('Payer phone is required for mobile payment.');
      }
      response = await paynow.sendMobile(payment, input.payerPhone, mobileMethod);
    } else {
      response = await paynow.send(payment);
    }

    if (!response) {
      throw new InternalServerErrorException('Paynow initiate request failed');
    }

    const payload = response as {
      success?: boolean;
      pollUrl?: string;
      redirectUrl?: string;
      instructions?: string;
      status?: string;
      error?: string;
    };

    if (!payload.success) {
      throw new InternalServerErrorException(payload.error ?? 'Paynow initiate request failed');
    }

    return {
      providerReference: reference,
      providerStatus: payload.status,
      pollUrl: payload.pollUrl,
      instructions: payload.instructions,
      success: payload.success,
      redirectUrl: payload.redirectUrl,
      status: this.normalizeStatus(payload.status),
      rawPayload: payload,
    };
  }

  async verifyPayment(pollUrl: string): Promise<PaymentInitiationResult> {
    if (this.useStub) {
      return {
        providerReference: pollUrl,
        providerStatus: 'sent',
        pollUrl,
        success: true,
        status: 'PENDING',
        rawPayload: {
          adapter: 'paynow-stub',
        },
      };
    }

    this.assertConfigured();
    const paynow = this.buildClient();
    const response = await paynow.pollTransaction(pollUrl);
    const payload = response as {
      reference?: string;
      status?: string;
      pollUrl?: string;
      paynowReference?: string;
      amount?: string;
      error?: string;
    };

    if (!payload) {
      throw new InternalServerErrorException('Paynow verify request failed');
    }

    return {
      providerReference: payload.reference ?? pollUrl,
      providerStatus: payload.status,
      pollUrl: payload.pollUrl ?? pollUrl,
      success: !payload.error,
      status: this.normalizeStatus(payload.status),
      rawPayload: payload,
    };
  }

  parseStatusUpdate(payload: Record<string, unknown>): PaymentInitiationResult {
    if (this.useStub) {
      const reference = String(payload.reference ?? 'stub-reference');
      const status = String(payload.status ?? 'PENDING');
      return {
        providerReference: reference,
        providerStatus: status,
        pollUrl: String(payload.pollurl ?? ''),
        success: true,
        status: this.normalizeStatus(status),
        rawPayload: payload,
      };
    }

    this.assertConfigured();
    const paynow = this.buildClient();
    const encodedBody = new URLSearchParams(
      Object.entries(payload).map(([key, value]) => [key, String(value ?? '')]),
    ).toString();

    const parsed = (paynow as any).parseStatusUpdate(encodedBody) as {
      reference?: string;
      status?: string;
      pollUrl?: string;
      paynowReference?: string;
      error?: string;
    };

    return {
      providerReference: parsed.reference ?? String(payload.reference ?? ''),
      providerStatus: parsed.status,
      pollUrl: parsed.pollUrl,
      success: !parsed.error,
      status: this.normalizeStatus(parsed.status),
      rawPayload: {
        ...payload,
        parsed,
      },
    };
  }

  private assertConfigured(): void {
    if (
      !this.integrationId ||
      !this.integrationKey ||
      !this.resultUrl ||
      !this.returnUrl
    ) {
      throw new InternalServerErrorException(
        'Paynow is not configured. Set PAYNOW_* variables or enable PAYNOW_USE_STUB=true',
      );
    }
  }

  private buildClient(): Paynow {
    return new Paynow(
      this.integrationId!,
      this.integrationKey!,
      this.resultUrl!,
      this.returnUrl!,
    );
  }

  private normalizeStatus(status?: string): 'PENDING' | 'SUCCESS' | 'FAILED' {
    const value = (status ?? '').trim().toUpperCase();
    if (value === 'PAID' || value === 'SUCCESS' || value === 'COMPLETED') {
      return 'SUCCESS';
    }

    if (value === 'FAILED' || value === 'CANCELED' || value === 'CANCELLED') {
      return 'FAILED';
    }

    return 'PENDING';
  }
}
