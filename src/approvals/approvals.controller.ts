import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Permissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Tenant } from '../common/decorators/tenant.decorator';
import type { RequestTenant, RequestUser } from '../common/interfaces/request-context.interface';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { ApprovalsService } from './approvals.service';
import { CreateApprovalDto } from './dto/create-approval.dto';
import { DecideStepDto } from './dto/decide-step.dto';

@ApiTags('Approvals')
@ApiBearerAuth()
@Controller('approvals')
export class ApprovalsController {
  constructor(private readonly service: ApprovalsService) {}

  @Permissions('projects.*', 'materials.*', 'financials.*')
  @Post()
  @ApiOperation({ summary: 'Create an approval request' })
  create(
    @Tenant() tenant: RequestTenant,
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateApprovalDto,
  ) {
    return this.service.create(tenant.companyId, user.userId, dto);
  }

  @Permissions('projects.*', 'materials.*', 'financials.*')
  @Get()
  @ApiOperation({ summary: 'List approval requests' })
  @ApiQuery({ name: 'entityType', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'myPending', required: false, description: 'Set to "true" to show only approvals pending your action' })
  list(
    @Tenant() tenant: RequestTenant,
    @CurrentUser() user: RequestUser,
    @Query() query: PaginationQueryDto & { entityType?: string; status?: string; myPending?: string },
  ) {
    return this.service.list(tenant.companyId, query, user.userId);
  }

  @Permissions('projects.*', 'materials.*', 'financials.*')
  @Get('pending/count')
  @ApiOperation({ summary: 'Count approvals pending the current user' })
  pendingCount(
    @Tenant() tenant: RequestTenant,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.pendingCount(tenant.companyId, user.userId);
  }

  @Permissions('projects.*', 'materials.*', 'financials.*')
  @Get(':id')
  @ApiOperation({ summary: 'Get an approval request with all steps' })
  findOne(@Tenant() tenant: RequestTenant, @Param('id') id: string) {
    return this.service.findOne(tenant.companyId, id);
  }

  @Permissions('projects.*', 'materials.*', 'financials.*')
  @Post(':id/steps/:stepId/decide')
  @ApiOperation({ summary: 'Approve or reject a step' })
  decide(
    @Tenant() tenant: RequestTenant,
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Param('stepId') stepId: string,
    @Body() dto: DecideStepDto,
  ) {
    return this.service.decide(tenant.companyId, id, stepId, user.userId, dto);
  }

  @Permissions('projects.*', 'materials.*', 'financials.*')
  @Delete(':id')
  @ApiOperation({ summary: 'Cancel an approval request' })
  cancel(
    @Tenant() tenant: RequestTenant,
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
  ) {
    return this.service.cancel(tenant.companyId, id, user.userId);
  }
}
