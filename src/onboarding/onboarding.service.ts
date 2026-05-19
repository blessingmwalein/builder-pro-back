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
import { SubscriptionConfigService } from '../subscriptions/subscription-config.service';
import { PromoCodesService } from '../platform-admin/promo-codes.service';
import { ActivateSubscriptionDto, BillingCycle } from './dto/activate-subscription.dto';
import { RegisterCompanyDto } from './dto/register-company.dto';
import { OnboardingSetupDto } from './dto/onboarding-setup.dto';
import {
  CONSTRUCTION_SECTORS,
  CONSTRUCTION_PROJECT_TYPES,
  STAKEHOLDER_TYPES,
  WORKFLOW_TEMPLATES,
  DEFAULT_SECTORS,
  DEFAULT_PROJECT_TYPES,
  DEFAULT_STAKEHOLDERS,
  DEFAULT_WORKFLOWS,
} from './onboarding.constants';

export async function seedWorkspaceDefaults(prisma: PrismaService, companyId: string) {
  await prisma.$transaction(async (tx) => {
    await (tx as any).companySettings.upsert({
      where: { companyId },
      create: { companyId },
      update: {},
    });

    await (tx as any).tenantSector.createMany({
      data: DEFAULT_SECTORS
        .map((code) => CONSTRUCTION_SECTORS.find((s) => s.code === code)!)
        .map((s) => ({ companyId, code: s.code, name: s.name })),
      skipDuplicates: true,
    });

    await (tx as any).tenantProjectType.createMany({
      data: DEFAULT_PROJECT_TYPES
        .map((code) => CONSTRUCTION_PROJECT_TYPES.find((p) => p.code === code)!)
        .map((p) => ({ companyId, code: p.code, name: p.name })),
      skipDuplicates: true,
    });

    for (const type of DEFAULT_STAKEHOLDERS) {
      const def = STAKEHOLDER_TYPES[type];
      if (!def) continue;
      const existing = await (tx as any).tenantStakeholder.findFirst({ where: { companyId, type } });
      if (existing) continue;
      let role = await tx.role.findFirst({ where: { companyId, name: def.name, deletedAt: null } });
      if (!role) {
        role = await tx.role.create({
          data: { companyId, name: def.name, description: def.description, isSystem: false },
        });
      }
      await (tx as any).tenantStakeholder.create({
        data: { companyId, type, name: def.name, roleId: role.id },
      });
    }

    await (tx as any).workflowTemplate.createMany({
      data: DEFAULT_WORKFLOWS
        .filter((code) => WORKFLOW_TEMPLATES[code])
        .map((code) => ({
          companyId,
          code,
          name: WORKFLOW_TEMPLATES[code].name,
          description: WORKFLOW_TEMPLATES[code].description,
          stages: WORKFLOW_TEMPLATES[code].stages,
          isEnabled: true,
        })),
      skipDuplicates: true,
    });
  });
}

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

// Default material categories every tenant gets on signup. Codes stay stable
// so the frontend can reference them programmatically.
export const DEFAULT_MATERIAL_CATEGORIES = [
  { code: 'ELECTRICAL', name: 'Electrical', description: 'Cables, fittings, switches, conduits.' },
  { code: 'PLUMBING', name: 'Plumbing', description: 'Pipes, fittings, valves, sanitaryware.' },
  { code: 'CEMENT_CONCRETE', name: 'Cement & Concrete', description: 'Cement, aggregates, concrete mixes.' },
  { code: 'STEEL', name: 'Steel & Reinforcement', description: 'Rebar, mesh, angle iron.' },
  { code: 'TOOLS', name: 'Tools & Hardware', description: 'Hand tools, power tools, fasteners.' },
  { code: 'PAINTS', name: 'Paints & Finishes', description: 'Paints, primers, sealants.' },
  { code: 'ROOFING', name: 'Roofing', description: 'IBR sheets, trusses, gutters.' },
  { code: 'DOORS_WINDOWS', name: 'Doors & Windows', description: 'Frames, panels, glass.' },
  { code: 'TIMBER', name: 'Timber', description: 'Formwork, shuttering, framing.' },
  { code: 'CONSUMABLES', name: 'Consumables', description: 'PPE, fuel, cleaning, misc.' },
] as const;

