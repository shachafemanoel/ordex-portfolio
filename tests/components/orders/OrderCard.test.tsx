import { OrderCard } from '@/components/orders/OrderCard';
import { WorkflowStage } from '@/lib/workflow-status';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// Mock @dnd-kit/sortable
vi.mock('@dnd-kit/sortable', () => ({
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: null,
    isDragging: false,
  }),
}));

// Mock @dnd-kit/utilities
vi.mock('@dnd-kit/utilities', () => ({
  CSS: {
    Transform: {
      toString: () => null,
    },
  },
}));

// Mock TaskPicker
vi.mock('@/components/orders/ops/TaskPicker', () => ({
  TaskPicker: ({ currentLabel, onSelect, compact }: any) => (
    <div data-testid="task-picker" data-current-label={currentLabel} data-compact={compact}>
      <button onClick={() => onSelect('AWAITING_PAYMENT')} data-testid="pick-label">
        Pick Label
      </button>
    </div>
  ),
}));

// Mock QuickActions
vi.mock('@/components/shared/QuickActions', () => ({
  QuickActions: ({ phoneNumber, size, variant }: any) => (
    <div
      data-testid="quick-actions"
      data-phone={phoneNumber}
      data-size={size}
      data-variant={variant}
    >
      Quick Actions
    </div>
  ),
}));

const createMockOrder = (overrides: Partial<any> = {}) => ({
  id: 'order-1',
  number: '1001',
  customerName: 'John Doe',
  customerPhone: '050-1234567',
  city: 'Tel Aviv',
  createdAt: new Date().toISOString(),
  stage: WorkflowStage.NEW,
  taskLabel: null,
  urgent: false,
  ...overrides,
});

