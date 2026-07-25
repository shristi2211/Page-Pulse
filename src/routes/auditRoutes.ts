import { Router } from 'express';
import { auditController } from '../controllers/auditController';
import { concurrencyLimiter } from '../middleware/concurrencyLimiter';

const router = Router();

/**
 * @openapi
 * /audit:
 *   post:
 *     summary: Audit a URL
 *     tags: [Audit]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - url
 *             properties:
 *               url:
 *                 type: string
 *                 example: https://google.com
 *     responses:
 *       200:
 *         description: Successful audit result
 *       400:
 *         description: Invalid URL
 *       429:
 *         description: Rate limit exceeded
 *       503:
 *         description: Server busy (concurrency limit)
 *       504:
 *         description: Timeout
 */
router.post('/audit', concurrencyLimiter, auditController);

export default router;