// Pre-seeded Zimbabwe hardware suppliers — commonly used as starting point.
export const DEFAULT_SUPPLIERS = [
  {
    name: 'Electrosales',
    email: 'info@electrosales.co.zw',
    phone: '+263 24 2772801',
    website: 'https://www.electrosales.co.zw',
    address: 'Harare, Zimbabwe',
    notes: 'Electrical, tools, plumbing, hardware — live catalog integrated.',
    categories: 'ELECTRICAL,TOOLS,PLUMBING,CONSUMABLES',
  },
  {
    name: 'Halsteds',
    email: 'info@halsteds.co.zw',
    phone: '+263 24 2793981',
    website: 'https://halsteds.co.zw',
    address: 'Harare, Zimbabwe',
    notes: 'Building materials, hardware, paints and finishes.',
    categories: 'CEMENT_CONCRETE,TOOLS,PAINTS,ROOFING,TIMBER',
  },
  {
    name: 'Bhola Hardware',
    email: 'sales@bholahardware.co.zw',
    phone: '+263 24 2744015',
    address: 'Harare, Zimbabwe',
    notes: 'Cement, steel, doors and windows, general building supplies.',
    categories: 'CEMENT_CONCRETE,STEEL,DOORS_WINDOWS,ROOFING',
  },
] as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function seedDefaultMaterialCategories(tx: any, companyId: string) {
  await tx.materialCategory.createMany({
    data: DEFAULT_MATERIAL_CATEGORIES.map((c) => ({
      companyId,
      code: c.code,
      name: c.name,
      description: c.description,
    })),
    skipDuplicates: true,
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function seedDefaultSuppliers(tx: any, companyId: string) {
  await tx.supplier.createMany({
    data: DEFAULT_SUPPLIERS.map((s) => ({ companyId, ...s })),
    skipDuplicates: true,
  });
}

@Injectable()
export class OnboardingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly paynowProvider: PaynowProvider,
    private readonly mailService: MailService,
    private readonly subscriptionConfigService: SubscriptionConfigService,
    private readonly promoCodesService: PromoCodesService,
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
    const subConfig = await this.subscriptionConfigService.getConfig();

    const result = await this.prisma.$transaction(async (tx) => {
      const accountType = dto.accountType ?? AccountType.COMPANY;

      const company = await tx.company.create({
        data: {
          companyId,
          name: dto.companyName,
          slug,
          industry: dto.industry,
          accountType,
          defaultCurrency: dto.defaultCurrency ?? 'USD',
          countryCode: dto.countryCode ?? 'ZW',
          isActive: true,
          legalName: dto.legalName,
          registrationNumber: dto.registrationNumber,
          taxNumber: dto.taxNumber,
          website: dto.website,
          companySize: dto.companySize,
          yearsOperating: dto.yearsOperating,
          description: dto.description,
          businessPhone: dto.businessPhone,
          businessEmail: dto.businessEmail,
          city: dto.city,
        },
      });

      if (accountType === AccountType.INDIVIDUAL && dto.businessName) {
        await tx.individualBusinessProfile.create({
          data: {
            companyId: company.id,
            businessName: dto.businessName,
            primarySector: dto.primarySector,
            businessSize: dto.businessSize,
            serviceAreas: dto.serviceAreas ?? [],
            city: dto.city,
            country: dto.countryCode,
            phone: dto.phone,
            businessEmail: dto.businessEmail,
            registrationNumber: dto.registrationNumber,
            taxNumber: dto.taxNumber,
          },
        });
      }

      await tx.companySettings.create({
        data: {
          companyId: company.id,
          currency: dto.defaultCurrency ?? 'USD',
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
      trialEnd.setDate(trialEnd.getDate() + subConfig.trialDays);

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

      // Seed the tenant with sensible defaults so they can start quoting /
      // logging materials immediately.
      await seedDefaultMaterialCategories(tx, company.id);
      await seedDefaultSuppliers(tx, company.id);

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

      const activateConfig = await this.subscriptionConfigService.getConfig();
      const trialStart = new Date();
      const trialEnd = new Date(trialStart);
      trialEnd.setDate(trialEnd.getDate() + activateConfig.trialDays);

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

    if (
      subscription.status === SubscriptionStatus.ACTIVE &&
      subscription.currentPeriodTo >= new Date()
    ) {
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
    const basePrice = billingCycle === BillingCycle.ANNUAL
      ? Number(platformPlan.annualPrice)
      : Number(platformPlan.monthlyPrice);

    // Apply promo code discount if provided
    let price = basePrice;
    let promoDescription: string | null = null;
    if (dto.promoCode) {
      const promo = await this.promoCodesService.validate(dto.promoCode, companyId);
      if (promo.valid) {
        price = this.promoCodesService.applyDiscount(basePrice, promo.discountType, promo.discountValue);
        promoDescription = promo.description ?? null;
      }
    }

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

      if (dto.promoCode) {
        void this.promoCodesService.redeem(dto.promoCode, companyId);
      }

      void seedWorkspaceDefaults(this.prisma, companyId);

      return {
        status: 'ACTIVE',
        planCode: platformPlan.code,
        planName: platformPlan.name,
        billingCycle,
        currentPeriodTo: periodEnd,
        discount: promoDescription,
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

    if (dto.promoCode) {
      void this.promoCodesService.redeem(dto.promoCode, companyId);
    }

    return {
      status: 'PENDING_PAYMENT',
      planCode: platformPlan.code,
      planName: platformPlan.name,
      billingCycle,
      originalAmount: basePrice,
      amount: price,
      discount: promoDescription,
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

  getOptions() {
    return {
      sectors: CONSTRUCTION_SECTORS,
      projectTypes: CONSTRUCTION_PROJECT_TYPES,
      stakeholders: Object.entries(STAKEHOLDER_TYPES).map(([code, v]) => ({
        code,
        name: v.name,
        description: v.description,
      })),
      workflows: Object.entries(WORKFLOW_TEMPLATES).map(([code, v]) => ({
        code,
        name: v.name,
        description: v.description,
      })),
    };
  }

  async saveOnboardingSetup(companyId: string, dto: OnboardingSetupDto) {
    await this.prisma.$transaction(
      async (tx) => {
        // Sectors
        await tx.tenantSector.deleteMany({ where: { companyId } });
        if (dto.selectedSectors.length > 0) {
          const sectorData = dto.selectedSectors
            .map((code) => CONSTRUCTION_SECTORS.find((s) => s.code === code))
            .filter(Boolean) as { code: string; name: string }[];
          await tx.tenantSector.createMany({
            data: sectorData.map((s) => ({ companyId, code: s.code, name: s.name })),
            skipDuplicates: true,
          });
        }

        // Project types
        await tx.tenantProjectType.deleteMany({ where: { companyId } });
        if (dto.selectedProjectTypes.length > 0) {
          const ptData = dto.selectedProjectTypes
            .map((code) => CONSTRUCTION_PROJECT_TYPES.find((p) => p.code === code))
            .filter(Boolean) as { code: string; name: string }[];
          await tx.tenantProjectType.createMany({
            data: ptData.map((p) => ({ companyId, code: p.code, name: p.name })),
            skipDuplicates: true,
          });
        }

        // Stakeholders → auto-create Roles + Permissions
        await tx.tenantStakeholder.deleteMany({ where: { companyId } });
        for (const type of dto.selectedStakeholders) {
          const def = STAKEHOLDER_TYPES[type];
          if (!def) continue;

          // Skip creating a role if one with this name already exists
          let role = await tx.role.findFirst({ where: { companyId, name: def.name, deletedAt: null } });
          if (!role) {
            role = await tx.role.create({
              data: { companyId, name: def.name, description: def.description, isSystem: false },
            });

            await tx.permission.createMany({
              data: def.permissions.map((key) => ({ companyId, key, description: `Permission: ${key}` })),
              skipDuplicates: true,
            });

            const perms = await tx.permission.findMany({
              where: { companyId, key: { in: def.permissions } },
              select: { id: true },
            });

            await tx.rolePermission.createMany({
              data: perms.map((p) => ({ companyId, roleId: role!.id, permissionId: p.id })),
              skipDuplicates: true,
            });
          }

          await tx.tenantStakeholder.create({
            data: { companyId, type, name: def.name, roleId: role.id },
          });
        }

        // Workflow templates
        await tx.workflowTemplate.deleteMany({ where: { companyId } });
        if (dto.selectedWorkflows.length > 0) {
          await tx.workflowTemplate.createMany({
            data: dto.selectedWorkflows
              .filter((code) => WORKFLOW_TEMPLATES[code])
              .map((code) => ({
                companyId,
                code,
                name: WORKFLOW_TEMPLATES[code].name,
                description: WORKFLOW_TEMPLATES[code].description,
                stages: WORKFLOW_TEMPLATES[code].stages as any,
                isEnabled: true,
              })),
            skipDuplicates: true,
          });
        }
      },
      {
        maxWait: 15000,
        timeout: 45000, // increased to 45s
      },
    );

    return this.getOnboardingSetup(companyId);
  }

  async getOnboardingSetup(companyId: string) {
    const [sectors, projectTypes, stakeholders, workflows] = await Promise.all([
      this.prisma.tenantSector.findMany({ where: { companyId } }),
      this.prisma.tenantProjectType.findMany({ where: { companyId } }),
      this.prisma.tenantStakeholder.findMany({ where: { companyId } }),
      this.prisma.workflowTemplate.findMany({ where: { companyId } }),
    ]);
    return {
      selectedSectors: sectors.map((s) => s.code),
      selectedProjectTypes: projectTypes.map((p) => p.code),
      selectedStakeholders: stakeholders.map((s) => s.type),
      selectedWorkflows: workflows.map((w) => w.code),
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
