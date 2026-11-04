import { createDataResponse, createErrorResponse, withErrorHandler } from '@/lib/api-middleware';
import { isWebPushConfigured } from '@/lib/push/webPush';
import { NextRequest, NextResponse } from 'next/server';

export const GET = withErrorHandler(async (req: NextRequest) => {
  const key = process.env.VAPID_PUBLIC_KEY?.trim();
  if (!isWebPushConfigured() || !key) {
    return createErrorResponse('Web Push is not configured', 503);
  }
  return createDataResponse({ publicKey: key }, req);
});
