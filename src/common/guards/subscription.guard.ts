import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';

class SubscriptionRequiredException extends HttpException {
  constructor(message: string) {
    super({ statusCode: HttpStatus.PAYMENT_REQUIRED, message, error: 'Payment Required' }, HttpStatus.PAYMENT_REQUIRED);
  }
}
import { Reflector } from '@nestjs/core';
import { SubscriptionStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

/**
 * Enforces that the tenant has an active or valid trial subscription.
 * Skipped on @Public() routes and the /onboarding/* routes.
 */
@Injectable()
export class SubscriptionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const companyId: string | undefined = request.user?.companyId;

    // No company context (e.g. platform-admin routes) — skip
    if (!companyId) return true;

    // Always allow onboarding routes so users can check status / activate.
    // request.route.path is often just the method segment (e.g. "activate-subscription"),
    // so also inspect originalUrl/baseUrl for a reliable controller prefix.
    const routePath = String(request.route?.path ?? '');
    const baseUrl = String(request.baseUrl ?? '');
    const originalUrl = String(request.originalUrl ?? '');
    const isOnboardingRoute =
      routePath.startsWith('/onboarding') ||
      baseUrl.startsWith('/api/v1/onboarding') ||
      baseUrl.startsWith('/onboarding') ||
      originalUrl.includes('/api/v1/onboarding/') ||
      originalUrl.includes('/onboarding/');

    if (isOnboardingRoute) return true;

    const subscription = await this.prisma.subscription.findFirst({
      where: { companyId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      select: { status: true, trialEndsAt: true, currentPeriodTo: true },
    });

    if (!subscription) {
      throw new SubscriptionRequiredException(
        'No subscription found. Please complete your account setup.',
      );
    }

    const now = new Date();

    if (subscription.status === SubscriptionStatus.TRIAL) {
      if (subscription.trialEndsAt && subscription.trialEndsAt < now) {
        throw new SubscriptionRequiredException(
          'Your free trial has expired. Activate a subscription to continue.',
        );
      }
      return true;
    }

    if (subscription.status === SubscriptionStatus.ACTIVE) {
      if (subscription.currentPeriodTo < now) {
        throw new SubscriptionRequiredException(
          'Your subscription has expired. Please renew to continue.',
        );
      }
      return true;
    }

    if (
      subscription.status === SubscriptionStatus.PAST_DUE ||
      subscription.status === SubscriptionStatus.CANCELED
    ) {
      throw new SubscriptionRequiredException(
        'Your subscription is not active. Please update your billing.',
      );
    }

    return true;
  }
}
