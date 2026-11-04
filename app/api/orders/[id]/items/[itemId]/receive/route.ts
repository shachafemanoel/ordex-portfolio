import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth, createSuccessResponse, type AuthenticatedUser, ValidationError } from '@/lib/api-middleware';
import { ReceivingService } from '@/lib/receiving';

export const dynamic = 'force-dynamic';

const ReceiveItemSchema = z.object({
  qty: z.number().int().min(1, 'Quantity must be positive'),
  notes: z.string().max(1000, 'Notes cannot exceed 1000 characters').optional(),
  photos: z.array(z.string()).max(10, 'Maximum 10 photos allowed').optional(),
});

// PATCH /api/orders/[id]/items/[itemId]/receive
export const PATCH = withAuth(
  async (req: NextRequest, user: AuthenticatedUser, ctx: { params: { id: string; itemId: string } }) => {
    const body = await req.json();
    const parsed = ReceiveItemSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError('Invalid request data', parsed.error.flatten());
    }

    const { qty, notes, photos } = parsed.data;

    // Use the new receiving service
    const result = await ReceivingService.receiveItems({
      orderItemId: ctx.params.itemId,
      quantityReceived: qty,
      notes,
      photos,
      userId: user.id,
      userRole: user.role,
    });

    return createSuccessResponse(
      {
        ...result,
        message: result.orderStatusChanged 
          ? `Received ${qty} units. Order status updated to ${result.newOrderStatus}`
          : `Received ${qty} units`,
        legacy_compatibility: {
          item: result.orderItem, // For backward compatibility
        },
      },
      undefined,
      'Order item received successfully'
    );
  },
  { permissions: ['EDIT_ORDERS'] }
);

