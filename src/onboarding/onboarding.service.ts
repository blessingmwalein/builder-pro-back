import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AccountType, PaymentMethod, PaymentStatus, SubscriptionStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { PaynowProvider } from '../billing/paynow.provider';
import { MailService } from '../mail/mail.service';
import { ActivateSubscriptionDto, BillingCycle } from './dto/activate-subscription.dto';
import { RegisterCompanyDto } from './dto/register-company.dto';

const SYSTEM_ROLES = [
  {
    name: 'Owner',
    description: 'Full access — manages billing, users, company settings',
    permissions: [
      'projects.*', 'tasks.*', 'timesheets.*', 'materials.*', 'quotes.*',
      'invoices.*', 'financials.*', 'employees.*', 'settings.*', 'crm.*',
      'reports.*', 'messaging.*', 'documents.*',
    ],
  },
  {
    name: 'Project Manager',
    description: 'Creates and manages projects, assigns workers, views financials',
    permissions: [
      'projects.*', 'tasks.*', 'timesheets.*', 'materials.*', 'quotes.*',
      'invoices.*', 'financials.*', 'employees.*', 'crm.*', 'reports.*',
      'messaging.*', 'documents.*',
    ],
  },
  {
    name: 'Site Supervisor',
    description: 'Views assigned projects, manages tasks, logs materials',
    permissions: ['projects.view', 'tasks.*', 'timesheets.*', 'materials.*', 'messaging.*', 'documents.*'],
  },
  {
    name: 'Worker',
    description: 'Clocks in/out, views assigned tasks, logs materials',
    permissions: ['projects.view', 'tasks.view', 'tasks.complete', 'timesheets.view_own', 'materials.log', 'messaging.*'],
  },
  {
    name: 'Accountant',
    description: 'Read/write access to financials, invoices, reports only',
    permissions: ['invoices.*', 'financials.*', 'quotes.view', 'reports.*'],
  },
  {
    name: 'Client',
    description: 'Read-only access to their project progress, quotes, invoices',
    permissions: ['projects.view', 'quotes.view', 'invoices.view'],
  },
];

