import {
  Body,
  Controller,
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
import { CreateBudgetCategoryDto } from './dto/create-budget-category.dto';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { SetProjectBudgetDto } from './dto/set-project-budget.dto';
import { FinancialsService } from './financials.service';

@ApiTags('Financials')
@ApiBearerAuth()
@Controller('financials')
export class FinancialsController {
  constructor(private readonly financialsService: FinancialsService) {}

  @Permissions('financials.*', 'financials.view')
  @Get('summary')
  @ApiOperation({ summary: 'Get financial summary (optionally for a specific project)' })
  getSummary(
    @Tenant() tenant: RequestTenant,
    @Query('projectId') projectId?: string,
  ) {
    return this.financialsService.summary(tenant.companyId, projectId);
  }

  @Permissions('financials.*', 'financials.view')
  @Get('dashboard')
  @ApiOperation({ summary: 'Company-wide financial dashboard (admin/accountant view)' })
  getCompanyDashboard(@Tenant() tenant: RequestTenant) {
    return this.financialsService.getCompanyDashboard(tenant.companyId);
  }

  @Permissions('financials.*', 'financials.view')
  @Get('budget-categories')
  @ApiOperation({ summary: 'List budget categories' })
  listBudgetCategories(@Tenant() tenant: RequestTenant) {
    return this.financialsService.listBudgetCategories(tenant.companyId);
  }

  @Permissions('financials.*')
  @Post('budget-categories')
  @ApiOperation({ summary: 'Create a budget category (e.g. Labour, Materials)' })
  createBudgetCategory(
    @Tenant() tenant: RequestTenant,
    @Body() dto: CreateBudgetCategoryDto,
  ) {
    return this.financialsService.createBudgetCategory(tenant.companyId, dto);
  }

  @Permissions('financials.*', 'financials.view')
  @Get('projects/:projectId/budget')
  @ApiOperation({ summary: 'Get per-project budget breakdown by category' })
  getProjectBudget(
    @Tenant() tenant: RequestTenant,
    @Param('projectId') projectId: string,
  ) {
    return this.financialsService.getProjectBudget(tenant.companyId, projectId);
  }

  @Permissions('financials.*')
  @Put('projects/:projectId/budget')
  @ApiOperation({ summary: 'Set/update budget allocations per category for a project' })
  setProjectBudget(
    @Tenant() tenant: RequestTenant,
    @Param('projectId') projectId: string,
    @Body() dto: SetProjectBudgetDto,
  ) {
    return this.financialsService.setProjectBudget(tenant.companyId, projectId, dto);
  }

  @Permissions('financials.*', 'financials.view')
  @Get('projects/:projectId/transactions')
  @ApiOperation({ summary: 'List financial transactions for a project' })
  listTransactions(
    @Tenant() tenant: RequestTenant,
    @Param('projectId') projectId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.financialsService.listTransactions(tenant.companyId, projectId, query);
  }

  @Permissions('financials.*')
  @Post('transactions')
  @ApiOperation({ summary: 'Record a manual financial transaction (equipment, overheads)' })
  createTransaction(
    @Tenant() tenant: RequestTenant,
    @Body() dto: CreateTransactionDto,
  ) {
    return this.financialsService.createTransaction(tenant.companyId, dto);
  }
}
