/**
 * @file localeOptions.test.ts
 * @description 站点默认语言（NUXT_PUBLIC_DEFAULT_LOCALE）解析：只接受 zh-CN 与 en，其余回退 zh-CN
 * @author TixXin
 * @since 2026-10-19
 */

import { describe, expect, it } from 'vitest'
import { OG_LOCALES, SUPPORTED_LOCALES, isSupportedLocale, resolveDefaultLocale } from '../../i18n/localeOptions'

describe('resolveDefaultLocale', () => {
  it('未设置或空值时使用 zh-CN', () => {
    expect(resolveDefaultLocale(undefined)).toBe('zh-CN')
    expect(resolveDefaultLocale('')).toBe('zh-CN')
    expect(resolveDefaultLocale('   ')).toBe('zh-CN')
  })

  it('接受两种受支持的语言，忽略首尾空白', () => {
    expect(resolveDefaultLocale('zh-CN')).toBe('zh-CN')
    expect(resolveDefaultLocale('en')).toBe('en')
    expect(resolveDefaultLocale(' en\n')).toBe('en')
  })

  it('大小写不符、近似写法与其他语言一律回退 zh-CN', () => {
    for (const value of ['EN', 'en-US', 'zh-cn', 'zh', 'zh_CN', 'fr', 'ja-JP', 'true', 'null']) {
      expect(resolveDefaultLocale(value), value).toBe('zh-CN')
    }
    expect(resolveDefaultLocale(1)).toBe('zh-CN')
    expect(resolveDefaultLocale(null)).toBe('zh-CN')
  })

  it('受支持语言判定与 og:locale 映射覆盖全部语言', () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(isSupportedLocale(locale)).toBe(true)
      expect(OG_LOCALES[locale]).toMatch(/^[a-z]{2}_[A-Z]{2}$/)
    }
    expect(isSupportedLocale('de')).toBe(false)
  })
})
