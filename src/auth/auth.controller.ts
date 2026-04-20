import {
  Body,
  Controller,
  Get,
  Param,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { Public } from '../common/decorators/public.decorator';
import { Tenant } from '../common/decorators/tenant.decorator';
import type {
  RequestTenant,
  RequestUser,
} from '../common/interfaces/request-context.interface';
import { AcceptInviteDto } from './dto/accept-invite.dto';
import { InviteUserDto } from './dto/invite-user.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { AuthService } from './auth.service';

@ApiTags('Auth')
@ApiBearerAuth()
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Register a user into an existing company (by slug)' })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @Post('login')
  @ApiOperation({ summary: 'Login with email + password' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto, dto.companySlug);
  }

  @Public()
  @Post('refresh')
  @ApiOperation({ summary: 'Refresh access token using refresh token' })
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @Get('me')
  @ApiOperation({ summary: 'Get current user profile with permissions' })
  me(@Tenant() tenant: RequestTenant, @CurrentUser() user: RequestUser) {
    return this.authService.me(tenant.companyId, user.userId);
  }

  @Permissions('employees.*', 'settings.*')
  @Post('invite')
  @ApiOperation({ summary: 'Invite a user to join the company' })
  inviteUser(
    @Tenant() tenant: RequestTenant,
    @CurrentUser() user: RequestUser,
    @Body() dto: InviteUserDto,
  ) {
    return this.authService.inviteUser(tenant.companyId, user.userId, dto);
  }

  @Permissions('employees.*', 'settings.*')
  @Post('invite/:userId/resend')
  @ApiOperation({ summary: 'Resend an invite to a pending user' })
  resendInvite(
    @Tenant() tenant: RequestTenant,
    @Param('userId') userId: string,
  ) {
    return this.authService.resendInvite(tenant.companyId, userId);
  }

  @Public()
  @Post('accept-invite')
  @ApiOperation({ summary: 'Accept an invite and set password' })
  acceptInvite(@Body() dto: AcceptInviteDto) {
    return this.authService.acceptInvite(dto);
  }
}
