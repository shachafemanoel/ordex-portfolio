export interface ApiSuccessResponse<T = unknown> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
  timestamp?: string;
  requestId?: string;
  message?: string;
}
