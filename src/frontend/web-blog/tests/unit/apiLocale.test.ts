/**
 * @file apiLocale.test.ts
 * @description 浏览器同源 API 请求附带界面语言的判定与请求头合并
 * @author TixXin
 * @since 2026-10-19
 */
import { describe, expect, it } from 'vitest'
import { API_LOCALE_HEADER, isSameOriginApiRequest, withApiLocale } from '~/utils/apiLocale'

const origin = 'https://blog.example.test'

describe('isSameOriginApiRequest', () => {
  it.each([
    ['/api/v1/posts', true],
    ['/api/v1', true],
    [`${origin}/api/v1/admin/posts`, true],
    [new URL(`${origin}/api/v1/site`), true],
    [{ url: `${origin}/api/v1/site` }, true],
    ['/api/v10/posts', false],
    ['/_i18n/abc/en/messages.json', false],
    ['https://other.example.test/api/v1/posts', false],
    ['', false],
    [undefined, false],
  ])('%s → %s', (request, expected) => {
    expect(isSameOriginApiRequest(request, origin)).toBe(expected)
  })
})

describe('withApiLocale', () => {
  it('补充受支持的语言并保留原有请求头', () => {
    const headers = withApiLocale({ Authorization: 'Bearer token' }, 'en')
    expect(headers.get(API_LOCALE_HEADER)).toBe('en')
    expect(headers.get('authorization')).toBe('Bearer token')
  })

  it('调用方显式设置时不覆盖，无效语言不添加', () => {
    expect(withApiLocale({ [API_LOCALE_HEADER]: 'zh-CN' }, 'en').get(API_LOCALE_HEADER)).toBe('zh-CN')
    expect(withApiLocale(undefined, 'fr').has(API_LOCALE_HEADER)).toBe(false)
  })
})
