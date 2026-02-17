/**
 * Generic API response types used across all endpoints.
 */

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
}

export interface ApiError {
  statusCode: number;
  message: string | string[];
  error: string;
}

export interface PaginationParams {
  limit?: number;
  offset?: number;
}
