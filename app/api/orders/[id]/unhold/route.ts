export const dynamic = 'force-dynamic';

import {
  createDataResponse,
  withAuth,
  type AuthenticatedUser,
} from '@/lib/api-middleware';
import { getOrdersService } from '@/lib/services/ServiceFactory';
import { NextRequest } from 'next/server';

export const POST = withAuth(
  async (req: NextRequest, user: AuthenticatedUser, { params }: { params: { id: string } }) => {
    const service = getOrdersService();
    const order = await service.unholdOrder(params.id, user.id);
    return createDataResponse(order, req);
  }
);
