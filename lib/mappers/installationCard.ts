import { InstallationTask, Task } from '@prisma/client';

export interface UnscheduledOrderDTO {
  id: string;
  number: string;
  customer: string;
  location: string;
  priority: string;
  daysWaiting: number;
  lat?: number | null;
  lng?: number | null;
  orderDetails: any; // Ideally this should be a partial Order type
}

// Matches the shape expected by OperationsDashboardService and likely the UI
export interface OperationsInstallationDTO {
  id: string;
  orderId: string;
  time: Date;
  customer: string;
  address: string;
  technician: string;
  status: string;
  lat?: number | null;
  lng?: number | null;
  orderDetails: any; // Or specific Order type
}

type OrderSubset = {
  id: string;
  number: string;
  customerName?: string | null;
  customerPhone?: string | null;
  addressLine?: string | null;
  addressRaw?: string | null;
  city?: string | null;
  lat?: number | null;
  lng?: number | null;
  customer?: { name: string } | null;
  [key: string]: any; // Allow other fields from Order
};

type InstallationInput =
  | (InstallationTask & {
      order: OrderSubset;
      technician?: { name: string } | null;
    })
  | (Task & {
      order: OrderSubset;
      assignee?: { id: string; name: string; image?: string | null } | null;
      technician?: { name: string } | null;
    });

export function mapInstallationCard(task: InstallationInput): OperationsInstallationDTO {
  // Resolve customer name with fallbacks
  const customerName = task.order.customerName || task.order.customer?.name || 'לקוח';

  // Helper to safely get properties
  const isInstallationTask = (t: InstallationInput): t is InstallationTask & { order: OrderSubset } => {
    return 'scheduledDate' in t;
  };

  const currentTask = task;

  let address = 'לא צוין';
  let technicianName = 'לא משובץ';
  let time = new Date();
  let lat: number | null = null;
  let lng: number | null = null;

  if (isInstallationTask(currentTask)) {
    // It's an InstallationTask
    address =
      currentTask.location_address ||
      currentTask.order.addressLine ||
      currentTask.order.addressRaw ||
      currentTask.location_city ||
      currentTask.order.city ||
      'לא צוין';

    technicianName = currentTask.technician?.name || 'לא משובץ';
    time = currentTask.scheduledDate;
    lat = currentTask.order.lat ?? null;
    lng = currentTask.order.lng ?? null;
  } else {
    // It's a generic Task
    address =
      (currentTask as any).address ||
      currentTask.order.addressLine ||
      currentTask.order.addressRaw ||
      (currentTask as any).city ||
      currentTask.order.city ||
      'לא צוין';

    technicianName = currentTask.technician?.name || currentTask.assignee?.name || 'לא משובץ';
    time = currentTask.dueAt || new Date(); // Fallback
    lat = (currentTask as any).lat ?? currentTask.order.lat ?? null;
    lng = (currentTask as any).lng ?? currentTask.order.lng ?? null;
  }

  // Common status
  const status = currentTask.status;

  return {
    id: currentTask.id,
    orderId: currentTask.order.id,
    time,
    customer: customerName,
    address,
    technician: technicianName,
    status,
    lat,
    lng,
    orderDetails: currentTask.order,
  };
}
