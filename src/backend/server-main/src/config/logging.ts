/**
 * @file logging.ts
 * @description 结构化日志统一脱敏配置，保护请求、响应与异常日志；请求编号与 traceId 一致
 */
import type { IncomingMessage } from 'node:http'
import type { Params } from 'nestjs-pino'
import { stdSerializers } from 'pino-http'
import { getTraceId } from '../common/utils/trace-id'
import { isClientErrorPath } from '../common/utils/client-error-report'

const REDACTED = '[REDACTED]'
const sensitiveFields = [
  'password',
  'currentPassword',
  'newPassword',
  'passwordHash',
  'accessToken',
  'refreshToken',
  'refreshTokenPlain',
  'token',
  'tokenHash',
  'ticket',
  'visitorId',
  'visitorIdHash',
  'email',
]

/** URL 只保留定位所需的路径；批处理结果路径包含私密票据，静态操作名可保留。 */
export function redactRequestUrl(url: string): string {
  return url
    .split(/[?#]/)[0]!
    .replace(/(\/admin\/posts\/batch\/)(?!preview(?:\/|$)|execute(?:\/|$))[^/]+/i, `$1${REDACTED}`)
}

/** 异常消息可能含 SQL 参数或原始输入，只保留类型和去掉完整消息后的调用帧。 */
function serializeError(error: unknown) {
  if (!(error instanceof Error)) return { type: 'Error', message: REDACTED }
  const type = error.constructor.name
  const prefix = error.message ? `${error.name}: ${error.message}\n` : `${error.name}\n`
  // 不只删首行：多行消息、cause 与异常附加属性均不能重新带入日志。
  const frames = error.stack?.startsWith(prefix)
    ? error.stack
        .slice(prefix.length)
        .split('\n')
        .filter((line) => /^\s+at /.test(line))
        .join('\n')
    : undefined
  return { type, message: REDACTED, ...(frames ? { stack: `${type}: ${REDACTED}\n${frames}` } : {}) }
}

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
      // HTTP 中间件与 Nest 请求上下文外的 Pino 均直接使用同一组原始值序列化器。
      wrapSerializers: false,
      serializers: {
        req: (req: IncomingMessage) => {
          const { id, method, url, headers, remoteAddress, remotePort } = stdSerializers.req(req)
          const path = url ? redactRequestUrl(url) : url
          // 客户端错误上报入口只保留正文类型与长度，不记录 Referer、Cookie 及任意附加请求头。
          if (path && isClientErrorPath(path)) {
            const { 'content-type': contentType, 'content-length': contentLength } = headers
            return {
              id,
              method,
              url: '/api/v1/client-errors',
              headers: { 'content-type': contentType, 'content-length': contentLength },
              remoteAddress,
              remotePort,
            }
          }
          // 白名单排除 Express 的 query/params 及正文，不把敏感输入复制到其他字段。
          return { id, method, url: path, headers, remoteAddress, remotePort }
        },
        res: stdSerializers.res,
        err: serializeError,
      },
      hooks: {
        logMethod(args, method) {
          const [value, message] = args
          // Pino 会在 err 序列化前把原始 message 复制到 msg，必须提前阻断这个隐式出口。
          if (
            message === undefined &&
            (value instanceof Error ||
              (value !== null &&
                typeof value === 'object' &&
                'err' in value &&
                value.err &&
                (!('msg' in value) || value.msg === undefined)))
          ) {
            method.call(this, value, REDACTED)
            return
          }
          method.apply(this, args)
        },
      },
      redact: {
        paths: [
          'req.headers.authorization',
          'req.headers["proxy-authorization"]',
          'req.headers.cookie',
          'req.headers.referer',
          'res.headers["set-cookie"]',
          'req.headers["x-visitor-id"]',
          ...sensitiveFields.flatMap((field) => [field, `req.body.${field}`]),
          'req.headers.referrer',
          'req.query.token',
        ],
        censor: REDACTED,
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
