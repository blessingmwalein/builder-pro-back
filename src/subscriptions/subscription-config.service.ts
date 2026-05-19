import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface SubscriptionConfig {
  id: string;
  trialDays: number;
  gracePeriodDays: number;
  trialReminderDays: number[];
  expiredReminderDays: number[];
}

export class UpdateSubscriptionConfigInput {
  trialDays?: number;
  gracePeriodDays?: number;
  trialReminderDays?: number[];
  expiredReminderDays?: number[];
}

@Injectable()
export class SubscriptionConfigService {
  constructor(private readonly prisma: PrismaService) {}

  async getConfig(): Promise<SubscriptionConfig> {
    let config = await this.prisma.platformSubscriptionConfig.findFirst();
    if (!config) {
      config = await this.prisma.platformSubscriptionConfig.create({
        data: {
          trialDays: 14,
          gracePeriodDays: 0,
          trialReminderDays: [7, 3, 1],
          expiredReminderDays: [1, 3, 7],
        },
      });
    }
    return {
      id: config.id,
      trialDays: config.trialDays,
      gracePeriodDays: config.gracePeriodDays,
      trialReminderDays: config.trialReminderDays as number[],
      expiredReminderDays: config.expiredReminderDays as number[],
    };
  }

  async updateConfig(data: UpdateSubscriptionConfigInput): Promise<SubscriptionConfig> {
    const existing = await this.getConfig();
    const updated = await this.prisma.platformSubscriptionConfig.update({
      where: { id: existing.id },
      data: {
        ...(data.trialDays !== undefined && { trialDays: data.trialDays }),
        ...(data.gracePeriodDays !== undefined && { gracePeriodDays: data.gracePeriodDays }),
        ...(data.trialReminderDays !== undefined && { trialReminderDays: data.trialReminderDays }),
        ...(data.expiredReminderDays !== undefined && { expiredReminderDays: data.expiredReminderDays }),
      },
    });
    return {
      id: updated.id,
      trialDays: updated.trialDays,
      gracePeriodDays: updated.gracePeriodDays,
      trialReminderDays: updated.trialReminderDays as number[],
      expiredReminderDays: updated.expiredReminderDays as number[],
    };
  }
}
