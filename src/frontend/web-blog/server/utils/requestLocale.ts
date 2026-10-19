/**
 * @file requestLocale.ts
 * @description 转发给后端的界面语言：显式请求头、blog-locale cookie、站点默认语言依次生效，
 *              SSR 期间的内部调用通过 AsyncLocalStorage 沿用外部请求登记的语言
 * @author TixXin
 * @since 2026-10-19
 */
import { AsyncLocalStorage } from 'node:async_hooks'
import { getCookie, getHeader, type H3Event } from 'h3'
import {
  LOCALE_COOKIE_KEY,
  isSupportedLocale,
  resolveDefaultLocale,
  type SupportedLocale,
} from '../../i18n/localeOptions'
import { isInternalRequest } from './requestIdentity'

/** 浏览器 $fetch 附带的当前界面语言；浏览器自动发送的 Accept-Language 不代表界面语言，网关不采纳 */
export const API_LOCALE_HEADER = 'x-blog-locale'

const storage = new AsyncLocalStorage<SupportedLocale>()

/** 外部请求进入时登记，SSR 渲染及其内部 fetch 读取同一份语言 */
export function enterRequestLocale(locale: SupportedLocale) {
  storage.enterWith(locale)
}

export function currentRequestLocale(): SupportedLocale | undefined {
  return storage.getStore()
}

/** 站点默认语言；运行时配置缺失时回退 zh-CN */
export function siteDefaultLocale(event: H3Event): SupportedLocale {
  const config = useRuntimeConfig(event) as { public?: { i18n?: { defaultLocale?: unknown } } }
  return resolveDefaultLocale(config.public?.i18n?.defaultLocale)
}

/** 外部请求的界面语言：与首屏定语言规则一致（cookie 优先，否则站点默认），并允许客户端显式指定 */
export function resolveEventLocale(event: H3Event): SupportedLocale {
  const explicit = getHeader(event, API_LOCALE_HEADER)
  if (isSupportedLocale(explicit)) return explicit
  const cookie = getCookie(event, LOCALE_COOKIE_KEY)
  if (isSupportedLocale(cookie)) return cookie
  return siteDefaultLocale(event)
}

/** 当前事件转发给后端的 Accept-Language；内部调用沿用外部请求登记的语言 */
export function localeForUpstream(event: H3Event): SupportedLocale {
  if (isInternalRequest(event.node.req.socket?.remoteAddress)) {
    const explicit = getHeader(event, API_LOCALE_HEADER)
    if (isSupportedLocale(explicit)) return explicit
    return currentRequestLocale() ?? resolveEventLocale(event)
  }
  return resolveEventLocale(event)
}
