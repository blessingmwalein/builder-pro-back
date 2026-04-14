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
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { CrmService } from './crm.service';

@ApiTags('CRM')
@ApiBearerAuth()
@Controller('crm/clients')
export class CrmController {
  constructor(private readonly crmService: CrmService) {}

  @Permissions('crm.*', 'crm.manage')
  @Post()
  @ApiOperation({ summary: 'Create a new client' })
  createClient(@Tenant() tenant: RequestTenant, @Body() dto: CreateClientDto) {
    return this.crmService.createClient(tenant.companyId, dto);
  }

  @Permissions('crm.*', 'crm.view')
  @Get()
  @ApiOperation({ summary: 'List clients with pagination and search' })
  listClients(
    @Tenant() tenant: RequestTenant,
    @Query() query: PaginationQueryDto & { search?: string },
  ) {
    return this.crmService.listClients(tenant.companyId, query);
  }

  @Permissions('crm.*', 'crm.view')
  @Get(':id')
  @ApiOperation({ summary: 'Get client details with full history' })
  getClient(@Tenant() tenant: RequestTenant, @Param('id') id: string) {
    return this.crmService.getClient(tenant.companyId, id);
  }

  @Permissions('crm.*', 'crm.manage')
  @Put(':id')
  @ApiOperation({ summary: 'Update client' })
  updateClient(
    @Tenant() tenant: RequestTenant,
    @Param('id') id: string,
    @Body() dto: UpdateClientDto,
  ) {
    return this.crmService.updateClient(tenant.companyId, id, dto);
  }

  @Permissions('crm.*', 'crm.manage')
  @Delete(':id')
  @ApiOperation({ summary: 'Delete client (soft delete)' })
  deleteClient(@Tenant() tenant: RequestTenant, @Param('id') id: string) {
    return this.crmService.deleteClient(tenant.companyId, id);
  }
}
