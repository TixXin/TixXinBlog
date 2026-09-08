/**
 * @file logging.ts
 * @description 结构化日志统一脱敏配置，禁止认证凭据进入请求及响应日志
 */
import type { Params } from 'nestjs-pino'

export function createLoggingOptions(level = 'info', development = false): Params {
  return {
    pinoHttp: {
      level,
      redact: {
        paths: [
          'req.headers.authorization',
          'req.headers.cookie',
          'res.headers["set-cookie"]',
          'req.headers["x-visitor-id"]',
          'req.body.password',
          'req.body.currentPassword',
          'req.body.newPassword',
          'currentPassword',
          'newPassword',
          'req.body.refreshToken',
          'req.body.accessToken',
          'req.body.ticket',
          'ticket',
          'password',
          'accessToken',
          'refreshToken',
          'refreshTokenPlain',
        ],
        censor: '[REDACTED]',
      },
      autoLogging: { ignore: (req) => req.url === '/health' || req.url === '/ready' },
      transport: development ? { target: 'pino-pretty' } : undefined,
    },
  }
}
