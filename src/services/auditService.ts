import axios, { AxiosError } from 'axios';
import config from '../config/index';
import { extractTitle, isHttps, parseContentLength } from '../utils/urlUtils';
import type { AuditResult } from '../types/index';
import logger from '../logger/logger';

export interface AuditServiceResult {
  success: true;
  data: Omit<AuditResult, 'cached' | 'requestId'>;
}

export interface AuditServiceError {
  success: false;
  code: string;
  message: string;
}

export type AuditServiceResponse = AuditServiceResult | AuditServiceError;

export async function performAudit(
  url: string,
  requestId: string
): Promise<AuditServiceResponse> {
  const startTime = Date.now();

  logger.info({ requestId, url }, 'Starting website audit');

  try {
    const response = await axios.get(url, {
      timeout: config.request.timeoutMs,
      maxRedirects: 10,
      validateStatus: () => true, // Accept all HTTP status codes
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; PagePulse/1.0; +https://page-pulse.onrender.com)',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        Connection: 'keep-alive',
      },
      decompress: true,
    });

    const responseTime = Date.now() - startTime;
    const finalUrl: string = response.request?.res?.responseUrl ?? url;
    const html = typeof response.data === 'string' ? response.data : '';

    // Count redirects from axios internal redirect history
    const redirectCount: number =
      (response.request?._redirectable?._redirectCount as number) ?? 0;

    const contentType: string | null =
      (response.headers['content-type'] as string) ?? null;
    const server: string | null = (response.headers['server'] as string) ?? null;
    const contentLengthHeader: string | undefined =
      response.headers['content-length'] as string | undefined;

    let responseSize = parseContentLength(contentLengthHeader);
    if (responseSize === 0 && html.length > 0) {
      responseSize = Buffer.byteLength(html, 'utf8');
    }

    const title = extractTitle(html);

    const data: Omit<AuditResult, 'cached' | 'requestId'> = {
      success: true,
      url,
      finalUrl,
      statusCode: response.status,
      responseTime,
      title,
      isHttps: isHttps(finalUrl),
      contentType,
      server,
      responseSize,
      redirectCount,
      timestamp: new Date().toISOString(),
    };

    logger.info(
      { requestId, url, statusCode: response.status, responseTime },
      'Audit completed'
    );

    return { success: true, data };
  } catch (err) {
    const responseTime = Date.now() - startTime;

    if (axios.isAxiosError(err)) {
      const axiosError = err as AxiosError;

      if (axiosError.code === 'ECONNABORTED' || axiosError.code === 'ETIMEDOUT') {
        logger.warn({ requestId, url, responseTime }, 'Audit timed out');
        return {
          success: false,
          code: 'TIMEOUT',
          message: `Website did not respond within ${config.request.timeoutMs}ms.`,
        };
      }

      if (axiosError.code === 'ERR_INVALID_URL') {
        return {
          success: false,
          code: 'INVALID_URL',
          message: 'Please provide a valid HTTP or HTTPS URL.',
        };
      }

      if (
        axiosError.code === 'ENOTFOUND' ||
        axiosError.code === 'EAI_AGAIN' ||
        axiosError.code === 'ECONNREFUSED'
      ) {
        logger.warn({ requestId, url, code: axiosError.code }, 'Website unreachable');
        return {
          success: false,
          code: 'UNREACHABLE',
          message: 'Could not connect to the website. It may be down or unreachable.',
        };
      }
    }

    const message = err instanceof Error ? err.message : 'Unknown error during audit.';
    logger.error({ requestId, url, err: message }, 'Audit failed with unexpected error');
    return {
      success: false,
      code: 'AUDIT_FAILED',
      message: `Audit failed: ${message}`,
    };
  }
}

