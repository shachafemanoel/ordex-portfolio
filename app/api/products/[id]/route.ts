export const dynamic = 'force-dynamic';

import { ProductUpdateSchema } from '@/app/api/products/route';
import { normalizeProduct } from '@/domain/products/normalizeProduct';
import {
  createSuccessResponse,
  validateRequest,
  withAuth,
  type AuthenticatedUser,
} from '@/lib/api-middleware';
import { prisma } from '@/lib/db';
import { ServiceFactory } from '@/lib/services/ServiceFactory';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const ParamsSchema = z.object({
  id: z.string().uuid('Invalid product id'),
});

function parseParams(params: { id?: string }) {
  return ParamsSchema.parse(params);
}

const productInclude = {
  defaultSupplier: {
    select: {
      id: true,
      name: true,
    },
  },
  _count: {
    select: {
      orderItems: true,
      productSuppliers: true,
    },
  },
};

export const GET = withAuth(
  async (_req: NextRequest, _user: AuthenticatedUser, context: { params: { id?: string } }) => {
    const { id } = parseParams(context.params);

    const product = await prisma.product.findUnique({
      where: { id },
      include: productInclude,
    });

    if (!product) {
      return NextResponse.json(
        {
          success: false,
          error: { message: 'Product not found', code: 'NOT_FOUND' },
        },
        { status: 404 }
      );
    }

    return createSuccessResponse(normalizeProduct(product));
  },
  { permissions: ['VIEW_SKUS'] }
);

export const PUT = withAuth(
  async (req: NextRequest, _user: AuthenticatedUser, context: { params: { id?: string } }) => {
    const { id } = parseParams(context.params);
    const payload = (await validateRequest(ProductUpdateSchema)(req)) as z.infer<
      typeof ProductUpdateSchema
    >;

    if (Object.keys(payload).length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: { message: 'No fields provided for update', code: 'VALIDATION_ERROR' },
        },
        { status: 400 }
      );
    }

    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        {
          success: false,
          error: { message: 'Product not found', code: 'NOT_FOUND' },
        },
        { status: 404 }
      );
    }

    if (payload.defaultSupplierId) {
      const supplierExists = await prisma.supplier.findUnique({
        where: { id: payload.defaultSupplierId },
      });
      if (!supplierExists) {
        return NextResponse.json(
          {
            success: false,
            error: { message: 'Supplier not found', code: 'SUPPLIER_NOT_FOUND' },
          },
          { status: 404 }
        );
      }
    }

    // Use Repository
    const product = await ServiceFactory.getInstance()
      .getProductsRepository()
      .updateProduct(id, payload as any);

    return createSuccessResponse(
      normalizeProduct(product),
      undefined,
      'Product updated successfully'
    );
  }
);

export const DELETE = withAuth(
  async (_req: NextRequest, _user: AuthenticatedUser, context: { params: { id?: string } }) => {
    const { id } = parseParams(context.params);

    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            orderItems: true,
            purchaseOrderItems: true,
          },
        },
      },
    });

    if (!product) {
      return NextResponse.json(
        {
          success: false,
          error: { message: 'Product not found', code: 'NOT_FOUND' },
        },
        { status: 404 }
      );
    }

    if (product._count.orderItems > 0 || product._count.purchaseOrderItems > 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: 'Cannot delete product with existing order or purchase order items',
            code: 'IN_USE',
          },
        },
        { status: 409 }
      );
    }

    await prisma.product.delete({ where: { id } });

    return createSuccessResponse({ id }, undefined, 'Product deleted successfully');
  }
);
