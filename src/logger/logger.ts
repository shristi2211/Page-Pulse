import pino from 'pino';
import config from '../config/index';

// pino-pretty is only available in dev (devDependency) — never use in production
const usePretty = config.isDevelopment && !config.isTest;

const logger = pino({
  level: config.isTest ? 'silent' : 'info',
  ...(usePretty
    ? {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        },
      }
    : {}),
  base: {
    service: 'page-pulse',
    env: config.nodeEnv,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

export default logger;

