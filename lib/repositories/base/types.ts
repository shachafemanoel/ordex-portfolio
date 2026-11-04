export interface PaginationParams {
  cursor?: string;
  limit: number;
  sortBy?: string;
}

export interface RepositoryResult<T> {
  items: T[];
  total: number;
  hasMore: boolean;
  nextCursor?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: {
    total: number;
    hasMore: boolean;
    nextCursor?: string;
  };
}