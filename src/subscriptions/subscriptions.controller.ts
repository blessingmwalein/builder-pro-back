import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Permissions } from '../common/decorators/permissions.decorator';
import { Tenant } from '../common/decorators/tenant.decorator';
import type { RequestTenant } from '../common/interfaces/request-context.interface';
import { ChangePlanDto } from './dto/change-plan.dto';
import { SubscriptionsService } from './subscriptions.service';

@ApiTags('Subscriptions')
@ApiBearerAuth()
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Permissions('settings.*')
  @Get('plans')
  listPlans() {
    return this.subscriptionsService.listPlans();
  }

  @Permissions('settings.*')
  @Get('current')
  current(@Tenant() tenant: RequestTenant) {
    return this.subscriptionsService.current(tenant.companyId);
  }

  @Permissions('settings.*')
  @Post('change-plan')
  changePlan(@Tenant() tenant: RequestTenant, @Body() dto: ChangePlanDto) {
    return this.subscriptionsService.changePlan(tenant.companyId, dto);
  }
}
