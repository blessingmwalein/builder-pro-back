import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Permissions } from '../common/decorators/permissions.decorator';
import { Public } from '../common/decorators/public.decorator';
import { Tenant } from '../common/decorators/tenant.decorator';
import type { RequestTenant } from '../common/interfaces/request-context.interface';
import { BillingService } from './billing.service';

@ApiTags('Billing')
@ApiBearerAuth()
@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Permissions('invoices.*')
  @Post('paynow/initiate')
  initiate(
    @Tenant() tenant: RequestTenant,
    @Body()
    body: {
      invoiceId: string;
      amount: number;
      currency?: string;
      payerEmail?: string;
      payerPhone?: string;
      mode?: 'WEB' | 'MOBILE';
      mobileMethod?: 'ecocash' | 'onemoney';
      reference?: string;
      description?: string;
    },
  ) {
    return this.billingService.initiatePaynowPayment({
      companyId: tenant.companyId,
      invoiceId: body.invoiceId,
      amount: body.amount,
      currency: body.currency ?? 'USD',
      payerEmail: body.payerEmail,
      payerPhone: body.payerPhone,
      mode: body.mode,
      mobileMethod: body.mobileMethod,
      reference: body.reference,
      description: body.description,
    });
  }

  @Permissions('invoices.*')
  @Post('paynow/poll')
  poll(
    @Tenant() tenant: RequestTenant,
    @Body() body: { reference?: string; pollUrl?: string },
  ) {
    return this.billingService.pollPaynowStatus({
      companyId: tenant.companyId,
      reference: body.reference,
      pollUrl: body.pollUrl,
    });
  }

  @Public()
  @Post('webhooks/paynow')
  webhook(
    @Body() body: Record<string, unknown>,
  ) {
    return this.billingService.handlePaynowWebhook(body);
  }
}
