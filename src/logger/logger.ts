import pino from 'pino';
import config from '../config/index';

const logger = pino({
  level: config.isTest ? 'silent' : 'info',
  ...(config.isDevelopment && !config.isTest
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

