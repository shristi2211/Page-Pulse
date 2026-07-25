import http from 'http';
import app from './app';
import config from './config/index';
import logger from './logger/logger';

const server = http.createServer(app);

server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    logger.error(
      { port: config.port },
      `❌ Port ${config.port} is already in use. Run: npx kill-port ${config.port}`
    );
    process.exit(1);
  }
  logger.fatal({ err }, 'Server error — shutting down');
  process.exit(1);
});

server.listen(config.port, () => {
  logger.info(
    {
      port: config.port,
      env: config.nodeEnv,
      pid: process.pid,
    },
    `🚀 Page Pulse server started on http://localhost:${config.port}`
  );
  logger.info(`📖 API Docs available at http://localhost:${config.port}/api-docs`);
});

// ─── Graceful Shutdown ────────────────────────────────────────────────────────
function gracefulShutdown(signal: string): void {
  logger.info({ signal }, 'Shutdown signal received — closing server gracefully');

  server.close((err) => {
    if (err) {
      logger.error({ err }, 'Error during server close');
      process.exit(1);
    }
    logger.info('HTTP server closed. Exiting process.');
    process.exit(0);
  });

  // Force exit after 10 seconds
  setTimeout(() => {
    logger.warn('Graceful shutdown timed out — forcing exit');
    process.exit(1);
  }, 10_000).unref();
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Uncaught exception — shutting down');
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.fatal({ reason }, 'Unhandled promise rejection — shutting down');
  process.exit(1);
});

export default server;

