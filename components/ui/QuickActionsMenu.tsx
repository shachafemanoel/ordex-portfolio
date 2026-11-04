'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import {
  CanonicalOrderStatus,
  getCanonicalStatusLabel,
  normalizeToCanonicalStatus,
} from '@/lib/orderStatus';
import { OrderStatus } from '@prisma/client';
import { Button } from '@/components/ui/Button';

interface QuickAction {
  id: string;
  label: string;
  icon: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  shortcut?: string;
}

interface QuickActionsMenuProps {
  orderId: string;
  currentStatus: OrderStatus;
  userRole: 'ADMIN' | 'SALES' | 'PURCHASING' | 'INSTALLER';
  onStatusChange?: (newStatus: OrderStatus) => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
  className?: string;
}

export function QuickActionsMenu({
  orderId,
  currentStatus,
  userRole,
  onStatusChange,
  onEdit,
  onDelete,
  onDuplicate,
  className = '',
}: QuickActionsMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const buttonId = `quick-actions-button-${orderId}`;
  const router = useRouter();
  const canonicalStatus = normalizeToCanonicalStatus(currentStatus);

  type UserRole = QuickActionsMenuProps['userRole'];

  // Close menu on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        !buttonRef.current?.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Focus management when opening
  useEffect(() => {
    if (isOpen) {
      // Small timeout to ensure DOM is ready and prevent scroll jumping
      requestAnimationFrame(() => {
        const firstItem = menuRef.current?.querySelector('[role="menuitem"]');
        if (firstItem instanceof HTMLElement) {
          firstItem.focus();
        }
      });
    }
  }, [isOpen]);

  // Close menu on escape
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleMenuKeyDown = (event: React.KeyboardEvent) => {
    if (!isOpen) return;

    // console.log('Key pressed:', event.key);

    const items = Array.from(menuRef.current?.querySelectorAll('[role="menuitem"]') || []);
    if (items.length === 0) return;

    const currentIndex = items.indexOf(document.activeElement as Element);
    // console.log('Current index:', currentIndex);

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        const nextIndex = currentIndex < items.length - 1 ? currentIndex + 1 : 0;
        // console.log('Focusing next:', nextIndex);
        (items[nextIndex] as HTMLElement).focus();
        break;
      case 'ArrowUp':
        event.preventDefault();
        const prevIndex = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
        (items[prevIndex] as HTMLElement).focus();
        break;
      case 'Home':
        event.preventDefault();
        (items[0] as HTMLElement).focus();
        break;
      case 'End':
        event.preventDefault();
        (items[items.length - 1] as HTMLElement).focus();
        break;
      case 'Tab':
        // Close menu if tabbing out
        setIsOpen(false);
        break;
    }
  };

  const getStatusActions = (): QuickAction[] => {
    const actions: QuickAction[] = [];

    // Status progression actions based on current status and user role
    const statusTransitions: Partial<
      Record<CanonicalOrderStatus, Partial<Record<UserRole, CanonicalOrderStatus[]>>>
    > = {
      DRAFT: {
        ADMIN: ['TO_DO', 'CALL_BACK', 'PO_CREATED', 'CANCELLED'],
        SALES: ['TO_DO', 'CALL_BACK', 'PO_CREATED'],
        PURCHASING: ['PO_CREATED'],
        INSTALLER: [],
      },
      TO_DO: {
        ADMIN: ['CALL_BACK', 'PO_CREATED', 'CANCELLED'],
        SALES: ['CALL_BACK', 'PO_CREATED'],
        PURCHASING: ['PO_CREATED'],
        INSTALLER: [],
      },
      CALL_BACK: {
        ADMIN: ['PO_CREATED', 'CANCELLED'],
        SALES: ['PO_CREATED'],
        PURCHASING: ['PO_CREATED'],
        INSTALLER: [],
      },
      PO_CREATED: {
        ADMIN: ['AWAITING_STOCK', 'READY_FOR_INSTALL', 'CANCELLED'],
        SALES: [],
        PURCHASING: ['AWAITING_STOCK', 'READY_FOR_INSTALL'],
        INSTALLER: [],
      },
      AWAITING_STOCK: {
        ADMIN: ['PARTIALLY_SUPPLIED', 'READY_FOR_INSTALL', 'CANCELLED'],
        SALES: [],
        PURCHASING: ['PARTIALLY_SUPPLIED', 'READY_FOR_INSTALL'],
        INSTALLER: [],
      },
      PARTIALLY_SUPPLIED: {
        ADMIN: ['READY_FOR_INSTALL', 'CANCELLED'],
        SALES: ['READY_FOR_INSTALL'],
        PURCHASING: ['READY_FOR_INSTALL'],
        INSTALLER: [],
      },
      READY_FOR_INSTALL: {
        ADMIN: ['SCHEDULED', 'CANCELLED'],
        SALES: ['SCHEDULED'],
        PURCHASING: [],
        INSTALLER: ['SCHEDULED'],
      },
      SCHEDULED: {
        ADMIN: ['COMPLETED', 'CANCELLED'],
        SALES: ['COMPLETED'],
        PURCHASING: [],
        INSTALLER: ['COMPLETED'],
      },
      COMPLETED: {
        ADMIN: [],
        SALES: [],
        PURCHASING: [],
        INSTALLER: [],
      },
      CANCELLED: {
        ADMIN: ['DRAFT'],
        SALES: [],
        PURCHASING: [],
        INSTALLER: [],
      },
    };

    const statusLabels: Partial<Record<CanonicalOrderStatus, string>> = {
      DRAFT: 'סמן כטיוטה',
      TO_DO: 'לביצוע',
      CALL_BACK: 'חזרה ללקוח',
      PO_CREATED: 'צור הזמנת רכש',
      AWAITING_STOCK: 'ממתין למלאי',
      PARTIALLY_SUPPLIED: 'סופק חלקי',
      READY_FOR_INSTALL: 'מוכן להתקנה',
      SCHEDULED: 'מתוזמן',
      COMPLETED: 'הושלם',
      CANCELLED: 'בוטל',
    };

    const statusIcons: Partial<Record<CanonicalOrderStatus, string>> = {
      DRAFT: '📝',
      TO_DO: '📋',
      CALL_BACK: '📞',
      PO_CREATED: '🛒',
      AWAITING_STOCK: '📦',
      PARTIALLY_SUPPLIED: '📊',
      READY_FOR_INSTALL: '🔧',
      SCHEDULED: '🗓️',
      COMPLETED: '🎉',
      CANCELLED: '❌',
    };

    const availableTransitions = statusTransitions[canonicalStatus]?.[userRole] || [];

    availableTransitions.forEach((status) => {
      actions.push({
        id: `status-${status}`,
        label: statusLabels[status] || getCanonicalStatusLabel(status),
        icon: statusIcons[status] || '⚡',
        onClick: () => {
          onStatusChange?.(status as OrderStatus);
          setIsOpen(false);
        },
        danger: status === 'CANCELLED',
      });
    });

    return actions;
  };

  const getGeneralActions = (): QuickAction[] => {
    const actions: QuickAction[] = [];

    // Edit action
    if (onEdit && (userRole === 'ADMIN' || userRole === 'SALES')) {
      actions.push({
        id: 'edit',
        label: 'ערוך הזמנה',
        icon: '✏️',
        onClick: () => {
          onEdit();
          setIsOpen(false);
        },
        shortcut: 'E',
      });
    }

    // Duplicate action
    if (onDuplicate) {
      actions.push({
        id: 'duplicate',
        label: 'שכפל הזמנה',
        icon: '📋',
        onClick: () => {
          onDuplicate();
          setIsOpen(false);
        },
        shortcut: 'D',
      });
    }

    // View details
    actions.push({
      id: 'view',
      label: 'פרטים מלאים',
      icon: '👁️',
      onClick: () => {
        // console.log('Navigating to:', `/orders/${orderId}`);
        router.push(`/orders/${orderId}`);
      },
      shortcut: 'V',
    });

    // Print/Export
    actions.push({
      id: 'print',
      label: 'הדפס',
      icon: '🖨️',
      onClick: () => {
        window.open(`/orders/${orderId}/print`, '_blank');
        setIsOpen(false);
      },
      shortcut: 'P',
    });

    // Delete action (admin only)
    if (onDelete && userRole === 'ADMIN') {
      actions.push({
        id: 'delete',
        label: 'מחק הזמנה',
        icon: '🗑️',
        onClick: () => {
          onDelete();
          setIsOpen(false);
        },
        danger: true,
        shortcut: 'Delete',
      });
    }

    return actions;
  };

  const statusActions = getStatusActions();
  const generalActions = getGeneralActions();
  const hasActions = statusActions.length > 0 || generalActions.length > 0;

  if (!hasActions) {
    return (
      <Button variant="outline" size="sm" disabled>
        אין פעולות זמינות
      </Button>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <Button
        id={buttonId}
        ref={buttonRef}
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1"
        aria-haspopup="true"
        aria-expanded={isOpen}
        aria-controls="quick-actions-menu"
      >
        <span aria-hidden="true">⚡</span>
        <span>פעולות</span>
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </Button>

      {isOpen && (
        <div
          id="quick-actions-menu"
          ref={menuRef}
          className="absolute left-0 mt-2 w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1 focus:outline-none"
          role="menu"
          aria-orientation="vertical"
          aria-labelledby={buttonId}
          onKeyDown={handleMenuKeyDown}
        >
          {/* Status Actions */}
          {statusActions.length > 0 && (
            <>
              <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100">
                עדכון סטטוס
              </div>
              {statusActions.map((action) => (
                <button
                  key={action.id}
                  type="button"
                  className={`w-full text-right px-3 py-2 text-sm hover:bg-gray-100 flex items-center gap-3 focus:outline-none focus:bg-gray-100 ${
                    action.danger ? 'text-red-700 hover:bg-red-50 focus:bg-red-50' : 'text-gray-700'
                  } ${action.disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                  onClick={action.onClick}
                  disabled={action.disabled}
                  role="menuitem"
                  aria-label={action.label}
                  aria-keyshortcuts={action.shortcut}
                  tabIndex={-1} // Make items focusable only via arrows or programmatic focus
                >
                  <span aria-hidden="true">{action.icon}</span>
                  <span className="flex-1">{action.label}</span>
                  {action.shortcut && (
                    <span className="text-xs text-gray-400 bg-gray-100 px-1 rounded">
                      {action.shortcut}
                    </span>
                  )}
                </button>
              ))}
            </>
          )}

          {/* General Actions */}
          {generalActions.length > 0 && (
            <>
              {statusActions.length > 0 && <div className="border-t border-gray-100 my-1" />}
              <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                פעולות כלליות
              </div>
              {generalActions.map((action) => (
                <button
                  key={action.id}
                  type="button"
                  className={`w-full text-right px-3 py-2 text-sm hover:bg-gray-100 flex items-center gap-3 focus:outline-none focus:bg-gray-100 ${
                    action.danger ? 'text-red-700 hover:bg-red-50 focus:bg-red-50' : 'text-gray-700'
                  } ${action.disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                  onClick={action.onClick}
                  disabled={action.disabled}
                  role="menuitem"
                  aria-label={action.label}
                  aria-keyshortcuts={action.shortcut}
                  tabIndex={-1}
                >
                  <span aria-hidden="true">{action.icon}</span>
                  <span className="flex-1">{action.label}</span>
                  {action.shortcut && (
                    <span className="text-xs text-gray-400 bg-gray-100 px-1 rounded">
                      {action.shortcut}
                    </span>
                  )}
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
