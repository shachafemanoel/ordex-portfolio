import { ApiError, ValidationError } from '@/lib/api-middleware';
import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

/**
 * Shared error response payload (server → client)
 */
export type ApiErrorBody = {
  ok: false;
  error: string;
  detail?: unknown;
  /** Human-readable reason, shown to the user as-is (Hebrew). */
  message?: string;
  /**
   * Backwards compatibility for legacy clients expecting `success: false`
   */
  success?: false;
};

const errorResponse = (status: number, error: string, detail?: unknown, message?: string) =>
  NextResponse.json(
    {
      ok: false,
      error,
      ...(detail !== undefined ? { detail } : {}),
      ...(message ? { message } : {}),
      success: false,
    } satisfies ApiErrorBody,
    { status }
  );

export const asBadRequest = (detail?: unknown) => errorResponse(400, 'validation_error', detail);
export const asNotFound = (detail?: unknown) => errorResponse(404, 'not_found', detail);
export const asConflict = (detail?: unknown) => errorResponse(409, 'conflict', detail);
export const asFkViolation = (detail?: unknown) =>
  errorResponse(400, 'foreign_key_violation', detail);
export const asInternal = (detail?: unknown) => errorResponse(500, 'internal_error', detail);

/**
 * Domain-level error that carries an HTTP status and machine-friendly code.
 */
export class DomainError extends Error {
  constructor(
    public code: string,
    public status: number = 400,
    public detail?: unknown
  ) {
    super(code);
    this.name = 'DomainError';

    if (typeof detail === 'string' && detail.trim()) {
      this.message = detail;
    } else if (detail && typeof detail === 'object' && 'message' in (detail as any)) {
      const msg = (detail as any).message;
      if (typeof msg === 'string' && msg.trim()) {
        this.message = msg;
      }
    }
  }
}

/**
 * Map Prisma known request errors to domain HTTP responses.
 */
export function mapPrismaError(error: unknown) {
  const code = typeof (error as any)?.code === 'string' ? (error as any).code : undefined;
  if (!code) return null;

  switch (code) {
    case 'P2002':
      return asConflict((error as any)?.meta);
    case 'P2003':
      return asFkViolation((error as any)?.meta);
    case 'P2001': // record not found
    case 'P2025': // record does not exist
      return asNotFound((error as any)?.meta);
    case 'P2011': // null constraint
    case 'P2012': // missing required value
    case 'P2014': // relation violation
    case 'P2016': // query interpretation
    case 'P2017': // relation different relations
    case 'P2019': // input error
    case 'P2020': // value out of range
    case 'P2023': // inconsistent column data (e.g., invalid UUID)
      return asBadRequest((error as any)?.meta || { code, message: (error as any)?.message });
    default:
      return null;
  }
}

/**
 * Map domain/Zod/Prisma errors to HTTP responses.
 */
export function mapErrorToResponse(error: unknown) {
  if (error instanceof Error) {
    const message = error.message || '';
    const name = error.name || '';

    const missingDatabaseUrl =
      name === 'PrismaClientConstructorValidationError' ||
      name === 'PrismaClientInitializationError' ||
      message.includes('Invalid value undefined for datasource "db"');

    if (missingDatabaseUrl) {
      return errorResponse(500, 'database_not_configured', {
        message:
          'DATABASE_URL is not configured. Set the DATABASE_URL environment variable so the application can connect to PostgreSQL.',
      });
    }
  }

  if (error instanceof DomainError) {
    return errorResponse(error.status, error.code, error.detail);
  }

  if (error instanceof ZodError) {
    return asBadRequest(error.issues);
  }

  if (error instanceof ValidationError) {
    return errorResponse(error.statusCode, error.code, error.details || error.message, error.message);
  }

  if (error instanceof ApiError) {
    return errorResponse(error.statusCode, error.code, error.details || error.message, error.message);
  }

  const prisma = mapPrismaError(error);
  if (prisma) return prisma;

  return null;
}
