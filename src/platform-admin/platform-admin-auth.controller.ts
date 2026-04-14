import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { PlatformAdminLoginDto } from './dto/platform-admin-login.dto';
import { RotatePlatformAdminApiKeyDto } from './dto/rotate-platform-admin-api-key.dto';
import { PlatformAdminGuard } from './guards/platform-admin.guard';
import { PlatformAdminService } from './platform-admin.service';

@ApiTags('Platform Admin Auth')
@Public()
@Controller('platform-admin/auth')
export class PlatformAdminAuthController {
  constructor(private readonly platformAdminService: PlatformAdminService) {}

  @Post('login')
  @ApiOperation({
    summary: 'Platform admin login',
    description:
      'Logs in a platform admin user and returns a platform-admin bearer token.',
  })
  @ApiBody({ type: PlatformAdminLoginDto })
  login(@Body() dto: PlatformAdminLoginDto) {
    return this.platformAdminService.login(dto);
  }

  @Get('me')
  @UseGuards(PlatformAdminGuard)
  @ApiOperation({ summary: 'Get current platform admin profile' })
  @ApiBearerAuth('platform-admin-bearer')
  @ApiSecurity('platform-admin-key')
  me(@Req() req: Request) {
    const adminUserId = req.platformAdmin?.adminUserId;
    return this.platformAdminService.getMe(adminUserId ?? '');
  }

  @Post('rotate-api-key')
  @UseGuards(PlatformAdminGuard)
  @ApiOperation({
    summary: 'Rotate current platform admin API key',
    description:
      'Invalidates the previous API key and returns a newly generated key. Save it immediately.',
  })
  @ApiBearerAuth('platform-admin-bearer')
  @ApiSecurity('platform-admin-key')
  rotateApiKey(@Req() req: Request, @Body() dto: RotatePlatformAdminApiKeyDto) {
    const adminUserId = req.platformAdmin?.adminUserId;
    return this.platformAdminService.rotateApiKey(adminUserId ?? '', dto.reason);
  }
}
