import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/db', () => {
  const productModel = {
    findMany: vi.fn(),
    count: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  };
  return {
    prisma: {
      product: productModel,
      supplier: { findUnique: vi.fn() }
    },
    getPrismaClient: () => ({
      product: productModel,
      supplier: { findUnique: vi.fn() }
    })
  };
});

vi.mock('@/lib/api-middleware', async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    withAuth: (handler: any) => handler,
    validateRequest: () => () => ({}),
    createSuccessResponse: (data: any) => ({
      json: () => Promise.resolve({ success: true, data }),
      status: 200,
    }),
    requireRole: () => {},
  };
});

vi.mock('@/lib/services/ServiceFactory', () => ({
  ServiceFactory: {
    getInstance: () => ({
      getProductsRepository: () => ({
        createProduct: vi.fn(),
      }),
    }),
  },
}));

import { GET } from '@/app/api/products/route';
import { prisma } from '@/lib/db';

describe('Catalog smoke test', () => {
  const now = new Date();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns demo products with aligned inventory fields', async () => {
    (prisma.product.findMany as any).mockResolvedValue([
      {
        id: 'prod-1',
        sku: 'DEMO-WALL-COVER-001',
        name: 'Urban Texture Wallpaper',
        basePriceCents: 18900,
        demoStock: 40,
        createdAt: now,
        updatedAt: now,
        isActive: true,
        inventoryEnabled: true,
        reorderLevel: 5,
        type: 'SIMPLE',
        _count: { orderItems: 0 },
        defaultSupplier: { id: 'sup-1', name: 'Demo Supplier' },
      },
    ]);
    (prisma.product.count as any).mockResolvedValue(1);

    const request = new NextRequest('http://localhost:3000/api/products');
    const response = await GET(request, { id: 'demo-user' } as any);
    const data = await response.json();

    expect(data.data.total).toBe(1);
    expect(data.data.items[0].sku).toBe('DEMO-WALL-COVER-001');
    expect(data.data.items[0].isActive).toBe(true);
    expect(data.data.items[0].inventoryEnabled).toBe(true);
    expect(data.data.items[0].reorderLevel).toBe(5);
    expect(data.data.items[0].type).toBe('SIMPLE');
  });
});
