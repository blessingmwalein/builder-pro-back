import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SubscriptionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { SubscriptionConfigService } from './subscription-config.service';

@Injectable()
export class SubscriptionReminderService {
  private readonly logger = new Logger(SubscriptionReminderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
    private readonly subscriptionConfigService: SubscriptionConfigService,
  ) {}

  /** Runs every day at 08:00 server time */
  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async sendDailyReminders() {
    const config = await this.subscriptionConfigService.getConfig();
    const now = new Date();

    await Promise.all([
      this.sendTrialReminders(config.trialReminderDays, now),
      this.sendExpiryReminders(config.expiredReminderDays, now),
    ]);
  }

  // ── Trial-ending reminders ─────────────────────────────────────────────────

  private async sendTrialReminders(reminderDays: number[], now: Date) {
    for (const days of reminderDays) {
      const windowStart = this.startOfDay(this.addDays(now, days));
      const windowEnd = this.endOfDay(windowStart);

      const subs = await this.prisma.subscription.findMany({
        where: {
          status: SubscriptionStatus.TRIAL,
          trialEndsAt: { gte: windowStart, lte: windowEnd },
          deletedAt: null,
        },
        include: {
          company: {
            include: {
              users: {
                where: { deletedAt: null },
                orderBy: { createdAt: 'asc' },
                take: 1, // owner is first user created
                select: { email: true, firstName: true },
              },
            },
          },
          platformPlan: { select: { name: true } },
        },
      });

      for (const sub of subs) {
        const owner = sub.company.users[0];
        if (!owner) continue;

        this.logger.log(
          `[reminder] trial_ending → ${owner.email} (${sub.company.name}, ${days}d left)`,
        );
        void this.mailService.sendSubscriptionReminder(owner.email, {
          firstName: owner.firstName,
          companyName: sub.company.name,
          eventType: 'trial_ending',
          daysLeft: days,
          planName: sub.platformPlan?.name,
          upgradeUrl: this.mailService.buildSubscriptionUrl(),
        });
      }
    }
  }

  // ── Subscription expired/expiring reminders ───────────────────────────────

  private async sendExpiryReminders(reminderDays: number[], now: Date) {
    for (const days of reminderDays) {
      const windowStart = this.startOfDay(this.addDays(now, -days));
      const windowEnd = this.endOfDay(windowStart);

      // Subscriptions that expired exactly `days` ago
      const subs = await this.prisma.subscription.findMany({
        where: {
          status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.PAST_DUE] },
          currentPeriodTo: { gte: windowStart, lte: windowEnd },
          deletedAt: null,
        },
        include: {
          company: {
            include: {
              users: {
                where: { deletedAt: null },
                orderBy: { createdAt: 'asc' },
                take: 1,
                select: { email: true, firstName: true },
              },
            },
          },
          platformPlan: { select: { name: true } },
        },
      });

      for (const sub of subs) {
        const owner = sub.company.users[0];
        if (!owner) continue;

        const isExpired = sub.currentPeriodTo < now;
        const eventType = isExpired ? 'subscription_expired' : 'subscription_ending';

        this.logger.log(
          `[reminder] ${eventType} → ${owner.email} (${sub.company.name}, ${days}d ${isExpired ? 'ago' : 'left'})`,
        );
        void this.mailService.sendSubscriptionReminder(owner.email, {
          firstName: owner.firstName,
          companyName: sub.company.name,
          eventType,
          daysLeft: isExpired ? undefined : days,
          daysAgo: isExpired ? days : undefined,
          planName: sub.platformPlan?.name,
          upgradeUrl: this.mailService.buildSubscriptionUrl(),
        });
      }
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private addDays(date: Date, days: number): Date {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
  }

  private startOfDay(date: Date): Date {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  private endOfDay(date: Date): Date {
    const d = new Date(date);
    d.setHours(23, 59, 59, 999);
    return d;
  }
}
