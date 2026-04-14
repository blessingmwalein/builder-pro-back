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
import { QuoteStatus } from '@prisma/client';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { Permissions } from '../common/decorators/permissions.decorator';
import { Tenant } from '../common/decorators/tenant.decorator';
import type { RequestTenant } from '../common/interfaces/request-context.interface';
import { CreateQuoteDto } from './dto/create-quote.dto';
import { CreateVariationDto } from './dto/create-variation.dto';
import { UpdateQuoteDto } from './dto/update-quote.dto';
import { QuotesService } from './quotes.service';

@ApiTags('Quotes')
@ApiBearerAuth()
@Controller('quotes')
export class QuotesController {
  constructor(private readonly quotesService: QuotesService) {}

  @Permissions('quotes.*', 'quotes.create')
  @Post()
  @ApiOperation({ summary: 'Create a new quote' })
  create(@Tenant() tenant: RequestTenant, @Body() dto: CreateQuoteDto) {
    return this.quotesService.create(tenant.companyId, dto);
  }

  @Permissions('quotes.*', 'quotes.view')
  @Get()
  @ApiOperation({ summary: 'List quotes with filters' })
  list(
    @Tenant() tenant: RequestTenant,
    @Query() query: PaginationQueryDto & { status?: QuoteStatus; clientId?: string },
  ) {
    return this.quotesService.list(tenant.companyId, query);
  }

  @Permissions('quotes.*', 'quotes.view')
  @Get(':id')
  @ApiOperation({ summary: 'Get quote details with line items and variations' })
  findOne(@Tenant() tenant: RequestTenant, @Param('id') id: string) {
    return this.quotesService.findOne(tenant.companyId, id);
  }

  @Permissions('quotes.*', 'quotes.create')
  @Put(':id')
  @ApiOperation({ summary: 'Update quote (only DRAFT status)' })
  update(
    @Tenant() tenant: RequestTenant,
    @Param('id') id: string,
    @Body() dto: UpdateQuoteDto,
  ) {
    return this.quotesService.update(tenant.companyId, id, dto);
  }

  @Permissions('quotes.*', 'quotes.send')
  @Put(':id/send')
  @ApiOperation({ summary: 'Send quote to client (DRAFT → SENT)' })
  send(@Tenant() tenant: RequestTenant, @Param('id') id: string) {
    return this.quotesService.send(tenant.companyId, id);
  }

  @Permissions('quotes.*', 'quotes.approve')
  @Put(':id/approve')
  @ApiOperation({ summary: 'Mark quote as approved (SENT → APPROVED)' })
  approve(@Tenant() tenant: RequestTenant, @Param('id') id: string) {
    return this.quotesService.approve(tenant.companyId, id);
  }

  @Permissions('quotes.*', 'quotes.approve')
  @Put(':id/reject')
  @ApiOperation({ summary: 'Reject quote (SENT → REJECTED)' })
  reject(
    @Tenant() tenant: RequestTenant,
    @Param('id') id: string,
    @Body('notes') notes?: string,
  ) {
    return this.quotesService.reject(tenant.companyId, id, notes);
  }

  @Permissions('quotes.*')
  @Put(':id/convert')
  @ApiOperation({ summary: 'Convert approved quote to project (APPROVED → CONVERTED)' })
  convert(@Tenant() tenant: RequestTenant, @Param('id') id: string) {
    return this.quotesService.convertToProject(tenant.companyId, id);
  }

  @Permissions('quotes.*', 'quotes.create')
  @Delete(':id')
  @ApiOperation({ summary: 'Delete quote (soft delete)' })
  remove(@Tenant() tenant: RequestTenant, @Param('id') id: string) {
    return this.quotesService.remove(tenant.companyId, id);
  }

  // Variations (Change Orders)
  @Permissions('quotes.*')
  @Post('variations/:projectId')
  @ApiOperation({ summary: 'Create a variation/change order for a project' })
  createVariation(
    @Tenant() tenant: RequestTenant,
    @Param('projectId') projectId: string,
    @Body() dto: CreateVariationDto,
  ) {
    return this.quotesService.createVariation(tenant.companyId, projectId, dto);
  }

  @Permissions('quotes.*', 'quotes.view')
  @Get('variations/:projectId')
  @ApiOperation({ summary: 'List variations for a project' })
  listVariations(
    @Tenant() tenant: RequestTenant,
    @Param('projectId') projectId: string,
  ) {
    return this.quotesService.listVariations(tenant.companyId, projectId);
  }

  @Permissions('quotes.*', 'quotes.approve')
  @Put('variations/:variationId/approve')
  @ApiOperation({ summary: 'Approve a variation (updates project budget)' })
  approveVariation(
    @Tenant() tenant: RequestTenant,
    @Param('variationId') variationId: string,
  ) {
    return this.quotesService.approveVariation(tenant.companyId, variationId);
  }

  @Permissions('quotes.*', 'quotes.approve')
  @Put('variations/:variationId/reject')
  @ApiOperation({ summary: 'Reject a variation' })
  rejectVariation(
    @Tenant() tenant: RequestTenant,
    @Param('variationId') variationId: string,
    @Body('notes') notes?: string,
  ) {
    return this.quotesService.rejectVariation(tenant.companyId, variationId, notes);
  }
}
