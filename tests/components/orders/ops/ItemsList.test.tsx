import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ItemsList } from '@/components/orders/ops/components/ItemsList';
import type { OpsItem } from '@/components/orders/ops/workflow/types';

// Mock Lucide icons
vi.mock('lucide-react', async (importOriginal) => ({
 ...(await importOriginal<typeof import('lucide-react')>()),
  Package: () => <div data-testid="icon-package" />,
  Truck: () => <div data-testid="icon-truck" />,
}));

const mockItems: OpsItem[] = [
  {
    id: 'item-1',
    name: 'שולחן עץ',
    sku: 'WD-123',
    quantity: 2,
    supplierId: 'sup-1',
    supplierName: 'ספק רהיטים',
    received: true,
    receivedQuantity: 2,
    allocationStatus: 'ALLOCATED',
  },
  {
    id: 'item-2',
    name: 'כיסא משרדי',
    sku: 'CH-456',
    quantity: 6,
    supplierId: null,
    supplierName: null,
    received: false,
    receivedQuantity: 0,
    allocationStatus: 'PENDING',
  },
];

describe('ItemsList', () => {
  it('renders a list of items', () => {
    render(<ItemsList items={mockItems} />);
    expect(screen.getByText('שולחן עץ')).toBeDefined();
    expect(screen.getByText('WD-123')).toBeDefined();
    expect(screen.getByText('כיסא משרדי')).toBeDefined();
    expect(screen.getByText('CH-456')).toBeDefined();
  });

  it('renders quantity correctly', () => {
    render(<ItemsList items={mockItems} />);
    expect(screen.getByText('×2')).toBeDefined();
    expect(screen.getByText('×6')).toBeDefined();
  });

  it('renders supplier name when available', () => {
    render(<ItemsList items={[{ ...mockItems[0], received: false, receivedQuantity: 0, allocationStatus: 'ON_ORDER' }]} />);
    expect(screen.getByText('ספק רהיטים')).toBeDefined();
  });

  it('renders empty state when no items provided', () => {
    render(<ItemsList items={[]} />);
    expect(screen.getByText('אין פריטים בהזמנה זו')).toBeDefined();
  });

  it('renders correct number of items in header', () => {
    render(<ItemsList items={mockItems} />);
    expect(screen.getByText('2 פריטים')).toBeDefined();
  });
});
