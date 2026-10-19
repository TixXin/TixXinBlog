/**
 * @file localeOptions.ts
 * @description 界面语言的共享常量与站点默认语言解析，供 nuxt.config、运行时插件与单测共用
 * @author TixXin
 * @since 2026-10-19
 */

/** 支持的界面语言；第一项是未配置时的站点默认语言 */
export const SUPPORTED_LOCALES = ['zh-CN', 'en'] as const

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number]

/** 未配置或配置无效时的站点默认语言 */
export const FALLBACK_LOCALE: SupportedLocale = 'zh-CN'

/** 访客主动选择语言后写入的 cookie；SSR 页面缓存按整串 cookie 分键，不同语言各自一份 */
export const LOCALE_COOKIE_KEY = 'blog-locale'

/** 访客语言 cookie 的有效期（秒），与布局主题 cookie 一样保留一年 */
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365

/**
 * 字典域：每个域对应 i18n/locales/<locale>/<域>.json，文件唯一的顶层键与域名相同。
 * 各迁移代理只写自己的域文件，避免并行修改同一份字典。
 */
export const DICTIONARY_DOMAINS = [
  'common',
  'layout',
  'theme',
  'article',
  'flash-moment',
  'interaction',
  'misc',
  'admin-content',
  'admin-media',
  'admin-system',
] as const

/** Open Graph 的 og:locale 取值（下划线分隔的语言_地区） */
export const OG_LOCALES: Record<SupportedLocale, string> = {
  'zh-CN': 'zh_CN',
  en: 'en_US',
}

/** 判断任意值是否为受支持的界面语言 */
export function isSupportedLocale(value: unknown): value is SupportedLocale {
  return typeof value === 'string' && (SUPPORTED_LOCALES as readonly string[]).includes(value)
}

/**
 * 解析站点默认语言（NUXT_PUBLIC_DEFAULT_LOCALE）：只接受 zh-CN 与 en，
 * 首尾空白忽略，其余值（含大小写不符、空串、未设置）一律回退到 zh-CN。
 */
export function resolveDefaultLocale(value: unknown): SupportedLocale {
  const normalized = typeof value === 'string' ? value.trim() : value
  return isSupportedLocale(normalized) ? normalized : FALLBACK_LOCALE
}
