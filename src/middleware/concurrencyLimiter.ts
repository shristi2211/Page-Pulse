import pLimit from 'p-limit';
import { Request, Response, NextFunction } from 'express';
import config from '../config/index';
import logger from '../logger/logger';

const limiter = pLimit(config.concurrency.maxActive);

let activeCount = 0;

export function concurrencyLimiter(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (activeCount >= config.concurrency.maxActive) {
    logger.warn(
      { requestId: req.requestId, activeCount },
      'Concurrency limit reached — rejecting request'
    );
    res.status(503).json({
      success: false,
      error: {
        code: 'SERVER_BUSY',
        message: `Server is busy. Maximum ${config.concurrency.maxActive} concurrent audits allowed. Please try again shortly.`,
      },
    });
    return;
  }

  activeCount++;
  logger.debug({ activeCount }, 'Concurrency slot acquired');

  res.on('finish', () => {
    activeCount--;
    logger.debug({ activeCount }, 'Concurrency slot released');
  });

  res.on('close', () => {
    activeCount--;
    logger.debug({ activeCount }, 'Concurrency slot released (connection closed)');
  });

  next();
}

/** Export limiter for use in service layer if needed */
export { limiter };

