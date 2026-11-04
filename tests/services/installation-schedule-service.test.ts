import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFindMany = vi.fn();
const mockCreate = vi.fn();
const mockUpdate = vi.fn();
const mockFindUnique = vi.fn();

vi.mock('@/lib/prisma', () => ({
  prisma: {
    installationSlot: {
      findMany: mockFindMany,
      create: mockCreate,
    },
    order: {
      update: mockUpdate,
      findUnique: mockFindUnique,
    },
  },
}));

describe('InstallationScheduleService', () => {
  beforeEach(() => {
    vi.resetModules();
    mockFindMany.mockReset();
    mockCreate.mockReset();
    mockUpdate.mockReset();
    mockFindUnique.mockReset();
  });

  it('prevents overlapping slots for the same technician', async () => {
    mockFindMany.mockResolvedValueOnce([{ id: 'existing' }]);
    const module = await import('@/lib/services/installations/InstallationScheduleService');
    const service = module.installationScheduleService;

    await expect(
      service.createSlot({
        orderId: 'order-1',
        technicianId: 'tech-1',
        date: new Date(),
        startTime: new Date('2024-01-01T10:00:00Z'),
        endTime: new Date('2024-01-01T12:00:00Z'),
      })
    ).rejects.toThrow('Technician already has an installation in this time range');
  });

  it('creates a slot and updates order when no conflict exists', async () => {
    mockFindMany.mockResolvedValueOnce([]);
    mockCreate.mockResolvedValueOnce({ id: 'new-slot' });
    mockUpdate.mockResolvedValueOnce({ id: 'order-1' });

    const module = await import('@/lib/services/installations/InstallationScheduleService');
    const service = module.installationScheduleService;

    const slot = await service.applySlot({
      orderId: 'order-1',
      technicianId: 'tech-1',
      date: new Date(),
      startTime: new Date('2024-01-01T10:00:00Z'),
      endTime: new Date('2024-01-01T12:00:00Z'),
    });

    expect(slot).toEqual({ id: 'new-slot' });
    expect(mockCreate).toHaveBeenCalled();
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'order-1' },
      data: expect.objectContaining({ scheduledAt: expect.any(Date), status: 'SCHEDULED' }),
    });
  });
});
