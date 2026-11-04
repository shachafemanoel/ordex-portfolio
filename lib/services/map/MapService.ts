import { prisma } from '@/lib/db';

export interface OrdersMapFeatureProperties {
  id: string;
  status: string;
  customerName?: string | null;
  addressLine?: string | null;
  city?: string | null;
  createdAt?: string;
}

export interface OrdersMapFeature {
  type: 'Feature';
  geometry: {
    type: 'Point';
    coordinates: [number, number];
  };
  properties: OrdersMapFeatureProperties;
}

export interface OrdersMapResponse {
  type: 'FeatureCollection';
  features: OrdersMapFeature[];
}

export class MapService {
  async getOrdersMap(limit: number = 200): Promise<OrdersMapResponse> {
    const orders = await (prisma as any).order.findMany({
      take: limit,
      orderBy: { updatedAt: 'desc' },
      include: {
        shippingAddress: true,
      },
    });

    const features = (orders as any[])
      .map((order): OrdersMapFeature | null => {
        const lat =
          order.lat ??
          order.latitude ??
          order.shippingAddress?.lat ??
          order.shippingAddress?.latitude ??
          null;
        const lng =
          order.lng ??
          order.longitude ??
          order.shippingAddress?.lng ??
          order.shippingAddress?.longitude ??
          null;

        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
          return null;
        }

        return {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [Number(lng), Number(lat)],
          },
          properties: {
            id: order.id,
            status: String(order.status),
            customerName: order.customerName ?? order.customer?.name ?? null,
            addressLine: order.addressLine ?? null,
            city: order.city ?? order.shippingAddress?.city ?? null,
            createdAt: order.createdAt ? new Date(order.createdAt).toISOString() : undefined,
          },
        } satisfies OrdersMapFeature;
      })
      .filter((feature): feature is OrdersMapFeature => feature !== null);

    return {
      type: 'FeatureCollection',
      features,
    };
  }
}
