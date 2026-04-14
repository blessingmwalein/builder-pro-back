import {
  Body,
  Controller,
  Get,
  Param,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { Tenant } from '../common/decorators/tenant.decorator';
import type {
  RequestTenant,
  RequestUser,
} from '../common/interfaces/request-context.interface';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UsersService } from './users.service';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Permissions('employees.*', 'settings.*')
  @Get()
  @ApiOperation({ summary: 'List all users for the company' })
  list(
    @Tenant() tenant: RequestTenant,
    @Query() query: PaginationQueryDto & { search?: string; isActive?: boolean },
  ) {
    return this.usersService.list(tenant.companyId, query);
  }

  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  me(@Tenant() tenant: RequestTenant, @CurrentUser() user: RequestUser) {
    return this.usersService.getMe(tenant.companyId, user.userId);
  }

  @Put('me')
  @ApiOperation({ summary: 'Update own profile' })
  updateMe(
    @Tenant() tenant: RequestTenant,
    @CurrentUser() user: RequestUser,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.usersService.updateMe(tenant.companyId, user.userId, dto);
  }

  @Permissions('employees.*', 'settings.*')
  @Get(':id')
  @ApiOperation({ summary: 'Get a specific user by ID' })
  getUser(@Tenant() tenant: RequestTenant, @Param('id') id: string) {
    return this.usersService.getUser(tenant.companyId, id);
  }

  @Permissions('employees.*', 'settings.*')
  @Put(':id')
  @ApiOperation({ summary: 'Update a user profile' })
  updateUser(
    @Tenant() tenant: RequestTenant,
    @Param('id') id: string,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.usersService.updateUser(tenant.companyId, id, dto);
  }

  @Permissions('settings.*')
  @Put(':id/deactivate')
  @ApiOperation({ summary: 'Deactivate a user account' })
  deactivate(@Tenant() tenant: RequestTenant, @Param('id') id: string) {
    return this.usersService.deactivateUser(tenant.companyId, id);
  }

  @Permissions('settings.*')
  @Put(':id/activate')
  @ApiOperation({ summary: 'Reactivate a user account' })
  activate(@Tenant() tenant: RequestTenant, @Param('id') id: string) {
    return this.usersService.activateUser(tenant.companyId, id);
  }
}
