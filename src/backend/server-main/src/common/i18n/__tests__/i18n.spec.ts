/**
 * @file i18n.spec.ts
 * @description 接口语言解析、字典渲染、字典一致性与持久化中文反查的回归
 * @author TixXin
 * @since 2026-10-19
 */
import { MESSAGES, MESSAGE_TABLES } from '../messages'
import type { MessageEntry } from '../messages/types'
import { msg, requestLocale, resolveApiLocale, storedMessage, translate, translateStored, zh } from '..'

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort()

describe('resolveApiLocale', () => {
  it.each([
    [undefined, 'zh-CN'],
    ['', 'zh-CN'],
    ['en', 'en'],
    ['en-US,en;q=0.9', 'en'],
    ['zh-CN', 'zh-CN'],
    ['zh-TW', 'zh-CN'],
    ['fr-FR', 'zh-CN'],
    ['*', 'zh-CN'],
    ['fr, en;q=0.5', 'en'],
    ['zh-CN;q=0.4, en;q=0.8', 'en'],
    ['en;q=0, zh', 'zh-CN'],
    ['zh-CN,zh;q=0.9,en;q=0.8', 'zh-CN'],
    [['en', 'zh'], 'en'],
  ])('%j → %s', (header, expected) => {
    expect(resolveApiLocale(header)).toBe(expected)
  })

  it('同一请求只解析一次，非对象回退中文', () => {
    const request = { headers: { 'accept-language': 'en' } }
    expect(requestLocale(request)).toBe('en')
    request.headers['accept-language'] = 'zh-CN'
    expect(requestLocale(request)).toBe('en')
    expect(requestLocale(undefined)).toBe('zh-CN')
  })
})

describe('字典', () => {
  const entries = Object.entries(MESSAGES) as [string, MessageEntry][]

  it('各域 key 以域名开头且跨域不重复', () => {
    const seen = new Set<string>()
    for (const [domain, table] of Object.entries(MESSAGE_TABLES)) {
      for (const key of Object.keys(table)) {
        expect(key.startsWith(`${domain}.`)).toBe(true)
        expect(seen.has(key)).toBe(false)
        seen.add(key)
      }
    }
    expect(seen.size).toBe(entries.length)
  })

  it('中英文案非空，具名占位符一致', () => {
    for (const [key, entry] of entries) {
      expect([key, entry.zh.trim().length > 0, entry.en.trim().length > 0]).toEqual([key, true, true])
      expect([key, placeholders(entry.en)]).toEqual([key, placeholders(entry.zh)])
      expect([key, /[一-鿿]/.test(entry.en)]).toEqual([key, false])
    }
  })
})

describe('translate / msg', () => {
  it('默认中文，en 返回英文并插值', () => {
    expect(zh('common.rateLimited')).toBe('操作过于频繁，请稍后重试')
    expect(translate('en', 'common.rateLimited')).toBe('Too many requests. Please try again later.')
    expect(translate('zh-CN', 'not.a.key')).toBe('not.a.key')
  })

  it('msg 的 message 是中文渲染结果，并保留 key 与参数', () => {
    expect(msg('common.relationSelf')).toEqual({ message: '内容不能关联自身', messageKey: 'common.relationSelf' })
  })

  it('持久化中文可反查回 key，字典外文本原样返回', () => {
    expect(storedMessage('内容不能关联自身')?.messageKey).toBe('common.relationSelf')
    expect(storedMessage('博主手写的说明')).toBeUndefined()
    expect(translateStored('en', '数据库尚未就绪')).toBe('The database is not ready yet')
    expect(translateStored('zh-CN', '数据库尚未就绪')).toBe('数据库尚未就绪')
    expect(translateStored('en', '博主手写的说明')).toBe('博主手写的说明')
  })
})
