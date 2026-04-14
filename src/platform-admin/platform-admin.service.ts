import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PaymentStatus, SubscriptionStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AssignPermissionsDto } from '../rbac/dto/assign-permissions.dto';
import { CreateRoleDto } from '../rbac/dto/create-role.dto';
import { RbacService } from '../rbac/rbac.service';
import { PlatformAdminLoginDto } from './dto/platform-admin-login.dto';
import { PlatformAdminPaginationDto } from './dto/platform-admin-pagination.dto';

interface PlatformAdminTokenPayload {
  sub: string;
  email: string;
  type: 'platform_admin';
}

const parseDurationToSeconds = (input: string): number => {
  const value = input.trim().toLowerCase();
  const match = value.match(/^(\d+)([smhd])?$/);

  if (!match) {
    return 60 * 60 * 12;
  }

  const amount = Number(match[1]);
  const unit = match[2] ?? 's';

  switch (unit) {
    case 'm':
      return amount * 60;
    case 'h':
      return amount * 60 * 60;
    case 'd':
      return amount * 60 * 60 * 24;
    default:
      return amount;
  }
};

const hashApiKey = (apiKey: string): string =>
  createHash('sha256').update(apiKey).digest('hex');

@Injectable()
export class PlatformAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly rbacService: RbacService,
  ) {}

  async login(dto: PlatformAdminLoginDto) {
    const admin = await this.prisma.platformAdminUser.findUnique({
      where: {
        email: dto.email.toLowerCase().trim(),
      },
    });

    if (!admin || !admin.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordMatches = await bcrypt.compare(dto.password, admin.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const expiresInRaw =
      this.configService.get<string>('platformAdmin.jwtTtl') ?? '12h';
    const expiresInSeconds = parseDurationToSeconds(expiresInRaw);
    const secret = this.getPlatformAdminJwtSecret();

    const accessToken = await this.jwtService.signAsync(
      {
        sub: admin.id,
        email: admin.email,
        type: 'platform_admin',
      },
      {
        secret,
        expiresIn: expiresInSeconds,
      },
    );

    await this.prisma.platformAdminUser.update({
      where: { id: admin.id },
      data: {
        lastLoginAt: new Date(),
      },
    });

    return {
      tokenType: 'Bearer',
      expiresIn: expiresInRaw,
      accessToken,
      admin: {
        id: admin.id,
        email: admin.email,
        displayName: admin.displayName,
      },
    };
  }

  async getMe(adminUserId: string) {
    const admin = await this.prisma.platformAdminUser.findFirst({
      where: { id: adminUserId, isActive: true },
      select: {
        id: true,
        email: true,
        displayName: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        lastLoginAt: true,
      },
    });

    if (!admin) {
      throw new UnauthorizedException('Platform admin account not found');
    }

    return { admin };
  }

  async rotateApiKey(adminUserId: string, reason?: string) {
    const admin = await this.prisma.platformAdminUser.findFirst({
      where: {
        id: adminUserId,
        isActive: true,
      },
      select: {
        id: true,
        email: true,
        displayName: true,
      },
    });

    if (!admin) {
      throw new UnauthorizedException('Platform admin account not found');
    }

    const newApiKey = randomBytes(32).toString('hex');
    await this.prisma.platformAdminUser.update({
      where: { id: admin.id },
      data: {
        apiKeyHash: hashApiKey(newApiKey),
      },
    });

    return {
      admin: {
        id: admin.id,
        email: admin.email,
        displayName: admin.displayName,
      },
      apiKey: newApiKey,
      reason: reason?.trim() || null,
      warning: 'Store this key securely. It will not be shown again.',
    };
  }

  async resolveByApiKey(apiKey: string) {
    const keyHash = hashApiKey(apiKey);

    const admin = await this.prisma.platformAdminUser.findFirst({
      where: {
        apiKeyHash: keyHash,
        isActive: true,
      },
      select: {
        id: true,
        email: true,
        displayName: true,
      },
    });

    return admin;
  }

  async validatePlatformAdminAccessToken(token: string) {
    const secret = this.getPlatformAdminJwtSecret();
    let payload: PlatformAdminTokenPayload;

    try {
      payload = await this.jwtService.verifyAsync<PlatformAdminTokenPayload>(token, {
        secret,
      });
    } catch {
      return null;
    }

    if (payload.type !== 'platform_admin') {
      return null;
    }

    const admin = await this.prisma.platformAdminUser.findFirst({
      where: {
        id: payload.sub,
        email: payload.email,
        isActive: true,
      },
      select: {
        id: true,
        email: true,
        displayName: true,
      },
    });

    return admin;
  }

  async listCompanies(query: PlatformAdminPaginationDto) {
    const limit = Math.min(query.limit, 100);
    const skip = (query.page - 1) * limit;

    const where = {
      deletedAt: null,
      OR: query.search
        ? [
            { name: { contains: query.search, mode: 'insensitive' as const } },
            { slug: { contains: query.search, mode: 'insensitive' as const } },
          ]
        : undefined,
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.company.findMany({
        where,
        include: {
          subscriptions: {
            where: { deletedAt: null },
            orderBy: { createdAt: 'desc' },
            take: 1,
            include: {
              plan: {
                select: { id: true, code: true, name: true, monthlyPrice: true },
              },
              platformPlan: {
                select: { id: true, code: true, name: true, monthlyPrice: true },
              },
            },
          },
          _count: {
            select: {
              users: true,
              projects: true,
              subscriptions: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.company.count({ where }),
    ]);

    return { items, meta: { page: query.page, limit, total } };
  }

  async listPendingApprovals(query: PlatformAdminPaginationDto) {
    const limit = Math.min(query.limit, 100);
    const skip = (query.page - 1) * limit;

    const where = {
      deletedAt: null,
      isActive: false,
      OR: query.search
        ? [
            { name: { contains: query.search, mode: 'insensitive' as const } },
            { slug: { contains: query.search, mode: 'insensitive' as const } },
          ]
        : undefined,
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.company.findMany({
        where,
        include: {
          subscriptions: {
            where: { deletedAt: null },
            orderBy: { createdAt: 'desc' },
            take: 1,
            include: {
              plan: {
                select: { id: true, code: true, name: true, monthlyPrice: true },
              },
              platformPlan: {
                select: { id: true, code: true, name: true, monthlyPrice: true },
              },
            },
          },
          _count: {
            select: {
              users: true,
              projects: true,
              subscriptions: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.company.count({ where }),
    ]);

    return { items, meta: { page: query.page, limit, total } };
  }

  async getCompanyDetails(companyId: string) {
    const company = await this.prisma.company.findFirst({
      where: { id: companyId, deletedAt: null },
      include: {
        subscriptions: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
          include: {
            plan: true,
            platformPlan: true,
            payments: {
              where: { deletedAt: null },
              orderBy: { createdAt: 'desc' },
              take: 5,
            },
          },
          take: 5,
        },
        _count: {
          select: {
            users: true,
            projects: true,
            subscriptions: true,
            invoices: true,
          },
        },
      },
    });

    if (!company) {
      throw new NotFoundException('Company not found');
    }

    return company;
  }

  async updateCompanyApproval(companyId: string, isActive: boolean) {
    const company = await this.prisma.company.findFirst({
      where: { id: companyId, deletedAt: null },
      select: { id: true },
    });

    if (!company) {
      throw new NotFoundException('Company not found');
    }

    return this.prisma.company.update({
      where: { id: companyId },
      data: { isActive },
    });
  }

  async listSubscriptions(query: PlatformAdminPaginationDto) {
    const limit = Math.min(query.limit, 100);
    const skip = (query.page - 1) * limit;

    const where = {
      deletedAt: null,
      company: query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' as const } },
              { slug: { contains: query.search, mode: 'insensitive' as const } },
            ],
          }
        : undefined,
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.subscription.findMany({
        where,
        include: {
          company: {
            select: { id: true, name: true, slug: true, isActive: true },
          },
          plan: {
            select: { id: true, code: true, name: true, monthlyPrice: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.subscription.count({ where }),
    ]);

    return { items, meta: { page: query.page, limit, total } };
  }

  async updateSubscriptionStatus(
    subscriptionId: string,
    status: SubscriptionStatus,
  ) {
    const subscription = await this.prisma.subscription.findFirst({
      where: { id: subscriptionId, deletedAt: null },
      select: { id: true },
    });

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    return this.prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        status,
        canceledAt: status === SubscriptionStatus.CANCELED ? new Date() : null,
      },
    });
  }

  async listPayments(query: PlatformAdminPaginationDto) {
    const limit = Math.min(query.limit, 100);
    const skip = (query.page - 1) * limit;

    const where = {
      deletedAt: null,
      invoice: query.search
        ? {
            company: {
              OR: [
                { name: { contains: query.search, mode: 'insensitive' as const } },
                { slug: { contains: query.search, mode: 'insensitive' as const } },
              ],
            },
          }
        : undefined,
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.payment.findMany({
        where,
        include: {
          invoice: {
            select: {
              id: true,
              invoiceNumber: true,
              company: {
                select: { id: true, name: true, slug: true },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.payment.count({ where }),
    ]);

    return { items, meta: { page: query.page, limit, total } };
  }

  async overview() {
    const [companyCount, pendingApprovalCount, activeSubscriptionCount, paymentStats] =
      await Promise.all([
        this.prisma.company.count({ where: { deletedAt: null } }),
        this.prisma.company.count({ where: { deletedAt: null, isActive: false } }),
        this.prisma.subscription.count({
          where: { deletedAt: null, status: SubscriptionStatus.ACTIVE },
        }),
        this.prisma.payment.groupBy({
          by: ['status'],
          _count: { _all: true },
          where: { deletedAt: null },
        }),
      ]);

    const paymentsByStatus = {
      pending:
        paymentStats.find((item) => item.status === PaymentStatus.PENDING)?._count
          ._all ?? 0,
      success:
        paymentStats.find((item) => item.status === PaymentStatus.SUCCESS)?._count
          ._all ?? 0,
      failed:
        paymentStats.find((item) => item.status === PaymentStatus.FAILED)?._count
          ._all ?? 0,
    };

    return {
      companies: {
        total: companyCount,
        pendingApprovals: pendingApprovalCount,
      },
      subscriptions: {
        active: activeSubscriptionCount,
      },
      payments: paymentsByStatus,
    };
  }

  listAllPermissions(companyId: string) {
    return {
      companyId,
      items: this.rbacService.listAllPermissions(),
    };
  }

  listRoles(companyId: string) {
    return this.rbacService.listRoles(companyId);
  }

  getRole(companyId: string, roleId: string) {
    return this.rbacService.getRole(companyId, roleId);
  }

  createRole(companyId: string, dto: CreateRoleDto) {
    return this.rbacService.createRole(companyId, dto);
  }

  updateRole(companyId: string, roleId: string, dto: CreateRoleDto) {
    return this.rbacService.updateRole(companyId, roleId, dto);
  }

  deleteRole(companyId: string, roleId: string) {
    return this.rbacService.deleteRole(companyId, roleId);
  }

  assignPermissions(
    companyId: string,
    roleId: string,
    dto: AssignPermissionsDto,
  ) {
    return this.rbacService.assignPermissionsToRole(companyId, roleId, dto);
  }

  removePermission(companyId: string, roleId: string, permissionKey: string) {
    return this.rbacService.removePermissionFromRole(
      companyId,
      roleId,
      permissionKey,
    );
  }

  getUserRoles(companyId: string, userId: string) {
    return this.rbacService.getUserRoles(companyId, userId);
  }

  assignRole(companyId: string, userId: string, roleId: string) {
    return this.rbacService.assignRoleToUser(companyId, userId, roleId);
  }

  removeRole(companyId: string, userId: string, roleId: string) {
    return this.rbacService.removeRoleFromUser(companyId, userId, roleId);
  }

  private getPlatformAdminJwtSecret(): string {
    const secret = this.configService.get<string>('platformAdmin.jwtSecret') ?? '';

    if (!secret || secret === 'change-me-platform-admin-jwt-secret') {
      throw new UnauthorizedException('Platform admin JWT secret is not configured');
    }

    return secret;
  }
}
