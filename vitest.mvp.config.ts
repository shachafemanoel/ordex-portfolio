import { defineConfig } from 'vitest/config';
import baseConfig from './vitest.config';

// The MVP gate: tests for the internal order flow (orders, statuses, auth) that must stay green.
// Add a file here once it passes; tests for frozen modules keep running in `npm test` only.
export const MVP_TESTS = [
  'tests/auth-expiry.test.ts',
  'tests/auth/auth-consistency.test.ts',
  'tests/auth/production-flags.test.ts',
  'tests/auth/runtime-environment.test.ts',
  'tests/auth/verifySession.test.ts',
  'tests/lib/withAuth.test.ts',
  'tests/orderStatus.test.ts',
  'tests/status-guards.test.ts',
  'tests/status-guards-failure.test.ts',
  'tests/status-machine.test.ts',
  'tests/status-normalization.test.ts',
  'tests/orders/workflow.test.ts',
  'tests/services/statusRecalculation.test.ts',
  'tests/unit/orders-ops.test.ts',
  'tests/unit/orders/computeOrderOpsState.test.ts',
  'tests/unit/orders/next-task.test.ts',
  'tests/unit/orders/view-filter.test.ts',
  'tests/unit/orders/workflowStateMachine.test.ts',
  'tests/unit/services/orders-ops.test.ts',
  'tests/lib/hooks/orders/useOrdersQuery.test.ts',
  'tests/orders/mvp-status-flow.test.ts',
  'tests/orders/payment-departure.test.ts',
  'tests/orders/ordersService.changeOrderStatus.test.ts',
  'tests/integration/status-guards.test.ts',
  'tests/api/orders/orders-api.test.ts',
  'tests/integrations/woo/*.test.ts',
  'tests/tenancy/context-shared-storage.test.ts',
  'tests/tenancy/mvp-routes.test.ts',
];

// mergeConfig would concatenate `include` with the base glob, so replace it explicitly.
export default defineConfig({
  ...baseConfig,
  test: { ...baseConfig.test, include: MVP_TESTS },
});
