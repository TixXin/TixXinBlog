/**
 * @file all-exceptions.filter.spec.ts
 * @description 异常过滤器回归：未知异常和 5xx 记录堆栈与 traceId，客户端不泄露内部细节
 */
import { BadRequestException, Logger, ServiceUnavailableException } from '@nestjs/common'
import type { ArgumentsHost } from '@nestjs/common'
import { AllExceptionsFilter } from '../all-exceptions.filter'

function invoke(exception: unknown) {
  const sent: { status?: number; body?: Record<string, unknown> } = {}
  const response = {
    status(code: number) {
      sent.status = code
      return this
    },
    json(body: Record<string, unknown>) {
      sent.body = body
    },
  }
  const request = { method: 'POST', path: '/api/v1/posts', headers: { 'x-trace-id': 'trace-filter-1' } }
  const host = {
    switchToHttp: () => ({ getResponse: () => response, getRequest: () => request }),
  } as unknown as ArgumentsHost
  new AllExceptionsFilter().catch(exception, host)
  return sent
}

describe('AllExceptionsFilter', () => {
  let error: jest.SpyInstance
  beforeEach(() => {
    error = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined)
  })
  afterEach(() => error.mockRestore())

  it('未知异常返回通用 500，日志带原始错误与同一 traceId', () => {
    const cause = new Error('connect ECONNREFUSED postgres://secret@db')
    const sent = invoke(cause)
    expect(sent.status).toBe(500)
    expect(sent.body).toEqual({
      code: expect.any(Number),
      message: '服务端异常',
      data: null,
      traceId: 'trace-filter-1',
    })
    expect(JSON.stringify(sent.body)).not.toContain('secret')
    expect(error).toHaveBeenCalledTimes(1)
    const [payload] = error.mock.calls[0] as [{ err: Error; traceId: string; status: number }]
    expect(payload.err).toBe(cause)
    expect(payload.traceId).toBe('trace-filter-1')
    expect(payload.status).toBe(500)
  })

  it('非 Error 抛出值也包装成带堆栈的错误记录', () => {
    invoke('plain failure')
    const [payload] = error.mock.calls[0] as [{ err: Error }]
    expect(payload.err).toBeInstanceOf(Error)
    expect(payload.err.stack).toBeDefined()
  })

  it('HttpException 5xx 记录日志，4xx 不记录', () => {
    expect(invoke(new ServiceUnavailableException('数据库尚未就绪')).status).toBe(503)
    expect(error).toHaveBeenCalledTimes(1)
    const sent = invoke(new BadRequestException(['标题不能为空']))
    expect(sent.status).toBe(400)
    expect(sent.body?.message).toBe('标题不能为空')
    expect(error).toHaveBeenCalledTimes(1)
  })
})
