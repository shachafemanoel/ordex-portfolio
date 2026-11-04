import { describe, it, expect, vi, beforeEach } from 'vitest';

// Use vi.hoisted for variables used in mocks
const { mockCache, mockPrisma } = vi.hoisted(() => ({
  mockCache: {
    isAvailable: vi.fn(),
    get: vi.fn(),
    set: vi.fn(),
    invalidate: vi.fn(),
  },
  mockPrisma: {
    purchaseOrder: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
}));

vi.mock('@/lib/cache/CacheService', () => ({
  getCacheService: () => mockCache,
}));

vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}));

// Import subject under test
import { listPurchaseOrders, invalidatePurchaseOrdersCache } from '@/lib/data/purchaseOrdersRepo';

describe('purchaseOrdersRepo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCache.isAvailable.mockReturnValue(true);
  });

  describe('listPurchaseOrders', () => {
    it('should return cached result if available', async () => {
      const cachedResult = { items: [], total: 0 };
      mockCache.get.mockResolvedValue(cachedResult);

      const result = await listPurchaseOrders({});

      expect(mockCache.get).toHaveBeenCalled();
      expect(result).toEqual(cachedResult);
      expect(mockPrisma.purchaseOrder.findMany).not.toHaveBeenCalled();
    });

    it('should fetch from prisma and cache result if cache miss', async () => {
      mockCache.get.mockResolvedValue(null);
      mockPrisma.purchaseOrder.findMany.mockResolvedValue([]);
      mockPrisma.purchaseOrder.count.mockResolvedValue(0);

      const result = await listPurchaseOrders({});

      expect(mockPrisma.purchaseOrder.findMany).toHaveBeenCalled();
      expect(mockCache.set).toHaveBeenCalledWith(
        expect.stringContaining('PurchaseOrders:list:'),
        expect.objectContaining({ items: [], total: 0 }),
        300
      );
      expect(result).toEqual({ items: [], total: 0 });
    });
  });

  describe('invalidatePurchaseOrdersCache', () => {
    it('should invalidate cache if available', async () => {
      await invalidatePurchaseOrdersCache();
      expect(mockCache.invalidate).toHaveBeenCalledWith('PurchaseOrders:list:*');
    });
  });
});
