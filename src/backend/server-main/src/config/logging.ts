/**
 * @file logging.ts
 * @description 结构化日志统一脱敏配置，禁止认证凭据进入请求及响应日志；请求编号与 traceId 一致
 */
import type { Params } from 'nestjs-pino'
import { getTraceId } from '../common/utils/trace-id'

export function createLoggingOptions(level = 'info', development = false): Params {
  return {
    pinoHttp: {
      level,
      // request.id 与响应体 traceId、X-Request-Id 共用同一值，便于按响应定位日志与审计。
      genReqId: (req, res) => {
        const traceId = getTraceId(req)
        if (!res.headersSent) res.setHeader('X-Request-Id', traceId)
        return traceId
      },
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
      customLogLevel: (req, res, error) => {
        // 按完成结果决定静默，避免健康探针失败也被 ignore 隐藏。
        if (error || res.err || res.statusCode >= 500) return 'error'
        if (res.statusCode >= 400) return 'warn'
        const path = req.url?.split('?')[0]
        if (path === '/health' || path === '/ready') return 'silent'
        // 只识别开发环境的只读巡检，普通文章请求和生产访问仍记录。
        if (
          development &&
          req.method === 'GET' &&
          req.headers['x-tixxin-dev-probe'] === '1' &&
          (path === '/api/v1/dev/identity' || path === '/api/v1/posts')
        )
          return 'silent'
        return 'info'
      },
      transport: development ? { target: 'pino-pretty' } : undefined,
    },
  }
}
