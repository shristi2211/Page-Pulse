import NodeCache from 'node-cache';
import config from '../config/index';
import logger from '../logger/logger';

interface CacheStats {
  keys: number;
  hits: number;
  misses: number;
}

class CacheService {
  private cache: NodeCache;
  private hits = 0;
  private misses = 0;

  constructor() {
    this.cache = new NodeCache({
      stdTTL: config.cache.ttlSeconds,
      checkperiod: Math.floor(config.cache.ttlSeconds / 2),
      useClones: false,
    });

    this.cache.on('expired', (key: string) => {
      logger.info({ key }, 'Cache entry expired');
    });
  }

  get<T>(key: string): T | undefined {
    const value = this.cache.get<T>(key);
    if (value !== undefined) {
      this.hits++;
      logger.debug({ key }, 'Cache HIT');
    } else {
      this.misses++;
      logger.debug({ key }, 'Cache MISS');
    }
    return value;
  }

  set<T>(key: string, value: T, ttl?: number): boolean {
    const success = ttl !== undefined
      ? this.cache.set(key, value, ttl)
      : this.cache.set(key, value);
    if (success) {
      logger.debug({ key, ttl: ttl ?? config.cache.ttlSeconds }, 'Cache SET');
    }
    return success;
  }

  has(key: string): boolean {
    return this.cache.has(key);
  }

  del(key: string): number {
    return this.cache.del(key);
  }

  flush(): void {
    this.cache.flushAll();
    logger.info('Cache flushed');
  }

  getStats(): CacheStats {
    return {
      keys: this.cache.keys().length,
      hits: this.hits,
      misses: this.misses,
    };
  }

  /** Normalize URL to a consistent cache key */
  static normalizeKey(url: string): string {
    try {
      const parsed = new URL(url.toLowerCase().trim());
      // Remove trailing slash for consistency
      const pathname = parsed.pathname.replace(/\/+$/, '') || '/';
      return `${parsed.protocol}//${parsed.hostname}${pathname}${parsed.search}`;
    } catch {
      return url.toLowerCase().trim();
    }
  }
}

export const cacheService = new CacheService();

