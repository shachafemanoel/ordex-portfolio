import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { OrderOverviewCard } from '@/components/orders/ops/components/OrderOverviewCard';
import type { OrderOpsData, OpsItem } from '@/components/orders/ops/workflow/types';

// Mock Lucide icons
vi.mock('lucide-react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('lucide-react')>()),
  MapPin: () => <div data-testid="icon-map-pin" />,
  User: () => <div data-testid="icon-user" />,
  Clock3: () => <div data-testid="icon-clock" />,
  Package: () => <div data-testid="icon-package" />,
  CheckCircle2: () => <div data-testid="icon-check" />,
}));

// Mock OpsProgressRing
vi.mock('@/components/ops/shared/OpsCardPrimitives', () => ({
  OpsProgressRing: ({ progress, centerLabel }: { progress: number; centerLabel: string }) => (
    <div data-testid="progress-ring">
      <span>{progress}%</span>
      <span>{centerLabel}</span>
    </div>
  ),
}));

const mockOrder: Partial<OrderOpsData> = {
  id: 'order-123',
  status: 'PROCESSING',
  customerName: 'ישראל ישראלי',
  customerPhone: '0501234567',
  shippingAddressSummary: 'רחוב הרצל 1, תל אביב',
  scheduledAt: '2026-03-19T10:00:00Z',
};

const mockItems: OpsItem[] = [
  {
    id: 'item-1',
    name: 'כיסא',
    sku: 'CH-1',
    quantity: 4,
    supplierId: null,
    supplierName: null,
    received: false,
    receivedQuantity: 0,
    allocationStatus: 'PENDING',
  },
];

describe('OrderOverviewCard', () => {
  it('renders customer information correctly', () => {
    render(<OrderOverviewCard orderData={mockOrder as OrderOpsData} items={mockItems} />);
    expect(screen.getByText('ישראל ישראלי')).toBeDefined();
    expect(screen.getByText('לקוח')).toBeDefined();
  });

  it('renders shipping address correctly', () => {
    render(<OrderOverviewCard orderData={mockOrder as OrderOpsData} items={mockItems} />);
    expect(screen.getByText('רחוב הרצל 1, תל אביב')).toBeDefined();
    expect(screen.getByText(/רחוב הרצל 1/)).toBeVisible();
  });

  it('renders scheduled date correctly', () => {
    render(<OrderOverviewCard orderData={mockOrder as OrderOpsData} items={mockItems} />);
    // "19.03" or "19/03" depending on locale
    expect(screen.getByText(/19[./]03/)).toBeDefined();
  });

  it('shows item readiness instead of an estimated progress percentage', () => {
    render(<OrderOverviewCard orderData={mockOrder as OrderOpsData} items={mockItems} />);
    expect(screen.getByText('1 פריטים — 0 מוכנים')).toBeVisible();
  });
});
