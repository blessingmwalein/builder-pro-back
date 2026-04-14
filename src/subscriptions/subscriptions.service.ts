import { Injectable, NotFoundException } from '@nestjs/common';
import { SubscriptionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ChangePlanDto } from './dto/change-plan.dto';

@Injectable()
export class SubscriptionsService {
  constructor(private readonly prisma: PrismaService) {}

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

  async current(companyId: string) {
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

    const platformPlan = subscription.platformPlan;

    return {
      status: isTrialExpired ? 'TRIAL_EXPIRED' : subscription.status,
      planCode: platformPlan?.code ?? null,
      planName: platformPlan?.name ?? null,
      description: platformPlan?.description ?? null,
      billingCycle: subscription.billingCycle,
      currentPeriodFrom: subscription.currentPeriodFrom,
      currentPeriodTo: subscription.currentPeriodTo,
      trialEndsAt: subscription.trialEndsAt,
      trialDaysLeft: subscription.status === SubscriptionStatus.TRIAL ? daysLeft : null,
      limits: (platformPlan?.limits ?? {}) as any,
      features: platformPlan?.features ?? [],
      isExpired: isTrialExpired || (
        subscription.status === SubscriptionStatus.ACTIVE && subscription.currentPeriodTo < now
      ),
    };
  }

  async changePlan(companyId: string, dto: ChangePlanDto) {
    const platformPlan = await this.prisma.platformPlan.findFirst({
      where: { code: dto.planCode, isActive: true, deletedAt: null },
    });

    if (!platformPlan) {
      throw new NotFoundException('Plan not found');
    }

    // Upsert the company-local plan mirror (required by Subscription FK)
    const localPlan = await this.prisma.subscriptionPlan.upsert({
      where: { companyId_code: { companyId, code: platformPlan.code } },
      create: {
        companyId,
        code: platformPlan.code,
        name: platformPlan.name,
        monthlyPrice: platformPlan.monthlyPrice,
        annualPrice: platformPlan.annualPrice,
        limits: platformPlan.limits as any,
        isActive: true,
      },
      update: {
        name: platformPlan.name,
        monthlyPrice: platformPlan.monthlyPrice,
        annualPrice: platformPlan.annualPrice,
        limits: platformPlan.limits as any,
        isActive: true,
        deletedAt: null,
      },
    });

    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    await this.prisma.subscription.create({
      data: {
        companyId,
        planId: localPlan.id,
        platformPlanId: platformPlan.id,
        status: SubscriptionStatus.ACTIVE,
        billingCycle: 'MONTHLY',
        currentPeriodFrom: now,
        currentPeriodTo: periodEnd,
      },
    });

    return this.current(companyId);
  }
}
