import type { TestOrder } from './api-test-helpers';
import { registerTestOrders } from './api-test-helpers';

type SeedOrderInput = Partial<TestOrder>;

export async function seedTestOrders(inputs: SeedOrderInput[]): Promise<TestOrder[]> {
  const orders: TestOrder[] = inputs.map((input, index) => ({
    id: input.id ?? `order-${Date.now()}-${index}`,
    status: input.status ?? 'DRAFT',
    createdById: input.createdById,
    client: input.client ?? null,
    total: input.total ?? 0,
    lineItems: input.lineItems ?? [{ id: `line-${index}`, qty: 1 }],
  }));

  registerTestOrders(orders);
  return orders;
}
