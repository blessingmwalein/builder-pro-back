import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Permissions } from '../common/decorators/permissions.decorator';
import { Tenant } from '../common/decorators/tenant.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestTenant } from '../common/interfaces/request-context.interface';
import { ApproveChangeRequestDto } from './dto/approve-change-request.dto';
import { CreateChangeRequestDto } from './dto/create-change-request.dto';
import { RejectChangeRequestDto } from './dto/reject-change-request.dto';
import { ReviewChangeRequestDto } from './dto/review-change-request.dto';
import { UpdateChangeRequestDto } from './dto/update-change-request.dto';
import { ChangeRequestsService } from './change-requests.service';

@ApiTags('Change Requests')
@ApiBearerAuth()
@Controller('projects/:projectId/change-requests')
export class ChangeRequestsController {
  constructor(private readonly crService: ChangeRequestsService) {}

  @Permissions('projects.*')
  @Get()
  @ApiOperation({ summary: 'List change requests for a project' })
  @ApiQuery({ name: 'status', required: false })
  findMany(
    @Tenant() tenant: RequestTenant,
    @Param('projectId') projectId: string,
    @Query('status') status?: string,
  ) {
    return this.crService.findMany(tenant.companyId, projectId, status);
  }

  @Permissions('projects.*')
  @Post()
  @ApiOperation({ summary: 'Create a change request' })
  create(
    @Tenant() tenant: RequestTenant,
    @CurrentUser() user: { id: string },
    @Param('projectId') projectId: string,
    @Body() dto: CreateChangeRequestDto,
  ) {
    return this.crService.create(tenant.companyId, projectId, user.id, dto);
  }

  @Permissions('projects.*')
  @Get(':crId')
  @ApiOperation({ summary: 'Get a change request by ID' })
  findOne(
    @Tenant() tenant: RequestTenant,
    @Param('crId') crId: string,
  ) {
    return this.crService.findOne(tenant.companyId, crId);
  }

  @Permissions('projects.*')
  @Patch(':crId')
  @ApiOperation({ summary: 'Update a DRAFT change request' })
  update(
    @Tenant() tenant: RequestTenant,
    @Param('crId') crId: string,
    @Body() dto: UpdateChangeRequestDto,
  ) {
    return this.crService.update(tenant.companyId, crId, dto);
  }

  @Permissions('projects.*')
  @Post(':crId/submit')
  @ApiOperation({ summary: 'Submit a DRAFT change request for review' })
  submit(
    @Tenant() tenant: RequestTenant,
    @Param('crId') crId: string,
  ) {
    return this.crService.submit(tenant.companyId, crId);
  }

  @Permissions('projects.*')
  @Post(':crId/review')
  @ApiOperation({ summary: 'Move change request to UNDER_REVIEW' })
  review(
    @Tenant() tenant: RequestTenant,
    @CurrentUser() user: { id: string },
    @Param('crId') crId: string,
    @Body() dto: ReviewChangeRequestDto,
  ) {
    return this.crService.review(tenant.companyId, crId, user.id, dto);
  }

  @Permissions('projects.*')
  @Post(':crId/approve')
  @ApiOperation({ summary: 'Approve a change request; bumps budget/end date if set' })
  approve(
    @Tenant() tenant: RequestTenant,
    @CurrentUser() user: { id: string },
    @Param('crId') crId: string,
    @Body() dto: ApproveChangeRequestDto,
  ) {
    return this.crService.approve(tenant.companyId, crId, user.id, dto);
  }

  @Permissions('projects.*')
  @Post(':crId/reject')
  @ApiOperation({ summary: 'Reject a change request' })
  reject(
    @Tenant() tenant: RequestTenant,
    @CurrentUser() user: { id: string },
    @Param('crId') crId: string,
    @Body() dto: RejectChangeRequestDto,
  ) {
    return this.crService.reject(tenant.companyId, crId, user.id, dto);
  }

  @Permissions('projects.*')
  @Post(':crId/implement')
  @ApiOperation({ summary: 'Mark an APPROVED change request as implemented' })
  implement(
    @Tenant() tenant: RequestTenant,
    @CurrentUser() user: { id: string },
    @Param('crId') crId: string,
  ) {
    return this.crService.implement(tenant.companyId, crId, user.id);
  }
}
