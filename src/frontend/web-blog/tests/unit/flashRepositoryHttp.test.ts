/**
 * @file flashRepositoryHttp.test.ts
 * @description 闪念公开读取、管理读取与写入使用一致的可读错误，保留 HTTP 状态供调用方判断
 */
import { describe, expect, it, vi } from 'vitest'
import { registerEndpoint } from '@nuxt/test-utils/runtime'
import { HttpFlashRepository } from '../../app/features/flash/repository.http'

const offline = () =>
  Object.assign(new Error('[GET] /api/v1/admin/flashes: 502 Server Error'), {
    statusCode: 502,
    data: { message: 'upstream internal details' },
  })

describe('闪念传输错误', () => {
  it.each(['admin', 'archive', 'write'] as const)('%s 故障不暴露请求地址，且不会自动重试写入', async (operation) => {
    const request = vi.fn().mockRejectedValue(offline())
    const repo = new HttpFlashRepository('/api/v1', request, () => true)
    const task =
      operation === 'archive'
        ? repo.listArchived('owner')
        : operation === 'write'
          ? repo.setPinned('note', true)
          : repo.list('owner')
    await expect(task).rejects.toMatchObject({ message: '闪念服务暂时不可用，请稍后重试', statusCode: 502 })
    expect(request).toHaveBeenCalledTimes(1)
  })

  it('公开读取的真实 FetchError 也转换为可读提示', async () => {
    const unavailable = vi.fn(() => new Response(JSON.stringify({ message: 'upstream details' }), { status: 502 }))
    registerEndpoint('/api/v1/flashes', unavailable)
    const repo = new HttpFlashRepository('/api/v1', vi.fn(), () => false)
    await expect(repo.list('owner')).rejects.toMatchObject({
      message: '闪念服务暂时不可用，请稍后重试',
      statusCode: 502,
    })
    expect(unavailable).toHaveBeenCalledTimes(1)
  })

  it('保留可操作的业务校验信息', async () => {
    const request = vi.fn().mockRejectedValue({ statusCode: 400, data: { message: '闪念内容不能为空' } })
    const repo = new HttpFlashRepository('/api/v1', request, () => true)
    await expect(repo.update('note', { content: '' })).rejects.toMatchObject({
      statusCode: 400,
      message: '闪念内容不能为空',
    })
  })

  it('请求恢复后仍读取真实列表', async () => {
    const request = vi
      .fn()
      .mockRejectedValueOnce(offline())
      .mockResolvedValueOnce({ items: [], total: 0, page: 1, pageSize: 100 })
    const repo = new HttpFlashRepository('/api/v1', request, () => true)
    await expect(repo.list('owner')).rejects.toThrow('闪念服务暂时不可用')
    await expect(repo.list('owner')).resolves.toEqual([])
  })
})

describe('闪念公开分页读取', () => {
  const envelope = (data: unknown) => ({ code: 0, message: 'ok', data })
  const empty = { items: [], total: 0, page: 1, pageSize: 20 }

  it('标签走列表接口，关键词走搜索接口，只读取请求的那一页', async () => {
    const list = vi.fn((event: { path: string }) => {
      void event
      return envelope(empty)
    })
    const search = vi.fn((event: { path: string }) => {
      void event
      return envelope(empty)
    })
    registerEndpoint('/api/v1/flashes', list)
    registerEndpoint('/api/v1/flashes/search', search)
    const admin = vi.fn()
    const repo = new HttpFlashRepository('/api/v1', admin, () => false)
    await repo.listPublicPage({ page: 2, pageSize: 20, tag: '生活' })
    await repo.listPublicPage({ page: 1, pageSize: 20, q: ' 山顶 ' })
    expect(list).toHaveBeenCalledTimes(1)
    expect(search).toHaveBeenCalledTimes(1)
    const listQuery = new URL(list.mock.calls[0]![0].path, 'http://local').searchParams
    expect(Object.fromEntries(listQuery)).toEqual({ page: '2', pageSize: '20', tag: '生活' })
    const searchQuery = new URL(search.mock.calls[0]![0].path, 'http://local').searchParams
    expect(Object.fromEntries(searchQuery)).toEqual({ page: '1', pageSize: '20', q: '山顶' })
    expect(admin).not.toHaveBeenCalled()
  })

  it('标签、类型、日期与关键词组合时全部交给搜索接口，不静默丢弃任何条件', async () => {
    const list = vi.fn(() => envelope(empty))
    const search = vi.fn((event: { path: string }) => {
      void event
      return envelope(empty)
    })
    registerEndpoint('/api/v1/flashes', list)
    registerEndpoint('/api/v1/flashes/search', search)
    const repo = new HttpFlashRepository('/api/v1', vi.fn(), () => false)
    await repo.listPublicPage({ page: 1, pageSize: 20, tag: '生活', q: '山顶', type: 'memo', date: '2026-10-14' })
    expect(list).not.toHaveBeenCalled()
    const query = new URL(search.mock.calls[0]![0].path, 'http://local').searchParams
    expect(Object.fromEntries(query)).toEqual({
      page: '1',
      pageSize: '20',
      q: '山顶',
      tag: '生活',
      type: 'memo',
      date: '2026-10-14',
    })
  })

  it('类型与日期筛选走列表接口', async () => {
    const list = vi.fn((event: { path: string }) => {
      void event
      return envelope(empty)
    })
    registerEndpoint('/api/v1/flashes', list)
    const repo = new HttpFlashRepository('/api/v1', vi.fn(), () => false)
    await repo.listPublicPage({ page: 1, pageSize: 20, type: 'idea', date: '2026-10-01' })
    const query = new URL(list.mock.calls[0]![0].path, 'http://local').searchParams
    expect(Object.fromEntries(query)).toEqual({ page: '1', pageSize: '20', type: 'idea', date: '2026-10-01' })
  })

  it('概览一次请求读取聚合结果，失败时同样给出可读提示', async () => {
    const data = {
      total: 3,
      monthCount: 1,
      dates: [{ date: '2026-10-14', count: 3 }],
      tags: [{ name: '生活', count: 2 }],
      onThisDay: null,
      recollections: [],
      likedIds: ['a1'],
    }
    const overview = vi.fn(() => envelope(data))
    registerEndpoint('/api/v1/flashes/overview', overview)
    const repo = new HttpFlashRepository('/api/v1', vi.fn(), () => false)
    await expect(repo.overview()).resolves.toEqual(data)
    expect(overview).toHaveBeenCalledTimes(1)
    registerEndpoint('/api/v1/flashes/overview', () => new Response('{}', { status: 503 }))
    await expect(repo.overview()).rejects.toMatchObject({ message: '闪念服务暂时不可用，请稍后重试', statusCode: 503 })
  })

  it('分页读取失败同样转换为可读提示并保留状态码', async () => {
    registerEndpoint(
      '/api/v1/flashes',
      () => new Response(JSON.stringify({ message: '操作过于频繁' }), { status: 429 }),
    )
    const repo = new HttpFlashRepository('/api/v1', vi.fn(), () => false)
    await expect(repo.listPublicPage({ page: 1, pageSize: 20 })).rejects.toMatchObject({ statusCode: 429 })
  })
})
