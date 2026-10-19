/**
 * @file apiError.ts
 * @description 后端错误的统一展示：优先显示接口返回的 message，没有时用当前语言的兜底文案
 * @author TixXin
 * @since 2026-10-19
 */
import { currentTranslate, type Translate } from '~/utils/format'

/** 从 $fetch / useFetch 的错误中取出后端 { code, message } 响应里的 message；取不到返回 null */
export function apiResponseMessage(cause: unknown): string | null {
  const data = (cause as { data?: unknown } | null | undefined)?.data
  if (!data || typeof data !== 'object') return null
  const raw = (data as { message?: unknown }).message
  // 校验管道的 400 明细可能是数组，与后端全局过滤器一致取首条。
  const message = Array.isArray(raw) ? raw[0] : raw
  return typeof message === 'string' && message.trim() ? message : null
}

/**
 * 面向用户的错误文案：后端给了可读 message 就原样显示（阶段 4 起后端按请求语言翻译），
 * 否则显示 fallbackKey 对应的字典文案。网络异常、Nuxt 包装的技术性 Error.message 不直接展示。
 *
 * @param cause 捕获到的错误
 * @param fallbackKey 兜底文案的字典 key，如 'common.error.requestFailed'
 * @param options.params 兜底文案的插值参数
 * @param options.t 非组件模块可显式传入翻译函数；缺省使用当前 Nuxt 上下文的 i18n
 */
export function apiErrorMessage(
  cause: unknown,
  fallbackKey: string,
  options: { params?: Record<string, unknown>; t?: Translate } = {},
): string {
  const message = apiResponseMessage(cause)
  if (message) return message
  const t = options.t ?? currentTranslate()
  return options.params ? t(fallbackKey, options.params) : t(fallbackKey)
}
