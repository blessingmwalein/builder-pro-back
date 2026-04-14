import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InvoiceStatus } from '@prisma/client';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { Permissions } from '../common/decorators/permissions.decorator';
import { Tenant } from '../common/decorators/tenant.decorator';
import type { RequestTenant } from '../common/interfaces/request-context.interface';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { RecordPaymentDto } from './dto/record-payment.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { InvoicesService } from './invoices.service';

@ApiTags('Invoices')
@ApiBearerAuth()
@Controller('invoices')
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Permissions('invoices.*', 'invoices.create')
  @Post()
  @ApiOperation({ summary: 'Create a new invoice (DRAFT)' })
  create(@Tenant() tenant: RequestTenant, @Body() dto: CreateInvoiceDto) {
    return this.invoicesService.create(tenant.companyId, dto);
  }

  @Permissions('invoices.*', 'invoices.view')
  @Get()
  @ApiOperation({ summary: 'List invoices with filters' })
  list(
    @Tenant() tenant: RequestTenant,
    @Query() query: PaginationQueryDto & { status?: InvoiceStatus; clientId?: string; projectId?: string },
  ) {
    return this.invoicesService.list(tenant.companyId, query);
  }

  @Permissions('invoices.*', 'invoices.view')
  @Get('aging-report')
  @ApiOperation({ summary: 'Invoice aging report (overdue by 30/60/90 day buckets)' })
  agingReport(@Tenant() tenant: RequestTenant) {
    return this.invoicesService.getAgingReport(tenant.companyId);
  }

  @Permissions('invoices.*', 'invoices.view')
  @Get(':id')
  @ApiOperation({ summary: 'Get invoice details' })
  findOne(@Tenant() tenant: RequestTenant, @Param('id') id: string) {
    return this.invoicesService.findOne(tenant.companyId, id);
  }

  @Permissions('invoices.*', 'invoices.view')
  @Get(':id/statement')
  @ApiOperation({ summary: 'Get client statement for an invoice client' })
  clientStatement(@Tenant() tenant: RequestTenant, @Param('id') clientId: string) {
    return this.invoicesService.getClientStatement(tenant.companyId, clientId);
  }

  @Permissions('invoices.*', 'invoices.create')
  @Put(':id')
  @ApiOperation({ summary: 'Update invoice (only DRAFT/SENT)' })
  update(
    @Tenant() tenant: RequestTenant,
    @Param('id') id: string,
    @Body() dto: UpdateInvoiceDto,
  ) {
    return this.invoicesService.update(tenant.companyId, id, dto);
  }

  @Permissions('invoices.*', 'invoices.send')
  @Put(':id/send')
  @ApiOperation({ summary: 'Send invoice to client (DRAFT → SENT)' })
  send(@Tenant() tenant: RequestTenant, @Param('id') id: string) {
    return this.invoicesService.send(tenant.companyId, id);
  }

  @Permissions('invoices.*', 'invoices.create')
  @Put(':id/void')
  @ApiOperation({ summary: 'Void an invoice (write off)' })
  void(@Tenant() tenant: RequestTenant, @Param('id') id: string) {
    return this.invoicesService.void(tenant.companyId, id);
  }

  @Permissions('invoices.*', 'invoices.create')
  @Delete(':id')
  @ApiOperation({ summary: 'Delete invoice (soft delete)' })
  remove(@Tenant() tenant: RequestTenant, @Param('id') id: string) {
    return this.invoicesService.remove(tenant.companyId, id);
  }

  @Permissions('invoices.*', 'invoices.mark_paid')
  @Post(':id/payments')
  @ApiOperation({ summary: 'Record a payment against an invoice' })
  recordPayment(
    @Tenant() tenant: RequestTenant,
    @Param('id') id: string,
    @Body() dto: RecordPaymentDto,
  ) {
    return this.invoicesService.recordPayment(tenant.companyId, id, dto);
  }

  @Permissions('invoices.*')
  @Put('mark-overdue/run')
  @ApiOperation({ summary: 'Mark past-due invoices as overdue (admin/cron trigger)' })
  markOverdue(@Tenant() tenant: RequestTenant) {
    return this.invoicesService.markOverdueInvoices(tenant.companyId);
  }
}
