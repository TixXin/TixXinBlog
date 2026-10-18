/**
 * @file logging-redaction.spec.ts
 * @description 使用真实 Pino 输出验证请求、异常和 Nest 日志桥接的脱敏边界，不监听端口或连接数据库
 */
import { IncomingMessage, ServerResponse } from 'node:http'
import { Socket } from 'node:net'
import { HttpException, Logger } from '@nestjs/common'
import type { ArgumentsHost } from '@nestjs/common'
import { Logger as NestPinoLogger, PinoLogger } from 'nestjs-pino'
import { __resetOutOfContextForTests } from 'nestjs-pino/PinoLogger'
import pinoHttp from 'pino-http'
import { AllExceptionsFilter } from '../common/filters/all-exceptions.filter'
import { createLoggingOptions } from './logging'

const secrets = {
  authorization: 't62-authorization-secret',
  cookie: 't62-cookie-secret',
  password: 't62-password-secret',
  token: 't62-token-secret',
  visitorId: 't62-visitor-secret',
  email: 't62-private@example.test',
}
const structuredSecrets = {
  password: secrets.password,
  currentPassword: secrets.password,
  newPassword: secrets.password,
  passwordHash: secrets.password,
  accessToken: secrets.token,
  refreshToken: secrets.token,
  refreshTokenPlain: secrets.token,
  token: secrets.token,
  tokenHash: secrets.token,
  ticket: secrets.token,
  visitorId: secrets.visitorId,
  visitorIdHash: secrets.visitorId,
  email: secrets.email,
}
const secretMessage = Object.values(secrets).join('\n') + `\n    at ${secrets.password}`

interface CapturedLog {
  level: number
  msg: string
  req: { id: string; method: string; url: string; headers: Record<string, string>; [key: string]: unknown }
  res: { statusCode: number; headers: Record<string, string | string[]> }
  err: { type: string; message: string; stack: string; [key: string]: unknown }
  traceId: string
  status: number
  [key: string]: unknown
}

function loggingOptions(development = false) {
  const options = createLoggingOptions('debug', development).pinoHttp
  if (!options || Array.isArray(options) || !('redact' in options)) throw new Error('日志配置不符合预期')
  return { ...options, transport: undefined }
}

function capture(development = false) {
  const lines: string[] = []
  const middleware = pinoHttp(loggingOptions(development), { write: (line) => lines.push(line) })
  return { middleware, lines, records: () => lines.map((line) => JSON.parse(line) as CapturedLog) }
}

function requestLog(development = false, path = '/api/v1/auth/login') {
  const captured = capture(development)
  const request = Object.assign(new IncomingMessage(new Socket()), {
    method: 'POST',
    url: `${path}?token=${secrets.token}`,
    originalUrl: `${path}?email=${encodeURIComponent(secrets.email)}&password=${secrets.password}`,
    query: { ...structuredSecrets },
    params: { ticket: secrets.token, visitorId: secrets.visitorId },
    body: { ...structuredSecrets, nested: { ...secrets } },
  })
  request.headers = {
    authorization: `Bearer ${secrets.authorization}`,
    'proxy-authorization': `Basic ${secrets.authorization}`,
    cookie: `refresh=${secrets.cookie}`,
    referer: `https://example.test/?email=${encodeURIComponent(secrets.email)}`,
    'x-visitor-id': secrets.visitorId,
    'x-trace-id': 't62-redaction-trace',
    'content-type': 'application/json',
  }
  const response = new ServerResponse(request)
  captured.middleware(request, response)
  response.setHeader('set-cookie', [`refresh=${secrets.cookie}; HttpOnly`, `token=${secrets.token}; HttpOnly`])
  return { ...captured, request, response }
}

function expectNoSecrets(lines: string[]) {
  expect(lines.length).toBeGreaterThan(0)
  const output = lines.join('')
  for (const secret of Object.values(secrets)) {
    expect(output).not.toContain(secret)
    expect(output).not.toContain(encodeURIComponent(secret))
  }
}

function expectSafeError(log: CapturedLog, error: Error) {
  expect(log.err.type).toBe(error.constructor.name)
  expect(log.err.message).toBe('[REDACTED]')
  expect(log.err.stack).toMatch(/\n\s+at /)
  expect(log.err.stack).toContain('logging-redaction.spec.ts:')
  expect(Object.keys(log.err).sort()).toEqual(['message', 'stack', 'type'])
}

afterEach(() => {
  jest.restoreAllMocks()
  __resetOutOfContextForTests()
})

