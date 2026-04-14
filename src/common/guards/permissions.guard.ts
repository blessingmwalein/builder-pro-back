import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const userCompanyId: string | undefined = request.user?.companyId;
    const tenantCompanyId: string | undefined = request.tenant?.companyId;

    if (userCompanyId && tenantCompanyId && userCompanyId !== tenantCompanyId) {
      throw new ForbiddenException('Tenant mismatch for authenticated user');
    }

    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const userPermissions: string[] = request.user?.permissions ?? [];

    // User needs ANY of the listed permissions (OR logic).
    // Wildcard permissions (e.g. "projects.*") grant access to all
    // sub-permissions under that module (e.g. "projects.view").
    const hasPermission = requiredPermissions.some((required) =>
      userPermissions.some((held) => {
        if (held === required) return true;
        // "projects.*" covers "projects.view", "projects.create", etc.
        if (held.endsWith('.*')) {
          const prefix = held.slice(0, -1); // "projects."
          return required.startsWith(prefix);
        }
        return false;
      }),
    );

    if (!hasPermission) {
      throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }
}
