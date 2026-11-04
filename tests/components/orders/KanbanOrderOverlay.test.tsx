import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import KanbanOrderOverlay from '@/components/orders/ops/KanbanOrderOverlay';
import { OrderStatus } from '@prisma/client';

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, className, onClick, layoutId, ...rest }: any) => (
      <div className={className} onClick={onClick} data-testid={layoutId ? `overlay-${layoutId}` : 'motion-div'}>
        {children}
      </div>
    ),
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

// Mock orderStageMapping
vi.mock('@/components/orders/shared/orderStageMapping', () => ({
  OrderWorkLabel: {},
  LABEL_CONFIG: {
    AWAITING_PAYMENT: { he: 'ממתין לתשלום', color: 'bg-red-100 text-red-600' },
    STOCK_CHECKED: { he: 'מלאי נבדק', color: 'bg-blue-100 text-blue-600' },
  },
}));

const createMockOrder = (overrides: Partial<any> = {}) => ({
  id: 'order-1',
  number: '1001',
  customerName: 'Test Customer',
  itemsSummary: '3 x Table, 2 x Chair',
  totalAmount: 5000,
  status: 'RECEIVED' as OrderStatus,
  labels: [],
  ...overrides,
});

describe('KanbanOrderOverlay', () => {
  const mockOnClose = vi.fn();
  const mockOnStatusChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Display', () => {
    it('renders order number', () => {
      const order = createMockOrder();
      render(
        <KanbanOrderOverlay
          order={order}
          onClose={mockOnClose}
          onStatusChange={mockOnStatusChange}
        />
      );
      expect(screen.getByText('Order #1001')).toBeInTheDocument();
    });

    it('renders customer name', () => {
      const order = createMockOrder();
      render(
        <KanbanOrderOverlay
          order={order}
          onClose={mockOnClose}
          onStatusChange={mockOnStatusChange}
        />
      );
      expect(screen.getByText('Test Customer')).toBeInTheDocument();
    });

    it('renders total amount with currency', () => {
      const order = createMockOrder({ totalAmount: 5000 });
      render(
        <KanbanOrderOverlay
          order={order}
          onClose={mockOnClose}
          onStatusChange={mockOnStatusChange}
        />
      );
      expect(screen.getByText('5000 ₪')).toBeInTheDocument();
    });

    it('renders items summary when available', () => {
      const order = createMockOrder({ itemsSummary: '3 x Table, 2 x Chair' });
      render(
        <KanbanOrderOverlay
          order={order}
          onClose={mockOnClose}
          onStatusChange={mockOnStatusChange}
        />
      );
      expect(screen.getByText('3 x Table, 2 x Chair')).toBeInTheDocument();
    });

    it('shows fallback text when no items summary', () => {
      const order = createMockOrder({ itemsSummary: undefined });
      render(
        <KanbanOrderOverlay
          order={order}
          onClose={mockOnClose}
          onStatusChange={mockOnStatusChange}
        />
      );
      expect(screen.getByText('ללא פירוט פריטים')).toBeInTheDocument();
    });

    it('renders labels when available', () => {
      const order = createMockOrder({
        labels: ['AWAITING_PAYMENT'],
      });
      render(
        <KanbanOrderOverlay
          order={order}
          onClose={mockOnClose}
          onStatusChange={mockOnStatusChange}
        />
      );
      expect(screen.getByText('ממתין לתשלום')).toBeInTheDocument();
    });
  });

  describe('Status Transitions', () => {
    it('shows "העבר לשלב הבא" button for non-READY statuses', () => {
      const order = createMockOrder({ status: 'RECEIVED' });
      render(
        <KanbanOrderOverlay
          order={order}
          onClose={mockOnClose}
          onStatusChange={mockOnStatusChange}
        />
      );
      expect(screen.getByText('העבר לשלב הבא')).toBeInTheDocument();
    });

    it('shows "הוצא למשלוח" for READY status', () => {
      const order = createMockOrder({ status: 'READY' });
      render(
        <KanbanOrderOverlay
          order={order}
          onClose={mockOnClose}
          onStatusChange={mockOnStatusChange}
        />
      );
      expect(screen.getByText('הוצא למשלוח')).toBeInTheDocument();
    });

    it('does not show progression button for COMPLETED status', () => {
      const order = createMockOrder({ status: 'COMPLETED' });
      render(
        <KanbanOrderOverlay
          order={order}
          onClose={mockOnClose}
          onStatusChange={mockOnStatusChange}
        />
      );
      expect(screen.queryByText('העבר לשלב הבא')).not.toBeInTheDocument();
      expect(screen.queryByText('הוצא למשלוח')).not.toBeInTheDocument();
    });

    it('transitions RECEIVED to PROCESSING on button click', () => {
      const order = createMockOrder({ status: 'RECEIVED' });
      render(
        <KanbanOrderOverlay
          order={order}
          onClose={mockOnClose}
          onStatusChange={mockOnStatusChange}
        />
      );

      fireEvent.click(screen.getByText('העבר לשלב הבא'));
      expect(mockOnStatusChange).toHaveBeenCalledWith('order-1', 'PROCESSING');
    });

    it('transitions PROCESSING to READY on button click', () => {
      const order = createMockOrder({ status: 'PROCESSING' });
      render(
        <KanbanOrderOverlay
          order={order}
          onClose={mockOnClose}
          onStatusChange={mockOnStatusChange}
        />
      );

      fireEvent.click(screen.getByText('העבר לשלב הבא'));
      expect(mockOnStatusChange).toHaveBeenCalledWith('order-1', 'READY');
    });

    it('transitions READY to IN_TRANSIT on button click', () => {
      const order = createMockOrder({ status: 'READY' });
      render(
        <KanbanOrderOverlay
          order={order}
          onClose={mockOnClose}
          onStatusChange={mockOnStatusChange}
        />
      );

      fireEvent.click(screen.getByText('הוצא למשלוח'));
      expect(mockOnStatusChange).toHaveBeenCalledWith('order-1', 'IN_TRANSIT');
    });

    it('transitions IN_TRANSIT to COMPLETED on button click', () => {
      const order = createMockOrder({ status: 'IN_TRANSIT' });
      render(
        <KanbanOrderOverlay
          order={order}
          onClose={mockOnClose}
          onStatusChange={mockOnStatusChange}
        />
      );

      fireEvent.click(screen.getByText('העבר לשלב הבא'));
      expect(mockOnStatusChange).toHaveBeenCalledWith('order-1', 'COMPLETED');
    });
  });

  describe('Action Buttons', () => {
    it('renders call button', () => {
      const order = createMockOrder();
      render(
        <KanbanOrderOverlay
          order={order}
          onClose={mockOnClose}
          onStatusChange={mockOnStatusChange}
        />
      );
      expect(screen.getByText('התקשר')).toBeInTheDocument();
    });

    it('renders edit button', () => {
      const order = createMockOrder();
      render(
        <KanbanOrderOverlay
          order={order}
          onClose={mockOnClose}
          onStatusChange={mockOnStatusChange}
        />
      );
      expect(screen.getByText('ערוך')).toBeInTheDocument();
    });

    it('renders cancel button', () => {
      const order = createMockOrder();
      render(
        <KanbanOrderOverlay
          order={order}
          onClose={mockOnClose}
          onStatusChange={mockOnStatusChange}
        />
      );
      expect(screen.getByText('בטל')).toBeInTheDocument();
    });

    it('navigates to order detail on edit click', () => {
      const originalLocation = window.location;
      delete (window as any).location;
      window.location = { ...originalLocation, href: '' } as any;

      const order = createMockOrder();
      render(
        <KanbanOrderOverlay
          order={order}
          onClose={mockOnClose}
          onStatusChange={mockOnStatusChange}
        />
      );

      fireEvent.click(screen.getByText('ערוך'));
      expect(window.location.href).toBe('/orders/order-1');
      window.location = originalLocation;
    });
  });

  describe('Backdrop', () => {
    it('calls onClose when backdrop is clicked', () => {
      const order = createMockOrder();
      render(
        <KanbanOrderOverlay
          order={order}
          onClose={mockOnClose}
          onStatusChange={mockOnStatusChange}
        />
      );

      // Click the backdrop (first motion div)
      const backdrop = screen.getByTestId('motion-div');
      fireEvent.click(backdrop);
      expect(mockOnClose).toHaveBeenCalled();
    });
  });
});
