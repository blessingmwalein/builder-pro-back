import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Permissions } from '../common/decorators/permissions.decorator';
import { Tenant } from '../common/decorators/tenant.decorator';
import type { RequestTenant } from '../common/interfaces/request-context.interface';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { CompaniesService } from './companies.service';

@ApiTags('Companies')
@ApiBearerAuth()
@Controller('companies')
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Permissions('settings.*')
  @Get('me')
  getMine(@Tenant() tenant: RequestTenant) {
    return this.companiesService.getById(tenant.companyId);
  }

  @Permissions('settings.*')
  @Patch('me')
  updateMine(@Tenant() tenant: RequestTenant, @Body() dto: UpdateCompanyDto) {
    return this.companiesService.update(tenant.companyId, dto);
  }
}
