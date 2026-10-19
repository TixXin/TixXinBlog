/**
 * @file site-locale.ts
 * @description 部署的站点默认语言（SITE_DEFAULT_LOCALE，生产编排由 NUXT_PUBLIC_DEFAULT_LOCALE 映射）：
 *              只决定建库时写入的初始资料与未保存时的默认页脚、每日一言，只认 zh-CN 与 en，缺省中文
 * @author TixXin
 * @since 2026-10-19
 */
import { DEFAULT_API_LOCALE, type ApiLocale } from './locale'

export function siteDefaultLocale(env: Record<string, string | undefined> = process.env): ApiLocale {
  return env.SITE_DEFAULT_LOCALE?.trim() === 'en' ? 'en' : DEFAULT_API_LOCALE
}
