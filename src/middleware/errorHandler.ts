import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import logger from '../logger/logger';

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  const requestId = req.requestId ?? 'UNKNOWN';
  const duration = req.startTime ? Date.now() - req.startTime : 0;

  // Zod validation errors
  if (err instanceof ZodError) {
    const message = err.issues[0]?.message ?? 'Validation failed.';
    logger.warn({ requestId, duration, issues: err.issues }, 'Validation error');
    res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_URL',
        message,
      },
      requestId,
    });
    return;
  }

  // Known application errors
  if (err instanceof AppError) {
    logger.warn({ requestId, duration, code: err.code }, err.message);
    res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
      },
      requestId,
    });
    return;
  }

  // Unknown / unexpected errors
  const message = err instanceof Error ? err.message : 'An unexpected error occurred.';
  logger.error({ requestId, duration, err: message }, 'Unhandled error');
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An internal server error occurred. Please try again later.',
    },
    requestId,
  });
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.path} not found.`,
    },
  });
}

