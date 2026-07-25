import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import path from 'path';

import { requestIdMiddleware } from './middleware/requestId';
import { rateLimiter } from './middleware/rateLimiter';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import auditRoutes from './routes/auditRoutes';
import healthRoutes from './routes/healthRoutes';
import logger from './logger/logger';
import config from './config/index';

const app = express();

// ─── Security & Performance Middleware ────────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: false, // Allow Swagger UI inline scripts
    crossOriginEmbedderPolicy: false,
  })
);
app.use(
  cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'X-Request-ID'],
  })
);
app.use(compression());

// ─── Body Parsing ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// ─── Request ID + Logging ─────────────────────────────────────────────────────
app.use(requestIdMiddleware);

app.use((req, res, next) => {
  logger.info(
    {
      requestId: req.requestId,
      method: req.method,
      path: req.path,
      ip:
        (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ??
        req.socket.remoteAddress,
    },
    'Incoming request'
  );
  res.on('finish', () => {
    const duration = Date.now() - req.startTime;
    logger.info(
      {
        requestId: req.requestId,
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        duration,
      },
      'Request completed'
    );
  });
  next();
});

// ─── Rate Limiting ────────────────────────────────────────────────────────────
app.use('/audit', rateLimiter);

// ─── Static Frontend ──────────────────────────────────────────────────────────
const publicDir = path.join(__dirname, '..', 'public');
app.use(express.static(publicDir, {
  extensions: ['html'],   // /docs → public/docs.html automatically
  index: 'index.html',
}));

// ─── Swagger/OpenAPI Docs ─────────────────────────────────────────────────────
const swaggerOptions: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Page Pulse API',
      version: '1.0.0',
      description:
        'Production-grade URL Audit Service. Send a URL and get back detailed audit information including response time, title, HTTP status, HTTPS status, and more.',
      contact: {
        name: 'Page Pulse',
        url: 'https://digitalheroesco.com',
      },
    },
    servers: [
      { url: `http://localhost:${config.port}`, description: 'Local Development' },
      { url: 'https://page-pulse.onrender.com', description: 'Production' },
    ],
    tags: [
      { name: 'Audit', description: 'URL audit operations' },
      { name: 'Health', description: 'Service health monitoring' },
    ],
  },
  apis: ['./src/routes/*.ts', './dist/routes/*.js'],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use(
  '/api-docs',
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    customCss: `
      .swagger-ui .topbar { background-color: #0f0f1a; }
      .swagger-ui .topbar-wrapper img { display: none; }
      .swagger-ui .topbar-wrapper::after { content: '⚡ Page Pulse API'; color: #a78bfa; font-size: 1.4rem; font-weight: 700; }
    `,
    customSiteTitle: 'Page Pulse API Docs',
  })
);

app.get('/api-docs.json', (_req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// ─── Custom API Docs (Beautiful HTML) ─────────────────────────────────────────
app.get('/docs', (_req, res) => {
  const docsFile = path.resolve(process.cwd(), 'public', 'docs.html');
  res.sendFile(docsFile, (err) => {
    if (err) {
      res.sendFile('docs.html', { root: publicDir });
    }
  });
});

// ─── Website Docs (Task B System Design) ──────────────────────────────────────
app.get('/website-docs', (_req, res) => {
  const f = path.resolve(process.cwd(), 'public', 'website-docs.html');
  res.sendFile(f, (err) => {
    if (err) res.sendFile('website-docs.html', { root: publicDir });
  });
});

// ─── Serve docs/ markdown files & diagram for download ────────────────────────
const docsDir = path.join(__dirname, '..', 'docs');
app.use('/docs', express.static(docsDir));

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/', healthRoutes);
app.use('/', auditRoutes);

// ─── 404 + Error Handlers ─────────────────────────────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

export default app;

