/**
 * @file all-exceptions.filter.spec.ts
 * @description 异常过滤器回归：未知异常和 5xx 记录堆栈与 traceId，客户端不泄露内部细节
 */
import { BadRequestException, ConflictException, HttpStatus, Logger, ServiceUnavailableException } from '@nestjs/common'
import type { ArgumentsHost } from '@nestjs/common'
import { ErrorCode } from '../../constants/error-codes'
import { BusinessException } from '../../exceptions/business.exception'
import { msg } from '../../i18n'
import { AllExceptionsFilter } from '../all-exceptions.filter'

function invoke(exception: unknown, headers: Record<string, string> = {}) {
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
  const request = { method: 'POST', path: '/api/v1/posts', headers: { 'x-trace-id': 'trace-filter-1', ...headers } }
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

  describe('按 Accept-Language 返回文案', () => {
    const en = { 'accept-language': 'en' }

    it('不带语言头时字典文案返回中文，en 返回英文', () => {
      const exception = () => new ServiceUnavailableException(msg('common.databaseNotReady'))
      expect(invoke(exception()).body?.message).toBe('数据库尚未就绪')
      expect(invoke(exception(), en).body?.message).toBe('The database is not ready yet')
      expect(invoke(exception(), { 'accept-language': 'fr' }).body?.message).toBe('数据库尚未就绪')
    })

    it('BusinessException 保留业务码并翻译', () => {
      const exception = new BusinessException(
        ErrorCode.Unauthorized,
        msg('common.sessionExpired'),
        HttpStatus.UNAUTHORIZED,
      )
      expect(exception.message).toBe('会话已失效，请重新登录')
      expect(invoke(exception, en)).toMatchObject({
        status: 401,
        body: { code: ErrorCode.Unauthorized, message: 'Your session has expired. Please sign in again.' },
      })
    })

    it('冲突文案使用字典登记的稳定业务码', () => {
      const sent = invoke(new ConflictException(msg('common.contentContextChangedEdit')), en)
      expect(sent.status).toBe(409)
      expect(sent.body?.code).toBe(ErrorCode.ContentContextChanged)
      expect(sent.body?.message).toBe(
        'The site data context has changed. Keep your input and refresh the page before editing.',
      )
      expect(invoke(new ConflictException('其他冲突')).body?.code).toBe(ErrorCode.Conflict)
    })

    it('未带 key 但与字典中文一致的字符串也按语言翻译，未知异常返回英文通用文案', () => {
      expect(invoke(new BadRequestException(['提交未完成，请稍后重试']), en).body?.message).toBe(
        'Your submission could not be completed. Please try again later.',
      )
      expect(invoke(new BadRequestException('字典外的说明'), en).body?.message).toBe('字典外的说明')
      expect(invoke(new Error('boom'), en).body?.message).toBe('Internal server error')
    })
  })
})
