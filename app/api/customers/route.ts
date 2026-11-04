import { createDataResponse, createPaginatedResponse, withAuth } from '@/lib/api-middleware';
import { getProductionCustomersService } from '@/lib/services/production';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const customersService = getProductionCustomersService();

const customerCreateSchema = z.object({
  name: z.string().min(1, 'שם הלקוח חובה'),
  email: z.string().email('כתובת אימייל לא תקינה').optional().nullable(),
  phone: z.string().min(9, 'מספר טלפון חייב להכיל לפחות 9 ספרות').optional().nullable(),
  creditLimitCents: z.number().int().min(0).max(10_000_000_00).optional().nullable(),
  paymentTermsDays: z.number().int().min(0).max(360).optional().nullable(),
  accountNotes: z.string().max(2000).optional().nullable(),
  billingAddress: z
    .object({
      city: z.string().min(1, 'עיר חובה'),
      street: z.string().min(1, 'רחוב חובה'),
      number: z.string().min(1, 'מספר בית חובה'),
      floor: z.string().optional().nullable(),
      apartment: z.string().optional().nullable(),
      notes: z.string().optional().nullable(),
      lat: z.number().optional().nullable(),
      lng: z.number().optional().nullable(),
    })
    .optional(),
  shippingAddress: z
    .object({
      city: z.string().min(1, 'עיר חובה'),
      street: z.string().min(1, 'רחוב חובה'),
      number: z.string().min(1, 'מספר בית חובה'),
      floor: z.string().optional().nullable(),
      apartment: z.string().optional().nullable(),
      notes: z.string().optional().nullable(),
      lat: z.number().optional().nullable(),
      lng: z.number().optional().nullable(),
    })
    .optional(),
});

/**
 * Get customers list with filtering and analytics
 * GET /api/customers?query=&page=&perPage=&minTotal=&firstAfter=&firstBefore=
 */
export const GET = withAuth(
  async (request: NextRequest) => {
    try {
      const url = new URL(request.url);
      const searchParams = Object.fromEntries(url.searchParams);

      const pageParam = searchParams.page ? parseInt(searchParams.page) : 1;
      const page = isNaN(pageParam) ? 1 : pageParam;

      const perPageParam = searchParams.perPage ? parseInt(searchParams.perPage) : 50;
      const perPage = isNaN(perPageParam) ? 50 : perPageParam;

      const query = searchParams.query?.trim();

      const result = await customersService.listCustomers({ q: query }, { page, perPage });

      return createPaginatedResponse(result.items, result.pagination);
    } catch (error) {
      console.error('Failed to get customers:', error);

      if (error instanceof z.ZodError) {
        return NextResponse.json(
          {
            success: false,
            error: {
              message: 'Invalid query parameters',
              details: error.errors,
            },
          },
          { status: 400 }
        );
      }

      return NextResponse.json(
        {
          success: false,
          error: {
            message: 'Failed to retrieve customers',
            details: error instanceof Error ? error.message : 'Unknown error',
          },
        },
        { status: 500 }
      );
    }
  },
  { permissions: ['VIEW_CUSTOMERS'] }
);

/**
 * Create new customer
 * POST /api/customers
 */
export const POST = withAuth(
  async (request: NextRequest) => {
    try {
      const body = await request.json();

      // Validate input
      const validatedData = customerCreateSchema.parse(body);

      const customer = await customersService.createCustomer(validatedData);
      const response = createDataResponse(customer);
      return new NextResponse(response.body, {
        status: 201,
        headers: response.headers,
      });
    } catch (error) {
      console.error('Error creating customer:', error);

      if (error instanceof z.ZodError) {
        return NextResponse.json(
          {
            success: false,
            error: {
              message: 'נתונים לא תקינים',
              code: 'VALIDATION_ERROR',
              details: error.errors,
            },
          },
          { status: 400 }
        );
      }

      // Check if it's a connection error
      const errorMessage = error instanceof Error ? error.message : String(error);
      const isConnectionError = /connection|timeout|reset|ECONNRESET|ETIMEDOUT/i.test(errorMessage);

      return NextResponse.json(
        {
          success: false,
          error: {
            message: isConnectionError
              ? 'בעיית תקשורת עם מסד הנתונים. אנא נסה שוב.'
              : 'שגיאה ביצירת לקוח',
            code: isConnectionError ? 'CONNECTION_ERROR' : 'CREATE_ERROR',
            details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
          },
        },
        { status: isConnectionError ? 503 : 500 }
      );
    }
  },
  { permissions: ['EDIT_CUSTOMERS'] }
);
