export enum ApiErrorCode {
  VALIDATION_ERROR = "VALIDATION_ERROR",
  GATE_BLOCKED = "GATE_BLOCKED",
  CONFLICT = "CONFLICT",
  NOT_FOUND = "NOT_FOUND",
  PERMISSION_DENIED = "PERMISSION_DENIED",
  INTEGRATION_ERROR = "INTEGRATION_ERROR",
  DATA_INCONSISTENCY = "DATA_INCONSISTENCY",
  INTERNAL_ERROR = "INTERNAL_ERROR"
}

export class ApiError extends Error {
  constructor(
    public code: ApiErrorCode,
    message: string,
    public field?: string,
    public meta?: Record<string, unknown>
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function toHttpResponse(error: unknown) {
  if (error instanceof ApiError) {
    let status = 500;
    switch (error.code) {
      case ApiErrorCode.VALIDATION_ERROR:
        status = 400;
        break;
      case ApiErrorCode.GATE_BLOCKED:
        status = 422;
        break;
      case ApiErrorCode.CONFLICT:
        status = 409;
        break;
      case ApiErrorCode.NOT_FOUND:
        status = 404;
        break;
      case ApiErrorCode.PERMISSION_DENIED:
        status = 403;
        break;
      default:
        status = 500;
    }
    return Response.json(
      {
        ok: false,
        error: {
          code: error.code,
          message: error.message,
          field: error.field,
          meta: error.meta,
        },
      },
      { status }
    );
  }

  console.error("Unexpected error:", error);
  return Response.json(
    {
      ok: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred",
      },
    },
    { status: 500 }
  );
}
