/**
 * UI Components - Centralized Export
 *
 * Single source of truth for all base UI components.
 * Import from here instead of individual files.
 *
 * @example
 * ```tsx
 * import { Button, StatusDisplay, Card, Input } from '@/components/ui';
 * ```
 */

// ============================================================================
// STATUS & BADGES
// ============================================================================

// Use StatusDisplay as the primary status component
export type {
  StatusDisplayProps,
  StatusSize,
  StatusType,
  StatusVariant,
} from '@/components/ui/StatusDisplay';
export {
  StatusDisplay,
  getStatusColorClasses,
  getStatusIcon,
  getStatusLabel,
} from './StatusDisplay';

// Legacy exports for backward compatibility (will be deprecated)
export { StatusBadge } from '@/components/ui/StatusBadge';
export {
  StatusChip,
  getStatusColor as getChipStatusColor,
  useStatusLabel,
} from '@/components/ui/StatusChip';

export { Badge } from '@/components/ui/Badge';

// ============================================================================
// BUTTONS & INTERACTIVE
// ============================================================================

export { Button } from '@/components/ui/Button';
export type { ButtonProps } from '@/components/ui/Button';

// ============================================================================
// FORMS & INPUTS
// ============================================================================

export { Checkbox } from '@/components/ui/Checkbox';
export { Input } from '@/components/ui/Input';
export { Label } from '@/components/ui/Label';
// export { RadioGroup } from '@/components/ui/RadioGroup';
export { Select } from '@/components/ui/Select';
export { Textarea } from '@/components/ui/Textarea';
// export { Switch } from '@/components/ui/Switch';
export { FormField } from '@/components/ui/FormField';

// ============================================================================
// LOADING & FEEDBACK
// ============================================================================

export { Loading } from '@/components/ui/Loading';
export type { LoadingProps } from '@/components/ui/Loading';

export { LoadingSpinner } from '@/components/ui/LoadingSpinner';

export {
  Skeleton,
  SkeletonCard,
  SkeletonForm,
  SkeletonList,
  SkeletonPage,
  SkeletonStatCard,
  SkeletonTable,
  SkeletonText,
} from './SkeletonLoader';
export {
  CardListSkeleton,
  CustomersTableSkeleton,
  DashboardSkeleton,
  FormSkeleton,
  MapWidgetSkeleton,
  OrderDetailsSkeleton,
  OrdersTableSkeleton,
  ReportsSkeleton,
} from './Skeletons';

// export { Spinner } from '@/components/ui/Spinner';
// export { ProgressBar } from '@/components/ui/ProgressBar';

// ============================================================================
// MODALS & OVERLAYS
// ============================================================================

export { Modal } from '@/components/ui/Modal';
export type { ModalProps } from '@/components/ui/Modal';

export { ResponsiveModal } from '@/components/ui/ResponsiveModal';
export type { ResponsiveModalProps } from '@/components/ui/ResponsiveModal';

export { ConfirmDialog } from '@/components/ui/ConfirmDialog';
// export { Dialog } from '@/components/ui/Dialog';
export { Drawer } from '@/components/ui/Drawer';

// ============================================================================
// NOTIFICATIONS & TOASTS
// ============================================================================

export type { Toast } from '@/components/ui/Toast';
export { ToastProvider } from '@/components/ui/ToastProvider';

// ============================================================================
// CARDS & CONTAINERS
// ============================================================================

export {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

// ============================================================================
// TABLES & DATA DISPLAY
// ============================================================================

export { DataTable } from '@/components/ui/DataTable';
export {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/Table';
export { VirtualDataTable } from '@/components/ui/VirtualDataTable';

// ============================================================================
// DROPDOWNS & MENUS
// ============================================================================

// export { Dropdown } from '@/components/ui/Dropdown';
// export { Menu, MenuItem } from '@/components/ui/Menu';
// export { Popover } from '@/components/ui/Popover';
// export { Tooltip } from '@/components/ui/Tooltip';

// ============================================================================
// UTILITIES
// ============================================================================

export { Alert, AlertDescription, AlertTitle } from '@/components/ui/Alert';
// export { Avatar } from '@/components/ui/Avatar';
// export { Divider } from '@/components/ui/Divider';
export { BrandLogo } from '@/components/ui/BrandLogo';
export { EmptyState } from '@/components/ui/EmptyState';
export { ErrorBoundary } from '@/components/ui/ErrorBoundary';
// export { Icon } from '@/components/ui/Icon';
// export { Pagination } from '@/components/ui/Pagination';
export { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';

// ============================================================================
// NOTES
// ============================================================================
//
// **Deprecated Components:**
// - StatusBadge (use StatusDisplay instead)
// - StatusChip (use StatusDisplay instead)
// - LoadingSpinner (use Loading component instead)
// - Legacy modal wrappers (use Modal / ResponsiveModal)
//
// **Usage Guidelines:**
// 1. Always import from this index file, not individual files
// 2. Use StatusDisplay for all status displays (replaces StatusBadge/StatusChip)
// 3. Use design tokens from @/lib/design-tokens for styling
// 4. Ensure all components support RTL
//
