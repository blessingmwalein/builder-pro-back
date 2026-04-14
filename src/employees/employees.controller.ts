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
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { EmployeesService } from './employees.service';

@ApiTags('Employees')
@ApiBearerAuth()
@Controller('employees')
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Permissions('employees.*', 'employees.manage')
  @Post()
  @ApiOperation({ summary: 'Create employee record' })
  create(@Tenant() tenant: RequestTenant, @Body() dto: CreateEmployeeDto) {
    return this.employeesService.create(tenant.companyId, dto);
  }

  @Permissions('employees.*', 'employees.manage')
  @Get()
  @ApiOperation({ summary: 'List employees' })
  list(
    @Tenant() tenant: RequestTenant,
    @Query() query: PaginationQueryDto & { search?: string; isActive?: boolean },
  ) {
    return this.employeesService.list(tenant.companyId, query);
  }

  @Permissions('employees.*', 'employees.manage')
  @Get('payroll-export')
  @ApiOperation({ summary: 'Export payroll summary for a period' })
  payrollExport(
    @Tenant() tenant: RequestTenant,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.employeesService.getPayrollExport(tenant.companyId, from, to);
  }

  @Permissions('employees.*', 'employees.manage')
  @Get(':id')
  @ApiOperation({ summary: 'Get employee with performance metrics' })
  findOne(@Tenant() tenant: RequestTenant, @Param('id') id: string) {
    return this.employeesService.findOne(tenant.companyId, id);
  }

  @Permissions('employees.*', 'employees.manage')
  @Put(':id')
  @ApiOperation({ summary: 'Update employee' })
  update(
    @Tenant() tenant: RequestTenant,
    @Param('id') id: string,
    @Body() dto: UpdateEmployeeDto,
  ) {
    return this.employeesService.update(tenant.companyId, id, dto);
  }

  @Permissions('employees.*', 'employees.manage')
  @Put(':id/status')
  @ApiOperation({ summary: 'Activate or deactivate employee' })
  toggleStatus(
    @Tenant() tenant: RequestTenant,
    @Param('id') id: string,
    @Body('isActive') isActive: boolean,
  ) {
    return this.employeesService.toggleStatus(tenant.companyId, id, isActive);
  }

  @Permissions('employees.*', 'employees.manage')
  @Delete(':id')
  @ApiOperation({ summary: 'Delete employee record' })
  remove(@Tenant() tenant: RequestTenant, @Param('id') id: string) {
    return this.employeesService.remove(tenant.companyId, id);
  }
}
