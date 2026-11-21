/**
 * Vortex Server — Global error handler.
 */

import type { NextFunction, Request, Response } from 'express';
import { ApiError } from '../errors.js';

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof ApiError) {
    res.status(err.statusCode).json({
      error: err.code,
      message: err.message,
      ...(err.details ? { details: err.details } : {}),
    });
    return;
  }

  // Log unexpected errors
  console.error('[vortex:error]', err);
  res.status(500).json({
    error: 'internal_error',
    message: 'An unexpected error occurred',
  });
}
