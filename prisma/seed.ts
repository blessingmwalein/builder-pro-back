import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createHash } from 'crypto';
import {
  CONSTRUCTION_SECTORS,
  CONSTRUCTION_PROJECT_TYPES,
  STAKEHOLDER_TYPES,
  WORKFLOW_TEMPLATES,
  DEFAULT_SECTORS,
  DEFAULT_PROJECT_TYPES,
  DEFAULT_STAKEHOLDERS,
  DEFAULT_WORKFLOWS,
} from '../src/onboarding/onboarding.constants';

const prisma = new PrismaClient();

const BASE_PERMISSIONS = [
  'projects.*',
  'tasks.*',
  'timesheets.*',
  'materials.*',
  'quotes.*',
  'invoices.*',
  'financials.*',
  'employees.*',
  'settings.*',
];

const ROLES = [
  'Owner/Admin',
  'Project Manager',
  'Site Supervisor',
  'Worker',
  'Accountant',
  'Client',
];

type PlatformAdminSeedInput = {
  email: string;
  password: string;
  displayName: string;
  apiKey: string;
};

const hashApiKey = (apiKey: string): string =>
  createHash('sha256').update(apiKey).digest('hex');

const parsePlatformAdminSeeds = (): PlatformAdminSeedInput[] => {
  const rawJson = process.env.PLATFORM_ADMIN_SEED_USERS_JSON;

  if (rawJson) {
    try {
      const parsed = JSON.parse(rawJson) as Array<
        Partial<PlatformAdminSeedInput>
      >;

      return parsed
        .filter(
          (item) =>
            typeof item.email === 'string' &&
            typeof item.password === 'string' &&
            typeof item.displayName === 'string' &&
            typeof item.apiKey === 'string',
        )
        .map((item) => ({
          email: item.email!.toLowerCase().trim(),
          password: item.password!.trim(),
          displayName: item.displayName!.trim(),
          apiKey: item.apiKey!.trim(),
        }));
    } catch {
      // eslint-disable-next-line no-console
      console.warn('Invalid PLATFORM_ADMIN_SEED_USERS_JSON, falling back to default platform admin vars');
    }
  }

  const defaultEmail =
    process.env.PLATFORM_ADMIN_DEFAULT_EMAIL ?? 'platform-admin@builderpro.local';
  const defaultPassword =
    process.env.PLATFORM_ADMIN_DEFAULT_PASSWORD ?? 'PlatformAdmin123!';
  const defaultName = process.env.PLATFORM_ADMIN_DEFAULT_NAME ?? 'Platform Admin';
  const defaultApiKey =
    process.env.PLATFORM_ADMIN_DEFAULT_API_KEY ??
    process.env.PLATFORM_ADMIN_KEY ??
    'change-me-platform-admin-key';

  return [
    {
      email: defaultEmail.toLowerCase().trim(),
      password: defaultPassword.trim(),
      displayName: defaultName.trim(),
      apiKey: defaultApiKey.trim(),
    },
  ];
};

