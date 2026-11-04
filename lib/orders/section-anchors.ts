export const ORDER_SECTION_ANCHORS = {
  summary: '#summary',
  items: '#items',
  procurement: '#procurement',
  'goods-receipt': '#goods-receipt',
  installation: '#installation',
  status: '#status',
  history: '#history',
} as const;

export type OrderSectionKey = keyof typeof ORDER_SECTION_ANCHORS;

export const ORDER_SECTION_IDS: Record<OrderSectionKey, string> = Object.fromEntries(
  Object.entries(ORDER_SECTION_ANCHORS).map(([key, value]) => [key, value.replace('#', '')])
) as Record<OrderSectionKey, string>;

export function getSectionAnchor(section: OrderSectionKey): string {
  return ORDER_SECTION_ANCHORS[section];
}

export function getSectionId(section: OrderSectionKey): string {
  return ORDER_SECTION_IDS[section];
}
