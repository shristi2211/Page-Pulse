import { Request, Response, NextFunction } from 'express';
import { auditRequestSchema } from '../validators/auditValidator';
import { cacheService } from '../cache/cacheService';
import { performAudit } from '../services/auditService';
import logger from '../logger/logger';
import type { AuditResult } from '../types/index';

export async function auditController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const requestId = req.requestId;
  const clientIp =
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ??
    req.socket.remoteAddress ??
    'unknown';

  try {
    // 1. Validate input
    const parseResult = auditRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      const message = parseResult.error.issues[0]?.message ?? 'Please provide a valid HTTP or HTTPS URL.';
      logger.warn({ requestId, body: req.body }, 'Invalid request body');
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

    const { url } = parseResult.data;

    logger.info({ requestId, url, clientIp }, 'Audit request received');

    // 2. Check cache
    const cached = cacheService.get<Omit<AuditResult, 'cached' | 'requestId'>>(url);
    if (cached) {
      logger.info({ requestId, url }, 'Cache HIT — returning cached result');
      res.status(200).json({
        ...cached,
        cached: true,
        requestId,
      });
      return;
    }

    // 3. Perform audit
    const result = await performAudit(url, requestId);

    if (!result.success) {
      const statusMap: Record<string, number> = {
        TIMEOUT: 504,
        UNREACHABLE: 502,
        INVALID_URL: 400,
        AUDIT_FAILED: 500,
      };
      const status = statusMap[result.code] ?? 500;
      res.status(status).json({
        success: false,
        error: {
          code: result.code,
          message: result.message,
        },
        requestId,
      });
      return;
    }

    // 4. Store in cache
    cacheService.set(url, result.data);

    // 5. Return response
    const duration = Date.now() - req.startTime;
    logger.info({ requestId, url, duration, statusCode: result.data.statusCode }, 'Request completed');

    res.status(200).json({
      ...result.data,
      cached: false,
      requestId,
    });
  } catch (err) {
    next(err);
  }
}

