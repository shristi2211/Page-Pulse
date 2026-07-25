import { Router, Request, Response } from 'express';
import { cacheService } from '../cache/cacheService';

const router = Router();

/**
 * @openapi
 * /health:
 *   get:
 *     summary: Health check endpoint
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Service is healthy
 */
router.get('/health', (_req: Request, res: Response) => {
  const stats = cacheService.getStats();
  res.status(200).json({
    status: 'healthy',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    cache: stats,
    version: process.env['npm_package_version'] ?? '1.0.0',
    environment: process.env['NODE_ENV'] ?? 'development',
  });
});

export default router;

