import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Tenant } from '../common/decorators/tenant.decorator';
import type { RequestTenant, RequestUser } from '../common/interfaces/request-context.interface';
import { PromoCodesService } from '../platform-admin/promo-codes.service';
import { ActivateSubscriptionDto } from './dto/activate-subscription.dto';
import { RegisterCompanyDto } from './dto/register-company.dto';
import { OnboardingSetupDto } from './dto/onboarding-setup.dto';
import { OnboardingService } from './onboarding.service';

@ApiTags('Onboarding')
@Controller('onboarding')
export class OnboardingController {
  constructor(
    private readonly onboardingService: OnboardingService,
    private readonly promoCodesService: PromoCodesService,
  ) {}

  @Public()
  @Get('plans')
  @ApiOperation({
    summary: 'List available subscription plans (public)',
    description:
      'Returns all active platform plans with pricing, limits and features. ' +
      'Call this before registration so the user can choose a plan.',
  })
  listPlans() {
    return this.onboardingService.listPlans();
  }

  @Public()
  @Post('register')
  @ApiOperation({
    summary: 'Register a new company / individual account',
    description:
      'Creates the company, owner user, default roles/permissions and a 14-day free trial subscription. ' +
      'Returns an access token so the user can start immediately. ' +
      'Pass planCode from GET /onboarding/plans to pre-select a plan (defaults to TEAM). Valid codes: SOLE_TRADER, TEAM, ENTERPRISE.',
  })
  register(@Body() dto: RegisterCompanyDto) {
    return this.onboardingService.registerCompany(dto);
  }

  @ApiBearerAuth()
  @Get('subscription-status')
  @ApiOperation({
    summary: 'Get current subscription status for the authenticated account',
    description: 'Returns trial days remaining, plan limits, and whether the account needs to activate.',
  })
  subscriptionStatus(@Tenant() tenant: RequestTenant) {
    return this.onboardingService.getSubscriptionStatus(tenant.companyId);
  }

  @ApiBearerAuth()
  @Post('subscription-status')
  @ApiOperation({
    summary: 'Get current subscription status (POST variant)',
    description: 'Returns trial days remaining, plan limits, and whether the account needs to activate.',
  })
  subscriptionStatusPost(@Tenant() tenant: RequestTenant) {
    return this.onboardingService.getSubscriptionStatus(tenant.companyId);
  }

  @ApiBearerAuth()
  @Post('activate-subscription')
  @ApiOperation({
    summary: 'Activate subscription (end trial and pay)',
    description:
      'Initiates payment via PayNow/EcoCash to activate the subscription. ' +
      'Paid plans return a paymentUrl to redirect the user to the payment gateway.',
  })
  activateSubscription(
    @Tenant() tenant: RequestTenant,
    @CurrentUser() user: RequestUser,
    @Body() dto: ActivateSubscriptionDto,
  ) {
    return this.onboardingService.activateSubscription(tenant.companyId, dto, user.email);
  }

  @Public()
  @Get('options')
  @ApiOperation({
    summary: 'Get available setup options (public)',
    description: 'Returns all available sectors, project types, stakeholder types and workflow templates.',
  })
  getOptions() {
    return this.onboardingService.getOptions();
  }

  @ApiBearerAuth()
  @Post('setup')
  @ApiOperation({
    summary: 'Save onboarding setup selections',
    description: 'Persists selected sectors, project types, stakeholders and workflows. Auto-creates roles for each stakeholder type.',
  })
  saveSetup(
    @Tenant() tenant: RequestTenant,
    @Body() dto: OnboardingSetupDto,
  ) {
    return this.onboardingService.saveOnboardingSetup(tenant.companyId, dto);
  }

  @ApiBearerAuth()
  @Get('setup')
  @ApiOperation({
    summary: 'Get current onboarding setup for the authenticated tenant',
    description: 'Returns the previously saved setup selections (for wizard resume).',
  })
  getSetup(@Tenant() tenant: RequestTenant) {
    return this.onboardingService.getOnboardingSetup(tenant.companyId);
  }

  @ApiBearerAuth()
  @Get('validate-promo')
  @ApiOperation({ summary: 'Validate a promo code and preview the discount' })
  validatePromo(
    @Tenant() tenant: RequestTenant,
    @Query('code') code: string,
  ) {
    return this.promoCodesService.validate(code ?? '', tenant.companyId);
  }
}
