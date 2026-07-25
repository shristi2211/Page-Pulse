// Set test environment variables before any imports
process.env['NODE_ENV'] = 'test';
process.env['PORT'] = '3001';
process.env['CACHE_TTL_SECONDS'] = '300';
process.env['REQUEST_TIMEOUT_MS'] = '5000';
process.env['RATE_LIMIT_MAX'] = '100';
process.env['RATE_LIMIT_WINDOW_MS'] = '60000';
process.env['MAX_CONCURRENT_AUDITS'] = '50';
