import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Permissions } from '../common/decorators/permissions.decorator';
import { Tenant } from '../common/decorators/tenant.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestTenant } from '../common/interfaces/request-context.interface';
import { CreateClientUserDto } from './dto/create-client-user.dto';
import { UpdateClientUserPermissionsDto } from './dto/update-client-user-permissions.dto';
import { ClientPortalService } from './client-portal.service';

@ApiTags('Client Portal')
@ApiBearerAuth()
@Controller()
export class ClientPortalController {
  constructor(private readonly portalService: ClientPortalService) {}

  // --- CRM management endpoints (company staff) ---

  @Permissions('crm.*')
  @Get('crm/clients/:clientId/portal-users')
  @ApiOperation({ summary: 'List portal users for a client' })
  listPortalUsers(
    @Tenant() tenant: RequestTenant,
    @Param('clientId') clientId: string,
  ) {
    return this.portalService.listPortalUsers(tenant.companyId, clientId);
  }

  @Permissions('crm.*')
  @Post('crm/clients/:clientId/portal-users')
  @ApiOperation({ summary: 'Link a user account to a client for portal access' })
  createPortalUser(
    @Tenant() tenant: RequestTenant,
    @Param('clientId') clientId: string,
    @Body() dto: CreateClientUserDto,
  ) {
    return this.portalService.createPortalUser(tenant.companyId, clientId, dto);
  }

  @Permissions('crm.*')
  @Delete('crm/clients/:clientId/portal-users/:userId')
  @ApiOperation({ summary: 'Remove a portal user link' })
  removePortalUser(
    @Tenant() tenant: RequestTenant,
    @Param('clientId') clientId: string,
    @Param('userId') userId: string,
  ) {
    return this.portalService.removePortalUser(tenant.companyId, clientId, userId);
  }

  @Permissions('crm.*')
  @Patch('crm/clients/:clientId/portal-users/:userId')
  @ApiOperation({ summary: 'Update portal user permissions' })
  updatePortalPermissions(
    @Tenant() tenant: RequestTenant,
    @Param('clientId') clientId: string,
    @Param('userId') userId: string,
    @Body() dto: UpdateClientUserPermissionsDto,
  ) {
    return this.portalService.updatePortalPermissions(tenant.companyId, clientId, userId, dto);
  }

  // --- Portal endpoints (accessible by client users) ---

  @Permissions('projects.view', 'projects.*')
  @Get('portal/projects')
  @ApiOperation({ summary: 'List projects accessible to the authenticated client user' })
  getMyProjects(
    @Tenant() tenant: RequestTenant,
    @CurrentUser() user: { id: string },
  ) {
    return this.portalService.getClientAccessibleProjects(tenant.companyId, user.id);
  }

  @Permissions('projects.view', 'projects.*')
  @Get('portal/projects/:id')
  @ApiOperation({ summary: 'Get a project view for the authenticated client user' })
  getMyProject(
    @Tenant() tenant: RequestTenant,
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
  ) {
    return this.portalService.getClientProjectView(tenant.companyId, user.id, id);
  }
}