@Injectable()
export class OnboardingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly paynowProvider: PaynowProvider,
    private readonly mailService: MailService,
  ) {}

  listPlans() {
    return this.prisma.platformPlan.findMany({
      where: { isActive: true, deletedAt: null },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        targetAccountType: true,
        monthlyPrice: true,
        annualPrice: true,
        limits: true,
        features: true,
        sortOrder: true,
      },
    });
  }

  async registerCompany(dto: RegisterCompanyDto) {
    const slug = this.generateSlug(dto.companyName);

    const existingSlug = await this.prisma.company.findFirst({
      where: { slug, deletedAt: null },
      select: { id: true },
    });
    if (existingSlug) {
      throw new ConflictException(
        'A company with a similar name already exists. Please choose a different name.',
      );
    }

    const planCode = dto.planCode ?? 'SMALL_BUSINESS';
    const platformPlan = await this.prisma.platformPlan.findFirst({
      where: { code: planCode, isActive: true, deletedAt: null },
    });
    if (!platformPlan) {
      throw new NotFoundException(`Plan '${planCode}' not found.`);
    }

    const companyId = `co_${Date.now()}`;
    const passwordHash = await bcrypt.hash(dto.password, 12);
    const uniquePermissionKeys = [
      ...new Set(SYSTEM_ROLES.flatMap((roleDef) => roleDef.permissions)),
    ];

    const result = await this.prisma.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: {
          companyId,
          name: dto.companyName,
          slug,
          industry: dto.industry,
          accountType: dto.accountType ?? AccountType.COMPANY,
          defaultCurrency: dto.defaultCurrency ?? 'USD',
          countryCode: dto.countryCode ?? 'ZW',
          isActive: true,
        },
      });

      const user = await tx.user.create({
        data: {
          companyId: company.id,
          email: dto.email.toLowerCase().trim(),
          firstName: dto.firstName,
          lastName: dto.lastName,
          phone: dto.phone,
          passwordHash,
          isActive: true,
        },
      });

      // Create permissions and roles
      await tx.permission.createMany({
        data: uniquePermissionKeys.map((permKey) => ({
          companyId: company.id,
          key: permKey,
          description: `Permission: ${permKey}`,
        })),
        skipDuplicates: true,
      });

      const permissionRows = await tx.permission.findMany({
        where: {
          companyId: company.id,
          key: {
            in: uniquePermissionKeys,
          },
        },
        select: {
          id: true,
          key: true,
        },
      });

      const permissionMap = new Map(permissionRows.map((perm) => [perm.key, perm.id]));

      let ownerRoleId = '';
      for (const roleDef of SYSTEM_ROLES) {
        const role = await tx.role.create({
          data: { companyId: company.id, name: roleDef.name, description: roleDef.description, isSystem: true },
        });
        if (roleDef.name === 'Owner') ownerRoleId = role.id;

        await tx.rolePermission.createMany({
          data: roleDef.permissions.map((permKey) => ({
            companyId: company.id,
            roleId: role.id,
            permissionId: permissionMap.get(permKey)!,
          })),
          skipDuplicates: true,
        });
      }

      await tx.userRole.create({
        data: { companyId: company.id, userId: user.id, roleId: ownerRoleId },
      });

      // Per-company placeholder plan (required by Subscription FK)
      const localPlan = await tx.subscriptionPlan.create({
        data: {
          companyId: company.id,
          code: platformPlan.code,
          name: platformPlan.name,
          monthlyPrice: platformPlan.monthlyPrice,
          annualPrice: platformPlan.annualPrice,
          limits: platformPlan.limits as any,
          isActive: true,
        },
      });

      const trialStart = new Date();
      const trialEnd = new Date(trialStart);
      trialEnd.setDate(trialEnd.getDate() + 14);

      const subscription = await tx.subscription.create({
        data: {
          companyId: company.id,
          planId: localPlan.id,
          platformPlanId: platformPlan.id,
          status: SubscriptionStatus.TRIAL,
          billingCycle: 'MONTHLY',
          currentPeriodFrom: trialStart,
          currentPeriodTo: trialEnd,
          trialEndsAt: trialEnd,
        },
      });

      return { company, user, subscription, platformPlan };
    }, {
      maxWait: 10_000,
      timeout: 30_000,
    });

    const accessToken = await this.issueAccessToken(
      result.user.id,
      result.company.id,
      result.user.email,
    );

    const trialDaysLeft = Math.ceil(
      (result.subscription.trialEndsAt!.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
    );

    // Fire-and-forget welcome email.
    void this.mailService.sendWelcome(result.user.email, {
      firstName: result.user.firstName,
      companyName: result.company.name,
      trialDays: trialDaysLeft,
      dashboardUrl: this.mailService.buildDashboardUrl(),
    });

    return {
      accessToken,
      tokenType: 'Bearer',
      company: {
        id: result.company.id,
        name: result.company.name,
        slug: result.company.slug,
        accountType: result.company.accountType,
        defaultCurrency: result.company.defaultCurrency,
      },
      user: {
        id: result.user.id,
        email: result.user.email,
        firstName: result.user.firstName,
        lastName: result.user.lastName,
      },
      subscription: {
        status: 'TRIAL',
        planCode: result.platformPlan.code,
        planName: result.platformPlan.name,
        trialEndsAt: result.subscription.trialEndsAt,
        trialDaysLeft,
        limits: result.platformPlan.limits,
        activateUrl: '/onboarding/activate-subscription',
      },
    };
  }

  async activateSubscription(
    companyId: string,
    dto: ActivateSubscriptionDto,
    userEmail?: string,
  ) {
    let subscription = await this.prisma.subscription.findFirst({
      where: { companyId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      include: { platformPlan: true, plan: true },
    });

    if (!subscription) {
      const initialPlanCode = dto.planCode ?? 'SMALL_BUSINESS';
      const initialPlatformPlan = await this.prisma.platformPlan.findFirst({
        where: { code: initialPlanCode, isActive: true, deletedAt: null },
      });

      if (!initialPlatformPlan) {
        throw new NotFoundException(`Plan '${initialPlanCode}' not found.`);
      }

      const trialStart = new Date();
      const trialEnd = new Date(trialStart);
      trialEnd.setDate(trialEnd.getDate() + 14);

      subscription = await this.prisma.$transaction(async (tx) => {
        const localPlan = await tx.subscriptionPlan.upsert({
          where: {
            companyId_code: {
              companyId,
              code: initialPlatformPlan.code,
            },
          },
          create: {
            companyId,
            code: initialPlatformPlan.code,
            name: initialPlatformPlan.name,
            monthlyPrice: initialPlatformPlan.monthlyPrice,
            annualPrice: initialPlatformPlan.annualPrice,
            limits: initialPlatformPlan.limits as any,
            isActive: true,
          },
          update: {
            name: initialPlatformPlan.name,
            monthlyPrice: initialPlatformPlan.monthlyPrice,
            annualPrice: initialPlatformPlan.annualPrice,
            limits: initialPlatformPlan.limits as any,
            isActive: true,
            deletedAt: null,
          },
        });

        return tx.subscription.create({
          data: {
            companyId,
            planId: localPlan.id,
            platformPlanId: initialPlatformPlan.id,
            status: SubscriptionStatus.TRIAL,
            billingCycle: 'MONTHLY',
            currentPeriodFrom: trialStart,
            currentPeriodTo: trialEnd,
            trialEndsAt: trialEnd,
          },
          include: { platformPlan: true, plan: true },
        });
      });
    }

    if (subscription.status === SubscriptionStatus.ACTIVE) {
      throw new BadRequestException('Subscription is already active.');
    }

    // Resolve plan — allow upgrade at activation time
    let platformPlan = subscription.platformPlan;
    if (dto.planCode && dto.planCode !== subscription.platformPlan?.code) {
      platformPlan = await this.prisma.platformPlan.findFirst({
        where: { code: dto.planCode, isActive: true, deletedAt: null },
      });
      if (!platformPlan) throw new NotFoundException(`Plan '${dto.planCode}' not found.`);
    }

    if (!platformPlan) {
      throw new BadRequestException('No platform plan linked to subscription.');
    }

    const billingCycle = dto.billingCycle ?? BillingCycle.MONTHLY;
    const price = billingCycle === BillingCycle.ANNUAL
      ? Number(platformPlan.annualPrice)
      : Number(platformPlan.monthlyPrice);

    if (price === 0) {
      // Free plan — activate immediately
      const now = new Date();
      const periodEnd = new Date(now);
      billingCycle === BillingCycle.ANNUAL
        ? periodEnd.setFullYear(periodEnd.getFullYear() + 1)
        : periodEnd.setMonth(periodEnd.getMonth() + 1);

      await this.prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          status: SubscriptionStatus.ACTIVE,
          billingCycle,
          currentPeriodFrom: now,
          currentPeriodTo: periodEnd,
          platformPlanId: platformPlan.id,
        },
      });

      return {
        status: 'ACTIVE',
        planCode: platformPlan.code,
        planName: platformPlan.name,
        billingCycle,
        currentPeriodTo: periodEnd,
        entitlements: {
          limits: platformPlan.limits,
          features: platformPlan.features,
        },
        message: 'Account activated successfully (free plan).',
      };
    }

    // Paid plan — initiate PayNow payment
    const transactionRef = `SUB-${companyId}-${Date.now()}`;

    const paynowResult = await this.paynowProvider.initiatePayment({
      companyId,
      invoiceId: subscription.id, // used as reference, not a real invoice
      amount: price,
      currency: 'USD',
      payerEmail: dto.payerEmail ?? userEmail,
      payerPhone: dto.payerPhone,
      mode: dto.method === PaymentMethod.ECOCASH ? 'MOBILE' : 'WEB',
      mobileMethod: dto.method === PaymentMethod.ECOCASH ? 'ecocash' : undefined,
      reference: transactionRef,
      description: `Subscription activation - ${platformPlan.name} (${billingCycle})`,
    });

    // Record pending payment linked to subscription
    await this.prisma.payment.create({
      data: {
        companyId,
        subscriptionId: subscription.id,
        transactionRef: paynowResult.providerReference,
        method: dto.method,
        status: PaymentStatus.PENDING,
        amount: price,
        providerPayload: {
          initiated: paynowResult.rawPayload,
          pollUrl: paynowResult.pollUrl,
          instructions: paynowResult.instructions,
          providerStatus: paynowResult.providerStatus,
        } as any,
        notes: `Subscription activation — ${platformPlan.name} (${billingCycle})`,
      },
    });

    // Store pending upgrade info on subscription for webhook to pick up
    await this.prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        billingCycle,
        platformPlanId: platformPlan.id,
      },
    });

    return {
      status: 'PENDING_PAYMENT',
      planCode: platformPlan.code,
      planName: platformPlan.name,
      billingCycle,
      amount: price,
      currency: 'USD',
      entitlements: {
        limits: platformPlan.limits,
        features: platformPlan.features,
      },
      paymentUrl: paynowResult.redirectUrl ?? null,
      pollUrl: paynowResult.pollUrl ?? null,
      instructions: paynowResult.instructions ?? null,
      providerReference: paynowResult.providerReference,
      message: 'Complete payment to activate your subscription.',
    };
  }

  async getSubscriptionStatus(companyId: string) {
    const subscription = await this.prisma.subscription.findFirst({
      where: { companyId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      include: { platformPlan: true },
    });

    if (!subscription) {
      return { status: 'NONE', message: 'No subscription found.' };
    }

    const now = new Date();
    const isTrialExpired =
      subscription.status === SubscriptionStatus.TRIAL &&
      subscription.trialEndsAt &&
      subscription.trialEndsAt < now;

    const daysLeft = subscription.trialEndsAt
      ? Math.max(0, Math.ceil((subscription.trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
      : null;

    const limits = (subscription.platformPlan?.limits ?? {}) as any;

    return {
      status: isTrialExpired ? 'TRIAL_EXPIRED' : subscription.status,
      planCode: subscription.platformPlan?.code ?? null,
      planName: subscription.platformPlan?.name ?? null,
      billingCycle: subscription.billingCycle,
      currentPeriodFrom: subscription.currentPeriodFrom,
      currentPeriodTo: subscription.currentPeriodTo,
      trialEndsAt: subscription.trialEndsAt,
      trialDaysLeft: subscription.status === SubscriptionStatus.TRIAL ? daysLeft : null,
      limits,
      isExpired: isTrialExpired || (
        subscription.status === SubscriptionStatus.ACTIVE && subscription.currentPeriodTo < now
      ),
    };
  }

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .substring(0, 50);
  }

  private async issueAccessToken(userId: string, companyId: string, email: string) {
    const accessSecret = this.configService.get<string>('auth.jwtSecret') ?? 'change-me';
    const accessTtlRaw = this.configService.get<string>('auth.jwtAccessTtl') ?? '15m';

    return this.jwtService.signAsync(
      { sub: userId, companyId, email },
      { secret: accessSecret, expiresIn: accessTtlRaw as any },
    );
  }
}
