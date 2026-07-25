export interface AuditResult {
  success: true;
  url: string;
  finalUrl: string;
  statusCode: number;
  responseTime: number;
  title: string | null;
  isHttps: boolean;
  contentType: string | null;
  server: string | null;
  responseSize: number;
  redirectCount: number;
  cached: boolean;
  timestamp: string;
  requestId: string;
}

export interface AuditError {
  success: false;
  error: {
    code: string;
    message: string;
  };
  requestId?: string;
}

export type ApiResponse = AuditResult | AuditError;

export interface CacheEntry {
  data: Omit<AuditResult, 'cached' | 'requestId'>;
  expiresAt: number;
}

export interface HealthResponse {
  status: 'healthy' | 'degraded';
  uptime: number;
  timestamp: string;
  cache: {
    keys: number;
    hits: number;
    misses: number;
  };
  version: string;
}