async function main() {
  const companyName = process.env.DEFAULT_COMPANY_NAME ?? 'ownit2buildit Demo';
  const companySlug = process.env.DEFAULT_COMPANY_SLUG ?? 'builder-pro-demo';
  const ownerEmail = process.env.DEFAULT_OWNER_EMAIL ?? 'owner@builderpro.local';
  const ownerPassword = process.env.DEFAULT_OWNER_PASSWORD ?? 'ChangeMe123!';

  const company = await prisma.company.upsert({
    where: { slug: companySlug },
    create: {
      companyId: `cmp_${companySlug.replace(/[^a-z0-9]+/gi, '_').toLowerCase()}`,
      name: companyName,
      slug: companySlug,
    },
    update: {
      name: companyName,
    },
  });

  const permissionIds: string[] = [];
  for (const key of BASE_PERMISSIONS) {
    const permission = await prisma.permission.upsert({
      where: {
        companyId_key: {
          companyId: company.id,
          key,
        },
      },
      create: {
        companyId: company.id,
        key,
        description: `${key} access`,
      },
      update: {
        description: `${key} access`,
      },
    });

    permissionIds.push(permission.id);
  }

  let ownerRoleId = '';
  for (const roleName of ROLES) {
    const role = await prisma.role.upsert({
      where: {
        companyId_name: {
          companyId: company.id,
          name: roleName,
        },
      },
      create: {
        companyId: company.id,
        name: roleName,
        isSystem: true,
      },
      update: {},
    });

    if (roleName === 'Owner/Admin') {
      ownerRoleId = role.id;
      for (const permissionId of permissionIds) {
        await prisma.rolePermission.upsert({
          where: {
            companyId_roleId_permissionId: {
              companyId: company.id,
              roleId: role.id,
              permissionId,
            },
          },
          create: {
            companyId: company.id,
            roleId: role.id,
            permissionId,
          },
          update: {},
        });
      }
    }
  }

  const passwordHash = await bcrypt.hash(ownerPassword, 12);
  const owner = await prisma.user.upsert({
    where: {
      companyId_email: {
        companyId: company.id,
        email: ownerEmail,
      },
    },
    create: {
      companyId: company.id,
      email: ownerEmail,
      firstName: 'Platform',
      lastName: 'Owner',
      passwordHash,
      accountType: 'COMPANY',
    },
    update: {
      passwordHash,
      isActive: true,
    },
  });

  await prisma.userRole.upsert({
    where: {
      companyId_userId_roleId: {
        companyId: company.id,
        userId: owner.id,
        roleId: ownerRoleId,
      },
    },
    create: {
      companyId: company.id,
      userId: owner.id,
      roleId: ownerRoleId,
    },
    update: {},
  });

  const platformAdminSeeds = parsePlatformAdminSeeds();
  for (const admin of platformAdminSeeds) {
    const [passwordHash, apiKeyHash] = await Promise.all([
      bcrypt.hash(admin.password, 12),
      Promise.resolve(hashApiKey(admin.apiKey)),
    ]);

    await prisma.platformAdminUser.upsert({
      where: { email: admin.email },
      create: {
        email: admin.email,
        passwordHash,
        displayName: admin.displayName,
        apiKeyHash,
        isActive: true,
      },
      update: {
        passwordHash,
        displayName: admin.displayName,
        apiKeyHash,
        isActive: true,
      },
    });
  }

  // ─── Platform-wide Subscription Plans ───────────────────────────────────
  // Deactivate legacy plans so they no longer appear on the pricing page
  // but existing subscriptions referencing them still resolve.
  await prisma.platformPlan.updateMany({
    where: {
      code: { in: ['SOLE_STARTER', 'SOLE_GROWTH', 'SOLE_PROFESSIONAL', 'SOLE_PRO', 'BUSINESS', 'SMALL_BUSINESS'] },
    },
    data: { isActive: false, sortOrder: 99 },
  });

  // Per-person pricing: monthlyPrice = price per user per month,
  // annualPrice = price per user per year (≈ 10 months, 2 months free).
  // limits.maxUsers caps the team size; limits.perPerson flags the billing model.
  const ALL_PLANS = [
    {
      code: 'SOLE_TRADER',
      name: 'Sole Trader',
      description: 'For independent tradespeople and sole contractors.',
      targetAccountType: 'INDIVIDUAL' as const,
      monthlyPrice: 22,    // per person/month
      annualPrice: 220,    // per person/year (2 months free)
      sortOrder: 1,
      limits: { maxProjects: 20, maxUsers: 5, storageGb: 30, perPerson: true },
      features: [
        '$22/person/month · up to 5 users',
        '20 active projects',
        '30 GB document storage',
        'Quotes & invoices',
        'Material & time tracking',
        'Client portal access',
      ],
    },
    {
      code: 'TEAM',
      name: 'Team',
      description: 'For small construction companies managing multiple projects.',
      targetAccountType: 'COMPANY' as const,
      monthlyPrice: 19,    // per person/month
      annualPrice: 190,    // per person/year
      sortOrder: 2,
      limits: { maxProjects: 50, maxUsers: 10, storageGb: 100, perPerson: true },
      features: [
        '$19/person/month · up to 10 users',
        '50 active projects',
        '100 GB storage',
        'Team time tracking & approval',
        'Quotes, variations & invoices',
        'Budget & financial control',
        'CRM & messaging',
        'Reporting & exports',
      ],
    },
    {
      code: 'ENTERPRISE',
      name: 'Enterprise',
      description: 'Full platform access for large construction businesses.',
      targetAccountType: 'COMPANY' as const,
      monthlyPrice: 17,    // per person/month
      annualPrice: 170,    // per person/year
      sortOrder: 3,
      limits: { maxProjects: -1, maxUsers: 50, storageGb: -1, perPerson: true, extraUsersByRequest: true },
      features: [
        '$17/person/month · up to 50 users',
        'Additional users available on request',
        'Unlimited projects',
        'Unlimited storage',
        'Priority support & SLA',
        'Custom integrations',
        'White-label options',
        'Dedicated account manager',
      ],
    },
  ];

  for (const plan of ALL_PLANS) {
    await prisma.platformPlan.upsert({
      where: { code: plan.code },
      create: {
        code: plan.code,
        name: plan.name,
        description: plan.description,
        targetAccountType: plan.targetAccountType,
        monthlyPrice: plan.monthlyPrice,
        annualPrice: plan.annualPrice,
        sortOrder: plan.sortOrder,
        limits: plan.limits,
        features: plan.features,
        isActive: true,
      },
      update: {
        name: plan.name,
        description: plan.description,
        targetAccountType: plan.targetAccountType,
        monthlyPrice: plan.monthlyPrice,
        annualPrice: plan.annualPrice,
        sortOrder: plan.sortOrder,
        limits: plan.limits,
        features: plan.features,
        isActive: true,
      },
    });
  }

  // ─── Subscription Config (singleton) ─────────────────────────────────────
  const existingConfig = await prisma.platformSubscriptionConfig.findFirst();
  if (!existingConfig) {
    await prisma.platformSubscriptionConfig.create({
      data: {
        trialDays: 14,
        gracePeriodDays: 0,
        trialReminderDays: [7, 3, 1],
        expiredReminderDays: [1, 3, 7],
      },
    });
  }

  // eslint-disable-next-line no-console
  console.log(`Seed complete for company ${company.slug} and owner ${owner.email}`);
  // eslint-disable-next-line no-console
  console.log(`Seeded ${platformAdminSeeds.length} platform admin user(s)`);
  // eslint-disable-next-line no-console
  console.log(`Seeded ${ALL_PLANS.length} platform subscription plans`);
}

