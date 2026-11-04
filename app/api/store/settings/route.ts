import { NextRequest, NextResponse } from 'next/server';

import { withAuth, type AuthenticatedUser } from '@/lib/api-middleware';
import { getEditableStoreSettings, updateStoreSettings } from '@/lib/store-settings';
import { storeSettingsSchema } from '@/lib/store-settings-schema';

export const dynamic = 'force-dynamic';

export const GET = withAuth(
  async () => {
    const settings = await getEditableStoreSettings();

    return NextResponse.json({
      success: true,
      data: settings,
    });
  },
  { roles: ['ADMIN'] }
);

export const PATCH = withAuth(
  async (request: NextRequest, user: AuthenticatedUser) => {
    const body = await request.json();
    const parsed = storeSettingsSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: 'נתוני ההגדרות אינם תקינים',
            details: parsed.error.flatten(),
          },
        },
        { status: 400 }
      );
    }

    const settings = await updateStoreSettings(parsed.data, user.id);

    return NextResponse.json({
      success: true,
      data: settings,
      message: 'הגדרות החנות נשמרו בהצלחה',
    });
  },
  { roles: ['ADMIN'] }
);
