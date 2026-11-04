import { EntityBadge } from '@/components/shared/display/EntityPrimitives';
import { getEntityToneDotClass, getOrderStatusDisplay } from '@/components/shared/display/displayStatus';
import { getCanonicalStatusLabel, normalizeToCanonicalStatus, type CanonicalOrderStatus } from '@/lib/orderStatus';
import { cn } from '@/lib/utils';
import {
  FileEdit,
  ListTodo,
  PhoneForwarded,
  ShoppingCart,
  PackageSearch,
  Package2,
  Wrench,
  CalendarClock,
  CheckCircle2,
  XCircle,
  Clock,
  Truck,
  Building2,
} from 'lucide-react';
import { memo } from 'react';

interface StatusBadgeProps {
  status: CanonicalOrderStatus | string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
}

const SIZE_CLASSES: Record<NonNullable<StatusBadgeProps['size']>, string> = {
  sm: 'tracking-[0.1em]',
  md: 'tracking-[0.08em]',
  lg: 'tracking-[0.06em]',
};

const STATUS_ICONS: Partial<Record<CanonicalOrderStatus, any>> = {
  DRAFT: FileEdit,
  TO_DO: ListTodo,
  CALL_BACK: PhoneForwarded,
  PO_CREATED: ShoppingCart,
  AWAITING_STOCK: PackageSearch,
  PARTIALLY_SUPPLIED: Package2,
  READY_FOR_INSTALL: Wrench,
  SCHEDULED: CalendarClock,
  COMPLETED: CheckCircle2,
  CANCELLED: XCircle,
  PROCESSING: Clock,
  IN_TRANSIT: Truck,
  INSTALLATION: Building2,
};

export const StatusBadge: React.FC<StatusBadgeProps> = memo(({
  status,
  className = '',
  size = 'md',
  showIcon = false,
}) => {
  const canonicalStatus = normalizeToCanonicalStatus(status);
  const { label, tone } = getOrderStatusDisplay(canonicalStatus);
  const Icon = showIcon ? STATUS_ICONS[canonicalStatus] : undefined;

  return (
    <EntityBadge
      label={label || getCanonicalStatusLabel(canonicalStatus)}
      tone={tone}
      size={size === 'sm' ? 'sm' : size === 'lg' ? 'lg' : 'md'}
      dotClassName={!showIcon ? getEntityToneDotClass(tone) : undefined}
      className={cn(SIZE_CLASSES[size] ?? SIZE_CLASSES.md, className)}
    >
      {Icon && <Icon className="mr-1.5 h-3.5 w-3.5 shrink-0 opacity-80" />}
    </EntityBadge>
  );
});

StatusBadge.displayName = 'StatusBadge';
