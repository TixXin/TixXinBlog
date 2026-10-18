/** @file articleNavigationApi.test.ts @description 文章导航查询范围、取消信号与错误响应契约 */
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { fetchPostNavigation } from '../../app/features/post/api'

const mocks = vi.hoisted(() => ({ fetch: vi.fn() }))
// Nuxt 会把 API 中的 $fetch 转为自动导入，需同步替换导入绑定与全局入口。
mockNuxtImport('$fetch', () => mocks.fetch)
beforeEach(() => {
  mocks.fetch.mockReset()
  vi.stubGlobal('$fetch', mocks.fetch)
})
afterEach(() => vi.unstubAllGlobals())

it.each([undefined, 'all', 'folder'] as const)('导航范围 %s 作为查询参数发送，并保留取消信号', async (scope) => {
  const data = { prev: null, next: { id: '8', slug: '上一篇', title: '上一篇', category: '前端', date: '2026-10-01' } }
  mocks.fetch.mockResolvedValue({ code: 0, data })
  const signal = new AbortController().signal
  await expect(fetchPostNavigation('/api/v1/', '9/10', signal, scope)).resolves.toEqual(data)
  expect(mocks.fetch).toHaveBeenCalledExactlyOnceWith('/api/v1/posts/9%2F10/navigation', {
    query: { scope: scope ?? 'all' },
    signal,
    timeout: 10000,
    retry: 0,
  })
})

it('导航 HTTP 失败与业务错误均抛出，不转为空相邻文章', async () => {
  const unavailable = new Error('接口不可用')
  mocks.fetch
    .mockRejectedValueOnce(unavailable)
    .mockResolvedValueOnce({ code: 400, message: '导航范围无效', data: null })
  await expect(fetchPostNavigation('/api/v1', '9', undefined, 'folder')).rejects.toBe(unavailable)
  await expect(fetchPostNavigation('/api/v1', '9')).rejects.toThrow('API 错误 400: 导航范围无效')
})
