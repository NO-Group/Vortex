/**
 * Vortex Server — Validation middleware using Zod.
 */

import type { NextFunction, Request, Response } from 'express';
import type { ZodSchema } from 'zod';
import { ZodError } from 'zod';
import { ApiError } from '../errors.js';

/** Validate req.body against a Zod schema, returning parsed data. */
export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const details = result.error.flatten();
      next(ApiError.badRequest('Validation failed', details));
      return;
    }
    req.body = result.data;
    next();
  };
}

/** Validate req.query against a Zod schema. */
export function validateQuery<T>(schema: ZodSchema<T>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      const details = result.error.flatten();
      next(ApiError.badRequest('Query validation failed', details));
      return;
    }
    Object.assign(req.query, result.data);
    next();
  };
}

/** Handle ZodError thrown in route handlers. */
export function zodErrorHandler(err: unknown, _req: Request, _res: Response, next: NextFunction): void {
  if (err instanceof ZodError) {
    next(ApiError.badRequest('Validation failed', err.flatten()));
    return;
  }
  next(err);
}
