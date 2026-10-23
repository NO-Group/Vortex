import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { ApiError } from '../errors.js';

/** Terminal error middleware — renders ApiError / ZodError as JSON envelopes. */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof ApiError) {
    if (err.status === 401 || err.status === 403) {
      // Audit trail for auth failures (e.g. proxies dropping credentials).
      // eslint-disable-next-line no-console
      console.warn(
        `[vortex] ${err.status} ${err.code} on ${_req.method} ${_req.path}: ${err.message}`,
      );
    }
    res.status(err.status).json(err.toBody());
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'validation_error',
        message: 'Request validation failed',
        details: err.flatten(),
      },
    });
    return;
  }

  // eslint-disable-next-line no-console
  console.error('[vortex] unhandled error:', err);
  res.status(500).json({
    error: {
      code: 'internal_error',
      message: 'An unexpected error occurred',
    },
  });
}

/** 404 fallback for unknown routes. */
export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({
    error: { code: 'not_found', message: 'Route not found' },
  });
}
