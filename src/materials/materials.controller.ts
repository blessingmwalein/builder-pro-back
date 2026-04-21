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
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { Permissions } from '../common/decorators/permissions.decorator';
import { Tenant } from '../common/decorators/tenant.decorator';
import type { RequestTenant } from '../common/interfaces/request-context.interface';
import { CreateMaterialDto } from './dto/create-material.dto';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { LogMaterialUsageDto } from './dto/log-material-usage.dto';
import { UpdateMaterialDto } from './dto/update-material.dto';
import { MaterialsService } from './materials.service';

@ApiTags('Materials')
@ApiBearerAuth()
@Controller('materials')
export class MaterialsController {
  constructor(private readonly materialsService: MaterialsService) {}

  @Permissions('materials.*', 'materials.manage_inventory')
  @Post()
  @ApiOperation({ summary: 'Create a material in the catalog/inventory' })
  create(@Tenant() tenant: RequestTenant, @Body() dto: CreateMaterialDto) {
    return this.materialsService.create(tenant.companyId, dto);
  }

  @Permissions('materials.*', 'materials.log')
  @Get()
  @ApiOperation({ summary: 'List materials in catalog' })
  list(
    @Tenant() tenant: RequestTenant,
    @Query()
    query: PaginationQueryDto & {
      search?: string;
      lowStock?: boolean;
      categoryId?: string;
      supplierId?: string;
    },
  ) {
    return this.materialsService.list(tenant.companyId, query);
  }

  @Permissions('materials.*', 'materials.manage_inventory')
  @Get('low-stock')
  @ApiOperation({ summary: 'Get materials below reorder threshold' })
  lowStock(@Tenant() tenant: RequestTenant) {
    return this.materialsService.getLowStockAlerts(tenant.companyId);
  }

  @Permissions('materials.*', 'materials.log')
  @Get('logs')
  @ApiOperation({ summary: 'List material usage logs' })
  listLogs(
    @Tenant() tenant: RequestTenant,
    @Query() query: PaginationQueryDto & { projectId?: string; materialId?: string },
  ) {
    return this.materialsService.listLogs(tenant.companyId, query);
  }

  @Permissions('materials.*', 'materials.log')
  @Get(':id')
  @ApiOperation({ summary: 'Get material detail with recent usage logs' })
  findOne(@Tenant() tenant: RequestTenant, @Param('id') id: string) {
    return this.materialsService.findOne(tenant.companyId, id);
  }

  @Permissions('materials.*', 'materials.manage_inventory')
  @Put(':id')
  @ApiOperation({ summary: 'Update material details' })
  update(
    @Tenant() tenant: RequestTenant,
    @Param('id') id: string,
    @Body() dto: UpdateMaterialDto,
  ) {
    return this.materialsService.update(tenant.companyId, id, dto);
  }

  @Permissions('materials.*', 'materials.manage_inventory')
  @Put(':id/stock-adjust')
  @ApiOperation({ summary: 'Adjust stock quantity (positive = in, negative = out)' })
  stockAdjust(
    @Tenant() tenant: RequestTenant,
    @Param('id') id: string,
    @Body('quantity') qty: number,
  ) {
    return this.materialsService.stockAdjust(tenant.companyId, id, qty);
  }

  @Permissions('materials.*', 'materials.manage_inventory')
  @Delete(':id')
  @ApiOperation({ summary: 'Delete material' })
  remove(@Tenant() tenant: RequestTenant, @Param('id') id: string) {
    return this.materialsService.remove(tenant.companyId, id);
  }

  @Permissions('materials.*', 'materials.log')
  @Post('usage')
  @ApiOperation({ summary: 'Log material usage on a project' })
  logUsage(@Tenant() tenant: RequestTenant, @Body() dto: LogMaterialUsageDto) {
    return this.materialsService.logUsage(tenant.companyId, dto);
  }

  // Suppliers
  @Permissions('materials.*', 'materials.manage_inventory')
  @Post('suppliers')
  @ApiOperation({ summary: 'Create a supplier' })
  createSupplier(@Tenant() tenant: RequestTenant, @Body() dto: CreateSupplierDto) {
    return this.materialsService.createSupplier(tenant.companyId, dto);
  }

  @Permissions('materials.*', 'materials.log')
  @Get('suppliers/list')
  @ApiOperation({ summary: 'List all suppliers' })
  listSuppliers(@Tenant() tenant: RequestTenant, @Query() query: PaginationQueryDto) {
    return this.materialsService.listSuppliers(tenant.companyId, query);
  }

  @Permissions('materials.*', 'materials.manage_inventory')
  @Delete('suppliers/:id')
  @ApiOperation({ summary: 'Delete supplier' })
  deleteSupplier(@Tenant() tenant: RequestTenant, @Param('id') id: string) {
    return this.materialsService.deleteSupplier(tenant.companyId, id);
  }

  // Categories
  @Permissions('materials.*', 'materials.log')
  @Get('categories/list')
  @ApiOperation({
    summary: 'List material categories (auto-seeds defaults for the tenant)',
  })
  listCategories(@Tenant() tenant: RequestTenant) {
    return this.materialsService.listCategories(tenant.companyId);
  }

  @Permissions('materials.*', 'materials.manage_inventory')
  @Post('categories')
  @ApiOperation({ summary: 'Create a new material category for this tenant' })
  createCategory(
    @Tenant() tenant: RequestTenant,
    @Body() dto: { code: string; name: string; description?: string },
  ) {
    return this.materialsService.createCategory(tenant.companyId, dto);
  }

  // Bulk purchases
  @Permissions('materials.*', 'materials.manage_inventory')
  @Post('purchases')
  @ApiOperation({
    summary: 'Record a bulk material purchase (multiple line items, one supplier receipt)',
    description:
      'Creates one MaterialPurchase + one MaterialLog per item (entryType=PURCHASE), ' +
      'increments stock, and optionally records a FinancialTransaction against the project.',
  })
  createPurchase(
    @Tenant() tenant: RequestTenant,
    @Body()
    dto: {
      supplierId?: string;
      projectId?: string;
      purchaseNumber?: string;
      purchasedAt?: string;
      notes?: string;
      receiptKey?: string;
      receiptUrl?: string;
      items: Array<{
        materialId: string;
        quantity: number;
        unitCost: number;
        description?: string;
      }>;
    },
  ) {
    return this.materialsService.createPurchase(tenant.companyId, dto);
  }

  @Permissions('materials.*', 'materials.log')
  @Get('purchases/list')
  @ApiOperation({ summary: 'List bulk material purchases' })
  listPurchases(
    @Tenant() tenant: RequestTenant,
    @Query() query: PaginationQueryDto & { projectId?: string; supplierId?: string },
  ) {
    return this.materialsService.listPurchases(tenant.companyId, query);
  }
}
