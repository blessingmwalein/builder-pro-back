import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { SubscriptionStatus } from '@prisma/client';
import { PlatformAdminPaginationDto } from './dto/platform-admin-pagination.dto';
import { UpdateCompanyApprovalDto } from './dto/update-company-approval.dto';
import { UpdateSubscriptionStatusDto } from './dto/update-subscription-status.dto';
import { PlatformAdminGuard } from './guards/platform-admin.guard';
import { PlatformAdminService } from './platform-admin.service';
import { AssignPermissionsDto } from '../rbac/dto/assign-permissions.dto';
import { AssignRoleDto } from '../rbac/dto/assign-role.dto';
import { CreateRoleDto } from '../rbac/dto/create-role.dto';

@ApiTags('Platform Admin')
@ApiHeader({
  name: 'x-platform-admin-key',
  required: false,
  description: 'Platform admin API key. Alternative to bearer token auth.',
})
@ApiBearerAuth('platform-admin-bearer')
@ApiSecurity('platform-admin-key')
@Public()
@UseGuards(PlatformAdminGuard)
@Controller('platform-admin')
export class PlatformAdminController {
  constructor(private readonly platformAdminService: PlatformAdminService) {}

  @Get('overview')
  overview() {
    return this.platformAdminService.overview();
  }

  @Get('companies')
  listCompanies(@Query() query: PlatformAdminPaginationDto) {
    return this.platformAdminService.listCompanies(query);
  }

  @Get('companies/:id')
  getCompanyDetails(@Param('id') id: string) {
    return this.platformAdminService.getCompanyDetails(id);
  }

  @Get('companies/pending-approvals')
  listPendingApprovals(@Query() query: PlatformAdminPaginationDto) {
    return this.platformAdminService.listPendingApprovals(query);
  }

  @Patch('companies/:id/approval')
  updateCompanyApproval(
    @Param('id') id: string,
    @Body() dto: UpdateCompanyApprovalDto,
  ) {
    return this.platformAdminService.updateCompanyApproval(id, dto.isActive);
  }

  @Get('subscriptions')
  listSubscriptions(@Query() query: PlatformAdminPaginationDto) {
    return this.platformAdminService.listSubscriptions(query);
  }

  @Patch('subscriptions/:id/status')
  updateSubscriptionStatus(
    @Param('id') id: string,
    @Body() dto: UpdateSubscriptionStatusDto,
  ) {
    return this.platformAdminService.updateSubscriptionStatus(
      id,
      dto.status as SubscriptionStatus,
    );
  }

  @Get('billing/payments')
  listPayments(@Query() query: PlatformAdminPaginationDto) {
    return this.platformAdminService.listPayments(query);
  }

  @Get('companies/:companyId/rbac/permissions')
  listAllPermissions(@Param('companyId') companyId: string) {
    return this.platformAdminService.listAllPermissions(companyId);
  }

  @Get('companies/:companyId/rbac/roles')
  listRoles(@Param('companyId') companyId: string) {
    return this.platformAdminService.listRoles(companyId);
  }

  @Get('companies/:companyId/rbac/roles/:id')
  getRole(@Param('companyId') companyId: string, @Param('id') id: string) {
    return this.platformAdminService.getRole(companyId, id);
  }

  @Post('companies/:companyId/rbac/roles')
  createRole(
    @Param('companyId') companyId: string,
    @Body() dto: CreateRoleDto,
  ) {
    return this.platformAdminService.createRole(companyId, dto);
  }

  @Put('companies/:companyId/rbac/roles/:id')
  updateRole(
    @Param('companyId') companyId: string,
    @Param('id') id: string,
    @Body() dto: CreateRoleDto,
  ) {
    return this.platformAdminService.updateRole(companyId, id, dto);
  }

  @Delete('companies/:companyId/rbac/roles/:id')
  deleteRole(@Param('companyId') companyId: string, @Param('id') id: string) {
    return this.platformAdminService.deleteRole(companyId, id);
  }

  @Post('companies/:companyId/rbac/roles/:id/permissions')
  assignPermissions(
    @Param('companyId') companyId: string,
    @Param('id') id: string,
    @Body() dto: AssignPermissionsDto,
  ) {
    return this.platformAdminService.assignPermissions(companyId, id, dto);
  }

  @Delete('companies/:companyId/rbac/roles/:id/permissions/:permissionKey')
  removePermission(
    @Param('companyId') companyId: string,
    @Param('id') id: string,
    @Param('permissionKey') permissionKey: string,
  ) {
    return this.platformAdminService.removePermission(
      companyId,
      id,
      permissionKey,
    );
  }

  @Get('companies/:companyId/rbac/users/:userId/roles')
  getUserRoles(
    @Param('companyId') companyId: string,
    @Param('userId') userId: string,
  ) {
    return this.platformAdminService.getUserRoles(companyId, userId);
  }

  @Post('companies/:companyId/rbac/users/:userId/roles')
  assignRole(
    @Param('companyId') companyId: string,
    @Param('userId') userId: string,
    @Body() dto: AssignRoleDto,
  ) {
    return this.platformAdminService.assignRole(companyId, userId, dto.roleId);
  }

  @Delete('companies/:companyId/rbac/users/:userId/roles/:roleId')
  removeRole(
    @Param('companyId') companyId: string,
    @Param('userId') userId: string,
    @Param('roleId') roleId: string,
  ) {
    return this.platformAdminService.removeRole(companyId, userId, roleId);
  }
}