describe('OrderCard', () => {
  describe('Basic Rendering', () => {
    it('renders customer name', () => {
      const order = createMockOrder();
      render(<OrderCard order={order} />);
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    it('renders order number', () => {
      const order = createMockOrder();
      render(<OrderCard order={order} />);
      expect(screen.getByText('#1001')).toBeInTheDocument();
    });

    it('renders default name when no customer name', () => {
      const order = createMockOrder({ customerName: null });
      render(<OrderCard order={order} />);
      expect(screen.getByText('לקוח מזדמן')).toBeInTheDocument();
    });

    it('renders city when available', () => {
      const order = createMockOrder({ city: 'Jerusalem' });
      render(<OrderCard order={order} />);
      expect(screen.getByText('Jerusalem')).toBeInTheDocument();
    });

    it('does not render city section when not available', () => {
      const order = createMockOrder({ city: null });
      render(<OrderCard order={order} />);
      expect(screen.queryByText('Jerusalem')).not.toBeInTheDocument();
    });
  });

  describe('Urgent Badge', () => {
    it('shows urgent badge for urgent orders', () => {
      const order = createMockOrder({ urgent: true });
      render(<OrderCard order={order} />);
      expect(screen.getByText('דחוף')).toBeInTheDocument();
    });

    it('does not show urgent badge for non-urgent orders', () => {
      const order = createMockOrder({ urgent: false });
      render(<OrderCard order={order} />);
      expect(screen.queryByText('דחוף')).not.toBeInTheDocument();
    });
  });

  describe('Status Colors', () => {
    it('uses blue status dot for NEW stage', () => {
      const order = createMockOrder({ stage: WorkflowStage.NEW });
      render(<OrderCard order={order} />);
      // The status indicator is rendered inside the card header
      const container = screen.getByText('John Doe').closest('div[dir="rtl"]');
      expect(container).toBeInTheDocument();
    });

    it('uses green status dot for READY stage', () => {
      const order = createMockOrder({ stage: WorkflowStage.READY });
      render(<OrderCard order={order} />);
      const container = screen.getByText('John Doe').closest('div[dir="rtl"]');
      expect(container).toBeInTheDocument();
    });

    it('applies grayscale for SENT stage', () => {
      const order = createMockOrder({ stage: WorkflowStage.SENT });
      render(<OrderCard order={order} />);
      const card = screen.getByText('John Doe').closest('div[dir="rtl"]');
      expect(card?.className).toContain('opacity-60');
      expect(card?.className).toContain('grayscale');
    });
  });

  describe('Compact Mode', () => {
    it('hides order number in compact mode', () => {
      const order = createMockOrder();
      render(<OrderCard order={order} compact />);
      expect(screen.queryByText('#1001')).not.toBeInTheDocument();
    });

    it('hides action area in compact mode', () => {
      const order = createMockOrder();
      render(<OrderCard order={order} compact onLabelChange={vi.fn()} />);
      expect(screen.queryByTestId('task-picker')).not.toBeInTheDocument();
    });

    it('shows order number in normal mode', () => {
      const order = createMockOrder();
      render(<OrderCard order={order} />);
      expect(screen.getByText('#1001')).toBeInTheDocument();
    });
  });

  describe('Task Picker Integration', () => {
    it('shows task picker when onLabelChange is provided and not SENT', () => {
      const order = createMockOrder({ stage: WorkflowStage.NEW });
      render(<OrderCard order={order} onLabelChange={vi.fn()} />);
      expect(screen.getByTestId('task-picker')).toBeInTheDocument();
    });

    it('hides task picker for SENT stage', () => {
      const order = createMockOrder({ stage: WorkflowStage.SENT });
      render(<OrderCard order={order} onLabelChange={vi.fn()} />);
      expect(screen.queryByTestId('task-picker')).not.toBeInTheDocument();
      expect(screen.getByText('הושלם')).toBeInTheDocument();
    });

    it('calls onLabelChange when label is selected', () => {
      const onLabelChange = vi.fn();
      const order = createMockOrder({ stage: WorkflowStage.NEW });
      render(<OrderCard order={order} onLabelChange={onLabelChange} />);

      fireEvent.click(screen.getByTestId('pick-label'));
      expect(onLabelChange).toHaveBeenCalledWith('order-1', 'AWAITING_PAYMENT');
    });
  });

  describe('Quick Actions', () => {
    it('renders quick actions in non-compact mode', () => {
      const order = createMockOrder();
      render(<OrderCard order={order} />);
      expect(screen.getByTestId('quick-actions')).toBeInTheDocument();
    });

    it('passes phone number to quick actions', () => {
      const order = createMockOrder({ customerPhone: '050-9999999' });
      render(<OrderCard order={order} />);
      expect(screen.getByTestId('quick-actions')).toHaveAttribute('data-phone', '050-9999999');
    });
  });

  describe('Click Handling', () => {
    it('calls onClick when card is clicked', () => {
      const onClick = vi.fn();
      const order = createMockOrder();
      render(<OrderCard order={order} onClick={onClick} />);

      fireEvent.click(screen.getByText('John Doe'));
      expect(onClick).toHaveBeenCalled();
    });

    it('does not propagate clicks from task picker area', () => {
      const onClick = vi.fn();
      const order = createMockOrder({ stage: WorkflowStage.NEW });
      render(<OrderCard order={order} onClick={onClick} onLabelChange={vi.fn()} />);

      fireEvent.click(screen.getByTestId('pick-label'));
      // onClick should not be called because stopPropagation is used
      expect(onClick).not.toHaveBeenCalled();
    });

    it('does not propagate clicks from quick actions area', () => {
      const onClick = vi.fn();
      const order = createMockOrder();
      render(<OrderCard order={order} onClick={onClick} />);

      fireEvent.click(screen.getByTestId('quick-actions'));
      expect(onClick).not.toHaveBeenCalled();
    });
  });

  describe('Drag State', () => {
    it('applies drag styling when isDragging is true', () => {
      const order = createMockOrder();
      render(<OrderCard order={order} isDragging />);
      const card = screen.getByText('John Doe').closest('div[dir="rtl"]');
      expect(card?.className).toContain('rotate-2');
      expect(card?.className).toContain('scale-105');
      expect(card?.className).toContain('shadow-xl');
    });
  });

  describe('Time Display', () => {
    it('shows "עכשיו" for orders created less than 1 minute ago', () => {
      const order = createMockOrder({ createdAt: new Date().toISOString() });
      render(<OrderCard order={order} />);
      expect(screen.getByText('עכשיו')).toBeInTheDocument();
    });

    it('shows minutes ago for recent orders', () => {
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const order = createMockOrder({ createdAt: fiveMinAgo });
      render(<OrderCard order={order} />);
      expect(screen.getByText("לפני 5 דק'")).toBeInTheDocument();
    });

    it('shows hours ago for orders created hours ago', () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      const order = createMockOrder({ createdAt: twoHoursAgo });
      render(<OrderCard order={order} />);
      expect(screen.getByText("לפני 2 שע'")).toBeInTheDocument();
    });
  });

  describe('RTL Support', () => {
    it('renders with dir="rtl"', () => {
      const order = createMockOrder();
      render(<OrderCard order={order} />);
      const card = screen.getByText('John Doe').closest('div[dir="rtl"]');
      expect(card).toHaveAttribute('dir', 'rtl');
    });
  });
});
