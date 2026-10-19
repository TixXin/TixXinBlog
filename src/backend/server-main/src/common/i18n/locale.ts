/**
 * @file locale.ts
 * @description 接口响应语言：只认 zh-CN 与 en，按 Accept-Language 的权重顺序取第一个可识别的语言，其余一律回退中文
 * @author TixXin
 * @since 2026-10-19
 */

/** 后端可返回的语言；第一项是缺省语言 */
export const API_LOCALES = ['zh-CN', 'en'] as const

export type ApiLocale = (typeof API_LOCALES)[number]

/** 不带或无法识别 Accept-Language 时使用中文，保持既有接口文案不变 */
export const DEFAULT_API_LOCALE: ApiLocale = 'zh-CN'

const LOCALE_KEY = Symbol('apiLocale')

type LocaleRequest = { headers?: Record<string, string | string[] | undefined>; [LOCALE_KEY]?: ApiLocale }

/**
 * 解析 Accept-Language：按 q 值从高到低（同权重保持原顺序）查找主语言为 en 或 zh 的条目，
 * en（含 en-US 等地区变体）返回 en，zh 的任意变体返回 zh-CN；q=0、通配符和其他语言跳过，都不匹配时回退中文。
 */
export function resolveApiLocale(header: unknown): ApiLocale {
  const raw = Array.isArray(header) ? header.join(',') : header
  if (typeof raw !== 'string' || !raw.trim()) return DEFAULT_API_LOCALE
  const candidates = raw
    .slice(0, 512)
    .split(',')
    .map((part, index) => {
      const [tag = '', ...parameters] = part.trim().split(';')
      const quality = parameters.map((item) => /^\s*q\s*=\s*([0-9.]+)\s*$/i.exec(item)?.[1]).find(Boolean)
      const weight = quality === undefined ? 1 : Number(quality)
      return {
        primary: tag.trim().toLowerCase().split('-')[0] ?? '',
        weight: Number.isFinite(weight) ? weight : 0,
        index,
      }
    })
    .filter((item) => item.weight > 0)
    .sort((a, b) => b.weight - a.weight || a.index - b.index)
  for (const { primary } of candidates) {
    if (primary === 'en') return 'en'
    if (primary === 'zh') return 'zh-CN'
  }
  return DEFAULT_API_LOCALE
}

/** 同一请求只解析一次；过滤器、控制器与服务读取到的语言一致 */
export function requestLocale(request: unknown): ApiLocale {
  if (!request || typeof request !== 'object') return DEFAULT_API_LOCALE
  const target = request as LocaleRequest
  if (target[LOCALE_KEY]) return target[LOCALE_KEY]
  const locale = resolveApiLocale(target.headers?.['accept-language'])
  target[LOCALE_KEY] = locale
  return locale
}
