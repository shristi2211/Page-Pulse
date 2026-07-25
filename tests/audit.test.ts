import request from 'supertest';
import axios from 'axios';
import { cacheService } from '../src/cache/cacheService';
import app from '../src/app';

// Mock axios for controlled tests
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

const MOCK_HTML = `<html><head><title>Test Page</title></head><body>Hello</body></html>`;

const MOCK_RESPONSE = {
  status: 200,
  data: MOCK_HTML,
  headers: {
    'content-type': 'text/html; charset=utf-8',
    'server': 'nginx/1.18.0',
    'content-length': String(Buffer.byteLength(MOCK_HTML)),
  },
  request: {
    res: { responseUrl: 'https://example.com/' },
    _redirectable: { _redirectCount: 0 },
  },
};

beforeEach(() => {
  cacheService.flush();
  jest.clearAllMocks();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (mockedAxios as any).isAxiosError = axios.isAxiosError;
});

describe('POST /audit — Successful Audit', () => {
  it('should return full audit result for a valid URL', async () => {
    mockedAxios.get = jest.fn().mockResolvedValueOnce(MOCK_RESPONSE);

    const res = await request(app)
      .post('/audit')
      .send({ url: 'https://example.com' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.url).toBe('https://example.com');
    expect(res.body.statusCode).toBe(200);
    expect(res.body.title).toBe('Test Page');
    expect(res.body.isHttps).toBe(true);
    expect(res.body.contentType).toBe('text/html; charset=utf-8');
    expect(res.body.server).toBe('nginx/1.18.0');
    expect(res.body.cached).toBe(false);
    expect(res.body.responseTime).toBeGreaterThanOrEqual(0);
    expect(res.body.timestamp).toBeDefined();
    expect(res.body.requestId).toMatch(/^REQ-/);
  });

  it('should include all required fields in success response', async () => {
    mockedAxios.get = jest.fn().mockResolvedValueOnce(MOCK_RESPONSE);

    const res = await request(app)
      .post('/audit')
      .send({ url: 'https://example.com' });

    const requiredFields = [
      'success', 'url', 'finalUrl', 'statusCode', 'responseTime',
      'title', 'isHttps', 'contentType', 'server', 'responseSize',
      'redirectCount', 'cached', 'timestamp', 'requestId',
    ];

    for (const field of requiredFields) {
      expect(res.body).toHaveProperty(field);
    }
  });
});

describe('POST /audit — Cache Behavior', () => {
  it('should return cached: false on first request', async () => {
    mockedAxios.get = jest.fn().mockResolvedValueOnce(MOCK_RESPONSE);

    const res = await request(app)
      .post('/audit')
      .send({ url: 'https://cached-example.com' });

    expect(res.body.cached).toBe(false);
  });

  it('should return cached: true on second request for same URL', async () => {
    mockedAxios.get = jest.fn().mockResolvedValueOnce(MOCK_RESPONSE);

    // First request — populates cache
    await request(app)
      .post('/audit')
      .send({ url: 'https://cached-test.com' });

    // Second request — should be from cache (no axios call)
    const res = await request(app)
      .post('/audit')
      .send({ url: 'https://cached-test.com' });

    expect(res.status).toBe(200);
    expect(res.body.cached).toBe(true);
    expect(mockedAxios.get).toHaveBeenCalledTimes(1); // Only 1 network call
  });

  it('should not call axios on cache hit', async () => {
    mockedAxios.get = jest.fn().mockResolvedValueOnce(MOCK_RESPONSE);

    await request(app).post('/audit').send({ url: 'https://no-double-fetch.com' });
    await request(app).post('/audit').send({ url: 'https://no-double-fetch.com' });
    await request(app).post('/audit').send({ url: 'https://no-double-fetch.com' });

    expect(mockedAxios.get).toHaveBeenCalledTimes(1);
  });
});

describe('POST /audit — Timeout Handling', () => {
  it('should return TIMEOUT error when request times out', async () => {
    const timeoutError = new Error('timeout of 5000ms exceeded');
    (timeoutError as NodeJS.ErrnoException).code = 'ECONNABORTED';
    Object.assign(timeoutError, { isAxiosError: true, code: 'ECONNABORTED' });
    mockedAxios.get = jest.fn().mockRejectedValueOnce(timeoutError);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockedAxios as any).isAxiosError = jest.fn().mockReturnValue(true);

    const res = await request(app)
      .post('/audit')
      .send({ url: 'https://slow-website.com' });

    expect(res.status).toBe(504);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('TIMEOUT');
    expect(res.body.error.message).toContain('5000');
  });
});

describe('POST /audit — Unreachable Website', () => {
  it('should return UNREACHABLE for ENOTFOUND errors', async () => {
    const notFoundError = new Error('getaddrinfo ENOTFOUND fake-domain.xyz');
    Object.assign(notFoundError, { isAxiosError: true, code: 'ENOTFOUND' });
    mockedAxios.get = jest.fn().mockRejectedValueOnce(notFoundError);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockedAxios as any).isAxiosError = jest.fn().mockReturnValue(true);

    const res = await request(app)
      .post('/audit')
      .send({ url: 'https://this-domain-does-not-exist-xyz.com' });

    expect(res.status).toBe(502);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UNREACHABLE');
  });
});

describe('POST /audit — Error Response Format', () => {
  it('should always have consistent error format', async () => {
    const res = await request(app).post('/audit').send({ url: '' });

    expect(res.body).toMatchObject({
      success: false,
      error: {
        code: expect.any(String),
        message: expect.any(String),
      },
    });
  });

  it('should include requestId in error responses', async () => {
    const res = await request(app).post('/audit').send({ url: 'bad-url' });
    expect(res.body.requestId).toBeDefined();
    expect(res.body.requestId).toMatch(/^REQ-/);
  });
});

describe('POST /audit — Request ID', () => {
  it('should return X-Request-ID header on every response', async () => {
    mockedAxios.get = jest.fn().mockResolvedValueOnce(MOCK_RESPONSE);

    const res = await request(app)
      .post('/audit')
      .send({ url: 'https://example.com' });

    expect(res.headers['x-request-id']).toBeDefined();
    expect(res.headers['x-request-id']).toMatch(/^REQ-/);
  });
});
