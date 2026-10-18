/** @file articleNavigationApi.test.ts @description 文章导航查询范围、取消信号与错误响应契约 */
import { afterEach, expect, it, vi } from 'vitest'
import { fetchPostNavigation } from '../../app/features/post/api'

afterEach(() => vi.unstubAllGlobals())

it.each([undefined, 'all', 'folder'] as const)('导航范围 %s 作为查询参数发送，并保留取消信号', async (scope) => {
  const data = { prev: null, next: { id: '8', slug: '上一篇', title: '上一篇', category: '前端', date: '2026-10-01' } }
  const fetch = vi.fn().mockResolvedValue({ code: 0, data })
  vi.stubGlobal('$fetch', fetch)
  const signal = new AbortController().signal
  await expect(fetchPostNavigation('/api/v1/', '9/10', signal, scope)).resolves.toEqual(data)
  expect(fetch).toHaveBeenCalledExactlyOnceWith('/api/v1/posts/9%2F10/navigation', {
    query: { scope: scope ?? 'all' },
    signal,
    timeout: 10000,
    retry: 0,
  })
})

it('导航 HTTP 失败与业务错误均抛出，不转为空相邻文章', async () => {
  const unavailable = new Error('接口不可用')
  const fetch = vi
    .fn()
    .mockRejectedValueOnce(unavailable)
    .mockResolvedValueOnce({ code: 400, message: '导航范围无效', data: null })
  vi.stubGlobal('$fetch', fetch)
  await expect(fetchPostNavigation('/api/v1', '9', undefined, 'folder')).rejects.toBe(unavailable)
  await expect(fetchPostNavigation('/api/v1', '9')).rejects.toThrow('API 错误 400: 导航范围无效')
})
