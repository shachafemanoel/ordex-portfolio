import { ScheduleInstallationModal as BaseModal } from '@/components/installations/ScheduleInstallationModal';
import { Order } from '@/lib/types';
import { useState } from 'react';

interface ScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  entity: Order;
  onConfirm: (payload: any) => Promise<void>;
  title?: string;
  description?: string;
}

export function ScheduleModal({ isOpen, onClose, entity, onConfirm }: ScheduleModalProps) {
  const [isLoading, setIsLoading] = useState(false);

  // Map Order to AgentInstallationCandidate structure expected by BaseModal
  const candidate = {
      id: entity.id,
      orderNumber: entity.number,
      customerName: entity.customerName || 'לקוח',
      installationDate: entity.scheduledAt,
      assignedUserId: entity.assignedUserId,
      installerNotes: entity.installerNotes,
      notes: entity.notes,
      city: entity.shippingAddress?.city || entity.city,
      street: entity.shippingAddress?.street || entity.street,
      houseNumber: entity.shippingAddress?.number || entity.houseNumber,
      floor: entity.shippingAddress?.floor || entity.floor,
      apartment: entity.shippingAddress?.apartment || entity.apartment,
      lat: entity.lat ?? entity.shippingAddress?.lat,
      lng: entity.lng ?? entity.shippingAddress?.lng
  } as any;

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      order={candidate}
      technicians={[]} // Technicians list would typically come from a hook or context
      onConfirm={async (payload) => {
          setIsLoading(true);
          try {
              await onConfirm(payload);
              onClose();
          } finally {
              setIsLoading(false);
          }
      }}
      isLoading={isLoading}
    />
  );
}
