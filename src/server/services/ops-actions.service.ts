import { ordersService } from '@/src/server/domain/orders/service';
export { ActionError } from '@/src/server/domain/orders/actions/error';
export type { OpsActionType, ActionPayload, DeferReason } from '@/src/server/domain/orders/dto';

export const executeAction = ordersService.executeAction.bind(ordersService);
