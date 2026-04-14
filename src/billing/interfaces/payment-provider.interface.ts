export interface PaymentInitiationRequest {
  companyId: string;
  invoiceId: string;
  amount: number;
  currency: string;
  reference?: string;
  description?: string;
  payerEmail?: string;
  payerPhone?: string;
  mode?: 'WEB' | 'MOBILE';
  mobileMethod?: 'ecocash' | 'onemoney';
}

export interface PaymentInitiationResult {
  providerReference: string;
  providerStatus?: string;
  pollUrl?: string;
  instructions?: string;
  success?: boolean;
  redirectUrl?: string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
  rawPayload?: unknown;
}

export interface PaymentProvider {
  initiatePayment(input: PaymentInitiationRequest): Promise<PaymentInitiationResult>;
  verifyPayment(pollUrl: string): Promise<PaymentInitiationResult>;
}
