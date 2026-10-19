/**
 * @file format.ts
 * @description 跟随当前界面语言的日期、数字与相对时间格式化，替代散落的 toLocaleString('zh-CN', …)
 * @author TixXin
 * @since 2026-10-19
 */
import { tryUseNuxtApp } from 'nuxt/app'
import { FALLBACK_LOCALE } from '~~/i18n/localeOptions'

export type DateInput = Date | string | number

/** 翻译函数的最小形态，与 useI18n().t 兼容；非组件模块可由调用方传入 */
export type Translate = (key: string, params?: Record<string, unknown>) => string

/**
 * 当前 Nuxt 应用上的 i18n 实例。用最小结构类型描述：服务端 tsconfig 经类型导入加载本文件时
 * 没有 @nuxtjs/i18n 的 $i18n 声明，显式收窄后两端都能通过类型检查。
 */
interface I18nLike {
  locale?: string | { value?: string }
  t: (key: string, params?: Record<string, unknown>) => string
}
function nuxtI18n(): I18nLike | undefined {
  return (tryUseNuxtApp() as { $i18n?: I18nLike } | null | undefined)?.$i18n
}

/**
 * 当前界面语言：在组件、插件、composable 等 Nuxt 上下文中调用时读取 i18n 的实时 locale，
 * 脱离上下文（纯 Node 脚本）时回退到中文。每次调用时读取，不在模块顶层固定语言。
 */
export function currentLocale(): string {
  const locale = nuxtI18n()?.locale
  return (typeof locale === 'string' ? locale : locale?.value) || FALLBACK_LOCALE
}

/** 当前上下文的翻译函数；脱离 Nuxt 上下文时原样返回 key，便于发现漏传 t 的调用 */
export function currentTranslate(): Translate {
  const i18n = nuxtI18n()
  return i18n ? (key, params) => (params ? i18n.t(key, params) : i18n.t(key)) : (key) => key
}

function toDate(value: DateInput | null | undefined): Date | null {
  if (value === null || value === undefined || value === '') return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isFinite(date.getTime()) ? date : null
}

/** 日期加时间，等价于 new Date(value).toLocaleString(locale, options)；空值或非法时间返回空串 */
export function formatDateTime(value: DateInput | null | undefined, options?: Intl.DateTimeFormatOptions): string {
  const date = toDate(value)
  return date ? date.toLocaleString(currentLocale(), options) : ''
}

/** 仅日期，等价于 new Date(value).toLocaleDateString(locale, options)；空值或非法时间返回空串 */
export function formatDate(value: DateInput | null | undefined, options?: Intl.DateTimeFormatOptions): string {
  const date = toDate(value)
  return date ? date.toLocaleDateString(currentLocale(), options) : ''
}

/** 数字分组，等价于 value.toLocaleString(locale, options)；非有限数返回空串 */
export function formatNumber(value: number | bigint | null | undefined, options?: Intl.NumberFormatOptions): string {
  if (typeof value !== 'bigint' && !(typeof value === 'number' && Number.isFinite(value))) return ''
  return new Intl.NumberFormat(currentLocale(), options).format(value)
}

const RELATIVE_UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ['year', 365 * 24 * 3600],
  ['month', 30 * 24 * 3600],
  ['week', 7 * 24 * 3600],
  ['day', 24 * 3600],
  ['hour', 3600],
  ['minute', 60],
  ['second', 1],
]

/**
 * 相对时间，如「3 分钟前」「3 minutes ago」「明天」。取不超过时间差的最大单位，
 * numeric 默认 auto（昨天/明天/现在）；空值或非法时间返回空串。
 */
export function formatRelative(
  value: DateInput | null | undefined,
  options: { now?: DateInput; numeric?: Intl.RelativeTimeFormatNumeric; style?: Intl.RelativeTimeFormatStyle } = {},
): string {
  const date = toDate(value)
  const now = toDate(options.now ?? Date.now())
  if (!date || !now) return ''
  const seconds = Math.round((date.getTime() - now.getTime()) / 1000)
  const formatter = new Intl.RelativeTimeFormat(currentLocale(), {
    numeric: options.numeric ?? 'auto',
    style: options.style ?? 'long',
  })
  for (const [unit, size] of RELATIVE_UNITS) {
    if (Math.abs(seconds) >= size || unit === 'second') return formatter.format(Math.trunc(seconds / size), unit)
  }
  return ''
}
