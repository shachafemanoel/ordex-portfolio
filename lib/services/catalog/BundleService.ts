import { prisma } from '@/lib/db';
import { createLogger } from '@/lib/logger';

const logger = createLogger({ module: 'BundleService' });

export interface BundleExpandedItem {
  productId: string;
  sku: string;
  name: string;
  quantity: number;
  priceCents: number;
  totalCents: number;
  fromBundleId: string;
  bundleItemId: string;
  isOptional: boolean;
}

export interface BundleDetails {
  id: string;
  name: string;
  sku: string;
  basePriceCents: number | null;
  calculatedPriceCents: number;
  items: {
    id: string;
    productId: string;
    product: {
      id: string;
      name: string;
      sku: string;
      basePriceCents: number | null;
    };
    quantity: number;
    sortOrder: number;
    isOptional: boolean;
    overridePriceCents: number | null;
  }[];
}

/**
 * Service for managing product bundles
 */
export class BundleService {
  /**
   * Get bundle details with all component products
   */
  static async getBundleDetails(bundleId: string): Promise<BundleDetails | null> {
    const bundle = await prisma.product.findFirst({
      where: { id: bundleId, isBundle: true },
      include: {
        bundleItems: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                sku: true,
                basePriceCents: true,
              },
            },
          },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    if (!bundle) return null;

    const calculatedPriceCents = bundle.bundleItems.reduce((total, item) => {
      const itemPrice = item.overridePriceCents ?? item.product.basePriceCents ?? 0;
      return total + itemPrice * item.quantity;
    }, 0);

    return {
      id: bundle.id,
      name: bundle.name,
      sku: bundle.sku,
      basePriceCents: bundle.basePriceCents,
      calculatedPriceCents,
      items: bundle.bundleItems.map((item) => ({
        id: item.id,
        productId: item.productId,
        product: item.product,
        quantity: item.quantity,
        sortOrder: item.sortOrder,
        isOptional: item.isOptional,
        overridePriceCents: item.overridePriceCents,
      })),
    };
  }

  /**
   * Expand a bundle into its component items for order creation
   * @param bundleId - The bundle product ID
   * @param bundleQuantity - How many of the bundle are being ordered
   * @param includeOptional - Whether to include optional items (default: true)
   * @returns Array of expanded order items
   */
  static async expandBundleItems(
    bundleId: string,
    bundleQuantity: number = 1,
    includeOptional: boolean = true
  ): Promise<BundleExpandedItem[]> {
    logger.debug('Expanding bundle', { bundleId, bundleQuantity, includeOptional });

    const bundle = await this.getBundleDetails(bundleId);
    if (!bundle) {
      throw new Error(`Bundle ${bundleId} not found`);
    }

    const expandedItems: BundleExpandedItem[] = [];

    for (const item of bundle.items) {
      // Skip optional items if not including them
      if (item.isOptional && !includeOptional) {
        continue;
      }

      const effectivePriceCents = item.overridePriceCents ?? item.product.basePriceCents ?? 0;
      const itemQuantity = item.quantity * bundleQuantity;
      const totalCents = effectivePriceCents * itemQuantity;

      expandedItems.push({
        productId: item.productId,
        sku: item.product.sku,
        name: item.product.name,
        quantity: itemQuantity,
        priceCents: effectivePriceCents,
        totalCents,
        fromBundleId: bundleId,
        bundleItemId: item.id,
        isOptional: item.isOptional,
      });
    }

    logger.debug('Bundle expanded', {
      bundleId,
      bundleName: bundle.name,
      itemCount: expandedItems.length,
      totalItems: expandedItems.reduce((sum, i) => sum + i.quantity, 0),
    });

    return expandedItems;
  }

  /**
   * Check if a product is a bundle
   */
  static async isBundle(productId: string): Promise<boolean> {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { isBundle: true },
    });

    return product?.isBundle ?? false;
  }

  /**
   * Get all bundles that contain a specific product
   */
  static async getBundlesContainingProduct(productId: string) {
    const bundleItems = await prisma.bundleItem.findMany({
      where: { productId },
      include: {
        bundle: {
          select: {
            id: true,
            name: true,
            sku: true,
            isActive: true,
          },
        },
      },
    });

    return bundleItems.map((item) => ({
      bundleId: item.bundle.id,
      bundleName: item.bundle.name,
      bundleSku: item.bundle.sku,
      isActive: item.bundle.isActive,
      quantityInBundle: item.quantity,
    }));
  }

  /**
   * Calculate available stock for a bundle based on component stock
   * A bundle can only be fulfilled if all required components are in stock
   */
  static async calculateBundleStock(bundleId: string): Promise<number> {
    const bundle = await prisma.product.findFirst({
      where: { id: bundleId, isBundle: true },
      include: {
        bundleItems: {
          where: { isOptional: false }, // Only consider required items
          include: {
            product: {
              select: { stock: true, inventoryEnabled: true },
            },
          },
        },
      },
    });

    if (!bundle || bundle.bundleItems.length === 0) {
      return 0;
    }

    // Find the minimum number of bundles we can create
    let minBundles = Infinity;

    for (const item of bundle.bundleItems) {
      // If inventory is not enabled for component, assume unlimited
      if (!item.product.inventoryEnabled) {
        continue;
      }

      const availableBundles = Math.floor(item.product.stock / item.quantity);
      minBundles = Math.min(minBundles, availableBundles);
    }

    return minBundles === Infinity ? 0 : minBundles;
  }
}
