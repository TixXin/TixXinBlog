/**
 * @file reporter.ts
 * @description 应用内有界错误采集：脱敏、节流、去重和尽力上报，失败不产生新的未处理异常
 */
import type { App } from 'vue'
import type { ClientErrorReport, ClientErrorSource } from './types'

const ENDPOINT = '/api/v1/client-errors'
const INTERVAL_MS = 10_000
const DUPLICATE_MS = 60_000
const MAX_REPORTS = 20

/** 先删除查询与片段，再裁切；错误消息和堆栈中的相对地址也遵循相同边界。 */
export function sanitizeClientErrorText(value: string, limit: number): string {
  return value
    .replace(/[?#][^\s"'<>`]*/g, '')
    .replace(/((?:https?:)?\/\/)[^\s/"'<>`]*@/gi, '$1')
    .replace(/\p{Cc}/gu, ' ')
    .slice(0, limit)
}

function pageUrl(value: string): string {
  const url = new URL(value)
  if (!['https:', 'http:'].includes(url.protocol)) throw new Error('不支持的页面地址')
  return `${url.origin}${url.pathname}`.slice(0, 2048)
}

/** 先脱敏文件地址，再拼接行列，避免查询串把 `:line:col` 一并裁掉。 */
function windowErrorLocation(event: ErrorEvent): string | undefined {
  if (!event.filename) return undefined
  const suffix = `:${event.lineno}:${event.colno}`
  const filename = sanitizeClientErrorText(event.filename, Math.max(0, 200 - suffix.length))
  return `${filename}${suffix}`
}

/** 只取可诊断字段，不序列化任意 rejection、组件状态或网络响应。 */
function errorDetails(error: unknown): { message: string; stack?: string } {
  if (typeof error === 'string') return { message: error }
  if (error && typeof error === 'object') {
    const candidate = error as { message?: unknown; stack?: unknown }
    return {
      message: typeof candidate.message === 'string' ? candidate.message : '未知客户端错误',
      stack: typeof candidate.stack === 'string' ? candidate.stack : undefined,
    }
  }
  return { message: '未知客户端错误' }
}

export function createClientErrorReporter(options: {
  development: boolean
  getUrl: () => string
  fetch: typeof globalThis.fetch
  print: (report: ClientErrorReport) => void
  now?: () => number
}) {
  const now = options.now ?? Date.now
  const recent = new Map<string, number>()
  let lastSent = -Infinity
  let total = 0
  let active = true
  let reporting = false

  const report = (source: ClientErrorSource, error: unknown, info?: string) => {
    if (!active || reporting || total >= MAX_REPORTS) return
    reporting = true
    try {
      const timestamp = now()
      if (timestamp - lastSent < INTERVAL_MS) return
      const details = errorDetails(error)
      const payload: ClientErrorReport = {
        source,
        message: sanitizeClientErrorText(details.message, 1000).trim() || '未知客户端错误',
        url: pageUrl(options.getUrl()),
      }
      if (details.stack) payload.stack = sanitizeClientErrorText(details.stack, 4000)
      if (info) payload.info = sanitizeClientErrorText(info, 200)
      // 不含来源，避免同一个异常先经 Vue 再经 window 时重复上报。
      const key = JSON.stringify([payload.message, payload.stack, payload.url])
      for (const [entry, seen] of recent) {
        if (timestamp - seen >= DUPLICATE_MS) recent.delete(entry)
      }
      if (recent.has(key)) return
      recent.set(key, timestamp)
      lastSent = timestamp
      total += 1
      if (options.development) {
        options.print(payload)
        return
      }
      // 独立使用原生 fetch：不刷新登录、不附带 Cookie/令牌、不重试、不反馈到业务错误提示。
      void options
        .fetch(ENDPOINT, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
          credentials: 'omit',
          referrerPolicy: 'no-referrer',
          mode: 'same-origin',
          redirect: 'error',
          cache: 'no-store',
          signal: AbortSignal.timeout(5000),
        })
        .catch(() => undefined)
    } catch {
      // 恶意 getter、序列化、浏览器 API 或传输失败都不能再次进入全局错误处理。
    } finally {
      reporting = false
    }
  }

  return {
    report,
    dispose() {
      active = false
      recent.clear()
    },
  }
}

export function bindClientErrorHandlers(
  app: Pick<App, 'config'>,
  target: Window,
  reporter: ReturnType<typeof createClientErrorReporter>,
) {
  const previous = app.config.errorHandler
  // Nuxt 的启动占位处理器会设置全页错误；不能把它链到整个应用的后续可恢复异常上。
  const previousIsNuxtDefault = !!(previous as (typeof previous & { __nuxt_default?: boolean }) | undefined)
    ?.__nuxt_default
  const handler: NonNullable<App['config']['errorHandler']> = (error, instance, info) => {
    reporter.report('vue', error, info)
    if (!previousIsNuxtDefault) return previous?.(error, instance, info)
  }
  const onError = (event: ErrorEvent) => {
    // 资源加载事件没有错误详情，不读取 DOM 节点或其内容。
    if (!event.message && !event.error) return
    reporter.report('window', event.error ?? event.message, windowErrorLocation(event))
  }
  const onRejection = (event: PromiseRejectionEvent) => reporter.report('unhandledrejection', event.reason)
  app.config.errorHandler = handler
  target.addEventListener('error', onError)
  target.addEventListener('unhandledrejection', onRejection)
  return () => {
    target.removeEventListener('error', onError)
    target.removeEventListener('unhandledrejection', onRejection)
    if (app.config.errorHandler === handler) app.config.errorHandler = previousIsNuxtDefault ? undefined : previous
    reporter.dispose()
  }
}
