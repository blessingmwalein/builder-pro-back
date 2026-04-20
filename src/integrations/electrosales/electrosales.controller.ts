import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Tenant } from '../../common/decorators/tenant.decorator';
import type { RequestTenant } from '../../common/interfaces/request-context.interface';
import { ElectrosalesService } from './electrosales.service';

@ApiTags('Integrations / Electrosales')
@ApiBearerAuth()
@Controller('integrations/electrosales')
export class ElectrosalesController {
  constructor(private readonly electrosales: ElectrosalesService) {}

  @Get('products')
  @ApiOperation({
    summary: 'Search Electrosales product catalog (external datasource)',
    description:
      'Proxies to electrosales.co.zw and normalizes the response into the shape the ' +
      'BuilderPro web app expects when building quotes / invoices. Results include ' +
      'name, SKU, price, supplier, availability and image. Limit capped at 50.',
  })
  searchProducts(
    @Query('query') query?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.electrosales.searchProducts({
      query,
      page: page ? Number.parseInt(page, 10) : undefined,
      limit: limit ? Number.parseInt(limit, 10) : undefined,
    });
  }

  @Permissions('materials.*', 'materials.log', 'quotes.*')
  @Post('import/:externalId')
  @ApiOperation({
    summary: 'Import an Electrosales product into the tenant Materials catalog',
    description:
      'Idempotent: if a Material already exists for this company with the same ' +
      '(externalSource, externalProductId) or SKU, it is re-synced instead of ' +
      'duplicated. Returns the Material id so callers can attach it to a quote ' +
      'line item or material usage log.',
  })
  importProduct(
    @Tenant() tenant: RequestTenant,
    @Param('externalId') externalId: string,
  ) {
    return this.electrosales.importByExternalId(tenant.companyId, externalId);
  }

  @Permissions('materials.*', 'materials.log', 'quotes.*')
  @Post('import-many')
  @ApiOperation({
    summary: 'Bulk-import a list of previously-fetched Electrosales products',
    description:
      'Accepts the already-normalized product shape returned by `/products`. ' +
      'Cheaper than re-fetching one by one when the quote builder has a list in hand.',
  })
  importMany(
    @Tenant() tenant: RequestTenant,
    @Body()
    dto: {
      products: Array<{
        id: number;
        name: string;
        sku: string;
        price: number;
        priceExclVat: number;
        availability: string;
        supplierName: string;
        description: string;
        breadcrumbs: string[];
        imageUrl: string | null;
      }>;
    },
  ) {
    return Promise.all(
      (dto.products ?? []).map((product) =>
        this.electrosales.importAsMaterial(tenant.companyId, product),
      ),
    );
  }
}