describe.each([false, true])('请求日志脱敏：development=%s', (development) => {
  it.each([200, 500])('状态 %s 的访问记录不输出凭据、正文或查询信息', (status) => {
    const { request, response, lines, records } = requestLog(development)
    const original = JSON.stringify({ headers: request.headers, body: request.body, query: request.query })
    response.statusCode = status
    if (status === 500) response.err = new Error(secretMessage)
    response.writeHead(status)
    response.emit('finish')

    expectNoSecrets(lines)
    const log = records()[0]!
    expect(log.level).toBe(status === 500 ? 50 : 30)
    expect(log.req.id).toBe('t62-redaction-trace')
    expect(log.req.method).toBe('POST')
    expect(log.req.url).toBe('/api/v1/auth/login')
    expect(log.req.headers.authorization).toBe('[REDACTED]')
    expect(log.req.headers['proxy-authorization']).toBe('[REDACTED]')
    expect(log.req.headers.cookie).toBe('[REDACTED]')
    expect(log.req.headers.referer).toBe('[REDACTED]')
    expect(log.req.headers['x-visitor-id']).toBe('[REDACTED]')
    expect(log.req.headers['content-type']).toBe('application/json')
    expect(log.req).not.toHaveProperty('body')
    expect(log.req).not.toHaveProperty('query')
    expect(log.req).not.toHaveProperty('params')
    expect(log.req).not.toHaveProperty('originalUrl')
    expect(log.res.statusCode).toBe(status)
    expect(log.res.headers['set-cookie']).toBe('[REDACTED]')
    expect(response.getHeader('X-Request-Id')).toBe('t62-redaction-trace')
    expect(JSON.stringify({ headers: request.headers, body: request.body, query: request.query })).toBe(original)
    expect(response.getHeader('set-cookie')).toContain(`refresh=${secrets.cookie}; HttpOnly`)
  })

  it('批处理票据在 URL 路径中同样隐藏，静态操作名称保持可辨', () => {
    for (const segment of [secrets.token, 'preview', 'execute']) {
      const { response, lines, records } = requestLog(development, `/api/v1/admin/posts/batch/${segment}`)
      response.writeHead(200)
      response.emit('finish')
      expectNoSecrets(lines)
      expect(records()[0]!.req.url).toContain(`/batch/${segment === secrets.token ? '[REDACTED]' : segment}`)
    }
  })
})