async function backfillExistingAccounts() {
  const companies = await prisma.company.findMany({
    where: { deletedAt: null },
    select: { id: true, slug: true },
  });

  let count = 0;
  for (const company of companies) {
    const companyId = company.id;

    // CompanySettings
    const existingSettings = await (prisma as any).companySettings.findUnique({ where: { companyId } });
    if (!existingSettings) {
      await (prisma as any).companySettings.create({ data: { companyId } });
    }

    // Default sectors
    await (prisma as any).tenantSector.createMany({
      data: DEFAULT_SECTORS
        .map((code: string) => CONSTRUCTION_SECTORS.find((s) => s.code === code)!)
        .map((s: { code: string; name: string }) => ({ companyId, code: s.code, name: s.name })),
      skipDuplicates: true,
    });

    // Default project types
    await (prisma as any).tenantProjectType.createMany({
      data: DEFAULT_PROJECT_TYPES
        .map((code: string) => CONSTRUCTION_PROJECT_TYPES.find((p) => p.code === code)!)
        .map((p: { code: string; name: string }) => ({ companyId, code: p.code, name: p.name })),
      skipDuplicates: true,
    });

    // Default stakeholders
    for (const type of DEFAULT_STAKEHOLDERS) {
      const def = STAKEHOLDER_TYPES[type];
      if (!def) continue;
      const existing = await (prisma as any).tenantStakeholder.findFirst({ where: { companyId, type } });
      if (existing) continue;
      let role = await prisma.role.findFirst({ where: { companyId, name: def.name, deletedAt: null } });
      if (!role) {
        role = await prisma.role.create({
          data: { companyId, name: def.name, description: def.description, isSystem: false },
        });
      }
      await (prisma as any).tenantStakeholder.create({
        data: { companyId, type, name: def.name, roleId: role.id },
      });
    }

    // Default workflow templates
    await (prisma as any).workflowTemplate.createMany({
      data: DEFAULT_WORKFLOWS
        .filter((code: string) => WORKFLOW_TEMPLATES[code])
        .map((code: string) => ({
          companyId,
          code,
          name: WORKFLOW_TEMPLATES[code].name,
          description: WORKFLOW_TEMPLATES[code].description,
          stages: WORKFLOW_TEMPLATES[code].stages,
          isEnabled: true,
        })),
      skipDuplicates: true,
    });

    count++;
  }

  // eslint-disable-next-line no-console
  console.log(`Back-filled ${count} existing company workspace(s)`);
}

main()
  .then(() => backfillExistingAccounts())
  .catch(async (error) => {
    // eslint-disable-next-line no-console
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
