import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

declare global {
  namespace Express {
    interface Request {
      requestId: string;
      startTime: number;
    }
  }
}

export function requestIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const existingId = req.headers['x-request-id'] as string | undefined;
  const requestId = existingId ??
    `REQ-${crypto.randomUUID().replace(/-/g, '').substring(0, 12).toUpperCase()}`;

  req.requestId = requestId;
  req.startTime = Date.now();

  res.setHeader('X-Request-ID', requestId);
  next();
}

