import type { ApiErrorBody } from '@vortex/core';

/**
 * Typed HTTP error with a stable machine-readable code.
 * Thrown from services and rendered by the global error middleware.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  toBody(): ApiErrorBody {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.details !== undefined ? { details: this.details } : {}),
      },
    };
  }

  static badRequest(message: string, details?: unknown): ApiError {
    return new ApiError(400, 'bad_request', message, details);
  }

  static unauthorized(message = 'Authentication required'): ApiError {
    return new ApiError(401, 'unauthorized', message);
  }

  static forbidden(message = 'Insufficient permissions'): ApiError {
    return new ApiError(403, 'forbidden', message);
  }

  static notFound(message = 'Resource not found'): ApiError {
    return new ApiError(404, 'not_found', message);
  }

  static conflict(message: string, details?: unknown): ApiError {
    return new ApiError(409, 'conflict', message, details);
  }

  /**
   * The planner says this query costs more than the operator allows.
   * Supabase would have run it and billed you; Vortex declines up front
   * with the cost it measured and the ceiling it breached.
   */
  static tooExpensive(cost: number, limit: number, details?: unknown): ApiError {
    return new ApiError(
      429,
      'query_too_expensive',
      `Query plan cost ${cost} exceeds the configured ceiling of ${limit}`,
      details,
    );
  }
}
