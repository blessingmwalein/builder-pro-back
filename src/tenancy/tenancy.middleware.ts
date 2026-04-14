import {
  Injectable,
  NestMiddleware,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response, NextFunction } from 'express';
import { verify } from 'jsonwebtoken';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TenancyMiddleware implements NestMiddleware {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async use(req: Request, _res: Response, next: NextFunction): Promise<void> {
    const ignoredPrefixes = ['/api/docs', '/api-json', '/api/v1/platform-admin'];
    const ignoredPaths = [
      '/onboarding/register',
      '/onboarding/plans',
      '/api/v1/onboarding/register',
      '/api/v1/onboarding/plans',
      '/api/v1/auth/register',
      '/api/v1/auth/refresh',
      '/api/v1/auth/login',
      '/api/v1/auth/accept-invite',
      '/api/v1/billing/webhooks/paynow',
    ];
    const isIgnoredPrefix = ignoredPrefixes.some((prefix) => req.path.startsWith(prefix));

    if (ignoredPaths.includes(req.path) || isIgnoredPrefix) {
      next();
      return;
    }

    const tenantSlugHeader = req.headers['x-tenant-slug'];
    const slugFromHeader = Array.isArray(tenantSlugHeader)
      ? tenantSlugHeader[0]
      : tenantSlugHeader;

    const host = req.headers.host ?? '';
    const hostParts = host.split('.');
    const slugFromSubdomain = hostParts.length > 2 ? hostParts[0] : undefined;

    const slug = slugFromHeader || slugFromSubdomain;

    let company: { id: string; slug: string } | null = null;

    if (slug) {
      company = await this.prisma.company.findFirst({
        where: {
          slug,
          deletedAt: null,
          isActive: true,
        },
        select: {
          id: true,
          slug: true,
        },
      });
    } else {
      const authorizationHeader = req.headers.authorization;
      const token =
        authorizationHeader && authorizationHeader.startsWith('Bearer ')
          ? authorizationHeader.slice(7)
          : undefined;

      if (!token) {
        throw new UnauthorizedException('Tenant slug is required');
      }

      try {
        const jwtSecret = this.configService.get<string>('auth.jwtSecret') ?? 'change-me';
        const payload = verify(token, jwtSecret) as {
          companyId?: string;
        };

        if (!payload.companyId) {
          throw new UnauthorizedException('Tenant slug is required');
        }

        company = await this.prisma.company.findFirst({
          where: {
            id: payload.companyId,
            deletedAt: null,
            isActive: true,
          },
          select: {
            id: true,
            slug: true,
          },
        });
      } catch {
        throw new UnauthorizedException('Tenant slug is required');
      }
    }

    if (!company) {
      throw new UnauthorizedException('Invalid tenant');
    }

    req.tenant = {
      slug: company.slug,
      companyId: company.id,
    };

    next();
  }
}
