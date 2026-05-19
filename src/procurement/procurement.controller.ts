import {
  Body,
  Controller,
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
import { ProcurementService } from './procurement.service';
import { CreatePrDto } from './dto/create-pr.dto';
import { CreatePoDto } from './dto/create-po.dto';
import { ReceiveDeliveryDto } from './dto/receive-delivery.dto';

@ApiTags('Procurement')
@ApiBearerAuth()
@Controller('procurement')
export class ProcurementController {
  constructor(private readonly service: ProcurementService) {}

  // ─── Purchase Requests ──────────────────────────────────────────────────────

  @Permissions('materials.*', 'materials.manage')
  @Post('purchase-requests')
  @ApiOperation({ summary: 'Create a purchase request' })
  createPR(
    @Tenant() tenant: RequestTenant,
    @CurrentUser() user: RequestUser,
    @Body() dto: CreatePrDto,
  ) {
    return this.service.createPR(tenant.companyId, user.userId, dto);
  }

  @Permissions('materials.*', 'materials.view')
  @Get('purchase-requests')
  @ApiOperation({ summary: 'List purchase requests' })
  @ApiQuery({ name: 'projectId', required: false })
  @ApiQuery({ name: 'status', required: false })
  listPRs(
    @Tenant() tenant: RequestTenant,
    @Query() query: PaginationQueryDto & { projectId?: string; status?: string },
  ) {
    return this.service.listPRs(tenant.companyId, query);
  }

  @Permissions('materials.*', 'materials.view')
  @Get('purchase-requests/:id')
  @ApiOperation({ summary: 'Get a purchase request' })
  findOnePR(@Tenant() tenant: RequestTenant, @Param('id') id: string) {
    return this.service.findOnePR(tenant.companyId, id);
  }

  @Permissions('materials.*', 'materials.manage')
  @Post('purchase-requests/:id/submit')
  @ApiOperation({ summary: 'Submit a purchase request for approval' })
  submitPR(@Tenant() tenant: RequestTenant, @Param('id') id: string) {
    return this.service.submitPR(tenant.companyId, id);
  }

  @Permissions('materials.*', 'materials.approve')
  @Post('purchase-requests/:id/approve')
  @ApiOperation({ summary: 'Approve a submitted purchase request' })
  approvePR(
    @Tenant() tenant: RequestTenant,
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
  ) {
    return this.service.approvePR(tenant.companyId, id, user.userId);
  }

  @Permissions('materials.*', 'materials.approve')
  @Post('purchase-requests/:id/reject')
  @ApiOperation({ summary: 'Reject a purchase request' })
  rejectPR(
    @Tenant() tenant: RequestTenant,
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() body: { notes?: string },
  ) {
    return this.service.rejectPR(tenant.companyId, id, user.userId, body.notes);
  }

  // ─── Purchase Orders ────────────────────────────────────────────────────────

  @Permissions('materials.*', 'materials.manage')
  @Post('purchase-orders')
  @ApiOperation({ summary: 'Create a purchase order' })
  createPO(@Tenant() tenant: RequestTenant, @Body() dto: CreatePoDto) {
    return this.service.createPO(tenant.companyId, dto);
  }

  @Permissions('materials.*', 'materials.view')
  @Get('purchase-orders')
  @ApiOperation({ summary: 'List purchase orders' })
  @ApiQuery({ name: 'supplierId', required: false })
  @ApiQuery({ name: 'status', required: false })
  listPOs(
    @Tenant() tenant: RequestTenant,
    @Query() query: PaginationQueryDto & { supplierId?: string; status?: string },
  ) {
    return this.service.listPOs(tenant.companyId, query);
  }

  @Permissions('materials.*', 'materials.view')
  @Get('purchase-orders/:id')
  @ApiOperation({ summary: 'Get a purchase order with delivery notes' })
  findOnePO(@Tenant() tenant: RequestTenant, @Param('id') id: string) {
    return this.service.findOnePO(tenant.companyId, id);
  }

  @Permissions('materials.*', 'materials.manage')
  @Post('purchase-orders/:id/send')
  @ApiOperation({ summary: 'Mark a purchase order as sent to supplier' })
  sendPO(@Tenant() tenant: RequestTenant, @Param('id') id: string) {
    return this.service.sendPO(tenant.companyId, id);
  }

  // ─── Delivery Notes ─────────────────────────────────────────────────────────

  @Permissions('materials.*', 'materials.manage')
  @Post('purchase-orders/:id/deliver')
  @ApiOperation({ summary: 'Record delivery against a purchase order' })
  receiveDelivery(
    @Tenant() tenant: RequestTenant,
    @CurrentUser() user: RequestUser,
    @Param('id') poId: string,
    @Body() dto: ReceiveDeliveryDto,
  ) {
    return this.service.receiveDelivery(tenant.companyId, poId, user.userId, dto);
  }

  @Permissions('materials.*', 'materials.view')
  @Get('deliveries')
  @ApiOperation({ summary: 'List delivery notes' })
  @ApiQuery({ name: 'poId', required: false })
  listDeliveries(
    @Tenant() tenant: RequestTenant,
    @Query() query: PaginationQueryDto & { poId?: string },
  ) {
    return this.service.listDeliveries(tenant.companyId, query);
  }
}
