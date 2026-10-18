/**
 * @file clientErrors.test.ts
 * @description 全局错误采集的脱敏、请求边界、节流与监听生命周期回归
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp } from 'vue'
import { bindClientErrorHandlers, createClientErrorReporter } from '../../app/features/client-error/reporter'
import type { ClientErrorReport } from '../../app/features/client-error/types'

const disposers: (() => void)[] = []
afterEach(() => {
  disposers.splice(0).forEach((dispose) => dispose())
  vi.restoreAllMocks()
})

function setup(development = false) {
  let clock = 0
  const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response('{}', { status: 202 }))
  const print = vi.fn<(report: ClientErrorReport) => void>()
  const reporter = createClientErrorReporter({
    development,
    getUrl: () => 'https://user:password@blog.example/posts/1?token=page-secret#fragment-secret',
    fetch,
    print,
    now: () => clock,
  })
  disposers.push(reporter.dispose)
  return {
    ...reporter,
    reporter,
    fetch,
    print,
    advance: (ms: number) => (clock += ms),
    payload: (index = 0) => JSON.parse(String(fetch.mock.calls[index]![1]!.body)) as ClientErrorReport,
  }
}

describe('客户端错误最小报告', () => {
  it('所有文本先脱敏，发送同源无凭据且无来源地址的有界请求', () => {
    const state = setup()
    state.report(
      'vue',
      {
        message: '加载 https://user:password@blog.example/api?token=message-secret#hash 失败',
        stack:
          'Error\n at https://user:password@blog.example/app.js?token=stack-secret:2:3\n at /chunk.js?code=relative-secret:1:2',
      },
      'render https://blog.example/component?token=info-secret',
    )
    expect(state.payload()).toEqual({
      source: 'vue',
      message: '加载 https://blog.example/api 失败',
      url: 'https://blog.example/posts/1',
      stack: 'Error  at https://blog.example/app.js  at /chunk.js',
      info: 'render https://blog.example/component',
    })
    const [url, request] = state.fetch.mock.calls[0]!
    expect(url).toBe('/api/v1/client-errors')
    expect(request).toMatchObject({
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      mode: 'same-origin',
      redirect: 'error',
      cache: 'no-store',
    })
    expect(request?.signal).toBeInstanceOf(AbortSignal)
    expect(JSON.stringify(state.payload())).not.toMatch(/secret|password|user:/)
  })

  it('消息、堆栈和 Vue 上下文遵循后端长度上限', () => {
    const state = setup()
    state.report('vue', { message: '错'.repeat(1100), stack: '栈'.repeat(5000) }, '文'.repeat(300))
    expect(state.payload().message).toHaveLength(1000)
    expect(state.payload().stack).toHaveLength(4000)
    expect(state.payload().info).toHaveLength(200)
  })

  it('兼容字符串和未知 Promise 拒绝，不遍历敏感对象或调用 toJSON', () => {
    const state = setup()
    const toJSON = vi.fn(() => ({ token: 'private' }))
    state.report('unhandledrejection', { token: 'private', toJSON })
    expect(state.payload()).toEqual({
      source: 'unhandledrejection',
      message: '未知客户端错误',
      url: 'https://blog.example/posts/1',
    })
    expect(toJSON).not.toHaveBeenCalled()
    state.advance(10_000)
    state.report('unhandledrejection', '字符串错误')
    expect(state.payload(1).message).toBe('字符串错误')
  })

  it('开发环境只打印脱敏报告，不发送请求', () => {
    const state = setup(true)
    state.report('window', '请求 /api?token=secret 失败')
    expect(state.fetch).not.toHaveBeenCalled()
    expect(state.print).toHaveBeenCalledExactlyOnceWith({
      source: 'window',
      message: '请求 /api 失败',
      url: 'https://blog.example/posts/1',
    })
  })

  it('异常 getter 或不支持的页面 URL 不影响业务，不产生新异常', () => {
    const state = setup()
    const malformed = {
      get message() {
        throw new Error('读取失败')
      },
    }
    expect(() => state.report('unhandledrejection', malformed)).not.toThrow()
    expect(state.fetch).not.toHaveBeenCalled()
    state.report('window', '之后的有效错误')
    expect(state.fetch).toHaveBeenCalledTimes(1)
    const invalid = createClientErrorReporter({
      development: false,
      getUrl: () => 'data:text/plain,secret',
      fetch: state.fetch,
      print: state.print,
    })
    invalid.report('window', '错误')
    expect(state.fetch).toHaveBeenCalledTimes(1)
    invalid.dispose()
  })
})

describe('客户端上报预算与故障隔离', () => {
  it('突发错误每十秒最多一次，未发送的错误不排队', () => {
    const state = setup()
    state.report('window', '错误一')
    state.report('window', '错误二')
    state.advance(9999)
    state.report('window', '错误三')
    expect(state.fetch).toHaveBeenCalledTimes(1)
    state.advance(1)
    state.report('window', '错误四')
    expect(state.fetch).toHaveBeenCalledTimes(2)
    expect(state.payload(1).message).toBe('错误四')
  })

  it('同错误跨捕获来源及 URL 参数变化在一分钟内去重，到期允许再次报告', () => {
    const state = setup()
    state.report('vue', '失败 /api?token=first')
    state.advance(10_000)
    state.report('window', '失败 /api?token=second')
    expect(state.fetch).toHaveBeenCalledTimes(1)
    state.advance(50_000)
    state.report('window', '失败 /api?token=third')
    expect(state.fetch).toHaveBeenCalledTimes(2)
  })

  it('每个应用最多二十次，彼此不共享预算', () => {
    const state = setup()
    for (let index = 0; index < 30; index += 1) {
      state.report('window', `错误 ${index}`)
      state.advance(10_000)
    }
    expect(state.fetch).toHaveBeenCalledTimes(20)
    const another = setup()
    another.report('window', '错误 0')
    expect(another.fetch).toHaveBeenCalledTimes(1)
  })

  it('传输拒绝、同步抛错和 HTTP 失败都不重试，也不会成为未处理 rejection', async () => {
    const state = setup()
    state.fetch.mockRejectedValueOnce(new Error('offline'))
    expect(() => state.report('window', '离线错误')).not.toThrow()
    await Promise.resolve()
    state.advance(10_000)
    state.fetch.mockImplementationOnce(() => {
      throw new Error('fetch 不可用')
    })
    expect(() => state.report('window', '同步失败')).not.toThrow()
    state.advance(10_000)
    state.fetch.mockResolvedValueOnce(new Response('{}', { status: 429 }))
    state.report('window', '限流错误')
    await Promise.resolve()
    expect(state.fetch).toHaveBeenCalledTimes(3)
    expect(state.print).not.toHaveBeenCalled()
  })

  it('打印过程重入或抛错不会引起递归，释放后停止报告', () => {
    const state = setup(true)
    state.print.mockImplementation(() => {
      state.advance(10_000)
      state.report('window', '重入错误')
      throw new Error('控制台失败')
    })
    expect(() => state.report('window', '原始错误')).not.toThrow()
    expect(state.print).toHaveBeenCalledTimes(1)
    state.dispose()
    state.advance(10_000)
    state.report('window', '卸载后错误')
    expect(state.print).toHaveBeenCalledTimes(1)
  })
})

describe('全局捕获与生命周期', () => {
  it('Vue、window error 与 unhandledrejection 共用报告器，保留原有自定义处理器', () => {
    const state = setup()
    const app = createApp({})
    const previous = vi.fn()
    app.config.errorHandler = previous
    const target = new EventTarget() as Window
    const dispose = bindClientErrorHandlers(app, target, state.reporter)
    disposers.push(dispose)
    const error = new Error('Vue 错误')
    app.config.errorHandler!(error, null, 'render')
    expect(previous).toHaveBeenCalledWith(error, null, 'render')
    expect(state.payload()).toMatchObject({ source: 'vue', message: 'Vue 错误', info: 'render' })
    state.advance(10_000)
    const event = new ErrorEvent('error', {
      message: '窗口错误',
      filename: 'https://blog.example/app.js?secret=value',
      lineno: 2,
      colno: 3,
      cancelable: true,
    })
    target.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(false)
    expect(state.payload(1)).toMatchObject({
      source: 'window',
      message: '窗口错误',
      info: 'https://blog.example/app.js:2:3',
    })
    state.advance(10_000)
    const rejection = new Event('unhandledrejection', { cancelable: true })
    Object.defineProperty(rejection, 'reason', { value: 'Promise 错误' })
    target.dispatchEvent(rejection)
    expect(rejection.defaultPrevented).toBe(false)
    expect(state.payload(2)).toMatchObject({ source: 'unhandledrejection', message: 'Promise 错误' })
    dispose()
    dispose()
    expect(app.config.errorHandler).toBe(previous)
    state.advance(10_000)
    target.dispatchEvent(new ErrorEvent('error', { message: '释放后窗口错误' }))
    target.dispatchEvent(rejection)
    expect(state.fetch).toHaveBeenCalledTimes(3)
  })

  it('不长期调用 Nuxt 启动占位处理器，也不覆盖后安装的处理器', () => {
    const state = setup()
    const app = createApp({})
    const nuxtDefault = Object.assign(vi.fn(), { __nuxt_default: true })
    app.config.errorHandler = nuxtDefault
    const dispose = bindClientErrorHandlers(app, new EventTarget() as Window, state.reporter)
    disposers.push(dispose)
    app.config.errorHandler!('错误', null, 'render')
    expect(nuxtDefault).not.toHaveBeenCalled()
    const later = vi.fn()
    app.config.errorHandler = later
    dispose()
    expect(app.config.errorHandler).toBe(later)
  })

  it('忽略没有诊断信息的资源事件，并在重新安装后只留一个有效监听', () => {
    const state = setup()
    const app = createApp({})
    const target = new EventTarget() as Window
    const dispose = bindClientErrorHandlers(app, target, state.reporter)
    target.dispatchEvent(new Event('error'))
    expect(state.fetch).not.toHaveBeenCalled()
    dispose()
    const next = setup()
    disposers.push(bindClientErrorHandlers(app, target, next.reporter))
    target.dispatchEvent(new ErrorEvent('error', { message: '热更新后的错误' }))
    expect(state.fetch).not.toHaveBeenCalled()
    expect(next.fetch).toHaveBeenCalledTimes(1)
  })
})
