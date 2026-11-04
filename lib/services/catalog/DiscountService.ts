import { prisma } from '@/lib/db';
import { createLogger } from '@/lib/logger';
import type { DiscountType, DiscountValueType } from '@prisma/client';

const logger = createLogger({ module: 'DiscountService' });

export interface DiscountValidationResult {
  valid: boolean;
  discount: {
    id: string;
    code: string | null;
    name: string;
    type: DiscountType;
    valueType: DiscountValueType;
    value: number;
  } | null;
  calculatedDiscountCents: number;
  reason: string | null;
}

export interface OrderDiscountContext {
  orderId?: string;
  customerId?: string;
  orderTotalCents: number;
  items?: {
    productId: string;
    priceCents: number;
    quantity: number;
  }[];
}

/**
 * Service for managing discounts and promotions
 */
export class DiscountService {
  /**
   * Validate a discount code and calculate the discount amount
   */
  static async validateDiscount(
    code: string,
    context: OrderDiscountContext
  ): Promise<DiscountValidationResult> {
    logger.debug('Validating discount', { code, orderTotalCents: context.orderTotalCents });

    const buildResult = (
      valid: boolean,
      reason: string | null,
      discountData: any = null,
      calculatedCents: number = 0
    ): DiscountValidationResult => ({
      valid,
      discount: discountData
        ? {
            id: discountData.id,
            code: discountData.code,
            name: discountData.name,
            type: discountData.type,
            valueType: discountData.valueType,
            value: Number(discountData.value),
          }
        : null,
      calculatedDiscountCents: calculatedCents,
      reason,
    });

    // Find discount by code
    const discount = await prisma.discount.findFirst({
      where: { code },
      include: {
        applicableProducts: {
          select: { productId: true },
        },
      },
    });

    if (!discount) {
      return buildResult(false, 'Discount code not found');
    }

    if (!discount.isActive) {
      return buildResult(false, 'Discount is not active');
    }

    const now = new Date();

    // Check start date
    if (discount.startsAt && new Date(discount.startsAt) > now) {
      return buildResult(false, 'Discount is not yet active');
    }

    // Check expiry
    if (discount.expiresAt && new Date(discount.expiresAt) < now) {
      return buildResult(false, 'Discount has expired');
    }

    // Check global usage limit
    if (discount.usageLimit && discount.usageCount >= discount.usageLimit) {
      return buildResult(false, 'Discount usage limit reached');
    }

    // Check per-user usage limit
    if (context.customerId && discount.usageLimitPerUser) {
      const customerUsageCount = await prisma.discountUsage.count({
        where: {
          discountId: discount.id,
          customerId: context.customerId,
        },
      });

      if (customerUsageCount >= discount.usageLimitPerUser) {
        return buildResult(
          false,
          'You have already used this discount the maximum number of times'
        );
      }
    }

    // Check minimum order amount
    if (discount.minOrderCents && context.orderTotalCents < discount.minOrderCents) {
      const minAmount = (discount.minOrderCents / 100).toFixed(2);
      return buildResult(false, `Minimum order amount of ${minAmount} ILS required`);
    }

    // Calculate applicable products total if discount applies to specific products
    let applicableProductsCents = context.orderTotalCents;
    if (!discount.appliesToAll && context.items?.length) {
      const applicableProductIds = discount.applicableProducts.map((ap) => ap.productId);
      const matchingItems = context.items.filter((item) =>
        applicableProductIds.includes(item.productId)
      );

      if (matchingItems.length === 0) {
        return buildResult(false, 'Discount does not apply to any products in your cart');
      }

      applicableProductsCents = matchingItems.reduce(
        (sum, item) => sum + item.priceCents * item.quantity,
        0
      );
    }

    // Calculate discount amount
    const calculatedDiscountCents = this.calculateDiscountAmount(
      discount,
      context.orderTotalCents,
      applicableProductsCents
    );

    logger.debug('Discount validated successfully', {
      code,
      calculatedDiscountCents,
      type: discount.type,
      valueType: discount.valueType,
    });

    return buildResult(true, null, discount, calculatedDiscountCents);
  }

