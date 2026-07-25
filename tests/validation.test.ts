import request from 'supertest';
import app from '../src/app';

describe('POST /audit — Input Validation', () => {
  it('should return INVALID_URL for missing url field', async () => {
    const res = await request(app).post('/audit').send({});
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INVALID_URL');
    expect(res.body.error.message).toBeDefined();
  });

  it('should return INVALID_URL for empty string url', async () => {
    const res = await request(app).post('/audit').send({ url: '' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INVALID_URL');
  });

  it('should return INVALID_URL for plain text (no protocol)', async () => {
    const res = await request(app).post('/audit').send({ url: 'google.com' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INVALID_URL');
  });

  it('should return INVALID_URL for ftp:// URLs', async () => {
    const res = await request(app).post('/audit').send({ url: 'ftp://files.example.com' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INVALID_URL');
  });

  it('should return INVALID_URL for numeric input', async () => {
    const res = await request(app).post('/audit').send({ url: 12345 });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INVALID_URL');
  });

  it('should return INVALID_URL for null url', async () => {
    const res = await request(app).post('/audit').send({ url: null });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INVALID_URL');
  });

  it('should return INVALID_URL for javascript: URL', async () => {
    const res = await request(app)
      .post('/audit')
      .send({ url: 'javascript:alert(1)' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INVALID_URL');
  });

  it('should accept valid http:// URL (format)', async () => {
    // This may fail to fetch but should pass validation
    const res = await request(app)
      .post('/audit')
      .send({ url: 'http://localhost:9999' }); // won't connect but validates
    // Validation passes, so error should be UNREACHABLE or TIMEOUT — NOT INVALID_URL
    expect(res.body.error?.code).not.toBe('INVALID_URL');
  });

  it('should return structured error format on all validation errors', async () => {
    const res = await request(app).post('/audit').send({ url: 'not-a-url' });
    expect(res.body).toHaveProperty('success', false);
    expect(res.body).toHaveProperty('error');
    expect(res.body.error).toHaveProperty('code');
    expect(res.body.error).toHaveProperty('message');
    expect(typeof res.body.error.code).toBe('string');
    expect(typeof res.body.error.message).toBe('string');
  });
});
