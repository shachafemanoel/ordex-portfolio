export const READY_SHIPMENT_STATUSES = [
  'READY',
  'READY_FOR_INSTALL',
  'INSTALL_SCHEDULING',
] as const;

type ReadyShipmentCandidate = {
  status: string;
  scheduledAt?: string | null;
};

export function isReadyForShipment(item: ReadyShipmentCandidate) {
  return !item.scheduledAt && READY_SHIPMENT_STATUSES.includes(item.status as (typeof READY_SHIPMENT_STATUSES)[number]);
}
