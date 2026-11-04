import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LabelService } from '@/lib/services/orders/LabelService';
import { prisma } from '@/lib/db';

vi.mock('@/lib/db', () => ({
  prisma: {
    label: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    order: {
      update: vi.fn(),
    },
  },
}));

describe('LabelService', () => {
  let service: LabelService;

  beforeEach(() => {
    service = new LabelService();
    vi.clearAllMocks();
  });

  it('should get all labels', async () => {
    const mockLabels = [{ id: '1', name: 'Urgent' }];
    (prisma.label.findMany as any).mockResolvedValue(mockLabels);

    const result = await service.getAllLabels();
    expect(result).toEqual(mockLabels);
    expect(prisma.label.findMany).toHaveBeenCalled();
  });

  it('should create a label', async () => {
    const data = { name: 'New Label', color: 'bg-red-500' };
    (prisma.label.create as any).mockResolvedValue({ id: '1', ...data });

    const result = await service.createLabel(data);
    expect(result.name).toBe(data.name);
    expect(prisma.label.create).toHaveBeenCalledWith({ data });
  });

  it('should assign label to order', async () => {
    const orderId = 'order-1';
    const labelId = 'label-1';
    (prisma.order.update as any).mockResolvedValue({ id: orderId, labels: [{ id: labelId }] });

    const result = await service.assignLabelToOrder(orderId, labelId);
    expect(prisma.order.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: orderId },
      data: {
        labels: {
          connect: { id: labelId },
        },
      },
    }));
  });
});
