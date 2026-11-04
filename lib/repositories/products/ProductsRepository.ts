import { databaseTenantId } from '@/lib/tenancy/context';
import { CacheService } from '@/lib/cache/CacheService';
import { getPrismaClient } from '@/lib/db';
import { Logger } from '@/lib/logger';
import { Prisma, ProcurementType, ProductType, SerialNumberType } from '@prisma/client';
import { BaseRepository } from '@/lib/repositories/base/BaseRepository';

export interface ProductCreateInput {
  name: string;
  sku: string;
  description?: string;
  shortDescription?: string;
  imageUrl?: string;
  basePriceCents?: number;
  stock?: number;
  reorderLevel?: number;
  isActive?: boolean;
  defaultSupplierId?: string;
  inventoryEnabled?: boolean;
  procurementRequired?: boolean;
  serialNumberType?: SerialNumberType;
  // New fields
  type?: 'SIMPLE' | 'BUNDLE' | 'SERVICE' | 'VARIABLE';
  procurementType?: 'INVENTORY' | 'DROPSHIP' | 'SPECIAL_ORDER';
  installationRequired?: boolean;
  isDiscountable?: boolean;
  wordpressId?: string;
  categoryIds?: string[];
  tagIds?: string[];
  bundleItems?: { childId: string; quantity: number }[];
}

export class ProductsRepository extends BaseRepository<any, any, any, any> {
  constructor(cache: CacheService, logger: Logger) {
    super('Product', cache, logger);
  }

  protected getDefaultInclude() {
    return {};
  }

  protected buildWhereClause(filters: any) {
    return {};
  }

  /**
   * Create a new product
   */
  async createProduct(data: ProductCreateInput, tx?: Prisma.TransactionClient): Promise<any> {
    const prisma = tx || getPrismaClient();

    const product = await prisma.product.create({
      data: {
        name: data.name,
        sku: data.sku,
        description: data.description,
        shortDescription: data.shortDescription,
        imageUrl: data.imageUrl,
        basePriceCents: data.basePriceCents,
        stock: data.stock ?? 0,
        reorderLevel: data.reorderLevel ?? 0,
        isActive: data.isActive ?? true,
        defaultSupplierId: data.defaultSupplierId,
        // New fields
        type: data.type ?? 'SIMPLE',
        procurementType: data.procurementType ?? 'INVENTORY',
        installationRequired: data.installationRequired ?? false,
        isDiscountable: data.isDiscountable ?? true,
        wordpressId: data.wordpressId,
        // Legacy/Deprecated compatibility
        inventoryEnabled: data.procurementType === 'INVENTORY',
        procurementRequired: data.procurementType !== 'INVENTORY',
        serialNumberType: data.serialNumberType ?? 'NONE',
        categories: data.categoryIds
          ? {
              connect: data.categoryIds.map((id) => ({ id })),
            }
          : undefined,
        tags: data.tagIds
          ? {
              connect: data.tagIds.map((id) => ({ id })),
            }
          : undefined,
        bundleItems: data.bundleItems
          ? {
              create: data.bundleItems.map((item) => ({
                product: { connect: { id: item.childId } },
                quantity: item.quantity,
              })),
            }
          : undefined,
      },
      include: this.getDefaultInclude(),
    });

    this.logger.info('Product created', { productId: product.id, sku: data.sku });

    // Invalidate cache
    await this.cache.invalidate(`${this.modelName}:list:*`);

    return product;
  }

