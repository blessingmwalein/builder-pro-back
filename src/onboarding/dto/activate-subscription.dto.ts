import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentMethod } from '@prisma/client';

export enum BillingCycle {
  MONTHLY = 'MONTHLY',
  ANNUAL = 'ANNUAL',
}

export class ActivateSubscriptionDto {
  @ApiProperty({
    enum: PaymentMethod,
    example: PaymentMethod.PAYNOW,
    description: 'Payment method to use for subscription activation',
  })
  @IsEnum(PaymentMethod)
  method: PaymentMethod;

  @ApiPropertyOptional({
    enum: BillingCycle,
    default: BillingCycle.MONTHLY,
    description: 'Billing cycle — MONTHLY or ANNUAL (annual saves ~17%)',
  })
  @IsOptional()
  @IsEnum(BillingCycle)
  billingCycle?: BillingCycle;

  @ApiPropertyOptional({
    example: 'SMALL_BUSINESS',
    description: 'Change to a different plan at activation time (optional)',
  })
  @IsOptional()
  @IsString()
  planCode?: string;

  @ApiPropertyOptional({
    example: 'owner@builderpro.local',
    description: 'Payer email used by Paynow checkout and mobile wallet prompts',
  })
  @IsOptional()
  @IsString()
  payerEmail?: string;

  @ApiPropertyOptional({
    example: '0777123456',
    description: 'Required for mobile wallet payments like ECOCASH',
  })
  @IsOptional()
  @IsString()
  payerPhone?: string;
}
