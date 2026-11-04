import {
  createErrorResponse,
  createSuccessResponse,
  handleApiError,
  withAuth,
} from '@/lib/api-middleware';
import type { AuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { WooCommerceEnrichmentService } from '@/lib/services/woocommerceEnrichment';
import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Manual order enrichment endpoint
 * POST /api/orders/[id]/enrich
 */
export const POST = withAuth(
  async (
    _request: NextRequest,
    user: AuthenticatedUser,
    { params }: { params: { id: string } }
  ) => {
    const orderId = params.id;

    try {
      logger.info('Manual order enrichment requested', {
        orderId,
        component: 'order-enrichment',
      });

      // Validate order exists and is from WooCommerce
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        select: {
          id: true,
          number: true,
          wooOrderId: true,
          status: true,
          enrichmentAttempts: true,
          lastEnrichmentAt: true,
        },
      });

      if (!order) {
        logger.warn('Order not found for enrichment', {
          orderId,
          component: 'order-enrichment',
        });

        return createErrorResponse('Order not found', 404);
      }

      if (!order.wooOrderId) {
        logger.warn('Order is not from WooCommerce - cannot enrich', {
          orderId,
          orderNumber: order.number,
          component: 'order-enrichment',
        });

        return createErrorResponse('Order is not from WooCommerce and cannot be enriched', 400);
      }

      // Attempt enrichment
      const enrichmentResult = await WooCommerceEnrichmentService.enrichOrder(orderId);

      if (enrichmentResult.success) {
        logger.info('Manual enrichment successful', {
          orderId,
          orderNumber: order.number,
          wooOrderId: order.wooOrderId,
          wasComplete: enrichmentResult.completeness?.isComplete,
          component: 'order-enrichment',
        });

        return createSuccessResponse(
          {
            order: {
              id: orderId,
              number: order.number,
              wooOrderId: order.wooOrderId,
            },
            completeness: enrichmentResult.completeness,
            enrichmentAttempts: (order.enrichmentAttempts || 0) + 1,
          },
          undefined,
          enrichmentResult.completeness?.isComplete
            ? 'Order enriched successfully - order is now complete'
            : 'Order enriched but still requires additional information'
        );
      } else {
        logger.warn('Manual enrichment failed', {
          orderId,
          orderNumber: order.number,
          wooOrderId: order.wooOrderId,
          error: enrichmentResult.error,
          attempts: order.enrichmentAttempts,
          component: 'order-enrichment',
        });

        return createErrorResponse(enrichmentResult.error || 'Enrichment failed', 400, {
          order: {
            id: orderId,
            number: order.number,
            wooOrderId: order.wooOrderId,
          },
          enrichmentAttempts: order.enrichmentAttempts,
          canRetry: (order.enrichmentAttempts || 0) < 3,
        });
      }
    } catch (error) {
      logger.error(
        'Manual enrichment endpoint error',
        error instanceof Error ? error : new Error(String(error)),
        {
          orderId,
          component: 'order-enrichment',
        }
      );

      return handleApiError(error, _request);
    }
  }
);

/**
 * Get enrichment statistics for an order
 * GET /api/orders/[id]/enrich
 */
export const GET = withAuth(
  async (
    _request: NextRequest,
    user: AuthenticatedUser,
    { params }: { params: { id: string } }
  ) => {
    const orderId = params.id;

    try {
      // Get order enrichment details
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        select: {
          id: true,
          number: true,
          wooOrderId: true,
          status: true,
          enrichmentAttempts: true,
          lastEnrichmentAt: true,
        },
      });

      if (!order) {
        return createErrorResponse('Order not found', 404);
      }

      // TODO: Implement completeness checks when enrichment fields are added to schema
      const isComplete = true; // Placeholder - check actual fields when available
      const canEnrich = !!order.wooOrderId && (order.enrichmentAttempts || 0) < 3;
      const needsEnrichment = !isComplete && canEnrich;

      return createSuccessResponse({
        order: {
          id: order.id,
          number: order.number,
          wooOrderId: order.wooOrderId,
          status: order.status,
        },
        completeness: {
          // TODO: Add these fields when schema supports them
          // hasBilling: order.hasBilling,
          // hasShipping: order.hasShipping,
          // hasLineItems: order.hasLineItems,
          // hasTotals: order.hasTotals,
          isComplete,
        },
        enrichment: {
          attempts: order.enrichmentAttempts,
          lastAttempt: order.lastEnrichmentAt,
          canEnrich,
          needsEnrichment,
          maxAttempts: 3,
        },
      });
    } catch (error) {
      logger.error(
        'Get enrichment stats error',
        error instanceof Error ? error : new Error(String(error)),
        {
          orderId,
          component: 'order-enrichment',
        }
      );

      return handleApiError(error, _request);
    }
  }
);
