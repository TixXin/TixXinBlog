// @vitest-environment node
/**
 * @file authVersionCookie.test.ts
 * @description 版本 Cookie 不参与 SSR 缓存分键：只剥离它本身，其余 Cookie 原样保留
 */
import { describe, expect, it } from 'vitest'
import { stripAuthVersionCookie } from '../../server/utils/authVersionCookie'

describe('stripAuthVersionCookie', () => {
  it('去掉版本 Cookie，保留语言与主题等其余条目的顺序和取值', () => {
    expect(stripAuthVersionCookie('blog-locale=en; tixxin_rv=1b2c; blog-theme=dock')).toBe(
      'blog-locale=en; blog-theme=dock',
    )
    expect(stripAuthVersionCookie('tixxin_rv=a=b;blog-locale=zh-CN')).toBe('blog-locale=zh-CN')
  })
  it('只有版本 Cookie 时整体去空，没有时原样返回', () => {
    expect(stripAuthVersionCookie('tixxin_rv=1b2c')).toBeUndefined()
    expect(stripAuthVersionCookie(undefined)).toBeUndefined()
    expect(stripAuthVersionCookie('blog-locale=en')).toBe('blog-locale=en')
  })
  it('不误删名字相近的 Cookie', () => {
    expect(stripAuthVersionCookie('tixxin_rv_extra=1; x_tixxin_rv=2')).toBe('tixxin_rv_extra=1; x_tixxin_rv=2')
  })
})
