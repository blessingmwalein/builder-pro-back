import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { Tenant } from '../common/decorators/tenant.decorator';
import type {
  RequestTenant,
  RequestUser,
} from '../common/interfaces/request-context.interface';
import { GenerateReportDto } from './dto/generate-report.dto';
import { ReportingService } from './reporting.service';

@ApiTags('Reporting')
@ApiBearerAuth()
@Controller('reporting')
export class ReportingController {
  constructor(private readonly reportingService: ReportingService) {}

  @Permissions('reports.*', 'reports.view')
  @Get()
  @ApiOperation({ summary: 'List generated reports' })
  listReports(@Tenant() tenant: RequestTenant) {
    return this.reportingService.listReports(tenant.companyId);
  }

  @Permissions('reports.*', 'reports.view')
  @Get('project-progress/:projectId')
  @ApiOperation({ summary: 'Project progress report (tasks, budget, timeline)' })
  projectProgress(
    @Tenant() tenant: RequestTenant,
    @Param('projectId') projectId: string,
  ) {
    return this.reportingService.getProjectProgressReport(tenant.companyId, projectId);
  }

  @Permissions('reports.*', 'reports.view')
  @Get('labour')
  @ApiOperation({ summary: 'Labour hours report (by worker/project/period)' })
  labourReport(
    @Tenant() tenant: RequestTenant,
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('projectId') projectId?: string,
  ) {
    return this.reportingService.getLabourReport(
      tenant.companyId,
      from ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      to ?? new Date().toISOString().split('T')[0],
      projectId,
    );
  }

  @Permissions('reports.*', 'reports.view')
  @Get('materials')
  @ApiOperation({ summary: 'Materials usage report by category' })
  materialsReport(
    @Tenant() tenant: RequestTenant,
    @Query('projectId') projectId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.reportingService.getMaterialsReport(
      tenant.companyId,
      projectId,
      from,
      to,
    );
  }

  @Permissions('reports.*', 'financials.view')
  @Get('financial-summary')
  @ApiOperation({ summary: 'Company-wide financial summary with profit margins per project' })
  financialSummary(
    @Tenant() tenant: RequestTenant,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.reportingService.getFinancialSummaryReport(tenant.companyId, from, to);
  }

  @Permissions('reports.*')
  @Post('generate')
  @ApiOperation({ summary: 'Queue a report for async generation' })
  generate(
    @Tenant() tenant: RequestTenant,
    @CurrentUser() user: RequestUser,
    @Body() dto: GenerateReportDto,
  ) {
    return this.reportingService.generate(tenant.companyId, user.userId, dto);
  }
}
