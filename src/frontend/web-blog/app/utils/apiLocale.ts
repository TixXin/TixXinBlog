/**
 * @file apiLocale.ts
 * @description 浏览器请求同源 /api/v1 时附带当前界面语言；网关据此设置后端的 Accept-Language，后端按语言返回错误信息
 * @author TixXin
 * @since 2026-10-19
 */
import { isSupportedLocale } from '~~/i18n/localeOptions'

/** 与 server/utils/requestLocale.ts 的 API_LOCALE_HEADER 一致；浏览器自动发送的 Accept-Language 不代表界面语言 */
export const API_LOCALE_HEADER = 'X-Blog-Locale'

/** 只给同源的 /api/v1 请求附带语言，不向第三方地址泄露界面偏好 */
export function isSameOriginApiRequest(request: unknown, origin: string): boolean {
  const raw =
    typeof request === 'string'
      ? request
      : request instanceof URL
        ? request.href
        : request && typeof request === 'object' && 'url' in request && typeof request.url === 'string'
          ? request.url
          : ''
  if (!raw) return false
  try {
    const url = new URL(raw, origin)
    return url.origin === origin && /^\/api\/v1(?:\/|$)/.test(url.pathname)
  } catch {
    return false
  }
}

/** 在既有请求头上补充语言；调用方已显式设置时保留调用方的值，无效语言不添加 */
export function withApiLocale(headers: HeadersInit | undefined, locale: unknown): Headers {
  const result = new Headers(headers)
  if (isSupportedLocale(locale) && !result.has(API_LOCALE_HEADER)) result.set(API_LOCALE_HEADER, locale)
  return result
}