  /**
   * Update a product
   */
  async updateProduct(
    id: string,
    data: Partial<ProductCreateInput>,
    tx?: Prisma.TransactionClient
  ): Promise<any> {
    const prisma = tx || getPrismaClient();

    const product = await prisma.product.update({
      where: { id },
      data: {
        name: data.name,
        sku: data.sku,
        description: data.description,
        shortDescription: data.shortDescription,
        imageUrl: data.imageUrl,
        basePriceCents: data.basePriceCents,
        stock: data.stock,
        reorderLevel: data.reorderLevel,
        isActive: data.isActive,
        defaultSupplierId: data.defaultSupplierId,
        type: data.type,
        procurementType: data.procurementType,
        installationRequired: data.installationRequired,
        isDiscountable: data.isDiscountable,
        wordpressId: data.wordpressId,
        inventoryEnabled: data.procurementType ? data.procurementType === 'INVENTORY' : undefined,
        procurementRequired: data.procurementType
          ? data.procurementType !== 'INVENTORY'
          : undefined,
        serialNumberType: data.serialNumberType,
        categories: data.categoryIds
          ? {
              set: data.categoryIds.map((id) => ({ id })),
            }
          : undefined,
        tags: data.tagIds
          ? {
              set: data.tagIds.map((id) => ({ id })),
            }
          : undefined,
        bundleItems: data.bundleItems
          ? {
              deleteMany: {}, // Clear existing items
              create: data.bundleItems.map((item) => ({
                product: { connect: { id: item.childId } },
                quantity: item.quantity,
              })),
            }
          : undefined,
      },
      include: this.getDefaultInclude(),
    });

    this.logger.info('Product updated', { productId: id });
    await this.cache.invalidate(`${this.modelName}:list:*`);
    await this.cache.invalidate(`${this.modelName}:${id}`);

    return product;
  }

  /**
   * Find product by SKU
   */
  async findBySku(sku: string, tx?: Prisma.TransactionClient): Promise<any | null> {
    const prisma = tx || getPrismaClient();

    const product = await prisma.product.findFirst({
      where: { sku },
      include: this.getDefaultInclude(),
    });

    return product;
  }

  /**
   * Find or create product by SKU
   * If product doesn't exist, creates it with stock = 0
   */
  async findOrCreateBySku(
    sku: string,
    name: string,
    basePriceCents?: number,
    extraData?: Partial<Omit<ProductCreateInput, 'sku' | 'name' | 'basePriceCents'>>,
    tx?: Prisma.TransactionClient
  ): Promise<any> {
    // Try to find existing product
    let product = await this.findBySku(sku, tx);

    if (!product) {
      this.logger.info('Product not found, creating new product', { sku, name });

      // Create new product
      product = await this.createProduct(
        {
          sku,
          name,
          basePriceCents,
          stock: 0,
          isActive: true,
          ...extraData,
        },
        tx
      );
    }

    return product;
  }
  /**
   * Sync a product from WooCommerce (MappedSku) to local DB
   */
  async syncFromWoo(data: any, tx?: Prisma.TransactionClient): Promise<any> {
    const prisma = tx || getPrismaClient();

    // 1. Upsert Categories
    const categoryIds: string[] = [];
    if (data.categoryObjects && Array.isArray(data.categoryObjects)) {
      for (const cat of data.categoryObjects) {
        if (!cat.slug) continue;
        const upserted = await prisma.category.upsert({
          where: { tenantId_slug: { tenantId: await databaseTenantId(), slug: cat.slug } },
          update: { name: cat.name },
          create: { name: cat.name, slug: cat.slug },
        });
        categoryIds.push(upserted.id);
      }
    }

    const skuCode = data.skuCode;
    const name = data.name;
    const price = data.unitPrice ? Math.round(data.unitPrice * 100) : undefined; // to cents

    // 2. Upsert Product
    // Try to find by wordpressId first, then SKU
    let product = await prisma.product.findFirst({
      where: {
        OR: [{ wordpressId: String(data.wooProductId) }, { sku: skuCode }],
      },
    });

    const productData: any = {
      name,
      sku: skuCode,
      description: data.description,
      basePriceCents: price,
      stock: data.stockQty ?? 0,
      isActive: data.active,
      wordpressId: String(data.wooProductId),
      // Default type to SIMPLE for synced items
      type: ProductType.SIMPLE,
      procurementType: ProcurementType.INVENTORY, // Default to inventory for sync
      isDiscountable: true,
    };

    if (product) {
      product = await prisma.product.update({
        where: { id: product.id },
        data: {
          ...productData,
          categories: {
            set: categoryIds.map((id) => ({ id })),
          },
        },
      });
    } else {
      product = await prisma.product.create({
        data: {
          ...productData,
          categories: {
            connect: categoryIds.map((id) => ({ id })),
          },
        },
      });
    }

    this.logger.info(`Synced product from Woo: ${skuCode}`, { productId: product.id });
    return product;
  }
}
