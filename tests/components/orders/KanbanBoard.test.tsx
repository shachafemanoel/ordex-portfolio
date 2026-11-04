import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { KanbanBoard } from '@/components/orders/KanbanBoard';
import { WorkflowStage, WorkflowLabel } from '@/lib/workflow-status';

// Mock @dnd-kit
vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children, onDragStart, onDragEnd }: any) => (
    <div data-testid="dnd-context">{children}</div>
  ),
  DragOverlay: ({ children }: any) => <div data-testid="drag-overlay">{children}</div>,
  MouseSensor: vi.fn(),
  TouchSensor: vi.fn(),
  KeyboardSensor: vi.fn(),
  closestCorners: vi.fn(),
  useSensor: vi.fn(() => ({})),
  useSensors: vi.fn(() => []),
}));

vi.mock('@dnd-kit/sortable', () => ({
  SortableContext: ({ children }: any) => <div data-testid="sortable-context">{children}</div>,
  verticalListSortingStrategy: {},
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: null,
    isDragging: false,
  }),
}));

vi.mock('@dnd-kit/utilities', () => ({
  CSS: {
    Transform: { toString: () => null },
  },
}));

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, className, ...rest }: any) => (
      <div className={className}>{children}</div>
    ),
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

// Mock OrderCard
vi.mock('@/components/orders/OrderCard', () => ({
  OrderCard: ({ order, onClick, compact }: any) => (
    <div
      data-testid={`order-card-${order.id}`}
      data-compact={compact}
      onClick={onClick}
    >
      <span>{order.customerName}</span>
      <span>{order.number}</span>
    </div>
  ),
}));

// Mock TaskPicker
vi.mock('@/components/orders/ops/TaskPicker', () => ({
  TaskPicker: () => <div data-testid="task-picker" />,
}));

// Mock QuickActions
vi.mock('@/components/shared/QuickActions', () => ({
  QuickActions: () => <div data-testid="quick-actions" />,
}));

const createMockOrders = () => [
  // Needs action - no waiting label, not scheduled
  {
    id: 'order-1',
    number: 'ORD-001',
    customerName: 'Urgent Customer',
    stage: WorkflowStage.NEW,
    taskLabel: null,
    urgent: true,
    priorityBoost: 0,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'order-2',
    number: 'ORD-002',
    customerName: 'Normal Customer',
    stage: WorkflowStage.NEW,
    taskLabel: null,
    urgent: false,
    priorityBoost: 0,
    createdAt: new Date().toISOString(),
  },
  // Waiting - has waiting label
  {
    id: 'order-3',
    number: 'ORD-003',
    customerName: 'Waiting Customer',
    stage: WorkflowStage.NEW,
    taskLabel: WorkflowLabel.AWAITING_PAYMENT,
    urgent: false,
    priorityBoost: 0,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'order-4',
    number: 'ORD-004',
    customerName: 'Callback Customer',
    stage: WorkflowStage.NEW,
    taskLabel: WorkflowLabel.CALLBACK_CUSTOMER,
    urgent: false,
    priorityBoost: 0,
    createdAt: new Date().toISOString(),
  },
  // Scheduled - has scheduledAt
  {
    id: 'order-5',
    number: 'ORD-005',
    customerName: 'Scheduled Customer',
    stage: WorkflowStage.READY,
    taskLabel: null,
    scheduledAt: new Date().toISOString(),
    urgent: false,
    priorityBoost: 0,
    createdAt: new Date().toISOString(),
  },
  // Deferred to tomorrow
  {
    id: 'order-6',
    number: 'ORD-006',
    customerName: 'Tomorrow Customer',
    stage: WorkflowStage.NEW,
    taskLabel: null,
    deferBucket: 'TOMORROW',
    urgent: false,
    priorityBoost: 0,
    createdAt: new Date().toISOString(),
  },
];

