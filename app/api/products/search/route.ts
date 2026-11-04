import {
  createSuccessResponse,
  requirePermissions,
  requireRole,
  withAuth,
  type AuthenticatedUser,
} from '@/lib/api-middleware';
import { prisma } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const SearchParamsSchema = z.object({
  term: z.string().min(1, 'term is required').max(100, 'term is too long'),
  supplierId: z.string().uuid().optional(),
  limit: z.coerce.number().min(1).max(50).optional().default(20),
});

const CreateProductSchema = z.object({
  name: z.string().min(1, 'שם מוצר הוא שדה חובה'),
  sku: z.string().min(1, 'SKU הוא שדה חובה').optional(),
  supplierId: z.string().uuid('ספק לא תקין').nullable().optional(),
  basePriceCents: z.number().int().min(0).optional().default(0),
});

// Simplified product type for autocomplete
interface ProductSearchResult {
  id: string;
  name: string;
  sku: string;
  basePriceCents: number | null;
  salePriceCents: number | null;
  promoStartsAt: string | null;
  promoEndsAt: string | null;
  stock: number;
  supplierId: string | null;
  supplierName: string | null;
  ordersCount: number;
  imageUrl: string | null;
}

/**
 * GET /api/products/search - Search products for autocomplete
 * Optimized for fast autocomplete with minimal payload
 */
export const GET = withAuth(async (req: NextRequest, user: AuthenticatedUser) => {
  requirePermissions(user, ['VIEW_SKUS']);
  try {
    const url = new URL(req.url);
    const rawParams = Object.fromEntries(url.searchParams);
    const { term, supplierId, limit } = SearchParamsSchema.parse(rawParams);

    const where: any = {
      OR: [
        { name: { contains: term, mode: 'insensitive' } },
        { sku: { contains: term, mode: 'insensitive' } },
      ],
    };

    // Filter by supplier if provided
    if (supplierId) {
      where.AND = [
        {
          OR: [{ defaultSupplierId: supplierId }, { productSuppliers: { some: { supplierId } } }],
        },
      ];
    }

    const products = await prisma.product.findMany({
      where,
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      take: limit,
      select: {
        id: true,
        name: true,
        sku: true,
        imageUrl: true,
        basePriceCents: true,
        sale_price_cents: true,
        promo_starts_at: true,
        promo_ends_at: true,
        stock: true,
        defaultSupplierId: true,
        defaultSupplier: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            orderItems: true,
          },
        },
      },
    });

    const results: ProductSearchResult[] = products.map((product) => ({
      id: product.id,
      name: product.name,
      sku: product.sku,
      basePriceCents: product.basePriceCents,
      salePriceCents: product.sale_price_cents,
      promoStartsAt: product.promo_starts_at?.toISOString() ?? null,
      promoEndsAt: product.promo_ends_at?.toISOString() ?? null,
      stock: product.stock,
      imageUrl: product.imageUrl ?? null,
      supplierId: product.defaultSupplierId,
      supplierName: product.defaultSupplier?.name || null,
      ordersCount: product._count.orderItems,
    }));

    return createSuccessResponse({ products: results });
  } catch (error) {
    console.error('Product search error:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: { message: error.errors[0]?.message || 'Invalid search parameters' },
        },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { success: false, error: { message: 'שגיאה בחיפוש מוצרים' } },
      { status: 500 }
    );
  }
});

/**
 * POST /api/products/search - Find or create product
 * If product with same name exists for supplier, return it
 * Otherwise, create new product linked to supplier
 */
