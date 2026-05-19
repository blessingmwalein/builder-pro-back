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
  const companyName = process.env.DEFAULT_COMPANY_NAME ?? 'Builder Pro Demo';
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
  // Individual / sole contractor plans
  const INDIVIDUAL_PLANS = [
    {
      code: 'SOLE_STARTER',
      name: 'Sole Starter',
      description: 'For independent tradespeople managing small repairs and renovations.',
      targetAccountType: 'INDIVIDUAL' as const,
      monthlyPrice: 19,
      annualPrice: 182,
      sortOrder: 1,
      limits: { maxProjects: 8, maxUsers: 2, storageGb: 10 },
      features: [
        'Up to 2 user seats',
        '8 active projects',
        '10 GB document storage',
        'Quotes & invoices',
        'Material tracking',
        'Time & attendance logging',
        'Client portal access',
      ],
    },
    {
      code: 'SOLE_GROWTH',
      name: 'Sole Growth',
      description: 'For growing independent contractors taking on larger or multiple projects.',
      targetAccountType: 'INDIVIDUAL' as const,
      monthlyPrice: 39,
      annualPrice: 374,
      sortOrder: 2,
      limits: { maxProjects: 25, maxUsers: 5, storageGb: 30 },
      features: [
        'Up to 5 user seats',
        '25 active projects',
        '30 GB document storage',
        'Quotes, variations & invoices',
        'Budget & financial control',
        'Subcontractor management',
        'Advanced reporting',
        'Everything in Sole Starter',
      ],
    },
    {
      code: 'SOLE_PROFESSIONAL',
      name: 'Sole Professional',
      description: 'For established contractors managing large-scale projects and teams.',
      targetAccountType: 'INDIVIDUAL' as const,
      monthlyPrice: 59,
      annualPrice: 566,
      sortOrder: 3,
      limits: { maxProjects: 50, maxUsers: 10, storageGb: 100 },
      features: [
        'Up to 10 user seats',
        '50 active projects',
        '100 GB document storage',
        'Priority support',
        'Custom workflow templates',
        'Everything in Sole Growth',
      ],
    },
    // Backward-compat alias for SOLE_GROWTH
    {
      code: 'SOLE_PRO',
      name: 'Sole Pro',
      description: 'Legacy plan — equivalent to Sole Growth.',
      targetAccountType: 'INDIVIDUAL' as const,
      monthlyPrice: 39,
      annualPrice: 374,
      sortOrder: 99,
      limits: { maxProjects: 25, maxUsers: 5, storageGb: 30 },
      features: [],
    },
  ];

  // Company plans
  const PLATFORM_PLANS = [
    {
      code: 'TEAM',
      name: 'Team',
      description: 'For small construction companies with up to 15 staff.',
      targetAccountType: 'COMPANY' as const,
      monthlyPrice: 79,
      annualPrice: 758,
      sortOrder: 4,
      limits: { maxProjects: 50, maxUsers: 15, storageGb: 100 },
      features: [
        'Up to 15 user seats',
        '50 active projects',
        '100 GB storage',
        'Team time tracking & approval',
        'Quotes, variations & invoices',
        'Budget & financial control',
        'CRM',
        'Messaging & reporting',
      ],
    },
    {
      code: 'BUSINESS',
      name: 'Business',
      description: 'For growing companies managing multiple large projects and teams.',
      targetAccountType: 'COMPANY' as const,
      monthlyPrice: 149,
      annualPrice: 1430,
      sortOrder: 5,
      limits: { maxProjects: 200, maxUsers: 50, storageGb: 500 },
      features: [
        'Up to 50 user seats',
        '200 active projects',
        '500 GB storage',
        'Advanced reporting & exports',
        'Priority email support',
        'Everything in Team',
      ],
    },
    {
      code: 'ENTERPRISE',
      name: 'Enterprise',
      description: 'Full platform access for large construction businesses.',
      targetAccountType: 'COMPANY' as const,
      monthlyPrice: 299,
      annualPrice: 2870,
      sortOrder: 6,
      limits: { maxProjects: -1, maxUsers: -1, storageGb: -1 },
      features: [
        'Unlimited user seats',
        'Unlimited projects',
        'Unlimited storage (2 TB base)',
        'Priority support & SLA',
        'Custom integrations',
        'White-label options',
        'Everything in Business',
      ],
    },
    // Backward-compat alias for TEAM
    {
      code: 'SMALL_BUSINESS',
      name: 'Small Business',
      description: 'Legacy plan — equivalent to Team.',
      targetAccountType: 'COMPANY' as const,
      monthlyPrice: 70,
      annualPrice: 672,
      sortOrder: 98,
      limits: { maxProjects: 20, maxUsers: 10, storageGb: 50 },
      features: [],
    },
  ];

  const ALL_PLANS = [...INDIVIDUAL_PLANS, ...PLATFORM_PLANS];

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
  console.log(`Seeded ${ALL_PLANS.length} platform subscription plans (${INDIVIDUAL_PLANS.length} individual, ${PLATFORM_PLANS.length} company)`);
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
