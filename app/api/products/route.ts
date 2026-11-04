import { normalizeProduct, normalizeProducts } from '@/domain/products/normalizeProduct';
import {
  createSuccessResponse,
  requireRole,
  validateRequest,
  withAuth,
  type AuthenticatedUser,
} from '@/lib/api-middleware';
import { prisma } from '@/lib/db';
import { ServiceFactory } from '@/lib/services/ServiceFactory';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

export const ProductCreateSchema = z.object({
  name: z.string().min(1, 'Product name is required'),
  sku: z.string().min(1, 'SKU is required'),
  defaultSupplierId: z.string().uuid().optional().nullable(),
  basePriceCents: z.number().int().min(0).optional().nullable(),
  demoStock: z.number().int().min(0).optional().nullable(),
  description: z.string().optional().nullable(),
  shortDescription: z.string().optional().nullable(),
  imageUrl: z.string().url().optional().nullable(),
  // New API fields
  type: z.enum(['SIMPLE', 'BUNDLE', 'SERVICE', 'VARIABLE']).optional(),
  procurementType: z.enum(['INVENTORY', 'DROPSHIP', 'SPECIAL_ORDER']).optional(),
  installationRequired: z.boolean().optional(),
  isDiscountable: z.boolean().optional(),
  wordpressId: z.string().optional(),
  categoryIds: z.array(z.string().uuid()).optional(),
  tagIds: z.array(z.string().uuid()).optional(),
  bundleItems: z
    .array(
      z.object({
        childId: z.string().uuid(),
        quantity: z.number().int().min(1),
      })
    )
    .optional(),
  // Additional fields for UI
  isActive: z.boolean().optional(),
  is_featured: z.boolean().optional(),
  inventoryEnabled: z.boolean().optional(),
  reorderLevel: z.number().int().min(0).optional(),
});

export const ProductUpdateSchema = ProductCreateSchema.partial();

// GET /api/products - List products
export const GET = withAuth(
  async (req: NextRequest) => {
    const url = new URL(req.url);
    const queryParams = Object.fromEntries(url.searchParams);
    const { page, limit, q } = z
      .object({
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(20),
        q: z.string().max(200).optional(),
      })
      .parse(queryParams);

    const where: any = {};
    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { sku: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        take: limit,
        skip: (page - 1) * limit,
        orderBy: { createdAt: 'desc' },
        // Keep the selected shape narrow to avoid rejecting rows that contain
        // legacy/external enum values in non-essential columns.
        select: {
          id: true,
          name: true,
          sku: true,
          wooId: true,
          procurementType: true,
          type: true,
          createdAt: true,
          updatedAt: true,
          basePriceCents: true,
          sale_price_cents: true,
          demoStock: true,
          description: true,
          shortDescription: true,
          imageUrl: true,
          stock: true,
          reorderLevel: true,
          isActive: true,
          is_featured: true,
          inventoryEnabled: true,
          parentId: true,
          defaultSupplier: {
            select: { id: true, name: true },
          },
          _count: {
            select: { orderItems: true },
          },
        },
      }),
      prisma.product.count({ where }),
    ]);

    const normalized = normalizeProducts(
      products.map((product) => ({
        ...product,
        barcode: '', // Placeholder for now
        isFeatured: product.is_featured ?? false,
        status: product.isActive ? 'ACTIVE' : 'DRAFT',
      }))
    );

    return createSuccessResponse({
      items: normalized,
      total,
      page,
      limit,
    });
  },
  { permissions: ['VIEW_SKUS'] }
);

// POST /api/products - Create new product
export const POST = withAuth(async (req: NextRequest, user: AuthenticatedUser) => {
  requireRole(user, ['ADMIN', 'OPERATIONS']);
  const payload = (await validateRequest(ProductCreateSchema)(req)) as z.infer<
    typeof ProductCreateSchema
  >;

  // Check if product with same SKU exists
  const existingProduct = await prisma.product.findFirst({
    where: { sku: payload.sku },
  });

  if (existingProduct) {
    throw new Error('Product with this SKU already exists');
  }

  // If defaultSupplierId is provided, verify it exists
  if (payload.defaultSupplierId) {
    const supplier = await prisma.supplier.findUnique({
      where: { id: payload.defaultSupplierId },
    });

    if (!supplier) {
      throw new Error('Supplier not found');
    }
  }

  // Use Repository
  const product = await ServiceFactory.getInstance()
    .getProductsRepository()
    .createProduct(payload as any); // Cast as any since zod schema slightly differs from internal interface (enums vs strings)

  return NextResponse.json({ success: true, data: normalizeProduct(product) }, { status: 201 });
});
