import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PromoDiscountType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface CreatePromoCodeInput {
  code: string;
  description?: string;
  discountType: PromoDiscountType;
  discountValue: number;
  maxUses?: number;
  expiresAt?: string; // ISO date string
}

export interface ValidatePromoResult {
  valid: boolean;
  discountType: PromoDiscountType;
  discountValue: number;
  description?: string | null;
  message?: string;
}

@Injectable()
export class PromoCodesService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Admin CRUD ─────────────────────────────────────────────────────────────

  async list(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.promoCode.findMany({
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: { _count: { select: { redemptions: true } } },
      }),
      this.prisma.promoCode.count({ where: { deletedAt: null } }),
    ]);
    return { items, total, page, limit };
  }

  async create(data: CreatePromoCodeInput) {
    const upper = data.code.trim().toUpperCase();
    const existing = await this.prisma.promoCode.findUnique({ where: { code: upper } });
    if (existing && !existing.deletedAt) {
      throw new BadRequestException(`Promo code '${upper}' already exists.`);
    }

    if (data.discountType === PromoDiscountType.PERCENTAGE) {
      if (data.discountValue <= 0 || data.discountValue > 100) {
        throw new BadRequestException('Percentage discount must be between 1 and 100.');
      }
    } else if (data.discountValue <= 0) {
      throw new BadRequestException('Discount value must be greater than 0.');
    }

    return this.prisma.promoCode.create({
      data: {
        code: upper,
        description: data.description ?? null,
        discountType: data.discountType,
        discountValue: data.discountValue,
        maxUses: data.maxUses ?? null,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
        isActive: true,
      },
    });
  }

  async toggle(id: string, isActive: boolean) {
    const promo = await this.prisma.promoCode.findFirst({
      where: { id, deletedAt: null },
    });
    if (!promo) throw new NotFoundException('Promo code not found.');
    return this.prisma.promoCode.update({ where: { id }, data: { isActive } });
  }

  async remove(id: string) {
    const promo = await this.prisma.promoCode.findFirst({
      where: { id, deletedAt: null },
    });
    if (!promo) throw new NotFoundException('Promo code not found.');
    return this.prisma.promoCode.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
  }

  // ── Public validation (called from onboarding before payment) ─────────────

  async validate(code: string, companyId: string): Promise<ValidatePromoResult> {
    const upper = code.trim().toUpperCase();
    const promo = await this.prisma.promoCode.findFirst({
      where: { code: upper, isActive: true, deletedAt: null },
    });

    if (!promo) {
      return { valid: false, discountType: PromoDiscountType.PERCENTAGE, discountValue: 0, message: 'Invalid or expired promo code.' };
    }

    if (promo.expiresAt && promo.expiresAt < new Date()) {
      return { valid: false, discountType: PromoDiscountType.PERCENTAGE, discountValue: 0, message: 'This promo code has expired.' };
    }

    if (promo.maxUses !== null && promo.usedCount >= promo.maxUses) {
      return { valid: false, discountType: PromoDiscountType.PERCENTAGE, discountValue: 0, message: 'This promo code has reached its usage limit.' };
    }

    // Check if this company already used it
    const alreadyUsed = await this.prisma.promoCodeRedemption.findUnique({
      where: { promoCodeId_companyId: { promoCodeId: promo.id, companyId } },
    });
    if (alreadyUsed) {
      return { valid: false, discountType: PromoDiscountType.PERCENTAGE, discountValue: 0, message: 'Your account has already used this promo code.' };
    }

    return {
      valid: true,
      discountType: promo.discountType,
      discountValue: Number(promo.discountValue),
      description: promo.description,
    };
  }

  // ── Called inside activateSubscription after successful payment ───────────

  async redeem(code: string, companyId: string): Promise<void> {
    const upper = code.trim().toUpperCase();
    const promo = await this.prisma.promoCode.findFirst({
      where: { code: upper, isActive: true, deletedAt: null },
    });
    if (!promo) return;

    await this.prisma.$transaction([
      this.prisma.promoCode.update({
        where: { id: promo.id },
        data: { usedCount: { increment: 1 } },
      }),
      this.prisma.promoCodeRedemption.upsert({
        where: { promoCodeId_companyId: { promoCodeId: promo.id, companyId } },
        create: { promoCodeId: promo.id, companyId },
        update: {},
      }),
    ]);
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  applyDiscount(originalAmount: number, discountType: PromoDiscountType, discountValue: number): number {
    if (discountType === PromoDiscountType.PERCENTAGE) {
      return Math.max(0, originalAmount * (1 - discountValue / 100));
    }
    return Math.max(0, originalAmount - discountValue);
  }
}
