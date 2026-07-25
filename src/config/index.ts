import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

function requireEnv(key: string, defaultValue?: string): string {
  const value = process.env[key] ?? defaultValue;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function parseIntEnv(key: string, defaultValue: number): number {
  const raw = process.env[key];
  if (!raw) return defaultValue;
  const parsed = parseInt(raw, 10);
  if (isNaN(parsed)) {
    throw new Error(`Environment variable ${key} must be a valid integer, got: "${raw}"`);
  }
  return parsed;
}

const config = {
  port: parseIntEnv('PORT', 3000),
  nodeEnv: requireEnv('NODE_ENV', 'development'),

  cache: {
    ttlSeconds: parseIntEnv('CACHE_TTL_SECONDS', 300),
  },

  request: {
    timeoutMs: parseIntEnv('REQUEST_TIMEOUT_MS', 5000),
  },

  rateLimit: {
    max: parseIntEnv('RATE_LIMIT_MAX', 100),
    windowMs: parseIntEnv('RATE_LIMIT_WINDOW_MS', 60000),
  },

  concurrency: {
    maxActive: parseIntEnv('MAX_CONCURRENT_AUDITS', 50),
  },

  // IMPORTANT: Default to production-safe values when NODE_ENV is not set
  // This prevents devDependencies (like pino-pretty) from being loaded on Render
  isDevelopment: process.env['NODE_ENV'] === 'development',
  isProduction: (process.env['NODE_ENV'] ?? 'production') !== 'development',
  isTest: process.env['NODE_ENV'] === 'test',
} as const;

export default config;

