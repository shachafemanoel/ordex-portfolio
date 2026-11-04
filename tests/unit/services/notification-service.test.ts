import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotificationService } from '@/lib/services/notification-service';
import { sendEmail } from '@/lib/email';
import { UserRole } from '@prisma/client';

// Mock sendEmail
vi.mock('@/lib/email', () => ({
  sendEmail: vi.fn(),
}));

// Mock logger to avoid cluttering test output
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('NotificationService', () => {
  let service: NotificationService;
  let prismaMock: any;

  beforeEach(() => {
    prismaMock = {
      user: {
        findMany: vi.fn(),
      },
    };
    service = new NotificationService(prismaMock);
    vi.clearAllMocks();
  });

  it('should send emails to sales users when inventory is available', async () => {
    // Arrange
    const salesUsers = [
      { email: 'sales1@example.com', name: 'Sales One' },
      { email: 'sales2@example.com', name: 'Sales Two' },
    ];
    prismaMock.user.findMany.mockResolvedValue(salesUsers);
    (sendEmail as any).mockResolvedValue({ success: true });

    const payload = {
      type: 'INVENTORY_AVAILABLE' as const,
      orderId: 'order-123',
      message: 'Order 123 is ready',
    };

    // Act
    await service.send(payload);

    // Assert
    expect(prismaMock.user.findMany).toHaveBeenCalledWith({
      where: {
        role: UserRole.SALES,
        isActive: true,
        email: { not: '' },
      },
      select: { email: true, name: true },
    });

    expect(sendEmail).toHaveBeenCalledTimes(2);
    expect(sendEmail).toHaveBeenCalledWith(
      'sales1@example.com',
      expect.any(String),
      payload.message
    );
    expect(sendEmail).toHaveBeenCalledWith(
      'sales2@example.com',
      expect.any(String),
      payload.message
    );
  });

  it('should handle no sales users found', async () => {
    // Arrange
    prismaMock.user.findMany.mockResolvedValue([]);

    const payload = {
      type: 'INVENTORY_AVAILABLE' as const,
      orderId: 'order-123',
      message: 'Order 123 is ready',
    };

    // Act
    await service.send(payload);

    // Assert
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('should handle email sending failure gracefully', async () => {
    // Arrange
    const salesUsers = [{ email: 'sales1@example.com', name: 'Sales One' }];
    prismaMock.user.findMany.mockResolvedValue(salesUsers);
    (sendEmail as any).mockResolvedValue({ success: false, error: 'SMTP error' });

    const payload = {
      type: 'INVENTORY_AVAILABLE' as const,
      orderId: 'order-123',
      message: 'Order 123 is ready',
    };

    // Act
    await service.send(payload);

    // Assert
    expect(sendEmail).toHaveBeenCalled();
    // Should not throw
  });
});
