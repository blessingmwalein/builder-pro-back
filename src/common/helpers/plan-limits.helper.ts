import { ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export async function enforcePlanLimit(
  prisma: PrismaService,
  companyId: string,
  resource: 'projects' | 'users',
) {
  const subscription = await prisma.subscription.findFirst({
    where: { companyId, deletedAt: null },
    orderBy: { createdAt: 'desc' },
    include: { platformPlan: { select: { limits: true, name: true } } },
  });

  if (!subscription?.platformPlan) return; // no platform plan linked — no enforcement

  const limits = subscription.platformPlan.limits as any;
  const max: number = limits?.[`max${resource.charAt(0).toUpperCase() + resource.slice(1)}`] ?? -1;

  if (max === -1) return; // unlimited

  let current = 0;
  if (resource === 'projects') {
    current = await prisma.project.count({
      where: { companyId, deletedAt: null, status: { not: 'ARCHIVED' } },
    });
  } else if (resource === 'users') {
    current = await prisma.user.count({
      where: { companyId, deletedAt: null, isActive: true },
    });
  }

  if (current >= max) {
    throw new ForbiddenException(
      `Your ${subscription.platformPlan.name} plan allows a maximum of ${max} ${resource}. ` +
        `Upgrade your plan to add more.`,
    );
  }
}
