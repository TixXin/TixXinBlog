/**
 * @file visitorId.test.ts
 * @description 访客身份回归：持久化复用、禁用存储时会话内稳定，只读判断不生成身份
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ensureVisitorId, hasStoredVisitorId } from '../../app/utils/visitorId'

afterEach(() => vi.restoreAllMocks())

describe('访客请求身份', () => {
  it('复用存储的合法身份，替换不合法的存储值', () => {
    localStorage.setItem('blog-visitor-id', 'invalid id')
    const id = ensureVisitorId()
    expect(id).not.toBe('invalid id')
    expect(ensureVisitorId()).toBe(id)
  })

  it('只读判断不生成新身份，只承认合法的已存身份', () => {
    localStorage.removeItem('blog-visitor-id')
    expect(hasStoredVisitorId()).toBe(false)
    expect(localStorage.getItem('blog-visitor-id')).toBeNull()
    localStorage.setItem('blog-visitor-id', 'invalid id')
    expect(hasStoredVisitorId()).toBe(false)
    ensureVisitorId()
    expect(hasStoredVisitorId()).toBe(true)
  })

  it('存储不可用时仍对所有请求使用同一会话身份', () => {
    vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => {
      throw new Error('storage disabled')
    })
    const id = ensureVisitorId()
    expect(id).toBeTruthy()
    expect(ensureVisitorId()).toBe(id)
  })
})
