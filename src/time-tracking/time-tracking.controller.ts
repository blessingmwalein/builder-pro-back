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
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { Tenant } from '../common/decorators/tenant.decorator';
import type {
  RequestTenant,
  RequestUser,
} from '../common/interfaces/request-context.interface';
import { ApproveTimeEntryDto } from './dto/approve-time-entry.dto';
import { ClockInDto } from './dto/clock-in.dto';
import { ClockOutDto } from './dto/clock-out.dto';
import { ManualTimeEntryDto } from './dto/manual-entry.dto';
import { QueryTimeEntriesDto } from './dto/query-time-entries.dto';
import { TimeTrackingService } from './time-tracking.service';

@ApiTags('Time Tracking')
@ApiBearerAuth()
@Controller('time-tracking')
export class TimeTrackingController {
  constructor(private readonly timeTrackingService: TimeTrackingService) {}

  @Permissions('timesheets.*', 'timesheets.view_own', 'timesheets.view_all')
  @Get()
  @ApiOperation({ summary: 'List time entries (workers see own, managers see all)' })
  listEntries(
    @Tenant() tenant: RequestTenant,
    @CurrentUser() user: RequestUser,
    @Query() query: QueryTimeEntriesDto,
  ) {
    return this.timeTrackingService.listEntries(
      tenant.companyId,
      user.userId,
      user.permissions,
      query,
    );
  }

  @Permissions('timesheets.*', 'timesheets.view_own')
  @Get('active')
  @ApiOperation({ summary: 'Get current user active time entry (clocked in)' })
  getActive(@Tenant() tenant: RequestTenant, @CurrentUser() user: RequestUser) {
    return this.timeTrackingService.getActiveEntry(tenant.companyId, user.userId);
  }

  @Permissions('timesheets.*', 'timesheets.view_own')
  @Get('weekly-summary')
  @ApiOperation({ summary: 'Get weekly timesheet summary for current user' })
  weeklySummary(
    @Tenant() tenant: RequestTenant,
    @CurrentUser() user: RequestUser,
    @Query('weekStart') weekStart: string,
  ) {
    return this.timeTrackingService.getWeeklySummary(
      tenant.companyId,
      user.userId,
      weekStart ?? new Date().toISOString().split('T')[0],
    );
  }

  @Permissions('timesheets.*', 'timesheets.view_own')
  @Post('clock-in')
  @ApiOperation({ summary: 'Clock in — one-tap time tracking' })
  clockIn(
    @Tenant() tenant: RequestTenant,
    @CurrentUser() user: RequestUser,
    @Body() dto: ClockInDto,
  ) {
    return this.timeTrackingService.clockIn(tenant.companyId, user.userId, dto);
  }

  @Permissions('timesheets.*', 'timesheets.view_own')
  @Put(':id/clock-out')
  @ApiOperation({ summary: 'Clock out of active time entry' })
  clockOut(
    @Tenant() tenant: RequestTenant,
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: ClockOutDto,
  ) {
    return this.timeTrackingService.clockOut(
      tenant.companyId,
      user.userId,
      id,
      dto,
    );
  }

  @Permissions('timesheets.*')
  @Post('manual')
  @ApiOperation({ summary: 'Create a manual time entry (flagged for approval)' })
  manualEntry(
    @Tenant() tenant: RequestTenant,
    @CurrentUser() user: RequestUser,
    @Body() dto: ManualTimeEntryDto,
  ) {
    return this.timeTrackingService.createManualEntry(
      tenant.companyId,
      user.userId,
      dto,
    );
  }

  @Permissions('timesheets.*', 'timesheets.approve')
  @Put(':id/approve')
  @ApiOperation({ summary: 'Approve or reject a time entry' })
  approve(
    @Tenant() tenant: RequestTenant,
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: ApproveTimeEntryDto,
  ) {
    return this.timeTrackingService.approve(
      tenant.companyId,
      user.userId,
      id,
      dto,
    );
  }
}
