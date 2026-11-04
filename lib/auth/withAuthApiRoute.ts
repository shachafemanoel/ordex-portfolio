import { NextRequest, NextResponse } from 'next/server';
import { AuthenticatedUser } from '@/lib/auth/types';
import { getCurrentUser } from '@/lib/auth/verifySession';

type ApiRouteHandler = (
  req: NextRequest,
  user: AuthenticatedUser,
  ...args: any[]
) => Promise<NextResponse | Response> | NextResponse | Response;

export function withAuthApiRoute(handler: ApiRouteHandler) {
  return async (req: NextRequest, ...args: any[]) => {
    try {
      const user = await getCurrentUser();

      if (!user) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'UNAUTHORIZED',
              message: 'Authentication required'
            }
          },
          { status: 401 }
        );
      }

      // Next.js 15: params is a Promise. Await it if it exists in the first arg (context).
      let context = args[0];
      if (context && context.params && typeof context.params.then === 'function') {
        const resolvedParams = await context.params;
        context = { ...context, params: resolvedParams };
        args[0] = context;
      }

      const result = await handler(req, user, ...args);
      if (result instanceof NextResponse) {
        return result;
      }

      return new NextResponse(result.body, {
        status: result.status,
        statusText: result.statusText,
        headers: result.headers,
      });
    } catch (error) {
      console.error('withAuthApiRoute error:', error);
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication failed'
          }
        },
        { status: 401 }
      );
    }
  };
}
