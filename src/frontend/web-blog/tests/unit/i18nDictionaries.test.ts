/**
 * @file i18nDictionaries.test.ts
 * @description 界面字典一致性：每个域的中英文 key 集合完全相同，文件只含本域顶层键，所有文案都能被 vue-i18n 编译
 * @author TixXin
 * @since 2026-10-19
 */

import { afterAll, describe, expect, it } from 'vitest'
import { DICTIONARY_DOMAINS, SUPPORTED_LOCALES } from '../../i18n/localeOptions'

// 按文件原文读取全部字典（?raw 绕过 i18n 插件的预编译），键为 <locale>/<域>.json
const dictionaryFiles = Object.fromEntries(
  Object.entries(
    import.meta.glob<string>('../../i18n/locales/*/*.json', { eager: true, query: '?raw', import: 'default' }),
  ).map(([path, content]) => [path.replace('../../i18n/locales/', ''), JSON.parse(content) as Record<string, unknown>]),
)

function readDictionary(locale: string, domain: string): Record<string, unknown> {
  const dictionary = dictionaryFiles[`${locale}/${domain}.json`]
  if (!dictionary) throw new Error(`缺少字典文件 ${locale}/${domain}.json`)
  return dictionary
}

/** 展开为 a.b.c 形式的叶子路径；叶子必须是非空字符串 */
function leafEntries(value: unknown, prefix = ''): Array<[string, unknown]> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return Object.entries(value).flatMap(([key, child]) => leafEntries(child, prefix ? `${prefix}.${key}` : key))
  }
  return [[prefix, value]]
}

describe('界面字典文件', () => {
  it('每种语言恰好包含全部域文件，没有多余文件', () => {
    for (const locale of SUPPORTED_LOCALES) {
      const files = Object.keys(dictionaryFiles)
        .filter((path) => path.startsWith(`${locale}/`))
        .map((path) => path.slice(locale.length + 1))
        .sort()
      expect(files).toEqual(DICTIONARY_DOMAINS.map((domain) => `${domain}.json`).sort())
    }
  })

  it.each(DICTIONARY_DOMAINS)('%s 域只含同名顶层键，中英文 key 集合完全相同', (domain) => {
    const [zh, en] = SUPPORTED_LOCALES.map((locale) => readDictionary(locale, domain))
    for (const dictionary of [zh, en]) {
      const topKeys = Object.keys(dictionary!)
      // 空域文件 {} 只用于占位；有内容时唯一的顶层键必须是域名，防止并行迁移写进别的域。
      expect(topKeys.length === 0 || (topKeys.length === 1 && topKeys[0] === domain)).toBe(true)
      for (const [key, value] of leafEntries(dictionary)) {
        if (!key) continue
        expect(typeof value === 'string' && value.trim().length > 0, `${domain}: ${key}`).toBe(true)
      }
    }
    const keys = (dictionary: Record<string, unknown> | undefined) =>
      leafEntries(dictionary)
        .map(([key]) => key)
        .filter(Boolean)
        .sort()
    expect(keys(en)).toEqual(keys(zh))
  })
})

describe('界面字典运行时', () => {
  /** 用到时再取：收集阶段 Nuxt 测试应用尚未就绪 */
  const i18n = () => useNuxtApp().$i18n

  afterAll(async () => {
    await i18n().setLocale('zh-CN')
  })

  it.each(SUPPORTED_LOCALES)('%s 的每条文案都能编译并解析，不回落到 key', async (locale) => {
    await i18n().setLocale(locale)
    expect(i18n().locale.value).toBe(locale)
    for (const domain of DICTIONARY_DOMAINS) {
      for (const [key, value] of leafEntries(readDictionary(locale, domain))) {
        if (!key) continue
        const rendered = i18n().t(key, { site: 'S', days: 3, date: '2026-01-01' })
        expect(rendered, `${locale}: ${key}`).not.toBe(key)
        expect(typeof value).toBe('string')
      }
    }
  })
})
