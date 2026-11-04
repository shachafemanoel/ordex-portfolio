import {
  getCustomersService,
  getDashboardService,
  getOrdersService,
} from '@/lib/services/ServiceFactory';

export function getProductionOrdersService() {
  return getOrdersService();
}

export function getProductionCustomersService() {
  return getCustomersService();
}

export function getProductionDashboardService() {
  return getDashboardService();
}