export const POST = withAuth(async (req: NextRequest, user: AuthenticatedUser) => {
  requireRole(user, ['ADMIN', 'OPERATIONS', 'PURCHASING', 'SALES']);
  try {
    const body = await req.json();
    const payload = CreateProductSchema.parse(body);

    // Verify supplier exists (if provided)
    let supplier = null;
    if (payload.supplierId) {
      supplier = await prisma.supplier.findUnique({
        where: { id: payload.supplierId },
        select: { id: true, name: true },
      });

      if (!supplier) {
        return NextResponse.json(
          { success: false, error: { message: 'ספק לא נמצא' } },
          { status: 404 }
        );
      }
    }

    // Check if product with same name already exists (for this supplier if provided)
    const whereClause: any = {
      name: { equals: payload.name, mode: 'insensitive' },
    };

    if (payload.supplierId) {
      whereClause.OR = [
        { defaultSupplierId: payload.supplierId },
        { productSuppliers: { some: { supplierId: payload.supplierId } } },
      ];
    }

    const existingProduct = await prisma.product.findFirst({
      where: whereClause,
      select: {
        id: true,
        name: true,
        sku: true,
        imageUrl: true,
        basePriceCents: true,
        sale_price_cents: true,
        promo_starts_at: true,
        promo_ends_at: true,
        stock: true,
        defaultSupplierId: true,
        defaultSupplier: { select: { id: true, name: true } },
        _count: { select: { orderItems: true } },
      },
    });

    if (existingProduct) {
      // Return existing product
      const result: ProductSearchResult = {
        id: existingProduct.id,
        name: existingProduct.name,
        sku: existingProduct.sku,
        imageUrl: existingProduct.imageUrl,
        basePriceCents: existingProduct.basePriceCents,
        salePriceCents: existingProduct.sale_price_cents,
        promoStartsAt: existingProduct.promo_starts_at?.toISOString() ?? null,
        promoEndsAt: existingProduct.promo_ends_at?.toISOString() ?? null,
        stock: existingProduct.stock,
        supplierId: existingProduct.defaultSupplierId,
        supplierName: existingProduct.defaultSupplier?.name || null,
        ordersCount: existingProduct._count.orderItems,
      };

      return NextResponse.json({
        success: true,
        data: result,
        created: false,
        message: 'מוצר קיים נמצא',
      });
    }

    // Generate SKU if not provided
    const sku = payload.sku || (await generateSku(payload.name));

    // Check if SKU already exists
    const skuExists = await prisma.product.findFirst({
      where: { sku },
      select: { id: true },
    });

    const finalSku = skuExists ? `${sku}-${Date.now()}` : sku;

    // Create new product
    const newProduct = await prisma.product.create({
      data: {
        name: payload.name,
        sku: finalSku,
        defaultSupplierId: payload.supplierId || null,
        basePriceCents: payload.basePriceCents,
      },
      select: {
        id: true,
        name: true,
        sku: true,
        imageUrl: true,
        basePriceCents: true,
        sale_price_cents: true,
        promo_starts_at: true,
        promo_ends_at: true,
        stock: true,
        defaultSupplierId: true,
        defaultSupplier: { select: { id: true, name: true } },
        _count: { select: { orderItems: true } },
      },
    });

    // Create ProductSupplier relationship only if supplier is provided
    if (payload.supplierId) {
      await prisma.productSupplier.create({
        data: {
          productId: newProduct.id,
          supplierId: payload.supplierId,
        },
      });
    }

    const result: ProductSearchResult = {
      id: newProduct.id,
      name: newProduct.name,
      sku: newProduct.sku,
      imageUrl: newProduct.imageUrl,
      basePriceCents: newProduct.basePriceCents,
      salePriceCents: newProduct.sale_price_cents,
      promoStartsAt: newProduct.promo_starts_at?.toISOString() ?? null,
      promoEndsAt: newProduct.promo_ends_at?.toISOString() ?? null,
      stock: newProduct.stock,
      supplierId: newProduct.defaultSupplierId,
      supplierName: newProduct.defaultSupplier?.name || null,
      ordersCount: newProduct._count.orderItems,
    };

    return NextResponse.json(
      {
        success: true,
        data: result,
        created: true,
        message: 'מוצר חדש נוצר בהצלחה',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Product create error:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: { message: error.errors[0]?.message || 'Invalid search parameters' },
        },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { success: false, error: { message: 'שגיאה ביצירת מוצר' } },
      { status: 500 }
    );
  }
});

/**
 * Generate a SKU from product name
 */
async function generateSku(name: string): Promise<string> {
  // Create SKU from first letters of words + random suffix
  const words = name.split(/\s+/).filter(Boolean);
  const prefix = words
    .slice(0, 3)
    .map((word) => word.charAt(0).toUpperCase())
    .join('');

  const random = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, '0');
  return `${prefix || 'PRD'}-${random}`;
}
