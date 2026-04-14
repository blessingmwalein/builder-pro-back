import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Permissions } from '../common/decorators/permissions.decorator';
import { Tenant } from '../common/decorators/tenant.decorator';
import type { RequestTenant } from '../common/interfaces/request-context.interface';
import { AssignPermissionsDto } from './dto/assign-permissions.dto';
import { AssignRoleDto } from './dto/assign-role.dto';
import { CreateRoleDto } from './dto/create-role.dto';
import { RbacService } from './rbac.service';

@ApiTags('RBAC')
@ApiBearerAuth()
@Controller('rbac')
export class RbacController {
  constructor(private readonly rbacService: RbacService) {}

  @Get('permissions')
  @ApiOperation({ summary: 'List all available system permission keys' })
  listAllPermissions() {
    return this.rbacService.listAllPermissions();
  }

  @Permissions('settings.*')
  @Get('roles')
  @ApiOperation({ summary: 'List all roles for the company' })
  listRoles(@Tenant() tenant: RequestTenant) {
    return this.rbacService.listRoles(tenant.companyId);
  }

  @Permissions('settings.*')
  @Get('roles/:id')
  @ApiOperation({ summary: 'Get a role by ID' })
  getRole(@Tenant() tenant: RequestTenant, @Param('id') id: string) {
    return this.rbacService.getRole(tenant.companyId, id);
  }

  @Permissions('settings.*')
  @Post('roles')
  @ApiOperation({ summary: 'Create a new role with optional permissions' })
  createRole(@Tenant() tenant: RequestTenant, @Body() dto: CreateRoleDto) {
    return this.rbacService.createRole(tenant.companyId, dto);
  }

  @Permissions('settings.*')
  @Put('roles/:id')
  @ApiOperation({ summary: 'Update role name/description and replace permissions' })
  updateRole(
    @Tenant() tenant: RequestTenant,
    @Param('id') id: string,
    @Body() dto: CreateRoleDto,
  ) {
    return this.rbacService.updateRole(tenant.companyId, id, dto);
  }

  @Permissions('settings.*')
  @Delete('roles/:id')
  @ApiOperation({ summary: 'Delete a role (soft delete)' })
  deleteRole(@Tenant() tenant: RequestTenant, @Param('id') id: string) {
    return this.rbacService.deleteRole(tenant.companyId, id);
  }

  @Permissions('settings.*')
  @Post('roles/:id/permissions')
  @ApiOperation({ summary: 'Assign additional permissions to a role' })
  assignPermissions(
    @Tenant() tenant: RequestTenant,
    @Param('id') id: string,
    @Body() dto: AssignPermissionsDto,
  ) {
    return this.rbacService.assignPermissionsToRole(tenant.companyId, id, dto);
  }

  @Permissions('settings.*')
  @Delete('roles/:id/permissions/:permissionKey')
  @ApiOperation({ summary: 'Remove a permission from a role' })
  removePermission(
    @Tenant() tenant: RequestTenant,
    @Param('id') id: string,
    @Param('permissionKey') permissionKey: string,
  ) {
    return this.rbacService.removePermissionFromRole(
      tenant.companyId,
      id,
      permissionKey,
    );
  }

  @Permissions('settings.*', 'employees.*')
  @Get('users/:userId/roles')
  @ApiOperation({ summary: "Get a user's assigned roles" })
  getUserRoles(
    @Tenant() tenant: RequestTenant,
    @Param('userId') userId: string,
  ) {
    return this.rbacService.getUserRoles(tenant.companyId, userId);
  }

  @Permissions('settings.*', 'employees.*')
  @Post('users/:userId/roles')
  @ApiOperation({ summary: 'Assign a role to a user' })
  assignRole(
    @Tenant() tenant: RequestTenant,
    @Param('userId') userId: string,
    @Body() dto: AssignRoleDto,
  ) {
    return this.rbacService.assignRoleToUser(
      tenant.companyId,
      userId,
      dto.roleId,
    );
  }

  @Permissions('settings.*', 'employees.*')
  @Delete('users/:userId/roles/:roleId')
  @ApiOperation({ summary: 'Remove a role from a user' })
  removeRole(
    @Tenant() tenant: RequestTenant,
    @Param('userId') userId: string,
    @Param('roleId') roleId: string,
  ) {
    return this.rbacService.removeRoleFromUser(tenant.companyId, userId, roleId);
  }
}
