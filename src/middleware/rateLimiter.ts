import rateLimit from 'express-rate-limit';
import config from '../config/index';

export const rateLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const forwarded = req.headers['x-forwarded-for'];
    const ip = Array.isArray(forwarded)
      ? forwarded[0]
      : (forwarded?.split(',')[0] ?? req.socket.remoteAddress ?? 'unknown');
    return ip.trim();
  },
  handler: (_req, res) => {
    res.status(429).json({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: `Too many requests. Maximum ${config.rateLimit.max} requests per ${config.rateLimit.windowMs / 1000} seconds allowed.`,
      },
    });
  },
});

