/**
 * @file visitorId.test.ts
 * @description 访客身份回归：持久化复用及禁用存储时会话内稳定
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ensureVisitorId } from '../../app/utils/visitorId'

afterEach(() => vi.restoreAllMocks())

describe('访客请求身份', () => {
  it('复用存储的合法身份，替换不合法的存储值', () => {
    localStorage.setItem('tixxin-visitor-id', 'invalid id')
    const id = ensureVisitorId()
    expect(id).not.toBe('invalid id')
    expect(ensureVisitorId()).toBe(id)
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
