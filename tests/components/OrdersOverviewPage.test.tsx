import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import OrdersOverviewPage from '@/app/(ops)/orders/overview/page';
import * as ordersHooks from '@/lib/hooks/api/orders';
import { useRouter } from 'next/navigation';

// Mock useRouter
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
}));

// Mock useOrdersQuery
vi.mock('@/lib/hooks/api/orders', async (importOriginal) => {
  const actual = await importOriginal<typeof ordersHooks>();
  return {
    ...actual,
    useOrdersQuery: vi.fn(),
  };
});

describe('OrdersOverviewPage', () => {
  const mockPush = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useRouter as any).mockReturnValue({ push: mockPush });
  });

  it('renders loading state', () => {
    (ordersHooks.useOrdersQuery as any).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    });

    render(<OrdersOverviewPage />);
    expect(screen.getByText('טוען הזמנות...')).toBeDefined();
  });

  it('renders empty state', () => {
    (ordersHooks.useOrdersQuery as any).mockReturnValue({
      data: { items: [], pagination: {} },
      isLoading: false,
      error: null,
    });

    render(<OrdersOverviewPage />);
    expect(screen.getByText('לא נמצאו הזמנות להצגה.')).toBeDefined();
  });

  it('renders orders list correctly', () => {
    const mockOrders = [
      {
        id: '1',
        number: 'ORD-001',
        customer: { name: 'Test Customer' },
        status: 'NEW',
        totalAmount: 100.50,
        createdAt: '2023-01-01T10:00:00Z',
      },
    ];

    (ordersHooks.useOrdersQuery as any).mockReturnValue({
      data: { items: mockOrders, pagination: {} },
      isLoading: false,
      error: null,
    });

    render(<OrdersOverviewPage />);
    expect(screen.getByText('ORD-001')).toBeDefined();
    expect(screen.getByText('Test Customer')).toBeDefined();
  });
});