  /**
   * Calculate the discount amount based on the discount type and value
   */
  private static calculateDiscountAmount(
    discount: {
      valueType: DiscountValueType;
      value: any; // Decimal from Prisma
      maxDiscountCents: number | null;
      appliesToAll: boolean;
    },
    orderTotalCents: number,
    applicableProductsCents: number
  ): number {
    const baseAmount = discount.appliesToAll ? orderTotalCents : applicableProductsCents;
    const discountValue = Number(discount.value);
    let discountCents = 0;

    switch (discount.valueType) {
      case 'PERCENTAGE':
        discountCents = Math.round((baseAmount * discountValue) / 100);
        break;
      case 'FIXED_AMOUNT':
        // Value is in currency units (e.g., 50 ILS)
        discountCents = Math.round(discountValue * 100);
        break;
      case 'FIXED_PRICE':
        // For fixed price, discount is the difference between total and fixed price
        discountCents = Math.max(0, baseAmount - Math.round(discountValue * 100));
        break;
    }

    // Apply maximum discount cap if set
    if (discount.maxDiscountCents && discountCents > discount.maxDiscountCents) {
      discountCents = discount.maxDiscountCents;
    }

    // Ensure discount doesn't exceed order total
    if (discountCents > orderTotalCents) {
      discountCents = orderTotalCents;
    }

    return discountCents;
  }

  /**
   * Apply a discount to an order - validates and records usage
   */
  static async applyDiscountToOrder(
    code: string,
    context: OrderDiscountContext
  ): Promise<DiscountValidationResult> {
    const validation = await this.validateDiscount(code, context);

    if (!validation.valid || !validation.discount) {
      return validation;
    }

    // Record usage
    await prisma.$transaction(async (tx) => {
      // Increment usage count
      await tx.discount.update({
        where: { id: validation.discount!.id },
        data: {
          usageCount: { increment: 1 },
        },
      });

      // Create usage record
      await tx.discountUsage.create({
        data: {
          discountId: validation.discount!.id,
          orderId: context.orderId,
          customerId: context.customerId,
          amountCents: validation.calculatedDiscountCents,
        },
      });

      // Update order with discount info if orderId provided
      if (context.orderId) {
        await tx.order.update({
          where: { id: context.orderId },
          data: {
            discountCents: validation.calculatedDiscountCents,
            discountCode: code,
            discountId: validation.discount!.id,
          },
        });
      }
    });

    logger.info('Discount applied to order', {
      discountId: validation.discount.id,
      orderId: context.orderId,
      amountCents: validation.calculatedDiscountCents,
    });

    return validation;
  }

  /**
   * Remove a discount from an order
   */
  static async removeDiscountFromOrder(orderId: string): Promise<void> {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { discountId: true, discountCents: true },
    });

    if (!order || !order.discountId) {
      return;
    }

    await prisma.$transaction(async (tx) => {
      // Find and delete the usage record
      await tx.discountUsage.deleteMany({
        where: {
          discountId: order.discountId!,
          orderId,
        },
      });

      // Decrement usage count
      await tx.discount.update({
        where: { id: order.discountId! },
        data: {
          usageCount: { decrement: 1 },
        },
      });

      // Clear discount info from order
      await tx.order.update({
        where: { id: orderId },
        data: {
          discountCents: 0,
          discountCode: null,
          discountId: null,
        },
      });
    });

    logger.info('Discount removed from order', { orderId });
  }

  /**
   * Get all active discounts
   */
  static async getActiveDiscounts() {
    const now = new Date();

    return prisma.discount.findMany({
      where: {
        isActive: true,
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
          { OR: [{ expiresAt: null }, { expiresAt: { gte: now } }] },
        ],
      },
      include: {
        applicableProducts: {
          select: { productId: true },
        },
        _count: {
          select: { usages: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get automatic discounts that apply to an order
   */
  static async getAutomaticDiscounts(context: OrderDiscountContext) {
    const now = new Date();

    const automaticDiscounts = await prisma.discount.findMany({
      where: {
        isActive: true,
        type: 'AUTOMATIC',
        OR: [{ startsAt: null }, { startsAt: { lte: now } }],
        AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gte: now } }] }],
      },
      include: {
        applicableProducts: {
          select: { productId: true },
        },
      },
    });

    const applicableDiscounts = [];

    for (const discount of automaticDiscounts) {
      // Check minimum order amount
      if (discount.minOrderCents && context.orderTotalCents < discount.minOrderCents) {
        continue;
      }

      // Check usage limits
      if (discount.usageLimit && discount.usageCount >= discount.usageLimit) {
        continue;
      }

      // Check product applicability
      if (!discount.appliesToAll && context.items?.length) {
        const applicableProductIds = discount.applicableProducts.map((ap) => ap.productId);
        const hasApplicableProduct = context.items.some((item) =>
          applicableProductIds.includes(item.productId)
        );
        if (!hasApplicableProduct) {
          continue;
        }
      }

      applicableDiscounts.push(discount);
    }

    return applicableDiscounts;
  }
}