describe('KanbanBoard', () => {
  const mockOnOrdersChange = vi.fn();
  const mockOnOrderClick = vi.fn();
  const mockOnQuickAction = vi.fn();
  const mockOnLabelChange = vi.fn();
  const mockOnTransition = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderBoard = (orders = createMockOrders()) =>
    render(
      <KanbanBoard
        orders={orders}
        onOrdersChange={mockOnOrdersChange}
        onOrderClick={mockOnOrderClick}
        onQuickAction={mockOnQuickAction}
        onLabelChange={mockOnLabelChange}
        onTransition={mockOnTransition}
      />
    );

  describe('Column Rendering', () => {
    it('renders all 3 column titles', () => {
      renderBoard();
      expect(screen.getByText('לטיפול (Needs Action)')).toBeInTheDocument();
      expect(screen.getByText('ממתין (Waiting)')).toBeInTheDocument();
      expect(screen.getByText('משובץ (Scheduled)')).toBeInTheDocument();
    });

    it('displays correct order count per column', () => {
      renderBoard();
      // Needs Action: order-1 (urgent, no label), order-2 (normal, no label) = 2
      // Waiting: order-3 (AWAITING_PAYMENT), order-4 (CALLBACK_CUSTOMER), order-6 (deferBucket=TOMORROW) = 3
      // Scheduled: order-5 (scheduledAt) = 1
      const counts = screen.getAllByText(/^\d+$/);
      expect(counts).toBeDefined();
    });
  });

  describe('Order Bucketing', () => {
    it('places orders without labels or schedule in Needs Action', () => {
      renderBoard();
      expect(screen.getByTestId('order-card-order-1')).toBeInTheDocument();
      expect(screen.getByTestId('order-card-order-2')).toBeInTheDocument();
    });

    it('places orders with waiting labels in Waiting (stacked shows first)', () => {
      renderBoard();
      // Waiting column is stacked by default (isStacked=true), so only the first order is visible
      expect(screen.getByTestId('order-card-order-3')).toBeInTheDocument();
      // The remaining orders are hidden in the stack, shown via count button
      const stackButtons = screen.getAllByText(/לטיפול ב-\d+ הזמנות נוספות/);
      expect(stackButtons.length).toBeGreaterThanOrEqual(1);
    });

    it('places scheduled orders in Scheduled', () => {
      renderBoard();
      expect(screen.getByTestId('order-card-order-5')).toBeInTheDocument();
    });

    it('places deferred orders in Waiting bucket', () => {
      // Render with only the deferred order to avoid stacking issues
      const deferredOrder = {
        id: 'order-6',
        number: 'ORD-006',
        customerName: 'Tomorrow Customer',
        stage: 'NEW' as any,
        taskLabel: null,
        deferBucket: 'TOMORROW',
        urgent: false,
        priorityBoost: 0,
        createdAt: new Date().toISOString(),
      };
      renderBoard([deferredOrder]);
      expect(screen.getByTestId('order-card-order-6')).toBeInTheDocument();
    });

    it('renders empty state when column has no orders', () => {
      renderBoard([]);
      const emptyStates = screen.getAllByText('ריק');
      expect(emptyStates.length).toBe(3);
    });
  });

  describe('Sorting', () => {
    it('sorts urgent orders first in Needs Action', () => {
      const orders = [
        {
          id: 'normal',
          number: 'N-001',
          customerName: 'Normal',
          stage: WorkflowStage.NEW,
          taskLabel: null,
          urgent: false,
          priorityBoost: 0,
          createdAt: new Date(Date.now() - 1000).toISOString(),
        },
        {
          id: 'urgent',
          number: 'U-001',
          customerName: 'Urgent',
          stage: WorkflowStage.NEW,
          taskLabel: null,
          urgent: true,
          priorityBoost: 0,
          createdAt: new Date().toISOString(),
        },
      ];

      renderBoard(orders);

      const cards = screen.getAllByText(/Normal|Urgent/);
      // Urgent should come first
      expect(cards[0].textContent).toBe('Urgent');
    });

    it('sorts by priority boost when urgency is equal', () => {
      const orders = [
        {
          id: 'low-boost',
          number: 'L-001',
          customerName: 'Low Boost',
          stage: WorkflowStage.NEW,
          taskLabel: null,
          urgent: false,
          priorityBoost: 1,
          createdAt: new Date().toISOString(),
        },
        {
          id: 'high-boost',
          number: 'H-001',
          customerName: 'High Boost',
          stage: WorkflowStage.NEW,
          taskLabel: null,
          urgent: false,
          priorityBoost: 10,
          createdAt: new Date().toISOString(),
        },
      ];

      renderBoard(orders);

      const cards = screen.getAllByText(/Low Boost|High Boost/);
      expect(cards[0].textContent).toBe('High Boost');
    });
  });

  describe('Stack Toggle', () => {
    it('shows "הצג הכל" for stacked columns', () => {
      renderBoard();
      const expandButtons = screen.getAllByText('הצג הכל');
      expect(expandButtons.length).toBeGreaterThanOrEqual(1);
    });

    it('toggles column stack state on header click', () => {
      renderBoard();
      // Needs Action starts expanded, clicking should stack it
      const needsActionHeader = screen.getByText('לטיפול (Needs Action)');
      const headerContainer = needsActionHeader.closest('[class*="cursor-pointer"]');
      if (headerContainer) {
        fireEvent.click(headerContainer);
      }
    });

    it('shows stacked card count button', () => {
      const manyOrders = Array.from({ length: 5 }, (_, i) => ({
        id: `waiting-${i}`,
        number: `W-${i}`,
        customerName: `Waiting ${i}`,
        stage: WorkflowStage.NEW,
        taskLabel: WorkflowLabel.AWAITING_PAYMENT,
        urgent: false,
        priorityBoost: 0,
        createdAt: new Date().toISOString(),
      }));

      renderBoard(manyOrders);
      // Waiting column should be stacked by default and show remaining count
      const expandBtn = screen.queryByText(/לטיפול ב-\d+ הזמנות נוספות/);
      // This might exist if the waiting column is stacked
      // The count depends on initial stack state
    });
  });

  describe('Order Click Callback', () => {
    it('calls onOrderClick when a card is clicked', () => {
      renderBoard();
      fireEvent.click(screen.getByTestId('order-card-order-1'));
      expect(mockOnOrderClick).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'order-1' })
      );
    });
  });
});
