# ⚡ Page Pulse

> **Production-grade URL Audit Service** — audit any website for status, response time, title, HTTPS, headers, and more.

[![CI](https://github.com/your-username/page-pulse/actions/workflows/ci.yml/badge.svg)](https://github.com/your-username/page-pulse/actions)
![Node.js](https://img.shields.io/badge/Node.js-22%20LTS-green?logo=node.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue?logo=typescript)
![Express](https://img.shields.io/badge/Express-5.x-black?logo=express)
![License](https://img.shields.io/badge/License-MIT-purple)

---

## 🚀 Live Demo

> **`https://page-pulse.onrender.com`** *(deploy to Render to activate)*

---

## ✨ Features

| Feature | Details |
|---------|---------|
| **URL Audit API** | `POST /audit` — status, response time, title, HTTPS, server, content-type, redirects |
| **Input Validation** | Zod schema — rejects `ftp://`, bare strings, empty, non-URLs |
| **Request Timeout** | Configurable via `REQUEST_TIMEOUT_MS` (default 5000ms) |
| **Concurrency Limit** | p-limit — max 50 simultaneous audits, 503 on overflow |
| **Smart Caching** | NodeCache with configurable TTL — same URL returns instantly from cache |
| **Rate Limiting** | express-rate-limit — 100 req/min per IP, structured 429 error |
| **Structured Logging** | Pino — unique `REQ-XXXXX` per request, JSON logs in production |
| **Security** | Helmet.js, CORS, gzip compression |
| **API Docs** | Swagger UI at `/api-docs` |
| **Health Check** | `GET /health` — uptime, cache stats, version |
| **Docker** | Multi-stage Dockerfile + docker-compose.yml |
| **CI/CD** | GitHub Actions — type-check → test → build on every push |

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 22 LTS |
| Language | TypeScript 5.8 |
| Framework | Express.js 5 |
| Validation | Zod |
| HTTP Client | Axios |
| Cache | NodeCache (in-memory) |
| Rate Limiting | express-rate-limit |
| Concurrency | p-limit |
| Logging | Pino |
| Testing | Jest + Supertest |
| API Docs | Swagger / OpenAPI 3.0 |
| Security | Helmet + CORS + Compression |
| Containers | Docker + docker-compose |
| CI | GitHub Actions |
| Deployment | Render |

---

## 📦 Installation

```bash
# Clone the repository
git clone https://github.com/your-username/page-pulse.git
cd page-pulse

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Start development server
npm run dev
```

Server starts at **`http://localhost:3000`**

---

## 🔧 Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | HTTP server port |
| `NODE_ENV` | `development` | Environment (`development` \| `production` \| `test`) |
| `CACHE_TTL_SECONDS` | `300` | Audit result cache duration (seconds) |
| `REQUEST_TIMEOUT_MS` | `5000` | Website fetch timeout (milliseconds) |
| `RATE_LIMIT_MAX` | `100` | Max requests per IP per window |
| `RATE_LIMIT_WINDOW_MS` | `60000` | Rate limit window duration (milliseconds) |
| `MAX_CONCURRENT_AUDITS` | `50` | Max simultaneous active audits |

---

## 📡 API Reference

### `POST /audit`

Audit a URL and return detailed health information.

**Request**
```json
{
  "url": "https://google.com"
}
```

**Success Response** (`200 OK`)
```json
{
  "success": true,
  "url": "https://google.com",
  "finalUrl": "https://www.google.com/",
  "statusCode": 200,
  "responseTime": 182,
  "title": "Google",
  "isHttps": true,
  "contentType": "text/html; charset=UTF-8",
  "server": "gws",
  "responseSize": 14318,
  "redirectCount": 1,
  "cached": false,
  "timestamp": "2026-07-25T13:37:00.000Z",
  "requestId": "REQ-A1B2C3D4E5F6"
}
```

**Error Responses**

| HTTP | `error.code` | Cause |
|------|-------------|-------|
| 400 | `INVALID_URL` | Not a valid HTTP/HTTPS URL |
| 429 | `RATE_LIMIT_EXCEEDED` | Too many requests |
| 502 | `UNREACHABLE` | Cannot connect to website |
| 503 | `SERVER_BUSY` | Concurrency limit reached |
| 504 | `TIMEOUT` | Website didn't respond in time |

```json
{
  "success": false,
  "error": {
    "code": "TIMEOUT",
    "message": "Website did not respond within 5000ms."
  },
  "requestId": "REQ-A1B2C3D4E5F6"
}
```

---

### `GET /health`

```json
{
  "status": "healthy",
  "uptime": 3600,
  "timestamp": "2026-07-25T13:37:00.000Z",
  "cache": { "keys": 42, "hits": 120, "misses": 35 },
  "version": "1.0.0",
  "environment": "production"
}
```

---

### `GET /api-docs`

Interactive Swagger UI — try every endpoint directly in the browser.

---

## 🧪 Running Tests

```bash
# Run all tests
npm test

# With coverage report
npm run test:coverage

# Watch mode
npm run test:watch
```

**Test cases covered:**
- ✅ Valid URL — full audit result
- ✅ Invalid URL (plain text, ftp://, empty, null, number)
- ✅ Missing URL field
- ✅ Cache hit — second request returns `"cached": true`
- ✅ Timeout — returns `TIMEOUT` error code
- ✅ Unreachable host — returns `UNREACHABLE` error code
- ✅ Structured error format on all failures
- ✅ Request ID in all responses
- ✅ Health endpoint — status, cache stats
- ✅ 404 for unknown routes

---

## 🐳 Docker

```bash
# Build and run with Docker Compose
docker-compose up --build

# Or manually
docker build -t page-pulse .
docker run -p 3000:3000 --env-file .env page-pulse
```

---

## 🚀 Deployment — Render

1. Push to GitHub
2. Create new **Web Service** on [render.com](https://render.com)
3. Connect your repository
4. Set:
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Environment**: Add all variables from `.env.example`
5. Deploy — get your public URL

---

## 📁 Project Structure

```
page-pulse/
├── src/
│   ├── config/           # Typed env config
│   ├── controllers/      # Request handlers
│   ├── routes/           # Express routes
│   ├── services/         # Core audit logic (Axios)
│   ├── cache/            # NodeCache wrapper
│   ├── middleware/       # Rate limit, concurrency, error handler, request ID
│   ├── logger/           # Pino logger setup
│   ├── utils/            # URL helpers
│   ├── validators/       # Zod schemas
│   ├── types/            # TypeScript interfaces
│   ├── app.ts            # Express app factory
│   └── server.ts         # HTTP server + graceful shutdown
├── tests/
│   ├── audit.test.ts     # Audit endpoint tests
│   ├── health.test.ts    # Health endpoint tests
│   ├── validation.test.ts# Input validation tests
│   └── setup.ts          # Test environment setup
├── public/
│   └── index.html        # Glassmorphism landing page
├── .github/
│   └── workflows/ci.yml  # GitHub Actions CI/CD
├── .env.example
├── Dockerfile
├── docker-compose.yml
├── tsconfig.json
├── jest.config.ts
└── README.md
```

---

## 🔗 Links

- 🌐 **Live App**: [https://page-pulse.onrender.com](https://page-pulse.onrender.com)
- 📖 **API Docs**: [https://page-pulse.onrender.com/api-docs](https://page-pulse.onrender.com/api-docs)
- ❤️ **Built for**: [Digital Heroes Training Task](https://digitalheroesco.com)

---

*Built for [Digital Heroes Training Task](https://digitalheroesco.com)*
