import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Permissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Tenant } from '../common/decorators/tenant.decorator';
import type { RequestTenant, RequestUser } from '../common/interfaces/request-context.interface';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { EquipmentService } from './equipment.service';
import { CreateEquipmentDto } from './dto/create-equipment.dto';
import { AllocateEquipmentDto } from './dto/allocate-equipment.dto';

@ApiTags('Equipment')
@ApiBearerAuth()
@Controller('equipment')
export class EquipmentController {
  constructor(private readonly service: EquipmentService) {}

  // ─── Categories ─────────────────────────────────────────────────────────────

  @Permissions('materials.*', 'materials.view')
  @Get('categories')
  @ApiOperation({ summary: 'List equipment categories' })
  listCategories(@Tenant() tenant: RequestTenant) {
    return this.service.listCategories(tenant.companyId);
  }

  @Permissions('materials.*', 'materials.manage')
  @Post('categories')
  @ApiOperation({ summary: 'Create an equipment category' })
  createCategory(@Tenant() tenant: RequestTenant, @Body() body: { name: string }) {
    return this.service.createCategory(tenant.companyId, body.name);
  }

  // ─── Equipment ───────────────────────────────────────────────────────────────

  @Permissions('materials.*', 'materials.manage')
  @Post()
  @ApiOperation({ summary: 'Add a new piece of equipment' })
  create(@Tenant() tenant: RequestTenant, @Body() dto: CreateEquipmentDto) {
    return this.service.create(tenant.companyId, dto);
  }

  @Permissions('materials.*', 'materials.view')
  @Get()
  @ApiOperation({ summary: 'List equipment' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'categoryId', required: false })
  @ApiQuery({ name: 'search', required: false })
  list(
    @Tenant() tenant: RequestTenant,
    @Query() query: PaginationQueryDto & { status?: string; categoryId?: string; search?: string },
  ) {
    return this.service.list(tenant.companyId, query);
  }

  @Permissions('materials.*', 'materials.view')
  @Get(':id')
  @ApiOperation({ summary: 'Get equipment detail with allocation history' })
  findOne(@Tenant() tenant: RequestTenant, @Param('id') id: string) {
    return this.service.findOne(tenant.companyId, id);
  }

  @Permissions('materials.*', 'materials.manage')
  @Patch(':id')
  @ApiOperation({ summary: 'Update equipment' })
  update(
    @Tenant() tenant: RequestTenant,
    @Param('id') id: string,
    @Body() dto: Partial<CreateEquipmentDto>,
  ) {
    return this.service.update(tenant.companyId, id, dto);
  }

  @Permissions('materials.*', 'materials.manage')
  @Delete(':id')
  @ApiOperation({ summary: 'Retire / soft-delete equipment' })
  remove(@Tenant() tenant: RequestTenant, @Param('id') id: string) {
    return this.service.remove(tenant.companyId, id);
  }

  // ─── Allocations ─────────────────────────────────────────────────────────────

  @Permissions('materials.*', 'materials.manage')
  @Post(':id/allocate')
  @ApiOperation({ summary: 'Allocate equipment to a project' })
  allocate(
    @Tenant() tenant: RequestTenant,
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: AllocateEquipmentDto,
  ) {
    return this.service.allocate(tenant.companyId, id, user.userId, dto);
  }

  @Permissions('materials.*', 'materials.manage')
  @Post(':id/return/:allocationId')
  @ApiOperation({ summary: 'Return equipment from a project' })
  returnEquipment(
    @Tenant() tenant: RequestTenant,
    @Param('id') id: string,
    @Param('allocationId') allocationId: string,
  ) {
    return this.service.returnEquipment(tenant.companyId, id, allocationId);
  }

  @Permissions('materials.*', 'materials.view')
  @Get('allocations/list')
  @ApiOperation({ summary: 'List all allocations' })
  @ApiQuery({ name: 'equipmentId', required: false })
  @ApiQuery({ name: 'projectId', required: false })
  listAllocations(
    @Tenant() tenant: RequestTenant,
    @Query() query: PaginationQueryDto & { equipmentId?: string; projectId?: string },
  ) {
    return this.service.listAllocations(tenant.companyId, query);
  }
}
