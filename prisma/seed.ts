import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createHash } from 'crypto';

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
  const PLATFORM_PLANS = [
    {
      code: 'STARTER',
      name: 'Starter',
      description: 'Perfect for freelancers and sole traders managing a few projects.',
      targetAccountType: 'INDIVIDUAL' as const,
      monthlyPrice: 0,
      annualPrice: 0,
      sortOrder: 1,
      limits: { maxProjects: 3, maxUsers: 1, storageGb: 1 },
      features: [
        '3 active projects',
        '1 user seat',
        '1 GB storage',
        'Basic time tracking',
        'Invoice generation',
      ],
    },
    {
      code: 'INDIVIDUAL_PRO',
      name: 'Individual Pro',
      description: 'For independent contractors who need full power without a team.',
      targetAccountType: 'INDIVIDUAL' as const,
      monthlyPrice: 9.99,
      annualPrice: 99,
      sortOrder: 2,
      limits: { maxProjects: 10, maxUsers: 1, storageGb: 10 },
      features: [
        '10 active projects',
        '1 user seat',
        '10 GB storage',
        'Full time tracking & payroll export',
        'Quotes & invoices',
        'Material management',
        'Reporting',
      ],
    },
    {
      code: 'SMALL_BUSINESS',
      name: 'Small Business',
      description: 'Ideal for small construction companies with up to 10 staff.',
      targetAccountType: 'COMPANY' as const,
      monthlyPrice: 29.99,
      annualPrice: 299,
      sortOrder: 3,
      limits: { maxProjects: 20, maxUsers: 10, storageGb: 50 },
      features: [
        '20 active projects',
        'Up to 10 user seats',
        '50 GB storage',
        'Team time tracking & approval',
        'Quotes, variations & invoices',
        'Budget & financial control',
        'CRM (clients & leads)',
        'Messaging',
        'Reporting',
      ],
    },
    {
      code: 'BUSINESS',
      name: 'Business',
      description: 'For growing companies managing multiple large projects and teams.',
      targetAccountType: 'COMPANY' as const,
      monthlyPrice: 79.99,
      annualPrice: 799,
      sortOrder: 4,
      limits: { maxProjects: -1, maxUsers: 50, storageGb: 200 },
      features: [
        'Unlimited projects',
        'Up to 50 user seats',
        '200 GB storage',
        'Everything in Small Business',
        'Advanced reporting & exports',
        'PayNow / EcoCash billing integration',
        'Subscription payment management',
      ],
    },
    {
      code: 'ENTERPRISE',
      name: 'Enterprise',
      description: 'Full platform access for large construction businesses.',
      targetAccountType: null,
      monthlyPrice: 199.99,
      annualPrice: 1999,
      sortOrder: 5,
      limits: { maxProjects: -1, maxUsers: -1, storageGb: -1 },
      features: [
        'Unlimited projects',
        'Unlimited user seats',
        'Unlimited storage',
        'Everything in Business',
        'Priority support',
        'Custom integrations',
        'White-label options',
      ],
    },
  ];

  for (const plan of PLATFORM_PLANS) {
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

  // eslint-disable-next-line no-console
  console.log(`Seed complete for company ${company.slug} and owner ${owner.email}`);
  // eslint-disable-next-line no-console
  console.log(`Seeded ${platformAdminSeeds.length} platform admin user(s)`);
  // eslint-disable-next-line no-console
  console.log(`Seeded ${PLATFORM_PLANS.length} platform subscription plans`);
}

main()
  .catch(async (error) => {
    // eslint-disable-next-line no-console
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
