import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { enforcePlanLimit } from '../common/helpers/plan-limits.helper';
import { RbacService } from '../rbac/rbac.service';
import { MailService } from '../mail/mail.service';
import { AcceptInviteDto } from './dto/accept-invite.dto';
import { InviteUserDto } from './dto/invite-user.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

interface TokenPayload {
  sub: string;
  companyId: string;
  email: string;
}

const parseDurationToSeconds = (input: string): number => {
  const value = input.trim().toLowerCase();
  const match = value.match(/^(\d+)([smhd])?$/);

  if (!match) {
    return 900;
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

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly rbacService: RbacService,
    private readonly mailService: MailService,
  ) {}

  async register(dto: RegisterDto) {
    let company = null as Awaited<ReturnType<typeof this.prisma.company.findFirst>>;

    if (dto.companySlug) {
      company = await this.prisma.company.findFirst({
        where: {
          slug: dto.companySlug,
          deletedAt: null,
        },
      });

      if (!company) {
        throw new UnauthorizedException('Invalid company slug');
      }
    } else {
      if (!dto.companyName) {
        throw new BadRequestException('companyName is required when companySlug is not provided');
      }

      const baseSlug = this.generateSlug(dto.companyName);
      const companySlug = await this.resolveAvailableCompanySlug(baseSlug);

      company = await this.prisma.company.create({
        data: {
          companyId: `co_${Date.now()}`,
          name: dto.companyName,
          slug: companySlug,
          isActive: true,
        },
      });
    }

    const exists = await this.prisma.user.findFirst({
      where: {
        companyId: company.id,
        email: dto.email,
      },
    });

    if (exists) {
      throw new ConflictException('User already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.prisma.user.create({
      data: {
        companyId: company.id,
        email: dto.email,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        passwordHash,
      },
    });

    return this.issueTokenPair(user.id, user.companyId, user.email);
  }

  async login(dto: LoginDto, companySlug?: string) {
    const normalizedEmail = dto.email.toLowerCase().trim();
    let user = null as Awaited<ReturnType<typeof this.prisma.user.findFirst>>;

    if (companySlug) {
      const company = await this.prisma.company.findFirst({
        where: {
          slug: companySlug,
          deletedAt: null,
        },
      });

      if (!company) {
        throw new UnauthorizedException('Invalid company slug');
      }

      user = await this.prisma.user.findFirst({
        where: {
          companyId: company.id,
          email: normalizedEmail,
          deletedAt: null,
        },
      });
    } else {
      const users = await this.prisma.user.findMany({
        where: {
          email: normalizedEmail,
          deletedAt: null,
          company: {
            isActive: true,
            deletedAt: null,
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 2,
      });

      if (users.length > 1) {
        throw new UnauthorizedException(
          'Multiple accounts found for this email. Please include companySlug.',
        );
      }

      user = users[0] ?? null;
    }

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.issueTokenPair(user.id, user.companyId, user.email);
  }

  async refresh(refreshToken: string) {
    const refreshSecret =
      this.configService.get<string>('auth.jwtRefreshSecret') ??
      'change-me-refresh';

    let payload: TokenPayload;

    try {
      payload = await this.jwtService.verifyAsync<TokenPayload>(refreshToken, {
        secret: refreshSecret,
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.prisma.user.findFirst({
      where: {
        id: payload.sub,
        companyId: payload.companyId,
        deletedAt: null,
      },
    });

    if (!user || !user.refreshTokenHash) {
      throw new UnauthorizedException('Refresh token rejected');
    }

    const matches = await bcrypt.compare(refreshToken, user.refreshTokenHash);
    if (!matches) {
      throw new UnauthorizedException('Refresh token rejected');
    }

    return this.issueTokenPair(user.id, user.companyId, user.email);
  }

  async validateAccessTokenPayload(payload: TokenPayload) {
    const user = await this.prisma.user.findFirst({
      where: {
        id: payload.sub,
        companyId: payload.companyId,
        deletedAt: null,
      },
      select: {
        id: true,
        email: true,
        companyId: true,
        isActive: true,
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Account not active');
    }

    const permissions = await this.rbacService.getUserPermissions(
      user.companyId,
      user.id,
    );

    return {
      userId: user.id,
      companyId: user.companyId,
      email: user.email,
      permissions,
    };
  }

  async me(companyId: string, userId: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        companyId,
        deletedAt: null,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        avatarUrl: true,
        companyId: true,
        isActive: true,
        lastLoginAt: true,
        userRoles: {
          where: { deletedAt: null },
          select: {
            role: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('Account not active');
    }

    const company = await this.prisma.company.findFirst({
      where: {
        id: companyId,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        logoUrl: true,
        industry: true,
        countryCode: true,
        defaultCurrency: true,
        timezone: true,
        isActive: true,
        accountType: true,
      },
    });

    const permissions = await this.rbacService.getUserPermissions(companyId, userId);

    return {
      user: {
        ...user,
        roles: user.userRoles.map((ur) => ur.role),
        userRoles: undefined,
      },
      tenant: company,
      permissions,
    };
  }

  async inviteUser(
    companyId: string,
    invitedById: string,
    dto: InviteUserDto,
  ) {
    await enforcePlanLimit(this.prisma, companyId, 'users');

    const existing = await this.prisma.user.findFirst({
      where: { companyId, email: dto.email.toLowerCase().trim(), deletedAt: null },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException('A user with this email already exists in this company');
    }

    const inviteToken = randomBytes(32).toString('hex');
    const inviteTokenExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const user = await this.prisma.user.create({
      data: {
        companyId,
        email: dto.email.toLowerCase().trim(),
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        passwordHash: '',
        isActive: false,
        inviteToken,
        inviteTokenExpiresAt,
        invitedById,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        inviteToken: true,
        inviteTokenExpiresAt: true,
      },
    });

    let roleName: string | undefined;
    if (dto.roleId) {
      const role = await this.prisma.role.findFirst({
        where: { id: dto.roleId, companyId, deletedAt: null },
        select: { id: true, name: true },
      });

      if (role) {
        roleName = role.name;
        await this.prisma.userRole.create({
          data: { companyId, userId: user.id, roleId: role.id },
        });
      }
    }

    // Fire-and-forget — send invite email. mailService handles its own errors.
    const [company, inviter] = await Promise.all([
      this.prisma.company.findUnique({
        where: { id: companyId },
        select: { name: true },
      }),
      this.prisma.user.findUnique({
        where: { id: invitedById },
        select: { firstName: true, lastName: true },
      }),
    ]);

    void this.mailService.sendInvite(user.email, {
      inviteeFirstName: user.firstName,
      inviteeEmail: user.email,
      companyName: company?.name ?? 'BuilderPro',
      inviterName:
        [inviter?.firstName, inviter?.lastName].filter(Boolean).join(' ').trim() ||
        'Your teammate',
      roleName,
      acceptUrl: this.mailService.buildAcceptInviteUrl(inviteToken),
      expiresAt: inviteTokenExpiresAt,
    });

    return {
      userId: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      inviteToken: user.inviteToken,
      inviteLink: `/auth/accept-invite?token=${inviteToken}`,
      expiresAt: inviteTokenExpiresAt,
    };
  }

  async resendInvite(companyId: string, userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, companyId, deletedAt: null },
      select: {
        id: true,
        email: true,
        firstName: true,
        isActive: true,
        passwordHash: true,
        userRoles: { select: { role: { select: { name: true } } }, take: 1 },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.isActive || user.passwordHash) {
      throw new BadRequestException('User has already accepted their invite');
    }

    const inviteToken = randomBytes(32).toString('hex');
    const inviteTokenExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await this.prisma.user.update({
      where: { id: userId },
      data: { inviteToken, inviteTokenExpiresAt },
    });

    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { name: true },
    });

    void this.mailService.sendInvite(user.email, {
      inviteeFirstName: user.firstName,
      inviteeEmail: user.email,
      companyName: company?.name ?? 'BuilderPro',
      inviterName: 'Your teammate',
      roleName: user.userRoles[0]?.role?.name,
      acceptUrl: this.mailService.buildAcceptInviteUrl(inviteToken),
      expiresAt: inviteTokenExpiresAt,
    });

    return {
      userId: user.id,
      email: user.email,
      inviteToken,
      inviteLink: `/auth/accept-invite?token=${inviteToken}`,
      expiresAt: inviteTokenExpiresAt,
    };
  }

  async acceptInvite(dto: AcceptInviteDto) {
    const user = await this.prisma.user.findFirst({
      where: {
        inviteToken: dto.token,
        deletedAt: null,
      },
    });

    if (!user) {
      throw new NotFoundException('Invalid or expired invite token');
    }

    if (!user.inviteTokenExpiresAt || user.inviteTokenExpiresAt < new Date()) {
      throw new BadRequestException('Invite token has expired');
    }

    if (user.isActive) {
      throw new BadRequestException('This invite has already been accepted');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        isActive: true,
        inviteToken: null,
        inviteTokenExpiresAt: null,
      },
    });

    return this.issueTokenPair(updated.id, updated.companyId, updated.email);
  }

  private async issueTokenPair(userId: string, companyId: string, email: string) {
    const accessSecret =
      this.configService.get<string>('auth.jwtSecret') ?? 'change-me';
    const accessTtlRaw =
      this.configService.get<string>('auth.jwtAccessTtl') ?? '15m';
    const refreshSecret =
      this.configService.get<string>('auth.jwtRefreshSecret') ??
      'change-me-refresh';
    const refreshTtlRaw =
      this.configService.get<string>('auth.jwtRefreshTtl') ?? '7d';
    const accessTtl = parseDurationToSeconds(accessTtlRaw);
    const refreshTtl = parseDurationToSeconds(refreshTtlRaw);

    const payload: TokenPayload = {
      sub: userId,
      companyId,
      email,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: accessSecret,
        expiresIn: accessTtl,
      }),
      this.jwtService.signAsync(payload, {
        secret: refreshSecret,
        expiresIn: refreshTtl,
      }),
    ]);

    const refreshTokenHash = await bcrypt.hash(refreshToken, 12);
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        refreshTokenHash,
        lastLoginAt: new Date(),
      },
    });

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: accessTtlRaw,
    };
  }

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 50);
  }

  private async resolveAvailableCompanySlug(baseSlug: string): Promise<string> {
    const fallbackBase = baseSlug || 'company';

    const existing = await this.prisma.company.findFirst({
      where: { slug: fallbackBase, deletedAt: null },
      select: { id: true },
    });

    if (!existing) return fallbackBase;

    for (let i = 1; i <= 999; i++) {
      const candidate = `${fallbackBase}-${i}`.substring(0, 58);
      const taken = await this.prisma.company.findFirst({
        where: { slug: candidate, deletedAt: null },
        select: { id: true },
      });
      if (!taken) return candidate;
    }

    return `${fallbackBase}-${Date.now()}`.substring(0, 60);
  }
}