describe('结构化字段与异常日志脱敏', () => {
  it('显式结构化日志的密码、令牌、票据、访客标识与邮箱使用 Pino redact', () => {
    const lines: string[] = []
    // 显式附带正文时仍需 redact 防御；普通请求序列化器应完全排除正文。
    const { logger } = pinoHttp(
      { redact: loggingOptions().redact, wrapSerializers: false, serializers: { req: (value: unknown) => value } },
      { write: (line) => lines.push(line) },
    )
    const original = { ...structuredSecrets }
    const input = {
      ...structuredSecrets,
      req: { body: { ...structuredSecrets } },
      status: 200,
      traceId: 'structured-trace',
    }
    logger.info(input, '结构化事件')
    expectNoSecrets(lines)
    const log = JSON.parse(lines[0]!) as CapturedLog
    for (const key of Object.keys(structuredSecrets)) {
      expect(log[key]).toBe('[REDACTED]')
      expect((log.req.body as Record<string, unknown>)[key]).toBe('[REDACTED]')
    }
    expect(log.traceId).toBe('structured-trace')
    expect(log.status).toBe(200)
    expect(structuredSecrets).toEqual(original)
    expect(input.req.body).toEqual(original)
  })

  it.each(['直接 Error', 'err 对象', '显式消息', '结构化消息'] as const)(
    '%s 不通过 Pino 自动 msg 泄露原始异常',
    (style) => {
      const { middleware, lines, records } = capture()
      const error = new Error(secretMessage, { cause: new Error(secretMessage) })
      const stack = error.stack
      if (style === '直接 Error') middleware.logger.error(error)
      else if (style === 'err 对象') middleware.logger.error({ err: error, traceId: 'error-trace', status: 500 })
      else if (style === '结构化消息')
        middleware.logger.error({ err: error, msg: '请求处理异常', traceId: 'error-trace', status: 500 })
      else middleware.logger.error({ err: error, traceId: 'error-trace', status: 500 }, '请求处理异常')
      expectNoSecrets(lines)
      expectSafeError(records()[0]!, error)
      if (style === '显式消息' || style === '结构化消息') expect(records()[0]!.msg).toBe('请求处理异常')
      if (style !== '直接 Error') expect(records()[0]!.traceId).toBe('error-trace')
      expect(error.message).toBe(secretMessage)
      expect(error.stack).toBe(stack)
      expect((error.cause as Error).message).toBe(secretMessage)
    },
  )

  it('非 Error 或不可识别的堆栈不回退输出原值，普通业务日志仍保留', () => {
    const { middleware, lines, records } = capture()
    const error = new Error(secretMessage)
    error.stack = secretMessage
    middleware.logger.error({ err: error })
    middleware.logger.error({ err: { ...secrets, message: secretMessage, stack: secretMessage } })
    middleware.logger.info({ status: 200, traceId: 'ordinary-trace' }, '读取完成')
    expectNoSecrets(lines)
    for (const log of records().slice(0, 2)) {
      expect(log.err).toEqual({ type: 'Error', message: '[REDACTED]' })
      expect(log.msg).toBe('[REDACTED]')
    }
    expect(records()[2]).toMatchObject({ level: 30, status: 200, traceId: 'ordinary-trace', msg: '读取完成' })
  })

  it.each(['HttpException', 'AggregateError', '可枚举属性'] as const)('%s 的响应、原因和扩展字段不进入日志', (kind) => {
    const error =
      kind === 'HttpException'
        ? new HttpException({ message: secretMessage, ...secrets }, 503, { cause: new Error(secretMessage) })
        : kind === 'AggregateError'
          ? new AggregateError([new Error(secretMessage)], secretMessage)
          : Object.assign(new Error(secretMessage), {
              ...secrets,
              response: { ...secrets },
              detail: secretMessage,
              query: { ...structuredSecrets },
            })
    const { request, response, lines, records } = requestLog()
    request.log.error({ err: error, traceId: 'exception-trace', status: 503 }, '请求处理异常')
    response.statusCode = 503
    response.err = error
    response.writeHead(503)
    response.emit('finish')
    expectNoSecrets(lines)
    expect(records()).toHaveLength(2)
    for (const log of records()) expectSafeError(log, error)
    expect(records()[0]!.status).toBe(503)
    expect(records()[0]!.traceId).toBe('exception-trace')
  })

  it('Nest 请求上下文外直接构造的 Pino 保持相同脱敏契约', () => {
    __resetOutOfContextForTests()
    const lines: string[] = []
    const logger = new PinoLogger({ pinoHttp: [loggingOptions(), { write: (line) => lines.push(line) }] })
    const error = Object.assign(new Error(secretMessage), { response: { ...secrets } })
    logger.error({ err: error, ...structuredSecrets, traceId: 'outside-trace', status: 500 })
    expectNoSecrets(lines)
    const log = JSON.parse(lines[0]!) as CapturedLog
    expectSafeError(log, error)
    expect(log.traceId).toBe('outside-trace')
    expect(log.status).toBe(500)
  })

  it.each([false, true])('全局异常过滤器经 Nest 适配器输出时，凭据不会从错误或路径文本绕过脱敏：path=%s', (hasPath) => {
    const captured = requestLog(false, `/api/v1/admin/posts/batch/${secrets.token}`)
    const { request, lines, records } = captured
    if (hasPath) Object.assign(request, { path: `/api/v1/admin/posts/batch/${secrets.token}` })
    __resetOutOfContextForTests()
    const adapter = new NestPinoLogger(new PinoLogger({ pinoHttp: { logger: request.log } }), {})
    jest.spyOn(Logger.prototype, 'error').mockImplementation((message: unknown, ...params: unknown[]) => {
      adapter.error(message, ...params, 'AllExceptionsFilter')
    })
    const sent: { status?: number; body?: Record<string, unknown> } = {}
    const response = {
      status(status: number) {
        sent.status = status
        return this
      },
      json(body: Record<string, unknown>) {
        sent.body = body
      },
    }
    const host = {
      switchToHttp: () => ({ getRequest: () => request, getResponse: () => response }),
    } as unknown as ArgumentsHost
    const error = new Error(secretMessage)
    new AllExceptionsFilter().catch(error, host)
    expectNoSecrets(lines)
    expectSafeError(records()[0]!, error)
    expect(records()[0]!.traceId).toBe('t62-redaction-trace')
    expect(records()[0]!.status).toBe(500)
    expect(sent.status).toBe(500)
    expect(sent.body?.message).toBe('服务端异常')
    expect(sent.body?.traceId).toBe('t62-redaction-trace')
  })
})
