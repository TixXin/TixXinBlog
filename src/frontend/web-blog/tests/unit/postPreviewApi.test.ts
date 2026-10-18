/** @file postPreviewApi.test.ts @description 预览凭据输入、真实只读请求、禁缓存及错误脱敏回归 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { fetchPostPreview } from '../../app/features/post/api'
import { postPreviewToken } from '../../app/features/post/preview'

const fetchMock = vi.hoisted(() => vi.fn())
mockNuxtImport('$fetch', () => fetchMock)

afterEach(() => fetchMock.mockReset())

describe('草稿预览请求边界', () => {
  it('只接受单个限长令牌，拒绝重复参数与非字符串输入', () => {
    expect(postPreviewToken('signed.token')).toBe('signed.token')
    for (const value of [undefined, null, ['a', 'b'], 42, 'x'.repeat(4097)]) {
      expect(postPreviewToken(value)).toBe('')
    }
  })

  it('仅通过真实预览接口读取，显式禁缓存、禁 Referer，不附带访客身份', async () => {
    fetchMock.mockResolvedValue({ code: 0, data: { id: '7', date: '2026-10-18T10:00:00Z' } })
    const signal = new AbortController().signal
    await expect(fetchPostPreview('/api/v1/', 'signed.token', signal)).resolves.toEqual({ id: '7', date: '2026-10-18' })
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith('/api/v1/posts/preview', {
      query: { token: 'signed.token' },
      signal,
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
      timeout: 10000,
      retry: 0,
    })
  })

  it.each([400, 401, 403, 404, 410])('凭据拒绝 %s 返回明确失效反馈且不泄露底层请求地址', async (statusCode) => {
    fetchMock.mockRejectedValue({ statusCode, message: '/posts/preview?token=secret' })
    await expect(fetchPostPreview('/api/v1', 'secret')).rejects.toMatchObject({
      statusCode,
      message: '预览链接无效或已过期，请向博主获取新的链接。',
    })
  })

  it('缺失令牌不请求接口，网络或业务失败不回退样本', async () => {
    fetchMock.mockRejectedValue(new Error('/posts/preview?token=secret'))
    await expect(fetchPostPreview('/api/v1', '')).rejects.toMatchObject({ statusCode: 400 })
    expect(fetchMock).not.toHaveBeenCalled()
    await expect(fetchPostPreview('/api/v1', 'secret')).rejects.toMatchObject({
      statusCode: 503,
      message: '暂时无法读取草稿预览，请稍后重试。',
    })
    fetchMock.mockResolvedValueOnce({ code: 123, data: null })
    await expect(fetchPostPreview('/api/v1', 'secret')).rejects.toMatchObject({ statusCode: 503 })
  })
})
