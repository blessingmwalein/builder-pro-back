import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PlatformAdminService } from '../platform-admin.service';

@Injectable()
export class PlatformAdminGuard implements CanActivate {
  constructor(private readonly platformAdminService: PlatformAdminService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    const authorizationHeader = request.headers.authorization;
    const bearerToken =
      authorizationHeader && authorizationHeader.startsWith('Bearer ')
        ? authorizationHeader.slice(7)
        : undefined;

    if (bearerToken) {
      const admin = await this.platformAdminService.validatePlatformAdminAccessToken(
        bearerToken,
      );

      if (admin) {
        request.platformAdmin = {
          adminUserId: admin.id,
          email: admin.email,
          displayName: admin.displayName,
        };

        return true;
      }
    }

    const providedHeader = request.headers['x-platform-admin-key'];
    const providedKey = Array.isArray(providedHeader)
      ? providedHeader[0]
      : providedHeader;

    if (!providedKey) {
      throw new UnauthorizedException(
        'Provide Authorization: Bearer <token> or x-platform-admin-key',
      );
    }

    const admin = await this.platformAdminService.resolveByApiKey(providedKey);

    if (!admin) {
      throw new UnauthorizedException('Invalid platform admin key');
    }

    request.platformAdmin = {
      adminUserId: admin.id,
      email: admin.email,
      displayName: admin.displayName,
    };

    return true;
  }
}
